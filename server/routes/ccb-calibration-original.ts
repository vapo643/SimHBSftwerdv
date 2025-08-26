/**
 * CCB Calibration Routes - REFACTORED
 * Controller for CCB calibration operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { ccbCalibrationService } from '../services/genericService';

const router = Router();

/**
 * POST /api/ccb-calibration/calibrate
 * Execute CCB calibration
 */
router.post('/calibrate', async (req: Request, res: Response) => {
  try {
    const result = await ccbCalibrationService.executeOperation('calibrate', req.body);
    res.json(result);
  } catch (error: any) {
    console.error('[CCB_CALIBRATION] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Calibration failed',
    });
  }
});

/**
 * GET /api/ccb-calibration/test
 * Test calibration service
 */
router.get('/test', async (req: Request, res: Response) => {
  try {
    const result = await ccbCalibrationService.testConnection();
    res.json(result);
  } catch (error: any) {
    console.error('[CCB_CALIBRATION] Test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Test failed',
    });
  }
});

/**
 * GET /api/ccb-calibration/status
 * Get calibration service status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await ccbCalibrationService.getStatus();
    res.json(status);
  } catch (error: any) {
    console.error('[CCB_CALIBRATION] Status check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Status check failed',
    });
  }
});

export default router;
