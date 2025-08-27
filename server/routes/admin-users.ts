/**
 * Admin Users Routes - REAL IMPLEMENTATION
 * Controller layer with actual user data
 * PAM V9.0 - Fixed from generic service to real users
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../../shared/types/express';
import { users } from '../../shared/schema';
import { db } from '../lib/supabase';
import { isNull } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/admin/users
 * List all users (admin only)
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    console.log('[ADMIN USERS] Fetching all users...');
    
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users);

    console.log('[ADMIN USERS] Found', allUsers.length, 'users');
    
    res.json({
      success: true,
      data: allUsers,
      total: allUsers.length,
    });
  } catch (error: any) {
    console.error('[ADMIN USERS] Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch users',
    });
  }
});

export default router;