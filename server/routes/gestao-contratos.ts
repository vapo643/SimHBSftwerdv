/**
 * Gestao Contratos Routes - REFACTORED  
 * Controller for contract management operations
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from "express";
import { proposalService } from "../services/proposalService.js";

const router = Router();

/**
 * GET /api/gestao-contratos
 * List contracts
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const result = await proposalService.executeOperation("list_contracts", req.query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to list contracts",
    });
  }
});

/**
 * POST /api/gestao-contratos/:id/update
 * Update contract
 */
router.post("/:id/update", async (req: Request, res: Response) => {
  try {
    const result = await proposalService.executeOperation("update_contract", {
      id: req.params.id,
      ...req.body,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Contract update failed",
    });
  }
});

export default router;