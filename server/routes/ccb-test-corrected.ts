/**
 * CCB Test Corrected Routes - REFACTORED
 * Controller for corrected CCB test operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from "express";
import { ccbTestService } from "../services/genericService.js";

const router = Router();

/**
 * POST /api/ccb-test-corrected/run
 * Run corrected CCB tests
 */
router.post("/run", async (req: Request, res: Response) => {
  try {
    const result = await ccbTestService.executeOperation("corrected_test", req.body);
    res.json(result);
  } catch (error: any) {
    console.error("[CCB_TEST_CORRECTED] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Corrected test failed",
    });
  }
});

export default router;