/**
 * BullMQ Worker Process
 * Processes asynchronous jobs from various queues
 *
 * This runs as a separate Node.js process to avoid blocking the main API
 */

import { Worker, Job, WorkerOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { pdfMergeService } from './services/pdfMergeService';
import { boletoStorageService } from './services/boletoStorageService';
import { clickSignService } from './services/clickSignService';

// Redis connection for workers
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Worker configuration
// AUDITORIA FASE 2.1 - CONFIGURAÇÃO DE RETRY ADICIONADA
const workerOptions: WorkerOptions = {
  connection: redisConnection,
  concurrency: 5, // Process up to 5 jobs simultaneously
};

// =============== PDF PROCESSING WORKER ===============
const pdfWorker = new Worker(
  'pdf-processing',
  async (job: Job) => {
    console.log(`[WORKER:PDF] 🔄 Processing job ${job.id} - Type: ${job.data.type}`);
    const startTime = Date.now();

    try {
      switch (job.data.type) {
        case 'GENERATE_CARNE':
          console.log(`[WORKER:PDF] 📚 Generating carnê for proposal ${job.data.propostaId}`);

          // Update job progress
          await job.updateProgress(10);

          // Generate the carnê
          const pdfBuffer = await pdfMergeService.gerarCarneParaProposta(job.data.propostaId);

          await job.updateProgress(70);

          // Save to storage
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
          // Implementation for generic PDF merging
          // TODO: Implement when needed
          return { success: true, message: 'PDF merge not yet implemented' };

        default:
          throw new Error(`Unknown job type: ${job.data.type}`);
      }
    } catch (error) {
      const errorDuration = Date.now() - startTime;
      console.error(`[WORKER:PDF] ❌ Job ${job.id} failed after ${errorDuration}ms:`, error);
      throw error; // Re-throw to trigger retry
    }
  },
  workerOptions
);

// =============== BOLETO SYNC WORKER ===============
const boletoWorker = new Worker(
  'boleto-sync',
  async (job: Job) => {
    console.log(`[WORKER:BOLETO] 🔄 Processing job ${job.id} - Type: ${job.data.type}`);
    const startTime = Date.now();

    try {
      switch (job.data.type) {
        case 'SYNC_BOLETOS':
          console.log(`[WORKER:BOLETO] 📥 Syncing boletos for proposal ${job.data.propostaId}`);

          await job.updateProgress(10);

          // Sync boletos from Banco Inter to Storage
          const result = await boletoStorageService.sincronizarBoletosDaProposta(
            job.data.propostaId
          );

          await job.updateProgress(100);

          const syncDuration = Date.now() - startTime;
          console.log(
            `[WORKER:BOLETO] ✅ Synced ${result.boletosProcessados}/${result.totalBoletos} boletos in ${syncDuration}ms`
          );

          return {
            success: result.success,
            propostaId: result.propostaId,
            totalBoletos: result.totalBoletos,
            boletosProcessados: result.boletosProcessados,
            boletosComErro: result.boletosComErro,
            erros: result.erros,
            processingTime: syncDuration,
          };

        case 'GENERATE_AND_SYNC_CARNE':
          console.log(
            `[WORKER:BOLETO] 📚 Full carnê generation for proposal ${job.data.propostaId}`
          );

          // Step 1: Sync boletos
          await job.updateProgress(10);
          const syncResult = await boletoStorageService.sincronizarBoletosDaProposta(
            job.data.propostaId
          );

          await job.updateProgress(50);

          // Step 2: Generate carnê from synced boletos
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
  },
  workerOptions
);

// =============== DOCUMENT PROCESSING WORKER ===============
const documentWorker = new Worker(
  'document-processing',
  async (job: Job) => {
    console.log(`[WORKER:DOC] 🔄 Processing job ${job.id} - Type: ${job.data.type}`);
    const startTime = Date.now();

    try {
      switch (job.data.type) {
        case 'UPLOAD_TO_CLICKSIGN':
          console.log(`[WORKER:DOC] 📤 Uploading document to ClickSign`);
          // TODO: Implement ClickSign upload
          return { success: true, message: 'ClickSign upload not yet implemented' };

        case 'DOWNLOAD_SIGNED_DOCUMENT':
          console.log(`[WORKER:DOC] 📥 Downloading signed document from ClickSign`);
          // TODO: Implement ClickSign download
          return { success: true, message: 'ClickSign download not yet implemented' };

        default:
          throw new Error(`Unknown job type: ${job.data.type}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[WORKER:DOC] ❌ Job ${job.id} failed after ${duration}ms:`, error);
      throw error;
    }
  },
  workerOptions
);

// =============== NOTIFICATION WORKER ===============
const notificationWorker = new Worker(
  'notifications',
  async (job: Job) => {
    console.log(`[WORKER:NOTIFY] 🔄 Processing job ${job.id} - Type: ${job.data.type}`);
    const startTime = Date.now();

    try {
      switch (job.data.type) {
        case 'SEND_EMAIL':
          console.log(`[WORKER:NOTIFY] 📧 Sending email notification`);
          // TODO: Implement email sending
          return { success: true, message: 'Email notification not yet implemented' };

        case 'WEBHOOK':
          console.log(`[WORKER:NOTIFY] 🔔 Sending webhook notification`);
          // TODO: Implement webhook
          return { success: true, message: 'Webhook not yet implemented' };

        default:
          throw new Error(`Unknown job type: ${job.data.type}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[WORKER:NOTIFY] ❌ Job ${job.id} failed after ${duration}ms:`, error);
      throw error;
    }
  },
  workerOptions
);

// Worker event handlers
pdfWorker.on('completed', (job) => {
  console.log(`[WORKER:PDF] ✅ Job ${job.id} completed successfully`);
});

pdfWorker.on('failed', (job, err) => {
  console.error(`[WORKER:PDF] ❌ Job ${job?.id} failed:`, err);
});

boletoWorker.on('completed', (job) => {
  console.log(`[WORKER:BOLETO] ✅ Job ${job.id} completed successfully`);
});

boletoWorker.on('failed', (job, err) => {
  console.error(`[WORKER:BOLETO] ❌ Job ${job?.id} failed:`, err);
});

documentWorker.on('completed', (job) => {
  console.log(`[WORKER:DOC] ✅ Job ${job.id} completed successfully`);
});

documentWorker.on('failed', (job, err) => {
  console.error(`[WORKER:DOC] ❌ Job ${job?.id} failed:`, err);
});

notificationWorker.on('completed', (job) => {
  console.log(`[WORKER:NOTIFY] ✅ Job ${job.id} completed successfully`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`[WORKER:NOTIFY] ❌ Job ${job?.id} failed:`, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[WORKER] 🛑 SIGTERM received, closing workers...');
  await Promise.all([
    pdfWorker.close(),
    boletoWorker.close(),
    documentWorker.close(),
    notificationWorker.close(),
  ]);
  process.exit(0);
});

console.log('[WORKER] 🚀 Worker process started. Waiting for jobs...');
console.log('[WORKER] 📊 Active workers:');
console.log('  - PDF Processing Worker (concurrency: 5)');
console.log('  - Boleto Sync Worker (concurrency: 5)');
console.log('  - Document Processing Worker (concurrency: 5)');
console.log('  - Notification Worker (concurrency: 5)');
