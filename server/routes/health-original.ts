/**
 * Health Routes - REFACTORED
 * Health check endpoints using service pattern
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { healthService } from '../services/healthService.js';
import { logInfo, logError, logMetric } from '../lib/logger.js';

const router = Router();

/**
 * GET /api/health
 * Comprehensive health check
 */
router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const health = await healthService.performHealthCheck();
    const duration = Date.now() - startTime;

    logMetric('health_check_duration', duration);
    logInfo(`Health check completed: ${health.status}`, { health });

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500;

    res.status(statusCode).json(health);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logError('Health check failed', { error: error.message, duration });

    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message || 'Health check failed',
    });
  }
});

/**
 * GET /api/health/live
 * Simple liveness check
 */
router.get('/health/live', async (req: Request, res: Response) => {
  try {
    const liveness = await healthService.getLiveness();
    res.status(200).json(liveness);
  } catch (error: any) {
    res.status(500).json({
      status: 'dead',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * GET /api/health/ready
 * Readiness check for load balancer
 */
router.get('/health/ready', async (req: Request, res: Response) => {
  try {
    const readiness = await healthService.getReadiness();
    const statusCode = readiness.ready ? 200 : 503;

    res.status(statusCode).json(readiness);
  } catch (error: any) {
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Register endpoints with logger
logInfo('🏥 Health check endpoints registered', {
  endpoints: ['/api/health', '/api/health/live', '/api/health/ready'],
});

export default router;
