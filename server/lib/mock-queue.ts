/**
 * Mock Queue Implementation for Development
 * REFATORADO: Agora executa a lógica REAL do worker em vez de apenas simular
 *
 * In production, use the real queues.ts with Redis
 */

import { EventEmitter } from 'events';
import { pdfMergeService } from '../services/pdfMergeService';
import { boletoStorageService } from '../services/boletoStorageService';
import { clickSignService } from '../services/clickSignService';

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
    console.log(`[DEV JOB ${this.id}] Progress: ${progress}%`);
  }
}

class MockQueue extends EventEmitter {
  private jobs: Map<string, JobData> = new Map();
  private activeJobs: Map<string, MockJob> = new Map();
  private jobCounter = 0;
  name: string;

  constructor(name: string) {
    super();
    this.name = name;
    console.log(`[DEV QUEUE] 📦 Created development queue: ${name}`);
  }

  async add(jobName: string, data: any) {
    const jobId = `${this.name}-${++this.jobCounter}`;
    const job = new MockJob(jobId, jobName, data);

    const jobData: JobData = {
      id: jobId,
      name: jobName,
      data,
      status: 'waiting',
      progress: 0,
      createdAt: new Date(),
    };

    this.jobs.set(jobId, jobData);
    this.activeJobs.set(jobId, job); // Armazenar o MockJob também

    console.log(`[DEV QUEUE ${this.name}] ➕ Added job ${jobId}:`, {
      name: jobName,
      data,
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

    console.log(`[DEV QUEUE ${this.name}] 🔄 Processing job ${jobId}`);
    console.log(`[DEV QUEUE ${this.name}] Executando lógica REAL do worker...`);

    const startTime = Date.now();

    try {
      // REFATORAÇÃO: Executar a lógica REAL do worker baseado no tipo de fila
      let result: any;

      // Criar um mock job com interface compatível
      const mockJob = {
        id: jobId,
        data: jobData.data,
        updateProgress: async (progress: number) => {
          jobData.progress = progress;
          console.log(`[DEV JOB ${jobId}] Progress: ${progress}%`);
        },
      };

      // Executar processamento real baseado na fila
      switch (this.name) {
        case 'pdf-processing':
          result = await this.processPdfJob(mockJob);
          break;

        case 'boleto-sync':
          result = await this.processBoletoJob(mockJob);
          break;

        case 'document-processing':
          // TODO: Implementar quando necessário
          result = { success: true, message: 'Document processing not yet implemented' };
          break;

        case 'notifications':
          // TODO: Implementar quando necessário
          result = { success: true, message: 'Notification processing not yet implemented' };
          break;

        default:
          throw new Error(`Unknown queue: ${this.name}`);
      }

      jobData.status = 'completed';
      jobData.completedAt = new Date();
      jobData.progress = 100;
      (jobData as any).result = result; // Salvar o resultado para o getJob

      const duration = Date.now() - startTime;
      console.log(`[DEV QUEUE ${this.name}] ✅ Job ${jobId} completed in ${duration}ms`);
      console.log(`[DEV QUEUE ${this.name}] Result:`, result);

      this.emit('completed', { ...jobData, result });
    } catch (error: any) {
      jobData.status = 'failed';
      jobData.failedReason = error.message || 'Unknown error';
      jobData.completedAt = new Date();

      const duration = Date.now() - startTime;
      console.error(`[DEV QUEUE ${this.name}] ❌ Job ${jobId} failed after ${duration}ms:`, error);

      this.emit('failed', { ...jobData, error });
    }
  }

  /**
   * Processar jobs de PDF (carnê) - Lógica REAL do worker.ts
   */
  private async processPdfJob(job: any) {
    console.log(`[WORKER:PDF] 🔄 Processing job ${job.id} - Type: ${job.data.type}`);
    const startTime = Date.now();

    try {
      switch (job.data.type) {
        case 'GENERATE_CARNE':
          console.log(`[WORKER:PDF] 📚 Generating carnê for proposal ${job.data.propostaId}`);

          await job.updateProgress(10);

          // Gerar o carnê usando o serviço real
          const pdfBuffer = await pdfMergeService.gerarCarneParaProposta(job.data.propostaId);

          await job.updateProgress(70);

          // Salvar no storage
          const signedUrl = await pdfMergeService.salvarCarneNoStorage(
            job.data.propostaId,
            pdfBuffer
          );

          await job.updateProgress(100);

          const pdfDuration = Date.now() - startTime;
          console.log(`[WORKER:PDF] ✅ Carnê generated successfully in ${pdfDuration}ms`);

          return {
            success: true,
            propostaId: job.data.propostaId,
            url: signedUrl,
            size: pdfBuffer.length,
            processingTime: pdfDuration,
          };

        case 'MERGE_PDFS':
          console.log(`[WORKER:PDF] 🔀 Merging PDFs for proposal ${job.data.propostaId}`);
          return { success: true, message: 'PDF merge not yet implemented' };

        default:
          throw new Error(`Unknown job type: ${job.data.type}`);
      }
    } catch (error) {
      const errorDuration = Date.now() - startTime;
      console.error(`[WORKER:PDF] ❌ Job ${job.id} failed after ${errorDuration}ms:`, error);
      throw error;
    }
  }

  /**
   * Processar jobs de boleto - Lógica REAL do worker.ts
   */
  private async processBoletoJob(job: any) {
    console.log(`[WORKER:BOLETO] 🔄 Processing job ${job.id} - Type: ${job.data.type}`);
    const startTime = Date.now();

    try {
      switch (job.data.type) {
        case 'SYNC_BOLETOS':
        case 'SYNC_PROPOSAL_BOLETOS': // PAM V1.0 - Suporte para fallback assíncrono de PDFs
          console.log(`[WORKER:BOLETO] 📥 Syncing boletos for proposal ${job.data.propostaId}`);

          await job.updateProgress(10);

          // Sincronizar boletos usando o serviço real
          const result = await boletoStorageService.sincronizarBoletosDaProposta(
            job.data.propostaId
          );

          await job.updateProgress(100);

          const syncDuration = Date.now() - startTime;
          console.log(
            `[WORKER:BOLETO] ✅ Synced ${result.boletosProcessados}/${result.totalBoletos} boletos in ${syncDuration}ms`
          );

          // Se foi um fallback de PDF específico, log adicional
          if (job.data.requestedPdf) {
            console.log(
              `[WORKER:BOLETO] 🎯 Fallback para PDF ${job.data.requestedPdf} processado com sucesso`
            );
          }

          return {
            success: result.success,
            propostaId: result.propostaId,
            totalBoletos: result.totalBoletos,
            boletosProcessados: result.boletosProcessados,
            boletosComErro: result.boletosComErro,
            erros: result.erros,
            processingTime: syncDuration,
            requestedPdf: job.data.requestedPdf, // Incluir PDF solicitado se foi fallback
          };

        case 'GENERATE_AND_SYNC_CARNE':
          console.log(
            `[WORKER:BOLETO] 📚 Full carnê generation for proposal ${job.data.propostaId}`
          );

          await job.updateProgress(10);
          const syncResult = await boletoStorageService.sincronizarBoletosDaProposta(
            job.data.propostaId
          );

          await job.updateProgress(50);

          const carneResult = await boletoStorageService.gerarCarneDoStorage(job.data.propostaId);

          await job.updateProgress(100);

          const fullDuration = Date.now() - startTime;
          console.log(`[WORKER:BOLETO] ✅ Full carnê process completed in ${fullDuration}ms`);

          return {
            success: carneResult.success,
            propostaId: job.data.propostaId,
            syncResult,
            carneUrl: carneResult.url,
            processingTime: fullDuration,
          };

        default:
          throw new Error(`Unknown job type: ${job.data.type}`);
      }
    } catch (error) {
      const boletoErrorDuration = Date.now() - startTime;
      console.error(
        `[WORKER:BOLETO] ❌ Job ${job.id} failed after ${boletoErrorDuration}ms:`,
        error
      );
      throw error;
    }
  }

  async getJobCounts() {
    const counts = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    };

    this.jobs.forEach((job) => {
      counts[job.status]++;
    });

    return counts;
  }

  /**
   * Buscar um job pelo ID
   */
  async getJob(jobId: string): Promise<any> {
    const jobData = this.jobs.get(jobId);
    const mockJob = this.activeJobs.get(jobId);

    if (!jobData || !mockJob) {
      return null;
    }

    // Adicionar propriedades extras para compatibilidade com o endpoint de status
    const job = mockJob as any;
    job.getState = async () => jobData.status;
    job.progress = jobData.progress;
    job.returnvalue = jobData.status === 'completed' ? (jobData as any).result : null;
    job.failedReason = jobData.failedReason;
    job.timestamp = jobData.createdAt.getTime();
    job.processedOn = jobData.processedAt?.getTime();
    job.finishedOn = jobData.completedAt?.getTime();

    return job;
  }
}

class MockWorker extends EventEmitter {
  private queueName: string;
  private processor: Function;

  constructor(queueName: string, processor: Function, options?: any) {
    super();
    this.queueName = queueName;
    this.processor = processor;

    console.log(`[DEV WORKER] 👷 Created mock worker for queue: ${queueName}`);

    // Simulate worker ready
    setTimeout(() => {
      console.log(`[DEV WORKER] ✅ Worker ready for queue: ${queueName}`);
    }, 100);
  }

  async close() {
    console.log(`[DEV WORKER] 🛑 Closing worker for queue: ${this.queueName}`);
  }
}

// Mock Redis connection
class MockRedis {
  constructor(config: any) {
    console.log(`[DEV REDIS] 🔴 Mock Redis initialized (no actual connection)`);
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

// PAM V1.0 - Helper function to get queue by name
export function getQueue(queueName: string): MockQueue {
  switch (queueName) {
    case 'pdf-processing':
      return pdfProcessingQueue;
    case 'boleto-sync':
      return boletoSyncQueue;
    case 'document-processing':
      return documentQueue;
    case 'notifications':
      return notificationQueue;
    default:
      throw new Error(`Queue ${queueName} not found`);
  }
}

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
      mode: 'DEV (Development)',
      queues: {
        pdfProcessing: results[0],
        boletoSync: results[1],
        document: results[2],
        notification: results[3],
      },
    };
  } catch (error) {
    console.error('[DEV QUEUE] Health check failed:', error);
    return {
      healthy: false,
      mode: 'DEV (Development)',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export mock implementations for worker
export { MockWorker as Worker, MockJob as Job, MockRedis as Redis };
export type { JobData as JobType };

console.log('[DEV QUEUE] 🚀 Development queues initialized with REAL worker processing');
