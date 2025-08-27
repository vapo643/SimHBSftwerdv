/**
 * CCB Coordinate Test Routes - REFACTORED
 * Controller for CCB coordinate test operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { ccbTestService } from '../services/genericService';

const router = Router();

/**
 * POST /api/ccb-coordinate-test/run
 * Run coordinate tests
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const result = await ccbTestService.executeOperation('coordinate_test', req.body);
    res.json(result);
  } catch (error: unknown) {
    console.error('[CCB_COORDINATE_TEST] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Coordinate test failed',
    });
  }
});

export default router;
