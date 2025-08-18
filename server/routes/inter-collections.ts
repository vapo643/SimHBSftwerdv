import { Router } from "express";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "../lib/jwt-auth-middleware";
import { requireAnyRole } from "../lib/role-guards";
import { interBankService } from "../services/interBankService";
import { db } from "../lib/supabase";
import { interCollections, propostas } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getBrasiliaTimestamp } from "../lib/timezone";

const router = Router();

/**
 * Listar boletos gerados para uma proposta
 * GET /api/inter/collections/:propostaId
 */
router.get(
  "/:propostaId",
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { propostaId } = req.params;

      console.log(`[INTER COLLECTIONS] Fetching collections for proposal: ${propostaId}`);

      // Buscar collections ATIVAS da proposta no banco (apenas com número de parcela preenchido)
      const collections = await db
        .select()
        .from(interCollections)
        .where(and(
          eq(interCollections.propostaId, propostaId),
          eq(interCollections.isActive, true)
        ))
        .orderBy(interCollections.numeroParcela);

      // Se tiver collections, buscar detalhes atualizados na API do Inter
      if (collections.length > 0) {
        const interService = interBankService;

        const updatedCollections = await Promise.all(
          collections.map(async collection => {
            try {
              const details = await interService.recuperarCobranca(collection.codigoSolicitacao);

              // Atualizar situacao no banco se mudou
              if (details.situacao !== collection.situacao) {
                await db
                  .update(interCollections)
                  .set({
                    situacao: details.situacao,
                    updatedAt: new Date(),
                  })
                  .where(eq(interCollections.id, collection.id));
              }

              return {
                ...collection,
                ...details,
                codigoBarras: details.codigoBarras || collection.codigoBarras,
                linkPdf: `/api/inter/collections/${collection.codigoSolicitacao}/pdf`,
                numeroParcela: collection.numeroParcela,
                totalParcelas: collection.totalParcelas,
              };
            } catch (error: any) {
              console.error(
                `[INTER COLLECTIONS] Error fetching details for ${collection.codigoSolicitacao}:`,
                error
              );
              
              // NÃO desativar automaticamente - apenas logar o erro
              // Os códigos podem estar temporariamente indisponíveis
              console.warn(`[INTER COLLECTIONS] ⚠️ Erro ao buscar boleto parcela ${collection.numeroParcela}, usando dados locais`);
              
              // Sempre retornar dados do banco local em caso de erro
              return {
                ...collection,
                linkPdf: `/api/inter/collections/${collection.codigoSolicitacao}/pdf`,
                // Manter número da parcela e total
                numeroParcela: collection.numeroParcela,
                totalParcelas: collection.totalParcelas,
              };
            }
          })
        );

        // NÃO filtrar - retornar todas as collections
        console.log(`[INTER COLLECTIONS] Found ${updatedCollections.length} collections for proposal ${propostaId}`);
        res.json(updatedCollections);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("[INTER COLLECTIONS] Error:", error);
      res.status(500).json({ error: "Erro ao buscar boletos" });
    }
  }
);

/**
 * Baixar PDF do boleto
 * GET /api/inter/collections/:propostaId/:codigoSolicitacao/pdf
 */
router.get(
  "/:propostaId/:codigoSolicitacao/pdf",
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { propostaId, codigoSolicitacao } = req.params;

      console.log(`[PDF STORAGE] Buscando PDF no storage para: ${codigoSolicitacao}`);

      // Verificar se collection pertence à proposta
      const collection = await db
        .select()
        .from(interCollections)
        .where(and(
          eq(interCollections.propostaId, propostaId),
          eq(interCollections.codigoSolicitacao, codigoSolicitacao)
        ))
        .limit(1);

      if (collection.length === 0) {
        return res.status(404).json({ error: "Boleto não encontrado" });
      }

      // PRIORIDADE 1: Buscar PDF no Supabase Storage (onde os PDFs foram sincronizados)
      const { createServerSupabaseAdminClient } = await import("../lib/supabase");
      const supabaseAdmin = createServerSupabaseAdminClient();
      
      // Caminho do PDF no storage conforme boletoStorageService.ts
      const storagePath = `propostas/${propostaId}/boletos/emitidos_pendentes/${codigoSolicitacao}.pdf`;
      
      console.log(`[PDF STORAGE] Verificando arquivo: ${storagePath}`);
      
      // Verificar se arquivo existe no storage
      const { data: fileExists, error: listError } = await supabaseAdmin.storage
        .from('documents')
        .list(`propostas/${propostaId}/boletos/emitidos_pendentes`, {
          search: `${codigoSolicitacao}.pdf`
        });

      if (!listError && fileExists && fileExists.length > 0) {
        console.log(`[PDF STORAGE] ✅ PDF encontrado no storage: ${storagePath}`);
        
        // Gerar URL assinada para visualização
        const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
          .from('documents')
          .createSignedUrl(storagePath, 3600); // 1 hora
        
        if (!signedUrlError && signedUrlData?.signedUrl) {
          console.log(`[PDF STORAGE] ✅ URL assinada gerada com sucesso`);
          
          // Redirecionar para URL assinada para visualização inline
          return res.redirect(signedUrlData.signedUrl);
        } else {
          console.error(`[PDF STORAGE] ❌ Erro ao gerar URL assinada:`, signedUrlError);
        }
      } else {
        console.log(`[PDF STORAGE] ⚠️ PDF não encontrado no storage, listError:`, listError);
      }

      // FALLBACK: Se não encontrar no storage, tentar API (só se circuit breaker permitir)
      console.log(`[PDF STORAGE] Tentando fallback para API do Banco Inter...`);
      
      try {
        const interService = interBankService;
        const pdfBuffer = await interService.obterPdfCobranca(codigoSolicitacao);

        if (!pdfBuffer || pdfBuffer.length === 0) {
          return res.status(404).json({
            error: "PDF não sincronizado",
            message: "PDF ainda não foi sincronizado. Tente usar 'Atualizar Status' primeiro.",
          });
        }

        // Validar PDF
        const pdfMagic = pdfBuffer.slice(0, 5).toString("utf8");
        if (!pdfMagic.startsWith("%PDF")) {
          return res.status(422).json({
            error: "PDF inválido",
            message: "Arquivo retornado não é um PDF válido.",
          });
        }

        // Headers para visualização inline
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="boleto-${codigoSolicitacao}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length.toString());
        res.setHeader("X-Frame-Options", "SAMEORIGIN");
        res.setHeader("Cache-Control", "private, max-age=300");
        
        console.log(`[PDF STORAGE] ✅ Retornando PDF da API (${pdfBuffer.length} bytes)`);
        res.send(pdfBuffer);
        
      } catch (apiError: any) {
        console.error(`[PDF STORAGE] ❌ Fallback API também falhou:`, apiError.message);
        
        if (apiError.message?.includes("circuit breaker")) {
          return res.status(503).json({
            error: "Sistema temporariamente indisponível",
            message: "A API do banco está temporariamente indisponível. Tente novamente em alguns minutos.",
          });
        }
        
        return res.status(404).json({
          error: "PDF não disponível",
          message: "PDF não encontrado no storage nem na API. Use 'Atualizar Status' para sincronizar.",
        });
      }
      
    } catch (error: any) {
      console.error("[PDF STORAGE] Erro geral:", error);
      res.status(500).json({
        error: "Erro interno",
        details: error.message || "Erro desconhecido",
      });
    }
  }
);

/**
 * Listar todos os boletos (para tela de cobranças)
 * GET /api/inter/collections
 */
router.get("/", jwtAuthMiddleware, requireAnyRole, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, dataInicial, dataFinal } = req.query;

    console.log("[INTER COLLECTIONS] Listing all collections with filters:", {
      status,
      dataInicial,
      dataFinal,
    });

    const interService = interBankService;

    // Buscar collections na API do Inter
    const filters: any = {};
    if (status) filters.status = status as string;
    if (dataInicial) filters.dataInicial = dataInicial as string;
    if (dataFinal) filters.dataFinal = dataFinal as string;

    const collections = await interService.pesquisarCobrancas({
      dataInicial:
        filters.dataInicial ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      dataFinal: filters.dataFinal || new Date().toISOString().split("T")[0],
      situacao: filters.status as any,
    });

    // Enriquecer com dados das propostas
    const enrichedCollections = await Promise.all(
      collections.map(async (collection: any) => {
        // Extrair propostaId do codigoSolicitacao (formato: SIMPIX-{propostaId}-{parcela})
        const parts = collection.codigoSolicitacao?.split("-");
        if (parts && parts.length >= 2 && parts[0] === "SIMPIX") {
          const propostaId = parts[1];

          const proposta = await db
            .select()
            .from(propostas)
            .where(eq(propostas.id, propostaId))
            .limit(1);

          if (proposta.length > 0) {
            return {
              ...collection,
              proposta: {
                id: proposta[0].id,
                numeroContrato: proposta[0].id, // numeroContrato field não existe, usando id
                nomeCliente: proposta[0].clienteNome || "",
                cpfCliente: proposta[0].clienteCpf || "",
                telefoneCliente: proposta[0].clienteTelefone || "",
                emailCliente: proposta[0].clienteEmail || "",
              },
            };
          }
        }

        return collection;
      })
    );

    res.json(enrichedCollections);
  } catch (error) {
    console.error("[INTER COLLECTIONS] Error listing collections:", error);
    res.status(500).json({ error: "Erro ao listar boletos" });
  }
});

export default router;
