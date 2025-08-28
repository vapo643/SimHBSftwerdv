/**
 * Supabase Native Queue System - PostgreSQL-based replacement for Redis/BullMQ
 * 
 * Features:
 * - BullMQ-compatible interface for easy migration
 * - Native PostgreSQL storage with ACID guarantees
 * - Built-in Dead Letter Queue support
 * - Job retry with exponential backoff
 * - Real-time processing with database polling
 * - Comprehensive audit trail and monitoring
 */

import { EventEmitter } from 'events';
import { db } from './supabase';
import {
  supabaseJobs,
  deadLetterJobs,
  SupabaseJob,
  InsertSupabaseJob,
  UpdateSupabaseJob,
  DeadLetterJob,
  InsertDeadLetterJob,
} from '@shared/schema';
import { eq, and, lte, gte, isNull, desc, asc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import logger from './logger';

// Interfaces compatíveis com BullMQ para facilitar migração
export interface JobOptions {
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  delay?: number;
  priority?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  repeat?: any;
}

export interface JobData {
  [key: string]: any;
}

// Simulação de Job compatível com BullMQ
export class SupabaseJob extends EventEmitter {
  public id: string;
  public name: string;
  public data: JobData;
  public opts: JobOptions;
  public attemptsMade: number = 0;
  public progress: number = 0;
  public timestamp?: number;
  public processedOn?: number;
  public finishedOn?: number;
  public returnvalue?: any;
  public failedReason?: string;
  
  private _dbRow: SupabaseJob;
  private _queue: SupabaseQueue;

  constructor(queue: SupabaseQueue, dbRow: SupabaseJob) {
    super();
    this._queue = queue;
    this._dbRow = dbRow;
    
    this.id = dbRow.id;
    this.name = dbRow.jobName;
    this.data = dbRow.data as JobData;
    this.opts = (dbRow.options as JobOptions) || {};
    this.attemptsMade = dbRow.attempts;
    this.progress = dbRow.progress;
    this.timestamp = dbRow.createdAt.getTime();
    this.processedOn = dbRow.processedAt?.getTime();
    this.finishedOn = dbRow.completedAt?.getTime();
    this.returnvalue = dbRow.result;
    this.failedReason = dbRow.error || undefined;
  }

  async updateProgress(progress: number): Promise<void> {
    this.progress = progress;
    await db
      .update(supabaseJobs)
      .set({ progress })
      .where(eq(supabaseJobs.id, this.id));
    
    this._queue.emit('progress', this, progress);
  }

  async getState(): Promise<string> {
    const result = await db
      .select({ status: supabaseJobs.status })
      .from(supabaseJobs)
      .where(eq(supabaseJobs.id, this.id))
      .limit(1);
    
    return result[0]?.status || 'unknown';
  }
}

// Simulação de Queue compatível com BullMQ
export class SupabaseQueue extends EventEmitter {
  public name: string;
  private defaultJobOptions: JobOptions;
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  constructor(name: string, options?: { defaultJobOptions?: JobOptions }) {
    super();
    this.name = name;
    this.defaultJobOptions = options?.defaultJobOptions || {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: false,
    };

    // Não iniciar processamento automático ainda - será iniciado pelo worker
    console.log(`[SUPABASE QUEUE] 📦 Queue "${name}" initialized`);
  }

  async add(jobName: string, data: JobData, options?: JobOptions): Promise<SupabaseJob> {
    const jobOptions = { ...this.defaultJobOptions, ...options };
    const scheduledFor = options?.delay 
      ? new Date(Date.now() + options.delay) 
      : new Date();

    try {
      // Inserir job na database
      const jobData: InsertSupabaseJob = {
        queueName: this.name,
        jobName,
        data: data as any,
        options: jobOptions as any,
        maxAttempts: jobOptions.attempts || 3,
        priority: jobOptions.priority || 0,
        scheduledFor,
        correlationId: this.extractCorrelationId(data),
      };

      const result = await db
        .insert(supabaseJobs)
        .values(jobData)
        .returning();

      const dbRow = result[0];
      const job = new SupabaseJob(this, dbRow);

      logger.info(`[SUPABASE QUEUE] ➕ Job added to queue "${this.name}"`, {
        jobId: job.id,
        jobName,
        queueName: this.name,
      });

      // Emitir evento waiting
      setTimeout(() => this.emit('waiting', job), 10);

      return job;
    } catch (error) {
      logger.error(`[SUPABASE QUEUE] ❌ Failed to add job to queue "${this.name}"`, {
        jobName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    stalled: number;
  }> {
    try {
      const now = new Date();
      
      // Query eficiente usando SQL raw para performance
      const result = await db.execute(sql`
        SELECT 
          status,
          COUNT(*) as count
        FROM supabase_jobs 
        WHERE queue_name = ${this.name}
        GROUP BY status
      `);

      const counts = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        stalled: 0,
      };

      for (const row of result.rows) {
        const status = row.status as string;
        const count = parseInt(row.count as string);
        
        if (status === 'delayed' && counts.hasOwnProperty('delayed')) {
          counts.delayed = count;
        } else if (counts.hasOwnProperty(status as keyof typeof counts)) {
          (counts as any)[status] = count;
        }
      }

      return counts;
    } catch (error) {
      logger.error(`[SUPABASE QUEUE] ❌ Failed to get job counts for queue "${this.name}"`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        stalled: 0,
      };
    }
  }

  async getJob(jobId: string): Promise<SupabaseJob | null> {
    try {
      const result = await db
        .select()
        .from(supabaseJobs)
        .where(eq(supabaseJobs.id, jobId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return new SupabaseJob(this, result[0]);
    } catch (error) {
      logger.error(`[SUPABASE QUEUE] ❌ Failed to get job ${jobId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  // Método para iniciar o processamento (chamado pelos workers)
  startProcessing(processor: (job: SupabaseJob) => Promise<any>, options: { concurrency?: number } = {}): void {
    if (this.isProcessing) {
      logger.warn(`[SUPABASE QUEUE] ⚠️ Queue "${this.name}" is already processing`);
      return;
    }

    this.isProcessing = true;
    const concurrency = options.concurrency || 1;
    
    logger.info(`[SUPABASE QUEUE] 🚀 Started processing queue "${this.name}" with concurrency ${concurrency}`);

    // Processar jobs imediatamente e depois em intervalos
    this.processAvailableJobs(processor, concurrency);
    
    // Polling a cada 2 segundos para novos jobs
    this.processingInterval = setInterval(() => {
      this.processAvailableJobs(processor, concurrency);
    }, 2000);
  }

  private async processAvailableJobs(processor: (job: SupabaseJob) => Promise<any>, concurrency: number): Promise<void> {
    try {
      const now = new Date();
      
      // Buscar jobs disponíveis para processamento
      const availableJobs = await db
        .select()
        .from(supabaseJobs)
        .where(
          and(
            eq(supabaseJobs.queueName, this.name),
            eq(supabaseJobs.status, 'waiting'),
            lte(supabaseJobs.scheduledFor, now)
          )
        )
        .orderBy(desc(supabaseJobs.priority), asc(supabaseJobs.createdAt))
        .limit(concurrency);

      if (availableJobs.length === 0) {
        return;
      }

      // Processar jobs concorrentemente
      const processingPromises = availableJobs.map(async (jobData) => {
        const job = new SupabaseJob(this, jobData);
        await this.processJob(job, processor);
      });

      await Promise.all(processingPromises);
    } catch (error) {
      logger.error(`[SUPABASE QUEUE] ❌ Error processing jobs in queue "${this.name}"`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async processJob(job: SupabaseJob, processor: (job: SupabaseJob) => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Marcar job como ativo
      await db
        .update(supabaseJobs)
        .set({ 
          status: 'active',
          processedAt: new Date(),
          processedBy: process.env.REPL_ID || process.env.HOSTNAME || 'unknown'
        })
        .where(eq(supabaseJobs.id, job.id));

      logger.info(`[SUPABASE QUEUE] 🔄 Processing job ${job.id}`, {
        jobName: job.name,
        queueName: this.name,
      });

      this.emit('active', job);

      // Processar job
      const result = await processor(job);
      const endTime = Date.now();

      // Marcar como concluído
      await db
        .update(supabaseJobs)
        .set({
          status: 'completed',
          result: result as any,
          completedAt: new Date(),
        })
        .where(eq(supabaseJobs.id, job.id));

      logger.info(`[SUPABASE QUEUE] ✅ Job ${job.id} completed`, {
        jobName: job.name,
        queueName: this.name,
        duration: endTime - startTime,
      });

      this.emit('completed', job, result);

      // Cleanup baseado nas opções
      await this.cleanupCompletedJob(job);
      
    } catch (error) {
      await this.handleJobFailure(job, error, startTime);
    }
  }

  private async handleJobFailure(job: SupabaseJob, error: any, startTime: number): Promise<void> {
    const endTime = Date.now();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Incrementar tentativas
    const newAttempts = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts || 3;

    if (newAttempts >= maxAttempts) {
      // Job falhou permanentemente - mover para Dead Letter Queue
      await this.moveJobToDeadLetterQueue(job, error, endTime - startTime);
      
      // Marcar job como failed
      await db
        .update(supabaseJobs)
        .set({
          status: 'failed',
          attempts: newAttempts,
          error: errorMessage,
          errorStack,
          completedAt: new Date(),
        })
        .where(eq(supabaseJobs.id, job.id));

      logger.error(`[SUPABASE QUEUE] ❌ Job ${job.id} failed permanently`, {
        jobName: job.name,
        queueName: this.name,
        attempts: newAttempts,
        error: errorMessage,
      });

      this.emit('failed', job, error);
    } else {
      // Calcular delay para retry
      const backoff = job.opts.backoff || { type: 'exponential', delay: 2000 };
      const delay = backoff.type === 'exponential' 
        ? backoff.delay * Math.pow(2, newAttempts - 1)
        : backoff.delay;
      
      const scheduledFor = new Date(Date.now() + delay);

      // Agendar retry
      await db
        .update(supabaseJobs)
        .set({
          status: 'waiting',
          attempts: newAttempts,
          error: errorMessage,
          errorStack,
          scheduledFor,
        })
        .where(eq(supabaseJobs.id, job.id));

      logger.warn(`[SUPABASE QUEUE] 🔄 Job ${job.id} failed, retry scheduled`, {
        jobName: job.name,
        queueName: this.name,
        attempts: newAttempts,
        maxAttempts,
        retryDelay: delay,
        error: errorMessage,
      });

      this.emit('failed', job, error);
    }
  }

  private async moveJobToDeadLetterQueue(job: SupabaseJob, error: any, processingDuration: number): Promise<void> {
    try {
      const dlqData: InsertDeadLetterJob = {
        originalJobId: job.id,
        originalQueueName: this.name,
        originalJobName: job.name,
        originalData: job.data as any,
        failureReason: error instanceof Error ? error.message : String(error),
        failureStack: error instanceof Error ? error.stack : undefined,
        attemptsMade: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts || 3,
        originalCreatedAt: new Date(job.timestamp || Date.now()),
        processingDuration,
        environment: process.env.NODE_ENV || 'development',
        serverInstance: process.env.REPL_ID || process.env.HOSTNAME || 'unknown',
        correlationId: this.extractCorrelationId(job.data),
        metadata: {
          jobOptions: job.opts,
          processingInfo: {
            processedAt: job.processedOn,
            failedAt: Date.now(),
          },
        } as any,
      };

      await db.insert(deadLetterJobs).values(dlqData);

      logger.error(`[SUPABASE QUEUE] 💀 Job ${job.id} moved to Dead Letter Queue`, {
        jobName: job.name,
        queueName: this.name,
        failureReason: dlqData.failureReason,
      });
    } catch (dlqError) {
      logger.error(`[SUPABASE QUEUE] ❌ CRITICAL: Failed to move job to Dead Letter Queue`, {
        jobId: job.id,
        queueName: this.name,
        originalError: error instanceof Error ? error.message : String(error),
        dlqError: dlqError instanceof Error ? dlqError.message : String(dlqError),
      });
    }
  }

  private async cleanupCompletedJob(job: SupabaseJob): Promise<void> {
    const removeOnComplete = job.opts.removeOnComplete;
    
    if (removeOnComplete === true || (typeof removeOnComplete === 'number' && removeOnComplete > 0)) {
      // Por ora, manter todos os jobs para auditoria
      // Em produção, implementar cleanup baseado nas opções
      logger.debug(`[SUPABASE QUEUE] Job ${job.id} cleanup deferred (keeping for audit)`);
    }
  }

  private extractCorrelationId(data: any): string | undefined {
    return data?.correlationId || 
           data?.traceId || 
           data?.aggregateId ||
           data?.proposalId ||
           data?.propostaId ||
           undefined;
  }

  async close(): Promise<void> {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    logger.info(`[SUPABASE QUEUE] 🛑 Queue "${this.name}" stopped processing`);
  }
}

// Worker compatível com BullMQ
export class SupabaseWorker extends EventEmitter {
  private queue: SupabaseQueue;
  private processor: (job: SupabaseJob) => Promise<any>;
  private concurrency: number;

  constructor(
    queueName: string,
    processor: (job: SupabaseJob) => Promise<any>,
    options: { concurrency?: number } = {}
  ) {
    super();
    
    this.processor = processor;
    this.concurrency = options.concurrency || 1;
    
    // Criar queue interna
    this.queue = new SupabaseQueue(queueName);
    
    // Repassar eventos da queue
    this.queue.on('active', (job) => this.emit('active', job));
    this.queue.on('completed', (job, result) => this.emit('completed', job, result));
    this.queue.on('failed', (job, error) => this.emit('failed', job, error));
    this.queue.on('progress', (job, progress) => this.emit('progress', job, progress));

    // Iniciar processamento
    this.queue.startProcessing(this.processor, { concurrency: this.concurrency });
    
    logger.info(`[SUPABASE WORKER] 👷 Worker initialized for queue "${queueName}"`, {
      concurrency: this.concurrency,
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
    logger.info(`[SUPABASE WORKER] 🛑 Worker closed`);
  }
}

// Factory functions para compatibilidade
export function createQueue(name: string, options?: { defaultJobOptions?: JobOptions }): SupabaseQueue {
  return new SupabaseQueue(name, options);
}

export function createWorker(
  queueName: string, 
  processor: (job: SupabaseJob) => Promise<any>,
  options?: { concurrency?: number }
): SupabaseWorker {
  return new SupabaseWorker(queueName, processor, options);
}

// Função de health check
export async function checkSupabaseQueuesHealth(): Promise<{
  healthy: boolean;
  queues: Record<string, any>;
  deadLetterQueue: any;
  error?: string;
}> {
  try {
    // Verificar status de todas as filas
    const queueNames = [
      'pdf-processing',
      'boleto-sync',
      'document-processing',
      'notifications',
      'formalization-queue'
    ];

    const queueStats: Record<string, any> = {};
    
    for (const queueName of queueNames) {
      const queue = new SupabaseQueue(queueName);
      queueStats[queueName] = await queue.getJobCounts();
    }

    // Verificar Dead Letter Queue
    const dlqResult = await db.execute(sql`
      SELECT COUNT(*) as total_dlq_jobs
      FROM dead_letter_jobs 
      WHERE investigated = false
    `);

    const dlqStats = {
      totalUninvestigatedJobs: parseInt(dlqResult.rows[0].total_dlq_jobs as string),
    };

    return {
      healthy: true,
      queues: queueStats,
      deadLetterQueue: dlqStats,
    };
  } catch (error) {
    return {
      healthy: false,
      queues: {},
      deadLetterQueue: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

logger.info('[SUPABASE QUEUE] 🚀 Supabase Native Queue System initialized');