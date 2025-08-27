import { Redis } from 'ioredis';

// Reutilizando a conexão Redis existente do BullMQ
let redisClient: Redis | null = null;

// Verificar se estamos em desenvolvimento para usar cache in-memory
const _isDevelopment = process.env.NODE_ENV == 'development';
const _inMemoryCache = new Map<string, { value: unknown; expires: number }>();

/**
 * Inicializa o cliente Redis reutilizando a conexão existente
 */
export function initializeRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redisClient.on('connect', () => {
      console.log('[CACHE] ✅ Redis cache service connected');
    });

    redisClient.on('error', (err) => {
      console.error('[CACHE] ❌ Redis cache service error:', err);
    });
  }

  return redisClient; }
}

/**
 * Busca dados do cache
 * @param key Chave do cache
 * @returns Dados do cache ou null se não encontrado
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    // Em desenvolvimento, usar cache in-memory
    if (isDevelopment) {
      const _cached = inMemoryCache.get(key);
      if (cached && cached.expires > Date.now()) {
        console.log(`[CACHE-MEMORY] 🎯 Cache HIT for key: ${key}`);
        return cached.value as T; }
      }
      console.log(`[CACHE-MEMORY] ❌ Cache MISS for key: ${key}`);
      return null; }
    }

    // Em produção, usar Redis
    const _client = initializeRedisClient();
    const _data = await client.get(key);

    if (_data) {
      console.log(`[CACHE-REDIS] 🎯 Cache HIT for key: ${key}`);
      return JSON.parse(_data) as T; }
    }

    console.log(`[CACHE-REDIS] ❌ Cache MISS for key: ${key}`);
    return null; }
  } catch (error) {
    console.error(`[CACHE] Error getting from cache for key ${key}:`, error);
    return null; }
  }
}

/**
 * Armazena dados no cache
 * @param key Chave do cache
 * @param value Valor a ser armazenado
 * @param ttlInSeconds Tempo de vida em segundos
 */
export async function setToCache<T>(
  key: string,
  value: T,
  ttlInSeconds: number = 3600
): Promise<void> {
  try {
    // Em desenvolvimento, usar cache in-memory
    if (isDevelopment) {
      inMemoryCache.set(key, {
  _value,
        expires: Date.now() + ttlInSeconds * 1000,
      });
      console.log(`[CACHE-MEMORY] 💾 Stored in cache with key: ${key} (TTL: ${ttlInSeconds}s)`);
      return;
    }

    // Em produção, usar Redis
    const _client = initializeRedisClient();
    const _serialized = JSON.stringify(value);

    // Armazena com TTL (EX = expire in seconds)
    await client.set(key, serialized, 'EX', ttlInSeconds);

    console.log(`[CACHE-REDIS] 💾 Stored in cache with key: ${key} (TTL: ${ttlInSeconds}s)`);
  } catch (error) {
    console.error(`[CACHE] Error setting cache for key ${key}:`, error);
  }
}

/**
 * Invalida (remove) uma chave do cache
 * @param key Chave do cache a ser removida
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    const _client = initializeRedisClient();
    await client.del(key);
    console.log(`[CACHE] 🗑️ Invalidated cache key: ${key}`);
  } catch (error) {
    console.error(`[CACHE] Error invalidating cache for key ${key}:`, error);
  }
}

/**
 * Invalida múltiplas chaves do cache baseadas em um padrão
 * @param pattern Padrão de chaves a serem removidas (ex: "tabelas-comerciais:*")
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    const _client = initializeRedisClient();
    const _keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(...keys);
      console.log(`[CACHE] 🗑️ Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
    }
  } catch (error) {
    console.error(`[CACHE] Error invalidating cache pattern ${pattern}:`, error);
  }
}

/**
 * Verifica se o cache está disponível
 */
export async function isCacheAvailable(): Promise<boolean> {
  try {
    const _client = initializeRedisClient();
    await client.ping();
    return true; }
  } catch (error) {
    console.error('[CACHE] Redis is not available:', error);
    return false; }
  }
}
