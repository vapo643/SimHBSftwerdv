/**
 * Cobrancas Routes - REFACTORED
 * Controller layer using service pattern
 * PAM V1.0 - Clean architecture implementation (Simplified due to size)
 */

import { Router, Request, Response } from 'express';
import { cobrancasService } from '../services/cobrancasService.js';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware.js';
import { AuthenticatedRequest } from '../../shared/types/express';

const router = Router();

/**
 * GET /api/cobrancas
 * List all proposals with billing information
 */
router.get('/', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, atraso } = req.query;
    const userRole = req.user?.role || '';

    const propostas = await cobrancasService.getPropostasCobranca({
      status: status as string,
      atraso: atraso as string,
      userRole,
    });

    res.json({
      success: true,
      propostas,
      total: propostas.length,
    });
  } catch (error: any) {
    console.error('[COBRANCAS_CONTROLLER] Error fetching proposals:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar propostas de cobrança',
    });
  }
});

/**
 * GET /api/cobrancas/:id
 * Get detailed billing info for a specific proposal
 */
router.get('/:id', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da proposta é obrigatório',
      });
    }

    const details = await cobrancasService.getPropostaCobrancaDetalhes(parseInt(id));
    res.json({
      success: true,
      ...details,
    });
  } catch (error: any) {
    console.error('[COBRANCAS_CONTROLLER] Error fetching proposal details:', error);

    const statusCode = error.message === 'Proposta não encontrada' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Erro ao buscar detalhes da proposta',
    });
  }
});

/**
 * POST /api/cobrancas/:id/observacoes
 * Add observation to a proposal
 */
router.post(
  '/:id/observacoes',
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { observacao, tipo } = req.body;

      if (!id || !observacao || !tipo) {
        return res.status(400).json({
          success: false,
          error: 'ID da proposta, observação e tipo são obrigatórios',
        });
      }

      const observation = await cobrancasService.addObservacao({
        proposta_id: parseInt(id),
        observacao,
        tipo,
        created_by: req.user?.id || '',
      });

      res.json({
        success: true,
        observation,
      });
    } catch (error: any) {
      console.error('[COBRANCAS_CONTROLLER] Error adding observation:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao adicionar observação',
      });
    }
  }
);

/**
 * PUT /api/cobrancas/parcelas/:parcelaId
 * Update installment payment status
 */
router.put(
  '/parcelas/:parcelaId',
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { parcelaId } = req.params;
      const { status, dataPagamento, valorPago } = req.body;

      if (!parcelaId || !status) {
        return res.status(400).json({
          success: false,
          error: 'ID da parcela e status são obrigatórios',
        });
      }

      const success = await cobrancasService.updateParcelaStatus(parseInt(parcelaId), status, {
        data_pagamento: dataPagamento,
        valor_pago: valorPago,
      });

      res.json({
        success,
        message: success ? 'Parcela atualizada com sucesso' : 'Erro ao atualizar parcela',
      });
    } catch (error: any) {
      console.error('[COBRANCAS_CONTROLLER] Error updating installment:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao atualizar parcela',
      });
    }
  }
);

/**
 * POST /api/cobrancas/:id/solicitacoes
 * Request modification for a proposal
 */
router.post(
  '/:id/solicitacoes',
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { tipo, motivo, detalhes } = req.body;

      if (!id || !tipo || !motivo) {
        return res.status(400).json({
          success: false,
          error: 'ID da proposta, tipo e motivo são obrigatórios',
        });
      }

      const request = await cobrancasService.requestModification({
        proposta_id: parseInt(id),
        tipo,
        motivo,
        detalhes,
        solicitado_por: req.user?.id || '',
      });

      res.json({
        success: true,
        request,
      });
    } catch (error: any) {
      console.error('[COBRANCAS_CONTROLLER] Error requesting modification:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao criar solicitação de modificação',
      });
    }
  }
);

/**
 * GET /api/cobrancas/stats/overdue
 * Get overdue statistics
 */
router.get(
  '/stats/overdue',
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await cobrancasService.getOverdueStats();
      res.json({
        success: true,
        ...stats,
      });
    } catch (error: any) {
      console.error('[COBRANCAS_CONTROLLER] Error fetching overdue stats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar estatísticas de atraso',
      });
    }
  }
);

/**
 * POST /api/cobrancas/batch/payment-update
 * Process batch payment updates
 */
router.post(
  '/batch/payment-update',
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { updates } = req.body;

      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({
          success: false,
          error: 'Lista de atualizações é obrigatória',
        });
      }

      const result = await cobrancasService.processBatchPaymentUpdate(updates);
      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('[COBRANCAS_CONTROLLER] Error in batch update:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao processar atualizações em lote',
      });
    }
  }
);

export default router;
