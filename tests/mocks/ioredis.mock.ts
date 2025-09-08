import { vi } from 'vitest';

/**
 * Mock do ioredis para testes - PAM V1.0 DECD Autorizada
 *
 * Implementa mock completo do Redis para garantir isolamento de testes
 * Baseado em melhores práticas do vitest + ioredis 2024
 */

export const mockRedisData = new Map<string, any>();

export const mockRedisClient: any = {
  // Operações básicas
  get: vi.fn().mockImplementation(async (key: string) => {
    const value = mockRedisData.get(key);
    return value || null;
  }),

  set: vi.fn().mockImplementation(async (key: string, value: any, ...args: any[]) => {
    // Suporte para SET key value EX seconds
    if (args[0] === 'EX' && args[1]) {
      // Simular expiração (não implementada para simplicidade)
      mockRedisData.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    } else {
      mockRedisData.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
    return 'OK';
  }),

  del: vi.fn().mockImplementation(async (...keys: string[]) => {
    let deleted = 0;
    keys.forEach((key) => {
      if (mockRedisData.has(key)) {
        mockRedisData.delete(key);
        deleted++;
      }
    });
    return deleted;
  }),

  exists: vi.fn().mockImplementation(async (key: string) => {
    return mockRedisData.has(key) ? 1 : 0;
  }),

  keys: vi.fn().mockImplementation(async (pattern: string) => {
    // Implementação simples de pattern matching para padrões básicos
    const allKeys = Array.from(mockRedisData.keys());
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return allKeys.filter((key) => key.startsWith(prefix));
    }
    return allKeys.filter((key) => key === pattern);
  }),

  // Operações de saúde e conexão
  ping: vi.fn().mockResolvedValue('PONG'),
  flushall: vi.fn().mockImplementation(async () => {
    mockRedisData.clear();
    return 'OK';
  }),
  flushdb: vi.fn().mockImplementation(async () => {
    mockRedisData.clear();
    return 'OK';
  }),

  // Event handlers para BullMQ
  on: vi.fn().mockImplementation((event: string, callback: Function) => {
    if (event === 'ready') {
      // Simular evento ready imediatamente
      setTimeout(callback, 0);
    }
    return mockRedisClient; // Para permitir chaining
  }),

  // Métodos de controle de ciclo de vida
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn().mockResolvedValue('OK'),

  // Status da conexão
  status: 'ready',

  // Operações de conjunto (para compatibilidade com BullMQ)
  sadd: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([]),
  srem: vi.fn().mockResolvedValue(1),

  // Operações de hash (para compatibilidade com BullMQ)
  hget: vi.fn().mockResolvedValue(null),
  hset: vi.fn().mockResolvedValue(1),
  hdel: vi.fn().mockResolvedValue(1),
  hgetall: vi.fn().mockResolvedValue({}),

  // Operações de lista (para BullMQ)
  lpush: vi.fn().mockResolvedValue(1),
  rpop: vi.fn().mockResolvedValue(null),
  blpop: vi.fn().mockResolvedValue(null),

  // Suporte para clusters (se necessário)
  nodes: vi.fn().mockReturnValue([{ flushdb: vi.fn() }]),
};

// Factory function para criar instâncias mock
export const createMockRedis = () => ({
  ...mockRedisClient,
  // Cada instância deve ter seus próprios spies
  get: vi.fn().mockImplementation(mockRedisClient.get),
  set: vi.fn().mockImplementation(mockRedisClient.set),
  del: vi.fn().mockImplementation(mockRedisClient.del),
  ping: vi.fn().mockImplementation(mockRedisClient.ping),
});

// Helper para limpar mock data entre testes
export const clearMockRedisData = () => {
  mockRedisData.clear();
  vi.clearAllMocks();
};
