/**
 * Dead-Letter Queue Management Service
 * Implements comprehensive DLQ pattern for BullMQ failed jobs
 *
 * Features:
 * - Automatic transfer of permanently failed jobs to DLQ
 * - Rich error context and audit trail preservation
 * - Compliance-ready retention policies
 * - Multiple queue support with centralized management
 */

import { Job, Queue } from 'bullmq';
import logger from './logger';
import { getDeadLetterQueue } from './queues';

/**
 * Interface for DLQ job data structure
 * Preserves original job data plus failure context
 */
interface DLQJobData {
  // Original job information
  originalQueueName: string;
  originalJobId: string | undefined;
  originalData: any;
  originalJobName: string;

  // Failure context
  failureReason: string;
  failureStack?: string;
  attemptsMade: number;
  maxAttempts: number;

  // Audit trail
  failedAt: Date;
  processingDuration?: number;

  // Metadata for compliance and investigation
  metadata: {
    environment: string;
    serverInstance?: string;
    correlationId?: string;
  };
}

/**
 * DLQ Manager class implementing the Dead-Letter Queue pattern
 * Handles permanent job failures with comprehensive audit trail
 */
export class DeadLetterQueueManager {
  private static instance: DeadLetterQueueManager;

  private constructor() {}

  public static getInstance(): DeadLetterQueueManager {
    if (!DeadLetterQueueManager.instance) {
      DeadLetterQueueManager.instance = new DeadLetterQueueManager();
    }
    return DeadLetterQueueManager.instance;
  }

  /**
   * Checks if a job should be moved to DLQ
   * A job qualifies for DLQ if it has exhausted all retry attempts
   */
  public shouldMoveToDeadLetter(job: Job | undefined): boolean {
    if (!job) {
      return false;
    }

    const maxAttempts = job.opts?.attempts ?? 1;
    const attemptsMade = job.attemptsMade;

    // Job should move to DLQ if it has exhausted all attempts
    return attemptsMade >= maxAttempts;
  }

  /**
   * Moves a permanently failed job to the Dead-Letter Queue
   * Preserves all original data plus failure context for audit trail
   */
  public async moveToDeadLetterQueue(
    job: Job | undefined,
    error: Error | string,
    queueName: string,
    processingDuration?: number
  ): Promise<void> {
    if (!job) {
      logger.error('Cannot move undefined job to DLQ', { queueName });
      return;
    }

    try {
      // Build comprehensive DLQ job data
      const dlqJobData: DLQJobData = {
        // Original job information
        originalQueueName: queueName,
        originalJobId: job.id,
        originalData: job.data,
        originalJobName: job.name,

        // Failure context
        failureReason: error instanceof Error ? error.message : String(error),
        failureStack: error instanceof Error ? error.stack : undefined,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts?.attempts ?? 1,

        // Audit trail
        failedAt: new Date(),
        processingDuration,

        // Metadata for compliance
        metadata: {
          environment: process.env.NODE_ENV || 'unknown',
          serverInstance: process.env.REPL_ID || process.env.HOSTNAME || 'unknown',
          correlationId: this.extractCorrelationId(job.data),
        },
      };

      // Add job to Dead-Letter Queue with high priority for investigation
      await deadLetterQueue.add(`dlq-${queueName}-${job.name}`, dlqJobData, {
        priority: 1, // High priority for investigation
        delay: 0, // Process immediately
        removeOnComplete: false, // Keep for compliance
        removeOnFail: false, // Never remove DLQ jobs
      });

      logger.error('Job moved to Dead-Letter Queue', {
        queueName,
        jobId: job.id,
        jobName: job.name,
        failureReason: dlqJobData.failureReason,
        attemptsMade: job.attemptsMade,
        maxAttempts: dlqJobData.maxAttempts,
        dlqJobId: `dlq-${queueName}-${job.name}`,
      });

      // Emit metric/alert for monitoring (if monitoring service exists)
      this.emitDLQMetric(queueName, job.name, dlqJobData);
    } catch (dlqError) {
      // Critical: If we can't move to DLQ, this is a system-level failure
      logger.error('CRITICAL: Failed to move job to Dead-Letter Queue', {
        queueName,
        originalJobId: job.id,
        originalError: error instanceof Error ? error.message : String(error),
        dlqError: dlqError instanceof Error ? dlqError.message : String(dlqError),
      });

      // Don't throw - we don't want to cause further failures
      // But this should trigger alerts in production
    }
  }

  /**
   * Sets up global failed event listeners for a Worker
   * This is the primary integration point for existing workers
   * Note: BullMQ failed events are emitted by Workers, not Queues
   */
  public setupFailedJobHandler(worker: any, queueName: string): void {
    worker.on('failed', async (job: Job | undefined, error: Error) => {
      if (this.shouldMoveToDeadLetter(job)) {
        await this.moveToDeadLetterQueue(job, error, queueName);
      } else {
        // Job will be retried - log for monitoring
        logger.warn('Job failed but will be retried', {
          queueName,
          jobId: job?.id,
          jobName: job?.name,
          attemptsMade: job?.attemptsMade,
          maxAttempts: job?.opts?.attempts,
          error: error.message,
        });
      }
    });

    logger.info(`DLQ handler registered for worker: ${queueName}`);
  }

  /**
   * Extracts correlation ID from job data for tracking
   * Helps with distributed tracing and debugging
   */
  private extractCorrelationId(jobData: any): string | undefined {
    // Try common correlation ID fields
    return (
      jobData?.correlationId ||
      jobData?.traceId ||
      jobData?.aggregateId ||
      jobData?.proposalId ||
      undefined
    );
  }

  /**
   * Emits DLQ metrics for monitoring and alerting
   * In production, this would integrate with metrics services
   */
  private emitDLQMetric(queueName: string, jobName: string, dlqData: DLQJobData): void {
    // For now, just comprehensive logging
    // In production, integrate with Prometheus, DataDog, etc.
    logger.error('DLQ_METRIC', {
      metric: 'job_moved_to_dlq',
      queue: queueName,
      jobType: jobName,
      failureReason: dlqData.failureReason,
      environment: dlqData.metadata.environment,
      timestamp: dlqData.failedAt.toISOString(),
    });
  }

  /**
   * Health check for DLQ system
   * Returns DLQ status and statistics
   */
  public async getDeadLetterQueueStats(): Promise<{
    healthy: boolean;
    jobCounts: any;
    error?: string;
  }> {
    try {
      const jobCounts = await deadLetterQueue.getJobCounts();

      return {
        healthy: true,
        jobCounts,
      };
    } catch (error) {
      return {
        healthy: false,
        jobCounts: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Singleton instance for global access
 * Use this instance throughout the application
 */
export const dlqManager = DeadLetterQueueManager.getInstance();

logger.info('Dead-Letter Queue Manager initialized');
