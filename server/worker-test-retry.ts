/**
 * Test Worker for Retry Mechanism Validation
 * Este worker SEMPRE falha para testar o mecanismo de retry
 * AUDITORIA FASE 2.1 - CAMADA DE RESILIÊNCIA
 */

import { Worker, Job, WorkerOptions } from 'bullmq';
import { getRedisClient } from './lib/redis-manager';

// Redis connection for test worker - REFATORADO para usar Redis Manager centralizado
let redisConnection: any = null;

async function getWorkerRedisConnection() {
  if (!redisConnection) {
    redisConnection = await getRedisClient();
  }
  return redisConnection;
}

// VERSÃO 1: SEM RETRY (para demonstrar o problema)
// const testWorkerOptions: WorkerOptions = {
//   connection: redisConnection,
//   concurrency: 1,
// };

// VERSÃO 2: COM RETRY (solução implementada) - REFATORADO para async connection
const createTestWorkerOptions = async (): Promise<WorkerOptions> => ({
  connection: await getWorkerRedisConnection(),
  concurrency: 1,
  // CONFIGURAÇÃO DE RETRY - PONTO CRÍTICO DA AUDITORIA
  autorun: true,
  // settings: {
  //   maxStalledCount: 1,
  // },
});

// Test Retry Worker - REFATORADO para inicialização async
let testRetryWorker: Worker | null = null;

async function initTestRetryWorker() {
  if (!testRetryWorker) {
    const workerOptions = await createTestWorkerOptions();
    testRetryWorker = new Worker(
      'test-retry',
      async (job: Job) => {
        const attemptNumber = job.attemptsMade + 1;

        console.log(`[TEST RETRY WORKER] 🔄 Processando job ${job.id}`);
        console.log(`[TEST RETRY WORKER] 📊 Tentativa ${attemptNumber} de ${job.opts.attempts || 1}`);
        console.log(`[TEST RETRY WORKER] ⏰ Timestamp: ${new Date().toISOString()}`);
        console.log(`[TEST RETRY WORKER] 📦 Dados do job:`, job.data);

        // SEMPRE FALHA PROPOSITALMENTE
        console.log(`[TEST RETRY WORKER] 💥 Simulando falha intencional...`);
        throw new Error(`Falha simulada para teste de retry - Tentativa ${attemptNumber}`);
      },
      workerOptions
    );
  }
  return testRetryWorker;
}

// REFATORADO: Event handlers configurados durante a inicialização
async function setupTestRetryWorkerEvents() {
  const worker = await initTestRetryWorker();
  
  // Event handlers para demonstrar o retry
  worker.on('completed', (job) => {
    console.log(
      `[TEST RETRY WORKER] ✅ Job ${job.id} completado (isso nunca deveria acontecer neste teste)`
    );
  });

  worker.on('failed', (job, err) => {
    const attemptNumber = job?.attemptsMade || 0;
    const maxAttempts = job?.opts.attempts || 1;

    console.log(
      `[TEST RETRY WORKER] ❌ Job ${job?.id} falhou na tentativa ${attemptNumber}/${maxAttempts}`
    );
    console.log(`[TEST RETRY WORKER] 📝 Erro: ${err.message}`);

    if (attemptNumber < maxAttempts) {
      // Calcular delay do backoff exponencial
      const backoffDelay = job?.opts.backoff
        ? Math.pow(2, attemptNumber - 1) *
          (typeof job.opts.backoff === 'number'
            ? job.opts.backoff
            : (job.opts.backoff as any)?.delay || 1000)
        : 0;

      console.log(`[TEST RETRY WORKER] 🔄 Retry será tentado em ${backoffDelay}ms`);
      console.log(`[TEST RETRY WORKER] ⏳ Aguardando próxima tentativa...`);
    } else {
      console.log(
        `[TEST RETRY WORKER] 🛑 Todas as tentativas esgotadas. Job falhou definitivamente.`
      );
    }
  });

  worker.on('stalled', (jobId) => {
    console.log(`[TEST RETRY WORKER] ⚠️ Job ${jobId} está travado (stalled)`);
  });

  return worker;
}

// REFATORADO: Inicialização async com Redis Manager
async function startTestRetryWorker() {
  try {
    console.log('[TEST RETRY WORKER] 🚀 Iniciando worker de teste com Redis Manager...');
    console.log('[TEST RETRY WORKER] 🎯 PAM V1.0 - Redis Singleton Refactoring Applied');
    
    const worker = await setupTestRetryWorkerEvents();
    
    console.log('[TEST RETRY WORKER] 📋 Configuração:');
    console.log(`  - Queue: test-retry`);
    console.log(`  - Concorrência: 1`);
    console.log(`  - Comportamento: SEMPRE FALHA (para testar retry)`);
    console.log('[TEST RETRY WORKER] ⏳ Aguardando jobs de teste...');
    
    return worker;
  } catch (error) {
    console.error('[TEST RETRY WORKER] ❌ Falha na inicialização:', error);
    process.exit(1);
  }
}

// Graceful shutdown - REFATORADO para workers dinâmicos
process.on('SIGTERM', async () => {
  console.log('[TEST RETRY WORKER] 🛑 SIGTERM recebido, encerrando worker...');
  if (testRetryWorker) {
    await testRetryWorker.close();
  }
  process.exit(0);
});

// Start the worker
startTestRetryWorker();

export {};
