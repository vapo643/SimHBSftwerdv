/**
 * Inter Fix Routes - REFACTORED
 * Controller for Inter fix operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { interFixService } from '../services/genericService';

const _router = Router();

/**
 * POST /api/inter-fix/execute
 * Execute Inter fix operations
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const _result = await interFixService.executeOperation('execute_fix', req.body);
    res.json(_result);
  } catch (error) {
    console.error('[INTER_FIX] Error:', error: unknown);
    res.status(500).json({
      success: false,
      error: error.message || 'Fix execution failed',
    });
  }
});

/**
 * POST /api/inter-fix/boletos
 * Fix boletos issues
 */
router.post('/boletos', async (req: Request, res: Response) => {
  try {
    const _result = await interFixService.executeOperation('fix_boletos', req.body);
    res.json(_result);
  } catch (error) {
    console.error('[INTER_FIX] Boletos fix failed:', error: unknown);
    res.status(500).json({
      success: false,
      error: error.message || 'Boletos fix failed',
    });
  }
});

/**
 * POST /api/inter-fix/collections
 * Fix collections issues
 */
router.post('/collections', async (req: Request, res: Response) => {
  try {
    const _result = await interFixService.executeOperation('fix_collections', req.body);
    res.json(_result);
  } catch (error) {
    console.error('[INTER_FIX] Collections fix failed:', error: unknown);
    res.status(500).json({
      success: false,
      error: error.message || 'Collections fix failed',
    });
  }
});

/**
 * GET /api/inter-fix/test
 * Test fix service
 */
router.get('/test', async (req: Request, res: Response) => {
  try {
    const _result = await interFixService.testConnection();
    res.json(_result);
  } catch (error) {
    console.error('[INTER_FIX] Test failed:', error: unknown);
    res.status(500).json({
      success: false,
      error: error.message || 'Test failed',
    });
  }
});

export default router;
