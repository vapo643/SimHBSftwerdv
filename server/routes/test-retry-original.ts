/**
 * Test endpoint for retry mechanism validation
 * This is a temporary test to validate the retry/backoff functionality
 * AUDITORIA FASE 2.1 - CAMADA DE RESILIÊNCIA
 */

import { Router } from 'express';
import type { Request, Response } from 'express';

const _router = Router();

/**
 * POST /api/test/retry
 * Adiciona um job de teste que SEMPRE falha para validar retry
 */
router.post('/retry', async (req: Request, res: Response) => {
  try {
    console.log('[TEST RETRY] 🧪 Iniciando teste de retry mechanism');

    const _isDevelopment = process.env.NODE_ENV == 'development';

    if (isDevelopment) {
      // Usar mock queue em desenvolvimento
      const { queues } = await import('../lib/mock-queue');

      // Criar uma fila de teste se não existir
      if (!(queues as unknown).testRetry) {
        console.log('[TEST RETRY] 📦 Criando fila test-retry');
        const _mockQueue = await import('../lib/mock-queue');
        // @ts-ignore
        (queues as unknown).testRetry = new (mockQueue as unknown).MockQueue('test-retry');
      }

      const _queue = (queues as unknown).testRetry;

      const _testData = {
        type: 'TEST_RETRY_FAILURE',
        timestamp: new Date().toISOString(),
        message: 'Este job sempre falha para testar retry',
        testId: Date.now(),
      };

      const _job = await queue.add('test-retry-job', testData);

      console.log(`[TEST RETRY] ✅ Job ${job.id} adicionado à fila test-retry`);

      return res.json({
        success: true,
        message: 'Job de teste (que sempre falha) adicionado à fila',
        jobId: job.id,
        queue: 'test-retry',
        mode: 'development (mock queue)',
        data: testData,
        hint: 'Observe os logs do worker para ver as tentativas de retry',
      });
    } else {
      // Usar queue real em produção
      const { Queue } = await import('bullmq');
      const { Redis } = await import('ioredis');

      const _connection = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

      const _testRetryQueue = new Queue('test-retry', {
        _connection,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      });

      const _testData = {
        type: 'TEST_RETRY_FAILURE',
        timestamp: new Date().toISOString(),
        message: 'Este job sempre falha para testar retry',
        testId: Date.now(),
      };

      const _job = await testRetryQueue.add('test-retry-job', testData);

      console.log(
        `[TEST RETRY] ✅ Job ${job.id} adicionado à fila test-retry com retry configurado`
      );

      return res.json({
        success: true,
        message: 'Job de teste (que sempre falha) adicionado à fila',
        jobId: job.id,
        queue: 'test-retry',
        mode: 'production (Redis)',
        retryConfig: {
          attempts: 5,
          backoff: 'exponential',
          initialDelay: 2000,
        },
        data: testData,
        hint: 'Observe os logs do worker para ver as tentativas de retry com backoff exponencial',
      });
    }
  } catch (error) {
    console.error('[TEST RETRY] ❌ Erro ao adicionar job de teste:', error);

    return res.status(500).json({
      success: false,
      error: 'Erro ao adicionar job de teste',
      message: error.message,
    });
  }
});

/**
 * GET /api/test/retry/status
 * Verifica o status da fila de teste
 */
router.get('/retry/status', async (req: Request, res: Response) => {
  try {
    const _isDevelopment = process.env.NODE_ENV == 'development';

    return res.json({
      success: true,
      queue: 'test-retry',
      mode: isDevelopment ? 'development (mock queue)' : 'production (Redis)',
      status: 'operational',
      message: 'Fila de teste de retry operacional',
      retryInfo: 'Jobs nesta fila sempre falham para demonstrar o mecanismo de retry',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao verificar status',
      message: error.message,
    });
  }
});

export default router;
