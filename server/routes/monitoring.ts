/**
 * Monitoring Routes - REFACTORED
 * Controller layer using service pattern
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from "express";
import { monitoringService } from "../services/monitoringService.js";
import { AuthenticatedRequest } from "../../shared/types/express";

const router = Router();

/**
 * GET /api/monitoring/stats
 * Get database statistics
 */
router.get("/stats", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await monitoringService.getDatabaseStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error("[MONITORING] Error fetching stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error fetching database statistics",
    });
  }
});

/**
 * GET /api/monitoring/tables
 * Get table statistics
 */
router.get("/tables", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await monitoringService.getTableStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error("[MONITORING] Error fetching table stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error fetching table statistics",
    });
  }
});

/**
 * GET /api/monitoring/indexes
 * Get index usage statistics
 */
router.get("/indexes", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usage = await monitoringService.getIndexUsage();
    res.json({ success: true, data: usage });
  } catch (error: any) {
    console.error("[MONITORING] Error fetching index usage:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error fetching index usage",
    });
  }
});

/**
 * GET /api/monitoring/connections
 * Get active database connections
 */
router.get("/connections", async (req: Request, res: Response) => {
  try {
    const connections = await monitoringService.getActiveConnections();
    res.json({ success: true, data: connections });
  } catch (error: any) {
    console.error("[MONITORING] Error fetching connections:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error fetching active connections",
    });
  }
});

/**
 * GET /api/monitoring/health
 * Check database health
 */
router.get("/health", async (req: Request, res: Response) => {
  try {
    const health = await monitoringService.checkHealth();
    const statusCode = health.status === "healthy" ? 200 : 
                       health.status === "degraded" ? 503 : 500;
    res.status(statusCode).json({ success: true, data: health });
  } catch (error: any) {
    console.error("[MONITORING] Error checking health:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error checking database health",
    });
  }
});

/**
 * GET /api/monitoring/report
 * Generate comprehensive monitoring report
 */
router.get("/report", async (req: Request, res: Response) => {
  try {
    const report = await monitoringService.generateReport();
    res.json({ success: true, data: report });
  } catch (error: any) {
    console.error("[MONITORING] Error generating report:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error generating monitoring report",
    });
  }
});

export default router;