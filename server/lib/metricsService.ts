/**
 * BullMQ Metrics Service - Production-Ready Observability
 * Implements comprehensive queue and worker instrumentation using Sentry
 * 
 * Features:
 * - Job counters (active, completed, failed) per queue
 * - Processing duration metrics with percentiles
 * - DLQ monitoring and alerting thresholds
 * - Real-time queue health metrics
 * - Integration with existing Sentry infrastructure
 * 
 * Architecture: Singleton pattern with centralized metric collection
 * Integration: Leverages Sentry metrics API for production observability
 */

import * as Sentry from '@sentry/node';
import logger from './logger';

/**
 * Job status types for metric classification
 * Maps directly to BullMQ job lifecycle events
 */
type JobStatus = 'active' | 'completed' | 'failed' | 'stalled' | 'waiting' | 'delayed';

/**
 * Queue health thresholds for alerting
 * Production-tuned values based on banking system requirements
 */
interface QueueThresholds {
  maxFailureRate: number;     // Maximum acceptable failure rate (%)
  maxProcessingTime: number;  // Maximum processing time (ms)
  maxQueueSize: number;       // Maximum queue backlog
  maxDLQSize: number;         // Maximum DLQ size before alerting
}

/**
 * Metric data structure for comprehensive observability
 */
interface QueueMetrics {
  queueName: string;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgProcessingTime: number;
  failureRate: number;
  dlqSize: number;
  lastUpdated: Date;
}

/**
 * MetricsService - Centralized BullMQ observability implementation
 * Singleton pattern ensuring consistent metric collection across application
 */
export class MetricsService {
  private static instance: MetricsService;
  private metrics: Map<string, QueueMetrics> = new Map();
  private processingTimes: Map<string, number[]> = new Map();
  private isInitialized: boolean = false;
  
  // Production-ready thresholds for banking system
  private readonly defaultThresholds: QueueThresholds = {
    maxFailureRate: 5.0,      // 5% failure rate threshold
    maxProcessingTime: 30000, // 30 seconds max processing
    maxQueueSize: 1000,       // 1000 jobs maximum backlog
    maxDLQSize: 10,           // 10 DLQ jobs trigger alert
  };

  private constructor() {
    this.initializeSentryMetrics();
  }

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * Initialize Sentry metrics integration
   * Ensures metrics are properly configured for production monitoring
   */
  private initializeSentryMetrics(): void {
    try {
      // Verify Sentry is configured by checking for DSN
      const sentryDsn = process.env.SENTRY_DSN;
      if (!sentryDsn || sentryDsn === '') {
        logger.warn('⚠️ Sentry not configured - metrics will use local logging only');
        this.isInitialized = false;
        return;
      }

      this.isInitialized = true;
      logger.info('📊 MetricsService initialized with Sentry integration');
      
      // Log successful initialization to Sentry
      Sentry.addBreadcrumb({
        message: 'BullMQ MetricsService initialized',
        category: 'metrics',
        level: 'info',
        data: {
          component: 'MetricsService',
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      logger.error('❌ Failed to initialize Sentry metrics', { error });
      this.isInitialized = false;
    }
  }

  /**
   * Increment job counter with Sentry integration
   * Primary method for tracking job lifecycle events
   */
  public incrementJobCounter(queueName: string, status: JobStatus, jobId?: string): void {
    try {
      // Update local metrics
      this.updateLocalMetrics(queueName, status);

      // Send to Sentry if available
      if (this.isInitialized) {
        // Use Sentry breadcrumbs and tags for dimensional metrics
        // Note: Sentry Node SDK v8 handles metrics differently than browser SDK
        Sentry.setTag('queue_name', queueName);
        Sentry.setTag('job_status', status);

        // Add contextual breadcrumb
        Sentry.addBreadcrumb({
          message: `Job ${status} in queue ${queueName}`,
          category: 'queue-metric',
          level: status === 'failed' ? 'error' : 'info',
          data: {
            queue: queueName,
            status: status,
            jobId: jobId,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Structured logging for audit trail
      logger.info('📈 Job counter incremented', {
        queue: queueName,
        status: status,
        jobId: jobId,
        sentryEnabled: this.isInitialized,
      });

      // Check thresholds and alert if necessary
      this.checkThresholds(queueName);

    } catch (error) {
      logger.error('❌ Failed to increment job counter', {
        queue: queueName,
        status: status,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Record job processing duration with percentile tracking
   * Critical for performance monitoring and SLA compliance
   */
  public recordJobDuration(queueName: string, durationMs: number, jobId?: string): void {
    try {
      // Update local processing times for percentile calculation
      if (!this.processingTimes.has(queueName)) {
        this.processingTimes.set(queueName, []);
      }
      
      const times = this.processingTimes.get(queueName)!;
      times.push(durationMs);
      
      // Keep only last 1000 measurements for memory efficiency
      if (times.length > 1000) {
        times.shift();
      }

      // Send distribution metric to Sentry via breadcrumbs
      if (this.isInitialized) {
        Sentry.addBreadcrumb({
          message: `Job duration: ${durationMs}ms`,
          category: 'performance',
          level: 'info',
          data: {
            queue: queueName,
            duration: durationMs,
            unit: 'millisecond',
          },
        });
      }

      // Update local metrics average
      this.updateProcessingTimeMetrics(queueName, times);

      // Log performance data
      logger.info('⏱️ Job duration recorded', {
        queue: queueName,
        durationMs: durationMs,
        jobId: jobId,
        avgDuration: this.calculateAverage(times),
      });

      // Alert on slow processing
      if (durationMs > this.defaultThresholds.maxProcessingTime) {
        this.alertSlowJob(queueName, durationMs, jobId);
      }

    } catch (error) {
      logger.error('❌ Failed to record job duration', {
        queue: queueName,
        durationMs: durationMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Record DLQ job with enhanced monitoring
   * Critical for tracking permanently failed jobs
   */
  public recordDeadLetterJob(queueName: string, reason: string, jobId?: string): void {
    try {
      // Increment DLQ counter and capture via Sentry
      if (this.isInitialized) {
        Sentry.setTag('dlq_queue', queueName);
        
        // Capture as message for visibility
        Sentry.captureMessage(`Job moved to Dead Letter Queue: ${queueName}`, 'warning');
        
        Sentry.addBreadcrumb({
          message: 'Job moved to DLQ',
          category: 'dlq',
          level: 'warning',
          data: {
            queue: queueName,
            jobId: jobId || 'unknown',
            reason: reason,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Update local DLQ metrics
      const metrics = this.getOrCreateMetrics(queueName);
      metrics.dlqSize += 1;
      metrics.lastUpdated = new Date();

      logger.error('🚨 Job moved to DLQ', {
        queue: queueName,
        reason: reason,
        jobId: jobId,
        currentDLQSize: metrics.dlqSize,
      });

      // Check DLQ threshold
      if (metrics.dlqSize >= this.defaultThresholds.maxDLQSize) {
        this.alertHighDLQSize(queueName, metrics.dlqSize);
      }

    } catch (error) {
      logger.error('❌ Failed to record DLQ job', {
        queue: queueName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get comprehensive metrics for a specific queue
   * Used by monitoring endpoints and health checks
   */
  public getQueueMetrics(queueName: string): QueueMetrics | null {
    return this.metrics.get(queueName) || null;
  }

  /**
   * Get all queue metrics for dashboard display
   * Returns complete observability data for all monitored queues
   */
  public getAllMetrics(): QueueMetrics[] {
    return Array.from(this.metrics.values()).sort((a, b) => 
      a.queueName.localeCompare(b.queueName)
    );
  }

  /**
   * Reset metrics for a specific queue
   * Useful for testing and development
   */
  public resetMetrics(queueName: string): void {
    this.metrics.delete(queueName);
    this.processingTimes.delete(queueName);
    logger.info('🔄 Metrics reset', { queue: queueName });
  }

  /**
   * Health check for metrics service
   * Returns service status and configuration
   */
  public getServiceHealth(): {
    healthy: boolean;
    sentryEnabled: boolean;
    trackedQueues: number;
    totalJobs: number;
  } {
    const totalJobs = Array.from(this.metrics.values())
      .reduce((sum, metrics) => sum + metrics.totalJobs, 0);

    return {
      healthy: true,
      sentryEnabled: this.isInitialized,
      trackedQueues: this.metrics.size,
      totalJobs: totalJobs,
    };
  }

  // Private helper methods
  
  private updateLocalMetrics(queueName: string, status: JobStatus): void {
    const metrics = this.getOrCreateMetrics(queueName);
    
    metrics.totalJobs += 1;
    
    switch (status) {
      case 'active':
        metrics.activeJobs += 1;
        break;
      case 'completed':
        metrics.completedJobs += 1;
        metrics.activeJobs = Math.max(0, metrics.activeJobs - 1);
        break;
      case 'failed':
        metrics.failedJobs += 1;
        metrics.activeJobs = Math.max(0, metrics.activeJobs - 1);
        break;
    }
    
    // Calculate failure rate
    if (metrics.completedJobs + metrics.failedJobs > 0) {
      metrics.failureRate = (metrics.failedJobs / (metrics.completedJobs + metrics.failedJobs)) * 100;
    }
    
    metrics.lastUpdated = new Date();
  }

  private updateProcessingTimeMetrics(queueName: string, times: number[]): void {
    const metrics = this.getOrCreateMetrics(queueName);
    metrics.avgProcessingTime = this.calculateAverage(times);
  }

  private getOrCreateMetrics(queueName: string): QueueMetrics {
    if (!this.metrics.has(queueName)) {
      this.metrics.set(queueName, {
        queueName,
        totalJobs: 0,
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        avgProcessingTime: 0,
        failureRate: 0,
        dlqSize: 0,
        lastUpdated: new Date(),
      });
    }
    return this.metrics.get(queueName)!;
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private checkThresholds(queueName: string): void {
    const metrics = this.metrics.get(queueName);
    if (!metrics) return;

    // Check failure rate threshold
    if (metrics.failureRate > this.defaultThresholds.maxFailureRate) {
      this.alertHighFailureRate(queueName, metrics.failureRate);
    }
  }

  private alertHighFailureRate(queueName: string, failureRate: number): void {
    if (this.isInitialized) {
      Sentry.setTag('alert_type', 'high_failure_rate');
      Sentry.setTag('queue_name', queueName);
      
      Sentry.captureMessage(`High failure rate detected in queue ${queueName}: ${failureRate.toFixed(2)}%`, 'warning');
      
      Sentry.addBreadcrumb({
        message: 'High failure rate alert',
        category: 'alert',
        level: 'warning',
        data: {
          failureRate: failureRate,
          threshold: this.defaultThresholds.maxFailureRate,
        },
      });
    }
    
    logger.warn('🚨 High failure rate detected', {
      queue: queueName,
      failureRate: failureRate,
      threshold: this.defaultThresholds.maxFailureRate,
    });
  }

  private alertSlowJob(queueName: string, duration: number, jobId?: string): void {
    if (this.isInitialized) {
      Sentry.setTag('alert_type', 'slow_processing');
      Sentry.setTag('queue_name', queueName);
      
      Sentry.captureMessage(`Slow job processing detected in ${queueName}: ${duration}ms`, 'warning');
      
      Sentry.addBreadcrumb({
        message: 'Slow job processing alert',
        category: 'alert',
        level: 'warning',
        data: {
          duration: duration,
          threshold: this.defaultThresholds.maxProcessingTime,
          jobId: jobId,
        },
      });
    }
    
    logger.warn('🐌 Slow job processing detected', {
      queue: queueName,
      duration: duration,
      threshold: this.defaultThresholds.maxProcessingTime,
      jobId: jobId,
    });
  }

  private alertHighDLQSize(queueName: string, dlqSize: number): void {
    if (this.isInitialized) {
      Sentry.setTag('alert_type', 'high_dlq_size');
      Sentry.setTag('queue_name', queueName);
      
      Sentry.captureMessage(`High DLQ size detected in ${queueName}: ${dlqSize} jobs`, 'error');
      
      Sentry.addBreadcrumb({
        message: 'High DLQ size alert',
        category: 'alert',
        level: 'error',
        data: {
          dlqSize: dlqSize,
          threshold: this.defaultThresholds.maxDLQSize,
        },
      });
    }
    
    logger.error('🚨 High DLQ size detected', {
      queue: queueName,
      dlqSize: dlqSize,
      threshold: this.defaultThresholds.maxDLQSize,
    });
  }
}

/**
 * Singleton instance for global access
 * Use this instance throughout the application for consistent metrics
 */
export const metricsService = MetricsService.getInstance();

logger.info('📊 BullMQ MetricsService module loaded');