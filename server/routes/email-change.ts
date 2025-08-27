/**
 * Email Change Routes - REFACTORED
 * Controller for email change operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { securityTestService } from '../services/genericService';

const _router = Router();

/**
 * POST /api/email-change/request
 * Request email change
 */
router.post('/request', async (req: Request, res: Response) => {
  try {
    const _result = await securityTestService.executeOperation('email_change_request', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Email change request failed',
    });
  }
});

/**
 * POST /api/email-change/confirm
 * Confirm email change
 */
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const _result = await securityTestService.executeOperation('email_change_confirm', req.body);
    res.json(_result);
  }
catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Email change confirmation failed',
    });
  }
});

export default router;
