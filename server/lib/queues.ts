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

import { Queue, QueueOptions } from 'bullmq';
import { Redis } from 'ioredis';

// Redis connection configuration
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
});

// Test Redis connection
redisConnection.on('connect', () => {
  console.log('[QUEUE] ✅ Redis connected successfully');
});

redisConnection.on('error', (err) => {
  console.error('[QUEUE] ❌ Redis connection error:', err);
});

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
};

// Health check function
export async function checkQueuesHealth() {
  try {
    const results = await Promise.all([
      pdfProcessingQueue.getJobCounts(),
      boletoSyncQueue.getJobCounts(),
      documentQueue.getJobCounts(),
      notificationQueue.getJobCounts(),
    ]);

    return {
      healthy: true,
      queues: {
        pdfProcessing: results[0],
        boletoSync: results[1],
        document: results[2],
        notification: results[3],
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

console.log('[QUEUE] 🚀 Job queues initialized');
