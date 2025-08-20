import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  jwtAuthMiddleware,
  AuthenticatedRequest,
} from "../../lib/jwt-auth-middleware.js";
// Role guards will be imported if needed later
import { securityLogger, SecurityEventType, getClientIP } from "../../lib/security-logger.js";
import { getBrasiliaTimestamp, getBrasiliaDate, generateApprovalDate } from "../../lib/timezone.js";
import { storage } from "../../storage.js";
import { timingNormalizerMiddleware } from "../../middleware/timing-normalizer.js";
import { createPropostaValidationSchema } from "../../../shared/schema.js";
import { randomUUID } from "crypto";
import { preApprovalService } from "../../services/preApprovalService.js";
import { transitionTo } from "../../services/statusFsmService.js";
import { TacCalculationService } from "../../services/tacCalculationService.js";

const router = Router();

// Helper function to parse user agent - duplicated to avoid circular dependency
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

// GET proposal audit logs for real-time communication history
router.get(
  "/:id/observacoes",
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const propostaId = req.params.id;

      const { createServerSupabaseAdminClient } = await import("../../lib/supabase.js");
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

// BUSCA POR CPF - Recupera dados de propostas anteriores do mesmo CPF
router.get("/buscar-por-cpf/:cpf", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { cpf } = req.params;
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    console.log(`🔍 [BUSCA CPF] Buscando propostas anteriores para CPF: ${cpfLimpo}`);
    
    if (cpfLimpo.length !== 11) {
      return res.status(400).json({ error: "CPF inválido" });
    }
    
    const { createServerSupabaseAdminClient } = await import("../../lib/supabase.js");
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
router.get("/", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
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
    const { db } = await import("../../lib/supabase.js");
    const { propostas, lojas, parceiros, statusContextuais } = await import("../../../shared/schema.js");
    const { inArray, desc, eq, and } = await import("drizzle-orm");

    // Build query with conditional where clause
    const baseQuery = db
      .select({
        id: propostas.id,
        numeroProposta: propostas.numeroProposta, // PAM V1.0 - Sequential number for UI
        status: propostas.status,
        // PAM V1.0 - Status contextual para dashboard
        statusContextual: statusContextuais.status,
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
      // PAM V1.0 - LEFT JOIN com status contextual
      .leftJoin(
        statusContextuais,
        and(
          eq(propostas.id, statusContextuais.propostaId),
          eq(statusContextuais.contexto, 'dashboard')
        )
      )
      .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
      .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id));

    // Build where conditions based on filters AND ROLE PERMISSIONS
    const whereConditions = [];

    // 🔒 FILTRO POR ROLE - SEGURANÇA CRÍTICA
    switch (userRole) {
      case "ATENDENTE":
        // ATENDENTE vê APENAS suas próprias propostas
        if (userId) {
          whereConditions.push(eq(propostas.userId, userId));
          console.log(`🔒 [SECURITY] ATENDENTE ${userId} - filtrando apenas propostas próprias`);
        }
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

// GET proposal communication logs  
router.get("/:id/logs", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Import database dependencies
    const { db } = await import("../../lib/supabase.js");
    const { comunicacaoLogs, users } = await import("../../../shared/schema.js");
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

// PUT /api/propostas/:id/status - ANALYST WORKFLOW ENGINE
router.put(
  "/:id/status",
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
      const { createServerSupabaseAdminClient } = await import("../../lib/supabase.js");
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
          const { ccbGenerationService } = await import("../../services/ccbGenerationService.js");
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

// PUT /api/propostas/:id - Update existing proposal
router.put("/:id", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { cliente_data, condicoes_data } = req.body;

    console.log(`🔍 [PUT /api/propostas/${id}] Salvando alterações:`, {
      cliente_data,
      condicoes_data,
    });

    const { createServerSupabaseAdminClient } = await import("../../lib/supabase.js");
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

// POST /api/propostas - Create new proposal
router.post("/", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
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

    // 🧠 INTEGRAÇÃO DO PRÉ-APPROVAL SERVICE (PAM V1.0 - Passo 2.2)
    // Executar análise automática de comprometimento de renda
    console.log("🔍 [PRE-APPROVAL] Iniciando análise automática de pré-aprovação");
    
    // Preparar dados para o serviço de pré-aprovação
    const proposalDataForPreApproval = {
      id: randomUUID(), // ID temporário para logging
      clienteRenda: dataWithId.clienteRenda,
      clienteDividasExistentes: dataWithId.clienteDividasExistentes,
      valor: dataWithId.valor,
      prazo: dataWithId.prazo,
      taxaJuros: dataWithId.taxaJuros || 2.5 // Taxa padrão se não informada
    };
    
    // Chamar o serviço de pré-aprovação
    const preApprovalResult = await preApprovalService.checkIncomeCommitment(proposalDataForPreApproval);
    
    // Determinar o status inicial baseado no resultado da pré-aprovação
    let statusInicial = "rascunho"; // Status padrão
    let observacaoInicial = "";
    
    // Lógica condicional clara para tratar cada resultado
    if (preApprovalResult.rejected === true) {
      // CASO 1: Rejeitado automaticamente por comprometimento de renda
      statusInicial = "rejeitado";
      observacaoInicial = preApprovalResult.reason || "Comprometimento de renda excede 25%";
      
      console.log(`❌ [PRE-APPROVAL] Proposta rejeitada automaticamente: ${observacaoInicial}`);
      
    } else if (preApprovalResult.pendingData === true) {
      // CASO 2: Dados financeiros incompletos - aguardando informações
      statusInicial = "pendente";
      observacaoInicial = preApprovalResult.reason || "Dados financeiros incompletos para análise automática";
      
      console.log(`⏳ [PRE-APPROVAL] Proposta pendente - dados incompletos: ${observacaoInicial}`);
      
    } else if (preApprovalResult.approved === true) {
      // CASO 3: Aprovado na pré-análise - continua fluxo normal
      statusInicial = "aguardando_analise"; // Vai para análise humana após pré-aprovação
      observacaoInicial = `Pré-aprovado: ${preApprovalResult.reason || 'Comprometimento de renda dentro do limite'}`;
      
      console.log(`✅ [PRE-APPROVAL] Proposta pré-aprovada: ${observacaoInicial}`);
      
    } else if (preApprovalResult.error === true) {
      // CASO 4: Erro no cálculo - fallback para análise manual
      statusInicial = "aguardando_analise";
      observacaoInicial = "Análise automática indisponível - encaminhado para análise manual";
      
      console.log(`⚠️ [PRE-APPROVAL] Erro na análise automática - fallback para análise manual`);
    }
    
    // Sobrescrever status se foi passado explicitamente (para compatibilidade com testes)
    if (dataWithId.status) {
      console.log(`🔄 [PRE-APPROVAL] Status sobrescrito de "${statusInicial}" para "${dataWithId.status}" (valor explícito)`);
      statusInicial = dataWithId.status;
    }

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
      // ⚡ UUID GENERATION - Generate unique ID for proposal
      id: randomUUID(),
      userId: dataWithId.userId,
      lojaId: dataWithId.lojaId,
      status: statusInicial, // Status determinado pelo pré-approval service

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
        valorTotalFinanciado: dataWithId.valorTotalFinanciado || dataWithId.valor, // ✅ PAM V1.0 FIX: Fallback para valor
      },
      
      // ⚡ PAM V1.0 CORREÇÃO CRÍTICA - VALOR TOTAL FINANCIADO
      // Mapeamento direto para campo dedicado no banco
      valorTotalFinanciado: dataWithId.valorTotalFinanciado || dataWithId.valor,

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

    // 💰 INTEGRAÇÃO TAC CALCULATION SERVICE (PAM V1.0 - FASE 1)
    // Calcular TAC dinamicamente baseado no produto e status do cliente
    console.log("💰 [TAC] Iniciando cálculo dinâmico de TAC para nova proposta");
    
    let tacCalculada = 0;
    try {
      // Verificar se temos os dados necessários para calcular TAC
      if (dataForDatabase.produtoId && dataForDatabase.clienteCpf && dataForDatabase.condicoesData.valor) {
        tacCalculada = await TacCalculationService.calculateTac(
          dataForDatabase.produtoId,
          dataForDatabase.condicoesData.valor,
          dataForDatabase.clienteCpf
        );
        
        console.log(`💰 [TAC] TAC calculada: R$ ${tacCalculada.toFixed(2)}`);
        
        // Sobrescrever o valor de TAC com o calculado pelo serviço
        dataForDatabase.condicoesData.valorTac = tacCalculada;
        
        // Também atualizar o campo valor_tac direto na proposta (se existir)
        (dataForDatabase as any).valor_tac = tacCalculada;
        
        console.log(`✅ [TAC] Valor de TAC sobrescrito com sucesso na proposta`);
      } else {
        console.warn(`⚠️ [TAC] Dados insuficientes para calcular TAC - usando valor padrão`);
      }
    } catch (tacError) {
      console.error(`❌ [TAC] Erro ao calcular TAC - mantendo valor original:`, tacError);
      // Em caso de erro, manter o valor de TAC que veio do frontend ou usar 0
      tacCalculada = dataForDatabase.condicoesData.valorTac || 0;
    }

    // Create the proposal
    const proposta = await storage.createProposta(dataForDatabase);
    
    // DEBUG: Log proposta criada
    console.log("🔍 [NOVA PROPOSTA] Proposta criada com ID:", proposta.id);
    console.log("🔍 [NOVA PROPOSTA] clienteData salvo:", proposta.clienteData);
    
    // 🔄 ORQUESTRAÇÃO FSM - Registrar transição inicial se necessário
    if (observacaoInicial && statusInicial !== "rascunho") {
      try {
        console.log(`📝 [FSM ORQUESTRAÇÃO] Registrando transição inicial para status: ${statusInicial}`);
        
        // Usar a FSM para registrar a transição com observação
        await transitionTo({
          propostaId: proposta.id,
          novoStatus: statusInicial,
          contexto: 'geral', // Usar contexto válido para pré-aprovação
          userId: req.user?.id || 'system', // Fallback para 'system' se userId não estiver disponível
          observacoes: observacaoInicial,
          metadata: {
            preApprovalResult: {
              rejected: preApprovalResult.rejected,
              approved: preApprovalResult.approved,
              pendingData: preApprovalResult.pendingData,
              error: preApprovalResult.error,
              calculatedCommitment: preApprovalResult.calculatedCommitment
            },
            autoTransition: true,
            timestamp: new Date().toISOString()
          }
        });
        
        console.log(`✅ [FSM ORQUESTRAÇÃO] Transição inicial registrada com sucesso`);
      } catch (fsmError) {
        // Log do erro mas não falhar a criação da proposta
        console.error(`⚠️ [FSM ORQUESTRAÇÃO] Erro ao registrar transição inicial:`, fsmError);
        // A proposta já foi criada com o status correto, apenas o log de transição falhou
      }
    }

    // Generate installments automatically after proposal creation
    try {
      const prazo = parseInt(dataForDatabase.condicoesData.prazo) || 12;
      const valor = parseFloat(dataForDatabase.condicoesData.valor) || 0;
      const valorParcela = valor / prazo;
      
      const { createServerSupabaseAdminClient } = await import("../../lib/supabase.js");
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
          console.log(`✅ Criadas ${parcelas.length} parcelas para proposta ${proposta.id}`);
        }
      }
    } catch (parcelaError) {
      console.error('Erro ao processar parcelas:', parcelaError);
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

// GET /api/propostas/metricas - Get proposal metrics for current user
router.get("/metricas", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const { db } = await import("../../lib/supabase.js");
    const { propostas } = await import("../../../shared/schema.js");
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

export default router;