/**
 * Redis Cache Manager - PAM V4.0
 * High-performance caching system for critical data
 *
 * Features:
 * - Cache-aside pattern with TTL
 * - Smart invalidation strategies
 * - Performance monitoring
 * - Fallback to database when Redis unavailable
 */

import { getRedisClient } from './redis-manager';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Cache key namespace
}

interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
}

class CacheManager {
  private redis: any = null;
  private stats: CacheStats = { hits: 0, misses: 0, errors: 0, hitRate: 0 };
  private isRedisAvailable = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      // REFATORADO: Usar Redis Manager centralizado
      this.redis = await getRedisClient();
      this.isRedisAvailable = true;
      console.log('[CACHE] ✅ Redis conectado via Redis Manager centralizado');

      // Test connection
      await this.redis.ping();
    } catch (error) {
      this.isRedisAvailable = false;
      this.stats.errors++;
      console.warn('[CACHE] ⚠️ Redis Manager connection failed, running without cache:', error);
    }
  }

  /**
   * Generate cache key with namespace
   */
  private generateKey(key: string, namespace = 'simpix'): string {
    return `${namespace}:${key}`;
  }

  /**
   * Get data from cache with fallback to fetcher function
   */
  async get<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    const { ttl = 3600, namespace } = options; // Default 1 hour TTL
    const cacheKey = this.generateKey(key, namespace);
    const startTime = performance.now();

    try {
      // Try to get from cache first
      if (this.isRedisAvailable && this.redis) {
        const cached = await this.redis.get(cacheKey);

        if (cached) {
          this.stats.hits++;
          this.updateHitRate();

          const duration = performance.now() - startTime;
          console.log(`[CACHE] HIT: ${key} (${Math.round(duration)}ms)`);

          return JSON.parse(cached);
        }
      }

      // Cache miss - fetch from source
      this.stats.misses++;
      this.updateHitRate();

      console.log(`[CACHE] MISS: ${key} - fetching from source`);
      const data = await fetcher();

      // Store in cache for next time
      if (this.isRedisAvailable && this.redis) {
        await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
      }

      const duration = performance.now() - startTime;
      console.log(`[CACHE] STORED: ${key} (TTL: ${ttl}s, ${Math.round(duration)}ms)`);

      return data;
    } catch (error) {
      this.stats.errors++;
      console.error(`[CACHE] Error for key ${key}:`, error);

      // Fallback to fetcher on any cache error
      return fetcher();
    }
  }

  /**
   * Set data in cache directly
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    if (!this.isRedisAvailable || !this.redis) return;

    const { ttl = 3600, namespace } = options;
    const cacheKey = this.generateKey(key, namespace);

    try {
      await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
      console.log(`[CACHE] SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`[CACHE] Set error for key ${key}:`, error);
    }
  }

  /**
   * Invalidate specific cache key
   */
  async invalidate(key: string, namespace?: string): Promise<void> {
    if (!this.isRedisAvailable || !this.redis) return;

    const cacheKey = this.generateKey(key, namespace);

    try {
      await this.redis.del(cacheKey);
      console.log(`[CACHE] INVALIDATED: ${key}`);
    } catch (error) {
      console.error(`[CACHE] Invalidate error for key ${key}:`, error);
    }
  }

  /**
   * Invalidate multiple keys by pattern
   */
  async invalidatePattern(pattern: string, namespace?: string): Promise<void> {
    if (!this.isRedisAvailable || !this.redis) return;

    const searchPattern = this.generateKey(pattern, namespace);

    try {
      const keys = await this.redis.keys(searchPattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`[CACHE] INVALIDATED PATTERN: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      console.error(`[CACHE] Invalidate pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, errors: 0, hitRate: 0 };
  }

  /**
   * Close Redis connection
   * REFATORADO: Não gerencia mais o ciclo de vida da conexão diretamente
   */
  async close(): Promise<void> {
    // Conexão gerenciada pelo Redis Manager - não fechamos aqui
    this.redis = null;
    this.isRedisAvailable = false;
    console.log('[CACHE] 🔌 Cache Manager desconectado do Redis Manager');
  }
}

// Singleton instance
const cacheManager = new CacheManager();

// Cached data fetchers for common operations
export class CachedQueries {
  /**
   * Cache dashboard stats with 5-minute TTL
   */
  static async getDashboardStats(fetcher: () => Promise<any>) {
    return cacheManager.get('dashboard:stats', fetcher, {
      ttl: 300, // 5 minutes
      namespace: 'dashboard',
    });
  }

  /**
   * Cache commercial tables with 1-hour TTL
   */
  static async getCommercialTables(fetcher: () => Promise<any>) {
    return cacheManager.get('commercial:tables', fetcher, {
      ttl: 3600, // 1 hour
      namespace: 'commercial',
    });
  }

  /**
   * Cache product data with 30-minute TTL
   */
  static async getProducts(fetcher: () => Promise<any>) {
    return cacheManager.get('products:all', fetcher, {
      ttl: 1800, // 30 minutes
      namespace: 'products',
    });
  }

  /**
   * Cache user profile with 15-minute TTL
   */
  static async getUserProfile(userId: string, fetcher: () => Promise<any>) {
    return cacheManager.get(`user:${userId}`, fetcher, {
      ttl: 900, // 15 minutes
      namespace: 'users',
    });
  }

  /**
   * Cache simulation parameters with 2-hour TTL
   */
  static async getSimulationParams(fetcher: () => Promise<any>) {
    return cacheManager.get('simulation:params', fetcher, {
      ttl: 7200, // 2 hours
      namespace: 'simulation',
    });
  }

  /**
   * Invalidate dashboard cache when data changes
   */
  static async invalidateDashboard() {
    await cacheManager.invalidatePattern('*', 'dashboard');
  }

  /**
   * Invalidate user cache when profile changes
   */
  static async invalidateUser(userId: string) {
    await cacheManager.invalidate(`user:${userId}`, 'users');
  }

  /**
   * Invalidate commercial tables when rates change
   */
  static async invalidateCommercial() {
    await cacheManager.invalidatePattern('*', 'commercial');
  }
}

export { cacheManager, CacheManager };
export default cacheManager;
