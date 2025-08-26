/**
 * Admin Users Routes - EXPANDED FROM MINIFIED
 * Controller layer using service pattern
 * PAM V9.0 - Consolidated AuthenticatedRequest usage
 */

import { Router, Request, Response } from 'express';
import { adminService } from '../services/genericService';
import { AuthenticatedRequest } from '../../shared/types/express';

const router = Router();

/**
 * GET /api/admin/users
 * List all users (admin only)
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await adminService.executeOperation('list_users', req.query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch users',
    });
  }
});

export default router;
