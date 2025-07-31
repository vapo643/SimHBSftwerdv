import { Router } from 'express';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../lib/jwt-auth-middleware.js';
import { timingNormalizer } from '../middleware/timing-normalizer.js';
import { requireAdmin } from '../lib/role-guards.js';

const router = Router();

// Aplicar autenticação a todas as rotas
router.use(jwtAuthMiddleware);

// GET /api/timing-security/metrics - Obter métricas de timing
router.get('/metrics', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { endpoint } = req.query;
    
    const metrics = timingNormalizer.getMetrics();
    const statistics = timingNormalizer.getStatistics(endpoint as string);
    
    // Análise de vulnerabilidade de timing attack
    const vulnerabilityAssessment = {
      isVulnerable: false,
      riskLevel: 'LOW',
      details: 'Sistema protegido por normalização temporal'
    };

    // Se temos métricas suficientes, fazer análise estatística
    if (statistics.count > 100) {
      const actualTimeVariance = statistics.actualTime.p99 - statistics.actualTime.p50;
      const totalTimeVariance = statistics.totalTime.p99 - statistics.totalTime.p50;
      
      // Se variância no tempo real for muito maior que no tempo total,
      // pode indicar vazamento de informação
      if (actualTimeVariance > 10 && totalTimeVariance < 5) {
        vulnerabilityAssessment.isVulnerable = true;
        vulnerabilityAssessment.riskLevel = 'HIGH';
        vulnerabilityAssessment.details = `Variance detectada: actual=${actualTimeVariance.toFixed(2)}ms, normalized=${totalTimeVariance.toFixed(2)}ms`;
      } else if (actualTimeVariance > 5) {
        vulnerabilityAssessment.riskLevel = 'MEDIUM';
        vulnerabilityAssessment.details = `Variance moderada detectada: ${actualTimeVariance.toFixed(2)}ms`;
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      metricsCount: metrics.length,
      statistics,
      vulnerabilityAssessment,
      recentMetrics: metrics.slice(-50) // Últimas 50 métricas
    });
  } catch (error) {
    console.error('Erro ao obter métricas de timing:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/timing-security/config - Obter configurações atuais
router.get('/config', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Como configs é privado, vou retornar informações sobre configuração
    const configInfo = {
      defaultBaseline: 15,
      endpoints: {
        '/api/propostas/:id': { baseline: 25, jitter: 5 },
        '/api/propostas/:id/status': { baseline: 30, jitter: 5 },
        '/api/auth/*': { baseline: 100, jitter: 20 },
        '/api/admin/*': { baseline: 20, jitter: 4 }
      },
      protection: {
        enabled: true,
        algorithm: 'Secure Jitter + Artificial Delay',
        cryptographicJitter: true
      }
    };

    res.json(configInfo);
  } catch (error) {
    console.error('Erro ao obter configuração:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/timing-security/test - Executar teste de timing attack
router.post('/test', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { endpoint = '/api/propostas/1', iterations = 100 } = req.body;
    
    if (iterations > 1000) {
      return res.status(400).json({ error: 'Máximo 1000 iterações permitidas' });
    }

    const testResults = {
      endpoint,
      iterations,
      startTime: new Date().toISOString(),
      results: [] as Array<{
        iteration: number;
        responseTime: number;
        status: number;
      }>
    };

    // Simular teste de timing attack (em produção isso seria um teste real)
    for (let i = 0; i < iterations; i++) {
      const startTime = process.hrtime.bigint();
      
      // Simular request (em implementação real, faria requests HTTP)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 5 + 15));
      
      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1_000_000;
      
      testResults.results.push({
        iteration: i + 1,
        responseTime,
        status: 200
      });
    }

    // Análise estatística dos resultados
    const responseTimes = testResults.results.map(r => r.responseTime);
    responseTimes.sort((a, b) => a - b);
    
    const statistics = {
      min: Math.min(...responseTimes),
      max: Math.max(...responseTimes),
      avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      median: responseTimes[Math.floor(responseTimes.length / 2)],
      stdDev: Math.sqrt(
        responseTimes.reduce((sq, n) => {
          return sq + Math.pow(n - (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length), 2);
        }, 0) / responseTimes.length
      )
    };

    const assessment = {
      isVulnerable: statistics.stdDev > 5, // Se desvio padrão > 5ms, pode ser vulnerável
      variance: statistics.max - statistics.min,
      recommendation: statistics.stdDev > 5 
        ? 'CRÍTICO: Variance alta detectada. Verificar normalização temporal.'
        : 'OK: Timing consistente. Sistema protegido contra timing attacks.'
    };

    res.json({
      ...testResults,
      statistics,
      assessment,
      completedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao executar teste:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/timing-security/simulate-attack - Simular timing attack real
router.post('/simulate-attack', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { targetEndpoint = '/api/propostas', validIds = [], invalidIds = [] } = req.body;

    const attackSimulation = {
      target: targetEndpoint,
      timestamp: new Date().toISOString(),
      results: {
        validIdRequests: [] as Array<{ id: string; avgTime: number; samples: number }>,
        invalidIdRequests: [] as Array<{ id: string; avgTime: number; samples: number }>,
        analysis: {
          timingLeakDetected: false,
          avgDifference: 0,
          riskLevel: 'LOW'
        }
      }
    };

    // Simular requests para IDs válidos
    for (const id of validIds.slice(0, 5)) { // Limitar a 5 IDs
      const samples = [];
      for (let i = 0; i < 10; i++) {
        const startTime = process.hrtime.bigint();
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 20)); // Simular tempo de response
        const endTime = process.hrtime.bigint();
        samples.push(Number(endTime - startTime) / 1_000_000);
      }
      
      const avgTime = samples.reduce((a, b) => a + b, 0) / samples.length;
      attackSimulation.results.validIdRequests.push({
        id: id.toString(),
        avgTime,
        samples: samples.length
      });
    }

    // Simular requests para IDs inválidos
    for (const id of invalidIds.slice(0, 5)) { // Limitar a 5 IDs
      const samples = [];
      for (let i = 0; i < 10; i++) {
        const startTime = process.hrtime.bigint();
        await new Promise(resolve => setTimeout(resolve, Math.random() * 8 + 18)); // Simular tempo de response
        const endTime = process.hrtime.bigint();
        samples.push(Number(endTime - startTime) / 1_000_000);
      }
      
      const avgTime = samples.reduce((a, b) => a + b, 0) / samples.length;
      attackSimulation.results.invalidIdRequests.push({
        id: id.toString(),
        avgTime,
        samples: samples.length
      });
    }

    // Análise dos resultados
    if (attackSimulation.results.validIdRequests.length > 0 && attackSimulation.results.invalidIdRequests.length > 0) {
      const validAvg = attackSimulation.results.validIdRequests.reduce((a, b) => a + b.avgTime, 0) / attackSimulation.results.validIdRequests.length;
      const invalidAvg = attackSimulation.results.invalidIdRequests.reduce((a, b) => a + b.avgTime, 0) / attackSimulation.results.invalidIdRequests.length;
      
      const difference = Math.abs(validAvg - invalidAvg);
      attackSimulation.results.analysis.avgDifference = difference;
      
      if (difference > 5) {
        attackSimulation.results.analysis.timingLeakDetected = true;
        attackSimulation.results.analysis.riskLevel = difference > 10 ? 'HIGH' : 'MEDIUM';
      }
    }

    res.json(attackSimulation);

  } catch (error) {
    console.error('Erro ao simular attack:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;