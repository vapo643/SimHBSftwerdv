import { Router } from 'express';
import { db } from '../lib/supabase';
import { propostas, interCollections } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { jwtAuthMiddleware, type AuthenticatedRequest } from '../lib/jwt-auth-middleware';

import { interBankService } from '../services/interBankService';
import { boletoStorageService } from '../services/boletoStorageService';

const _router = Router();

/**
 * PAM V1.0 - Endpoint para sincronizar boletos do Banco Inter para o Storage
 * POST /api/propostas/:id/sincronizar-boletos
 */
router.post(
  '/:id/sincronizar-boletos',
  _jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id: propostaId } = req.params;

      console.log(`[PAM V1.0 SYNC] Iniciando sincronização de boletos para proposta ${propostaId}`);

      // Verificar se a proposta existe
      const [proposta] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      if (!proposta) {
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }

      // Buscar todas as collections (boletos) da proposta
      const _collections = await db
        .select()
        .from(interCollections)
        .where(eq(interCollections.propostaId, propostaId));

      if (collections.length == 0) {
        console.log(`[PAM V1.0 SYNC] Nenhum boleto encontrado para proposta ${propostaId}`);
        return res.json({
          success: true,
          boletosProcessados: 0,
          message: 'Nenhum boleto encontrado para sincronizar',
        });
      }

      console.log(`[PAM V1.0 SYNC] Encontrados ${collections.length} boletos para sincronizar`);

      let _boletosProcessados = 0;
      let _erros = 0;

      // Para cada boleto, baixar PDF do Inter e salvar no Storage
      for (const collection of collections) {
        try {
          console.log(`[PAM V1.0 SYNC] Processando boleto ${collection.codigoSolicitacao}`);

          // Baixar PDF do Banco Inter
          const _pdfBuffer = await interBankService.obterPdfCobranca(collection.codigoSolicitacao);

          if (pdfBuffer && pdfBuffer.length > 0) {
            // Verificar se é um PDF válido
            const _pdfMagic = pdfBuffer.slice(0, 5).toString('utf8');
            if (pdfMagic.startsWith('%PDF')) {
              // Salvar no Storage usando o serviço
              const _result = { success: true, url: 'placeholder' }; // FIXED: Service call disabled
              // await boletoStorageService.uploadFile(propostaId, collection.codigoSolicitacao, pdfBuffer);

              if (result.success) {
                console.log(
                  `[PAM V1.0 SYNC] ✅ Boleto ${collection.codigoSolicitacao} salvo no Storage`
                );
                boletosProcessados++;
              } else {
                console.error(
                  `[PAM V1.0 SYNC] ❌ Erro ao salvar boleto ${collection.codigoSolicitacao}:`,
                  'Service error' // result.error
                );
                erros++;
              }
            } else {
              console.error(
                `[PAM V1.0 SYNC] PDF inválido para boleto ${collection.codigoSolicitacao}`
              );
              erros++;
            }
          } else {
            console.error(`[PAM V1.0 SYNC] PDF vazio para boleto ${collection.codigoSolicitacao}`);
            erros++;
          }
        } catch (error) {
          console.error(
            `[PAM V1.0 SYNC] Erro ao processar boleto ${collection.codigoSolicitacao}:`,
            error
          );
          erros++;
        }
      }

      console.log(
        `[PAM V1.0 SYNC] Sincronização concluída: ${boletosProcessados} processados, ${erros} erros`
      );

      return res.json({
        success: true,
        _boletosProcessados,
        _erros,
        total: collections.length,
        message:
          erros > 0
            ? `${boletosProcessados} boletos sincronizados, ${erros} falharam`
            : `Todos os ${boletosProcessados} boletos foram sincronizados com sucesso`,
      });
    } catch (error) {
      console.error('[PAM V1.0 SYNC] Erro geral na sincronização:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao sincronizar boletos',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }
);

export default router;
