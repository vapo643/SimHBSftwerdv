/**
 * Gestão de Contratos - Backend API
 * Acesso restrito a ADMINISTRADOR e DIRETOR
 *
 * Este módulo gerencia o acesso aos contratos (CCBs assinados)
 * com controle rigoroso de permissões por role.
 */

import { Router, Request, Response } from "express";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "../lib/jwt-auth-middleware";
import { requireRoles } from "../lib/role-guards";
import { storage } from "../storage";
import { db } from "../lib/supabase";
import { propostas, parceiros, lojas, produtos, propostaLogs, statusContextuais } from "@shared/schema";
import { gte, lte } from "drizzle-orm";
import { eq, and, isNotNull, isNull, desc } from "drizzle-orm";
import { createServerSupabaseAdminClient } from "../lib/supabase";
import { securityLogger, SecurityEventType, getClientIP } from "../lib/security-logger";

const router = Router();

/**
 * GET /api/contratos
 *
 * Retorna lista de contratos (CCBs assinados) para gestão
 *
 * Roles permitidos: ADMINISTRADOR, DIRETOR
 *
 * Query params opcionais:
 * - status: Filtrar por status específico
 * - lojaId: Filtrar por loja específica
 * - dataInicio: Data inicial do período
 * - dataFim: Data final do período
 * - limite: Número máximo de registros (padrão: 100)
 */
router.get(
  "/contratos",
  jwtAuthMiddleware,
  requireRoles(["ADMINISTRADOR", "DIRETOR"]), // Apenas ADMIN e DIRETOR
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Log de auditoria - acesso a contratos
      securityLogger.logEvent({
        type: SecurityEventType.SENSITIVE_DATA_ACCESS,
        severity: "LOW",
        userId: req.user?.id,
        userEmail: req.user?.email,
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"],
        endpoint: "/api/contratos",
        success: true,
        details: {
          role: req.user?.role,
          action: "VIEW_CONTRACTS",
        },
      });

      // Extrair parâmetros de query
      const { status, lojaId, dataInicio, dataFim, limite = "100" } = req.query;

      console.log("[CONTRATOS] Buscando contratos assinados:", {
        userId: req.user?.id,
        role: req.user?.role,
        filters: { status, lojaId, dataInicio, dataFim },
      });

      // Construir query base - apenas propostas com CCB assinado
      let query = db
        .select({
          // Dados da proposta
          id: propostas.id,
          clienteNome: propostas.clienteNome,
          clienteCpf: propostas.clienteCpf,
          clienteEmail: propostas.clienteEmail,
          clienteTelefone: propostas.clienteTelefone,
          tipoPessoa: propostas.tipoPessoa,
          clienteRazaoSocial: propostas.clienteRazaoSocial,
          clienteCnpj: propostas.clienteCnpj,

          // Dados do empréstimo
          valor: propostas.valor,
          prazo: propostas.prazo,
          valorTotalFinanciado: propostas.valorTotalFinanciado,
          valorLiquidoLiberado: propostas.valorLiquidoLiberado,
          taxaJuros: propostas.taxaJuros,
          taxaJurosAnual: propostas.taxaJurosAnual,
          valorTac: propostas.valorTac,
          valorIof: propostas.valorIof,

          // Status e datas
          status: propostas.status,
          // PAM V1.0 - Status contextual
          statusContextual: statusContextuais.status,
          createdAt: propostas.createdAt,
          dataAprovacao: propostas.dataAprovacao,
          dataAssinatura: propostas.dataAssinatura,
          dataPagamento: propostas.dataPagamento,

          // Dados do CCB
          ccbGerado: propostas.ccbGerado,
          ccbGeradoEm: propostas.ccbGeradoEm,
          caminhoCcb: propostas.caminhoCcb,
          caminhoCcbAssinado: propostas.caminhoCcbAssinado,
          assinaturaEletronicaConcluida: propostas.assinaturaEletronicaConcluida,

          // ClickSign Integration
          clicksignDocumentKey: propostas.clicksignDocumentKey,
          clicksignStatus: propostas.clicksignStatus,
          clicksignSignUrl: propostas.clicksignSignUrl,
          clicksignSignedAt: propostas.clicksignSignedAt,

          // Dados da loja
          lojaId: propostas.lojaId,
          lojaNome: lojas.nomeLoja,
          lojaEndereco: lojas.endereco,

          // Dados do parceiro
          parceiroId: parceiros.id,
          parceiroRazaoSocial: parceiros.razaoSocial,
          parceiroCnpj: parceiros.cnpj,

          // Dados do produto
          produtoId: propostas.produtoId,
          produtoNome: produtos.nomeProduto,
        })
        .from(propostas)
        // PAM V1.0 - LEFT JOIN com status contextual para contratos
        .leftJoin(
          statusContextuais,
          and(
            eq(propostas.id, statusContextuais.propostaId),
            eq(statusContextuais.contexto, 'contratos')
          )
        )
        .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
        .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id))
        .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
        .where(
          and(
            // Apenas CCBs assinados
            eq(propostas.assinaturaEletronicaConcluida, true),
            isNotNull(propostas.caminhoCcbAssinado),

            // Soft delete filter
            isNull(propostas.deletedAt),
            isNull(lojas.deletedAt),
            isNull(parceiros.deletedAt),
            isNull(produtos.deletedAt)
          )
        )
        .orderBy(desc(propostas.dataAssinatura))
        .limit(parseInt(limite as string));

      // Aplicar filtros adicionais se fornecidos
      const conditions = [];

      // Filtro por status
      if (status && typeof status === "string") {
        conditions.push(eq(propostas.status, status));
      }

      // Filtro por loja (apenas para não-administradores com loja específica)
      if (lojaId && typeof lojaId === "string") {
        conditions.push(eq(propostas.lojaId, parseInt(lojaId)));
      }

      // Filtro por período de assinatura
      if (dataInicio && typeof dataInicio === "string") {
        const startDate = new Date(dataInicio);
        startDate.setHours(0, 0, 0, 0);
        conditions.push(gte(propostas.dataAssinatura, startDate));
      }

      if (dataFim && typeof dataFim === "string") {
        const endDate = new Date(dataFim);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(lte(propostas.dataAssinatura, endDate));
      }

      // Executar query
      const contratos = await query;

      console.log(`[CONTRATOS] ${contratos.length} contratos encontrados`);

      // Gerar URLs dos documentos assinados
      const supabaseAdmin = createServerSupabaseAdminClient();
      const contratosComUrls = await Promise.all(
        contratos.map(async (contrato: any) => {
          let urlCcbAssinado = null;
          let urlComprovantePagamento = null;

          // Gerar URL do CCB assinado
          if (contrato.caminhoCcbAssinado) {
            const { data: ccbUrl } = supabaseAdmin.storage
              .from("documents")
              .getPublicUrl(contrato.caminhoCcbAssinado);

            urlCcbAssinado = ccbUrl?.publicUrl;
          }

          // Verificar se há comprovante de pagamento
          if (contrato.dataPagamento) {
            // Assumindo que o comprovante está em formato padrão
            const comprovantePath = `comprovantes/${contrato.id}/comprovante.pdf`;
            const { data: comprovanteUrl } = supabaseAdmin.storage
              .from("documents")
              .getPublicUrl(comprovantePath);

            // Verificar se o arquivo existe
            const { data: fileExists } = await supabaseAdmin.storage
              .from("documents")
              .list(`comprovantes/${contrato.id}`);

            if (fileExists && fileExists.length > 0) {
              urlComprovantePagamento = comprovanteUrl?.publicUrl;
            }
          }

          return {
            ...contrato,
            urlCcbAssinado,
            urlComprovantePagamento,

            // Adicionar indicadores úteis
            diasDesdeAssinatura: contrato.dataAssinatura
              ? Math.floor(
                  (Date.now() - new Date(contrato.dataAssinatura).getTime()) / (1000 * 60 * 60 * 24)
                )
              : null,

            aguardandoPagamento: contrato.assinaturaEletronicaConcluida && !contrato.dataPagamento,

            // Status de formalização
            statusFormalizacao: determinarStatusFormalizacao(contrato),
          };
        })
      );

      // Estatísticas gerais (útil para dashboard)
      const estatisticas = {
        totalContratos: contratosComUrls.length,
        aguardandoPagamento: contratosComUrls.filter((c: any) => c.aguardandoPagamento).length,
        pagos: contratosComUrls.filter((c: any) => c.dataPagamento).length,
        valorTotalContratado: contratosComUrls.reduce((sum: number, c: any) => {
          const valor = parseFloat(c.valor || "0");
          return sum + valor;
        }, 0),
        valorTotalLiberado: contratosComUrls.reduce((sum: number, c: any) => {
          const valor = parseFloat(c.valorLiquidoLiberado || "0");
          return sum + (c.dataPagamento ? valor : 0);
        }, 0),
      };

      // Resposta formatada
      res.json({
        success: true,
        contratos: contratosComUrls,
        estatisticas,
        filtrosAplicados: {
          status,
          lojaId,
          dataInicio,
          dataFim,
          limite: parseInt(limite as string),
        },
      });
    } catch (error) {
      console.error("[CONTRATOS] Erro ao buscar contratos:", error);

      // Log de erro
      securityLogger.logEvent({
        type: SecurityEventType.ACCESS_DENIED,
        severity: "HIGH",
        userId: req.user?.id,
        userEmail: req.user?.email,
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"],
        endpoint: "/api/contratos",
        success: false,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
          role: req.user?.role,
        },
      });

      res.status(500).json({
        success: false,
        message: "Erro ao buscar contratos",
        error:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : "Unknown error"
            : undefined,
      });
    }
  }
);

/**
 * GET /api/contratos/:id
 *
 * Retorna detalhes completos de um contrato específico
 *
 * Roles permitidos: ADMINISTRADOR, DIRETOR
 */
router.get(
  "/contratos/:id",
  jwtAuthMiddleware,
  requireRoles(["ADMINISTRADOR", "DIRETOR"]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      console.log("[CONTRATOS] Buscando detalhes do contrato:", id);

      // Buscar contrato com todos os relacionamentos
      const contrato = await db
        .select()
        .from(propostas)
        .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
        .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id))
        .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
        .where(
          and(
            eq(propostas.id, id),
            eq(propostas.assinaturaEletronicaConcluida, true),
            isNotNull(propostas.caminhoCcbAssinado),
            isNull(propostas.deletedAt)
          )
        )
        .limit(1);

      if (!contrato || contrato.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Contrato não encontrado ou não está assinado",
        });
      }

      // Buscar histórico de logs da proposta
      const historico = await db
        .select()
        .from(propostaLogs)
        .where(eq(propostaLogs.propostaId, id))
        .orderBy(desc(propostaLogs.createdAt));

      // Gerar URLs dos documentos
      const supabaseAdmin = createServerSupabaseAdminClient();
      const contratoData = contrato[0].propostas;

      let urlCcbAssinado = null;
      let urlCcbOriginal = null;
      let documentosAdicionais: Array<{ path: string; url: string | null; nome: string }> = [];

      if (contratoData.caminhoCcbAssinado) {
        const { data: ccbUrl } = supabaseAdmin.storage
          .from("documents")
          .getPublicUrl(contratoData.caminhoCcbAssinado);
        urlCcbAssinado = ccbUrl?.publicUrl;
      }

      if (contratoData.caminhoCcb) {
        const { data: ccbUrl } = supabaseAdmin.storage
          .from("documents")
          .getPublicUrl(contratoData.caminhoCcb);
        urlCcbOriginal = ccbUrl?.publicUrl;
      }

      // Buscar documentos adicionais
      if (contratoData.documentosAdicionais && contratoData.documentosAdicionais.length > 0) {
        documentosAdicionais = await Promise.all(
          contratoData.documentosAdicionais.map(async (docPath: string) => {
            const { data: docUrl } = supabaseAdmin.storage.from("documents").getPublicUrl(docPath);

            return {
              path: docPath,
              url: docUrl?.publicUrl || null,
              nome: docPath.split("/").pop() || "documento",
            };
          })
        );
      }

      res.json({
        success: true,
        contrato: {
          ...contrato[0],
          urlCcbAssinado,
          urlCcbOriginal,
          documentosAdicionais,
          historico,
          statusFormalizacao: determinarStatusFormalizacao(contratoData),
        },
      });
    } catch (error) {
      console.error("[CONTRATOS] Erro ao buscar detalhes do contrato:", error);

      res.status(500).json({
        success: false,
        message: "Erro ao buscar detalhes do contrato",
        error:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : "Unknown error"
            : undefined,
      });
    }
  }
);

/**
 * Função auxiliar para determinar o status de formalização
 */
function determinarStatusFormalizacao(proposta: any): string {
  if (!proposta.ccbGerado) {
    return "PENDENTE_GERACAO";
  }

  if (!proposta.assinaturaEletronicaConcluida) {
    return "AGUARDANDO_ASSINATURA";
  }

  if (!proposta.dataPagamento) {
    return "AGUARDANDO_PAGAMENTO";
  }

  if (proposta.status === "pago") {
    return "CONCLUIDO";
  }

  return "EM_PROCESSAMENTO";
}

export default router;
