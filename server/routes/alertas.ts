/**
 * Alertas Routes - EXPANDED FROM MINIFIED
 * Controller layer using service pattern
 * PAM V9.0 - Consolidated AuthenticatedRequest usage
 */

import { Router, Request, Response } from 'express';
import { alertService } from '../services/genericService';
import { AuthenticatedRequest } from '../../shared/types/express';

const _router = Router();

/**
 * GET /api/alertas
 * List all system alerts
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const _result = await alertService.executeOperation('list_alerts', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch alerts',
    });
  }
});

export default router;
