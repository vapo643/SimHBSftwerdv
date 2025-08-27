/**
 * TESTE TEMPORÁRIO: Verificar se Mock Queue executa Worker real
 * Este arquivo pode ser removido após verificação
 */

import { Router } from 'express';
import { queues } from '../lib/mock-queue';

const router = Router();

/**
 * GET /api/test-mock-queue-worker
 * Endpoint sem autenticação para testar a refatoração
 */
router.get('/verify-worker-execution', async (req, res) => {
  try {
    console.log('\n===========[ TESTE MOCK QUEUE → WORKER ]===========');
    console.log('📋 Verificando se Mock Queue executa a lógica real do Worker');
    console.log('==========================================\n');

    // Usar proposta conhecida com dados reais
    const propostaId = '902183dd-b5d1-4e20-8a72-79d3d3559d4d';

    console.log(`📌 Testando com proposta: ${propostaId}`);
    console.log('📌 Esta proposta tem 24 boletos no sistema');

    // Adicionar job à fila
    const job = await queues.pdfProcessing.add('GENERATE_CARNE', {
      type: 'GENERATE_CARNE',
      propostaId: propostaId,
      userId: 'test-user',
      clienteNome: 'Cliente Teste',
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ Job ${job.id} adicionado à fila`);
    console.log('⏳ O Worker será executado em breve...');
    console.log('\n⚠️  OBSERVE OS LOGS ABAIXO PARA VER [WORKER:PDF]');

    res.json({
      success: true,
      message: 'Teste iniciado - verifique os logs do servidor',
      jobId: job.id,
      propostaId: propostaId,
      expectedLogs: [
        '[DEV QUEUE pdf-processing] Executando lógica REAL do worker...',
        '[WORKER:PDF] Processing job...',
        '[WORKER:PDF] Generating carnê...',
        'Logs de fusão de PDFs',
        'Logs de salvamento no Storage',
      ],
      note: 'Se você vir os logs [WORKER:PDF], a refatoração funcionou!',
    });
  }
catch (error) {
    console.error('❌ Erro no teste:', error);
    res.status(500).json({
      error: 'Erro no teste',
      message: error.message,
    });
  }
});

/**
 * GET /api/test-mock-queue-worker/status/:jobId
 * Verificar status do job de teste
 */
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const counts = await queues.pdfProcessing.getJobCounts();

    res.json({
      jobId,
      queueStatus: counts,
      message: 'Verifique os logs do servidor para confirmar execução do Worker',
    });
  }
catch (error) {
    res.status(500).json({
      error: 'Erro ao verificar status',
      message: error.message,
    });
  }
});

export default router;
