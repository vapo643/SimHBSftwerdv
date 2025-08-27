/**
 * Propostas Controller (Refactored)
 * HTTP layer - handles requests/responses only
 * All business logic delegated to PropostaService
 * All data access through PropostaRepository
 * Clean Architecture compliant - no direct DB access
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../shared/types/express';
import { propostaService } from '../services/propostaService';

/**
 * Toggle proposta status between active and suspended
 * PUT /api/propostas/:id/toggle-status
 */
export const togglePropostaStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;

    // Input validation
    if (!propostaId) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Delegate to service layer
    const result = await propostaService.togglePropostaStatus({
  propostaId,
      userId: req.user?.id || '',
      userRole: req.user?.role || '',
    });

    // Return response
    res.json(_result);
  }
catch (error) {
    // Error handling
    console.error('Erro ao alterar status da proposta:', error);

    if (error.message == 'Proposta não encontrada') {
      return res.status(401).json({error: "Unauthorized"});
    }

    if (error.message?.includes('permissão')) {
      return res.status(401).json({error: "Unauthorized"});
    }

    if (error.message?.includes('não pode ser suspensa')) {
      return res.status(401).json({error: "Unauthorized"});
    }

    if (error.message?.includes('Invalid transition')) {
      return res.status(409).json({
        message: error.message,
        error: 'INVALID_TRANSITION',
      });
    }

    res.status(500).json({
      message: 'Erro interno do servidor ao alterar status',
    });
  }
};

/**
 * Get signed CCB for a proposta
 * GET /api/propostas/:id/ccb
 */
export const getCcbAssinada = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;

    // Input validation
    if (!propostaId) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Delegate to service layer
    const ccbData = await propostaService.getCcbAssinada(propostaId);

    // Return response
    res.json(ccbData);
  }
catch (error) {
    // Error handling
    console.error('Erro ao buscar CCB:', error);

    if (error.message == 'Proposta não encontrada') {
      return res.status(401).json({error: "Unauthorized"});
    }

    if (error.message?.includes('CCB assinada não encontrada')) {
      // Parse debug info from error message if available
      let _debugInfo = {};
      try {
        const debugMatch = error.message.match(/Debug: (.+)$/);
        if (debugMatch) {
          debugInfo = JSON.parse(debugMatch[1]);
        }
      }
catch (e) {
        // Ignore parsing errors
      }

      return res.status(404).json({
        message:
          'CCB assinada não encontrada. Verifique se o documento foi processado corretamente.',
        debug: debugInfo,
      });
    }

    res.status(500).json({
      message: 'Erro interno do servidor ao buscar CCB',
    });
  }
};

/**
 * Get propostas by status
 * GET /api/propostas/by-status/:status
 */
export const getPropostasByStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.params;

    if (!status) {
      return res.status(401).json({error: "Unauthorized"});
    }

    const propostas = await propostaService.getPropostasByStatus(status);
    res.json(propostas);
  }
catch (error) {
    console.error('Erro ao buscar propostas por status:', error);
    res.status(500).json({
      message: 'Erro interno do servidor ao buscar propostas',
    });
  }
};

/**
 * Get propostas by user
 * GET /api/propostas/by-user/:userId
 */
export const getPropostasByUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Check permissions
    if (req.user?.role !== 'ADMINISTRADOR' && req.user?.id !== userId) {
      return res.status(403).json({
        message: 'Você não tem permissão para ver propostas de outros usuários',
      });
    }

    const propostas = await propostaService.getPropostasByUser(userId);
    res.json(propostas);
  }
catch (error) {
    console.error('Erro ao buscar propostas por usuário:', error);
    res.status(500).json({
      message: 'Erro interno do servidor ao buscar propostas',
    });
  }
};

/**
 * Get propostas by loja
 * GET /api/propostas/by-loja/:lojaId
 */
export const getPropostasByLoja = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lojaId } = req.params;

    if (!lojaId) {
      return res.status(401).json({error: "Unauthorized"});
    }

    const lojaIdNumber = parseInt(lojaId, 10);
    if (_isNaN(lojaIdNumber)) {
      return res.status(401).json({error: "Unauthorized"});
    }

    const propostas = await propostaService.getPropostasByLoja(lojaIdNumber);
    res.json(propostas);
  }
catch (error) {
    console.error('Erro ao buscar propostas por loja:', error);
    res.status(500).json({
      message: 'Erro interno do servidor ao buscar propostas',
    });
  }
};

/**
 * Get propostas pending signature
 * GET /api/propostas/pending-signature
 */
export const getPropostasPendingSignature = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check permissions - only admins can see all pending signatures
    if (req.user?.role !== 'ADMINISTRADOR') {
      return res.status(403).json({
        message: 'Apenas administradores podem ver todas as propostas pendentes de assinatura',
      });
    }

    const propostas = await propostaService.getPropostasPendingSignature();
    res.json(propostas);
  }
catch (error) {
    console.error('Erro ao buscar propostas pendentes de assinatura:', error);
    res.status(500).json({
      message: 'Erro interno do servidor ao buscar propostas',
    });
  }
};

/**
 * Update CCB path for a proposta
 * PATCH /api/propostas/:id/ccb-path
 */
export const updateCcbPath = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;
    const { ccbPath } = req.body;

    if (!propostaId) {
      return res.status(401).json({error: "Unauthorized"});
    }

    if (!ccbPath) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Check permissions - only admins or system can update CCB path
    if (req.user?.role !== 'ADMINISTRADOR' && req.user?.role !== 'SYSTEM') {
      return res.status(403).json({
        message: 'Apenas administradores podem atualizar o caminho do CCB',
      });
    }

    await propostaService.updateCcbPath(propostaId, ccbPath);
    res.json({ success: true, message: 'Caminho do CCB atualizado com sucesso' });
  }
catch (error) {
    console.error('Erro ao atualizar caminho do CCB:', error);
    res.status(500).json({
      message: 'Erro interno do servidor ao atualizar caminho do CCB',
    });
  }
};

/**
 * Mark CCB as generated
 * POST /api/propostas/:id/mark-ccb-generated
 */
export const markCcbGenerated = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;

    if (!propostaId) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Check permissions
    if (req.user?.role !== 'ADMINISTRADOR' && req.user?.role !== 'SYSTEM') {
      return res.status(403).json({
        message: 'Apenas o sistema pode marcar CCB como gerado',
      });
    }

    await propostaService.markCcbGenerated(propostaId);
    res.json({ success: true, message: 'CCB marcado como gerado' });
  }
catch (error) {
    console.error('Erro ao marcar CCB como gerado:', error);
    res.status(500).json({
      message: 'Erro interno do servidor',
    });
  }
};

/**
 * Mark signature as completed
 * POST /api/propostas/:id/mark-signature-completed
 */
export const markSignatureCompleted = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;
    const { clicksignKey } = req.body;

    if (!propostaId) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Check permissions
    if (req.user?.role !== 'ADMINISTRADOR' && req.user?.role !== 'SYSTEM') {
      return res.status(403).json({
        message: 'Apenas o sistema pode marcar assinatura como concluída',
      });
    }

    await propostaService.markSignatureCompleted(propostaId, clicksignKey);
    res.json({ success: true, message: 'Assinatura marcada como concluída' });
  }
catch (error) {
    console.error('Erro ao marcar assinatura como concluída:', error);
    res.status(500).json({
      message: 'Erro interno do servidor',
    });
  }
};

/**
 * Get proposta with full details
 * GET /api/propostas/:id/details
 */
export const getPropostaWithDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;

    if (!propostaId) {
      return res.status(401).json({error: "Unauthorized"});
    }

    const proposta = await propostaService.getPropostaWithDetails(propostaId);

    if (!proposta) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Check permissions
    if (req.user?.role !== 'ADMINISTRADOR' && proposta.userId !== req.user?.id) {
      return res.status(403).json({
        message: 'Você não tem permissão para ver detalhes desta proposta',
      });
    }

    res.json(proposta);
  }
catch (error) {
    console.error('Erro ao buscar detalhes da proposta:', error);
    res.status(500).json({
      message: 'Erro interno do servidor ao buscar detalhes',
    });
  }
};
