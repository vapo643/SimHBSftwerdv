import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';
import type { Express } from 'express';

// Mock the auth middleware
vi.mock('../../server/lib/jwt-auth-middleware', () => ({
  _jwtAuthMiddleware: (req: any, res: any, next: any) => {
    req.user = {
      id: '123',
      email: 'test@example.com',
      role: 'ADMINISTRADOR',
    };
    next();
  },
}));

// Mock the role guards
vi.mock('../../server/lib/role-guards', () => ({
  _requireAdmin: (req: any, res: any, next: any) => next(),
  requireManagerOrAdmin: (req: any, res: any, next: any) => next(),
  requireAnyRole: (req: any, res: any, next: any) => next(),
}));

// Mock database responses
const mockTabelasPersonalizadas = [
  {
    id: 1,
    nomeTabela: 'Tabela Personalizada Parceiro X',
    taxaJuros: '2.50',
    prazos: [12, 24, 36],
    produtoId: 1,
    parceiroId: 10,
    comissao: '15.00',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

const mockTabelasGerais = [
  {
    id: 2,
    nomeTabela: 'Tabela Geral Produto A',
    taxaJuros: '3.00',
    prazos: [6, 12, 18],
    produtoId: 1,
    parceiroId: null,
    comissao: '10.00',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 3,
    nomeTabela: 'Tabela Geral Produto A - Premium',
    taxaJuros: '2.00',
    prazos: [12, 24, 36, 48],
    produtoId: 1,
    parceiroId: null,
    comissao: '12.00',
    createdAt: '2025-01-02T00:00:00.000Z',
  },
];

// Mock the database module
vi.mock('../../server/lib/supabase', () => ({
  db: {
    select: vi.fn(),
  },
  createServerSupabaseClient: vi.fn(),
  createServerSupabaseAdminClient: vi.fn(),
}));

// Mock Drizzle ORM
vi.mock('drizzle-orm', () => ({
  eq: (field: any, value: any) => ({ field, value, op: 'eq' }),
  and: (...conditions: any[]) => ({ conditions, op: 'and' }),
  isNull: (field: any) => ({ field, op: 'isNull' }),
  desc: (field: any) => ({ field, op: 'desc' }),
}));

describe('GET /api/tabelas-comerciais-disponiveis', () => {
  let app: Express;
  let dbMock: any;

  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Get the mocked db
    const { db } = await import('../../server/lib/supabase');
    dbMock = db;

    // Create Express app and register routes
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });

  describe('Scenario 1: Return personalized table when it exists', () => {
    it('should return only personalized tables for a partner with custom tables', async () => {
      // Setup mock to return personalized tables
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTabelasPersonalizadas),
      };

      dbMock.select.mockReturnValue(mockChain);

      const response = await request(app)
        .get('/api/tabelas-comerciais-disponiveis')
        .query({ produtoId: 1, parceiroId: 10 })
        .expect(200);

      expect(response.body).toEqual(mockTabelasPersonalizadas);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].nomeTabela).toBe('Tabela Personalizada Parceiro X');
      expect(response.body[0].parceiroId).toBe(10);
    });
  });

  describe('Scenario 2: Return general tables when no personalized table exists', () => {
    it('should return general tables when partner has no custom tables', async () => {
      // First call returns empty array (no personalized tables)
      const mockChainPersonalized = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      // Second call returns general tables
      const mockChainGeral = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTabelasGerais),
      };

      dbMock.select.mockReturnValueOnce(mockChainPersonalized).mockReturnValueOnce(mockChainGeral);

      const response = await request(app)
        .get('/api/tabelas-comerciais-disponiveis')
        .query({ produtoId: 1, parceiroId: 20 })
        .expect(200);

      expect(response.body).toEqual(mockTabelasGerais);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].parceiroId).toBeNull();
      expect(response.body[1].parceiroId).toBeNull();
    });
  });

  describe('Scenario 3: Return empty array when no tables exist', () => {
    it('should return empty array when product has no tables', async () => {
      // Both calls return empty arrays
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      dbMock.select.mockReturnValue(mockChain);

      const response = await request(app)
        .get('/api/tabelas-comerciais-disponiveis')
        .query({ produtoId: 999, parceiroId: 999 })
        .expect(200);

      expect(response.body).toEqual([]);
      expect(response.body).toHaveLength(0);
    });
  });

  describe('Scenario 4: Error handling for missing parameters', () => {
    it('should return 400 when produtoId is missing', async () => {
      const response = await request(app)
        .get('/api/tabelas-comerciais-disponiveis')
        .query({ parceiroId: 10 })
        .expect(400);

      expect(response.body).toEqual({
        message: 'produtoId e parceiroId são obrigatórios',
      });
    });

    it('should return 400 when parceiroId is missing', async () => {
      const response = await request(app)
        .get('/api/tabelas-comerciais-disponiveis')
        .query({ produtoId: 1 })
        .expect(400);

      expect(response.body).toEqual({
        message: 'produtoId e parceiroId são obrigatórios',
      });
    });

    it('should return 400 when both parameters are missing', async () => {
      const response = await request(app).get('/api/tabelas-comerciais-disponiveis').expect(400);

      expect(response.body).toEqual({
        message: 'produtoId e parceiroId são obrigatórios',
      });
    });

    it('should return 400 when produtoId is not a valid number', async () => {
      const response = await request(app)
        .get('/api/tabelas-comerciais-disponiveis')
        .query({ produtoId: 'abc', parceiroId: 10 })
        .expect(400);

      expect(response.body).toEqual({
        message: 'produtoId e parceiroId devem ser números válidos',
      });
    });

    it('should return 400 when parceiroId is not a valid number', async () => {
      const response = await request(app)
        .get('/api/tabelas-comerciais-disponiveis')
        .query({ produtoId: 1, parceiroId: 'xyz' })
        .expect(400);

      expect(response.body).toEqual({
        message: 'produtoId e parceiroId devem ser números válidos',
      });
    });
  });

  describe('Additional test cases', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      };

      dbMock.select.mockReturnValue(mockChain);

      const response = await request(app)
        .get('/api/tabelas-comerciais-disponiveis')
        .query({ produtoId: 1, parceiroId: 10 })
        .expect(500);

      expect(response.body).toEqual({
        message: 'Erro interno do servidor',
      });
    });

    it('should respect the hierarchical logic and not mix results', async () => {
      // This test ensures that when personalized tables exist,
      // the API doesn't also return general tables
      const mockChainPersonalized = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTabelasPersonalizadas),
      };

      // The second call should not happen
      const mockChainGeral = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTabelasGerais),
      };

      dbMock.select.mockReturnValueOnce(mockChainPersonalized).mockReturnValueOnce(mockChainGeral);

      const response = await request(app)
        .get('/api/tabelas-comerciais-disponiveis')
        .query({ produtoId: 1, parceiroId: 10 })
        .expect(200);

      // Should only return personalized tables
      expect(response.body).toEqual(mockTabelasPersonalizadas);
      // Since personalized tables were found, db.select should be called exactly once
      // (no second call for general tables)
      expect(dbMock.select).toHaveBeenCalledTimes(1);
    });
  });
});
