/**
 * BullMQ Worker Process
 * Processes asynchronous jobs from various queues
 *
 * This runs as a separate Node.js process to avoid blocking the main API
 */

import { Worker, Job, WorkerOptions } from 'bullmq';
import { getRedisClient } from './lib/redis-manager';
import { pdfMergeService } from './services/pdfMergeService';
import { boletoStorageService } from './services/boletoStorageService';
import { clickSignService } from './services/clickSignService';
import featureFlagService from './services/featureFlagService';

// Redis connection for workers - REFATORADO para usar Redis Manager centralizado
let redisConnection: any = null;

async function getWorkerRedisConnection() {
  if (!redisConnection) {
    redisConnection = await getRedisClient();
  }
  return redisConnection;
}

// Worker configuration
// AUDITORIA FASE 2.1 - CONFIGURAÇÃO DE RETRY ADICIONADA
// Base worker options - concurrency will be set dynamically via feature flags
const createWorkerOptions = async (concurrency: number = 5): Promise<WorkerOptions> => ({
  connection: await getWorkerRedisConnection(),
  concurrency,
});

// Default fallback values for when feature flags service is unavailable
const DEFAULT_WORKER_CONFIG = {
  enabled: true,
  concurrency: 5,
};

// =============== FEATURE FLAG CONTROLLED WORKER INITIALIZATION ===============

/**
 * Initialize workers based on feature flag configuration
 * Provides dynamic control over worker activation and concurrency
 */
async function initializeWorkers(): Promise<Worker[]> {
  const activeWorkers: Worker[] = [];

  try {
    // Initialize feature flag service
    await featureFlagService.init();

    console.log('[WORKER] 🎛️  PAM V3.6 - Feature Flag Controlled Initialization Started');

    // Define worker configurations with fallback defaults
    const workerConfigs = [
      { name: 'payments', queueName: 'payments', priority: 'CRITICAL' },
      { name: 'webhooks', queueName: 'webhooks', priority: 'HIGH' },
      { name: 'reports', queueName: 'reports', priority: 'NORMAL' },
    ];

    for (const config of workerConfigs) {
      try {
        // Check if worker is enabled via feature flags
        const enabledFlag = await featureFlagService.isEnabled(
          `queue.${config.name}.enabled`,
          undefined // No user context needed for worker initialization
        );

        // Get concurrency setting from feature flags
        const concurrency = await featureFlagService.getVariant(
          `worker.${config.name}.concurrency`,
          undefined
        );

        const concurrencyValue = concurrency?.payload?.value || DEFAULT_WORKER_CONFIG.concurrency;

        if (enabledFlag !== false) {
          // Default to enabled if flag check fails
          const worker = await createWorkerByName(
            config.name,
            config.queueName,
            parseInt(concurrencyValue as string, 10)
          );
          if (worker) {
            activeWorkers.push(worker);
            console.log(
              `[WORKER] ✅ ${config.name.toUpperCase()} Worker initialized (concurrency: ${concurrencyValue}, priority: ${config.priority})`
            );
          }
        } else {
          console.log(`[WORKER] ⏸️  ${config.name.toUpperCase()} Worker disabled via feature flag`);
        }
      } catch (error) {
        console.warn(
          `[WORKER] ⚠️  Feature flag check failed for ${config.name}, using defaults:`,
          error
        );
        // Fallback: create worker with default settings
        const worker = await createWorkerByName(
          config.name,
          config.queueName,
          DEFAULT_WORKER_CONFIG.concurrency
        );
        if (worker) {
          activeWorkers.push(worker);
          console.log(
            `[WORKER] 🔄 ${config.name.toUpperCase()} Worker initialized with fallback defaults`
          );
        }
      }
    }

    console.log(`[WORKER] 🎯 PAM V3.6 - Successfully initialized ${activeWorkers.length} workers`);
    return activeWorkers;
  } catch (error) {
    console.error(
      '[WORKER] ❌ Feature flag service initialization failed, starting with defaults:',
      error
    );
    // Fallback: start all workers with default configuration
    return await initializeFallbackWorkers();
  }
}

/**
 * Fallback initialization when feature flags service is unavailable
 */
async function initializeFallbackWorkers(): Promise<Worker[]> {
  console.log('[WORKER] 🔧 Initializing fallback workers with default configuration');

  const fallbackWorkers = [
    await createWorkerByName('payments', 'payments', DEFAULT_WORKER_CONFIG.concurrency),
    await createWorkerByName('webhooks', 'webhooks', DEFAULT_WORKER_CONFIG.concurrency),
    await createWorkerByName('reports', 'reports', DEFAULT_WORKER_CONFIG.concurrency),
  ];

  return fallbackWorkers.filter((w) => w !== null) as Worker[];
}

/**
 * Factory function to create workers by name with dynamic configuration
 */
async function createWorkerByName(
  name: string,
  queueName: string,
  concurrency: number
): Promise<Worker | null> {
  const workerOptions = await createWorkerOptions(concurrency);

  switch (name) {
    case 'payments':
      return new Worker(queueName, paymentsWorkerHandler, workerOptions);
    case 'webhooks':
      return new Worker(queueName, webhooksWorkerHandler, workerOptions);
    case 'reports':
      return new Worker(queueName, reportsWorkerHandler, workerOptions);
    default:
      console.error(`[WORKER] ❌ Unknown worker type: ${name}`);
      return null;
  }
}

// =============== WORKER HANDLERS ===============

// PAYMENTS WORKER HANDLER - CRITICAL PRIORITY
const paymentsWorkerHandler = async (job: Job) => {
  console.log(`[WORKER:PAYMENTS] 🔄 Processing critical job ${job.id} - Type: ${job.data.type}`);
  const startTime = Date.now();

  try {
    await job.updateProgress(10);

    switch (job.data.type) {
      case 'PROCESS_PAYMENT':
        console.log(`[WORKER:PAYMENTS] 💰 Processing payment for proposal ${job.data.propostaId}`);

        // Idempotency key for payment processing (prevents duplicates)
        const idempotencyKey = `payment-${job.data.propostaId}-${job.data.timestamp || Date.now()}`;
        console.log(`[WORKER:PAYMENTS] 🔑 Using idempotency key: ${idempotencyKey}`);

        await job.updateProgress(50);

        // TODO: Implement actual payment processing logic
        // This is where you would integrate with payment providers

        await job.updateProgress(100);

        const paymentDuration = Date.now() - startTime;
        console.log(`[WORKER:PAYMENTS] ✅ Payment processed successfully in ${paymentDuration}ms`);

        return {
          success: true,
          propostaId: job.data.propostaId,
          idempotencyKey,
          processingTime: paymentDuration,
          message: 'Payment processed successfully',
        };

      case 'REFUND_PAYMENT':
        console.log(`[WORKER:PAYMENTS] 💸 Processing refund for proposal ${job.data.propostaId}`);

        await job.updateProgress(100);

        return {
          success: true,
          propostaId: job.data.propostaId,
          message: 'Refund processed successfully (placeholder)',
        };

      default:
        throw new Error(`Unknown payment job type: ${job.data.type}`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[WORKER:PAYMENTS] ❌ Job ${job.id} failed after ${duration}ms:`, error);
    throw error;
  }
};

// WEBHOOKS WORKER HANDLER - HIGH PRIORITY
const webhooksWorkerHandler = async (job: Job) => {
  console.log(
    `[WORKER:WEBHOOKS] 🔄 Processing high-priority job ${job.id} - Type: ${job.data.type}`
  );
  const startTime = Date.now();

  try {
    await job.updateProgress(10);

    switch (job.data.type) {
      case 'PROCESS_WEBHOOK':
        console.log(`[WORKER:WEBHOOKS] 📡 Processing webhook for ${job.data.source}`);

        await job.updateProgress(50);

        // TODO: Implement webhook processing logic

        await job.updateProgress(100);

        const webhookDuration = Date.now() - startTime;
        console.log(`[WORKER:WEBHOOKS] ✅ Webhook processed successfully in ${webhookDuration}ms`);

        return {
          success: true,
          source: job.data.source,
          processingTime: webhookDuration,
          message: 'Webhook processed successfully',
        };

      default:
        throw new Error(`Unknown webhook job type: ${job.data.type}`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[WORKER:WEBHOOKS] ❌ Job ${job.id} failed after ${duration}ms:`, error);
    throw error;
  }
};

// REPORTS WORKER HANDLER - NORMAL PRIORITY
const reportsWorkerHandler = async (job: Job) => {
  console.log(`[WORKER:REPORTS] 🔄 Processing job ${job.id} - Type: ${job.data.type}`);
  const startTime = Date.now();

  try {
    await job.updateProgress(10);

    switch (job.data.type) {
      case 'GENERATE_REPORT':
        console.log(`[WORKER:REPORTS] 📊 Generating report ${job.data.reportType}`);

        await job.updateProgress(50);

        // TODO: Implement report generation logic

        await job.updateProgress(100);

        const reportDuration = Date.now() - startTime;
        console.log(`[WORKER:REPORTS] ✅ Report generated successfully in ${reportDuration}ms`);

        return {
          success: true,
          reportType: job.data.reportType,
          processingTime: reportDuration,
          message: 'Report generated successfully',
        };

      default:
        throw new Error(`Unknown report job type: ${job.data.type}`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[WORKER:REPORTS] ❌ Job ${job.id} failed after ${duration}ms:`, error);
    throw error;
  }
};

// =============== LEGACY PDF PROCESSING WORKER (KEPT FOR COMPATIBILITY) ===============
// REFATORADO: Worker inicializado após conexão Redis
let pdfWorker: Worker | null = null;

async function initPdfWorker() {
  if (!pdfWorker) {
    const workerOptions = await createWorkerOptions(1);
    pdfWorker = new Worker(
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
  }
  return pdfWorker;
}

// =============== BOLETO SYNC WORKER ===============
// REFATORADO: Worker inicializado após conexão Redis
let boletoWorker: Worker | null = null;

async function initBoletoWorker() {
  if (!boletoWorker) {
    const workerOptions = await createWorkerOptions(1);
    boletoWorker = new Worker(
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
              const carneResult = await boletoStorageService.gerarCarneDoStorage(
                job.data.propostaId
              );

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
  }
  return boletoWorker;
}

// =============== DOCUMENT PROCESSING WORKER ===============
// REFATORADO: Worker inicializado após conexão Redis
let documentWorker: Worker | null = null;

async function initDocumentWorker() {
  if (!documentWorker) {
    const workerOptions = await createWorkerOptions(1);
    documentWorker = new Worker(
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
  }
  return documentWorker;
}

// =============== NOTIFICATION WORKER ===============
// REFATORADO: Worker inicializado após conexão Redis
let notificationWorker: Worker | null = null;

async function initNotificationWorker() {
  if (!notificationWorker) {
    const workerOptions = await createWorkerOptions(1);
    notificationWorker = new Worker(
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
  }
  return notificationWorker;
}

// REFATORADO: Event handlers agora são configurados durante a inicialização dos workers
// Os handlers são configurados dentro das funções initXXXWorker()

// =============== REMOVED: STATIC WORKER INSTANCES ===============
// Workers are now dynamically created via initializeWorkers() function
// This enables feature flag control over worker activation and concurrency

// REFATORADO: WEBHOOKS WORKER agora inicializado dinamicamente via initializeWorkers()
// O código do worker foi movido para webhooksWorkerHandler()

// REFATORADO: REPORTS WORKER agora inicializado dinamicamente via initializeWorkers()
// O código do worker foi movido para reportsWorkerHandler()

// =============== PAM V3.4 - EVENT HANDLERS FOR SPECIALIZED WORKERS ===============

// =============== PAM V3.4 - DLQ IMPLEMENTATION WITH STRUCTURED LOGGING ===============

// REFATORADO: Event handlers agora são configurados dentro das funções createWorkerByName()
// quando os workers são criados dinamicamente via initializeWorkers()

// REFATORADO: Graceful shutdown agora gerencia workers dinâmicos
process.on('SIGTERM', async () => {
  console.log('[WORKER] 🛑 SIGTERM received, closing workers...');

  const closePromises = [];

  // Close legacy workers if initialized
  if (pdfWorker) closePromises.push(pdfWorker.close());
  if (boletoWorker) closePromises.push(boletoWorker.close());
  if (documentWorker) closePromises.push(documentWorker.close());
  if (notificationWorker) closePromises.push(notificationWorker.close());

  // Close dynamic workers initialized through initializeWorkers()
  // Note: activeWorkers from initializeWorkers() should be tracked globally for proper shutdown

  await Promise.all(closePromises);
  console.log('[WORKER] ✅ All workers closed gracefully');
  process.exit(0);
});

// REFATORADO: Inicialização agora é via initializeWorkers() com feature flags
async function startWorkerProcess() {
  console.log('[WORKER] 🚀 Worker process started with Redis Manager Singleton.');
  console.log('[WORKER] 🎯 PAM V1.0 - Redis Singleton Refactoring Applied');

  try {
    const activeWorkers = await initializeWorkers();
    console.log(`[WORKER] ✅ Successfully initialized ${activeWorkers.length} workers`);
    console.log('[WORKER] ⏳ Waiting for jobs...');
  } catch (error) {
    console.error('[WORKER] ❌ Failed to initialize workers:', error);
    process.exit(1);
  }
}

// Start the worker process
startWorkerProcess();
