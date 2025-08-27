/**
 * CCB Diagnostics Routes - REFACTORED
 * Controller for CCB diagnostic operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { ccbDiagnosticsService } from '../services/genericService';

const router = Router();

/**
 * POST /api/ccb-diagnostics/run
 * Run CCB diagnostics
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const result = await ccbDiagnosticsService.executeOperation('run_diagnostics', req.body);
    res.json(result);
  } catch (error: any) {
    console.error('[CCB_DIAGNOSTICS] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Diagnostics failed',
    });
  }
});

/**
 * GET /api/ccb-diagnostics/test
 * Test diagnostics service
 */
router.get('/test', async (req: Request, res: Response) => {
  try {
    const result = await ccbDiagnosticsService.testConnection();
    res.json(result);
  } catch (error: any) {
    console.error('[CCB_DIAGNOSTICS] Test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Test failed',
    });
  }
});

/**
 * GET /api/ccb-diagnostics/report
 * Get diagnostics report
 */
router.get('/report', async (req: Request, res: Response) => {
  try {
    const report = await ccbDiagnosticsService.executeOperation('generate_report', {
      timestamp: new Date().toISOString(),
    });
    res.json(report);
  } catch (error: any) {
    console.error('[CCB_DIAGNOSTICS] Report generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Report generation failed',
    });
  }
});

export default router;
