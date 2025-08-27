/**
 * Inter Fix Test Routes - REFACTORED
 * Controller for Inter fix test operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { interFixService } from '../services/genericService';

const router = Router();

/**
 * POST /api/inter-fix-test/run
 * Run Inter fix tests
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const result = await interFixService.executeOperation('test_fix', req.body);
    res.json(_result);
  }
catch (error) {
    console.error('[INTER_FIX_TEST] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Fix test failed',
    });
  }
});

/**
 * GET /api/inter-fix-test/status
 * Get fix test status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await interFixService.getStatus();
    res.json(status);
  }
catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Status check failed',
    });
  }
});

export default router;
