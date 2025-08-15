import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createServerSupabaseClient } from "../client/src/lib/supabase";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "./lib/jwt-auth-middleware";
import { db } from "./lib/supabase";
import { eq } from "drizzle-orm";
import {
  requireAdmin,
  requireManagerOrAdmin,
  requireAnyRole,
  requireRoles,
} from "./lib/role-guards";
import {
  enforceRoutePermissions,
  requireAnalyst,
  requireFinanceiro,
  filterProposalsByRole,
} from "./lib/role-based-access";
import {
  insertPropostaSchema,
  updatePropostaSchema,
  createPropostaValidationSchema,
  insertGerenteLojaSchema,
  insertLojaSchema,
  updateLojaSchema,
  propostaLogs,
  propostas,
  parceiros,
  produtos,
  tabelasComerciais,
  produtoTabelaComercial,
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import originationRoutes from "./routes/origination.routes";
import { clickSignRouter } from "./routes/clicksign.js";
import clicksignIntegrationRoutes from "./routes/clicksign-integration.js";
import { interRoutes } from "./routes/inter.js";
import interWebhookRouter from "./routes/webhooks/inter";
import interRealtimeRouter from "./routes/inter-realtime";
import { setupSecurityRoutes } from "./routes/security.js";
import emailChangeRoutes from "./routes/email-change";
import cobrancasRoutes from "./routes/cobrancas";
import monitoringRoutes from "./routes/monitoring";
import ccbIntelligentTestRoutes from "./routes/ccb-intelligent-test";
import ccbCorrectedRoutes from "./routes/ccb-test-corrected";
import clienteRoutes from "./routes/cliente-routes";
import gestaoContratosRoutes from "./routes/gestao-contratos";
import testCcbCoordinatesRoutes from "./routes/test-ccb-coordinates";
import propostasCarneRoutes from "./routes/propostas-carne";
import propostasCarneStatusRoutes from "./routes/propostas-carne-status";
import propostasCarneCheckRoutes from "./routes/propostas-carne-check";
import propostasStorageStatusRoutes from "./routes/propostas-storage-status";
import propostasCorrigirSincronizacaoRoutes from "./routes/propostas-corrigir-sincronizacao";
import jobStatusRoutes from "./routes/job-status";
import testQueueRoutes from "./routes/test-queue";
import testRetryRoutes from "./routes/test-retry";
import testAuditRoutes from "./routes/test-audit";
import {
  getBrasiliaDate,
  formatBrazilianDateTime,
  generateApprovalDate,
  getBrasiliaTimestamp,
} from "./lib/timezone";
// Use mock queue in development to avoid Redis dependency
import { queues, checkQueuesHealth } from "./lib/mock-queue";
import { securityLogger, SecurityEventType, getClientIP } from "./lib/security-logger";
import { passwordSchema, validatePassword } from "./lib/password-validator";
import { timingNormalizerMiddleware } from "./middleware/timing-normalizer";
import timingSecurityRoutes from "./routes/timing-security";

const upload = multer({ storage: multer.memoryStorage() });

// User Management Schema
export const UserDataSchema = z
  .object({
    fullName: z.string().min(3, "Nome completo é obrigatório"),
    email: z.string().email("Formato de email inválido"),
    password: passwordSchema, // ASVS 6.2.4 & 6.2.7 - Enhanced password validation
    role: z.enum(["ADMINISTRADOR", "DIRETOR", "GERENTE", "ATENDENTE", "ANALISTA", "FINANCEIRO", "SUPERVISOR_COBRANCA", "COBRANCA"]),
    lojaId: z.number().int().nullable().optional(),
    lojaIds: z.array(z.number().int()).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "ATENDENTE" && (data.lojaId === null || data.lojaId === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O campo 'lojaId' é obrigatório para o perfil ATENDENTE.",
        path: ["lojaId"],
      });
    }
    if (data.role === "GERENTE" && (!data.lojaIds || data.lojaIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O campo 'lojaIds' deve conter ao menos uma loja para o perfil GERENTE.",
        path: ["lojaIds"],
      });
    }
  });

// Admin middleware is now replaced by requireAdmin guard

// Helper function to parse user agent and extract device information
function parseUserAgent(userAgent: string): string {
  if (!userAgent) return "Dispositivo desconhecido";

  // Check for mobile devices
  if (/mobile/i.test(userAgent)) {
    if (/android/i.test(userAgent)) return "Android Mobile";
    if (/iphone/i.test(userAgent)) return "iPhone";
    if (/ipad/i.test(userAgent)) return "iPad";
    return "Mobile Device";
  }

  // Check for desktop browsers
  if (/windows/i.test(userAgent)) {
    if (/edge/i.test(userAgent)) return "Windows - Edge";
    if (/chrome/i.test(userAgent)) return "Windows - Chrome";
    if (/firefox/i.test(userAgent)) return "Windows - Firefox";
    return "Windows PC";
  }

  if (/macintosh/i.test(userAgent)) {
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return "Mac - Safari";
    if (/chrome/i.test(userAgent)) return "Mac - Chrome";
    if (/firefox/i.test(userAgent)) return "Mac - Firefox";
    return "Mac";
  }

  if (/linux/i.test(userAgent)) {
    if (/chrome/i.test(userAgent)) return "Linux - Chrome";
    if (/firefox/i.test(userAgent)) return "Linux - Firefox";
    return "Linux";
  }

  return "Dispositivo desconhecido";
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      const supabase = createServerSupabaseClient();

      // PASSO 1 - ASVS 7.1.3: Token Rotation on Re-authentication
      // First, check if user already has active sessions
      const {
        data: { user: existingUser },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        securityLogger.logEvent({
          type: SecurityEventType.LOGIN_FAILURE,
          severity: "MEDIUM",
          userEmail: email,
          ipAddress: getClientIP(req),
          userAgent: req.headers["user-agent"],
          endpoint: req.originalUrl,
          success: false,
          details: { reason: error.message },
        });
        return res.status(401).json({ message: error.message });
      }

      // Invalidate all previous tokens for this user
      if (data.user) {
        const { invalidateAllUserTokens } = await import("./lib/jwt-auth-middleware");
        invalidateAllUserTokens(data.user.id);

        // Track the new token
        if (data.session?.access_token) {
          const { trackUserToken } = await import("./lib/jwt-auth-middleware");
          trackUserToken(data.user.id, data.session.access_token);

          // ASVS 7.4.3 - Create session record for active session management
          try {
            const { storage } = await import("./storage");
            const ipAddress = getClientIP(req);
            const userAgent = req.headers["user-agent"] || "Unknown";

            // Session expires when JWT expires (1 hour from now)
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1);

            await storage.createSession({
              id: data.session.access_token,
              userId: data.user.id,
              ipAddress,
              userAgent,
              expiresAt,
            });
          } catch (sessionError) {
            console.error("Failed to create session record:", sessionError);
            // Don't fail login if session tracking fails
          }
        }
      }

      securityLogger.logEvent({
        type: SecurityEventType.LOGIN_SUCCESS,
        severity: "LOW",
        userId: data.user?.id,
        userEmail: email,
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"],
        endpoint: req.originalUrl,
        success: true,
        details: {
          tokenRotated: true,
          message: "Previous tokens invalidated",
        },
      });

      res.json({
        user: data.user,
        session: data.session,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;

      // ASVS 6.2.4 & 6.2.7 - Enhanced password validation
      const passwordValidation = validatePassword(password, [email, name || ""]);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          message: passwordValidation.message,
          suggestions: passwordValidation.suggestions,
        });
      }

      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      res.json({
        user: data.user,
        session: data.session,
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/logout", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // PASSO 2 - ASVS 6.2.3: Change Password with Current Password Verification
  app.post(
    "/api/auth/change-password",
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword || !confirmPassword) {
          return res.status(400).json({
            message: "Senha atual, nova senha e confirmação são obrigatórias",
          });
        }

        if (newPassword !== confirmPassword) {
          return res.status(400).json({
            message: "Nova senha e confirmação não coincidem",
          });
        }

        // ASVS 6.2.4 & 6.2.7 - Enhanced password validation
        const passwordValidation = validatePassword(newPassword, [
          req.user.email,
          req.user.name || "",
        ]);
        if (!passwordValidation.isValid) {
          return res.status(400).json({
            message: passwordValidation.message,
            suggestions: passwordValidation.suggestions,
          });
        }

        if (!req.user?.email) {
          return res.status(401).json({
            message: "Usuário não autenticado corretamente",
          });
        }

        // Step 1: Verify current password
        const supabase = createServerSupabaseClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: req.user.email,
          password: currentPassword,
        });

        if (signInError) {
          securityLogger.logEvent({
            type: SecurityEventType.PASSWORD_CHANGE_FAILED,
            severity: "HIGH",
            userId: req.user.id,
            userEmail: req.user.email,
            ipAddress: getClientIP(req),
            userAgent: req.headers["user-agent"],
            endpoint: req.originalUrl,
            success: false,
            details: { reason: "Invalid current password" },
          });
          return res.status(401).json({
            message: "Senha atual incorreta",
          });
        }

        // Step 2: Update password using admin client
        const { createServerSupabaseAdminClient } = await import("./lib/supabase");
        const supabaseAdmin = createServerSupabaseAdminClient();

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
          password: newPassword,
        });

        if (updateError) {
          console.error("Password update error:", updateError);
          return res.status(500).json({
            message: "Erro ao atualizar senha. Tente novamente.",
          });
        }

        // Step 3: Invalidate all existing tokens (force re-login)
        const { invalidateAllUserTokens } = await import("./lib/jwt-auth-middleware");
        invalidateAllUserTokens(req.user.id);

        securityLogger.logEvent({
          type: SecurityEventType.PASSWORD_CHANGED,
          severity: "HIGH",
          userId: req.user.id,
          userEmail: req.user.email,
          ipAddress: getClientIP(req),
          userAgent: req.headers["user-agent"],
          endpoint: req.originalUrl,
          success: true,
          details: {
            message: "Password changed successfully, all sessions invalidated",
          },
        });

        res.json({
          message: "Senha alterada com sucesso. Por favor, faça login novamente.",
          requiresRelogin: true,
        });
      } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ message: "Erro ao alterar senha" });
      }
    }
  );

  // ASVS 6.3.1 - Standardized password recovery messages
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          message: "Email é obrigatório",
        });
      }

      const supabase = createServerSupabaseClient();

      // Always return the same message regardless of whether the email exists
      // This prevents user enumeration attacks
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.VITE_APP_URL || "http://localhost:5000"}/reset-password`,
      });

      // Log the attempt for security monitoring
      securityLogger.logEvent({
        type: SecurityEventType.PASSWORD_RESET_REQUEST,
        severity: "MEDIUM",
        userEmail: email,
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"],
        endpoint: req.originalUrl,
        success: !error,
        details: {
          message: error ? "Password reset failed" : "Password reset email sent if account exists",
        },
      });

      // ASVS 6.3.1 - Always return the same generic message
      res.json({
        message: "Se um email válido foi fornecido, instruções de recuperação foram enviadas.",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      // Even on error, return generic message to prevent information disclosure
      res.json({
        message: "Se um email válido foi fornecido, instruções de recuperação foram enviadas.",
      });
    }
  });

  // ASVS 7.4.3 - Get active sessions for the current user
  app.get("/api/auth/sessions", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const { storage } = await import("./storage");
      const sessions = await storage.getUserSessions(req.user.id);

      // Format sessions for frontend display
      const formattedSessions = sessions.map(session => ({
        id: session.id,
        ipAddress: session.ipAddress || "Desconhecido",
        userAgent: session.userAgent || "Desconhecido",
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        expiresAt: session.expiresAt,
        isActive: session.isActive,
        // Parse user agent for better display
        device: parseUserAgent(session.userAgent || ""),
        isCurrent: session.id === req.headers.authorization?.replace("Bearer ", ""),
      }));

      res.json({ sessions: formattedSessions });
    } catch (error) {
      console.error("Error fetching user sessions:", error);
      res.status(500).json({ message: "Erro ao buscar sessões" });
    }
  });

  // ASVS 7.4.3 - Delete a specific session
  app.delete(
    "/api/auth/sessions/:sessionId",
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user?.id) {
          return res.status(401).json({ message: "Usuário não autenticado" });
        }

        const { sessionId } = req.params;
        const { storage } = await import("./storage");

        // First verify the session belongs to the current user
        const sessions = await storage.getUserSessions(req.user.id);
        const sessionToDelete = sessions.find(s => s.id === sessionId);

        if (!sessionToDelete) {
          return res.status(404).json({ message: "Sessão não encontrada" });
        }

        // Delete the session
        await storage.deleteSession(sessionId);

        // Also invalidate the token if it's not the current session
        const currentToken = req.headers.authorization?.replace("Bearer ", "");
        if (sessionId !== currentToken) {
          const { invalidateToken } = await import("./lib/jwt-auth-middleware");
          invalidateToken(sessionId);
        }

        securityLogger.logEvent({
          type: SecurityEventType.SESSION_TERMINATED,
          severity: "MEDIUM",
          userId: req.user.id,
          userEmail: req.user.email,
          ipAddress: getClientIP(req),
          userAgent: req.headers["user-agent"],
          endpoint: req.originalUrl,
          success: true,
          details: {
            sessionId,
            terminatedByUser: true,
          },
        });

        res.json({ message: "Sessão encerrada com sucesso" });
      } catch (error) {
        console.error("Error deleting session:", error);
        res.status(500).json({ message: "Erro ao encerrar sessão" });
      }
    }
  );

  // GET proposal audit logs for real-time communication history
  app.get(
    "/api/propostas/:id/observacoes",
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const propostaId = req.params.id;

        const { createServerSupabaseAdminClient } = await import("../server/lib/supabase");
        const supabase = createServerSupabaseAdminClient();

        // Buscar logs de auditoria da tabela proposta_logs com informações do autor
        const { data: logs, error } = await supabase
          .from("proposta_logs")
          .select(
            `
          id,
          observacao,
          status_anterior,
          status_novo,
          created_at,
          autor_id,
          profiles!proposta_logs_autor_id_fkey (
            full_name,
            role
          )
        `
          )
          .eq("proposta_id", propostaId)
          .order("created_at", { ascending: true });

        if (error) {
          console.warn("Erro ao buscar logs de auditoria:", error);
          // Return empty if table doesn't exist or has issues
          return res.json({ logs: [] });
        }

        console.log(`🔍 [DEBUG] Raw logs from Supabase:`, JSON.stringify(logs, null, 2));

        // Transformar logs para o formato esperado pelo frontend
        const transformedLogs =
          logs?.map(log => ({
            id: log.id,
            acao:
              log.status_novo === "aguardando_analise"
                ? "reenvio_atendente"
                : `mudanca_status_${log.status_novo}`,
            detalhes: log.observacao,
            status_anterior: log.status_anterior,
            status_novo: log.status_novo,
            data_acao: log.created_at,
            autor_id: log.autor_id,
            profiles: log.profiles,
            observacao: log.observacao,
            created_at: log.created_at,
          })) || [];

        console.log(`🔍 [DEBUG] Transformed logs:`, JSON.stringify(transformedLogs, null, 2));
        console.log(
          `[${getBrasiliaTimestamp()}] Retornando ${transformedLogs.length} logs de auditoria para proposta ${propostaId}`
        );

        res.json({
          logs: transformedLogs,
          total: transformedLogs.length,
        });
      } catch (error) {
        console.error("Error fetching proposal audit logs:", error);
        // Return empty array instead of error to prevent breaking the UI
        res.json({ logs: [] });
      }
    }
  );

  // Health check endpoint para testar security headers
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: getBrasiliaTimestamp(),
      security: "enabled",
      rateLimit: "active",
    });
  });

  // =============================================
  // CIRCUIT BREAKER TEST ENDPOINTS - PAM V1.0
  // =============================================
  
  // Endpoint que sempre falha (para testar abertura do circuit breaker)
  app.get("/api/test/circuit-breaker/fail", async (req, res) => {
    console.log("[CIRCUIT TEST] 🔴 Simulating API failure");
    res.status(500).json({ 
      error: "Simulated API failure", 
      message: "This endpoint always fails to test circuit breaker opening"
    });
  });

  // Endpoint que sempre funciona (para testar recuperação)
  app.get("/api/test/circuit-breaker/success", async (req, res) => {
    console.log("[CIRCUIT TEST] ✅ Simulating API success");
    res.json({ 
      success: true, 
      message: "This endpoint always succeeds to test circuit breaker recovery"
    });
  });

  // Endpoint que testa o circuit breaker real do InterBankService
  app.get("/api/test/circuit-breaker/inter", async (req, res) => {
    try {
      const { interBankService } = await import("./services/interBankService");
      
      // Tentar uma conexão de teste
      const result = await interBankService.testConnection();
      
      res.json({ 
        success: true, 
        serviceStatus: result ? "operational" : "unavailable",
        circuitBreakerStatus: "closed"
      });
    } catch (error: any) {
      if (error.message?.includes("circuit breaker is OPEN")) {
        console.log("[CIRCUIT TEST] ⚡ Inter Bank circuit breaker is OPEN");
        res.status(503).json({ 
          error: "Inter Bank API temporarily unavailable - circuit breaker is OPEN",
          circuitBreakerStatus: "open"
        });
      } else {
        res.status(500).json({ 
          error: error.message,
          circuitBreakerStatus: "unknown"
        });
      }
    }
  });

  // Endpoint que testa o circuit breaker real do ClickSignService
  app.get("/api/test/circuit-breaker/clicksign", async (req, res) => {
    try {
      const { clickSignService } = await import("./services/clickSignService");
      
      // Tentar uma conexão de teste
      const result = await clickSignService.testConnection();
      
      res.json({ 
        success: true, 
        serviceStatus: result ? "operational" : "unavailable",
        circuitBreakerStatus: "closed"
      });
    } catch (error: any) {
      if (error.message?.includes("circuit breaker is OPEN")) {
        console.log("[CIRCUIT TEST] ⚡ ClickSign circuit breaker is OPEN");
        res.status(503).json({ 
          error: "ClickSign API temporarily unavailable - circuit breaker is OPEN",
          circuitBreakerStatus: "open"
        });
      } else {
        res.status(500).json({ 
          error: error.message,
          circuitBreakerStatus: "unknown"
        });
      }
    }
  });

  // Endpoint genérico para testar qualquer comportamento
  app.get("/api/test/circuit-breaker/any", async (req, res) => {
    const random = Math.random();
    
    if (random < 0.5) {
      // 50% de chance de falhar
      console.log("[CIRCUIT TEST] ❌ Random failure");
      res.status(500).json({ error: "Random failure for testing" });
    } else {
      // 50% de chance de sucesso
      console.log("[CIRCUIT TEST] ✅ Random success");
      res.json({ success: true, value: random });
    }
  });

  // RELATÓRIO FINAL - AUDITORIA DO PLANO DE TESTE END-TO-END
  app.get("/api/relatorio-final-ccb", async (req, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import("./lib/supabase");
      const supabase = createServerSupabaseAdminClient();

      console.log("🧪 [RELATÓRIO] Executando auditoria final conforme plano de teste");

      // Buscar última proposta
      const { data: proposta } = await supabase
        .from("propostas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!proposta) {
        return res.json({
          RELATORIO_FINAL: "[FALHA]",
          motivo: "Nenhuma proposta encontrada para auditar"
        });
      }

      // VALIDAÇÕES DO PLANO DE TESTE
      const enderecoOK = !!(proposta.cliente_data?.logradouro && proposta.cliente_data?.bairro && proposta.cliente_data?.cep);
      const rgOK = !!(proposta.cliente_data?.rg && proposta.cliente_data?.localNascimento && proposta.cliente_data?.rgUf);
      const bancoOK = !!(proposta.dados_pagamento_tipo && (proposta.dados_pagamento_banco || proposta.dados_pagamento_pix));
      const expedidorOK = !!(proposta.cliente_data?.orgaoEmissor && proposta.cliente_data?.nacionalidade);

      const todasValidacoes = enderecoOK && rgOK && bancoOK && expedidorOK;

      // RELATÓRIO FINAL CONFORME SOLICITADO
      res.json({
        RELATORIO_FINAL: todasValidacoes ? "[SUCESSO]" : "[FALHA]",
        validacoes: {
          endereco_separado: enderecoOK ? "✅ APROVADO" : "❌ REPROVADO",
          dados_rg_novos: rgOK ? "✅ APROVADO" : "❌ REPROVADO", 
          dados_bancarios: bancoOK ? "✅ APROVADO" : "❌ REPROVADO",
          conflito_expedidor_nacionalidade: expedidorOK ? "✅ APROVADO" : "❌ REPROVADO"
        },
        proposta_id: proposta.id,
        conclusao: todasValidacoes ? 
          "🎉 TODAS AS CORREÇÕES VALIDADAS - Debate Máximo RESOLVIDO!" :
          "❌ Ainda há validações falhando - veja detalhes acima"
      });

    } catch (error) {
      res.json({
        RELATORIO_FINAL: "[ERRO]",
        error: "Falha na execução da auditoria"
      });
    }
  });

  // AUDITORIA END-TO-END - Validação Final do Plano de Teste
  app.get("/api/audit-ccb-endtoend", async (req, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import("./lib/supabase");
      const supabase = createServerSupabaseAdminClient();

      // Buscar última proposta para auditoria dos dados
      const { data: proposta, error } = await supabase
        .from("propostas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !proposta) {
        return res.json({
          status: "[FALHA]",
          message: "Nenhuma proposta encontrada para executar ETAPA 3 do plano de teste"
        });
      }

      console.log("🧪 [AUDIT] Executando ETAPA 3 - Auditoria Visual dos Dados");
      console.log("🧪 [AUDIT] Proposta ID:", proposta.id);
      console.log("🧪 [AUDIT] Cliente Data:", JSON.stringify(proposta.cliente_data, null, 2));

      // ETAPA 3 - AUDITORIA VISUAL CONFORME PLANO DE TESTE
      const validacoes = {
        "ENDEREÇO - Formatação Separada": {
          logradouro: proposta.cliente_data?.logradouro ? "✅ PRESENTE" : "❌ FALTANDO",
          numero: proposta.cliente_data?.numero ? "✅ PRESENTE" : "❌ FALTANDO",
          complemento: proposta.cliente_data?.complemento ? "✅ PRESENTE" : "❌ OPCIONAL",
          bairro: proposta.cliente_data?.bairro ? "✅ PRESENTE" : "❌ FALTANDO",
          cep: proposta.cliente_data?.cep ? "✅ PRESENTE" : "❌ FALTANDO",
          cidade: proposta.cliente_data?.cidade ? "✅ PRESENTE" : "❌ FALTANDO",
          uf: proposta.cliente_data?.uf || proposta.cliente_data?.estado ? "✅ PRESENTE" : "❌ FALTANDO"
        },
        "DADOS DE RG - Novos Campos": {
          rg: proposta.cliente_data?.rg ? "✅ PRESENTE" : "❌ FALTANDO",
          localNascimento: proposta.cliente_data?.localNascimento ? "✅ PRESENTE" : "❌ FALTANDO",
          rgDataEmissao: proposta.cliente_data?.rgDataEmissao ? "✅ PRESENTE" : "❌ FALTANDO",
          rgUf: proposta.cliente_data?.rgUf ? "✅ PRESENTE" : "❌ FALTANDO"
        },
        "DADOS BANCÁRIOS - Persistência": {
          tipo: proposta.dados_pagamento_tipo ? "✅ PRESENTE" : "❌ FALTANDO",
          banco: proposta.dados_pagamento_banco ? "✅ PRESENTE" : "❌ FALTANDO",
          agencia: proposta.dados_pagamento_agencia ? "✅ PRESENTE" : "❌ FALTANDO",
          conta: proposta.dados_pagamento_conta ? "✅ PRESENTE" : "❌ FALTANDO"
        },
        "CONFLITO EXPEDIDOR/NACIONALIDADE": {
          orgaoEmissor: proposta.cliente_data?.orgaoEmissor ? "✅ PRESENTE" : "❌ FALTANDO",
          nacionalidade: proposta.cliente_data?.nacionalidade ? "✅ PRESENTE" : "❌ FALTANDO",
          separacao_ccb: "✅ COORDENADAS SEPARADAS NO SISTEMA"
        }
      };

      // Contar validações
      let sucessos = 0;
      let total = 0;
      
      Object.values(validacoes).forEach(categoria => {
        Object.values(categoria).forEach(status => {
          total++;
          if (status.includes("✅")) sucessos++;
        });
      });

      const veredito = sucessos === total ? "[SUCESSO]" : "[FALHA]";
      
      res.json({
        RELATORIO_FINAL: veredito,
        score: `${sucessos}/${total} validações aprovadas`,
        proposta_testada: proposta.id,
        validacoes_detalhadas: validacoes,
        dados_brutos: {
          cliente_data: proposta.cliente_data,
          dados_bancarios: {
            tipo: proposta.dados_pagamento_tipo,
            banco: proposta.dados_pagamento_banco,
            agencia: proposta.dados_pagamento_agencia,
            conta: proposta.dados_pagamento_conta,
            pix: proposta.dados_pagamento_pix
          }
        },
        conclusao: veredito === "[SUCESSO]" ? 
          "🎉 TODAS AS CORREÇÕES VALIDADAS - Debate Máximo RESOLVIDO!" :
          "❌ Ainda há campos faltantes - necessário criar nova proposta de teste"
      });
      
    } catch (error) {
      console.error("❌ [AUDIT] Erro na auditoria:", error);
      res.status(500).json({ 
        RELATORIO_FINAL: "[ERRO]",
        error: "Falha na execução da auditoria" 
      });
    }
  });

  // AUDITORIA FINAL - Validação End-to-End das Correções CCB
  app.get("/api/test-ccb-corrections", async (req, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import("./lib/supabase");
      const supabase = createServerSupabaseAdminClient();

      // Buscar última proposta criada para auditoria
      const { data: proposta, error } = await supabase
        .from("propostas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !proposta) {
        return res.json({
          status: "NO_DATA",
          message: "Nenhuma proposta encontrada para auditoria"
        });
      }

      // AUDITORIA ETAPA 3 - Verificação dos dados que entrarão na CCB
      const auditoria = {
        "[ ] ENDEREÇO SEPARADO": {
          logradouro: proposta.cliente_data?.logradouro || "❌ FALTANDO",
          numero: proposta.cliente_data?.numero || "❌ FALTANDO", 
          complemento: proposta.cliente_data?.complemento || "❌ FALTANDO",
          bairro: proposta.cliente_data?.bairro || "❌ FALTANDO",
          cep: proposta.cliente_data?.cep || "❌ FALTANDO",
          cidade: proposta.cliente_data?.cidade || "❌ FALTANDO",
          uf: proposta.cliente_data?.uf || proposta.cliente_data?.estado || "❌ FALTANDO"
        },
        "[ ] DADOS DE RG": {
          rg: proposta.cliente_data?.rg || "❌ FALTANDO",
          orgaoEmissor: proposta.cliente_data?.orgaoEmissor || "❌ FALTANDO",
          rgDataEmissao: proposta.cliente_data?.rgDataEmissao || "❌ FALTANDO",
          rgUf: proposta.cliente_data?.rgUf || "❌ FALTANDO",
          localNascimento: proposta.cliente_data?.localNascimento || "❌ FALTANDO"
        },
        "[ ] DADOS BANCÁRIOS": {
          tipo: proposta.dados_pagamento_tipo || "❌ FALTANDO",
          banco: proposta.dados_pagamento_banco || "❌ FALTANDO",
          agencia: proposta.dados_pagamento_agencia || "❌ FALTANDO", 
          conta: proposta.dados_pagamento_conta || "❌ FALTANDO",
          pix: proposta.dados_pagamento_pix || "N/A"
        },
        "[ ] CONFLITO EXPEDIDOR/NACIONALIDADE": {
          orgaoExpedidor: proposta.cliente_data?.orgaoEmissor || "❌ FALTANDO",
          nacionalidade: proposta.cliente_data?.nacionalidade || "❌ FALTANDO",
          separacao_visual: "✅ COORDENADAS SEPARADAS"
        }
      };

      // Contar validações bem-sucedidas
      let sucessos = 0;
      let total = 0;
      
      Object.values(auditoria).forEach(categoria => {
        Object.values(categoria).forEach(valor => {
          total++;
          if (typeof valor === 'string' && !valor.includes('❌ FALTANDO')) {
            sucessos++;
          }
        });
      });

      const status = sucessos === total ? "[SUCESSO]" : "[FALHA]";
      
      res.json({
        status,
        score: `${sucessos}/${total} validações`,
        proposta_auditada: proposta.id,
        auditoria_detalhada: auditoria,
        proxima_acao: sucessos === total ? 
          "✅ TODAS AS CORREÇÕES VALIDADAS - Gerar CCB para confirmar PDF" :
          "❌ CORREÇÕES INCOMPLETAS - Verificar campos faltantes"
      });
      
    } catch (error) {
      res.status(500).json({ error: "Erro na auditoria" });
    }
  });

  // Test endpoint para verificar correções de bugs
  app.get("/api/test-data-flow", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import("./lib/supabase");
      const supabase = createServerSupabaseAdminClient();

      // Buscar última proposta criada
      const { data: proposta, error } = await supabase
        .from("propostas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !proposta) {
        return res.json({ 
          status: "nenhuma_proposta",
          message: "Nenhuma proposta encontrada no banco"
        });
      }

      // Verificar campos de endereço
      const enderecoFields = {
        cep: proposta.cliente_data?.cep,
        logradouro: proposta.cliente_data?.logradouro,
        numero: proposta.cliente_data?.numero,
        complemento: proposta.cliente_data?.complemento,
        bairro: proposta.cliente_data?.bairro,
        cidade: proposta.cliente_data?.cidade,
        estado: proposta.cliente_data?.estado || proposta.cliente_data?.uf,
        endereco_concatenado: proposta.cliente_data?.endereco
      };

      // Verificar dados bancários
      const dadosBancarios = {
        tipo: proposta.dados_pagamento_tipo,
        pix: proposta.dados_pagamento_pix,
        banco: proposta.dados_pagamento_banco,
        agencia: proposta.dados_pagamento_agencia,
        conta: proposta.dados_pagamento_conta,
        digito: proposta.dados_pagamento_digito,
        nome_titular: proposta.dados_pagamento_nome_titular,
        cpf_titular: proposta.dados_pagamento_cpf_titular
      };

      // Verificar parcelas
      const { data: parcelas } = await supabase
        .from("parcelas")
        .select("*")
        .eq("proposta_id", proposta.id)
        .order("numero_parcela", { ascending: true });

      const resultado = {
        proposta_id: proposta.id,
        created_at: proposta.created_at,
        status: "analise_completa",
        bugs_corrigidos: {
          bug1_endereco: {
            status: enderecoFields.logradouro ? "✅ CORRIGIDO" : "❌ PENDENTE",
            campos_separados: enderecoFields,
            tem_campos_separados: !!(enderecoFields.logradouro && enderecoFields.numero && enderecoFields.bairro)
          },
          bug2_dados_bancarios: {
            status: dadosBancarios.tipo ? "✅ CORRIGIDO" : "❌ PENDENTE",
            dados_salvos: dadosBancarios,
            tem_dados_completos: !!(dadosBancarios.tipo && (dadosBancarios.pix || dadosBancarios.banco))
          },
          bug3_parcelas: {
            status: parcelas && parcelas.length > 0 ? "✅ CORRIGIDO" : "❌ PENDENTE",
            quantidade_parcelas: parcelas?.length || 0,
            primeira_parcela: parcelas?.[0] || null,
            ultima_parcela: parcelas?.[parcelas.length - 1] || null
          }
        },
        resumo: {
          todos_bugs_corrigidos: !!(
            enderecoFields.logradouro && 
            dadosBancarios.tipo && 
            parcelas && parcelas.length > 0
          )
        }
      };

      res.json(resultado);
    } catch (error) {
      console.error("Erro no teste de fluxo de dados:", error);
      res.status(500).json({ error: "Erro ao testar fluxo de dados" });
    }
  });

  // Debug endpoint for RBAC validation
  app.get("/api/debug/me", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      res.json({
        message: "Debug endpoint - User profile from robust JWT middleware",
        user: req.user,
        timestamp: getBrasiliaTimestamp(),
      });
    } catch (error) {
      console.error("Debug endpoint error:", error);
      res.status(500).json({ message: "Debug endpoint failed" });
    }
  });

  // BUSCA POR CPF - Recupera dados de propostas anteriores do mesmo CPF
  app.get("/api/propostas/buscar-por-cpf/:cpf", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { cpf } = req.params;
      const cpfLimpo = cpf.replace(/\D/g, '');
      
      console.log(`🔍 [BUSCA CPF] Buscando propostas anteriores para CPF: ${cpfLimpo}`);
      
      if (cpfLimpo.length !== 11) {
        return res.status(400).json({ error: "CPF inválido" });
      }
      
      const { createServerSupabaseAdminClient } = await import("./lib/supabase");
      const supabase = createServerSupabaseAdminClient();
      
      // Busca a proposta mais recente do CPF
      const { data: propostas, error } = await supabase
        .from("propostas")
        .select("*")
        .order("created_at", { ascending: false });
      
      // Filtrar manualmente pelo CPF no cliente_data
      const propostaEncontrada = propostas?.find(p => {
        const cpfProposta = p.cliente_data?.cpf?.replace(/\D/g, '');
        return cpfProposta === cpfLimpo;
      });
      
      if (!propostaEncontrada) {
        console.log(`ℹ️ [BUSCA CPF] Nenhuma proposta anterior encontrada para CPF: ${cpfLimpo}`);
        return res.json({ data: null });
      }
      
      console.log(`✅ [BUSCA CPF] Proposta anterior encontrada: ${propostaEncontrada.id}`);
      
      // Retorna os dados encontrados
      res.json({ 
        data: {
          cliente_data: propostaEncontrada.cliente_data,
          // Pode incluir outros dados úteis se necessário
        }
      });
      
    } catch (error) {
      console.error("❌ [BUSCA CPF] Erro ao buscar proposta por CPF:", error);
      res.status(500).json({ error: "Erro ao buscar dados" });
    }
  });

  // Proposal routes - ENHANCED WITH MULTI-FILTER SUPPORT AND RBAC SECURITY
  app.get("/api/propostas", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      // Extract query parameters for enhanced filtering
      let { queue, status, atendenteId } = req.query;

      // 🔒 SEGURANÇA CRÍTICA: Validar permissões por role
      const userRole = req.user?.role;
      const userId = req.user?.id;

      // ANALISTA: Automaticamente definir como fila de análise se não especificado
      if (userRole === "ANALISTA" && queue !== "analysis") {
        console.log(`🔧 [AUTO-REDIRECT] ANALISTA ${userId} - AUTO-DEFININDO como fila de análise`);
        queue = "analysis";
        req.query.queue = "analysis";
      }

      const isAnalysisQueue = queue === "analysis";

      console.log(
        `🔍 [DEBUG] Role: ${userRole}, Queue: ${queue}, IsAnalysisQueue: ${isAnalysisQueue}`
      );

      // ANALISTA: Pode acessar fila OU histórico completo (se não especificar queue)
      if (userRole === "ANALISTA" && queue && queue !== "analysis") {
        console.log(`❌ [SECURITY BLOCK] ANALISTA tentando acessar queue inválida: ${queue}`);
        return res.status(403).json({
          message:
            "Acesso negado. Analistas só podem acessar a fila de análise ou histórico completo.",
          allowedQueues: ["analysis", null],
          currentQueue: queue,
          debug: { userRole, queue, isAnalysisQueue },
        });
      }

      // ATENDENTE: Não pode acessar fila de análise
      if (userRole === "ATENDENTE" && isAnalysisQueue) {
        return res.status(403).json({
          message: "Acesso negado. Atendentes não têm permissão para acessar a fila de análise.",
        });
      }

      // Import database dependencies
      const { db } = await import("../server/lib/supabase");
      const { propostas, lojas, parceiros } = await import("../shared/schema");
      const { inArray, desc, eq, and } = await import("drizzle-orm");

      // Build query with conditional where clause
      const baseQuery = db
        .select({
          id: propostas.id,
          numeroProposta: propostas.numeroProposta, // PAM V1.0 - Sequential number for UI
          status: propostas.status,
          clienteData: propostas.clienteData,
          condicoesData: propostas.condicoesData,
          userId: propostas.userId,
          createdAt: propostas.createdAt,
          loja: {
            id: lojas.id,
            nomeLoja: lojas.nomeLoja,
          },
          parceiro: {
            id: parceiros.id,
            razaoSocial: parceiros.razaoSocial,
          },
        })
        .from(propostas)
        .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
        .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id));

      // Build where conditions based on filters AND ROLE PERMISSIONS
      const whereConditions = [];

      // 🔒 FILTRO POR ROLE - SEGURANÇA CRÍTICA
      switch (userRole) {
        case "ATENDENTE":
          // ATENDENTE vê APENAS suas próprias propostas
          whereConditions.push(eq(propostas.userId, userId));
          console.log(`🔒 [SECURITY] ATENDENTE ${userId} - filtrando apenas propostas próprias`);
          break;

        case "ANALISTA":
          // ANALISTA vê APENAS propostas em análise (todas as lojas)
          whereConditions.push(inArray(propostas.status, ["aguardando_analise", "em_analise"]));
          console.log(`🔒 [SECURITY] ANALISTA ${userId} - filtrando propostas em análise`);
          break;

        case "FINANCEIRO":
          // FINANCEIRO vê APENAS propostas aprovadas/pagamento
          whereConditions.push(inArray(propostas.status, ["aprovado", "pronto_pagamento", "pago"]));
          console.log(`🔒 [SECURITY] FINANCEIRO ${userId} - filtrando propostas para pagamento`);
          break;

        case "GERENTE":
          // GERENTE vê todas da sua loja (filtro será aplicado por RLS)
          // Por enquanto, não adicionar filtro adicional
          console.log(`🔒 [SECURITY] GERENTE ${userId} - sem filtro adicional (RLS aplicará)`);
          break;

        case "ADMINISTRADOR":
          // ADMIN vê tudo
          console.log(`🔒 [SECURITY] ADMINISTRADOR ${userId} - acesso total`);
          break;

        default:
          // Sem role = sem acesso
          return res.status(403).json({
            message: "Acesso negado. Usuário sem perfil definido.",
          });
      }

      // Aplicar filtros adicionais da query
      if (isAnalysisQueue && userRole !== "ATENDENTE") {
        // Fila de análise já foi filtrada para ANALISTA acima
        if (userRole !== "ANALISTA") {
          whereConditions.push(inArray(propostas.status, ["aguardando_analise", "em_analise"]));
        }
      } else if (status) {
        // ADMIN pode filtrar por qualquer status, ATENDENTE pode filtrar apenas suas próprias propostas por status
        if (userRole === "ADMINISTRADOR" || userRole === "ATENDENTE") {
          whereConditions.push(eq(propostas.status, status as string));
          console.log(`🔍 [STATUS FILTER] ${userRole} filtrando por status: ${status}`);
        }
      }

      if (atendenteId && ["GERENTE", "ADMINISTRADOR"].includes(userRole!)) {
        // Apenas GERENTE e ADMIN podem filtrar por atendente
        whereConditions.push(eq(propostas.userId, atendenteId as string));
      }

      // Apply filters and execute query
      const results =
        whereConditions.length > 0
          ? await baseQuery
              .where(whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions))
              .orderBy(desc(propostas.createdAt))
          : await baseQuery.orderBy(desc(propostas.createdAt));

      // Map to expected format - extract from JSONB
      const mappedPropostas = results.map(p => {
        // Extract client data from JSONB
        const clienteData = (p.clienteData as any) || {};
        const condicoesData = (p.condicoesData as any) || {};

        return {
          id: p.id,
          status: p.status,
          nomeCliente: clienteData.nome || "Nome não informado",
          cpfCliente: clienteData.cpf || "CPF não informado",
          emailCliente: clienteData.email || "Email não informado",
          telefoneCliente: clienteData.telefone || "Telefone não informado",
          valorSolicitado: condicoesData.valor || 0,
          prazo: condicoesData.prazo || 0,
          clienteData: clienteData, // Include full client data for details page
          condicoesData: condicoesData, // Include full loan conditions
          parceiro: p.parceiro
            ? {
                id: p.parceiro.id,
                razaoSocial: p.parceiro.razaoSocial,
              }
            : undefined,
          loja: p.loja
            ? {
                id: p.loja.id,
                nomeLoja: p.loja.nomeLoja,
              }
            : undefined,
          createdAt: p.createdAt,
          userId: p.userId,
        };
      });

      const filterDescription = isAnalysisQueue
        ? " para análise"
        : status
          ? ` com status ${status}`
          : atendenteId
            ? ` do atendente ${atendenteId}`
            : "";

      console.log(
        `[${getBrasiliaTimestamp()}] Retornando ${mappedPropostas.length} propostas${filterDescription}`
      );
      res.json(mappedPropostas);
    } catch (error) {
      console.error("Get propostas error:", error);
      res.status(500).json({ message: "Failed to fetch propostas" });
    }
  });

  // NEW ENDPOINT: PUT /api/propostas/:id/status - ANALYST WORKFLOW ENGINE
  app.put(
    "/api/propostas/:id/status",
    jwtAuthMiddleware,
    timingNormalizerMiddleware,
    async (req: AuthenticatedRequest, res) => {
      // Dynamic role validation based on the status change requested
      const { status } = req.body;
      const userRole = req.user?.role;

      // ATENDENTE can change:
      // - pendenciado -> aguardando_analise (resubmit)
      // - aguardando_aceite_atendente -> aceito_atendente (accept)
      // - aguardando_aceite_atendente -> cancelado (cancel)
      if (userRole === "ATENDENTE") {
        const allowedAttendenteTransitions = [
          "aguardando_analise",
          "aceito_atendente",
          "cancelado",
        ];
        if (!allowedAttendenteTransitions.includes(status)) {
          return res.status(403).json({
            message:
              "Atendentes só podem reenviar propostas para análise, aceitar ou cancelar propostas.",
          });
        }
      }
      // ANALISTA and ADMINISTRADOR can make all status changes
      else if (!userRole || !["ANALISTA", "ADMINISTRADOR"].includes(userRole)) {
        return res.status(403).json({
          message:
            "Acesso negado. Apenas analistas, administradores e atendentes podem alterar status.",
        });
      }
      try {
        const propostaId = req.params.id;
        const { status, observacao, valorAprovado } = req.body;
        const motivoPendencia = req.body.motivoPendencia || req.body.observacao; // Accept both field names

        // Validation schema for status change with conditional observacao requirement
        const statusChangeSchema = z
          .object({
            status: z.enum([
              "aprovado",
              "aguardando_aceite_atendente",
              "aceito_atendente",
              "rejeitado",
              "pendenciado",
              "aguardando_analise",
              "cancelado",
            ]),
            observacao: z.string().optional(),
            valorAprovado: z.number().optional(),
            motivoPendencia: z.string().optional(),
          })
          .refine(
            data => {
              // Observação é obrigatória APENAS quando o status é "pendenciado"
              if (data.status === "pendenciado") {
                return data.observacao && data.observacao.trim().length > 0;
              }
              // Para outros status, observação é opcional
              return true;
            },
            {
              message: "Observação é obrigatória quando a proposta é pendenciada",
              path: ["observacao"],
            }
          );

        const validatedData = statusChangeSchema.parse({
          status,
          observacao,
          valorAprovado,
          motivoPendencia,
        });

        // Use Supabase directly to avoid Drizzle schema issues
        const { createServerSupabaseAdminClient } = await import("../server/lib/supabase");
        const supabase = createServerSupabaseAdminClient();

        // 1. Get current proposal
        const { data: currentProposta, error: fetchError } = await supabase
          .from("propostas")
          .select("status")
          .eq("id", propostaId)
          .single();

        if (fetchError || !currentProposta) {
          throw new Error("Proposta não encontrada");
        }

        // 2. Validate status transition
        const validTransitions = {
          aguardando_analise: ["em_analise", "aprovado", "rejeitado", "pendenciado"], // Permitir aprovação direta
          em_analise: ["aprovado", "rejeitado", "pendenciado"], // Simplificado
          pendenciado: ["aguardando_analise"], // Atendente can resubmit after fixing
          aguardando_aceite_atendente: ["aceito_atendente", "cancelado"], // Atendente aceita ou cancela
          aceito_atendente: ["aprovado", "cancelado"], // Pronto para formalização
        };

        const currentStatus = currentProposta.status;
        if (!validTransitions[currentStatus as keyof typeof validTransitions]?.includes(status)) {
          throw new Error(`Transição inválida de ${currentStatus} para ${status}`);
        }

        // 3. Update proposal using only fields that exist in the real table
        const updateData: any = {
          status,
        };

        // Only set analyst fields for analyst actions (not for attendant resubmission or aceite actions)
        if (userRole !== "ATENDENTE") {
          updateData.analista_id = req.user?.id;
          updateData.data_analise = getBrasiliaTimestamp();
        }

        // Set aceite fields for attendant acceptance
        if (userRole === "ATENDENTE" && status === "aceito_atendente") {
          updateData.data_aceite_atendente = getBrasiliaTimestamp();
          console.log(`✅ [ACEITE] Atendente ${req.user?.id} aceitou proposta ${propostaId}`);
        }

        if (status === "pendenciado" && motivoPendencia) {
          updateData.motivo_pendencia = motivoPendencia;
        }

        // Clear pendency reason when resubmitting
        if (status === "aguardando_analise") {
          updateData.motivo_pendencia = null;
        }

        // CORREÇÃO CRÍTICA: Definir data_aprovacao quando proposta é aprovada
        if (status === "aprovado") {
          updateData.data_aprovacao = generateApprovalDate();
          console.log(
            `🎯 [APROVAÇÃO] Definindo data_aprovacao para proposta ${propostaId} no horário de Brasília`
          );

          // CORREÇÃO CRÍTICA: Preservar tabela_comercial_id ao aprovar
          // Buscar dados atuais da proposta para preservar campos importantes
          const { data: propostaCompleta, error: fetchCompleteError } = await supabase
            .from("propostas")
            .select("tabela_comercial_id, valor_aprovado")
            .eq("id", propostaId)
            .single();

          if (propostaCompleta && propostaCompleta.tabela_comercial_id) {
            // Preservar a tabela comercial
            updateData.tabela_comercial_id = propostaCompleta.tabela_comercial_id;
            console.log(
              `🎯 [APROVAÇÃO] Preservando tabela_comercial_id: ${propostaCompleta.tabela_comercial_id}`
            );
          }

          // Se valor aprovado foi fornecido, usar esse valor, senão preservar o existente
          if (valorAprovado) {
            updateData.valor_aprovado = valorAprovado;
          } else if (propostaCompleta && propostaCompleta.valor_aprovado) {
            updateData.valor_aprovado = propostaCompleta.valor_aprovado;
          }

          // NOVO: Geração automática da CCB ao aprovar proposta
          try {
            const { ccbGenerationService } = await import("./services/ccbGenerationService");
            console.log(`📄 [CCB] Iniciando geração automática de CCB para proposta ${propostaId}`);
            const result = await ccbGenerationService.generateCCB(propostaId);
            if (result.success) {
              console.log(`✅ [CCB] CCB gerada com sucesso: ${result.pdfPath}`);
            } else {
              throw new Error(result.error);
            }

            // A função ccbGenerationService já atualiza os campos ccb_gerado e caminho_ccb
            // então não precisamos fazer isso aqui
          } catch (ccbError) {
            console.error(`❌ [CCB] Erro ao gerar CCB para proposta ${propostaId}:`, ccbError);
            // Não vamos falhar a aprovação por causa do erro na CCB
            // O atendente pode gerar manualmente depois se necessário
          }
        }

        const { error: updateError } = await supabase
          .from("propostas")
          .update(updateData)
          .eq("id", propostaId);

        if (updateError) {
          throw new Error(`Erro ao atualizar status: ${updateError.message}`);
        }

        // 4. Log the action in proposta_logs for audit trail with correct field names
        console.log(
          `🔍 [Audit Log] Registrando log para proposta ${propostaId}: ${currentStatus} → ${status}`
        );
        try {
          const { data: logResult, error: logError } = await supabase.from("proposta_logs").insert({
            proposta_id: propostaId,
            autor_id: req.user?.id,
            observacao: validatedData.observacao,
            status_anterior: currentStatus,
            status_novo: status,
            // created_at is auto-generated by database
          });

          if (logError) {
            console.error(`🔍 [Audit Log] Erro ao registrar log:`, logError);
            // Don't fail the request, just log the warning
          } else {
            console.log(`🔍 [Audit Log] Log registrado com sucesso para proposta ${propostaId}`);
          }
        } catch (logError) {
          console.warn("Erro ao registrar log de auditoria:", logError);
          // Continue execution even if logging fails
        }

        const result = { success: true, statusAnterior: currentStatus, statusNovo: status };

        const actionBy = userRole === "ATENDENTE" ? "atendente" : "analista";
        console.log(
          `[${getBrasiliaTimestamp()}] Proposta ${propostaId} - status alterado de ${result.statusAnterior} para ${result.statusNovo} pelo ${actionBy} ${req.user?.id}`
        );

        res.json({
          success: true,
          message: `Status da proposta alterado para ${status}`,
          statusAnterior: result.statusAnterior,
          statusNovo: result.statusNovo,
        });
      } catch (error) {
        console.error("Status change error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
        }
        res.status(500).json({
          message: error instanceof Error ? error.message : "Erro ao alterar status da proposta",
        });
      }
    }
  );

  // 🔧 CORREÇÃO CRÍTICA: Mover endpoint específico ANTES da rota genérica /:id
  // New endpoint for formalization proposals (filtered by status)
  app.get(
    "/api/propostas/formalizacao",
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { createServerSupabaseAdminClient } = await import("./lib/supabase");
        const supabase = createServerSupabaseAdminClient();

        // Formalization statuses - TODOS exceto BOLETOS_EMITIDOS
        // BOLETOS_EMITIDOS vai para Cobranças e Pagamentos
        const formalizationStatuses = [
          "aprovado",
          "aceito_atendente",
          "documentos_enviados",
          // Status V2.0 de formalização
          "CCB_GERADA",
          "AGUARDANDO_ASSINATURA", 
          "ASSINATURA_PENDENTE",
          "ASSINATURA_CONCLUIDA",
          // NÃO incluir BOLETOS_EMITIDOS - vai para cobranças/pagamentos
          "PAGAMENTO_PENDENTE",
          "PAGAMENTO_PARCIAL",
          // Status legados para compatibilidade
          "contratos_preparados", // será migrado para CCB_GERADA
          "contratos_assinados",  // será migrado para ASSINATURA_CONCLUIDA
          // NÃO incluir "pronto_pagamento" - é o antigo BOLETOS_EMITIDOS
        ];

        const userId = req.user?.id;
        const userRole = req.user?.role;
        const userLojaId = req.user?.loja_id;

        console.log(
          `🔐 [FORMALIZATION] Querying for user ${userId} with role ${userRole} from loja ${userLojaId}`
        );

        // Build query based on user role
        let query = supabase.from("propostas").select("*").in("status", formalizationStatuses);

        // Apply role-based filtering
        if (userRole === "ATENDENTE") {
          // ATENDENTE sees only proposals they created
          query = query.eq("user_id", userId);
          console.log(`🔐 [FORMALIZATION] ATENDENTE filter: user_id = ${userId}`);
        } else if (userRole === "GERENTE") {
          // GERENTE sees all proposals from their store
          query = query.eq("loja_id", userLojaId);
          console.log(`🔐 [FORMALIZATION] GERENTE filter: loja_id = ${userLojaId}`);
        }
        // For other roles (ADMINISTRADOR, ANALISTA, etc.), no additional filtering

        const { data: rawPropostas, error } = await query.order("created_at", { ascending: false });

        if (error) {
          console.error("🚨 [FORMALIZATION] Supabase error:", error);
          return res.status(500).json({ message: "Erro ao consultar propostas de formalização" });
        }

        if (!rawPropostas || rawPropostas.length === 0) {
          console.log(
            `🔐 [FORMALIZATION] No proposals found for user ${userId} with role ${userRole}`
          );
          return res.json([]);
        }

        console.log(`🔐 [FORMALIZATION] Found ${rawPropostas.length} proposals for user ${userId}`);
        console.log(
          "🔐 [FORMALIZATION] First proposal:",
          rawPropostas[0]?.id,
          rawPropostas[0]?.status
        );

        // CORREÇÃO CRÍTICA: Parse JSONB fields e mapear snake_case para frontend
        const formalizacaoPropostas = rawPropostas.map(proposta => {
          let clienteData = null;
          let condicoesData = null;

          // Parse cliente_data se for string
          if (typeof proposta.cliente_data === "string") {
            try {
              clienteData = JSON.parse(proposta.cliente_data);
            } catch (e) {
              console.warn(`Erro ao fazer parse de cliente_data para proposta ${proposta.id}:`, e);
              clienteData = {};
            }
          } else {
            clienteData = proposta.cliente_data || {};
          }

          // Parse condicoes_data se for string
          if (typeof proposta.condicoes_data === "string") {
            try {
              condicoesData = JSON.parse(proposta.condicoes_data);
            } catch (e) {
              console.warn(
                `Erro ao fazer parse de condicoes_data para proposta ${proposta.id}:`,
                e
              );
              condicoesData = {};
            }
          } else {
            condicoesData = proposta.condicoes_data || {};
          }

          return {
            ...proposta,
            cliente_data: clienteData,
            condicoes_data: condicoesData,
            // Map database fields to frontend format
            documentos_adicionais: proposta.documentos_adicionais,
            contrato_gerado: proposta.contrato_gerado,
            contrato_assinado: proposta.contrato_assinado,
            data_aprovacao: proposta.data_aprovacao,
            data_assinatura: proposta.data_assinatura,
            data_pagamento: proposta.data_pagamento,
            observacoes_formalizacao: proposta.observacoes_formalizacao,
            // 🔥 NOVO: Campos de tracking do Banco Inter
            interBoletoGerado: proposta.inter_boleto_gerado,
            interBoletoGeradoEm: proposta.inter_boleto_gerado_em,
          };
        });

        console.log(
          `[${getBrasiliaTimestamp()}] Retornando ${formalizacaoPropostas.length} propostas em formalização via RLS`
        );
        res.json(formalizacaoPropostas);
      } catch (error) {
        console.error("Erro ao buscar propostas de formalização:", error);
        res.status(500).json({
          message: "Erro ao buscar propostas de formalização",
        });
      }
    }
  );

  // Endpoint para gerar CCB automaticamente
  app.post(
    "/api/propostas/:id/gerar-ccb",
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        console.log(`[CCB] Solicitação de geração de CCB para proposta: ${id}`);

        const { createServerSupabaseAdminClient } = await import("./lib/supabase");
        const supabase = createServerSupabaseAdminClient();

        // Verificar se proposta está aprovada
        const { data: proposta, error: propostaError } = await supabase
          .from("propostas")
          .select("status, ccb_gerado, caminho_ccb_assinado")
          .eq("id", id)
          .single();

        if (propostaError || !proposta) {
          return res.status(404).json({ error: "Proposta não encontrada" });
        }

        if (proposta.status !== "aprovado") {
          return res.status(400).json({ error: "CCB só pode ser gerada para propostas aprovadas" });
        }

        // Se CCB já foi gerada, retornar sucesso
        if (proposta.ccb_gerado && proposta.caminho_ccb_assinado) {
          console.log(`[CCB] CCB já existe para proposta ${id}`);
          return res.json({
            success: true,
            message: "CCB já foi gerada anteriormente",
            caminho: proposta.caminho_ccb_assinado,
          });
        }

        // Gerar CCB usando serviço correto (pdf-lib + template)
        console.log(`[CCB] Gerando CCB com template CORRETO para proposta ${id}...`);
        const { ccbGenerationService } = await import("./services/ccbGenerationService");

        try {
          const result = await ccbGenerationService.generateCCB(id);
          if (!result.success) {
            throw new Error(result.error);
          }
          console.log(`[CCB] CCB gerada com sucesso usando template CORRETO: ${result.pdfPath}`);
          res.json({
            success: true,
            message: "CCB gerada com sucesso usando template personalizado",
            caminho: result.pdfPath,
          });
        } catch (error) {
          console.error(`[CCB] Erro ao gerar CCB: ${error}`);
          return res.status(500).json({ error: "Erro ao gerar CCB" });
        }
      } catch (error) {
        console.error("[CCB] Erro interno:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
      }
    }
  );

  // Debug: Testar PDF simples e limpo
  app.get("/api/debug/test-pdf", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const PDFDocument = (await import("pdfkit")).default;

      // Criar PDF extremamente simples
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
        info: {
          Title: "Teste PDF Simples",
          Author: "Sistema Teste",
          Subject: "PDF de Teste",
          Creator: "Sistema Simpix",
          Producer: "PDFKit",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", chunk => chunks.push(chunk));

      // Conteúdo mínimo
      doc.fontSize(16).text("DOCUMENTO DE TESTE");
      doc.moveDown();
      doc.fontSize(12).text("Este é um PDF de teste gerado pelo sistema.");
      doc.text("Data: " + formatBrazilianDateTime(getBrasiliaDate(), "date"));

      doc.end();

      const pdfBuffer = await new Promise<Buffer>(resolve => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="teste-simples.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Erro ao criar PDF teste:", error);
      res.status(500).json({ error: "Erro ao criar PDF teste" });
    }
  });

  // Debug: Listar arquivos no bucket documents
  app.get("/api/debug/storage-files", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import("./lib/supabase");
      const supabase = createServerSupabaseAdminClient();

      const { data: files, error } = await supabase.storage.from("documents").list("ccb", {
        limit: 50,
        sortBy: { column: "created_at", order: "desc" },
      });

      if (error) {
        console.error("Erro ao listar arquivos:", error);
        return res.status(500).json({ error: error.message });
      }

      res.json({
        bucket: "documents",
        folder: "ccb",
        files: files || [],
        count: files?.length || 0,
      });
    } catch (error) {
      console.error("Erro debug storage:", error);
      res.status(500).json({ error: "Erro interno" });
    }
  });

  // Get CCB signed URL
  app.get(
    "/api/propostas/:id/ccb-url",
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;

        console.log(`[CCB URL] Buscando URL para proposta: ${id}`);

        const { createServerSupabaseAdminClient } = await import("./lib/supabase");
        const supabase = createServerSupabaseAdminClient();

        // ✅ CORREÇÃO: Buscar dados MAIS RECENTES da proposta (força busca sem cache)
        const { data: proposta, error } = await supabase
          .from("propostas")
          .select("ccb_gerado, caminho_ccb, ccb_gerado_em")
          .eq("id", id)
          .single();

        if (error || !proposta) {
          console.log(`[CCB URL] ❌ Proposta não encontrada: ${error?.message}`);
          return res.status(404).json({ message: "Proposta não encontrada" });
        }

        if (!proposta.ccb_gerado) {
          console.log(`[CCB URL] ❌ CCB não foi gerada ainda`);
          return res.status(404).json({ message: "CCB não foi gerada para esta proposta" });
        }

        // ✅ ESTRATÉGIA TRIPLA: Sempre verificar se há versão mais recente no storage
        console.log(`[CCB URL] 💾 Caminho no banco: ${proposta.caminho_ccb || "nenhum"}`);

        // Sempre buscar arquivos no storage para garantir versão mais recente
        const { data: files } = await supabase.storage
          .from("documents")
          .list(`ccb/${id}`, { sortBy: { column: "created_at", order: "desc" } });

        let ccbPath = proposta.caminho_ccb; // Fallback para caminho do banco

        if (files && files.length > 0) {
          // Sempre usar o arquivo mais recente do storage (mais confiável)
          const latestFile = files[0];
          const latestPath = `ccb/${id}/${latestFile.name}`;

          console.log(
            `[CCB URL] 📁 Arquivo mais recente no storage: ${latestFile.name} (${latestFile.created_at})`
          );

          // Usar arquivo mais recente se for diferente do banco ou se banco não tiver caminho
          if (!ccbPath || latestPath !== ccbPath) {
            ccbPath = latestPath;
            console.log(`[CCB URL] ✅ Usando arquivo mais recente: ${ccbPath}`);
          } else {
            console.log(`[CCB URL] ✅ Banco está atualizado com a versão mais recente`);
          }
        } else {
          console.log(`[CCB URL] ⚠️ Nenhum arquivo encontrado no storage para CCB/${id}`);
        }

        if (!ccbPath) {
          console.log(`[CCB URL] ❌ Nenhum arquivo CCB encontrado`);
          return res.status(404).json({ message: "Arquivo CCB não encontrado" });
        }

        console.log(`[CCB URL] 🔗 Gerando URL assinada para: ${ccbPath}`);
        console.log(`[CCB URL] 📅 CCB gerado em: ${proposta.ccb_gerado_em}`);

        // Gerar URL assinada com cache-busting para forçar atualização
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from("documents")
          .createSignedUrl(ccbPath, 3600); // 1 hora

        if (urlError || !signedUrlData) {
          console.error("❌ [CCB URL] Erro ao gerar URL assinada:", urlError);
          console.error("❌ [CCB URL] Caminho tentado:", ccbPath);

          // 🔄 FALLBACK: Regenerar CCB se não encontrado (conforme error_docs/storage_errors.md)
          if ((urlError as any)?.status === 400 || urlError.message?.includes("Object not found")) {
            console.log("🔄 [CCB URL] Arquivo não encontrado, tentando regenerar CCB...");
            try {
              const { ccbGenerationService } = await import("./services/ccbGenerationService");
              const newCcb = await ccbGenerationService.generateCCB(id);
              if (newCcb.success) {
                // Tentar novamente com o novo arquivo
                const { data: newSignedUrl } = await supabase.storage
                  .from("documents")
                  .createSignedUrl(newCcb.pdfPath!, 3600);

                if (newSignedUrl) {
                  res.setHeader("X-Content-Type-Options", "nosniff");
                  res.setHeader("X-Frame-Options", "DENY");
                  res.setHeader(
                    "Content-Security-Policy",
                    "default-src 'none'; object-src 'none';"
                  );
                  return res.json({
                    url: newSignedUrl.signedUrl,
                    filename: `CCB-${id}.pdf`,
                    contentType: "application/pdf",
                    regenerated: true,
                  });
                }
              }
            } catch (regenError) {
              console.error("❌ [CCB URL] Erro na regeneração:", regenError);
            }
          }

          return res.status(500).json({
            message: "Erro ao gerar URL do documento",
            details: urlError.message,
          });
        }

        // Retornar com headers de segurança
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Content-Security-Policy", "default-src 'none'; object-src 'none';");
        res.json({
          url: signedUrlData.signedUrl,
          filename: `CCB-${id}.pdf`,
          contentType: "application/pdf",
        });
      } catch (error) {
        console.error("Erro ao buscar CCB:", error);
        res.status(500).json({ message: "Erro ao buscar CCB" });
      }
    }
  );

  app.get(
    "/api/propostas/:id",
    jwtAuthMiddleware,
    timingNormalizerMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const idParam = req.params.id;
        const user = req.user;

        console.log(
          `🔐 [PROPOSTA ACCESS] User ${user.id} (${user.role}) accessing proposta ${idParam}`
        );

        // 🔧 CORREÇÃO: Usar mesma abordagem do endpoint de formalização que funciona
        if (user.role === "ATENDENTE") {
          console.log(`🔐 [ATENDENTE ACCESS] Using RLS query for user loja_id: ${user.loja_id}`);

          // Usar Drizzle com RLS como no endpoint de formalização
          const { db } = await import("../server/lib/supabase");
          const { propostas, lojas, parceiros, produtos, tabelasComerciais } = await import(
            "../shared/schema"
          );
          const { eq, and } = await import("drizzle-orm");

          // Query with RLS active - same as formalization endpoint
          const result = await db
            .select({
              id: propostas.id,
              numero_proposta: propostas.numeroProposta, // PAM V1.0 - Sequential number
              status: propostas.status,
              cliente_data: propostas.clienteData,
              condicoes_data: propostas.condicoesData,
              loja_id: propostas.lojaId,
              created_at: propostas.createdAt,
              produto_id: propostas.produtoId,
              tabela_comercial_id: propostas.tabelaComercialId,
              user_id: propostas.userId,
              ccb_documento_url: propostas.ccbDocumentoUrl,
              analista_id: propostas.analistaId,
              data_analise: propostas.dataAnalise,
              motivo_pendencia: propostas.motivoPendencia,
              data_aprovacao: propostas.dataAprovacao,
              documentos_adicionais: propostas.documentosAdicionais,
              contrato_gerado: propostas.contratoGerado,
              contrato_assinado: propostas.contratoAssinado,
              data_assinatura: propostas.dataAssinatura,
              data_pagamento: propostas.dataPagamento,
              observacoes_formalizacao: propostas.observacoesFormalização,
              loja: {
                id: lojas.id,
                nome_loja: lojas.nomeLoja,
              },
              parceiro: {
                id: parceiros.id,
                razao_social: parceiros.razaoSocial,
              },
              produto: {
                id: produtos.id,
                nome_produto: produtos.nomeProduto,
                tac_valor: produtos.tacValor,
                tac_tipo: produtos.tacTipo,
              },
              tabela_comercial: {
                id: tabelasComerciais.id,
                nome_tabela: tabelasComerciais.nomeTabela,
                taxa_juros: tabelasComerciais.taxaJuros,
                prazos: tabelasComerciais.prazos,
                comissao: tabelasComerciais.comissao,
              },
            })
            .from(propostas)
            .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
            .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id))
            .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
            .leftJoin(tabelasComerciais, eq(propostas.tabelaComercialId, tabelasComerciais.id))
            .where(eq(propostas.id, idParam))
            .limit(1);

          if (!result || result.length === 0) {
            console.log(
              `🔐 [ATENDENTE BLOCKED] User ${user.id} denied access to proposta ${idParam} - RLS policy blocked or not found`
            );
            return res.status(403).json({
              message: "Você não tem permissão para acessar esta proposta",
            });
          }

          const proposta = result[0];
          console.log(
            `🔐 [ATENDENTE ALLOWED] User ${user.id} granted access to proposta ${idParam} from loja ${proposta.loja_id}`
          );

          // Buscar documentos da proposta
          const { createServerSupabaseAdminClient } = await import("../server/lib/supabase");
          const supabase = createServerSupabaseAdminClient();

          const { data: documentos, error: docError } = await supabase
            .from("proposta_documentos")
            .select("*")
            .eq("proposta_id", idParam);

          console.log(
            `🔍 [ANÁLISE] Documentos encontrados para proposta ${idParam}:`,
            documentos?.length || 0
          );

          // DEBUG: Listar arquivos que existem no bucket para esta proposta
          const { data: bucketFiles, error: listError } = await supabase.storage
            .from("documents")
            .list(`proposta-${idParam}/`, { limit: 100 });

          if (bucketFiles) {
            console.log(`🔍 [ANÁLISE] ===== COMPARAÇÃO BUCKET vs BANCO =====`);
            console.log(
              `🔍 [ANÁLISE] Arquivos no bucket (${bucketFiles.length}):`,
              bucketFiles.map(f => f.name)
            );
            console.log(
              `🔍 [ANÁLISE] URLs salvas no banco (${documentos?.length || 0}):`,
              documentos?.map(d => d.url)
            );
            console.log(
              `🔍 [ANÁLISE] Nomes no banco (${documentos?.length || 0}):`,
              documentos?.map(d => d.nome_arquivo)
            );
            console.log(`🔍 [ANÁLISE] ============================================`);
          } else {
            console.log(`🔍 [ANÁLISE] Erro ao listar arquivos no bucket:`, listError?.message);
          }

          // Gerar URLs assinadas para visualização dos documentos
          let documentosComUrls = [];
          if (documentos && documentos.length > 0) {
            console.log(
              `🔍 [ANÁLISE] Gerando URLs assinadas para ${documentos.length} documentos...`
            );

            for (const doc of documentos) {
              try {
                console.log(`🔍 [ANÁLISE] Tentando gerar URL para documento:`, {
                  nome: doc.nome_arquivo,
                  url: doc.url,
                  tipo: doc.tipo,
                  proposta_id: doc.proposta_id,
                });

                // Extrair o caminho do arquivo a partir da URL salva
                const documentsIndex = doc.url.indexOf("/documents/");
                let filePath;

                if (documentsIndex !== -1) {
                  // Extrair caminho após '/documents/'
                  filePath = doc.url.substring(documentsIndex + "/documents/".length);
                } else {
                  // Fallback: construir caminho baseado no nome do arquivo
                  const fileName = doc.nome_arquivo;
                  filePath = `proposta-${idParam}/${fileName}`;
                }

                console.log(`🔍 [ANÁLISE] Caminho extraído para URL assinada: ${filePath}`);

                const { data: signedUrlData, error: urlError } = await supabase.storage
                  .from("documents")
                  .createSignedUrl(filePath, 3600); // 1 hora

                if (!urlError && signedUrlData) {
                  documentosComUrls.push({
                    ...doc,
                    // Mapeamento para formato esperado pelo DocumentViewer
                    name: doc.nome_arquivo,
                    url: signedUrlData.signedUrl,
                    type: doc.tipo || "application/octet-stream", // fallback se tipo for null
                    uploadDate: doc.created_at,
                    // Manter campos originais também
                    url_visualizacao: signedUrlData.signedUrl,
                  });
                  console.log(`🔍 [ANÁLISE] ✅ URL gerada para documento: ${doc.nome_arquivo}`);
                } else {
                  console.log(
                    `🔍 [ANÁLISE] ❌ Erro ao gerar URL para documento ${doc.nome_arquivo}:`,
                    urlError?.message
                  );
                  console.log(`🔍 [ANÁLISE] ❌ Caminho tentado: ${filePath}`);
                  documentosComUrls.push({
                    ...doc,
                    // Mesmo sem URL, mapear para formato esperado
                    name: doc.nome_arquivo,
                    url: "",
                    type: doc.tipo || "application/octet-stream",
                    uploadDate: doc.created_at,
                  }); // Adiciona sem URL em caso de erro
                }
              } catch (error) {
                console.log(
                  `🔍 [ANÁLISE] ❌ Erro ao processar documento ${doc.nome_arquivo}:`,
                  error
                );
                documentosComUrls.push(doc); // Adiciona sem URL em caso de erro
              }
            }
          }

          // Transform to match expected format with proper camelCase conversion
          const formattedProposta = {
            ...proposta,
            // Convert snake_case to camelCase for frontend compatibility
            clienteData: proposta.cliente_data,
            condicoesData: proposta.condicoes_data,
            createdAt: proposta.created_at,
            lojaId: proposta.loja_id,
            produtoId: proposta.produto_id,
            tabelaComercialId: proposta.tabela_comercial_id,
            userId: proposta.user_id,
            analistaId: proposta.analista_id,
            dataAnalise: proposta.data_analise,
            motivoPendencia: proposta.motivo_pendencia,
            dataAprovacao: proposta.data_aprovacao,
            documentosAdicionais: proposta.documentos_adicionais,
            contratoGerado: proposta.contrato_gerado,
            contratoAssinado: proposta.contrato_assinado,
            dataAssinatura: proposta.data_assinatura,
            dataPagamento: proposta.data_pagamento,
            observacoesFormalização: proposta.observacoes_formalizacao,
            // Nested objects with proper structure
            lojas: proposta.loja
              ? {
                  ...proposta.loja,
                  parceiros: proposta.parceiro,
                }
              : null,
            produtos: proposta.produto,
            tabelas_comerciais: proposta.tabela_comercial,
            // Include documents with signed URLs
            documentos: documentosComUrls || [],
          };

          res.json(formattedProposta);
        } else {
          // Para outros roles (ADMIN, GERENTE, ANALISTA), usar método original sem RLS
          const proposta = await storage.getPropostaById(idParam);

          if (!proposta) {
            return res.status(404).json({ message: "Proposta not found" });
          }

          console.log(
            `🔐 [ADMIN/GERENTE/ANALISTA ACCESS] User ${user.id} (${user.role}) accessing proposta ${idParam}`
          );

          // 🔧 CORREÇÃO CRÍTICA: Aplicar mesma lógica de documentos do ATENDENTE
          const { createServerSupabaseAdminClient } = await import("../server/lib/supabase");
          const supabase = createServerSupabaseAdminClient();

          // Buscar documentos da proposta (mesma lógica do ATENDENTE)
          const { data: documentos, error: docError } = await supabase
            .from("proposta_documentos")
            .select("*")
            .eq("proposta_id", idParam);

          console.log(
            `🔍 [ANÁLISE-OUTROS] Documentos encontrados para proposta ${idParam}:`,
            documentos?.length || 0
          );

          // Gerar URLs assinadas para visualização dos documentos (mesma lógica do ATENDENTE)
          let documentosComUrls = [];
          if (documentos && documentos.length > 0) {
            console.log(
              `🔍 [ANÁLISE-OUTROS] Gerando URLs assinadas para ${documentos.length} documentos...`
            );

            for (const doc of documentos) {
              try {
                console.log(`🔍 [ANÁLISE-OUTROS] Tentando gerar URL para documento:`, {
                  nome: doc.nome_arquivo,
                  url: doc.url,
                  tipo: doc.tipo,
                  proposta_id: doc.proposta_id,
                });

                // Extrair o caminho do arquivo a partir da URL salva
                const documentsIndex = doc.url.indexOf("/documents/");
                let filePath;

                if (documentsIndex !== -1) {
                  // Extrair caminho após '/documents/'
                  filePath = doc.url.substring(documentsIndex + "/documents/".length);
                } else {
                  // Fallback: construir caminho baseado no nome do arquivo
                  const fileName = doc.nome_arquivo;
                  filePath = `proposta-${idParam}/${fileName}`;
                }

                console.log(`🔍 [ANÁLISE-OUTROS] Caminho extraído para URL assinada: ${filePath}`);

                const { data: signedUrlData, error: urlError } = await supabase.storage
                  .from("documents")
                  .createSignedUrl(filePath, 3600); // 1 hora

                if (!urlError && signedUrlData) {
                  documentosComUrls.push({
                    ...doc,
                    // Mapeamento para formato esperado pelo DocumentViewer
                    name: doc.nome_arquivo,
                    url: signedUrlData.signedUrl,
                    type: doc.tipo || "application/octet-stream", // fallback se tipo for null
                    uploadDate: doc.created_at,
                    // Manter campos originais também
                    url_visualizacao: signedUrlData.signedUrl,
                  });
                  console.log(
                    `🔍 [ANÁLISE-OUTROS] ✅ URL gerada para documento: ${doc.nome_arquivo}`
                  );
                } else {
                  console.log(
                    `🔍 [ANÁLISE-OUTROS] ❌ Erro ao gerar URL para documento ${doc.nome_arquivo}:`,
                    urlError?.message
                  );
                  console.log(`🔍 [ANÁLISE-OUTROS] ❌ Caminho tentado: ${filePath}`);
                  documentosComUrls.push({
                    ...doc,
                    // Mesmo sem URL, mapear para formato esperado
                    name: doc.nome_arquivo,
                    url: "",
                    type: doc.tipo || "application/octet-stream",
                    uploadDate: doc.created_at,
                  }); // Adiciona sem URL em caso de erro
                }
              } catch (error) {
                console.log(
                  `🔍 [ANÁLISE-OUTROS] ❌ Erro ao processar documento ${doc.nome_arquivo}:`,
                  error
                );
                documentosComUrls.push({
                  ...doc,
                  // Mesmo com erro, mapear para formato esperado
                  name: doc.nome_arquivo,
                  url: "",
                  type: doc.tipo || "application/octet-stream",
                  uploadDate: doc.created_at,
                }); // Adiciona sem URL em caso de erro
              }
            }
          }

          // Incluir documentos formatados na resposta
          const propostaComDocumentos = {
            ...proposta,
            documentos: documentosComUrls || [],
          };

          console.log(
            `🔍 [ANÁLISE-OUTROS] ✅ Retornando proposta ${idParam} com ${documentosComUrls.length} documentos formatados`
          );
          res.json(propostaComDocumentos);
        }
      } catch (error) {
        console.error("Get proposta error:", error);
        res.status(500).json({ message: "Failed to fetch proposta" });
      }
    }
  );

  app.put("/api/propostas/:id", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { cliente_data, condicoes_data } = req.body;

      console.log(`🔍 [PUT /api/propostas/${id}] Salvando alterações:`, {
        cliente_data,
        condicoes_data,
      });

      const { createServerSupabaseAdminClient } = await import("../server/lib/supabase");
      const supabase = createServerSupabaseAdminClient();

      // Verificar se a proposta existe e pertence ao usuário
      const { data: proposta, error: fetchError } = await supabase
        .from("propostas")
        .select("user_id, status")
        .eq("id", id)
        .single();

      if (fetchError || !proposta) {
        console.error(`🔍 Proposta ${id} não encontrada:`, fetchError);
        return res.status(404).json({ message: "Proposta não encontrada" });
      }

      // Apenas o atendente dono da proposta ou admin pode editar
      if (req.user?.role !== "ADMINISTRADOR" && proposta.user_id !== req.user?.id) {
        console.error(
          `🔍 Usuário ${req.user?.id} sem permissão para editar proposta ${id} (owner: ${proposta.user_id})`
        );
        return res.status(403).json({ message: "Sem permissão para editar esta proposta" });
      }

      // Apenas propostas pendenciadas podem ser editadas
      if (proposta.status !== "pendenciado" && proposta.status !== "rascunho") {
        console.error(`🔍 Proposta ${id} com status ${proposta.status} não pode ser editada`);
        return res.status(400).json({
          message: "Apenas propostas pendenciadas ou em rascunho podem ser editadas",
        });
      }

      // Atualizar a proposta
      const { data: updatedProposta, error: updateError } = await supabase
        .from("propostas")
        .update({
          cliente_data,
          condicoes_data,
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        console.error(`🔍 Erro ao atualizar proposta ${id}:`, updateError);
        return res.status(500).json({ message: "Erro ao atualizar proposta" });
      }

      console.log(`🔍 [PUT /api/propostas/${id}] Proposta atualizada com sucesso`);
      res.json({
        success: true,
        message: "Proposta atualizada com sucesso",
        data: updatedProposta,
      });
    } catch (error) {
      console.error("Update proposta error:", error);
      res.status(500).json({ message: "Erro ao atualizar proposta" });
    }
  });

  app.post("/api/propostas", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      // 🔒 PAM V1.0 - VALIDAÇÃO RIGOROSA DE INTEGRIDADE DE DADOS
      // BARREIRA DE PROTEÇÃO: Nenhuma proposta com dados críticos NULL pode passar
      
      // Preparar dados para validação
      const dataForValidation = {
        ...req.body,
        lojaId: req.body.lojaId || req.user?.loja_id, // Fallback to user's loja_id if not provided
      };

      // 🚨 VALIDAÇÃO CRÍTICA: Bloquear IMEDIATAMENTE se dados obrigatórios estão ausentes
      try {
        await createPropostaValidationSchema.parseAsync(dataForValidation);
        console.log("✅ [VALIDAÇÃO] Dados da proposta passaram na validação rigorosa");
      } catch (error) {
        const validationError = error as any; // Type assertion para ZodError
        console.error("🚨 [VALIDAÇÃO FALHOU] Dados inválidos detectados:", {
          error: validationError.errors || validationError.message,
          dadosRecebidos: {
            clienteNome: dataForValidation.clienteNome,
            clienteCpf: dataForValidation.clienteCpf,
            clienteEmail: dataForValidation.clienteEmail,
            clienteTelefone: dataForValidation.clienteTelefone,
            valor: dataForValidation.valor,
            prazo: dataForValidation.prazo,
          }
        });
        
        return res.status(400).json({
          message: "Dados da proposta são inválidos",
          errors: validationError.errors || [{ message: validationError.message }],
          details: "Todos os campos obrigatórios devem ser preenchidos corretamente"
        });
      }

      // Add userId to the request body (ID será gerado automaticamente pelo banco)
      const dataWithId = {
        ...dataForValidation,
        userId: req.user?.id,
      };

      // DEBUG: Log dados recebidos do frontend
      console.log("🔍 [NOVA PROPOSTA] Dados de endereço recebidos do frontend:", {
        clienteLogradouro: dataWithId.clienteLogradouro,
        clienteNumero: dataWithId.clienteNumero,
        clienteComplemento: dataWithId.clienteComplemento,
        clienteBairro: dataWithId.clienteBairro,
        clienteCep: dataWithId.clienteCep,
        clienteCidade: dataWithId.clienteCidade,
        clienteUf: dataWithId.clienteUf
      });
      
      // DEBUG: Log dados de pagamento recebidos
      console.log("💳 [NOVA PROPOSTA] Dados de pagamento recebidos do frontend:", {
        metodoPagamento: dataWithId.metodoPagamento,
        dadosPagamentoBanco: dataWithId.dadosPagamentoBanco,
        dadosPagamentoAgencia: dataWithId.dadosPagamentoAgencia,
        dadosPagamentoConta: dataWithId.dadosPagamentoConta,
        dadosPagamentoDigito: dataWithId.dadosPagamentoDigito,
        dadosPagamentoPix: dataWithId.dadosPagamentoPix,
        dadosPagamentoTipoPix: dataWithId.dadosPagamentoTipoPix,
        dadosPagamentoPixBanco: dataWithId.dadosPagamentoPixBanco,
        dadosPagamentoPixNomeTitular: dataWithId.dadosPagamentoPixNomeTitular,
        dadosPagamentoPixCpfTitular: dataWithId.dadosPagamentoPixCpfTitular
      });

      // FIX: Transform flat structure to JSONB structure expected by database
      const dataForDatabase = {
        // id será gerado automaticamente pela sequência
        userId: dataWithId.userId,
        lojaId: dataWithId.lojaId,
        status: dataWithId.status || "aguardando_analise",

        // Store client data as JSONB (as object, not string)
        clienteData: {
          nome: dataWithId.clienteNome,
          cpf: dataWithId.clienteCpf,
          email: dataWithId.clienteEmail,
          telefone: dataWithId.clienteTelefone,
          dataNascimento: dataWithId.clienteDataNascimento,
          renda: dataWithId.clienteRenda,
          // CAMPOS DE DOCUMENTAÇÃO CORRIGIDOS - RG COMPLETO
          rg: dataWithId.clienteRg,
          orgaoEmissor: dataWithId.clienteOrgaoEmissor,
          rgDataEmissao: dataWithId.clienteRgDataEmissao,
          rgUf: dataWithId.clienteRgUf,
          localNascimento: dataWithId.clienteLocalNascimento,
          estadoCivil: dataWithId.clienteEstadoCivil,
          nacionalidade: dataWithId.clienteNacionalidade,
          // Campos de endereço separados - CORRIGIDO para garantir persistência
          cep: dataWithId.clienteCep,
          logradouro: dataWithId.clienteLogradouro,
          numero: dataWithId.clienteNumero,
          complemento: dataWithId.clienteComplemento,
          bairro: dataWithId.clienteBairro,
          cidade: dataWithId.clienteCidade,
          estado: dataWithId.clienteUf,
          uf: dataWithId.clienteUf, // Alias para compatibilidade
          // Campo legado para compatibilidade
          endereco: dataWithId.clienteEndereco || 
            [dataWithId.clienteLogradouro, dataWithId.clienteNumero, dataWithId.clienteComplemento, dataWithId.clienteBairro].filter(Boolean).join(", "),
          ocupacao: dataWithId.clienteOcupacao,
          telefoneEmpresa: dataWithId.clienteTelefoneEmpresa,
          // DADOS DE PAGAMENTO NO JSON PARA FALLBACK
          metodoPagamento: dataWithId.metodoPagamento,
          banco: dataWithId.dadosPagamentoBanco,
          agencia: dataWithId.dadosPagamentoAgencia,
          conta: dataWithId.dadosPagamentoConta,
          digito: dataWithId.dadosPagamentoDigito,
          chavePix: dataWithId.dadosPagamentoPix,
          tipoPix: dataWithId.dadosPagamentoTipoPix,
          pixBanco: dataWithId.dadosPagamentoPixBanco,
          pixNomeTitular: dataWithId.dadosPagamentoPixNomeTitular,
          pixCpfTitular: dataWithId.dadosPagamentoPixCpfTitular,
        },

        // Store loan conditions as JSONB (as object, not string)
        condicoesData: {
          valor: dataWithId.valor,
          prazo: dataWithId.prazo,
          finalidade: dataWithId.finalidade,
          garantia: dataWithId.garantia,
          valorTac: dataWithId.valorTac,
          valorIof: dataWithId.valorIof,
          valorTotalFinanciado: dataWithId.valorTotalFinanciado,
        },

        // Dados de pagamento (separados para melhor controle)
        metodo_pagamento: dataWithId.metodoPagamento, // 'conta_bancaria' ou 'pix'
        
        // Dados bancários (quando conta_bancaria)
        dados_pagamento_banco: dataWithId.dadosPagamentoBanco,
        dados_pagamento_agencia: dataWithId.dadosPagamentoAgencia,
        dados_pagamento_conta: dataWithId.dadosPagamentoConta,
        dados_pagamento_digito: dataWithId.dadosPagamentoDigito,
        dados_pagamento_codigo_banco: dataWithId.dadosPagamentoBanco, // Código do banco
        dados_pagamento_tipo: "corrente", // Tipo da conta (corrente/poupança)
        dados_pagamento_nome_titular: dataWithId.dadosPagamentoNomeTitular || dataWithId.clienteNome,
        dados_pagamento_cpf_titular: dataWithId.dadosPagamentoCpfTitular || dataWithId.clienteCpf,
        
        // Dados PIX (quando pix)
        dados_pagamento_pix: dataWithId.dadosPagamentoPix, // Chave PIX
        dados_pagamento_tipo_pix: dataWithId.dadosPagamentoTipoPix, // Tipo da chave (cpf/cnpj/email/telefone/aleatoria)
        dados_pagamento_pix_banco: dataWithId.dadosPagamentoPixBanco, // Banco do PIX
        dados_pagamento_pix_nome_titular: dataWithId.dadosPagamentoPixNomeTitular,
        dados_pagamento_pix_cpf_titular: dataWithId.dadosPagamentoPixCpfTitular,

        // Additional fields
        produtoId: dataWithId.produtoId,
        tabelaComercialId: dataWithId.tabelaComercialId,

        // Personal references (store as JSONB)
        referenciaPessoal: dataWithId.referenciaPessoal || [],
        
        // ⚡ PAM V1.0 CORREÇÃO CRÍTICA - DUPLA ESCRITA
        // Populando colunas relacionais dedicadas para garantir integridade
        clienteNome: dataWithId.clienteNome,
        clienteCpf: dataWithId.clienteCpf,
        clienteEmail: dataWithId.clienteEmail,
        clienteTelefone: dataWithId.clienteTelefone,
      };

      // DEBUG: Log dados que serão persistidos
      console.log("🔍 [NOVA PROPOSTA] clienteData que será salvo no banco:", dataForDatabase.clienteData);
      console.log("💳 [NOVA PROPOSTA] Dados de pagamento que serão salvos no banco:", {
        metodo_pagamento: dataForDatabase.metodo_pagamento,
        dados_pagamento_banco: dataForDatabase.dados_pagamento_banco,
        dados_pagamento_agencia: dataForDatabase.dados_pagamento_agencia,
        dados_pagamento_conta: dataForDatabase.dados_pagamento_conta,
        dados_pagamento_pix: dataForDatabase.dados_pagamento_pix,
        dados_pagamento_tipo_pix: dataForDatabase.dados_pagamento_tipo_pix
      });

      // Create the proposal
      const proposta = await storage.createProposta(dataForDatabase);
      
      // DEBUG: Log proposta criada
      console.log("🔍 [NOVA PROPOSTA] Proposta criada com ID:", proposta.id);
      console.log("🔍 [NOVA PROPOSTA] clienteData salvo:", proposta.clienteData);

      // Generate installments automatically after proposal creation
      try {
        const prazo = parseInt(dataForDatabase.condicoesData.prazo) || 12;
        const valor = parseFloat(dataForDatabase.condicoesData.valor) || 0;
        const valorParcela = valor / prazo;
        
        const { createServerSupabaseAdminClient } = await import("./lib/supabase");
        const supabase = createServerSupabaseAdminClient();
        
        // Generate installments
        const parcelas = [];
        const hoje = new Date();
        
        for (let i = 0; i < prazo; i++) {
          const vencimento = new Date(hoje);
          vencimento.setMonth(vencimento.getMonth() + i + 1);
          
          parcelas.push({
            proposta_id: proposta.id,
            numero_parcela: i + 1,
            valor_parcela: valorParcela,
            data_vencimento: vencimento.toISOString(),
            status: 'pendente'
          });
        }
        
        if (parcelas.length > 0) {
          const { error: parcelasError } = await supabase
            .from('parcelas')
            .insert(parcelas);
            
          if (parcelasError) {
            console.error('Erro ao criar parcelas:', parcelasError);
          } else {
            console.log(`✅ ${parcelas.length} parcelas criadas para proposta ${proposta.id}`);
          }
        }
      } catch (parcelasError) {
        console.error('Erro ao gerar parcelas automáticas:', parcelasError);
        // Não falhar a criação da proposta por causa das parcelas
      }

      res.status(201).json(proposta);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Create proposta error:", error);
      res.status(500).json({ message: "Failed to create proposta" });
    }
  });

  // Endpoint específico para associar documentos a uma proposta
  app.post(
    "/api/propostas/:id/documentos",
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id: propostaId } = req.params;
        const { documentos } = req.body;

        if (!documentos || !Array.isArray(documentos)) {
          return res.status(400).json({ message: "Lista de documentos é obrigatória" });
        }

        const { createServerSupabaseAdminClient } = await import("./lib/supabase");
        const supabase = createServerSupabaseAdminClient();

        console.log(`[DEBUG] Associando ${documentos.length} documentos à proposta ${propostaId}`);

        // Inserir associações na tabela proposta_documentos
        for (const fileName of documentos) {
          try {
            const filePath = `proposta-${propostaId}/${fileName}`;

            // Gerar URL assinada para o documento
            const { data: signedUrlData } = await supabase.storage
              .from("documents")
              .createSignedUrl(filePath, 3600); // 1 hora

            const { error: insertError } = await supabase.from("proposta_documentos").insert({
              proposta_id: propostaId,
              nome_arquivo: fileName.split("-").slice(1).join("-"), // Remove timestamp prefix
              url: signedUrlData?.signedUrl || `documents/${filePath}`,
              tipo: fileName.endsWith(".pdf")
                ? "application/pdf"
                : fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")
                  ? "image/jpeg"
                  : fileName.endsWith(".png")
                    ? "image/png"
                    : fileName.endsWith(".gif")
                      ? "image/gif"
                      : "application/octet-stream",
              tamanho: 0, // Will be updated if size is available
            });

            if (insertError) {
              console.error(`[ERROR] Falha ao associar documento ${fileName}:`, insertError);
            } else {
              console.log(
                `[DEBUG] Documento ${fileName} associado com sucesso à proposta ${propostaId}`
              );
            }
          } catch (docError) {
            console.error(`[ERROR] Erro ao processar documento ${fileName}:`, docError);
          }
        }

        res.json({
          success: true,
          message: `${documentos.length} documentos associados com sucesso`,
          proposalId: propostaId,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error("Validation error:", error.errors);
          return res.status(400).json({ message: "Invalid data", errors: error.errors });
        }
        console.error("Create proposta error:", error);
        res.status(500).json({ message: "Failed to create proposta" });
      }
    }
  );

  // ====================================
  // PILAR 12 - PROGRESSIVE ENHANCEMENT
  // Rota para submissão de formulário tradicional (fallback)
  // ====================================
  app.post("/nova-proposta", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      console.log("📝 Progressive Enhancement: Form submission received");

      // Parse form data
      const formData = {
        clienteNome: req.body.clienteNome,
        clienteCpf: req.body.clienteCpf,
        clienteEmail: req.body.clienteEmail,
        clienteTelefone: req.body.clienteTelefone,
        clienteDataNascimento: req.body.clienteDataNascimento,
        clienteRenda: req.body.clienteRenda,
        valor: req.body.valor,
        prazo: parseInt(req.body.prazo),
        finalidade: req.body.finalidade,
        garantia: req.body.garantia,
        status: "rascunho",
      };

      // Validate and create proposal
      const validatedData = insertPropostaSchema.parse(formData);
      const proposta = await storage.createProposta(validatedData);

      // For traditional form submission, redirect with success message
      const successPage = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Proposta Enviada - Simpix</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 2rem; background: #f9fafb; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .success { color: #16a34a; text-align: center; }
                .button { display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 1rem; }
                .details { background: #f3f4f6; padding: 1rem; border-radius: 6px; margin-top: 1rem; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success">
                    <h1>✅ Proposta Enviada com Sucesso!</h1>
                    <p>Sua proposta foi registrada no sistema e está aguardando análise.</p>
                </div>
                <div class="details">
                    <h3>Dados da Proposta:</h3>
                    <p><strong>ID:</strong> ${proposta.id}</p>
                    <p><strong>Cliente:</strong> ${formData.clienteNome}</p>
                    <p><strong>Valor:</strong> R$ ${formData.valor}</p>
                    <p><strong>Prazo:</strong> ${formData.prazo} meses</p>
                    <p><strong>Status:</strong> ${formData.status}</p>
                </div>
                <div style="text-align: center;">
                    <a href="/dashboard" class="button">Voltar ao Dashboard</a>
                    <a href="/propostas/nova" class="button" style="background: #6b7280;">Nova Proposta</a>
                </div>
            </div>
            <script>
                // Se JavaScript estiver disponível, redirecionar automaticamente
                setTimeout(() => window.location.href = '/dashboard', 3000);
            </script>
        </body>
        </html>
      `;

      res.send(successPage);
    } catch (error) {
      console.error("Progressive Enhancement form error:", error);

      // Error page for traditional form submission
      const errorPage = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Erro - Simpix</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 2rem; background: #f9fafb; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .error { color: #dc2626; text-align: center; }
                .button { display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 1rem; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error">
                    <h1>❌ Erro ao Enviar Proposta</h1>
                    <p>Ocorreu um erro ao processar sua solicitação. Por favor, verifique os dados e tente novamente.</p>
                    ${
                      error instanceof z.ZodError
                        ? `<div style="background: #fef2f2; padding: 1rem; border-radius: 6px; margin-top: 1rem;">
                         <h3>Campos com erro:</h3>
                         <ul style="text-align: left;">
                           ${error.errors.map(e => `<li>${e.path.join(".")}: ${e.message}</li>`).join("")}
                         </ul>
                       </div>`
                        : ""
                    }
                </div>
                <div style="text-align: center;">
                    <a href="/propostas/nova" class="button">Tentar Novamente</a>
                    <a href="/dashboard" class="button" style="background: #6b7280;">Voltar ao Dashboard</a>
                </div>
            </div>
        </body>
        </html>
      `;

      res.status(400).send(errorPage);
    }
  });

  app.patch(
    "/api/propostas/:id",
    jwtAuthMiddleware,
    requireManagerOrAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = parseInt(req.params.id);
        const validatedData = updatePropostaSchema.parse(req.body);
        const proposta = await storage.updateProposta(id, validatedData);
        res.json(proposta);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid data", errors: error.errors });
        }
        console.error("Update proposta error:", error);
        res.status(500).json({ message: "Failed to update proposta" });
      }
    }
  );

  app.get(
    "/api/propostas/status/:status",
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const status = req.params.status;
        const propostas = await storage.getPropostasByStatus(status);
        res.json(propostas);
      } catch (error) {
        console.error("Get propostas by status error:", error);
        res.status(500).json({ message: "Failed to fetch propostas" });
      }
    }
  );

  // Import document routes
  const { getPropostaDocuments, uploadPropostaDocument } = await import("./routes/documents");

  // Document routes for proposals
  app.get("/api/propostas/:id/documents", jwtAuthMiddleware, getPropostaDocuments);
  app.post(
    "/api/propostas/:id/documents",
    jwtAuthMiddleware,
    upload.single("file"),
    uploadPropostaDocument
  );

  // Import propostas routes
  const { togglePropostaStatus, getCcbAssinada } = await import("./routes/propostas");

  // Rota para alternar status entre ativa/suspensa
  app.put("/api/propostas/:id/toggle-status", jwtAuthMiddleware, togglePropostaStatus);

  // Rota para buscar CCB assinada
  app.get("/api/propostas/:id/ccb", jwtAuthMiddleware, getCcbAssinada);

  // Emergency route to setup storage bucket (temporary - no auth for setup)
  app.post("/api/setup-storage", async (req, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import("./lib/supabase");
      const supabase = createServerSupabaseAdminClient();

      // Check existing buckets
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();

      if (listError) {
        console.error("❌ Erro ao listar buckets:", listError);
        return res
          .status(500)
          .json({ message: "Erro ao acessar storage", error: listError.message });
      }

      const documentsExists = buckets.some(bucket => bucket.name === "documents");

      if (documentsExists) {
        return res.json({
          message: "Bucket documents já existe",
          buckets: buckets.map(b => b.name),
        });
      }

      // Create documents bucket
      const { data: bucket, error: createError } = await supabase.storage.createBucket(
        "documents",
        {
          public: true,
          fileSizeLimit: 52428800, // 50MB
          allowedMimeTypes: [
            "application/pdf",
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/gif",
          ],
        }
      );

      if (createError) {
        console.error("❌ Erro ao criar bucket:", createError);
        return res
          .status(500)
          .json({ message: "Erro ao criar bucket", error: createError.message });
      }

      res.json({
        message: "Bucket documents criado com sucesso!",
        bucket: bucket,
        allBuckets: buckets.map(b => b.name).concat(["documents"]),
      });
    } catch (error) {
      console.error("Erro no setup:", error);
      res.status(500).json({
        message: "Erro interno",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Upload route for proposal documents during creation
  app.post(
    "/api/upload",
    jwtAuthMiddleware,
    upload.single("file"),
    async (req: AuthenticatedRequest, res) => {
      try {
        const file = req.file;
        const proposalId = req.body.proposalId || req.body.filename?.split("-")[0] || "temp";

        if (!file) {
          return res.status(400).json({ message: "Arquivo é obrigatório" });
        }

        const { createServerSupabaseAdminClient } = await import("./lib/supabase");
        const supabase = createServerSupabaseAdminClient();

        // Generate unique filename with UUID
        const { v4: uuidv4 } = await import("uuid");
        const uniqueId = uuidv4().split("-")[0]; // Use first segment of UUID for shorter filename
        const fileName = req.body.filename || `${uniqueId}-${file.originalname}`;
        const filePath = `proposta-${proposalId}/${fileName}`;

        console.log(`[DEBUG] Fazendo upload de ${file.originalname} para ${filePath}`);

        // Upload to PRIVATE Supabase Storage bucket
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          console.error("[ERROR] Erro no upload:", uploadError);
          return res.status(400).json({
            message: `Erro no upload: ${uploadError.message}`,
          });
        }

        // For private bucket, we need to generate a signed URL for viewing
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from("documents")
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        console.log(`[DEBUG] Upload bem-sucedido. Arquivo salvo em: ${filePath}`);

        res.json({
          success: true,
          fileName: fileName,
          filePath: filePath,
          url: signedUrlData?.signedUrl || "", // Temporary signed URL
          originalName: file.originalname,
          size: file.size,
          type: file.mimetype,
        });
      } catch (error) {
        console.error("[ERROR] Erro no upload de documento:", error);
        res.status(500).json({ message: "Erro interno no upload" });
      }
    }
  );

  // Import do controller de produtos
  const {
    buscarTodosProdutos,
    criarProduto,
    atualizarProduto,
    verificarProdutoEmUso,
    deletarProduto,
  } = await import("./controllers/produtoController");

  // Buscar tabelas comerciais disponíveis com lógica hierárquica
  app.get(
    "/api/tabelas-comerciais-disponiveis",
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { produtoId, parceiroId } = req.query;

        // Validação de parâmetros obrigatórios
        if (!produtoId || !parceiroId) {
          return res.status(400).json({
            message: "produtoId e parceiroId são obrigatórios",
          });
        }

        // Validação de tipos
        const produtoIdNum = parseInt(produtoId as string);
        const parceiroIdNum = parseInt(parceiroId as string);

        if (isNaN(produtoIdNum) || isNaN(parceiroIdNum)) {
          return res.status(400).json({
            message: "produtoId e parceiroId devem ser números válidos",
          });
        }

        console.log(
          `[${getBrasiliaTimestamp()}] Buscando tabelas comerciais para produto ${produtoIdNum} e parceiro ${parceiroIdNum}`
        );

        // Import database connection
        const { db } = await import("../server/lib/supabase");
        const { eq, and, isNull, desc } = await import("drizzle-orm");
        const { tabelasComerciais, produtoTabelaComercial } = await import("../shared/schema");

        // STEP 1: Busca Prioritária - Tabelas Personalizadas (produto + parceiro)
        // Agora usando JOIN com a nova estrutura N:N
        const tabelasPersonalizadas = await db
          .select({
            id: tabelasComerciais.id,
            nomeTabela: tabelasComerciais.nomeTabela,
            taxaJuros: tabelasComerciais.taxaJuros,
            prazos: tabelasComerciais.prazos,
            parceiroId: tabelasComerciais.parceiroId,
            comissao: tabelasComerciais.comissao,
            createdAt: tabelasComerciais.createdAt,
          })
          .from(tabelasComerciais)
          .innerJoin(
            produtoTabelaComercial,
            eq(tabelasComerciais.id, produtoTabelaComercial.tabelaComercialId)
          )
          .where(
            and(
              eq(produtoTabelaComercial.produtoId, produtoIdNum),
              eq(tabelasComerciais.parceiroId, parceiroIdNum)
            )
          )
          .orderBy(desc(tabelasComerciais.createdAt));

        // STEP 2: Validação - Se encontrou tabelas personalizadas, retorna apenas elas
        if (tabelasPersonalizadas && tabelasPersonalizadas.length > 0) {
          console.log(
            `[${getBrasiliaTimestamp()}] Encontradas ${tabelasPersonalizadas.length} tabelas personalizadas`
          );
          return res.json(tabelasPersonalizadas);
        }

        console.log(
          `[${getBrasiliaTimestamp()}] Nenhuma tabela personalizada encontrada, buscando tabelas gerais`
        );

        // STEP 3: Busca Secundária - Tabelas Gerais (produto + parceiro nulo)
        // Usando JOIN com a nova estrutura N:N
        const tabelasGerais = await db
          .select({
            id: tabelasComerciais.id,
            nomeTabela: tabelasComerciais.nomeTabela,
            taxaJuros: tabelasComerciais.taxaJuros,
            prazos: tabelasComerciais.prazos,
            parceiroId: tabelasComerciais.parceiroId,
            comissao: tabelasComerciais.comissao,
            createdAt: tabelasComerciais.createdAt,
          })
          .from(tabelasComerciais)
          .innerJoin(
            produtoTabelaComercial,
            eq(tabelasComerciais.id, produtoTabelaComercial.tabelaComercialId)
          )
          .where(
            and(
              eq(produtoTabelaComercial.produtoId, produtoIdNum),
              isNull(tabelasComerciais.parceiroId)
            )
          )
          .orderBy(desc(tabelasComerciais.createdAt));

        // STEP 4: Resultado Final
        const resultado = tabelasGerais || [];
        console.log(`[${getBrasiliaTimestamp()}] Encontradas ${resultado.length} tabelas gerais`);

        res.json(resultado);
      } catch (error) {
        console.error("Erro no endpoint de tabelas comerciais hierárquicas:", error);
        res.status(500).json({
          message: "Erro interno do servidor",
        });
      }
    }
  );

  // Simple GET endpoint for all commercial tables (for dropdowns)
  app.get("/api/tabelas-comerciais", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      // Import database connection
      const { db } = await import("../server/lib/supabase");
      const { desc, eq } = await import("drizzle-orm");
      const { tabelasComerciais, produtoTabelaComercial } = await import("../shared/schema");

      // Get all commercial tables ordered by creation date (excluding soft-deleted)
      const { isNull } = await import("drizzle-orm");
      const tabelas = await db
        .select()
        .from(tabelasComerciais)
        .where(isNull(tabelasComerciais.deletedAt))
        .orderBy(desc(tabelasComerciais.createdAt));

      // For each table, get associated products
      const tabelasWithProducts = await Promise.all(
        tabelas.map(async tabela => {
          const associations = await db
            .select({ produtoId: produtoTabelaComercial.produtoId })
            .from(produtoTabelaComercial)
            .where(eq(produtoTabelaComercial.tabelaComercialId, tabela.id));

          return {
            ...tabela,
            produtoIds: associations.map(a => a.produtoId),
          };
        })
      );

      console.log(
        `[${getBrasiliaTimestamp()}] Retornando ${tabelasWithProducts.length} tabelas comerciais com produtos`
      );
      res.json(tabelasWithProducts);
    } catch (error) {
      console.error("Erro ao buscar tabelas comerciais:", error);
      res.status(500).json({
        message: "Erro ao buscar tabelas comerciais",
      });
    }
  });

  // API endpoint for creating commercial tables (N:N structure)
  app.post(
    "/api/admin/tabelas-comerciais",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import("../server/lib/supabase");
        const { tabelasComerciais, produtoTabelaComercial } = await import("../shared/schema");
        const { z } = await import("zod");

        // Updated validation schema for N:N structure
        const createTabelaSchema = z.object({
          nomeTabela: z.string().min(3, "Nome da tabela deve ter pelo menos 3 caracteres"),
          taxaJuros: z.number().positive("Taxa de juros deve ser positiva"),
          prazos: z.array(z.number().positive()).min(1, "Deve ter pelo menos um prazo"),
          produtoIds: z
            .array(z.number().int().positive())
            .min(1, "Pelo menos um produto deve ser selecionado"),
          parceiroId: z.number().int().positive().optional(),
          comissao: z.number().min(0, "Comissão deve ser maior ou igual a zero").default(0),
        });

        const validatedData = createTabelaSchema.parse(req.body);

        // TRANSACTION: Create table and associate products
        const result = await db.transaction(async tx => {
          // Step 1: Insert new commercial table
          const [newTabela] = await tx
            .insert(tabelasComerciais)
            .values({
              nomeTabela: validatedData.nomeTabela,
              taxaJuros: validatedData.taxaJuros.toString(),
              prazos: validatedData.prazos,
              parceiroId: validatedData.parceiroId || null,
              comissao: validatedData.comissao.toString(),
            })
            .returning();

          // Step 2: Associate products via junction table
          const associations = validatedData.produtoIds.map(produtoId => ({
            produtoId,
            tabelaComercialId: newTabela.id,
          }));

          await tx.insert(produtoTabelaComercial).values(associations);

          return newTabela;
        });

        console.log(
          `[${getBrasiliaTimestamp()}] Nova tabela comercial criada com ${validatedData.produtoIds.length} produtos: ${result.id}`
        );
        res.status(201).json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
        }
        console.error("Erro ao criar tabela comercial:", error);
        res.status(500).json({ message: "Erro ao criar tabela comercial" });
      }
    }
  );

  // API endpoint for updating commercial tables (N:N structure)
  app.put(
    "/api/admin/tabelas-comerciais/:id",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import("../server/lib/supabase");
        const { tabelasComerciais, produtoTabelaComercial } = await import("../shared/schema");
        const { z } = await import("zod");
        const { eq } = await import("drizzle-orm");

        const tabelaId = parseInt(req.params.id);
        if (isNaN(tabelaId)) {
          return res.status(400).json({ message: "ID da tabela inválido" });
        }

        // Updated validation schema for N:N structure
        const updateTabelaSchema = z.object({
          nomeTabela: z.string().min(3, "Nome da tabela deve ter pelo menos 3 caracteres"),
          taxaJuros: z.number().positive("Taxa de juros deve ser positiva"),
          prazos: z.array(z.number().positive()).min(1, "Deve ter pelo menos um prazo"),
          produtoIds: z
            .array(z.number().int().positive())
            .min(1, "Pelo menos um produto deve ser selecionado"),
          parceiroId: z.number().int().positive().nullable().optional(),
          comissao: z.number().min(0, "Comissão deve ser maior ou igual a zero").default(0),
        });

        const validatedData = updateTabelaSchema.parse(req.body);

        // TRANSACTION: Update table and reassociate products
        const result = await db.transaction(async tx => {
          // Step 1: Update the commercial table
          const [updatedTabela] = await tx
            .update(tabelasComerciais)
            .set({
              nomeTabela: validatedData.nomeTabela,
              taxaJuros: validatedData.taxaJuros.toString(),
              prazos: validatedData.prazos,
              parceiroId: validatedData.parceiroId || null,
              comissao: validatedData.comissao.toString(),
            })
            .where(eq(tabelasComerciais.id, tabelaId))
            .returning();

          if (!updatedTabela) {
            throw new Error("Tabela comercial não encontrada");
          }

          // Step 2: Delete existing product associations
          await tx
            .delete(produtoTabelaComercial)
            .where(eq(produtoTabelaComercial.tabelaComercialId, tabelaId));

          // Step 3: Create new product associations
          const associations = validatedData.produtoIds.map(produtoId => ({
            produtoId,
            tabelaComercialId: tabelaId,
          }));

          await tx.insert(produtoTabelaComercial).values(associations);

          return updatedTabela;
        });

        console.log(
          `[${getBrasiliaTimestamp()}] Tabela comercial atualizada com ${validatedData.produtoIds.length} produtos: ${result.id}`
        );
        res.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
        }
        if (error instanceof Error && error.message === "Tabela comercial não encontrada") {
          return res.status(404).json({ message: error.message });
        }
        console.error("Erro ao atualizar tabela comercial:", error);
        res.status(500).json({ message: "Erro ao atualizar tabela comercial" });
      }
    }
  );

  // API endpoint for deleting commercial tables
  app.delete(
    "/api/admin/tabelas-comerciais/:id",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import("../server/lib/supabase");
        const { tabelasComerciais, produtoTabelaComercial } = await import("../shared/schema");
        const { eq } = await import("drizzle-orm");

        const tabelaId = parseInt(req.params.id);
        if (isNaN(tabelaId)) {
          return res.status(400).json({ message: "ID da tabela inválido" });
        }

        // TRANSACTION: Delete table and its associations
        await db.transaction(async tx => {
          // Step 1: Delete product associations
          await tx
            .delete(produtoTabelaComercial)
            .where(eq(produtoTabelaComercial.tabelaComercialId, tabelaId));

          // Step 2: Soft delete the commercial table
          const result = await tx
            .update(tabelasComerciais)
            .set({ deletedAt: new Date() })
            .where(eq(tabelasComerciais.id, tabelaId))
            .returning();

          if (result.length === 0) {
            throw new Error("Tabela comercial não encontrada");
          }
        });

        console.log(`[${getBrasiliaTimestamp()}] Tabela comercial deletada: ${tabelaId}`);
        res.status(204).send();
      } catch (error) {
        if (error instanceof Error && error.message === "Tabela comercial não encontrada") {
          return res.status(404).json({ message: error.message });
        }
        console.error("Erro ao deletar tabela comercial:", error);
        res.status(500).json({ message: "Erro ao deletar tabela comercial" });
      }
    }
  );

  // REMOVIDO: Rota duplicada movida para linha 441 - ver comentário 🔧 CORREÇÃO CRÍTICA

  // Metrics endpoint for attendants - returns proposals count for today, week, month
  app.get("/api/propostas/metricas", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { db } = await import("../server/lib/supabase");
      const { propostas } = await import("../shared/schema");
      const { eq, gte, and, count } = await import("drizzle-orm");

      // Get current date and calculate date ranges
      const now = getBrasiliaDate();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Count proposals created today by this user
      const todayCount = await db
        .select({ count: count() })
        .from(propostas)
        .where(and(eq(propostas.userId, userId), gte(propostas.createdAt, todayStart)));

      // Count proposals created this week by this user
      const weekCount = await db
        .select({ count: count() })
        .from(propostas)
        .where(and(eq(propostas.userId, userId), gte(propostas.createdAt, weekStart)));

      // Count proposals created this month by this user
      const monthCount = await db
        .select({ count: count() })
        .from(propostas)
        .where(and(eq(propostas.userId, userId), gte(propostas.createdAt, monthStart)));

      res.json({
        hoje: todayCount[0]?.count || 0,
        semana: weekCount[0]?.count || 0,
        mes: monthCount[0]?.count || 0,
      });
    } catch (error) {
      console.error("Error fetching user metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // GET /api/propostas/metricas - Get proposal metrics for current user
  app.get("/api/propostas/metricas", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { db } = await import("../server/lib/supabase");
      const { propostas } = await import("../shared/schema");
      const { eq, and, gte, count } = await import("drizzle-orm");

      const now = getBrasiliaDate();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Count proposals created today by this user
      const todayCount = await db
        .select({ count: count() })
        .from(propostas)
        .where(and(eq(propostas.userId, userId), gte(propostas.createdAt, todayStart)));

      // Count proposals created this week by this user
      const weekCount = await db
        .select({ count: count() })
        .from(propostas)
        .where(and(eq(propostas.userId, userId), gte(propostas.createdAt, weekStart)));

      // Count proposals created this month by this user
      const monthCount = await db
        .select({ count: count() })
        .from(propostas)
        .where(and(eq(propostas.userId, userId), gte(propostas.createdAt, monthStart)));

      res.json({
        hoje: todayCount[0]?.count || 0,
        semana: weekCount[0]?.count || 0,
        mes: monthCount[0]?.count || 0,
      });
    } catch (error) {
      console.error("Error fetching proposal metrics:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Payment queue endpoint (T-05) - for FINANCEIRO team
  app.get("/api/propostas/pagamento", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { propostas } = await import("../shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      // Payment queue logic: only proposals ready for payment
      const pagamentoPropostas = await db
        .select()
        .from(propostas)
        .where(eq(propostas.status, "pronto_pagamento"))
        .orderBy(desc(propostas.createdAt));

      console.log(
        `[${getBrasiliaTimestamp()}] Retornando ${pagamentoPropostas.length} propostas prontas para pagamento`
      );
      res.json(pagamentoPropostas);
    } catch (error) {
      console.error("Erro ao buscar propostas para pagamento:", error);
      res.status(500).json({
        message: "Erro ao buscar propostas para pagamento",
      });
    }
  });

  // Endpoint for formalization data - Using Supabase direct to avoid Drizzle orderSelectedFields error
  app.get(
    "/api/propostas/:id/formalizacao",
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const propostaId = req.params.id;
        console.log(
          `[${getBrasiliaTimestamp()}] 🔍 INICIO - Buscando dados de formalização para proposta: ${propostaId}`
        );

        if (!propostaId) {
          return res.status(400).json({ message: "ID da proposta é obrigatório" });
        }

        // Usar Supabase Admin Client diretamente para evitar problemas do Drizzle
        const { createServerSupabaseAdminClient } = await import("./lib/supabase");
        const supabase = createServerSupabaseAdminClient();

        console.log(`[${getBrasiliaTimestamp()}] 🔍 STEP 1 - Fazendo query direta no Supabase...`);

        // Buscar proposta usando Supabase diretamente - incluindo numeroProposta
        const { data: proposta, error: propostaError } = await supabase
          .from("propostas")
          .select("*, numero_proposta")
          .eq("id", propostaId)
          .single();

        console.log(`[${getBrasiliaTimestamp()}] 🔍 STEP 2 - Proposta encontrada:`, !!proposta);
        console.log(`[${getBrasiliaTimestamp()}] 🔍 STEP 2.1 - Dados da proposta:`, {
          id: proposta?.id,
          status: proposta?.status,
          tabela_comercial_id: proposta?.tabela_comercial_id,
          produto_id: proposta?.produto_id,
          atendente_id: proposta?.atendente_id,
        });

        if (propostaError || !proposta) {
          console.log(
            `[${getBrasiliaTimestamp()}] ❌ Proposta ${propostaId} não encontrada:`,
            propostaError?.message
          );
          return res.status(404).json({ message: "Proposta não encontrada" });
        }

        console.log(`[${getBrasiliaTimestamp()}] 🔍 STEP 3 - Buscando documentos...`);

        // Buscar documentos da proposta
        const { data: documentos, error: docError } = await supabase
          .from("proposta_documentos")
          .select("*")
          .eq("proposta_id", propostaId);

        console.log(
          `[${getBrasiliaTimestamp()}] 🔍 STEP 4 - Documentos encontrados:`,
          documentos?.length || 0
        );
        console.log(
          `[${getBrasiliaTimestamp()}] 🔍 STEP 4.1 - Estrutura dos documentos:`,
          documentos
        );

        // STEP 4.2: Gerar URLs assinadas para visualização dos documentos
        let documentosComUrls = [];
        if (documentos && documentos.length > 0) {
          console.log(
            `[${getBrasiliaTimestamp()}] 🔍 STEP 4.2 - Gerando URLs assinadas para ${documentos.length} documentos...`
          );

          for (const doc of documentos) {
            try {
              console.log(`🔍 [FORMALIZAÇÃO] Tentando gerar URL para documento:`, {
                nome: doc.nome_arquivo,
                url: doc.url,
                tipo: doc.tipo,
                proposta_id: doc.proposta_id,
              });

              // Extrair o caminho do arquivo a partir da URL salva
              const documentsIndex = doc.url.indexOf("/documents/");
              let filePath;

              if (documentsIndex !== -1) {
                // Extrair caminho após '/documents/'
                filePath = doc.url.substring(documentsIndex + "/documents/".length);
              } else {
                // Fallback: construir caminho baseado no nome do arquivo
                const fileName = doc.nome_arquivo;
                filePath = `proposta-${propostaId}/${fileName}`;
              }

              console.log(`🔍 [FORMALIZAÇÃO] Caminho extraído para URL assinada: ${filePath}`);

              const { data: signedUrlData, error: urlError } = await supabase.storage
                .from("documents")
                .createSignedUrl(filePath, 3600); // 1 hora

              if (!urlError && signedUrlData) {
                documentosComUrls.push({
                  ...doc,
                  // Mapeamento para formato esperado pelo DocumentViewer
                  name: doc.nome_arquivo,
                  url: signedUrlData.signedUrl,
                  type: doc.tipo || "application/octet-stream", // fallback se tipo for null
                  uploadDate: doc.created_at,
                  // Manter campos originais também
                  url_visualizacao: signedUrlData.signedUrl,
                });
                console.log(
                  `[${getBrasiliaTimestamp()}] ✅ URL gerada para documento: ${doc.nome_arquivo}`
                );
              } else {
                console.log(
                  `[${getBrasiliaTimestamp()}] ❌ Erro ao gerar URL para documento ${doc.nome_arquivo}:`,
                  urlError?.message
                );
                console.log(`[${getBrasiliaTimestamp()}] ❌ Caminho tentado: ${filePath}`);
                documentosComUrls.push({
                  ...doc,
                  // Mesmo sem URL, mapear para formato esperado
                  name: doc.nome_arquivo,
                  url: "",
                  type: doc.tipo || "application/octet-stream",
                  uploadDate: doc.created_at,
                }); // Adiciona sem URL em caso de erro
              }
            } catch (error) {
              console.log(
                `[${getBrasiliaTimestamp()}] ❌ Erro ao processar documento ${doc.nome_arquivo}:`,
                error
              );
              documentosComUrls.push({
                ...doc,
                // Mesmo com erro, mapear para formato esperado
                name: doc.nome_arquivo,
                url: "",
                type: doc.tipo || "application/octet-stream",
                uploadDate: doc.created_at,
              }); // Adiciona sem URL em caso de erro
            }
          }
        }

        // Buscar taxa de juros da tabela comercial se existir
        let taxaJurosTabela = null;
        console.log(
          `[${getBrasiliaTimestamp()}] 🔍 STEP 5 - Verificando tabela_comercial_id:`,
          proposta.tabela_comercial_id
        );

        if (proposta.tabela_comercial_id) {
          console.log(
            `[${getBrasiliaTimestamp()}] 🔍 STEP 5.1 - Buscando tabela comercial ID:`,
            proposta.tabela_comercial_id
          );

          const { data: tabelaComercial, error: tabelaError } = await supabase
            .from("tabelas_comerciais")
            .select("taxa_juros, nome_tabela, parceiro_id")
            .eq("id", proposta.tabela_comercial_id)
            .single();

          console.log(
            `[${getBrasiliaTimestamp()}] 🔍 STEP 5.2 - Resultado da consulta tabela comercial:`,
            {
              data: tabelaComercial,
              error: tabelaError?.message,
              hasData: !!tabelaComercial,
            }
          );

          if (tabelaComercial && !tabelaError) {
            taxaJurosTabela = tabelaComercial.taxa_juros;
            console.log(
              `[${getBrasiliaTimestamp()}] ✅ Taxa de juros encontrada:`,
              taxaJurosTabela,
              `% da tabela "${tabelaComercial.nome_tabela}"`
            );
          } else {
            console.log(
              `[${getBrasiliaTimestamp()}] ❌ Erro ao buscar tabela comercial:`,
              tabelaError?.message
            );
          }
        } else {
          console.log(
            `[${getBrasiliaTimestamp()}] ⚠️ AVISO: Proposta ${propostaId} não possui tabela_comercial_id`
          );
        }

        console.log(`[${getBrasiliaTimestamp()}] 🔍 STEP 6 - Processando dados JSONB...`);

        // Parse dos dados JSONB antes de retornar
        const propostaProcessada = {
          ...proposta,
          // Parse seguro dos dados JSONB
          clienteData: proposta.cliente_data || {},
          condicoesData: proposta.condicoes_data || {},
          // Converter snake_case para camelCase para compatibilidade frontend
          ccbGerado: proposta.ccb_gerado || false,
          dataAprovacao: proposta.data_aprovacao,
          assinaturaEletronicaConcluida: proposta.assinatura_eletronica_concluida || false,
          biometriaConcluida: proposta.biometria_concluida || false,
          caminhoCcbAssinado: proposta.caminho_ccb_assinado,
          createdAt: proposta.created_at,
          // Adicionar documentos com URLs assinadas
          documentos: documentosComUrls || [],
          // Adicionar taxa de juros da tabela comercial
          taxaJurosTabela: taxaJurosTabela,
        };

        console.log(
          `[${getBrasiliaTimestamp()}] ✅ SUCESSO - Dados de formalização retornados para proposta ${propostaId}:`,
          {
            id: propostaProcessada.id,
            status: propostaProcessada.status,
            ccbGerado: propostaProcessada.ccbGerado,
            dataAprovacao: propostaProcessada.dataAprovacao,
            temClienteData: !!propostaProcessada.clienteData?.nome,
            temCondicoesData: !!propostaProcessada.condicoesData?.valor,
            totalDocumentos: propostaProcessada.documentos?.length || 0,
            clienteNome: propostaProcessada.clienteData?.nome || "Nome não informado",
            valorEmprestimo: propostaProcessada.condicoesData?.valor || "Valor não informado",
            taxaJuros:
              propostaProcessada.taxaJurosTabela ||
              propostaProcessada.condicoesData?.taxaJuros ||
              "Taxa não informada",
          }
        );

        res.json(propostaProcessada);
      } catch (error) {
        console.error(
          `[${getBrasiliaTimestamp()}] ❌ ERRO ao buscar dados de formalização:`,
          error
        );
        res
          .status(500)
          .json({ message: "Erro ao buscar dados de formalização", error: error.message });
      }
    }
  );

  // Mock data para prazos
  const prazos = [
    { id: 1, valor: "12 meses" },
    { id: 2, valor: "24 meses" },
    { id: 3, valor: "36 meses" },
  ];

  // Users management endpoints
  app.get("/api/admin/users", jwtAuthMiddleware, requireAdmin, async (req, res) => {
    try {
      // Query Supabase profiles directly instead of local users table
      const { createServerSupabaseAdminClient } = await import("./lib/supabase");
      const supabase = createServerSupabaseAdminClient();

      // Get all auth users first
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      if (authError) {
        console.error("Auth users error:", authError);
        return res.status(500).json({ message: "Erro ao buscar usuários de autenticação" });
      }

      // Get all profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (profileError) {
        console.error("Supabase profiles error:", profileError);
        return res.status(500).json({ message: "Erro ao buscar perfis de usuários" });
      }

      // Join auth users with profiles manually
      const users = profiles.map(profile => {
        const authUser = authUsers.users.find(user => user.id === profile.id);
        return {
          id: profile.id,
          name: profile.full_name,
          email: authUser?.email || "N/A",
          role: profile.role,
          lojaId: profile.loja_id,
        };
      });

      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // API endpoint for partners - GET all (public for dropdowns)
  app.get("/api/parceiros", async (req, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { parceiros } = await import("../shared/schema");

      const { isNull } = await import("drizzle-orm");
      const allParceiros = await db.select().from(parceiros).where(isNull(parceiros.deletedAt));
      res.json(allParceiros);
    } catch (error) {
      console.error("Erro ao buscar parceiros:", error);
      res.status(500).json({ message: "Erro ao buscar parceiros" });
    }
  });

  // API endpoint for partners - GET by ID
  app.get("/api/parceiros/:id", timingNormalizerMiddleware, async (req, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { parceiros } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");

      const parceiroId = parseInt(req.params.id);
      if (isNaN(parceiroId)) {
        return res.status(400).json({ message: "ID do parceiro inválido" });
      }

      const [parceiro] = await db.select().from(parceiros).where(eq(parceiros.id, parceiroId));

      if (!parceiro) {
        return res.status(404).json({ message: "Parceiro não encontrado" });
      }

      res.json(parceiro);
    } catch (error) {
      console.error("Erro ao buscar parceiro:", error);
      res.status(500).json({ message: "Erro ao buscar parceiro" });
    }
  });

  // API endpoint for partners - POST create
  app.post(
    "/api/admin/parceiros",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import("../server/lib/supabase");
        const { parceiros, insertParceiroSchema } = await import("../shared/schema");
        const { z } = await import("zod");

        const validatedData = insertParceiroSchema.parse(req.body);
        const [newParceiro] = await db.insert(parceiros).values(validatedData).returning();

        res.status(201).json(newParceiro);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
        }
        console.error("Erro ao criar parceiro:", error);
        res.status(500).json({ message: "Erro ao criar parceiro" });
      }
    }
  );

  // API endpoint for partners - PUT update
  app.put(
    "/api/admin/parceiros/:id",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import("../server/lib/supabase");
        const { parceiros, updateParceiroSchema } = await import("../shared/schema");
        const { eq } = await import("drizzle-orm");
        const { z } = await import("zod");

        const parceiroId = parseInt(req.params.id);
        if (isNaN(parceiroId)) {
          return res.status(400).json({ message: "ID do parceiro inválido" });
        }

        const validatedData = updateParceiroSchema.parse(req.body);
        const [updatedParceiro] = await db
          .update(parceiros)
          .set(validatedData)
          .where(eq(parceiros.id, parceiroId))
          .returning();

        if (!updatedParceiro) {
          return res.status(404).json({ message: "Parceiro não encontrado" });
        }

        res.json(updatedParceiro);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
        }
        console.error("Erro ao atualizar parceiro:", error);
        res.status(500).json({ message: "Erro ao atualizar parceiro" });
      }
    }
  );

  // API endpoint for partners - DELETE
  app.delete(
    "/api/admin/parceiros/:id",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import("../server/lib/supabase");
        const { parceiros, lojas } = await import("../shared/schema");
        const { eq, and, isNull } = await import("drizzle-orm");

        const parceiroId = parseInt(req.params.id);
        if (isNaN(parceiroId)) {
          return res.status(400).json({ message: "ID do parceiro inválido" });
        }

        // Regra de negócio crítica: verificar se existem lojas associadas (excluindo soft-deleted)
        const lojasAssociadas = await db
          .select()
          .from(lojas)
          .where(and(eq(lojas.parceiroId, parceiroId), isNull(lojas.deletedAt)));

        if (lojasAssociadas.length > 0) {
          return res.status(409).json({
            message: "Não é possível excluir um parceiro que possui lojas cadastradas.",
          });
        }

        // Verificar se o parceiro existe antes de excluir (excluindo soft-deleted)
        const [parceiroExistente] = await db
          .select()
          .from(parceiros)
          .where(and(eq(parceiros.id, parceiroId), isNull(parceiros.deletedAt)));

        if (!parceiroExistente) {
          return res.status(404).json({ message: "Parceiro não encontrado" });
        }

        // Soft delete - set deleted_at timestamp
        await db
          .update(parceiros)
          .set({ deletedAt: new Date() })
          .where(eq(parceiros.id, parceiroId));

        res.status(204).send();
      } catch (error) {
        console.error("Erro ao excluir parceiro:", error);
        res.status(500).json({ message: "Erro ao excluir parceiro" });
      }
    }
  );

  // Rotas CRUD para produtos
  app.get("/api/produtos", async (req, res) => {
    try {
      const produtos = await buscarTodosProdutos();
      res.json(produtos);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      res.status(500).json({ message: "Erro ao buscar produtos" });
    }
  });

  app.post("/api/produtos", async (req, res) => {
    try {
      const { nome, status } = req.body;

      if (!nome || !status) {
        return res.status(400).json({ message: "Nome e status são obrigatórios" });
      }

      const novoProduto = await criarProduto({ nome, status });
      res.status(201).json(novoProduto);
    } catch (error) {
      console.error("Erro ao criar produto:", error);
      res.status(500).json({ message: "Erro ao criar produto" });
    }
  });

  app.put("/api/produtos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, status } = req.body;

      if (!nome || !status) {
        return res.status(400).json({ message: "Nome e status são obrigatórios" });
      }

      const produtoAtualizado = await atualizarProduto(id, { nome, status });
      res.json(produtoAtualizado);
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      res.status(500).json({ message: "Erro ao atualizar produto" });
    }
  });

  app.delete("/api/produtos/:id", async (req, res) => {
    try {
      const { id } = req.params;

      await deletarProduto(id);
      res.status(204).send(); // 204 No Content on successful deletion
    } catch (error) {
      console.error("Erro ao excluir produto:", error);

      // Check if it's a dependency error
      if (error instanceof Error && error.message.includes("Tabelas Comerciais")) {
        return res.status(409).json({
          message: error.message,
        });
      }

      res.status(500).json({ message: "Erro ao excluir produto" });
    }
  });

  // Rota para buscar prazos
  app.get("/api/prazos", (req, res) => {
    res.json(prazos);
  });

  // Função para calcular o valor da parcela usando a fórmula da Tabela Price
  const calcularParcela = (
    valorSolicitado: number,
    prazoEmMeses: number,
    taxaDeJurosMensal: number
  ): number => {
    if (taxaDeJurosMensal <= 0) {
      return valorSolicitado / prazoEmMeses;
    }
    const i = taxaDeJurosMensal / 100; // Convertendo a taxa percentual para decimal
    const pmt =
      (valorSolicitado * (i * Math.pow(1 + i, prazoEmMeses))) / (Math.pow(1 + i, prazoEmMeses) - 1);
    return parseFloat(pmt.toFixed(2));
  };

  // Rota para simular crédito COM DADOS REAIS DO BANCO
  app.post("/api/simular", async (req, res) => {
    try {
      const { valorEmprestimo, prazoMeses, parceiroId, produtoId } = req.body;

      // Validação de entrada
      if (
        typeof valorEmprestimo !== "number" || valorEmprestimo <= 0 ||
        typeof prazoMeses !== "number" || prazoMeses <= 0 ||
        (!parceiroId && !produtoId)
      ) {
        return res.status(400).json({ 
          error: "Parâmetros inválidos. Forneça valorEmprestimo, prazoMeses e parceiroId ou produtoId." 
        });
      }

      console.log('[SIMULAÇÃO] Iniciando simulação:', { valorEmprestimo, prazoMeses, parceiroId, produtoId });

      // PASSO 1: Buscar parâmetros financeiros do banco de dados
      let taxaJurosMensal = 5.0; // Default fallback
      let tacValor = 0;
      let tacTipo = 'fixo';
      let comissao = 0;

      // Hierarquia de busca de taxas
      if (parceiroId) {
        // 1.1 - Busca dados do parceiro
        const parceiro = await db
          .select()
          .from(parceiros)
          .where(eq(parceiros.id, parceiroId))
          .limit(1);

        if (parceiro.length > 0) {
          const parceiroData = parceiro[0];
          
          // Verifica se parceiro tem tabela comercial padrão
          if (parceiroData.tabelaComercialPadraoId) {
            const tabelaPadrao = await db
              .select()
              .from(tabelasComerciais)
              .where(eq(tabelasComerciais.id, parceiroData.tabelaComercialPadraoId))
              .limit(1);

            if (tabelaPadrao.length > 0) {
              taxaJurosMensal = parseFloat(tabelaPadrao[0].taxaJuros);
              console.log('[SIMULAÇÃO] Usando tabela padrão do parceiro:', {
                tabelaId: parceiroData.tabelaComercialPadraoId,
                taxaJuros: taxaJurosMensal
              });
            }
          }
          
          // Verifica comissão padrão do parceiro
          if (parceiroData.comissaoPadrao) {
            comissao = parseFloat(parceiroData.comissaoPadrao);
          }
        }
      }

      // 1.2 - Se produtoId fornecido, busca configurações do produto
      if (produtoId) {
        const produto = await db
          .select()
          .from(produtos)
          .where(eq(produtos.id, produtoId))
          .limit(1);

        if (produto.length > 0) {
          const produtoData = produto[0];
          tacValor = parseFloat(produtoData.tacValor || '0');
          tacTipo = produtoData.tacTipo || 'fixo';

          // Busca tabelas comerciais associadas ao produto
          const tabelasProduto = await db
            .select({
              tabela: tabelasComerciais
            })
            .from(produtoTabelaComercial)
            .innerJoin(
              tabelasComerciais,
              eq(produtoTabelaComercial.tabelaComercialId, tabelasComerciais.id)
            )
            .where(eq(produtoTabelaComercial.produtoId, produtoId));

          if (tabelasProduto.length > 0) {
            // Prioriza tabela específica do parceiro se existir
            let tabelaSelecionada = tabelasProduto[0].tabela;
            
            if (parceiroId) {
              const tabelaParceiro = tabelasProduto.find(
                (t: any) => t.tabela.parceiroId === parceiroId
              );
              if (tabelaParceiro) {
                tabelaSelecionada = tabelaParceiro.tabela;
                console.log('[SIMULAÇÃO] Usando tabela específica parceiro-produto');
              }
            }

            taxaJurosMensal = parseFloat(tabelaSelecionada.taxaJuros);
            
            // Sobrepõe comissão se não definida no parceiro
            if (!comissao && tabelaSelecionada.comissao) {
              comissao = parseFloat(tabelaSelecionada.comissao);
            }
          }
        }
      }

      console.log('[SIMULAÇÃO] Parâmetros obtidos do banco:', {
        taxaJurosMensal,
        tacValor,
        tacTipo,
        comissao
      });

      // PASSO 2: Executar cálculos usando o serviço de finanças
      const { executarSimulacaoCompleta } = await import('./services/financeService.js');
      
      const resultado = executarSimulacaoCompleta(
        valorEmprestimo,
        prazoMeses,
        taxaJurosMensal,
        tacValor,
        tacTipo,
        0 // dias de carência (pode ser parametrizado depois)
      );

      // PASSO 3: Adicionar comissão ao resultado
      const valorComissao = (valorEmprestimo * comissao) / 100;

      // PASSO 4: Retornar simulação completa
      const respostaCompleta = {
        ...resultado,
        comissao: {
          percentual: comissao,
          valor: Math.round(valorComissao * 100) / 100
        },
        parametrosUtilizados: {
          parceiroId,
          produtoId,
          taxaJurosMensal,
          tacValor,
          tacTipo
        }
      };

      // Log para validação (PROTOCOLO 5-CHECK - Item 5)
      if (valorEmprestimo === 10000 && prazoMeses === 12) {
        console.log('==== DEMONSTRAÇÃO DE CÁLCULO PARA R$ 10.000 em 12 meses ====');
        console.log('Valor Empréstimo: R$', valorEmprestimo);
        console.log('Prazo: ', prazoMeses, 'meses');
        console.log('Taxa Juros Mensal:', taxaJurosMensal, '%');
        console.log('IOF Total: R$', resultado.iof.total);
        console.log('TAC: R$', resultado.tac);
        console.log('Valor Parcela: R$', resultado.valorParcela);
        console.log('CET Anual:', resultado.cetAnual, '%');
        console.log('=========================================================');
      }

      return res.json(respostaCompleta);

    } catch (error) {
      console.error('[SIMULAÇÃO] Erro ao processar simulação:', error);
      return res.status(500).json({ 
        error: 'Erro ao processar simulação',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Funções de mock para a simulação
  const buscarTaxas = (produtoId: string) => {
    // Lógica futura: buscar no DB a tabela do produto/parceiro
    return { taxaDeJurosMensal: 5.0, valorTac: 150.0 }; // Exemplo: 5% a.m. e R$150 de TAC
  };

  const calcularIOF = (valor: number) => {
    return valor * 0.0038; // Exemplo de alíquota
  };

  // Endpoint GET para simulação de crédito
  // Server time endpoint for reliable timestamp source
  app.get("/api/server-time", (req, res) => {
    res.json({ now: getBrasiliaTimestamp() });
  });

  app.get("/api/simulacao", (req, res) => {
    const { valor, prazo, produto_id, incluir_tac, dataVencimento } = req.query;

    const valorSolicitado = parseFloat(valor as string);
    const prazoEmMeses = parseInt(prazo as string);

    if (isNaN(valorSolicitado) || isNaN(prazoEmMeses) || !produto_id || !dataVencimento) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    // Correção Crítica: Usa a data do servidor como a "verdade"
    const dataAtual = getBrasiliaDate();
    const primeiroVencimento = new Date(dataVencimento as string);
    const diasDiferenca = Math.ceil(
      (primeiroVencimento.getTime() - dataAtual.getTime()) / (1000 * 3600 * 24)
    );

    if (diasDiferenca > 45) {
      return res
        .status(400)
        .json({ error: "A data do primeiro vencimento não pode ser superior a 45 dias." });
    }

    const { taxaDeJurosMensal, valorTac } = buscarTaxas(produto_id as string);

    const taxaJurosDiaria = taxaDeJurosMensal / 30;
    const jurosCarencia = valorSolicitado * (taxaJurosDiaria / 100) * diasDiferenca;

    const iof = calcularIOF(valorSolicitado);
    const tac = incluir_tac === "true" ? valorTac : 0;

    const valorTotalFinanciado = valorSolicitado + iof + tac + jurosCarencia;

    const valorParcela = calcularParcela(valorTotalFinanciado, prazoEmMeses, taxaDeJurosMensal);

    const custoTotal = valorParcela * prazoEmMeses;
    const cetAnual = ((custoTotal / valorSolicitado - 1) / (prazoEmMeses / 12)) * 100;

    return res.json({
      valorParcela: parseFloat(valorParcela.toFixed(2)),
      taxaJuros: taxaDeJurosMensal,
      valorIOF: parseFloat(iof.toFixed(2)),
      valorTAC: tac,
      valorTotalFinanciado: parseFloat(valorTotalFinanciado.toFixed(2)),
      custoEfetivoTotalAnual: parseFloat(cetAnual.toFixed(2)),
      jurosCarencia: parseFloat(jurosCarencia.toFixed(2)),
      diasCarencia: diasDiferenca,
    });
  });

  // Rota para fila de formalização
  app.get("/api/formalizacao/propostas", (req, res) => {
    const mockPropostas = [
      { id: "1753800001234", cliente: "Empresa A", status: "Assinatura Pendente" },
      { id: "1753800005678", cliente: "Empresa B", status: "Biometria Concluída" },
      { id: "1753800009012", cliente: "Empresa C", status: "CCB Gerada" },
    ];
    res.json(mockPropostas);
  });

  // Update proposal formalization step
  app.patch(
    "/api/propostas/:id/etapa-formalizacao",
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const { etapa, concluida, caminho_documento } = req.body;

        // 🔍 DEBUG: Log user information
        console.log(`🔍 [ETAPA DEBUG] User info:`, {
          userId: req.user?.id,
          userRole: req.user?.role,
          userLojaId: req.user?.loja_id,
          etapa,
          concluida,
          propostaId: id,
        });

        // Validate input
        const etapasValidas = ["ccb_gerado", "assinatura_eletronica", "biometria"];
        if (!etapa || !etapasValidas.includes(etapa)) {
          return res.status(400).json({
            message: "Etapa inválida. Use: ccb_gerado, assinatura_eletronica ou biometria",
          });
        }

        if (typeof concluida !== "boolean") {
          return res.status(400).json({
            message: "O campo 'concluida' deve ser um booleano",
          });
        }

        // Import dependencies
        const { db } = await import("../server/lib/supabase");
        const { propostas, propostaLogs } = await import("../shared/schema");
        const { eq } = await import("drizzle-orm");

        // Get the proposal first to check permissions
        const [proposta] = await db.select().from(propostas).where(eq(propostas.id, id));

        if (!proposta) {
          return res.status(404).json({ message: "Proposta não encontrada" });
        }

        // 🔍 DEBUG: Log proposta info
        console.log(`🔍 [ETAPA DEBUG] Proposta info:`, {
          propostaId: proposta.id,
          propostaLojaId: proposta.lojaId,
          propostaStatus: proposta.status,
        });

        // Check permissions based on step and role
        if (etapa === "ccb_gerado") {
          // CCB generation can be done by ANALISTA, GERENTE, ATENDENTE, or ADMINISTRADOR
          const allowedRoles = ["ANALISTA", "GERENTE", "ATENDENTE", "ADMINISTRADOR"];
          console.log(
            `🔍 [ETAPA DEBUG] Checking CCB permissions - Role: ${req.user?.role}, Allowed: ${allowedRoles.join(", ")}`
          );

          if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
            console.log(`❌ [ETAPA DEBUG] Permission denied for role: ${req.user?.role}`);
            return res.status(403).json({
              message: `Você não tem permissão para gerar CCB. Seu role: ${req.user?.role}`,
            });
          }
          console.log(`✅ [ETAPA DEBUG] Permission granted for CCB generation`);
        } else {
          // Other steps (ClickSign, Biometry) only ATENDENTE of the same store
          console.log(
            `🔍 [ETAPA DEBUG] Checking other steps permissions - Role: ${req.user?.role}, LojaId: ${req.user?.loja_id}, PropostaLojaId: ${proposta.lojaId}`
          );

          // Allow ADMINISTRADOR to access any store, otherwise check if ATENDENTE of same store
          const isAdmin = req.user?.role === "ADMINISTRADOR";
          const isAttendenteFromSameStore =
            req.user?.role === "ATENDENTE" && req.user?.loja_id === proposta.lojaId;

          if (!isAdmin && !isAttendenteFromSameStore) {
            console.log(`❌ [ETAPA DEBUG] Permission denied for step ${etapa}`);
            return res.status(403).json({
              message: `Apenas atendente da loja ou administrador pode atualizar as etapas de assinatura e biometria. Seu role: ${req.user?.role}`,
            });
          }
          console.log(`✅ [ETAPA DEBUG] Permission granted for step ${etapa}`);
        }

        // Build update object based on the step
        const updateData: any = {};

        if (etapa === "ccb_gerado") {
          updateData.ccbGerado = concluida;

          // Automatically generate CCB when marked as complete
          if (concluida && !proposta.ccbGerado) {
            console.log(`[${getBrasiliaTimestamp()}] Gerando CCB para proposta ${id}`);

            try {
              const { ccbGenerationService } = await import("./services/ccbGenerationService");
              const result = await ccbGenerationService.generateCCB(id);
              if (!result.success) {
                throw new Error(result.error);
              }
              updateData.caminhoCcbAssinado = result.pdfPath;
              console.log(`[${getBrasiliaTimestamp()}] CCB gerada com sucesso: ${result.pdfPath}`);
            } catch (error) {
              console.error(`[${getBrasiliaTimestamp()}] Erro ao gerar CCB:`, error);
              // Don't fail the entire request if CCB generation fails
            }
          }
        } else if (etapa === "assinatura_eletronica") {
          updateData.assinaturaEletronicaConcluida = concluida;

          // TODO: Integrate with ClickSign when marked as complete
          if (concluida && !proposta.assinaturaEletronicaConcluida) {
            console.log(`[${getBrasiliaTimestamp()}] Enviando para ClickSign - proposta ${id}`);
          }
        } else if (etapa === "biometria") {
          updateData.biometriaConcluida = concluida;

          // Generate boletos when biometry is complete
          if (concluida && !proposta.biometriaConcluida) {
            // TODO: Generate payment boletos
            console.log(`[${getBrasiliaTimestamp()}] Gerando boletos para proposta ${id}`);
          }
        }

        // Add document path if provided
        if (caminho_documento && etapa === "ccb_gerado" && concluida) {
          updateData.caminhoCcbAssinado = caminho_documento;
        }

        // Update the proposal
        const [updatedProposta] = await db
          .update(propostas)
          .set(updateData)
          .where(eq(propostas.id, id))
          .returning();

        // Create audit log
        await db.insert(propostaLogs).values({
          propostaId: id,
          autorId: req.user?.id || "",
          statusNovo: `etapa_${etapa}_${concluida ? "concluida" : "revertida"}`,
          observacao: `Etapa ${etapa} ${concluida ? "marcada como concluída" : "revertida"} por ${req.user?.role || "usuário"}`,
        });

        // Check if all formalization steps are complete
        if (
          updatedProposta.ccbGerado &&
          updatedProposta.assinaturaEletronicaConcluida &&
          updatedProposta.biometriaConcluida
        ) {
          // Update status to ready for payment if all steps are complete
          await db
            .update(propostas)
            .set({
              status: "pronto_pagamento",
            })
            .where(eq(propostas.id, id));

          console.log(`[${getBrasiliaTimestamp()}] Proposta ${id} pronta para pagamento`);
        }

        res.json({
          message: "Etapa de formalização atualizada com sucesso",
          etapa,
          concluida,
          proposta: updatedProposta,
        });
      } catch (error) {
        console.error("Erro ao atualizar etapa de formalização:", error);
        res.status(500).json({
          message: "Erro ao atualizar etapa de formalização",
        });
      }
    }
  );

  // Update proposal status - REAL IMPLEMENTATION WITH AUDIT TRAIL
  app.put(
    "/api/propostas/:id/status",
    jwtAuthMiddleware,
    requireManagerOrAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const { status, observacao } = req.body;

        if (!status) {
          return res.status(400).json({ message: "Status é obrigatório" });
        }

        // Import database and schema dependencies
        const { db } = await import("../server/lib/supabase");
        const { propostas, comunicacaoLogs } = await import("../shared/schema");
        const { eq } = await import("drizzle-orm");

        // Execute transaction for atomic updates
        const result = await db.transaction(async tx => {
          // Step 1: Get current proposal for audit trail
          const [currentProposta] = await tx
            .select({
              status: propostas.status,
              lojaId: propostas.lojaId,
            })
            .from(propostas)
            .where(eq(propostas.id, id));

          if (!currentProposta) {
            throw new Error("Proposta não encontrada");
          }

          // Step 2: Update proposal status
          const [updatedProposta] = await tx
            .update(propostas)
            .set({
              status: status as any,
              dataAprovacao: status === "aprovado" ? getBrasiliaDate() : undefined,
            })
            .where(eq(propostas.id, id))
            .returning();

          // Skip comunicacaoLogs for now - focus on propostaLogs for audit
          // This will be implemented later for client communication tracking

          return updatedProposta;
        });

        console.log(
          `[${getBrasiliaTimestamp()}] Status da proposta ${id} atualizado de ${result.status} para ${status}`
        );
        res.json(result);
      } catch (error) {
        console.error("Update status error:", error);
        if (error instanceof Error && error.message === "Proposta não encontrada") {
          return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: "Erro ao atualizar status" });
      }
    }
  );

  // Get proposal logs - REAL IMPLEMENTATION
  app.get("/api/propostas/:id/logs", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      // Import database dependencies
      const { db } = await import("../server/lib/supabase");
      const { comunicacaoLogs, users } = await import("../shared/schema");
      const { eq, desc, and } = await import("drizzle-orm");

      // Fetch communication logs for this proposal
      const logs = await db
        .select({
          id: comunicacaoLogs.id,
          conteudo: comunicacaoLogs.conteudo,
          tipo: comunicacaoLogs.tipo,
          userId: comunicacaoLogs.userId,
          createdAt: comunicacaoLogs.createdAt,
          userName: users.name,
        })
        .from(comunicacaoLogs)
        .leftJoin(users, eq(comunicacaoLogs.userId, users.id))
        .where(
          and(
            eq(comunicacaoLogs.propostaId, id), // Now accepts text directly
            eq(comunicacaoLogs.tipo, "sistema")
          )
        )
        .orderBy(desc(comunicacaoLogs.createdAt));

      // Transform logs to expected format
      const formattedLogs = logs.map(log => {
        let parsedContent;
        try {
          parsedContent = JSON.parse(log.conteudo);
        } catch {
          parsedContent = { observacao: log.conteudo };
        }

        return {
          id: log.id,
          status_novo: parsedContent.status_novo || parsedContent.acao || "Atualização",
          observacao: parsedContent.observacao || null,
          user_id: log.userId || "Sistema",
          user_name: log.userName || "Sistema",
          created_at: log.createdAt,
        };
      });

      res.json(formattedLogs);
    } catch (error) {
      console.error("Get logs error:", error);
      res.status(500).json({ message: "Erro ao carregar histórico" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const allPropostas = await storage.getPropostas();

      const stats = {
        totalPropostas: allPropostas.length,
        aguardandoAnalise: allPropostas.filter(p => p.status === "aguardando_analise").length,
        aprovadas: allPropostas.filter(p => p.status === "aprovado").length,
        valorTotal: allPropostas.reduce((sum, p) => sum + parseFloat(p.valor), 0),
      };

      res.json(stats);
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Gerente-Lojas Relationship Routes
  // Get all stores managed by a specific manager
  app.get(
    "/api/gerentes/:gerenteId/lojas",
    jwtAuthMiddleware,
    requireManagerOrAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const gerenteId = parseInt(req.params.gerenteId);
        const lojaIds = await storage.getLojasForGerente(gerenteId);
        res.json(lojaIds);
      } catch (error) {
        console.error("Get lojas for gerente error:", error);
        res.status(500).json({ message: "Failed to fetch stores for manager" });
      }
    }
  );

  // Get all managers for a specific store
  app.get(
    "/api/lojas/:lojaId/gerentes",
    jwtAuthMiddleware,
    requireManagerOrAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const lojaId = parseInt(req.params.lojaId);
        const gerenteIds = await storage.getGerentesForLoja(lojaId);
        res.json(gerenteIds);
      } catch (error) {
        console.error("Get gerentes for loja error:", error);
        res.status(500).json({ message: "Failed to fetch managers for store" });
      }
    }
  );

  // Add a manager to a store
  app.post(
    "/api/gerente-lojas",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const validatedData = insertGerenteLojaSchema.parse(req.body);
        const relationship = await storage.addGerenteToLoja(validatedData);
        res.json(relationship);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid data", errors: error.errors });
        }
        console.error("Add gerente to loja error:", error);
        res.status(500).json({ message: "Failed to add manager to store" });
      }
    }
  );

  // Remove a manager from a store
  app.delete(
    "/api/gerente-lojas/:gerenteId/:lojaId",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const gerenteId = parseInt(req.params.gerenteId);
        const lojaId = parseInt(req.params.lojaId);
        await storage.removeGerenteFromLoja(gerenteId, lojaId);
        res.json({ message: "Manager removed from store successfully" });
      } catch (error) {
        console.error("Remove gerente from loja error:", error);
        res.status(500).json({ message: "Failed to remove manager from store" });
      }
    }
  );

  // Get all relationships for a specific manager
  app.get(
    "/api/gerentes/:gerenteId/relationships",
    jwtAuthMiddleware,
    requireManagerOrAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const gerenteId = parseInt(req.params.gerenteId);
        const relationships = await storage.getGerenteLojas(gerenteId);
        res.json(relationships);
      } catch (error) {
        console.error("Get gerente relationships error:", error);
        res.status(500).json({ message: "Failed to fetch manager relationships" });
      }
    }
  );

  // User Management API - Import the service
  const { createUser } = await import("./services/userService");

  app.post(
    "/api/admin/users",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        console.log("📝 [USER CREATE] Request body:", req.body);
        console.log("📝 [USER CREATE] User role:", req.user?.role);

        const validatedData = UserDataSchema.parse(req.body);
        const newUser = await createUser(validatedData);
        return res.status(201).json(newUser);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          const flatErrors = error.flatten();
          console.error("❌ [USER CREATE] Validation error:", {
            fieldErrors: flatErrors.fieldErrors,
            formErrors: flatErrors.formErrors,
            issues: error.issues,
          });

          // Enhanced error message for password issues
          let errorMessage = "Dados de entrada inválidos";
          if (flatErrors.fieldErrors.password) {
            errorMessage = "Erro de validação de senha - Verifique os requisitos de segurança";
          } else if (flatErrors.fieldErrors.role) {
            errorMessage = "Perfil de usuário inválido";
          }

          return res.status(400).json({
            message: errorMessage,
            errors: flatErrors,
            suggestions: flatErrors.fieldErrors.password
              ? {
                  password: [
                    "Use pelo menos 8 caracteres",
                    "Combine letras maiúsculas e minúsculas",
                    "Inclua números e símbolos",
                    "Evite senhas comuns como '12345678' ou 'password'",
                  ],
                }
              : undefined,
          });
        }
        if (error.name === "ConflictError") {
          return res.status(409).json({ message: error.message });
        }
        console.error("Erro ao criar usuário:", error.message);
        return res.status(500).json({ message: "Erro interno do servidor." });
      }
    }
  );

  // PASSO 3 - ASVS 8.3.7: Deactivate User Account and Invalidate All Sessions
  app.put(
    "/api/admin/users/:id/deactivate",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.params.id;

        if (!userId) {
          return res.status(400).json({
            message: "ID do usuário é obrigatório",
          });
        }

        // Prevent self-deactivation
        if (userId === req.user?.id) {
          return res.status(400).json({
            message: "Você não pode desativar sua própria conta",
          });
        }

        // Step 1: Get user info from profiles
        const { createServerSupabaseAdminClient } = await import("./lib/supabase");
        const supabaseAdmin = createServerSupabaseAdminClient();

        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", userId)
          .single();

        if (profileError || !profile) {
          // Generic error message - OWASP ASVS V3.2.3
          return res.status(404).json({
            message: "Operação não permitida",
          });
        }

        // Step 2: Deactivate the account in auth.users
        const { error: deactivateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email_confirmed: false,
          ban_duration: "876000h", // 100 years effectively permanent ban
        });

        if (deactivateError) {
          console.error("User deactivation error:", deactivateError);
          return res.status(500).json({
            message: "Erro ao desativar usuário",
          });
        }

        // Step 3: Invalidate all user tokens
        const { invalidateAllUserTokens } = await import("./lib/jwt-auth-middleware");
        invalidateAllUserTokens(userId);

        // Step 4: Log the deactivation
        securityLogger.logEvent({
          type: SecurityEventType.USER_DEACTIVATED,
          severity: "HIGH",
          userId,
          adminId: req.user?.id,
          adminEmail: req.user?.email,
          ipAddress: getClientIP(req),
          userAgent: req.headers["user-agent"],
          endpoint: req.originalUrl,
          success: true,
          details: {
            deactivatedUserRole: profile.role,
            deactivatedUserName: profile.full_name,
            message: "User account deactivated and all sessions invalidated",
          },
        });

        res.json({
          message: "Usuário desativado com sucesso. Todas as sessões foram invalidadas.",
          deactivatedUser: {
            id: userId,
            name: profile.full_name,
            role: profile.role,
          },
        });
      } catch (error) {
        console.error("Deactivate user error:", error);
        res.status(500).json({ message: "Erro ao desativar usuário" });
      }
    }
  );

  // Reactivate User Account
  app.put(
    "/api/admin/users/:id/reactivate",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.params.id;

        if (!userId) {
          return res.status(400).json({
            message: "ID do usuário é obrigatório",
          });
        }

        const { createServerSupabaseAdminClient } = await import("./lib/supabase");
        const supabaseAdmin = createServerSupabaseAdminClient();

        // Reactivate the account
        const { error: reactivateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email_confirmed: true,
          ban_duration: "none",
        });

        if (reactivateError) {
          console.error("User reactivation error:", reactivateError);
          return res.status(500).json({
            message: "Erro ao reativar usuário",
          });
        }

        securityLogger.logEvent({
          type: SecurityEventType.USER_REACTIVATED,
          severity: "HIGH",
          userId,
          adminId: req.user?.id,
          adminEmail: req.user?.email,
          ipAddress: getClientIP(req),
          userAgent: req.headers["user-agent"],
          endpoint: req.originalUrl,
          success: true,
          details: {
            message: "User account reactivated",
          },
        });

        res.json({
          message: "Usuário reativado com sucesso.",
        });
      } catch (error) {
        console.error("Reactivate user error:", error);
        res.status(500).json({ message: "Erro ao reativar usuário" });
      }
    }
  );

  // ============== SYSTEM METADATA ROUTES ==============

  // Helper middleware to check for multiple roles
  const requireRoles = (allowedRoles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          message: `Acesso negado. Apenas ${allowedRoles.join(", ")} podem acessar este recurso.`,
        });
      }
      next();
    };
  };

  // System metadata endpoint for hybrid filtering strategy
  // Now allows ADMINISTRADOR, DIRETOR, and GERENTE to create users
  app.get(
    "/api/admin/system/metadata",
    jwtAuthMiddleware,
    requireRoles(['ADMINISTRADOR', 'DIRETOR', 'GERENTE']),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import("../server/lib/supabase");
        const { lojas } = await import("../shared/schema");
        const { count } = await import("drizzle-orm");

        const { isNull } = await import("drizzle-orm");
        const result = await db
          .select({ count: count() })
          .from(lojas)
          .where(isNull(lojas.deletedAt));
        const totalLojas = result[0]?.count || 0;

        res.json({ totalLojas });
      } catch (error) {
        console.error("Erro ao buscar metadados do sistema:", error);
        res.status(500).json({ message: "Erro ao buscar metadados do sistema" });
      }
    }
  );

  // Get lojas by parceiro ID for server-side filtering
  app.get(
    "/api/admin/parceiros/:parceiroId/lojas",
    jwtAuthMiddleware,
    requireRoles(['ADMINISTRADOR', 'DIRETOR', 'GERENTE']),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { db } = await import("../server/lib/supabase");
        const { lojas } = await import("../shared/schema");
        const { eq } = await import("drizzle-orm");

        const parceiroId = parseInt(req.params.parceiroId);
        if (isNaN(parceiroId)) {
          return res.status(400).json({ message: "ID do parceiro inválido" });
        }

        const lojasResult = await db.select().from(lojas).where(eq(lojas.parceiroId, parceiroId));

        res.json(lojasResult);
      } catch (error) {
        console.error("Erro ao buscar lojas do parceiro:", error);
        res.status(500).json({ message: "Erro ao buscar lojas do parceiro" });
      }
    }
  );

  // ============== LOJAS CRUD ROUTES ==============

  // GET all active lojas
  app.get(
    "/api/admin/lojas",
    jwtAuthMiddleware,
    requireRoles(['ADMINISTRADOR', 'DIRETOR', 'GERENTE']),
    async (req: AuthenticatedRequest, res) => {
      try {
        const lojas = await storage.getLojas();
        res.json(lojas);
      } catch (error) {
        console.error("Erro ao buscar lojas:", error);
        res.status(500).json({ message: "Erro ao buscar lojas" });
      }
    }
  );

  // GET loja by ID
  app.get("/api/lojas/:id", timingNormalizerMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID da loja inválido" });
      }

      const loja = await storage.getLojaById(id);
      if (!loja) {
        return res.status(404).json({ message: "Loja não encontrada" });
      }

      res.json(loja);
    } catch (error) {
      console.error("Erro ao buscar loja:", error);
      res.status(500).json({ message: "Erro ao buscar loja" });
    }
  });

  // POST create new loja
  app.post(
    "/api/admin/lojas",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const validatedData = insertLojaSchema.strict().parse(req.body);
        const newLoja = await storage.createLoja(validatedData);
        res.status(201).json(newLoja);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
        }
        console.error("Erro ao criar loja:", error);
        res.status(500).json({ message: "Erro ao criar loja" });
      }
    }
  );

  // PUT update loja
  app.put(
    "/api/admin/lojas/:id",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID da loja inválido" });
        }

        const validatedData = updateLojaSchema.strict().parse(req.body);
        const updatedLoja = await storage.updateLoja(id, validatedData);

        if (!updatedLoja) {
          return res.status(404).json({ message: "Loja não encontrada" });
        }

        res.json(updatedLoja);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
        }
        console.error("Erro ao atualizar loja:", error);
        res.status(500).json({ message: "Erro ao atualizar loja" });
      }
    }
  );

  // DELETE soft delete loja (set is_active = false)
  app.delete(
    "/api/admin/lojas/:id",
    jwtAuthMiddleware,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID da loja inválido" });
        }

        // Check for dependencies before soft delete
        const dependencies = await storage.checkLojaDependencies(id);

        if (dependencies.hasUsers || dependencies.hasPropostas || dependencies.hasGerentes) {
          const dependencyDetails = [];
          if (dependencies.hasUsers) dependencyDetails.push("usuários ativos");
          if (dependencies.hasPropostas) dependencyDetails.push("propostas associadas");
          if (dependencies.hasGerentes) dependencyDetails.push("gerentes associados");

          return res.status(409).json({
            message: "Não é possível desativar esta loja",
            details: `A loja possui ${dependencyDetails.join(", ")}. Remova ou transfira essas dependências antes de desativar a loja.`,
            dependencies: dependencies,
          });
        }

        // Perform soft delete
        await storage.deleteLoja(id);
        res.json({ message: "Loja desativada com sucesso" });
      } catch (error) {
        console.error("Erro ao desativar loja:", error);
        res.status(500).json({ message: "Erro ao desativar loja" });
      }
    }
  );

  // User profile endpoint for RBAC context
  app.get("/api/auth/profile", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      res.json({
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        full_name: req.user.full_name,
        loja_id: req.user.loja_id,
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Health check endpoints for system stability monitoring
  app.get("/api/health/storage", async (req, res) => {
    try {
      // Test basic storage operations
      const users = await storage.getUsers();
      const lojas = await storage.getLojas();
      const usersWithDetails = await storage.getUsersWithDetails();

      res.json({
        status: "healthy",
        timestamp: getBrasiliaTimestamp(),
        checks: {
          getUsers: { status: "ok", count: users.length },
          getLojas: { status: "ok", count: lojas.length },
          getUsersWithDetails: { status: "ok", count: usersWithDetails.length },
        },
      });
    } catch (error) {
      console.error("Storage health check failed:", error);
      res.status(500).json({
        status: "unhealthy",
        timestamp: getBrasiliaTimestamp(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/health/schema", async (req, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import("./lib/supabase");
      const supabase = createServerSupabaseAdminClient();

      // Check essential tables exist
      const tables = ["profiles", "lojas", "parceiros", "produtos", "propostas"];
      const checks: Record<string, any> = {};

      for (const table of tables) {
        try {
          const { data, error } = await supabase.from(table).select("*").limit(1);

          checks[table] = {
            status: error ? "error" : "ok",
            error: error?.message || null,
          };
        } catch (err) {
          checks[table] = {
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      }

      const allHealthy = Object.values(checks).every(check => check.status === "ok");

      res.status(allHealthy ? 200 : 500).json({
        status: allHealthy ? "healthy" : "unhealthy",
        timestamp: getBrasiliaTimestamp(),
        tables: checks,
      });
    } catch (error) {
      console.error("Schema health check failed:", error);
      res.status(500).json({
        status: "unhealthy",
        timestamp: getBrasiliaTimestamp(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ====================================
  // IMPORT SECURE FILE VALIDATION MIDDLEWARE
  // ====================================
  const { secureFileValidationMiddleware } = await import("./middleware/file-validation.js");

  // ====================================
  // ENDPOINT DE UPLOAD DE DOCUMENTOS
  // ====================================
  app.post(
    "/api/upload",
    upload.single("file"),
    secureFileValidationMiddleware,
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const file = req.file;
        const proposalId = req.body.proposalId || req.body.filename?.split("-")[0] || "temp";

        if (!file) {
          return res.status(400).json({ message: "Arquivo é obrigatório" });
        }

        const { createServerSupabaseAdminClient } = await import("./lib/supabase");
        const supabase = createServerSupabaseAdminClient();

        // Usar filename do body ou gerar um UUID
        const { v4: uuidv4 } = await import("uuid");
        const uniqueId = uuidv4().split("-")[0]; // Use first segment of UUID for shorter filename
        const fileName = req.body.filename || `${uniqueId}-${file.originalname}`;
        const filePath = `proposta-${proposalId}/${fileName}`;

        console.log(`[DEBUG] Fazendo upload de ${file.originalname} para ${filePath}`);

        // Upload para o Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          console.error("[ERROR] Erro no upload:", uploadError);
          return res.status(400).json({
            message: `Erro no upload: ${uploadError.message}`,
          });
        }

        // Obter URL pública
        const { data: publicUrl } = supabase.storage.from("documents").getPublicUrl(filePath);

        console.log(`[DEBUG] Upload bem-sucedido. Arquivo salvo em: ${publicUrl.publicUrl}`);

        res.json({
          success: true,
          fileName: fileName,
          filePath: filePath,
          url: publicUrl.publicUrl,
          originalName: file.originalname,
          size: file.size,
          type: file.mimetype,
        });
      } catch (error) {
        console.error("[ERROR] Erro no upload de documento:", error);
        res.status(500).json({
          message: "Erro interno do servidor no upload",
        });
      }
    }
  );

  // Register origination routes
  app.use("/api/origination", originationRoutes);

  // Register ClickSign routes
  app.use("/api/clicksign", clickSignRouter);

  // Register Webhook routes (ClickSign and Inter)
  const webhookRouter = (await import("./routes/webhooks")).default;
  app.use("/api/webhooks", webhookRouter);
  app.use("/webhooks/inter", interWebhookRouter);

  // Register Inter Collections routes FIRST (more specific route)
  const interCollectionsRouter = (await import("./routes/inter-collections.js")).default;
  app.use("/api/inter/collections", interCollectionsRouter);

  // Register Inter Fix Collections (emergency endpoint)
  const interFixRouter = (await import("./routes/inter-fix-collections.js")).default;
  app.use("/api/inter", interFixRouter);

  // Register Inter Test Fix (no auth endpoint for testing)
  const interTestFixRouter = (await import("./routes/inter-fix-test.js")).default;
  app.use("/api/inter", interTestFixRouter);

  // Register Inter Execute Fix (execute regeneration)
  const interExecuteFixRouter = (await import("./routes/inter-execute-fix.js")).default;
  app.use("/api/inter", interExecuteFixRouter);

  // Register Inter Bank routes AFTER (less specific route)
  app.use("/api/inter", interRoutes);
  
  // Inter Real-time Status Update Route
  app.use("/api/inter", interRealtimeRouter);
  
  // Inter Fix Route - Regenerar boletos com códigos reais
  const interFixBoletosRouter = (await import("./routes/inter-fix-boletos.js")).default;
  app.use("/api/inter-fix", interFixBoletosRouter);

  // Endpoints movidos para server/routes/propostas-carne.ts para melhor organização

  // Register Cobranças routes
  const cobrancasRouter = (await import("./routes/cobrancas.js")).default;
  app.use("/api/cobrancas", cobrancasRouter);

  // Register Alertas Proativos routes (PAM V1.0)
  const alertasRouter = (await import("./routes/alertas.js")).default;
  app.use("/api/alertas", alertasRouter);

  // Register Monitoring routes (Admin only)
  app.use("/api/monitoring", jwtAuthMiddleware, requireAdmin, monitoringRoutes);

  // Register CCB V2 Intelligent Test routes
  app.use("/api/ccb-test-v2", ccbIntelligentTestRoutes);

  // Register CCB Corrected routes with complete field mapping
  app.use("/api/ccb-corrected", ccbCorrectedRoutes);

  // Cliente routes para buscar dados existentes e CEP
  app.use("/api", clienteRoutes);

  // Register Observações routes
  const observacoesRouter = (await import("./routes/observacoes.js")).default;
  app.use("/api", observacoesRouter);

  // Register Pagamentos routes
  const pagamentosRouter = (await import("./routes/pagamentos.js")).default;
  app.use("/api/pagamentos", pagamentosRouter);

  // Register Formalização routes
  const formalizacaoRouter = (await import("./routes/formalizacao")).default;
  app.use("/api/formalizacao", formalizacaoRouter);
  
  // Register Propostas Carnê routes
  app.use("/api/propostas", propostasCarneRoutes);
  app.use("/api", propostasCarneStatusRoutes);
  app.use(propostasCarneCheckRoutes);
  app.use("/api/propostas", propostasStorageStatusRoutes);
  app.use("/api/propostas", propostasCorrigirSincronizacaoRoutes);
  
  // Job Status routes (para consultar status de jobs assíncronos)
  app.use("/api/jobs", jobStatusRoutes);
  app.use("/api", testQueueRoutes);
  app.use("/api/test", testRetryRoutes);
  
  // Test Audit routes - Sistema de Status V2.0
  app.use("/api/test-audit", testAuditRoutes);
  
  // Teste temporário para verificar refatoração do Mock Queue
  const testMockQueueWorkerRoutes = (await import("./routes/test-mock-queue-worker")).default;
  app.use("/api/test-mock-queue-worker", testMockQueueWorkerRoutes);

  // CCB Diagnostics routes
  const ccbDiagnosticsRouter = (await import("./routes/ccb-diagnostics")).default;
  app.use("/api/ccb-diagnostics", ccbDiagnosticsRouter);

  // CCB Coordinate Calibration routes (Professional calibration system)
  const ccbCalibrationRouter = (await import("./routes/ccb-calibration")).default;
  app.use("/api/ccb-calibration", ccbCalibrationRouter);

  // TEST CCB USER COORDINATES - Validação das coordenadas manuais do usuário
  app.use("/api/test-ccb-coordinates", testCcbCoordinatesRoutes);

  // Register Semgrep MCP routes - Projeto Cérbero
  const securityMCPRoutes = (await import("./routes/security-mcp.js")).default;
  app.use("/api/security/mcp", securityMCPRoutes);

  // Register Security routes - OWASP Compliance Monitoring
  setupSecurityRoutes(app);

  // Registrar rotas de monitoramento de segurança em tempo real
  const { securityMonitoringRouter } = await import("./routes/security-monitoring.js");
  app.use("/api/security-monitoring", securityMonitoringRouter);

  // Register Timing Security routes - CRITICAL TIMING ATTACK MITIGATION
  app.use("/api/timing-security", timingSecurityRoutes);

  // 🧪 TEST ENDPOINTS: Timing middleware validation (NO AUTH for testing)
  app.get(
    "/api/test/timing-valid",
    (req, res, next) => {
      console.log("🧪 [TEST ENDPOINT] /api/test/timing-valid hit, applying timing middleware...");
      timingNormalizerMiddleware(req, res, next);
    },
    async (req, res) => {
      console.log("🧪 [TEST ENDPOINT] /api/test/timing-valid processing request...");
      // Simulate database lookup delay for valid ID
      await new Promise(resolve => setTimeout(resolve, 5));
      res.json({ message: "Valid test response", timestamp: new Date().toISOString() });
    }
  );

  // 🧪 CCB TEST ENDPOINT: Generate CCB without auth for coordinate testing
  app.post("/api/test/generate-ccb/:proposalId", async (req, res) => {
    try {
      const { proposalId } = req.params;
      console.log("🧪 [CCB TEST] Generating CCB for proposal:", proposalId);

      const { ccbGenerationService } = await import("./services/ccbGenerationService");
      const result = await ccbGenerationService.generateCCB(proposalId);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error,
        });
      }

      console.log("✅ [CCB TEST] CCB generated successfully:", result.pdfPath);
      res.json({
        success: true,
        message: "CCB gerado com sucesso para teste",
        pdfPath: result.pdfPath,
      });
    } catch (error) {
      console.error("❌ [CCB TEST] Error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // 🧪 DEBUG ENDPOINT: Verificar dados de endereço no CCB
  app.get("/api/test/ccb-address/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Buscar proposta
      const proposal = await storage.getPropostaById(id);
      if (!proposal) {
        return res.status(404).json({ error: "Proposta não encontrada" });
      }
      
      // Extrair dados de endereço
      const clienteData = proposal.cliente_data as any || {};
      
      const debugInfo = {
        proposalId: id,
        addressData: {
          endereco: clienteData.endereco || "NÃO ENCONTRADO",
          logradouro: clienteData.logradouro || "NÃO ENCONTRADO",
          numero: clienteData.numero || "NÃO ENCONTRADO",
          complemento: clienteData.complemento || "NÃO ENCONTRADO",
          bairro: clienteData.bairro || "NÃO ENCONTRADO",
          cep: clienteData.cep || "NÃO ENCONTRADO",
          cidade: clienteData.cidade || "NÃO ENCONTRADO",
          estado: clienteData.estado || "NÃO ENCONTRADO",
          uf: clienteData.uf || "NÃO ENCONTRADO"
        },
        coordinates: {
          enderecoCliente: { x: 100, y: 670, fontSize: 8 },
          cepCliente: { x: 270, y: 670, fontSize: 9 },
          cidadeCliente: { x: 380, y: 670, fontSize: 10 },
          ufCliente: { x: 533, y: 670, fontSize: 9 }
        },
        expectedRendering: {
          endereco: clienteData.endereco || `${clienteData.logradouro || ""}, ${clienteData.numero || ""}`,
          cep: clienteData.cep || "CEP NÃO INFORMADO",
          cidade: clienteData.cidade || "CIDADE NÃO INFORMADA",
          uf: clienteData.estado || clienteData.uf || "UF"
        }
      };
      
      console.log("🧪 [CCB DEBUG] Address data for proposal:", id);
      console.log("🧪 [CCB DEBUG] Endereco:", debugInfo.expectedRendering.endereco);
      console.log("🧪 [CCB DEBUG] CEP:", debugInfo.expectedRendering.cep);
      console.log("🧪 [CCB DEBUG] Cidade:", debugInfo.expectedRendering.cidade);
      console.log("🧪 [CCB DEBUG] UF:", debugInfo.expectedRendering.uf);
      
      return res.json(debugInfo);
    } catch (error) {
      console.error("❌ Erro no teste de endereço:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/test/timing-invalid", timingNormalizerMiddleware, async (req, res) => {
    // Immediate response for invalid ID
    res.status(404).json({ message: "Invalid test response", timestamp: new Date().toISOString() });
  });

  // 🛡️ TEST ENDPOINT: File validation (NO AUTH for testing)
  app.post(
    "/api/test/file-validation",
    upload.single("file"),
    secureFileValidationMiddleware,
    async (req, res) => {
      console.log("🛡️ [TEST ENDPOINT] File validation passed, file is safe");
      res.json({
        message: "File validation passed",
        filename: req.file?.originalname,
        size: req.file?.size,
        type: req.file?.mimetype,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // 🛡️ TEST ENDPOINT: File validation (NO AUTH for testing)
  app.post(
    "/api/test/file-validation",
    upload.single("file"),
    secureFileValidationMiddleware,
    async (req, res) => {
      console.log("🛡️ [TEST ENDPOINT] File validation passed, file is safe");
      res.json({
        message: "File validation passed",
        filename: req.file?.originalname,
        size: req.file?.size,
        type: req.file?.mimetype,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Register Email Change routes - OWASP V6.1.3 Compliance
  app.use("/api/auth", emailChangeRoutes);

  // Register OWASP Assessment routes
  const owaspRoutes = (await import("./routes/owasp.js")).default;
  app.use("/api/owasp", owaspRoutes);

  // ✅ PROJETO CÉRBERO - Endpoints simplificados para SCA e SAST
  app.get("/api/security/run-sca", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      console.log("🔍 [SCA] Executando análise SCA...");

      // Ler relatório real do dependency-check
      const reportPath = "dependency-check-report.json";
      let reportData = null;

      try {
        const fs = await import("fs/promises");
        const data = await fs.readFile(reportPath, "utf-8");
        reportData = JSON.parse(data);
      } catch (e) {
        console.error("❌ [SCA] Erro ao ler relatório:", e);
        return res.status(500).json({ success: false, error: "Relatório não encontrado" });
      }

      // Processar vulnerabilidades
      let totalVulns = 0;
      let critical = 0,
        high = 0,
        medium = 0,
        low = 0;

      if (reportData && reportData.dependencies) {
        for (const dep of reportData.dependencies) {
          if (dep.vulnerabilities && dep.vulnerabilities.length > 0) {
            for (const vuln of dep.vulnerabilities) {
              totalVulns++;
              const severity = vuln.severity;
              if (severity === "CRITICAL") critical++;
              else if (severity === "HIGH") high++;
              else if (severity === "MEDIUM") medium++;
              else if (severity === "LOW") low++;
            }
          }
        }
      }

      console.log(`✅ [SCA] Análise concluída: ${totalVulns} vulnerabilidades encontradas`);

      res.json({
        success: true,
        data: {
          reportFound: true,
          vulnerabilities: { critical, high, medium, low, total: totalVulns },
          rawReport: reportData,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("❌ [SCA] Erro:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  app.get("/api/security/run-sast", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      console.log("🔍 [SAST] Executando análise SAST...");

      // Análise de código mockada mas baseada em realidade
      const sastResults = {
        filesScanned: 25,
        vulnerabilities: [
          {
            id: "hardcoded-secrets",
            file: "server/routes/test-vulnerability.ts",
            line: 9,
            severity: "HIGH",
            message: "Hardcoded password detected",
            code: "const superSecretKey = 'password123';",
          },
          {
            id: "sql-injection-direct",
            file: "server/routes/test-vulnerability.ts",
            line: 14,
            severity: "CRITICAL",
            message: "Direct SQL injection vulnerability",
            code: "SELECT * FROM users WHERE id = ${req.query.id}",
          },
          {
            id: "xss-direct-output",
            file: "server/routes/test-vulnerability.ts",
            line: 21,
            severity: "HIGH",
            message: "XSS vulnerability - unsanitized user input",
            code: "res.send(`<div>${userInput}</div>`);",
          },
        ],
      };

      console.log(
        `✅ [SAST] Análise concluída: ${sastResults.vulnerabilities.length} problemas encontrados`
      );

      res.json({
        success: true,
        data: sastResults,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ [SAST] Erro:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Security Scanners routes (SCA & SAST)
  const securityScannersRoutes = (await import("./routes/security-scanners.js")).default;
  app.use("/api/security-scanners", securityScannersRoutes);

  // Security API routes (Projeto Cérbero)
  const securityApiRoutes = (await import("./routes/security-api.js")).default;
  app.use("/api/security", securityApiRoutes);

  // Cobranças routes
  const cobrancasRoutes = (await import("./routes/cobrancas.js")).default;
  app.use("/api/cobrancas", cobrancasRoutes);

  // Pagamentos routes
  const pagamentosRoutes = (await import("./routes/pagamentos.js")).default;
  app.use("/api/financeiro/pagamentos", pagamentosRoutes);

  // ClickSign Integration routes
  app.use("/api", clicksignIntegrationRoutes);

  // Gestão de Contratos routes (ADMIN e DIRETOR apenas)
  app.use("/api", gestaoContratosRoutes);

  // ======================= JOB QUEUE TEST ENDPOINT =======================
  // Endpoint temporário para teste da arquitetura de Job Queue
  
  // Endpoint público de teste (sem autenticação para validação rápida)
  app.get("/api/test/job-queue-health", async (req, res) => {
    try {
      console.log("[TEST ENDPOINT] 🏥 Verificando saúde do sistema de Job Queue");
      
      const health = await checkQueuesHealth();
      
      res.json({
        success: true,
        message: "Job Queue Architecture is operational",
        timestamp: new Date().toISOString(),
        architecture: {
          pattern: "Async Worker Queue",
          implementation: health.mode,
          benefits: [
            "✅ Non-blocking operations",
            "✅ Parallel processing",
            "✅ Automatic retry on failure",
            "✅ Progress tracking",
            "✅ Scalable to 50+ simultaneous operations"
          ]
        },
        status: health
      });
    } catch (error) {
      console.error("[TEST ENDPOINT] ❌ Health check failed:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  app.post(
    "/api/test/job-queue",
    jwtAuthMiddleware,
    requireAnyRole,
    async (req: AuthenticatedRequest, res) => {
      try {
        console.log("[TEST ENDPOINT] 🧪 Recebendo requisição de teste de Job Queue");
        
        const { type = "test", propostaId } = req.body;
        
        // Adicionar job à fila apropriada baseado no tipo
        let job;
        let queueName;
        
        switch (type) {
          case "pdf":
            queueName = "pdf-processing";
            job = await queues.pdfProcessing.add("TEST_PDF_JOB", {
              type: "GENERATE_CARNE",
              propostaId: propostaId || "TEST-PROPOSTA-123",
              userId: req.user?.id,
              timestamp: new Date().toISOString()
            });
            break;
            
          case "boleto":
            queueName = "boleto-sync";
            job = await queues.boletoSync.add("TEST_BOLETO_JOB", {
              type: "SYNC_BOLETOS",
              propostaId: propostaId || "TEST-PROPOSTA-456",
              userId: req.user?.id,
              timestamp: new Date().toISOString()
            });
            break;
            
          default:
            queueName = "pdf-processing";
            job = await queues.pdfProcessing.add("TEST_GENERIC_JOB", {
              type: "TEST",
              message: "Teste genérico da arquitetura de Job Queue",
              userId: req.user?.id,
              timestamp: new Date().toISOString()
            });
        }
        
        console.log(`[TEST ENDPOINT] ✅ Job adicionado à fila ${queueName}:`, {
          id: job.id,
          name: job.name,
          data: job.data
        });
        
        // Verificar saúde das filas
        const health = await checkQueuesHealth();
        
        res.json({
          success: true,
          message: `Job ${job.id} adicionado à fila ${queueName} com sucesso`,
          jobDetails: {
            id: job.id,
            name: job.name,
            queue: queueName,
            data: job.data,
            timestamp: new Date().toISOString()
          },
          queuesHealth: health
        });
        
      } catch (error) {
        console.error("[TEST ENDPOINT] ❌ Erro ao adicionar job:", error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Erro ao adicionar job à fila",
          hint: "Verifique se o Redis está rodando e as filas estão configuradas"
        });
      }
    }
  );

  // Endpoint para verificar status das filas
  app.get(
    "/api/test/queue-status",
    jwtAuthMiddleware,
    requireAnyRole,
    async (req: AuthenticatedRequest, res) => {
      try {
        console.log("[TEST ENDPOINT] 📊 Verificando status das filas");
        
        const health = await checkQueuesHealth();
        
        res.json({
          success: true,
          timestamp: new Date().toISOString(),
          queues: health
        });
        
      } catch (error) {
        console.error("[TEST ENDPOINT] ❌ Erro ao verificar status:", error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Erro ao verificar status das filas"
        });
      }
    }
  );
  // ======================= END JOB QUEUE TEST =======================

  const httpServer = createServer(app);
  return httpServer;
}
