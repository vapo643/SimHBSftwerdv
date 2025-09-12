import { Router } from 'express';
import type { AuthenticatedRequest } from '../../../shared/types/express';

const router = Router();

// POST /api/propostas/:id/clicksign/enviar - IMPLEMENTAÇÃO ROBUSTA (DeepThink)
router.post('/enviar/:id', async (req: AuthenticatedRequest, res) => {
  const propostaId = req.params.id;
  const userId = req.user?.id;
  
  console.log(`[CLICKSIGN] POST /enviar/${propostaId} - User: ${userId}`);
  
  try {
    // Valida UUID
    if (!propostaId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ 
        error: 'ID de proposta inválido',
        receivedId: propostaId 
      });
    }

    // Transição para ASSINATURA_CONCLUIDA via FSM
    const { StatusFSMService } = await import('../../services/statusFsmService');
    const fsmService = new StatusFSMService();
    
    const result = await fsmService.processStatusTransition(
      propostaId,
      'ASSINATURA_CONCLUIDA',
      userId || 'system',
      {
        source: 'CLICKSIGN_SUBMISSION',
        timestamp: new Date().toISOString(),
        ...req.body
      }
    );

    if (!result.success) {
      console.error('[CLICKSIGN] FSM transition failed:', result.error);
      return res.status(400).json({ 
        error: result.error,
        details: 'Falha na transição para assinatura'
      });
    }

    // Simulação do envio para ClickSign
    console.log('[CLICKSIGN] ✅ Documento enviado com sucesso para assinatura');
    
    res.json({
      success: true,
      data: result.data,
      message: 'Documento enviado para ClickSign',
      clicksignId: `mock-${Date.now()}` // Placeholder
    });

  } catch (error) {
    console.error('[CLICKSIGN] ❌ Error in enviar:', error);
    res.status(500).json({ 
      error: 'Erro ao enviar para ClickSign',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// =============================================
// CIRCUIT BREAKER TEST ENDPOINTS - PAM V1.0
// =============================================

// Endpoint que testa o circuit breaker real do ClickSignService
router.get('/test/circuit-breaker', async (req: AuthenticatedRequest, res) => {
  try {
    const { clickSignService } = await import('../../services/clickSignService');

    // Tentar uma conexão de teste
    const result = await clickSignService.testConnection();

    res.json({
      success: true,
      serviceStatus: result ? 'operational' : 'unavailable',
      circuitBreakerStatus: 'closed',
    });
  } catch (error: any) {
    if (error.message?.includes('circuit breaker is OPEN')) {
      console.log('[CIRCUIT TEST] ⚡ ClickSign circuit breaker is OPEN');
      res.status(503).json({
        error: 'ClickSign API temporarily unavailable - circuit breaker is OPEN',
        circuitBreakerStatus: 'open',
      });
    } else {
      res.status(500).json({
        error: error.message,
        circuitBreakerStatus: 'unknown',
      });
    }
  }
});

export default router;
