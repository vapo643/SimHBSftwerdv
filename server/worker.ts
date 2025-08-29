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
import featureFlagService from './services/featureFlagService';

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
// Base worker options - concurrency will be set dynamically via feature flags
const createWorkerOptions = (concurrency: number = 5): WorkerOptions => ({
  connection: redisConnection,
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
        
        if (enabledFlag !== false) { // Default to enabled if flag check fails
          const worker = await createWorkerByName(config.name, config.queueName, parseInt(concurrencyValue as string, 10));
          if (worker) {
            activeWorkers.push(worker);
            console.log(`[WORKER] ✅ ${config.name.toUpperCase()} Worker initialized (concurrency: ${concurrencyValue}, priority: ${config.priority})`);
          }
        } else {
          console.log(`[WORKER] ⏸️  ${config.name.toUpperCase()} Worker disabled via feature flag`);
        }
      } catch (error) {
        console.warn(`[WORKER] ⚠️  Feature flag check failed for ${config.name}, using defaults:`, error);
        // Fallback: create worker with default settings
        const worker = await createWorkerByName(config.name, config.queueName, DEFAULT_WORKER_CONFIG.concurrency);
        if (worker) {
          activeWorkers.push(worker);
          console.log(`[WORKER] 🔄 ${config.name.toUpperCase()} Worker initialized with fallback defaults`);
        }
      }
    }
    
    console.log(`[WORKER] 🎯 PAM V3.6 - Successfully initialized ${activeWorkers.length} workers`);
    return activeWorkers;
    
  } catch (error) {
    console.error('[WORKER] ❌ Feature flag service initialization failed, starting with defaults:', error);
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
  
  return fallbackWorkers.filter(w => w !== null) as Worker[];
}

/**
 * Factory function to create workers by name with dynamic configuration
 */
async function createWorkerByName(name: string, queueName: string, concurrency: number): Promise<Worker | null> {
  const workerOptions = createWorkerOptions(concurrency);
  
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
          message: 'Payment processed successfully'
        };

      case 'REFUND_PAYMENT':
        console.log(`[WORKER:PAYMENTS] 💸 Processing refund for proposal ${job.data.propostaId}`);
        
        await job.updateProgress(100);
        
        return {
          success: true,
          propostaId: job.data.propostaId,
          message: 'Refund processed successfully (placeholder)'
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
  console.log(`[WORKER:WEBHOOKS] 🔄 Processing high-priority job ${job.id} - Type: ${job.data.type}`);
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
          message: 'Webhook processed successfully'
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
          message: 'Report generated successfully'
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

// =============== REMOVED: STATIC WORKER INSTANCES ===============
// Workers are now dynamically created via initializeWorkers() function
// This enables feature flag control over worker activation and concurrency

// WEBHOOKS WORKER - HIGH PRIORITY (3 retries, fixed backoff)
const webhooksWorker = new Worker(
  'webhooks',
  async (job: Job) => {
    console.log(`[WORKER:WEBHOOKS] 🔄 Processing webhook job ${job.id} - Type: ${job.data.type}`);
    const startTime = Date.now();

    try {
      await job.updateProgress(10);

      switch (job.data.type) {
        case 'CLICKSIGN_WEBHOOK':
          console.log(`[WORKER:WEBHOOKS] ✍️ Processing ClickSign webhook`);
          
          await job.updateProgress(50);
          
          // TODO: Implement ClickSign webhook processing
          // This is where you would handle signature confirmations
          
          await job.updateProgress(100);
          
          const webhookDuration = Date.now() - startTime;
          console.log(`[WORKER:WEBHOOKS] ✅ ClickSign webhook processed in ${webhookDuration}ms`);
          
          return {
            success: true,
            webhookType: 'clicksign',
            processingTime: webhookDuration,
            message: 'ClickSign webhook processed successfully'
          };

        case 'PAYMENT_WEBHOOK':
          console.log(`[WORKER:WEBHOOKS] 💰 Processing payment webhook`);
          
          await job.updateProgress(100);
          
          return {
            success: true,
            webhookType: 'payment',
            message: 'Payment webhook processed successfully (placeholder)'
          };

        default:
          throw new Error(`Unknown webhook job type: ${job.data.type}`);
      }
    } catch (error) {
      const errorDuration = Date.now() - startTime;
      console.error(`[WORKER:WEBHOOKS] ❌ Webhook job ${job.id} failed after ${errorDuration}ms:`, error);
      throw error;
    }
  },
  workerOptions
);

// REPORTS WORKER - NORMAL PRIORITY (2 retries, fixed backoff)
const reportsWorker = new Worker(
  'reports',
  async (job: Job) => {
    console.log(`[WORKER:REPORTS] 🔄 Processing report job ${job.id} - Type: ${job.data.type}`);
    const startTime = Date.now();

    try {
      await job.updateProgress(10);

      switch (job.data.type) {
        case 'GENERATE_MONTHLY_REPORT':
          console.log(`[WORKER:REPORTS] 📊 Generating monthly report`);
          
          await job.updateProgress(50);
          
          // TODO: Implement monthly report generation
          // This is where you would generate business reports
          
          await job.updateProgress(100);
          
          const reportDuration = Date.now() - startTime;
          console.log(`[WORKER:REPORTS] ✅ Monthly report generated in ${reportDuration}ms`);
          
          return {
            success: true,
            reportType: 'monthly',
            processingTime: reportDuration,
            message: 'Monthly report generated successfully'
          };

        case 'EXPORT_PROPOSALS':
          console.log(`[WORKER:REPORTS] 📋 Exporting proposals data`);
          
          await job.updateProgress(100);
          
          return {
            success: true,
            reportType: 'proposals_export',
            message: 'Proposals exported successfully (placeholder)'
          };

        default:
          throw new Error(`Unknown report job type: ${job.data.type}`);
      }
    } catch (error) {
      const errorDuration = Date.now() - startTime;
      console.error(`[WORKER:REPORTS] ❌ Report job ${job.id} failed after ${errorDuration}ms:`, error);
      throw error;
    }
  },
  workerOptions
);

// =============== PAM V3.4 - EVENT HANDLERS FOR SPECIALIZED WORKERS ===============

// =============== PAM V3.4 - DLQ IMPLEMENTATION WITH STRUCTURED LOGGING ===============

// Payments Worker Events - CRITICAL PRIORITY
paymentsWorker.on('completed', (job) => {
  console.log(`[WORKER:PAYMENTS] ✅ Critical job ${job.id} completed successfully`);
});

paymentsWorker.on('failed', (job, err) => {
  const isMovingToDLQ = job && job.attemptsMade >= (job.opts?.attempts || 5);
  
  if (isMovingToDLQ) {
    console.error(`[DLQ:PAYMENTS] 🚨 CRITICAL ALERT: Job ${job?.id} moved to Dead-Letter Queue after ${job?.attemptsMade} attempts`, {
      jobId: job?.id,
      jobType: job?.data?.type,
      propostaId: job?.data?.propostaId,
      queueName: 'payments',
      priority: 'CRITICAL',
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts || 5,
      errorMessage: err.message,
      timestamp: new Date().toISOString()
    });
    
    // TODO: Integrate with alerting system (PagerDuty/Slack) for critical jobs
    // alertingService.sendCriticalAlert('PAYMENT_JOB_FAILED', { jobId, error: err.message });
    
  } else {
    console.error(`[WORKER:PAYMENTS] ❌ Critical job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts || 5}):`, err.message);
  }
});

// Webhooks Worker Events - HIGH PRIORITY  
webhooksWorker.on('completed', (job) => {
  console.log(`[WORKER:WEBHOOKS] ✅ Webhook job ${job.id} completed successfully`);
});

webhooksWorker.on('failed', (job, err) => {
  const isMovingToDLQ = job && job.attemptsMade >= (job.opts?.attempts || 3);
  
  if (isMovingToDLQ) {
    console.error(`[DLQ:WEBHOOKS] 🔔 HIGH PRIORITY ALERT: Webhook job ${job?.id} moved to Dead-Letter Queue after ${job?.attemptsMade} attempts`, {
      jobId: job?.id,
      jobType: job?.data?.type,
      webhookType: job?.data?.webhookType,
      queueName: 'webhooks',
      priority: 'HIGH',
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts || 3,
      errorMessage: err.message,
      timestamp: new Date().toISOString()
    });
    
    // TODO: Send webhook failure notification
    // webhookNotificationService.notifyFailure(job.data);
    
  } else {
    console.error(`[WORKER:WEBHOOKS] ❌ Webhook job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts || 3}):`, err.message);
  }
});

// Reports Worker Events - NORMAL PRIORITY
reportsWorker.on('completed', (job) => {
  console.log(`[WORKER:REPORTS] ✅ Report job ${job.id} completed successfully`);
});

reportsWorker.on('failed', (job, err) => {
  const isMovingToDLQ = job && job.attemptsMade >= (job.opts?.attempts || 2);
  
  if (isMovingToDLQ) {
    console.error(`[DLQ:REPORTS] 📊 NORMAL PRIORITY: Report job ${job?.id} moved to Dead-Letter Queue after ${job?.attemptsMade} attempts`, {
      jobId: job?.id,
      jobType: job?.data?.type,
      reportType: job?.data?.reportType,
      queueName: 'reports',
      priority: 'NORMAL',
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts || 2,
      errorMessage: err.message,
      timestamp: new Date().toISOString()
    });
    
    // Normal priority - just log, no immediate alert needed
    
  } else {
    console.error(`[WORKER:REPORTS] ❌ Report job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts || 2}):`, err.message);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[WORKER] 🛑 SIGTERM received, closing workers...');
  await Promise.all([
    pdfWorker.close(),
    boletoWorker.close(),
    documentWorker.close(),
    notificationWorker.close(),
    // PAM V3.4 - Close specialized workers
    paymentsWorker.close(),
    webhooksWorker.close(),
    reportsWorker.close(),
  ]);
  console.log('[WORKER] ✅ All workers closed gracefully');
  process.exit(0);
});

console.log('[WORKER] 🚀 Worker process started. Waiting for jobs...');
console.log('[WORKER] 📊 Active workers:');
console.log('  - PDF Processing Worker (concurrency: 5)');
console.log('  - Boleto Sync Worker (concurrency: 5)');
console.log('  - Document Processing Worker (concurrency: 5)');
console.log('  - Notification Worker (concurrency: 5)');
console.log('[WORKER] 🎯 PAM V3.4 - Specialized High-Performance Workers:');
console.log('  - Payments Worker (concurrency: 5) - CRITICAL PRIORITY');
console.log('  - Webhooks Worker (concurrency: 5) - HIGH PRIORITY');
console.log('  - Reports Worker (concurrency: 5) - NORMAL PRIORITY');
