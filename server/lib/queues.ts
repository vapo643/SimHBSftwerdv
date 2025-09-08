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
import { dlqManager } from './dead-letter-queue';
import { metricsService } from './metricsService';
import { getRedisClient } from './redis-manager';

// REFATORADO: Use Redis Manager centralizado com lazy loading
async function getRedisConnection() {
  return await getRedisClient();
}

// Default queue options factory function with Redis connection
async function createQueueOptions(): Promise<QueueOptions> {
  const connection = await getRedisConnection();
  return {
    connection,
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
}

// REFATORADO: Lazy loading para queues com Redis Manager
let pdfProcessingQueue: Queue | null = null;
let boletoSyncQueue: Queue | null = null;
let documentQueue: Queue | null = null;
let notificationQueue: Queue | null = null;
let formalizationQueue: Queue | null = null;

export async function getPdfProcessingQueue(): Promise<Queue> {
  if (!pdfProcessingQueue) {
    const options = await createQueueOptions();
    pdfProcessingQueue = new Queue('pdf-processing', options);
  }
  return pdfProcessingQueue;
}

export async function getBoletoSyncQueue(): Promise<Queue> {
  if (!boletoSyncQueue) {
    const options = await createQueueOptions();
    boletoSyncQueue = new Queue('boleto-sync', options);
  }
  return boletoSyncQueue;
}

export async function getDocumentQueue(): Promise<Queue> {
  if (!documentQueue) {
    const options = await createQueueOptions();
    documentQueue = new Queue('document-processing', options);
  }
  return documentQueue;
}

export async function getNotificationQueue(): Promise<Queue> {
  if (!notificationQueue) {
    const options = await createQueueOptions();
    notificationQueue = new Queue('notifications', options);
  }
  return notificationQueue;
}

export async function getFormalizationQueue(): Promise<Queue> {
  if (!formalizationQueue) {
    const options = await createQueueOptions();
    formalizationQueue = new Queue('formalization-queue', options);
  }
  return formalizationQueue;
}

// Dead-Letter Queue - for permanently failed jobs from all other queues
// Critical for audit trail and preventing silent data loss
let deadLetterQueue: Queue | null = null;

export async function getDeadLetterQueue(): Promise<Queue> {
  if (!deadLetterQueue) {
    const connection = await getRedisConnection();
    deadLetterQueue = new Queue('dead-letter-queue', {
      connection,
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
  }
  return deadLetterQueue;
}

// REFATORADO: Queue event logging agora feito via getters lazily
export async function initializeQueueEvents() {
  const pdf = await getPdfProcessingQueue();
  const boleto = await getBoletoSyncQueue();
  const formalization = await getFormalizationQueue();

  pdf.on('waiting', (job) => {
    console.log(`[QUEUE:PDF] 📋 Job ${job.id} waiting in queue`);
  });

  boleto.on('waiting', (job) => {
    console.log(`[QUEUE:BOLETO] 📋 Job ${job.id} waiting in queue`);
  });

  formalization.on('waiting', (job) => {
    console.log(`[QUEUE:FORMALIZATION] 📋 Job ${job.id} waiting in queue`);
  });
}

// Note: DLQ (Dead-Letter Queue) integration for failed jobs is implemented at the Worker level
// Workers have access to the 'failed' event, Queues do not
// The FormalizationWorker already implements DLQ handling via dlqManager.setupFailedJobHandler()
// This pattern ensures proper job failure handling with retry policies and DLQ transfer

// Note: Comprehensive metrics integration is handled at the Worker level
// This provides better precision and access to processing context
// See FormalizationWorker.ts for metrics integration pattern

// =============== PAM V3.4 - SPECIALIZED QUEUES ===============
// High-Performance Queues with differentiated retry policies

// REFATORADO: Specialized queues com lazy loading
let paymentsQueue: Queue | null = null;
let webhooksQueue: Queue | null = null;
let reportsQueue: Queue | null = null;

export async function getPaymentsQueue(): Promise<Queue> {
  if (!paymentsQueue) {
    const connection = await getRedisConnection();
    paymentsQueue = new Queue('payments', {
      connection,
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
  }
  return paymentsQueue;
}

export async function getWebhooksQueue(): Promise<Queue> {
  if (!webhooksQueue) {
    const connection = await getRedisConnection();
    webhooksQueue = new Queue('webhooks', {
      connection,
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
  }
  return webhooksQueue;
}

export async function getReportsQueue(): Promise<Queue> {
  if (!reportsQueue) {
    const connection = await getRedisConnection();
    reportsQueue = new Queue('reports', {
      connection,
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
  }
  return reportsQueue;
}

// REFATORADO: Export all queue getters (lazy loading)
export const getQueues = async () => ({
  pdfProcessing: await getPdfProcessingQueue(),
  boletoSync: await getBoletoSyncQueue(),
  document: await getDocumentQueue(),
  notification: await getNotificationQueue(),
  formalization: await getFormalizationQueue(),
  deadLetter: await getDeadLetterQueue(),
  // PAM V3.4 - Specialized High-Performance Queues
  payments: await getPaymentsQueue(),
  webhooks: await getWebhooksQueue(),
  reports: await getReportsQueue(),
});

// REFATORADO: Health check function com lazy loading
export async function checkQueuesHealth() {
  try {
    const [
      pdfQueue,
      boletoQueue,
      docQueue,
      notifQueue,
      formalQueue,
      dlqQueue,
      payQueue,
      webhookQueue,
      reportQueue,
    ] = await Promise.all([
      getPdfProcessingQueue(),
      getBoletoSyncQueue(),
      getDocumentQueue(),
      getNotificationQueue(),
      getFormalizationQueue(),
      getDeadLetterQueue(),
      getPaymentsQueue(),
      getWebhooksQueue(),
      getReportsQueue(),
    ]);

    const results = await Promise.all([
      pdfQueue.getJobCounts(),
      boletoQueue.getJobCounts(),
      docQueue.getJobCounts(),
      notifQueue.getJobCounts(),
      formalQueue.getJobCounts(),
      dlqQueue.getJobCounts(),
      // PAM V3.4 - New specialized queues health check
      payQueue.getJobCounts(),
      webhookQueue.getJobCounts(),
      reportQueue.getJobCounts(),
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
export async function createWorkerWithDLQ(
  queueName: string,
  processor: (job: any) => Promise<any>,
  options: any = {}
): Promise<Worker> {
  const connection = await getRedisClient();
  const worker = new Worker(queueName, processor, {
    connection,
    concurrency: options.concurrency || 1,
    ...options,
  });

  // Automatically set up DLQ handler
  dlqManager.setupFailedJobHandler(worker, queueName);

  return worker;
}

console.log('[QUEUE] 🚀 Job queues initialized with DLQ support');
