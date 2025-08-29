/**
 * Performance Monitoring Admin Routes - PAM V4.0
 * Provides real-time performance metrics and analytics
 * 
 * Endpoints:
 * - GET /admin/performance/stats - Current performance statistics
 * - GET /admin/performance/dashboard - Performance monitoring dashboard
 * - POST /admin/performance/reset - Reset metrics (dev only)
 */

import express from 'express';
import { requireAdmin } from '../../lib/role-guards';
import { getPerformanceStats, resetPerformanceMetrics } from '../../middleware/performance-monitor';

const router = express.Router();

// Performance statistics endpoint
router.get('/admin/performance/stats', requireAdmin, (req, res) => {
  try {
    const stats = getPerformanceStats();
    
    res.json({
      timestamp: new Date().toISOString(),
      stats,
      slaStatus: {
        target: 'P95 < 500ms',
        breaching: stats.summary.criticalEndpointsBreachingSLA.length > 0,
        breachingEndpoints: stats.summary.criticalEndpointsBreachingSLA
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch performance statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Performance dashboard data endpoint
router.get('/admin/performance/dashboard', requireAdmin, (req, res) => {
  try {
    const stats = getPerformanceStats();
    
    // Format data for dashboard visualization
    const dashboardData = {
      overview: {
        totalRequests: stats.summary.totalRequests,
        slowRequests: stats.summary.slowRequests,
        slowRequestPercentage: stats.summary.totalRequests > 0 
          ? ((stats.summary.slowRequests / stats.summary.totalRequests) * 100).toFixed(2)
          : '0.00',
        avgResponseTime: Math.round(stats.summary.avgResponseTime),
        worstEndpoint: stats.summary.worstPerformingEndpoint
      },
      slaCompliance: {
        target: '500ms P95',
        compliant: stats.summary.criticalEndpointsBreachingSLA.length === 0,
        breaching: stats.summary.criticalEndpointsBreachingSLA,
        breachCount: stats.summary.criticalEndpointsBreachingSLA.length
      },
      criticalEndpoints: Object.entries(stats.endpoints)
        .filter(([endpoint]) => endpoint.includes('/api/propostas') || 
                                endpoint.includes('/api/simulacao') || 
                                endpoint.includes('/api/dashboard'))
        .map(([endpoint, data]) => ({
          endpoint,
          avgTime: Math.round(data.avgTime),
          p95Time: Math.round(data.p95Time),
          p99Time: Math.round(data.p99Time),
          totalRequests: data.totalRequests,
          slowRequests: data.slowRequests,
          errors: data.errors,
          successRate: ((data.totalRequests - data.errors) / Math.max(data.totalRequests, 1) * 100).toFixed(1)
        }))
        .sort((a, b) => b.p95Time - a.p95Time), // Sort by P95 descending
      
      allEndpoints: Object.entries(stats.endpoints)
        .map(([endpoint, data]) => ({
          endpoint,
          avgTime: Math.round(data.avgTime),
          p95Time: Math.round(data.p95Time),
          totalRequests: data.totalRequests,
          slowRequests: data.slowRequests,
          errors: data.errors
        }))
        .sort((a, b) => b.totalRequests - a.totalRequests) // Sort by request count
    };
    
    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Reset metrics endpoint (development only)
router.post('/admin/performance/reset', requireAdmin, (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Reset not allowed in production'
    });
  }
  
  try {
    resetPerformanceMetrics();
    res.json({
      success: true,
      message: 'Performance metrics reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset performance metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health endpoint for performance monitoring system
router.get('/admin/performance/health', requireAdmin, (req, res) => {
  const stats = getPerformanceStats();
  const criticalIssues = [];
  
  // Check for critical performance issues
  if (stats.summary.criticalEndpointsBreachingSLA.length > 0) {
    criticalIssues.push(`${stats.summary.criticalEndpointsBreachingSLA.length} critical endpoints breaching SLA`);
  }
  
  if (stats.summary.slowRequests > stats.summary.totalRequests * 0.1) {
    criticalIssues.push('More than 10% of requests are slow');
  }
  
  res.json({
    status: criticalIssues.length === 0 ? 'healthy' : 'degraded',
    issues: criticalIssues,
    metrics: {
      totalRequests: stats.summary.totalRequests,
      avgResponseTime: Math.round(stats.summary.avgResponseTime),
      slaBreaches: stats.summary.criticalEndpointsBreachingSLA.length
    },
    timestamp: new Date().toISOString()
  });
});

export default router;