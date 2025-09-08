/**
 * Redis Configuration for Production-Ready Deployment
 * Centralizes Redis connection settings for BullMQ queues and workers
 *
 * Features:
 * - Environment-based configuration (dev/staging/production)
 * - TLS/SSL support for secure connections
 * - Proper BullMQ optimization settings
 * - Connection retry and error handling
 * - Health checks and monitoring
 */

import { RedisOptions } from 'ioredis';
import { Redis } from 'ioredis';

interface RedisConfigOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  tls?: any; // TLS connection options
  maxRetriesPerRequest?: null; // Required for BullMQ
  enableReadyCheck?: boolean;
  retryDelayOnFailover?: number;
  lazyConnect?: boolean;
  keepAlive?: number;
  family?: 4 | 6;
}

/**
 * Generates Redis configuration based on environment variables
 * Optimized for BullMQ performance and production security
 */
export function createRedisConfig(): RedisOptions {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  // Base configuration optimized for BullMQ
  const baseConfig: RedisConfigOptions = {
    maxRetriesPerRequest: null, // Critical for BullMQ - prevents timeouts
    enableReadyCheck: false, // BullMQ recommendation
    retryDelayOnFailover: 100, // Fast failover
    lazyConnect: true, // Connect when needed
    keepAlive: 30000, // Keep connections alive
    family: 4, // IPv4
  };

  // Development configuration (localhost fallback)
  if (isDevelopment && !process.env.REDIS_HOST) {
    console.log('[REDIS CONFIG] 🔧 Development mode: using localhost fallback');
    return {
      ...baseConfig,
      host: 'localhost',
      port: 6379,
    } as RedisOptions;
  }

  // Production/Staging configuration from environment variables
  const config: any = {
    ...baseConfig,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  };

  // TLS Configuration (only when explicitly enabled)
  // DIAGNOSTIC RESULT: This Redis Cloud instance does NOT use TLS
  // Only enable TLS if explicitly requested via REDIS_TLS_ENABLED=true
  if (process.env.REDIS_TLS_ENABLED === 'true') {
    config.tls = {
      // Accept self-signed certificates in staging
      rejectUnauthorized: isProduction ? true : false,
    };
    console.log('[REDIS CONFIG] 🔐 TLS enabled for secure connection');
  } else {
    console.log('[REDIS CONFIG] 📡 Using plain text connection (no TLS)');
  }

  // Connection URL override (for cloud providers like Redis Cloud, AWS ElastiCache)
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    config.host = url.hostname;
    config.port = parseInt(url.port) || 6379;
    config.password = url.password || config.password;
    config.db = parseInt(url.pathname.slice(1)) || config.db || 0;

    // Detect TLS from URL scheme
    if (url.protocol === 'rediss:') {
      config.tls = {
        rejectUnauthorized: isProduction ? true : false,
      };
      console.log('[REDIS CONFIG] 🔐 TLS detected from rediss:// URL scheme');
    }
    console.log('[REDIS CONFIG] 🌐 Using connection URL configuration');
  }

  return config as RedisOptions;
}

// PERF-BOOST-002: Singleton Redis client to avoid multiple connections
let sharedRedisClient: Redis | null = null;

/**
 * Creates a Redis client instance with production-ready configuration
 * Uses singleton pattern to avoid multiple connections during startup
 */
export function createRedisClient(instanceName = 'default'): Redis {
  // Return existing client if available (singleton pattern)
  if (sharedRedisClient && instanceName === 'default') {
    return sharedRedisClient;
  }

  const config = createRedisConfig();
  const client = new Redis(config);

  // Store as shared client if it's the default instance
  if (instanceName === 'default') {
    sharedRedisClient = client;
  }

  // Reduced logging for non-default instances to avoid spam
  if (instanceName === 'default') {
    client.on('connect', () => {
      console.log(`[REDIS:${instanceName}] ✅ Connected successfully`);
    });

    client.on('ready', () => {
      console.log(`[REDIS:${instanceName}] 🚀 Ready to accept commands`);
    });

    client.on('error', (error) => {
      console.error(`[REDIS:${instanceName}] ❌ Connection error:`, error.message);
      if (process.env.NODE_ENV === 'development') {
        console.error('Full error:', error);
      }
    });

    client.on('close', () => {
      console.log(`[REDIS:${instanceName}] 🔌 Connection closed`);
      if (instanceName === 'default') {
        sharedRedisClient = null;
      }
    });

    client.on('reconnecting', () => {
      console.log(`[REDIS:${instanceName}] 🔄 Attempting to reconnect...`);
    });
  }

  return client;
}

/**
 * Health check function for Redis connectivity
 * Uses existing client to avoid creating new connections
 */
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    // Use existing client instead of creating a new one
    const client = sharedRedisClient || createRedisClient('health-check');
    const startTime = Date.now();

    await client.ping();
    const latency = Date.now() - startTime;

    // Don't quit the shared client
    if (!sharedRedisClient) {
      await client.quit();
    }

    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gets Redis configuration for BullMQ queues and workers
 * This is the primary export that should be used throughout the application
 */
export function getRedisConnectionConfig(): RedisOptions {
  return createRedisConfig();
}

console.log('[REDIS CONFIG] 📦 Redis configuration module loaded');
