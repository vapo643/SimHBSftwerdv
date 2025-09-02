import { beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { mockRedisClient, clearMockRedisData } from './mocks/ioredis.mock';

// Mock fetch globally
global.fetch = vi.fn();

// Mock ioredis para isolamento de testes - PAM V1.0 DECD
vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedisClient),
  Redis: vi.fn(() => mockRedisClient),
}));

// Limpar dados do Redis mock entre testes
beforeEach(() => {
  clearMockRedisData();
});

// ADICIONADO: Mock Redis Manager para testes - PAM V1.0 P0 CORRIGIDO
vi.mock('../server/lib/redis-manager', () => ({
  __esModule: true,
  default: vi.fn(),
  
  // Export principal que estava causando falha (CORRIGIDO P0)
  checkRedisHealth: vi.fn().mockResolvedValue({ 
    status: 'healthy', 
    latency: 10,
    timestamp: new Date().toISOString() 
  }),
  
  // Exports existentes (mantidos)
  getRedisClient: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    pipeline: vi.fn().mockReturnValue({
      get: vi.fn(),
      exec: vi.fn().mockResolvedValue([])
    }),
    quit: vi.fn(),
    disconnect: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    smembers: vi.fn().mockResolvedValue([]),
    sadd: vi.fn(),
    lrange: vi.fn().mockResolvedValue([]),
    lpush: vi.fn(),
    ltrim: vi.fn(),
  }),
  
  // Outros exports do módulo real
  disconnectRedis: vi.fn(),
  resetRedisForTesting: vi.fn(),
  redisManager: {
    healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' }),
    getClient: vi.fn(),
    disconnect: vi.fn()
  }
}));

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Mock environment variables for tests
vi.mock('process', () => ({
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-jwt-secret',
    SESSION_SECRET: 'test-session-secret',
    CSRF_SECRET: 'test-csrf-secret',
    // Redis configurações para teste
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
  },
}));
