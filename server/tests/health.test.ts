/**
 * SMOKE TEST - Health Check Endpoint
 * Operação Fênix - P1: Fundação da Suíte de Testes
 * PAM V1.0 - Validação programática da saúde do servidor
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { registerRoutes } from '../routes.js';

describe('Health Check Endpoint - Smoke Test', () => {
  let app: Express;
  let server: any;

  beforeAll(async () => {
    // Configurar aplicação Express para teste
    app = express() as Express;

    // Registrar todas as rotas (incluindo /api/health)
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    // Limpar recursos após teste
    if (server) {
      server.close();
    }
  });

  it('should return status 200 and correct response format for /api/health', async () => {
    // Fazer requisição GET para /api/health
    const response = await request(app).get('/api/health').expect(200);

    // Validar estrutura da resposta
    expect(response.body).toBeDefined();
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.security).toBe('enabled');
    expect(response.body.rateLimit).toBe('active');

    // Validar que timestamp é uma string válida
    expect(typeof response.body.timestamp).toBe('string');
    expect(response.body.timestamp.length).toBeGreaterThan(0);

    console.log('✅ Health check endpoint responding correctly:', response.body);
  });

  it('should respond within acceptable time limits', async () => {
    const startTime = Date.now();

    await request(app).get('/api/health').expect(200);

    const responseTime = Date.now() - startTime;

    // Validar que resposta é rápida (< 1000ms)
    expect(responseTime).toBeLessThan(1000);

    console.log(`✅ Health check response time: ${responseTime}ms`);
  });
});
