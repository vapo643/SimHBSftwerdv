/**
 * Inter Webhook Routes - REFACTORED
 * Handles Inter bank webhook notifications
 * PAM V1.0 - Clean architecture implementation
 */

import { Router } from "express";
import { interFixService } from "../../services/genericService";

const router = Router();

/**
 * POST /webhooks/inter
 * Handle Inter webhook notifications
 */
router.post("/", async (req, res) => {
  try {
    console.log("[INTER WEBHOOK] Received:", req.body);
    
    // Process webhook asynchronously
    await interFixService.executeOperation("webhook_inter", req.body);
    
    // Return success immediately 
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[INTER WEBHOOK] Error:", error);
    // Return success to prevent retries
    res.status(200).json({ success: true });
  }
});

export default router;