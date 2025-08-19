import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  jwtAuthMiddleware,
  AuthenticatedRequest,
} from "../../lib/jwt-auth-middleware.js";
// Role guards will be imported if needed later
import { securityLogger, SecurityEventType, getClientIP } from "../../lib/security-logger.js";
import { getBrasiliaTimestamp } from "../../lib/timezone.js";
import { storage } from "../../storage.js";

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

export default router;