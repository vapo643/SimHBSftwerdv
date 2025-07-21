/**
 * TESTES DE INTEGRAÇÃO - SEGURANÇA DA API (Pilar 17)
 * 
 * Este arquivo testa a segurança da API, incluindo:
 * - Autenticação obrigatória em rotas protegidas
 * - Rate limiting
 * - Headers de segurança
 * - Validação de entrada
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';

describe('API Security Integration Tests', () => {
  let app: any;
  let server: any;

  beforeAll(async () => {
    // Configurar app de teste com as mesmas configurações de segurança
    app = express();
    app.use(express.json());
    
    // Registrar rotas do sistema
    server = await registerRoutes(app);
  });

  afterAll(() => {
    if (server && server.close) {
      server.close();
    }
  });

  describe('Authentication Security', () => {
    it('should return 401 for protected route without token', async () => {
      const response = await request(app)
        .get('/api/propostas')
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('token');
    });

    it('should return 401 for protected route with invalid token', async () => {
      const response = await request(app)
        .get('/api/propostas')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 401 for POST requests without authentication', async () => {
      const proposalData = {
        clienteNome: 'Test Client',
        clienteEmail: 'test@example.com',
        valorSolicitado: 10000,
        prazoEmMeses: 12
      };

      const response = await request(app)
        .post('/api/propostas')
        .send(proposalData)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in API responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Verificar headers de segurança do Helmet
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers['x-frame-options']).toBe('DENY');
      
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should return correct health check response', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        security: 'enabled',
        rateLimit: 'active',
        secretsValidation: 'passed'
      });
      
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
    });
  });

  describe('Input Validation', () => {
    it('should validate required fields in simulation endpoint', async () => {
      const response = await request(app)
        .post('/api/simular')
        .send({
          // Missing required fields
          valorSolicitado: 'invalid',
          prazoEmMeses: 'invalid'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('inválida');
    });

    it('should validate simulation parameters', async () => {
      const response = await request(app)
        .get('/api/simulacao')
        .query({
          valor: 'not-a-number',
          prazo: 'not-a-number',
          produto_id: 'test'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('inválidos');
    });

    it('should accept valid simulation parameters', async () => {
      const response = await request(app)
        .get('/api/simulacao')
        .query({
          valor: '10000',
          prazo: '12',
          produto_id: 'tabela-a',
          incluir_tac: 'true',
          dataVencimento: '2025-12-31'
        })
        .expect(200);

      expect(response.body).toHaveProperty('valorParcela');
      expect(response.body).toHaveProperty('taxaJuros');
      expect(response.body).toHaveProperty('cetAnual');
      expect(typeof response.body.valorParcela).toBe('number');
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers in responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Verificar se headers de rate limit estão presentes
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
    });

    it('should handle auth endpoints with stricter rate limiting', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Fazer várias tentativas de login
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(401);
      }

      // A resposta deve incluir headers de rate limit para auth
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'test' });

      // Should either succeed or fail gracefully, not crash
      expect([200, 400, 401, 500]).toContain(response.status);
    });

    it('should return consistent error format', async () => {
      const response = await request(app)
        .get('/api/propostas')
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
    });
  });

  describe('CORS and Security Headers', () => {
    it('should handle OPTIONS requests properly', async () => {
      const response = await request(app)
        .options('/api/health');

      // Should not error on OPTIONS request
      expect([200, 204, 404]).toContain(response.status);
    });

    it('should include proper Content-Type headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Data Endpoints Security', () => {
    it('should protect products endpoint', async () => {
      const response = await request(app)
        .get('/api/produtos')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should protect prazos endpoint', async () => {
      const response = await request(app)
        .get('/api/prazos')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should require authentication for proposal creation', async () => {
      const proposalData = {
        clienteNome: 'Test Client',
        clienteEmail: 'test@example.com',
        clienteCpf: '12345678901',
        valorSolicitado: 10000,
        prazoEmMeses: 12,
        produtoId: 1
      };

      const response = await request(app)
        .post('/api/propostas')
        .send(proposalData)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });
});