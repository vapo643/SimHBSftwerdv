import { beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock fetch globally
global.fetch = vi.fn();

// CORRECTED P0-A: Use vi.hoisted() for proper ioredis mocking
const mocks = vi.hoisted(() => {
  return {
    redisInstance: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
      exists: vi.fn().mockResolvedValue(0),
      keys: vi.fn().mockResolvedValue([]),
      ping: vi.fn().mockResolvedValue('PONG'),
      flushall: vi.fn().mockResolvedValue('OK'),
      flushdb: vi.fn().mockResolvedValue('OK'),
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),

      // BullMQ specific methods
      brpoplpush: vi.fn().mockResolvedValue(null),
      lpush: vi.fn().mockResolvedValue(1),
      llen: vi.fn().mockResolvedValue(0),
      lrange: vi.fn().mockResolvedValue([]),
      ltrim: vi.fn().mockResolvedValue('OK'),

      // Hash operations for BullMQ
      hget: vi.fn().mockResolvedValue(null),
      hset: vi.fn().mockResolvedValue(1),
      hdel: vi.fn().mockResolvedValue(1),
      hgetall: vi.fn().mockResolvedValue({}),

      // Set operations for BullMQ
      sadd: vi.fn().mockResolvedValue(1),
      smembers: vi.fn().mockResolvedValue([]),
      srem: vi.fn().mockResolvedValue(1),

      // Event handling - Full EventEmitter compliance for BullMQ
      on: vi.fn().mockImplementation((event, callback) => {
        if (event === 'ready') {
          setTimeout(callback, 0);
        }
        return mocks.redisInstance();
      }),
      off: vi.fn().mockReturnThis(),
      emit: vi.fn().mockReturnValue(true),
      addListener: vi.fn().mockReturnThis(),
      removeListener: vi.fn().mockReturnThis(),
      removeAllListeners: vi.fn().mockReturnThis(),
      setMaxListeners: vi.fn().mockReturnThis(),
      getMaxListeners: vi.fn().mockReturnValue(10),
      listeners: vi.fn().mockReturnValue([]),
      listenerCount: vi.fn().mockReturnValue(0),
      eventNames: vi.fn().mockReturnValue([]),

      // Status and health
      status: 'ready',
      duplicate: vi.fn().mockReturnThis(),

      // BullMQ specific properties
      keyPrefix: '',
      options: {
        keyPrefix: '',
        host: 'localhost',
        port: 6379,
      },

      // Pipeline support for BullMQ
      pipeline: vi.fn().mockReturnValue({
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
        exec: vi.fn().mockResolvedValue([]),
      }),

      // Incr for counters
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),

      // IORedis specific methods for BullMQ
      defineCommand: vi.fn().mockReturnValue(undefined),
      sendCommand: vi.fn().mockResolvedValue(null),
      command: vi.fn().mockResolvedValue([]),
      info: vi.fn().mockResolvedValue('redis_version:7.0.0'),
      config: vi.fn().mockResolvedValue(['OK']),

      // Cluster/Sentinel methods
      nodes: vi.fn().mockReturnValue([]),

      // Stream operations for BullMQ
      xadd: vi.fn().mockResolvedValue('1-0'),
      xread: vi.fn().mockResolvedValue([]),
      xdel: vi.fn().mockResolvedValue(1),

      // Sorted set operations
      zadd: vi.fn().mockResolvedValue(1),
      zrange: vi.fn().mockResolvedValue([]),
      zrem: vi.fn().mockResolvedValue(1),
      zcard: vi.fn().mockResolvedValue(0),
    })),
  };
});

// Mock ioredis with vi.hoisted() approach
vi.mock('ioredis', async () => {
  const actual = await vi.importActual('ioredis');
  return {
    ...actual,
    default: mocks.redisInstance,
    Redis: mocks.redisInstance,
  };
});

// Limpar dados do Redis mock entre testes
beforeEach(() => {
  vi.clearAllMocks();
});

// CORRECTED P0-A: Mock Redis Manager using hoisted mock instance
vi.mock('../server/lib/redis-manager', () => ({
  __esModule: true,
  default: vi.fn(),

  // Use the same hoisted mock instance for consistency - return object not function
  getRedisClient: vi.fn().mockImplementation(() => {
    const instance = mocks.redisInstance();
    return Promise.resolve(instance);
  }),

  checkRedisHealth: vi.fn().mockResolvedValue({
    status: 'healthy',
    latency: 10,
    timestamp: new Date().toISOString(),
  }),

  disconnectRedis: vi.fn().mockResolvedValue(undefined),
  resetRedisForTesting: vi.fn().mockResolvedValue(undefined),

  redisManager: {
    healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' }),
    getClient: vi.fn().mockImplementation(() => mocks.redisInstance()),
    disconnect: vi.fn().mockResolvedValue(undefined),
  },
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
