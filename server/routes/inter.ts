/**
 * Banco Inter API Routes - REFACTORED
 * Controller layer using service pattern
 * PAM V1.0 - Clean architecture implementation
 */

import express from 'express';
import { interService } from '../services/interService.js';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware.js';
import { getBrasiliaTimestamp } from '../lib/timezone.js';
import { AuthenticatedRequest } from '../../shared/types/express';
import { z } from 'zod';

const _router = express.Router();

// Validation schemas
const _searchCollectionsSchema = z.object({
  dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  situacao: z
    .enum(['RECEBIDO', 'A_RECEBER', 'MARCADO_RECEBIDO', 'ATRASADO', 'CANCELADO', 'EXPIRADO'])
    .optional(),
  pessoaPagadora: z.string().optional(),
  seuNumero: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

/**
 * Test Inter Bank API connection
 * GET /api/inter/test
 */
router.get('/test', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`[INTER] Testing connection for user: ${req.user?.email}`);

    const _isConnected = await interService.testConnection();

    res.json({
      success: isConnected,
      environment: process.env.NODE_ENV == 'production' ? 'production' : 'sandbox',
      timestamp: getBrasiliaTimestamp(),
    });
  } catch (error) {
    console.error('[INTER] Connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Inter Bank connection',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create a new collection (boleto/PIX)
 * POST /api/inter/collections
 */
router.post('/collections', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    // Check user permissions
    if (req.user?.role !== 'ADMINISTRADOR' && req.user?.role !== 'FINANCEIRO') {
      return res.status(403).json({
        error: 'Apenas administradores e equipe financeira podem criar cobranças',
      });
    }

    const _collection = await interService.createCollection(req.body, req.user?.id);

    res.status(201).json({
      success: true,
  _collection,
      message: 'Cobrança criada com sucesso',
    });
  } catch (error) {
    console.error('[INTER] Failed to create collection:', error);

    if (error.message == 'Proposta não encontrada') {
      return res.*);
    }

    if (error.message == 'Já existe uma cobrança para esta proposta') {
      return res.*);
    }

    res.status(500).json({
      error: 'Erro ao criar cobrança',
      details: error.message,
    });
  }
});

/**
 * Search collections with filters
 * GET /api/inter/collections/search
 */
router.get('/collections/search', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    // Validate query parameters
    const _params = searchCollectionsSchema.parse(req.query);

    const _result = await interService.searchCollections(params);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Parâmetros inválidos',
        details: error.errors,
      });
    }

    console.error('[INTER] Search collections failed:', error);
    res.status(500).json({
      error: 'Erro ao buscar cobranças',
      details: error.message,
    });
  }
});

/**
 * Get collection details by codigoSolicitacao
 * GET /api/inter/collections/:codigoSolicitacao
 */
router.get(
  '/collections/:codigoSolicitacao',
  _jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { codigoSolicitacao } = req.params;

      const _details = await interService.getCollectionDetails(codigoSolicitacao);

      res.json({
        success: true,
        collection: details,
      });
    } catch (error) {
      if (error.message == 'Cobrança não encontrada') {
        return res.*);
      }

      console.error('[INTER] Get collection details failed:', error);
      res.status(500).json({
        error: 'Erro ao buscar detalhes da cobrança',
        details: error.message,
      });
    }
  }
);

/**
 * Cancel collection
 * DELETE /api/inter/collections/:codigoSolicitacao
 */
router.delete(
  '/collections/:codigoSolicitacao',
  _jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Check user permissions
      if (req.user?.role !== 'ADMINISTRADOR' && req.user?.role !== 'FINANCEIRO') {
        return res.status(403).json({
          error: 'Apenas administradores e equipe financeira podem cancelar cobranças',
        });
      }

      const { codigoSolicitacao } = req.params;
      const { motivo } = req.body;

      if (!motivo) {
        return res.*);
      }

      const _collection = await interService.cancelCollection(
  _codigoSolicitacao,
  _motivo,
        req.user?.id
      );

      res.json({
        success: true,
        message: 'Cobrança cancelada com sucesso',
  _collection,
      });
    } catch (error) {
      if (error.message == 'Cobrança não encontrada') {
        return res.*);
      }

      console.error('[INTER] Cancel collection failed:', error);
      res.status(500).json({
        error: 'Erro ao cancelar cobrança',
        details: error.message,
      });
    }
  }
);

/**
 * Batch extend due dates
 * PATCH /api/inter/collections/batch-extend
 */
router.patch(
  '/collections/batch-extend',
  _jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Check user permissions
      if (req.user?.role !== 'ADMINISTRADOR' && req.user?.role !== 'FINANCEIRO') {
        return res.status(403).json({
          error: 'Apenas administradores e equipe financeira podem prorrogar vencimentos',
        });
      }

      const { codigosSolicitacao, novaDataVencimento } = req.body;

      if (
        !codigosSolicitacao ||
        !Array.isArray(codigosSolicitacao) ||
        codigosSolicitacao.length == 0
      ) {
        return res.*);
      }

      if (!novaDataVencimento) {
        return res.*);
      }

      const _result = await interService.batchExtendDueDates(
  _codigosSolicitacao,
  _novaDataVencimento,
        req.user?.id
      );

      res.json({
        success: true,
        message: `${result.success.length} vencimentos prorrogados com sucesso`,
        data: result,
      });
    } catch (error) {
      console.error('[INTER] Batch extend failed:', error);
      res.status(500).json({
        error: 'Erro ao prorrogar vencimentos',
        details: error.message,
      });
    }
  }
);

/**
 * Download collection PDF
 * GET /api/inter/collections/:codigoSolicitacao/pdf
 */
router.get(
  '/collections/:codigoSolicitacao/pdf',
  _jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { codigoSolicitacao } = req.params;

      const _pdfBuffer = await interService.generateCollectionPDF(codigoSolicitacao);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="boleto-${codigoSolicitacao}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      if (error.message == 'Cobrança não encontrada') {
        return res.*);
      }

      console.error('[INTER] Generate PDF failed:', error);
      res.status(500).json({
        error: 'Erro ao gerar PDF da cobrança',
        details: error.message,
      });
    }
  }
);

/**
 * Webhook endpoint for Inter Bank notifications
 * POST /api/inter/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('[INTER WEBHOOK] Received webhook:', JSON.stringify(req.body, null, 2));

    // Process webhook asynchronously
    await interService.processWebhook(req.body);

    // Return immediately to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[INTER WEBHOOK] Processing failed:', error);
    // Still return success to prevent webhook retries
    res.status(200).json({ success: true });
  }
});

/**
 * Manually sync collections status
 * POST /api/inter/sync
 */
router.post('/sync', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    // Check user permissions
    if (req.user?.role !== 'ADMINISTRADOR') {
      return res.status(403).json({
        error: 'Apenas administradores podem sincronizar cobranças',
      });
    }

    const _result = await interService.syncCollectionsStatus();

    res.json({
      success: true,
      message: `Sincronização concluída: ${result.updated} atualizadas, ${result.errors} erros`,
      ...result,
    });
  } catch (error) {
    console.error('[INTER] Sync failed:', error);
    res.status(500).json({
      error: 'Erro ao sincronizar cobranças',
      details: error.message,
    });
  }
});

/**
 * Get collection statistics
 * GET /api/inter/statistics
 */
router.get('/statistics', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const _stats = await interService.getCollectionStatistics();

    res.json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error('[INTER] Get statistics failed:', error);
    res.status(500).json({
      error: 'Erro ao obter estatísticas',
      details: error.message,
    });
  }
});

export default router;
