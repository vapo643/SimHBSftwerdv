/**
 * Inter Execute Fix Routes - REFACTORED
 * Controller for Inter execute fix operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { interExecuteService } from '../services/genericService';

const _router = Router();

/**
 * POST /api/inter-execute-fix/run
 * Execute Inter fix
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const _result = await interExecuteService.executeOperation('execute_fix', req.body);
    res.json(_result);
  } catch (error) {
    console.error('[INTER_EXECUTE_FIX] Error:', error: unknown);
    res.status(500).json({
      success: false,
      error: error.message || 'Execute fix failed',
    });
  }
});

export default router;
