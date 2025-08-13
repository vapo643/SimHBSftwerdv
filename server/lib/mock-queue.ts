/**
 * Mock Queue Implementation for Development
 * Simulates BullMQ behavior without requiring Redis
 * 
 * In production, use the real queues.ts with Redis
 */

import { EventEmitter } from 'events';

interface JobData {
  id: string;
  name: string;
  data: any;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedReason?: string;
}

class MockJob {
  id: string;
  name: string;
  data: any;
  progress: number = 0;

  constructor(id: string, name: string, data: any) {
    this.id = id;
    this.name = name;
    this.data = data;
  }

  async updateProgress(progress: number) {
    this.progress = progress;
    console.log(`[MOCK JOB ${this.id}] Progress: ${progress}%`);
  }
}

class MockQueue extends EventEmitter {
  private jobs: Map<string, JobData> = new Map();
  private jobCounter = 0;
  name: string;

  constructor(name: string) {
    super();
    this.name = name;
    console.log(`[MOCK QUEUE] 📦 Created mock queue: ${name}`);
  }

  async add(jobName: string, data: any, opts: any = {}) {
    const jobId = `${this.name}-${++this.jobCounter}`;
    const job = new MockJob(jobId, jobName, data);
    
    // Add retry configuration to mock job
    (job as any).opts = {
      attempts: opts.attempts || 5,
      backoff: opts.backoff || { type: 'exponential', delay: 10000 },
      ...opts
    };
    (job as any).attemptsMade = 1;
    
    const jobData: JobData = {
      id: jobId,
      name: jobName,
      data,
      status: 'waiting',
      progress: 0,
      createdAt: new Date()
    };

    this.jobs.set(jobId, jobData);
    
    console.log(`[MOCK QUEUE ${this.name}] ➕ Added job ${jobId}:`, {
      name: jobName,
      data
    });

    this.emit('waiting', job);
    
    // Simulate async processing
    setTimeout(() => {
      this.processJob(jobId);
    }, 100);

    return job;
  }

  private async processJob(jobId: string) {
    const jobData = this.jobs.get(jobId);
    if (!jobData) return;

    jobData.status = 'active';
    jobData.processedAt = new Date();
    
    console.log(`[MOCK QUEUE ${this.name}] 🔄 Processing job ${jobId}`);
    
    // Simulate processing time
    setTimeout(() => {
      jobData.status = 'completed';
      jobData.completedAt = new Date();
      jobData.progress = 100;
      
      console.log(`[MOCK QUEUE ${this.name}] ✅ Completed job ${jobId}`);
      this.emit('completed', { ...jobData });
    }, 2000);
  }

  async getJobCounts() {
    const counts = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0
    };

    this.jobs.forEach(job => {
      counts[job.status]++;
    });

    return counts;
  }
}

class MockWorker extends EventEmitter {
  private queueName: string;
  private processor: Function;

  constructor(queueName: string, processor: Function, options?: any) {
    super();
    this.queueName = queueName;
    this.processor = processor;
    
    console.log(`[MOCK WORKER] 👷 Created mock worker for queue: ${queueName}`);
    
    // Simulate worker ready
    setTimeout(() => {
      console.log(`[MOCK WORKER] ✅ Worker ready for queue: ${queueName}`);
    }, 100);
  }

  async close() {
    console.log(`[MOCK WORKER] 🛑 Closing worker for queue: ${this.queueName}`);
  }
}

// Mock Redis connection
class MockRedis {
  constructor(config: any) {
    console.log(`[MOCK REDIS] 🔴 Mock Redis initialized (no actual connection)`);
  }

  on(event: string, handler: Function) {
    if (event === 'connect') {
      setTimeout(() => handler(), 100);
    }
  }
}

// Default queue options
const defaultQueueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600,
      count: 100,
    },
    removeOnFail: {
      age: 86400,
    },
  },
};

// Create mock queues
export const pdfProcessingQueue = new MockQueue('pdf-processing');
export const boletoSyncQueue = new MockQueue('boleto-sync');
export const documentQueue = new MockQueue('document-processing');
export const notificationQueue = new MockQueue('notifications');

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
      mode: 'MOCK (Development)',
      queues: {
        pdfProcessing: results[0],
        boletoSync: results[1],
        document: results[2],
        notification: results[3],
      },
    };
  } catch (error) {
    console.error('[MOCK QUEUE] Health check failed:', error);
    return {
      healthy: false,
      mode: 'MOCK (Development)',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export mock implementations for worker
export { MockWorker as Worker, MockJob as Job, MockRedis as Redis };
export type { JobData as JobType };

console.log('[MOCK QUEUE] 🚀 Mock job queues initialized (Development Mode)');