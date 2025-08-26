/**
 * CCB Test Routes - REFACTORED
 * Controller for CCB test operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from "express";
import { ccbTestService } from "../services/genericService";

const router = Router();

/**
 * POST /api/ccb-test/run
 * Run CCB tests
 */
router.post("/run", async (req: Request, res: Response) => {
  try {
    const result = await ccbTestService.executeOperation("run_test", req.body);
    res.json(result);
  } catch (error: any) {
    console.error("[CCB_TEST] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Test execution failed",
    });
  }
});

/**
 * GET /api/ccb-test/status
 * Get test status
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const status = await ccbTestService.getStatus();
    res.json(status);
  } catch (error: any) {
    console.error("[CCB_TEST] Status check failed:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Status check failed",
    });
  }
});

export default router;