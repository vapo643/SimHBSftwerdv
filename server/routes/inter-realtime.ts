import { Router } from "express";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "../lib/jwt-auth-middleware";
import { requireAnyRole } from "../lib/role-guards";
import { interBankService } from "../services/interBankService";
import { db } from "../lib/supabase";
import { interCollections } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

/**
 * Atualizar status dos boletos em tempo real
 * POST /api/inter/realtime-update/:propostaId
 */
router.post(
  "/realtime-update/:propostaId",
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { propostaId } = req.params;
      
      console.log(`[INTER REALTIME] Starting status update for proposal: ${propostaId}`);

      // Buscar boletos ativos
      const collections = await db
        .select()
        .from(interCollections)
        .where(and(
          eq(interCollections.propostaId, propostaId),
          eq(interCollections.isActive, true)
        ));

      if (collections.length === 0) {
        return res.json({ updated: 0, message: "Nenhum boleto encontrado" });
      }

      let updated = 0;
      let removed = 0;
      const results = [];

      for (const collection of collections) {
        try {
          // Verificar status atual na API Inter
          const details = await interBankService.recuperarCobranca(collection.codigoSolicitacao);
          
          // Atualizar no banco se mudou
          if (details.situacao !== collection.situacao) {
            await db
              .update(interCollections)
              .set({
                situacao: details.situacao,
                updatedAt: new Date(),
              })
              .where(eq(interCollections.id, collection.id));
            
            updated++;
            console.log(`[INTER REALTIME] ✅ Parcela ${collection.numeroParcela}: ${collection.situacao} → ${details.situacao}`);
          }

          results.push({
            parcela: collection.numeroParcela,
            codigo: collection.codigoSolicitacao,
            statusAnterior: collection.situacao,
            statusAtual: details.situacao,
            mudou: details.situacao !== collection.situacao
          });

        } catch (error: any) {
          // NÃO desativar automaticamente - apenas logar o erro
          console.error(`[INTER REALTIME] ⚠️ Erro na parcela ${collection.numeroParcela}:`, error.message);
          
          results.push({
            parcela: collection.numeroParcela,
            codigo: collection.codigoSolicitacao,
            statusAnterior: collection.situacao,
            statusAtual: collection.situacao, // Manter o status atual
            mudou: false,
            erro: error.message?.includes('404') ? 'Boleto não encontrado na API' : 'Erro ao buscar'
          });
        }
      }

      const response = {
        updated,
        removed,
        total: collections.length,
        results,
        message: updated > 0 ? `${updated} boletos atualizados` : "Nenhuma atualização necessária"
      };

      console.log(`[INTER REALTIME] ✅ Atualização concluída: ${updated} atualizados, ${removed} removidos`);
      res.json(response);

    } catch (error) {
      console.error("[INTER REALTIME] Error:", error);
      res.status(500).json({ error: "Erro ao atualizar status dos boletos" });
    }
  }
);

export default router;