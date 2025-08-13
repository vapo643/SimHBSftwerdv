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
          error: 'Job ID é obrigatório'
        });
      }
      
      // Tentar encontrar o job em todas as filas
      let job = null;
      let queueName = null;
      
      // Para a implementação mock, vamos simular a resposta
      // Em produção com Redis, usaríamos: const job = await queue.getJob(jobId);
      
      // Simulação para desenvolvimento
      // Assumir que jobs com ID começando com 'pdf-processing' ou 'boleto-sync' estão nessas filas
      if (jobId.startsWith('pdf-processing') || jobId.startsWith('boleto-sync')) {
        queueName = jobId.startsWith('pdf-processing') ? 'pdf-processing' : 'boleto-sync';
        
        // Simular diferentes estados baseado no tempo
        const jobNumber = parseInt(jobId.split('-').pop() || '0');
        const elapsed = Date.now() % 10000; // Ciclo de 10 segundos
        
        let status = 'waiting';
        let progress = 0;
        let returnvalue = null;
        
        if (elapsed < 2000) {
          status = 'waiting';
          progress = 0;
        } else if (elapsed < 8000) {
          status = 'active';
          progress = Math.floor((elapsed - 2000) / 60); // 0-100%
        } else {
          status = 'completed';
          progress = 100;
          // Simular resultado de sucesso
          returnvalue = {
            success: true,
            propostaId: req.params.propostaId || 'PROP-123456',
            carneUrl: `https://storage.example.com/propostas/carne-${jobId}.pdf`,
            message: 'Carnê gerado com sucesso',
            processingTime: 3500,
            timestamp: new Date().toISOString()
          };
        }
        
        console.log(`[JOB STATUS API] 📊 Job ${jobId} - Status: ${status}, Progress: ${progress}%`);
        
        return res.json({
          success: true,
          jobId,
          queue: queueName,
          status,
          progress,
          data: returnvalue,
          timestamps: {
            created: new Date(Date.now() - 5000).toISOString(),
            processed: status === 'active' || status === 'completed' ? new Date(Date.now() - 3000).toISOString() : null,
            completed: status === 'completed' ? new Date().toISOString() : null
          }
        });
      }
      
      // Job não encontrado
      console.log(`[JOB STATUS API] ⚠️ Job ${jobId} não encontrado`);
      
      return res.status(404).json({
        error: 'Job não encontrado',
        jobId,
        hint: 'O job pode ter expirado ou o ID está incorreto'
      });
      
    } catch (error: any) {
      console.error(`[JOB STATUS API] ❌ Erro ao consultar status:`, error);
      return res.status(500).json({
        error: 'Erro ao consultar status do job',
        message: error.message || 'Erro desconhecido'
      });
    }
  }
);

export default router;