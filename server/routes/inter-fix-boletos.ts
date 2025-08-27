/**
 * Inter Fix Boletos Routes - REFACTORED
 * Controller for Inter boletos fix operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { interFixService } from '../services/genericService';

const _router = Router();

/**
 * POST /api/inter-fix-boletos/execute
 * Fix boletos issues
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const _result = await interFixService.executeOperation('fix_boletos', req.body);
    res.json(_result);
  } catch (error) {
    console.error('[INTER_FIX_BOLETOS] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Boletos fix failed',
    });
  }
});

export default router;
