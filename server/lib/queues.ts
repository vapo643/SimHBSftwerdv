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

// Queue event logging
pdfProcessingQueue.on('waiting', (job) => {
  console.log(`[QUEUE:PDF] 📋 Job ${job.id} waiting in queue`);
});

boletoSyncQueue.on('waiting', (job) => {
  console.log(`[QUEUE:BOLETO] 📋 Job ${job.id} waiting in queue`);
});

// Export all queues
export const queues = {
  pdfProcessing: pdfProcessingQueue,
  boletoSync: boletoSyncQueue,
  document: documentQueue,
  notification: notificationQueue,
  deadLetter: deadLetterQueue,
};

// Health check function
export async function checkQueuesHealth() {
  try {
    const results = await Promise.all([
      pdfProcessingQueue.getJobCounts(),
      boletoSyncQueue.getJobCounts(),
      documentQueue.getJobCounts(),
      notificationQueue.getJobCounts(),
      deadLetterQueue.getJobCounts(),
    ]);

    return {
      healthy: true,
      queues: {
        pdfProcessing: results[0],
        boletoSync: results[1],
        document: results[2],
        notification: results[3],
        deadLetter: results[4],
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

// Helper function to create a worker with DLQ support
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
