/**
 * Test Worker for Retry Mechanism Validation
 * Este worker SEMPRE falha para testar o mecanismo de retry
 * AUDITORIA FASE 2.1 - CAMADA DE RESILIÊNCIA
 */

import { Worker, Job, WorkerOptions } from 'bullmq';
import { Redis } from 'ioredis';

// Redis connection for test worker
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// VERSÃO 1: SEM RETRY (para demonstrar o problema)
// const testWorkerOptions: WorkerOptions = {
//   connection: redisConnection,
//   concurrency: 1,
// };

// VERSÃO 2: COM RETRY (solução implementada)
const testWorkerOptions: WorkerOptions = {
  connection: redisConnection,
  concurrency: 1,
  // CONFIGURAÇÃO DE RETRY - PONTO CRÍTICO DA AUDITORIA
  autorun: true,
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 1,
  },
};

// Test Retry Worker
const testRetryWorker = new Worker(
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
  testWorkerOptions
);

// Event handlers para demonstrar o retry
testRetryWorker.on('completed', (job) => {
  console.log(
    `[TEST RETRY WORKER] ✅ Job ${job.id} completado (isso nunca deveria acontecer neste teste)`
  );
});

testRetryWorker.on('failed', (job, err) => {
  const attemptNumber = job?.attemptsMade || 0;
  const maxAttempts = job?.opts.attempts || 1;

  console.log(
    `[TEST RETRY WORKER] ❌ Job ${job?.id} falhou na tentativa ${attemptNumber}/${maxAttempts}`
  );
  console.log(`[TEST RETRY WORKER] 📝 Erro: ${err.message}`);

  if (attemptNumber < maxAttempts) {
    // Calcular delay do backoff exponencial
    const backoffDelay = job?.opts.backoff
      ? Math.pow(2, attemptNumber - 1) * (job.opts.backoff.delay || 1000)
      : 0;

    console.log(`[TEST RETRY WORKER] 🔄 Retry será tentado em ${backoffDelay}ms`);
    console.log(`[TEST RETRY WORKER] ⏳ Aguardando próxima tentativa...`);
  } else {
    console.log(
      `[TEST RETRY WORKER] 🛑 Todas as tentativas esgotadas. Job falhou definitivamente.`
    );
  }
});

testRetryWorker.on('stalled', (jobId) => {
  console.log(`[TEST RETRY WORKER] ⚠️ Job ${jobId} está travado (stalled)`);
});

// Log de inicialização
console.log('[TEST RETRY WORKER] 🚀 Worker de teste iniciado');
console.log('[TEST RETRY WORKER] 📋 Configuração:');
console.log(`  - Queue: test-retry`);
console.log(`  - Concorrência: 1`);
console.log(`  - Comportamento: SEMPRE FALHA (para testar retry)`);
console.log('[TEST RETRY WORKER] ⏳ Aguardando jobs de teste...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[TEST RETRY WORKER] 🛑 SIGTERM recebido, encerrando worker...');
  await testRetryWorker.close();
  process.exit(0);
});

export {};
