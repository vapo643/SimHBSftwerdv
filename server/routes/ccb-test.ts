/**
 * CCB Test Routes - EXPANDED FROM MINIFIED
 * Controller layer using service pattern
 * PAM V9.0 - Consolidated AuthenticatedRequest usage
 */

import { Router, Request, Response } from 'express';
import { ccbTestService } from '../services/genericService';
import { AuthenticatedRequest } from '../../shared/types/express';

const router = Router();

/**
 * POST /api/ccb/test
 * Test CCB generation functionality
 */
router.post('/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await ccbTestService.executeOperation('test_ccb', req.body);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: error.message || 'CCB test failed',
    });
  }
});

export default router;
