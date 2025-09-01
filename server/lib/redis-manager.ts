import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

/**
 * Singleton Redis Connection Manager
 * 
 * Este módulo implementa um padrão Singleton rigoroso para gerenciar
 * a conexão Redis única em toda a aplicação. Elimina vazamentos de
 * conexão e garante gestão adequada do ciclo de vida.
 * 
 * ATENÇÃO: Este é o ÚNICO ponto de criação de instâncias Redis.
 * Qualquer uso direto de `new Redis()` fora deste módulo é PROIBIDO.
 */

class RedisManager {
  private static instance: RedisManager | null = null;
  private client: Redis | null = null;
  private isConnecting: boolean = false;
  private connectionPromise: Promise<Redis> | null = null;

  private constructor() {
    // Construtor privado força uso do Singleton
  }

  /**
   * Obtém a instância única do RedisManager
   */
  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  /**
   * Cria configuração Redis baseada no ambiente
   */
  private createRedisConfig(): RedisOptions {
    const isProduction = process.env.NODE_ENV === 'production';
    const isTest = process.env.NODE_ENV === 'test';

    const baseConfig: RedisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: isTest ? 1 : 0, // DB separado para testes

      // Configurações de produção baseadas em melhores práticas
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true, // Permite queue de comandos quando Redis não está disponível
      keepAlive: 30000,

      // Estratégia de reconexão exponencial
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        if (times > 10) {
          console.error('[REDIS MANAGER] Máximo de tentativas de reconexão atingido');
          return null;
        }
        return delay;
      },

      // Reconexão automática em erros específicos
      reconnectOnError: (err: Error) => {
        const reconnectErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return reconnectErrors.some(error => err.message.includes(error));
      }
    };

    // Configurações específicas para teste
    if (isTest) {
      return {
        ...baseConfig,
        connectTimeout: 2000,
        commandTimeout: 1000,
        maxRetriesPerRequest: 1,
        enableReadyCheck: false
      };
    }

    // TLS para produção
    if (isProduction) {
      return {
        ...baseConfig,
        tls: {}
      };
    }

    return baseConfig;
  }

  /**
   * Configura event handlers para monitoramento
   */
  private setupEventHandlers(client: Redis): void {
    client.on('connect', () => {
      console.log('[REDIS MANAGER] ✅ Conexão TCP estabelecida');
    });

    client.on('ready', () => {
      console.log('[REDIS MANAGER] 🚀 Cliente Redis pronto');
    });

    client.on('error', (err: Error) => {
      console.error('[REDIS MANAGER] ❌ Erro de conexão:', {
        message: err.message,
        code: (err as any).code,
        timestamp: new Date().toISOString()
      });
    });

    client.on('reconnecting', (delay: number) => {
      console.log(`[REDIS MANAGER] 🔄 Reconectando em ${delay}ms...`);
    });

    client.on('end', () => {
      console.log('[REDIS MANAGER] 🔌 Conexão encerrada');
      this.client = null;
      this.connectionPromise = null;
    });

    // Monitoramento específico para ambiente de teste
    if (process.env.NODE_ENV === 'test') {
      client.on('connect', () => {
        console.log('[REDIS MANAGER] 🧪 Conexão de teste estabelecida');
      });
    }
  }

  /**
   * Obtém o cliente Redis (método principal de acesso)
   * 
   * @returns Promise<Redis> - Cliente Redis conectado
   */
  public async getClient(): Promise<Redis> {
    // Se já existe cliente conectado, retorna
    if (this.client && this.client.status === 'ready') {
      return this.client;
    }

    // Se já está conectando, aguarda a conexão existente
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    // Inicia nova conexão
    this.isConnecting = true;
    this.connectionPromise = this.connect();

    try {
      const client = await this.connectionPromise;
      this.isConnecting = false;
      return client;
    } catch (error) {
      this.isConnecting = false;
      this.connectionPromise = null;
      throw error;
    }
  }

  /**
   * Estabelece conexão com Redis
   */
  private async connect(): Promise<Redis> {
    if (this.client) {
      return this.client;
    }

    const config = this.createRedisConfig();
    this.client = new Redis(config);
    
    this.setupEventHandlers(this.client);

    // Aguarda conexão ser estabelecida
    await this.client.ping();
    
    console.log('[REDIS MANAGER] 🎯 Singleton Redis conectado com sucesso');
    return this.client;
  }

  /**
   * Verifica saúde da conexão
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency?: number;
    error?: string;
    timestamp: string;
  }> {
    try {
      const start = Date.now();
      const client = await this.getClient();
      await client.ping();
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Desconecta e limpa recursos (CRÍTICO para testes)
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        console.log('[REDIS MANAGER] 🧹 Cliente Redis desconectado');
      } catch (error) {
        console.error('[REDIS MANAGER] ⚠️ Erro ao desconectar:', (error as Error).message);
        // Force disconnect em caso de erro
        this.client.disconnect();
      } finally {
        this.client = null;
        this.connectionPromise = null;
        this.isConnecting = false;
      }
    }
  }

  /**
   * Força reset completo (uso em testes apenas)
   */
  public static async resetForTesting(): Promise<void> {
    if (RedisManager.instance) {
      await RedisManager.instance.disconnect();
      RedisManager.instance = null;
    }
  }
}

// Exportações públicas
export const redisManager = RedisManager.getInstance();

/**
 * Obtém cliente Redis conectado
 * Esta é a função principal que deve ser usada em toda a aplicação
 */
export async function getRedisClient(): Promise<Redis> {
  return redisManager.getClient();
}

/**
 * Executa health check do Redis
 */
export async function checkRedisHealth() {
  return redisManager.healthCheck();
}

/**
 * Desconecta Redis (usado principalmente em testes e graceful shutdown)
 */
export async function disconnectRedis(): Promise<void> {
  return redisManager.disconnect();
}

/**
 * Reset para testes (APENAS em ambiente de teste)
 */
export async function resetRedisForTesting(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetRedisForTesting só pode ser usado em ambiente de teste');
  }
  return RedisManager.resetForTesting();
}

// Re-export tipo Redis para conveniência
export type { Redis } from 'ioredis';