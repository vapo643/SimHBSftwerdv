/**
 * CCB Intelligent Test Routes - REFACTORED
 * Controller for CCB intelligent test operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from "express";
import { ccbTestService } from "../services/genericService.js";

const router = Router();

/**
 * POST /api/ccb-intelligent-test/run
 * Run intelligent CCB tests
 */
router.post("/run", async (req: Request, res: Response) => {
  try {
    const result = await ccbTestService.executeOperation("intelligent_test", req.body);
    res.json(result);
  } catch (error: any) {
    console.error("[CCB_INTELLIGENT_TEST] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Intelligent test failed",
    });
  }
});

/**
 * GET /api/ccb-intelligent-test/status
 * Get intelligent test status
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const status = await ccbTestService.getStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Status check failed",
    });
  }
});

export default router;