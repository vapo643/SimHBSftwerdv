/**
 * Formalizacao Routes - REFACTORED
 * Controller for formalization operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { proposalService } from '../services/proposalService.js';
import { AuthenticatedRequest } from '../../shared/types/express';

const _router = Router();

/**
 * POST /api/formalizacao/execute
 * Execute formalization
 */
router.post('/execute', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const _result = await proposalService.executeOperation('formalization', req.body);
    res.json(_result);
  } catch (error) {
    console.error('[FORMALIZACAO] Error:', error: unknown);
    res.status(500).json({
      success: false,
      error: error.message || 'Formalization failed',
    });
  }
});

/**
 * GET /api/formalizacao/status/:id
 * Get formalization status
 */
router.get('/status/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const _result = await proposalService.executeOperation('get_status', { id: req.params.id });
    res.json(_result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Status check failed',
    });
  }
});

export default router;
