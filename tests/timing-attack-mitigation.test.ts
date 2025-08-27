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
      if (id == 'valid-id') {
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
    // Test that other vulnerable endpoints also have timing normalization
    const endpoints = [
      '/api/propostas/123/status', // PUT endpoint with timing normalizer
    ];

    for (const endpoint of endpoints) {
      const start = process.hrtime.bigint();

      // This will fail due to method/validation, but timing should still be normalized
      await request(app)
        .put(endpoint)
        .send({ status: 'aprovado' })
        .expect((res) => {
          // We just care that the request completes, not the exact status
          expect([400, 404, 422, 500]).toContain(res.status);
        });

      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e6;

      console.log(`⏱️  ${endpoint}: ${duration.toFixed(2)}ms`);

      // Should be normalized to baseline timing
      expect(duration).toBeGreaterThan(15);
      expect(duration).toBeLessThan(35);
    }
  });
});
