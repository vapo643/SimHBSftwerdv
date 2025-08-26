/**
 * Inter Execute Fix Routes - REFACTORED
 * Controller for Inter execute fix operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { interExecuteService } from '../services/genericService';

const router = Router();

/**
 * POST /api/inter-execute-fix/run
 * Execute Inter fix
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const result = await interExecuteService.executeOperation('execute_fix', req.body);
    res.json(result);
  } catch (error: any) {
    console.error('[INTER_EXECUTE_FIX] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Execute fix failed',
    });
  }
});

export default router;
