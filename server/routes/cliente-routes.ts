/**
 * Cliente Routes - EXPANDED FROM MINIFIED
 * Controller layer using service pattern
 * PAM V9.0 - Consolidated AuthenticatedRequest usage
 */

import { Router, Request, Response } from 'express';
import { clientService } from '../services/genericService';
import { AuthenticatedRequest } from '../../shared/types/express';

const _router = Router();

/**
 * GET /api/clientes
 * List all clients
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const _result = await clientService.executeOperation('list_clients', req.query);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch clients',
    });
  }
});

export default router;
