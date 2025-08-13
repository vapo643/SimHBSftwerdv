import { Router } from "express";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "../lib/jwt-auth-middleware";
import { requireAnyRole } from "../lib/role-guards";
import { interBankService } from "../services/interBankService";
import { db } from "../lib/supabase";
import { interCollections, propostas } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getBrasiliaTimestamp } from "../lib/timezone";
import { createHash } from 'crypto';
import * as path from 'path';
import JSZip from 'jszip';
// PURGA: Serviços de bypass removidos conforme solicitado

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
 * Baixar todos os boletos como ZIP (será implementado fusão pdf-lib posteriormente)
 * GET /api/inter/collections/:propostaId/baixar-todos-boletos
 */
router.get(
  "/:propostaId/baixar-todos-boletos", 
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { propostaId } = req.params;

      console.log(`[ZIP GENERATION] Baixando todos os boletos para proposta: ${propostaId}`);

      // Buscar todas as cobranças da proposta
      const collections = await db
        .select()
        .from(interCollections)
        .where(eq(interCollections.propostaId, propostaId))
        .orderBy(interCollections.numeroParcela);

      if (collections.length === 0) {
        return res.status(404).json({ error: "Nenhum boleto encontrado para esta proposta" });
      }

      console.log(`[ZIP GENERATION] Encontradas ${collections.length} parcelas para download`);

      // Criar ZIP com todos os boletos
      const zip = new JSZip();
      const interService = interBankService;

      // Processar cada boleto
      for (const collection of collections) {
        try {
          console.log(`[ZIP GENERATION] Processando parcela ${collection.numeroParcela}: ${collection.codigoSolicitacao}`);
          
          const pdfBuffer = await interService.obterPdfCobranca(collection.codigoSolicitacao);
          
          if (!pdfBuffer || pdfBuffer.length === 0) {
            console.error(`[ZIP GENERATION] PDF vazio para ${collection.codigoSolicitacao}`);
            const errorInfo = `PDF não disponível para parcela ${collection.numeroParcela}`;
            zip.file(`ERRO_parcela_${collection.numeroParcela}.txt`, errorInfo);
            continue;
          }
          
          // Adicionar PDF ao ZIP
          const parcela = String(collection.numeroParcela).padStart(2, '0');
          const filename = `boleto_parcela_${parcela}.pdf`;
          zip.file(filename, pdfBuffer);
          
        } catch (error: any) {
          console.error(`[ZIP GENERATION] Erro na parcela ${collection.numeroParcela}:`, error);
          const errorInfo = `Erro ao processar parcela ${collection.numeroParcela}: ${error.message}`;
          zip.file(`ERRO_parcela_${collection.numeroParcela}.txt`, errorInfo);
        }
      }

      // Buscar dados da proposta para nome do ZIP
      const propostaData = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, parseInt(propostaId)))
        .limit(1);

      const proposta = propostaData[0];
      const nomeCliente = proposta?.clienteNome?.toUpperCase().replace(/\s+/g, '_').substring(0, 15) || 'CLIENTE';
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const zipFilename = `BOLETOS_${nomeCliente}_${timestamp}.zip`;

      // Gerar ZIP final
      const zipBuffer = await zip.generateAsync({ 
        type: 'nodebuffer', 
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      console.log(`[ZIP GENERATION] ZIP gerado: ${zipFilename} (${zipBuffer.length} bytes)`);

      // Headers para download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Enviar ZIP
      res.send(zipBuffer);

    } catch (error: any) {
      console.error("[ZIP GENERATION] Erro ao gerar ZIP:", error);
      res.status(500).json({
        error: "Erro na geração do ZIP", 
        message: error.message || "Falha ao processar boletos"
      });
    }
  }
);

export default router;
