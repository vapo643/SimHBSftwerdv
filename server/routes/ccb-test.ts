/**
 * CCB Test Routes - SECURITY HARDENED
 * Controller layer using service pattern with RBAC protection
 * PAM V10.0 - Remediação de Segurança Crítica
 */

import { Router, Request, Response } from 'express';
import { ccbTestService } from '../services/genericService';
import { AuthenticatedRequest } from '../../shared/types/express';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { requireFinanceiro } from '../lib/role-guards';

const router = Router();

/**
 * POST /api/ccb/test
 * Test CCB generation functionality
 * PROTECTED: Requires FINANCEIRO or ADMINISTRADOR role
 */
router.post('/test', jwtAuthMiddleware, requireFinanceiro, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await ccbTestService.executeOperation('test_ccb', req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'CCB test failed',
    });
  }
});

export default router;
