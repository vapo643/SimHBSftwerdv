/**
 * Health Routes - EXPANDED FROM MINIFIED
 * Controller layer using service pattern
 * PAM V9.0 - Consolidated AuthenticatedRequest usage
 */

import { Router, Request, Response } from 'express';
import { healthService } from '../services/healthService.js';
import { AuthenticatedRequest } from '../../shared/types/express';

const router = Router();

/**
 * GET /api/health
 * System health check
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = { status: 'healthy', timestamp: new Date().toISOString() };
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Health check failed',
    });
  }
});

export default router;
