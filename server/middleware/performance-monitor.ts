/**
 * Performance Monitoring Middleware - PAM V4.0
 * Advanced profiling system for critical endpoints
 *
 * Captures detailed metrics:
 * - Response time breakdown (TTFB, processing, db queries)
 * - Memory usage patterns
 * - P95/P99 percentiles tracking
 * - Critical endpoint specific monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

interface PerformanceMetrics {
  correlationId: string;
  method: string;
  path: string;
  endpoint: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter?: NodeJS.MemoryUsage;
  memoryDelta?: number;
  dbQueryCount: number;
  dbQueryTime: number;
  isSlowRequest: boolean;
  isCriticalEndpoint: boolean;
  statusCode?: number;
  error?: string;
}

interface EndpointStats {
  totalRequests: number;
  slowRequests: number;
  totalTime: number;
  avgTime: number;
  p95Time: number;
  p99Time: number;
  lastHour: number[];
  errors: number;
}

// In-memory metrics storage (production: use Redis/InfluxDB)
const performanceMetrics: Map<string, PerformanceMetrics> = new Map();
const endpointStats: Map<string, EndpointStats> = new Map();
const responseTimes: Map<string, number[]> = new Map();

// Critical endpoints for priority monitoring
const CRITICAL_ENDPOINTS = [
  'POST:/api/propostas',
  'GET:/api/propostas',
  'GET:/api/propostas/:id',
  'GET:/api/simulacao',
  'GET:/api/dashboard/stats',
];

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  SLOW_REQUEST_MS: 1000,
  CRITICAL_SLOW_MS: 500,
  P95_TARGET_MS: 500,
  P99_TARGET_MS: 1000,
};

/**
 * Normalize endpoint path for consistent tracking
 */
function normalizeEndpoint(method: string, path: string): string {
  // Replace dynamic segments with placeholders
  const normalized = path
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[0-9a-f-]{36}/g, '/:uuid')
    .replace(/\/\w+@\w+\.\w+/g, '/:email');

  return `${method}:${normalized}`;
}

/**
 * Calculate percentiles from array of response times
 */
function calculatePercentile(times: number[], percentile: number): number {
  if (times.length === 0) return 0;

  const sorted = times.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Update endpoint statistics
 */
function updateEndpointStats(endpoint: string, duration: number, isError: boolean): void {
  if (!endpointStats.has(endpoint)) {
    endpointStats.set(endpoint, {
      totalRequests: 0,
      slowRequests: 0,
      totalTime: 0,
      avgTime: 0,
      p95Time: 0,
      p99Time: 0,
      lastHour: [],
      errors: 0,
    });
  }

  const stats = endpointStats.get(endpoint)!;
  stats.totalRequests++;
  stats.totalTime += duration;
  stats.avgTime = stats.totalTime / stats.totalRequests;

  if (isError) {
    stats.errors++;
  }

  // Track response times for percentile calculation
  if (!responseTimes.has(endpoint)) {
    responseTimes.set(endpoint, []);
  }

  const times = responseTimes.get(endpoint)!;
  times.push(duration);

  // Keep only last 1000 measurements for percentile calculation
  if (times.length > 1000) {
    times.splice(0, times.length - 1000);
  }

  // Calculate percentiles
  stats.p95Time = calculatePercentile(times, 95);
  stats.p99Time = calculatePercentile(times, 99);

  // Count slow requests
  const threshold = CRITICAL_ENDPOINTS.includes(endpoint)
    ? PERFORMANCE_THRESHOLDS.CRITICAL_SLOW_MS
    : PERFORMANCE_THRESHOLDS.SLOW_REQUEST_MS;

  if (duration > threshold) {
    stats.slowRequests++;
  }

  // Update last hour tracking (simplified - would use time windows in production)
  stats.lastHour.push(duration);
  if (stats.lastHour.length > 60) {
    stats.lastHour.splice(0, stats.lastHour.length - 60);
  }
}

/**
 * Performance monitoring middleware
 */
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const startTime = performance.now();
  const memoryBefore = process.memoryUsage();
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const method = req.method;
  const path = req.path;
  const endpoint = normalizeEndpoint(method, path);
  const isCriticalEndpoint = CRITICAL_ENDPOINTS.includes(endpoint);

  // Initialize metrics tracking
  const metrics: PerformanceMetrics = {
    correlationId,
    method,
    path,
    endpoint,
    startTime,
    memoryBefore,
    dbQueryCount: 0,
    dbQueryTime: 0,
    isSlowRequest: false,
    isCriticalEndpoint,
  };

  performanceMetrics.set(correlationId, metrics);

  // Intercept database queries (if using Drizzle/Supabase)
  // This would need integration with your ORM/database layer

  // Override res.end to capture completion metrics
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any) {
    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    const memoryAfter = process.memoryUsage();
    const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;

    // Update metrics
    metrics.endTime = endTime;
    metrics.totalDuration = totalDuration;
    metrics.memoryAfter = memoryAfter;
    metrics.memoryDelta = memoryDelta;
    metrics.statusCode = res.statusCode;
    metrics.isSlowRequest =
      totalDuration >
      (isCriticalEndpoint
        ? PERFORMANCE_THRESHOLDS.CRITICAL_SLOW_MS
        : PERFORMANCE_THRESHOLDS.SLOW_REQUEST_MS);

    const isError = res.statusCode >= 400;

    // Update endpoint statistics
    updateEndpointStats(endpoint, totalDuration, isError);

    // Log performance data
    if (metrics.isSlowRequest || isCriticalEndpoint) {
      console.log(
        `[PERFORMANCE] ${isCriticalEndpoint ? '🚨 CRITICAL' : '⚠️  SLOW'} ${method} ${path}`,
        {
          correlationId,
          duration: Math.round(totalDuration),
          memoryDeltaMB: Math.round(memoryDelta / 1024 / 1024),
          statusCode: res.statusCode,
          isCritical: isCriticalEndpoint,
          threshold: isCriticalEndpoint
            ? PERFORMANCE_THRESHOLDS.CRITICAL_SLOW_MS
            : PERFORMANCE_THRESHOLDS.SLOW_REQUEST_MS,
        }
      );
    }

    // Clean up old metrics (prevent memory leak)
    setTimeout(() => {
      performanceMetrics.delete(correlationId);
    }, 60000); // Keep for 1 minute

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Get performance statistics for monitoring dashboard
 */
export function getPerformanceStats(): {
  endpoints: { [key: string]: EndpointStats };
  summary: {
    totalRequests: number;
    slowRequests: number;
    criticalEndpointsBreachingSLA: string[];
    worstPerformingEndpoint: string | null;
    avgResponseTime: number;
  };
} {
  const endpointsObj: { [key: string]: EndpointStats } = {};
  let totalRequests = 0;
  let totalSlowRequests = 0;
  let totalResponseTime = 0;
  let worstEndpoint: string | null = null;
  let worstTime = 0;

  const criticalEndpointsBreachingSLA: string[] = [];

  for (const [endpoint, stats] of endpointStats.entries()) {
    endpointsObj[endpoint] = stats;
    totalRequests += stats.totalRequests;
    totalSlowRequests += stats.slowRequests;
    totalResponseTime += stats.totalTime;

    if (stats.avgTime > worstTime) {
      worstTime = stats.avgTime;
      worstEndpoint = endpoint;
    }

    // Check SLA breach for critical endpoints
    if (
      CRITICAL_ENDPOINTS.includes(endpoint) &&
      stats.p95Time > PERFORMANCE_THRESHOLDS.P95_TARGET_MS
    ) {
      criticalEndpointsBreachingSLA.push(`${endpoint} (P95: ${Math.round(stats.p95Time)}ms)`);
    }
  }

  return {
    endpoints: endpointsObj,
    summary: {
      totalRequests,
      slowRequests: totalSlowRequests,
      criticalEndpointsBreachingSLA,
      worstPerformingEndpoint: worstEndpoint,
      avgResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
    },
  };
}

/**
 * Reset performance metrics (for testing)
 */
export function resetPerformanceMetrics(): void {
  performanceMetrics.clear();
  endpointStats.clear();
  responseTimes.clear();
}
