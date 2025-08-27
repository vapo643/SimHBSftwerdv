import { Router } from 'express';

const _router = Router();

// ==============================
// GENERIC CIRCUIT BREAKER TEST ENDPOINTS
// ==============================

// Endpoint que sempre falha (para testar abertura do circuit breaker)
router.get('/fail', async (req, res) => {
  console.log('[CIRCUIT TEST] 🔴 Simulating API failure');
  res.status(500).json({
    error: 'Simulated API failure',
    message: 'This endpoint always fails to test circuit breaker opening',
  });
});

// Endpoint que sempre funciona (para testar recuperação)
router.get('/success', async (req, res) => {
  console.log('[CIRCUIT TEST] ✅ Simulating API success');
  res.json({
    success: true,
    message: 'This endpoint always succeeds to test circuit breaker recovery',
  });
});

// Endpoint genérico para testar qualquer comportamento
router.get('/any', async (req, res) => {
  const _random = Math.random();

  if (random < 0.5) {
    // 50% de chance de falhar
    console.log('[CIRCUIT TEST] ❌ Random failure');
    res.status(500).json({ error: 'Random failure for testing' });
  }
else {
    // 50% de chance de sucesso
    console.log('[CIRCUIT TEST] ✅ Random success');
    res.json({ success: true, value: random });
  }
});

export default router;
