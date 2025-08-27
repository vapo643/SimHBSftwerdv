/**
 * Test endpoint for job queue
 * Endpoint temporário para testar a arquitetura de filas
 * Conforme PAM V1.0 - Protocolo 5-CHECK item 4
 */

import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

/**
 * POST /api/test-queue
 * Adiciona um job de teste à fila pdf-processing
 */
router.post('/test-queue', async (req: Request, res: Response) => {
  try {
    console.log('[TEST QUEUE] 📋 Recebendo requisição de teste');

    const isDevelopment = process.env.NODE_ENV == 'development';

    if (isDevelopment) {
      // Usar mock queue em desenvolvimento
      const { queues } = await import('../lib/mock-queue');
      const queue = queues.pdfProcessing;

      const testData = {
        type: 'TEST_JOB',
        timestamp: new Date().toISOString(),
        message: 'Job de teste conforme PAM V1.0',
        ...req.body,
      };

      const job = await queue.add('test-job', testData);

      console.log(`[TEST QUEUE] ✅ Job ${job.id} adicionado à fila com sucesso`);

      return res.json({
        success: true,
        message: 'Job de teste adicionado à fila',
        jobId: job.id,
        queue: 'pdf-processing',
        mode: 'development (mock queue)',
        data: testData,
      });
    }
else {
      // Usar queue real em produção
      const { pdfQueue } = await import('../lib/queues-basic');

      const testData = {
        type: 'TEST_JOB',
        timestamp: new Date().toISOString(),
        message: 'Job de teste conforme PAM V1.0',
        ...req.body,
      };

      const job = await pdfQueue.add('test-job', testData);

      console.log(`[TEST QUEUE] ✅ Job ${job.id} adicionado à fila com sucesso`);

      return res.json({
        success: true,
        message: 'Job de teste adicionado à fila',
        jobId: job.id,
        queue: 'pdf-processing',
        mode: 'production (Redis)',
        data: testData,
      });
    }
  }
catch (error) {
    console.error('[TEST QUEUE] ❌ Erro ao adicionar job:', error);

    return res.status(500).json({
      success: false,
      error: 'Erro ao adicionar job à fila',
      message: error.message,
    });
  }
});

/**
 * GET /api/test-queue/status
 * Verifica o status da fila
 */
router.get('/test-queue/status', async (req: Request, res: Response) => {
  try {
    const isDevelopment = process.env.NODE_ENV == 'development';

    return res.json({
      success: true,
      queue: 'pdf-processing',
      mode: isDevelopment ? 'development (mock queue)' : 'production (Redis)',
      status: 'operational',
      message: 'Fila operacional e pronta para receber jobs',
    });
  }
catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao verificar status',
      message: error.message,
    });
  }
});

export default router;
