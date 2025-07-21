import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authMiddleware } from '../lib/auth';
import rateLimit from 'express-rate-limit';

// Criar uma aplicação Express de teste
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Rota protegida para teste
  app.get('/api/test-protected', authMiddleware, (req, res) => {
    res.json({ message: 'Acesso autorizado', user: req.user });
  });

  // Rota pública para controle
  app.get('/api/test-public', (req, res) => {
    res.json({ message: 'Acesso público' });
  });

  // Rota de propostas protegida
  app.get('/api/propostas', authMiddleware, (req, res) => {
    res.json({ propostas: [] });
  });

  // Rota de criação de proposta protegida
  app.post('/api/propostas', authMiddleware, (req, res) => {
    res.status(201).json({ id: 1, message: 'Proposta criada' });
  });

  return app;
};

describe('Segurança da API - Middleware de Autenticação', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Rotas Protegidas', () => {
    it('deve retornar 401 quando acessar rota protegida sem token', async () => {
      const response = await request(app)
        .get('/api/test-protected')
        .expect(401);

      expect(response.body).toEqual({
        message: 'Token de acesso requerido'
      });
    });

    it('deve retornar 401 quando acessar rota protegida com token inválido', async () => {
      const response = await request(app)
        .get('/api/test-protected')
        .set('Authorization', 'Bearer token-invalido')
        .expect(401);

      expect(response.body).toEqual({
        message: 'Token inválido'
      });
    });

    it('deve retornar 401 quando acessar rota protegida com header malformado', async () => {
      const response = await request(app)
        .get('/api/test-protected')
        .set('Authorization', 'InvalidFormat token123')
        .expect(401);

      expect(response.body).toEqual({
        message: 'Formato de token inválido'
      });
    });

    it('deve retornar 401 para GET /api/propostas sem autenticação', async () => {
      const response = await request(app)
        .get('/api/propostas')
        .expect(401);

      expect(response.body).toEqual({
        message: 'Token de acesso requerido'
      });
    });

    it('deve retornar 401 para POST /api/propostas sem autenticação', async () => {
      const propostaData = {
        clienteNome: 'João Silva',
        valor: 10000,
        prazo: 12
      };

      const response = await request(app)
        .post('/api/propostas')
        .send(propostaData)
        .expect(401);

      expect(response.body).toEqual({
        message: 'Token de acesso requerido'
      });
    });
  });

  describe('Rotas Públicas', () => {
    it('deve permitir acesso a rotas públicas sem autenticação', async () => {
      const response = await request(app)
        .get('/api/test-public')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Acesso público'
      });
    });
  });

  describe('Validação de Headers', () => {
    it('deve rejeitar requisições sem header Authorization', async () => {
      const response = await request(app)
        .get('/api/test-protected')
        .expect(401);

      expect(response.body.message).toBe('Token de acesso requerido');
    });

    it('deve rejeitar requisições com header Authorization vazio', async () => {
      const response = await request(app)
        .get('/api/test-protected')
        .set('Authorization', '')
        .expect(401);

      expect(response.body.message).toBe('Token de acesso requerido');
    });

    it('deve rejeitar requisições com Bearer mas sem token', async () => {
      const response = await request(app)
        .get('/api/test-protected')
        .set('Authorization', 'Bearer ')
        .expect(401);

      expect(response.body.message).toBe('Formato de token inválido');
    });
  });

  describe('Casos Extremos de Segurança', () => {
    it('deve rejeitar tentativas de SQL injection no header', async () => {
      const maliciousToken = "'; DROP TABLE users; --";

      const response = await request(app)
        .get('/api/test-protected')
        .set('Authorization', `Bearer ${maliciousToken}`)
        .expect(401);

      expect(response.body.message).toBe('Token inválido');
    });

    it('deve rejeitar tokens extremamente longos', async () => {
      const longToken = 'a'.repeat(10000);

      const response = await request(app)
        .get('/api/test-protected')
        .set('Authorization', `Bearer ${longToken}`)
        .expect(401);

      expect(response.body.message).toBe('Token inválido');
    });

    it('deve rejeitar caracteres especiais no token', async () => {
      const specialCharsToken = '<script>alert("xss")</script>';

      const response = await request(app)
        .get('/api/test-protected')
        .set('Authorization', `Bearer ${specialCharsToken}`)
        .expect(401);

      expect(response.body.message).toBe('Token inválido');
    });
  });

  // Teste para verificar rate limiting
  describe('Rate Limiting', () => {
    let rateLimitApp: express.Application;

    beforeAll(() => {
      rateLimitApp = express();
      rateLimitApp.use(express.json());

      // Aplicar rate limiting para testes
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 3, // Limite baixo para teste
        message: { message: 'Muitas requisições' }
      });

      rateLimitApp.use('/api/test-rate', limiter, (req, res) => {
        res.json({ message: 'Sucesso' });
      });
    });

    it('deve permitir requisições dentro do limite', async () => {
      await request(rateLimitApp)
        .get('/api/test-rate')
        .expect(200);

      await request(rateLimitApp)
        .get('/api/test-rate')
        .expect(200);
    });

    it('deve bloquear requisições acima do limite', async () => {
      // Fazer requisições até o limite
      await request(rateLimitApp).get('/api/test-rate');
      await request(rateLimitApp).get('/api/test-rate');
      await request(rateLimitApp).get('/api/test-rate');

      // Esta deve ser bloqueada
      const response = await request(rateLimitApp)
        .get('/api/test-rate')
        .expect(429);

      expect(response.body.message).toBe('Muitas requisições');
    });
  });
});