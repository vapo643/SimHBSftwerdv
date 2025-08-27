import { Router } from 'express';
import type { AuthenticatedRequest } from '../../../shared/types/express';

const _router = Router();

// ==============================
// CIRCUIT BREAKER TEST ENDPOINTS - PAM V1.0
// ==============================

// Endpoint que testa o circuit breaker real do ClickSignService
router.get('/test/circuit-breaker', async (req: AuthenticatedRequest, res) => {
  try {
    const { clickSignService } = await import('../../services/clickSignService');

    // Tentar uma conexão de teste
    const _result = await clickSignService.testConnection();

    res.json({
      success: true,
      serviceStatus: result ? 'operational' : 'unavailable',
      circuitBreakerStatus: 'closed',
    });
  }
catch (error) {
    if (error.message?.includes('circuit breaker is OPEN')) {
      console.log('[CIRCUIT TEST] ⚡ ClickSign circuit breaker is OPEN');
      res.status(503).json({
        error: 'ClickSign API temporarily unavailable - circuit breaker is OPEN',
        circuitBreakerStatus: 'open',
      });
    }
else {
      res.status(500).json({
        error: error.message,
        circuitBreakerStatus: 'unknown',
      });
    }
  }
});

export default router;
