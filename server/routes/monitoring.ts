/**
 * Monitoring Routes - REFACTORED
 * Controller layer using service pattern
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { monitoringService } from '../services/monitoringService.js';
import { metricsService } from '../lib/metricsService';
import { checkQueuesHealth } from '../lib/queues';
import { AuthenticatedRequest } from '../../shared/types/express';

const router = Router();

/**
 * GET /api/monitoring/stats
 * Get database statistics
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await monitoringService.getDatabaseStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('[MONITORING] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error fetching database statistics',
    });
  }
});

/**
 * GET /api/monitoring/tables
 * Get table statistics
 */
router.get('/tables', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await monitoringService.getTableStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('[MONITORING] Error fetching table stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error fetching table statistics',
    });
  }
});

/**
 * GET /api/monitoring/indexes
 * Get index usage statistics
 */
router.get('/indexes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usage = await monitoringService.getIndexUsage();
    res.json({ success: true, data: usage });
  } catch (error: any) {
    console.error('[MONITORING] Error fetching index usage:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error fetching index usage',
    });
  }
});

/**
 * GET /api/monitoring/connections
 * Get active database connections
 */
router.get('/connections', async (req: Request, res: Response) => {
  try {
    const connections = await monitoringService.getActiveConnections();
    res.json({ success: true, data: connections });
  } catch (error: any) {
    console.error('[MONITORING] Error fetching connections:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error fetching active connections',
    });
  }
});

/**
 * GET /api/monitoring/health
 * Check database health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await monitoringService.checkHealth();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500;
    res.status(statusCode).json({ success: true, data: health });
  } catch (error: any) {
    console.error('[MONITORING] Error checking health:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error checking database health',
    });
  }
});

/**
 * GET /api/monitoring/report
 * Generate comprehensive monitoring report
 */
router.get('/report', async (req: Request, res: Response) => {
  try {
    const report = await monitoringService.generateReport();
    res.json({ success: true, data: report });
  } catch (error: any) {
    console.error('[MONITORING] Error generating report:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error generating monitoring report',
    });
  }
});

/**
 * GET /api/monitoring/queues/metrics
 * Get comprehensive BullMQ queue metrics with job counters, duration tracking, and DLQ status
 * BANKING-GRADE observability endpoint for "Operação Rede de Segurança"
 */
router.get('/queues/metrics', async (req: Request, res: Response) => {
  try {
    const queueMetrics = metricsService.getAllMetrics();
    const serviceHealth = metricsService.getServiceHealth();
    const queuesHealth = await checkQueuesHealth();
    
    const response = {
      success: true,
      data: {
        metricsService: {
          healthy: serviceHealth.healthy,
          sentryEnabled: serviceHealth.sentryEnabled,
          totalQueuesMonitored: queueMetrics.length,
          lastUpdated: new Date().toISOString(),
        },
        queues: queueMetrics.map(metrics => ({
          queueName: metrics.queueName,
          counters: {
            totalJobs: metrics.totalJobs,
            activeJobs: metrics.activeJobs,
            completedJobs: metrics.completedJobs,
            failedJobs: metrics.failedJobs,
          },
          performance: {
            avgProcessingTime: Math.round(metrics.avgProcessingTime),
            failureRate: parseFloat(metrics.failureRate.toFixed(2)),
          },
          reliability: {
            dlqSize: metrics.dlqSize,
            lastUpdated: metrics.lastUpdated,
          },
          alerts: {
            highFailureRate: metrics.failureRate > 5, // 5% threshold
            slowProcessing: metrics.avgProcessingTime > 30000, // 30s threshold
            highDLQSize: metrics.dlqSize >= 10, // 10 jobs threshold
          }
        })),
        systemHealth: queuesHealth,
        timestamp: new Date().toISOString(),
      }
    };
    
    res.json(response);
  } catch (error: any) {
    console.error('[MONITORING] Error fetching queue metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error fetching queue metrics',
    });
  }
});

/**
 * GET /api/monitoring/queues/:queueName/metrics
 * Get detailed metrics for a specific queue
 */
router.get('/queues/:queueName/metrics', async (req: Request, res: Response) => {
  try {
    const { queueName } = req.params;
    const queueMetrics = metricsService.getQueueMetrics(queueName);
    
    if (!queueMetrics) {
      return res.status(404).json({
        success: false,
        error: `Queue '${queueName}' not found or not being monitored`,
      });
    }
    
    const response = {
      success: true,
      data: {
        queueName: queueMetrics.queueName,
        counters: {
          totalJobs: queueMetrics.totalJobs,
          activeJobs: queueMetrics.activeJobs,
          completedJobs: queueMetrics.completedJobs,
          failedJobs: queueMetrics.failedJobs,
        },
        performance: {
          avgProcessingTime: Math.round(queueMetrics.avgProcessingTime),
          failureRate: parseFloat(queueMetrics.failureRate.toFixed(2)),
        },
        reliability: {
          dlqSize: queueMetrics.dlqSize,
          lastUpdated: queueMetrics.lastUpdated,
        },
        health: {
          status: queueMetrics.failureRate > 5 ? 'warning' : 'healthy',
          alerts: {
            highFailureRate: queueMetrics.failureRate > 5,
            slowProcessing: queueMetrics.avgProcessingTime > 30000,
            highDLQSize: queueMetrics.dlqSize >= 10,
          }
        },
        timestamp: new Date().toISOString(),
      }
    };
    
    res.json(response);
  } catch (error: any) {
    console.error('[MONITORING] Error fetching queue metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error fetching queue metrics',
    });
  }
});

/**
 * POST /api/monitoring/queues/reset-metrics
 * Reset metrics for a specific queue (admin only)
 */
router.post('/queues/reset-metrics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { queueName } = req.body;
    
    if (!queueName) {
      return res.status(400).json({
        success: false,
        error: 'queueName is required',
      });
    }
    
    metricsService.resetMetrics(queueName);
    
    res.json({
      success: true,
      message: `Metrics reset for queue '${queueName}'`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[MONITORING] Error resetting metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error resetting queue metrics',
    });
  }
});

export default router;
