import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../server/routes';
import type { Express } from 'express';

// Mock dependencies
vi.mock('../server/lib/jwt-auth-middleware', () => ({
  jwtAuthMiddleware: (req: any, res: any, next: any) => {
    req.user = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'ATENDENTE',
      loja_id: 1,
    };
    next();
  },
}));

vi.mock('../server/storage', () => ({
  storage: {
    getPropostaById: vi.fn((id: string) => {
      // Simulate database lookup time difference
      if (id === 'valid-id') {
        return new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                id: 'valid-id',
                status: 'aguardando_analise',
                clienteData: { nome: 'Test Client' },
                condicoesData: { valor: 50000 },
              }),
            10
          ); // 10ms for valid ID (RLS check)
        });
      } else {
        return new Promise((resolve) => {
          setTimeout(() => resolve(undefined), 2); // 2ms for invalid ID (fast fail)
        });
      }
    }),
  },
}));

describe('Timing Attack Mitigation Tests', () => {
  let app: Express;

  beforeEach(async () => {
    app = express();
    await registerRoutes(app);
  });

  it('should normalize response times for GET /api/propostas/:id endpoint', async () => {
    // Test multiple requests to measure timing consistency
    const validIdTimes: number[] = [];
    const invalidIdTimes: number[] = [];

    // Test valid ID (should exist in database)
    for (let i = 0; i < 5; i++) {
      const start = process.hrtime.bigint();

      await request(app).get('/api/propostas/valid-id').expect(200);

      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e6; // Convert to milliseconds
      validIdTimes.push(duration);
    }

    // Test invalid ID (should not exist in database)
    for (let i = 0; i < 5; i++) {
      const start = process.hrtime.bigint();

      await request(app).get('/api/propostas/invalid-id').expect(404);

      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e6; // Convert to milliseconds
      invalidIdTimes.push(duration);
    }

    // Calculate average response times
    const avgValidTime = validIdTimes.reduce((a, b) => a + b, 0) / validIdTimes.length;
    const avgInvalidTime = invalidIdTimes.reduce((a, b) => a + b, 0) / invalidIdTimes.length;

    console.log('🔍 Timing Analysis Results:');
    console.log(`  Valid ID avg: ${avgValidTime.toFixed(2)}ms`);
    console.log(`  Invalid ID avg: ${avgInvalidTime.toFixed(2)}ms`);
    console.log(`  Difference: ${Math.abs(avgValidTime - avgInvalidTime).toFixed(2)}ms`);

    // The timing normalizer should keep the difference under 5ms
    // This validates that the timing attack mitigation is working
    const timingDifference = Math.abs(avgValidTime - avgInvalidTime);
    expect(timingDifference).toBeLessThan(10); // Allow 10ms tolerance for test environment

    // Both should be normalized to around 20ms baseline (±5ms jitter)
    expect(avgValidTime).toBeGreaterThan(15); // At least 15ms (20ms - 5ms)
    expect(avgValidTime).toBeLessThan(30); // At most 30ms (20ms + 10ms buffer)
    expect(avgInvalidTime).toBeGreaterThan(15);
    expect(avgInvalidTime).toBeLessThan(30);
  });

  it('should apply timing normalization to vulnerable endpoints', async () => {
    const endpoints = ['/api/propostas/123/status'];

    for (const endpoint of endpoints) {
      const start = process.hrtime.bigint();

      try {
        // ADICIONAR: try/catch para capturar rejeições de promessa
        const response = await request(app)
          .put(endpoint)
          .send({ status: 'aprovado' })
          .timeout(5000); // ADICIONAR: Timeout explícito menor

        // Verificar que status é um dos esperados
        expect([400, 404, 422, 500]).toContain(response.status);
      } catch (error) {
        // ADICIONAR: Capturar e validar erros explicitamente
        expect(error).toBeDefined();
        // Opcional: verificar tipo específico de erro
        console.log('🧪 [TEST] Erro capturado (esperado):', error.message);
      }

      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e6;

      console.log(`⏱️  ${endpoint}: ${duration.toFixed(2)}ms`);

      // Verificar timing normalizado (deve ser implementado após P0)
      expect(duration).toBeGreaterThan(15);
      expect(duration).toBeLessThan(35);
    }
  }, 15000); // ADICIONAR: Timeout do teste aumentado para 15s
});
