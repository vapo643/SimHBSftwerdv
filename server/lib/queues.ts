/**
 * BullMQ Queue Configuration
 * Centralizes all job queue definitions for asynchronous processing
 *
 * Architecture:
 * - Redis as message broker
 * - Separate workers for different task types
 * - Automatic retry with exponential backoff
 * - Dead letter queue for failed jobs
 */

import { Queue, QueueOptions, Worker } from 'bullmq';
import { getRedisConnectionConfig } from './redis-config';
import { dlqManager } from './dead-letter-queue';
import { metricsService } from './metricsService';

// Use centralized Redis configuration
const redisConnection = getRedisConnectionConfig();

// Default queue options with retry configuration
const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep max 100 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
};

// PDF Processing Queue - for carnê generation and PDF merging
export const pdfProcessingQueue = new Queue('pdf-processing', defaultQueueOptions);

// Boleto Sync Queue - for synchronizing boletos from Banco Inter
export const boletoSyncQueue = new Queue('boleto-sync', defaultQueueOptions);

// Document Processing Queue - for ClickSign and other document operations
export const documentQueue = new Queue('document-processing', defaultQueueOptions);

// Notification Queue - for sending emails, webhooks, etc.
export const notificationQueue = new Queue('notifications', defaultQueueOptions);

// Formalization Queue - for CCB generation and ClickSign integration after proposal approval
export const formalizationQueue = new Queue('formalization-queue', defaultQueueOptions);

// Dead-Letter Queue - for permanently failed jobs from all other queues
// Critical for audit trail and preventing silent data loss
export const deadLetterQueue = new Queue('dead-letter-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: {
      age: 86400 * 7, // Keep completed DLQ jobs for 7 days
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 86400 * 30, // Keep failed DLQ jobs for 30 days (compliance)
    },
  },
});

// Queue event logging (keeping existing events, metrics handled by workers)
pdfProcessingQueue.on('waiting', (job) => {
  console.log(`[QUEUE:PDF] 📋 Job ${job.id} waiting in queue`);
});

boletoSyncQueue.on('waiting', (job) => {
  console.log(`[QUEUE:BOLETO] 📋 Job ${job.id} waiting in queue`);
});

formalizationQueue.on('waiting', (job) => {
  console.log(`[QUEUE:FORMALIZATION] 📋 Job ${job.id} waiting in queue`);
});

// Note: DLQ (Dead-Letter Queue) integration for failed jobs is implemented at the Worker level
// Workers have access to the 'failed' event, Queues do not
// The FormalizationWorker already implements DLQ handling via dlqManager.setupFailedJobHandler()
// This pattern ensures proper job failure handling with retry policies and DLQ transfer

// Note: Comprehensive metrics integration is handled at the Worker level
// This provides better precision and access to processing context
// See FormalizationWorker.ts for metrics integration pattern

// =============== PAM V3.4 - SPECIALIZED QUEUES ===============
// High-Performance Queues with differentiated retry policies

// PAYMENTS QUEUE - CRITICAL (5 attempts, exponential backoff)
export const paymentsQueue = new Queue('payments', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep max 100 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
});

// WEBHOOKS QUEUE - HIGH PRIORITY (3 attempts, fixed backoff)
export const webhooksQueue = new Queue('webhooks', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 5000, // Fixed 5 seconds delay
    },
    removeOnComplete: {
      age: 3600,
      count: 50,
    },
    removeOnFail: {
      age: 86400,
    },
  },
});

// REPORTS QUEUE - NORMAL PRIORITY (2 attempts, fixed backoff)
export const reportsQueue = new Queue('reports', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 10000, // Fixed 10 seconds delay
    },
    removeOnComplete: {
      age: 1800, // 30 minutes
      count: 25,
    },
    removeOnFail: {
      age: 43200, // 12 hours
    },
  },
});

// Export all queues
export const queues = {
  pdfProcessing: pdfProcessingQueue,
  boletoSync: boletoSyncQueue,
  document: documentQueue,
  notification: notificationQueue,
  formalization: formalizationQueue,
  deadLetter: deadLetterQueue,
  // PAM V3.4 - Specialized High-Performance Queues
  payments: paymentsQueue,
  webhooks: webhooksQueue,
  reports: reportsQueue,
};

// Health check function
export async function checkQueuesHealth() {
  try {
    const results = await Promise.all([
      pdfProcessingQueue.getJobCounts(),
      boletoSyncQueue.getJobCounts(),
      documentQueue.getJobCounts(),
      notificationQueue.getJobCounts(),
      formalizationQueue.getJobCounts(),
      deadLetterQueue.getJobCounts(),
      // PAM V3.4 - New specialized queues health check
      paymentsQueue.getJobCounts(),
      webhooksQueue.getJobCounts(),
      reportsQueue.getJobCounts(),
    ]);

    return {
      healthy: true,
      queues: {
        pdfProcessing: results[0],
        boletoSync: results[1],
        document: results[2],
        notification: results[3],
        formalization: results[4],
        deadLetter: results[5],
        // PAM V3.4 - Specialized queues
        payments: results[6],
        webhooks: results[7],
        reports: results[8],
      },
    };
  } catch (error) {
    console.error('[QUEUE] Health check failed:', error);
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Initialize DLQ handlers for static queues when workers are created
// Note: This is a helper function for workers to register DLQ handlers
export function setupStaticQueueDLQHandlers() {
  // This function should be called by each worker implementation
  // Example: setupStaticQueueDLQHandlers() in worker constructors
  console.log('[QUEUE] Static queue DLQ handlers setup helper available');
}

// Helper function to create a worker with DLQ support and metrics integration
export function createWorkerWithDLQ(
  queueName: string,
  processor: (job: any) => Promise<any>,
  options: any = {}
): Worker {
  const worker = new Worker(queueName, processor, {
    connection: redisConnection,
    concurrency: options.concurrency || 1,
    ...options,
  });
  
  // Automatically set up DLQ handler
  dlqManager.setupFailedJobHandler(worker, queueName);
  
  return worker;
}

console.log('[QUEUE] 🚀 Job queues initialized with DLQ support');
