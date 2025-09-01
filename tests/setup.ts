import { beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock fetch globally
global.fetch = vi.fn();

// ADICIONADO: Mock Redis Manager para testes
vi.mock('../server/lib/redis-manager', () => ({
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
    // Mock métodos específicos do JWT auth
    incr: vi.fn(),
    expire: vi.fn(),
    smembers: vi.fn().mockResolvedValue([]),
    sadd: vi.fn(),
    lrange: vi.fn().mockResolvedValue([]),
    lpush: vi.fn(),
    ltrim: vi.fn(),
  }),
  disconnectRedis: vi.fn(),
  getRedisHealth: vi.fn().mockResolvedValue({ status: 'ok', connections: 1 })
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
