/**
 * 🚀 GERENCIAR STATUS - Endpoint PATCH para atualização de propostas
 * Implementação dedicada para resolver frontend PATCH /api/propostas/:id
 */

import { Router } from 'express';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { AuthenticatedRequest } from '../../shared/types/express';

const router = Router();

// 🚀 PATCH /api/propostas/:id - Atualizar status e dados da proposta (GERENCIAR STATUS)
router.patch('/:id', jwtAuthMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    console.log('🎯 [GERENCIAR STATUS] PATCH /api/propostas/:id chamado', {
      propostaId: req.params.id,
      data: req.body,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // Delegate to same DDD controller as PUT (mesma lógica de atualização)
    const { ProposalController } = await import('../modules/proposal/presentation/proposalController');
    const proposalController = new ProposalController();
    
    // Use the same update method as PUT endpoint
    return proposalController.update(req, res, next);
  } catch (error) {
    console.error('🚨 [GERENCIAR STATUS] PATCH /api/propostas/:id error:', error);
    next(error);
  }
});

export default router;