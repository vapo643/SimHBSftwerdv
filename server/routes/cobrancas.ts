/**
 * Cobrancas Routes - REFACTORED
 * Controller layer using service pattern
 * PAM V1.0 - Clean architecture implementation (Simplified due to size)
 */

import { Router, Request, Response } from 'express';
import { cobrancasService } from '../services/cobrancasService.js';
import { _jwtAuthMiddleware } from '../lib/jwt-auth-middleware.js';
import { AuthenticatedRequest } from '../../shared/types/express';

const _router = Router();

/**
 * GET /api/cobrancas
 * List all proposals with billing information
 */
router.get('/', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, atraso } = req.query;
    const _userRole = req.user?.role || '';

    const _propostas = await cobrancasService.getPropostasCobranca({
      status: status as string,
      atraso: atraso as string,
      _userRole,
    });

    res.json({
      success: true,
      _propostas,
      total: propostas.length,
    });
  }
catch (error) {
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
router.get('/:id', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da proposta é obrigatório',
      });
    }

    const _details = await cobrancasService.getPropostaCobrancaDetalhes(parseInt(id));
    res.json({
      success: true,
      ...details,
    });
  }
catch (error) {
    console.error('[COBRANCAS_CONTROLLER] Error fetching proposal details:', error);

    const _statusCode = error.message == 'Proposta não encontrada' ? 404 : 500;
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
  __jwtAuthMiddleware,
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

      const _observation = await cobrancasService.addObservacao({
        proposta_id: parseInt(id),
        _observacao,
        _tipo,
        created_by: req.user?.id || '',
      });

      res.json({
        success: true,
        _observation,
      });
    }
catch (error) {
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
  __jwtAuthMiddleware,
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

      const _success = await cobrancasService.updateParcelaStatus(parseInt(parcelaId), status, {
        data_pagamento: dataPagamento,
        valor_pago: valorPago,
      });

      res.json({
        _success,
        message: success ? 'Parcela atualizada com sucesso' : 'Erro ao atualizar parcela',
      });
    }
catch (error) {
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
  __jwtAuthMiddleware,
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

      const _request = await cobrancasService.requestModification({
        proposta_id: parseInt(id),
        _tipo,
        _motivo,
        _detalhes,
        solicitado_por: req.user?.id || '',
      });

      res.json({
        success: true,
        _request,
      });
    }
catch (error) {
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
  __jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const _stats = await cobrancasService.getOverdueStats();
      res.json({
        success: true,
        ...stats,
      });
    }
catch (error) {
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
  __jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { updates } = req.body;

      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({
          success: false,
          error: 'Lista de atualizações é obrigatória',
        });
      }

      const _result = await cobrancasService.processBatchPaymentUpdate(updates);
      res.json({
        success: true,
        processed: _result.success || 0,
        failed: _result.failed || 0,
        errors: _result.errors || [],
      });
    }
catch (error) {
      console.error('[COBRANCAS_CONTROLLER] Error in batch update:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao processar atualizações em lote',
      });
    }
  }
);

/**
 * GET /api/cobrancas/kpis
 * Get billing KPIs and analytics
 */
router.get('/kpis', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const _kpis = await cobrancasService.getKPIs();
    res.json({
      success: true,
      ...kpis,
    });
  }
catch (error) {
    console.error('[COBRANCAS_CONTROLLER] Error fetching KPIs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar KPIs de cobrança',
    });
  }
});

export default router;
