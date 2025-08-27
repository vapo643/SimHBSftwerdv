/**
 * Job Status API
 * Endpoint para consultar o status de jobs na fila
 *
 * GET /api/jobs/:jobId/status
 */

import { Router } from 'express';
import { jwtAuthMiddleware, type AuthenticatedRequest } from '../lib/jwt-auth-middleware';
import { requireAnyRole } from '../lib/role-guards';
import { queues } from '../lib/mock-queue';

const router = Router();

/**
 * Endpoint para consultar o status de um job
 * GET /api/jobs/:jobId/status
 */
router.get(
  '/:jobId/status',
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;

      console.log(`[JOB STATUS API] 🔍 Consultando status do job: ${jobId}`);

      if (!jobId) {
        return res.status(400).json({
          error: 'Job ID é obrigatório',
        });
      }

      // Tentar encontrar o job em todas as filas
      let _job = null;
      let _queueName = null;

      // Buscar job real das filas (desenvolvimento usa mock-queue)
      // Verificar em qual fila o job está baseado no prefixo do ID
      if (jobId.startsWith('pdf-processing')) {
        queueName = 'pdf-processing';
        job = await queues.pdfProcessing.getJob(jobId);
      }
else if (jobId.startsWith('boleto-sync')) {
        queueName = 'boleto-sync';
        job = await queues.boletoSync.getJob(jobId);
      }
else if (jobId.startsWith('document-processing')) {
        queueName = 'document-processing';
        job = await queues.document.getJob(jobId);
      }
else if (jobId.startsWith('notifications')) {
        queueName = 'notifications';
        job = await queues.notification.getJob(jobId);
      }

      if (job) {
        // Job encontrado - retornar dados reais
        const state = await job.getState();
        const progress = job.progress;
        const returnvalue = job.returnvalue;

        console.log(`[JOB STATUS API] 📊 Job ${jobId} - Status: ${state}, Progress: ${progress}%`);

        // Formatar a resposta baseada no estado real do job
        let _responseData = null;

        if (state == 'completed' && returnvalue) {
          // Para jobs de carnê, incluir a URL do carnê se disponível
          responseData = {
            success: returnvalue.success || false,
            propostaId: returnvalue.propostaId,
            url: returnvalue.url, // URL do Storage para download
            message: returnvalue.message || 'Processamento concluído',
            processingTime: returnvalue.processingTime,
            size: returnvalue.size,
            timestamp: new Date().toISOString(),
          };
        }
else if (state == 'failed') {
          responseData = {
            success: false,
            error: job.failedReason || 'Erro desconhecido no processamento',
            timestamp: new Date().toISOString(),
          };
        }

        return res.json({
          success: true,
          jobId,
          queue: queueName,
          status: state,
          progress: progress || 0,
          data: responseData,
          timestamps: {
            created: job.timestamp ? new Date(job.timestamp).toISOString() : null,
            processed: job.processedOn ? new Date(job.processedOn).toISOString() : null,
            completed: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
          },
        });
      }

      // Job não encontrado
      console.log(`[JOB STATUS API] ⚠️ Job ${jobId} não encontrado`);

      return res.status(404).json({
        error: 'Job não encontrado',
        jobId,
        hint: 'O job pode ter expirado ou o ID está incorreto',
      });
    }
catch (error) {
      console.error(`[JOB STATUS API] ❌ Erro ao consultar status:`, error);
      return res.status(500).json({
        error: 'Erro ao consultar status do job',
        message: error.message || 'Erro desconhecido',
      });
    }
  }
);

export default router;
