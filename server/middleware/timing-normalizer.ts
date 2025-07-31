import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface TimingConfig {
  baselineMs: number;
  jitterRange: number;
  enabled?: boolean;
}

interface TimingMetrics {
  endpoint: string;
  method: string;
  status: number;
  actualTime: number;
  artificialDelay: number;
  totalTime: number;
  timestamp: string;
}

class TimingNormalizer {
  private configs: Map<string, TimingConfig> = new Map();
  private metrics: TimingMetrics[] = [];
  private readonly maxMetricsHistory = 10000;

  constructor() {
    // Configurações padrão por categoria de endpoint
    this.setConfig('/api/propostas/:id', { baselineMs: 25, jitterRange: 5 });
    this.setConfig('/api/propostas/:id/status', { baselineMs: 30, jitterRange: 5 });
    this.setConfig('/api/auth/*', { baselineMs: 100, jitterRange: 20 });
    this.setConfig('/api/admin/*', { baselineMs: 20, jitterRange: 4 });
    this.setConfig('/api/test/*', { baselineMs: 25, jitterRange: 5 });  // Test endpoints
    this.setConfig('default', { baselineMs: 15, jitterRange: 3 });
  }

  public setConfig(pattern: string, config: TimingConfig): void {
    this.configs.set(pattern, { ...config, enabled: config.enabled ?? true });
  }

  private matchesPattern(path: string, pattern: string): boolean {
    if (pattern === 'default') return true;
    
    // Converter pattern do Express para regex
    const regexPattern = pattern
      .replace(/:\w+/g, '[^/]+')  // :id -> [^/]+
      .replace(/\*/g, '.*')       // * -> .*
      .replace(/\//g, '\\/');     // escape /
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  private getConfigForEndpoint(method: string, path: string): TimingConfig {
    // Buscar configuração específica
    const entries = Array.from(this.configs.entries());
    for (const [pattern, config] of entries) {
      if (pattern !== 'default' && this.matchesPattern(path, pattern)) {
        return config;
      }
    }
    
    // Fallback para configuração padrão
    return this.configs.get('default') || { baselineMs: 15, jitterRange: 3 };
  }

  private generateSecureJitter(range: number): number {
    // Usar crypto.randomBytes para jitter criptograficamente seguro
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0) / 0xFFFFFFFF; // Normalizar para 0-1
    return (randomValue - 0.5) * 2 * range; // Converter para ±range
  }

  private async artificialDelay(ms: number): Promise<void> {
    if (ms <= 0) return;
    
    return new Promise(resolve => {
      // Usar setImmediate para evitar blocking do event loop
      setTimeout(() => resolve(), ms);
    });
  }

  private recordMetrics(
    req: Request,
    res: Response,
    actualTime: number,
    artificialDelay: number
  ): void {
    const metric: TimingMetrics = {
      endpoint: req.route?.path || req.path,
      method: req.method,
      status: res.statusCode,
      actualTime,
      artificialDelay,
      totalTime: actualTime + artificialDelay,
      timestamp: new Date().toISOString()
    };

    this.metrics.push(metric);
    
    // Limitar histórico para evitar vazamento de memória
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.splice(0, this.metrics.length - this.maxMetricsHistory);
    }
  }

  public getMetrics(): TimingMetrics[] {
    return [...this.metrics];
  }

  public getStatistics(endpoint?: string): any {
    let filteredMetrics = this.metrics;
    
    if (endpoint) {
      filteredMetrics = this.metrics.filter(m => m.endpoint === endpoint);
    }

    if (filteredMetrics.length === 0) {
      return { count: 0 };
    }

    const actualTimes = filteredMetrics.map(m => m.actualTime);
    const totalTimes = filteredMetrics.map(m => m.totalTime);
    
    actualTimes.sort((a, b) => a - b);
    totalTimes.sort((a, b) => a - b);

    const percentile = (arr: number[], p: number) => {
      const index = Math.ceil(arr.length * p / 100) - 1;
      return arr[index] || 0;
    };

    return {
      count: filteredMetrics.length,
      actualTime: {
        min: Math.min(...actualTimes),
        max: Math.max(...actualTimes),
        avg: actualTimes.reduce((a, b) => a + b, 0) / actualTimes.length,
        p50: percentile(actualTimes, 50),
        p95: percentile(actualTimes, 95),
        p99: percentile(actualTimes, 99)
      },
      totalTime: {
        min: Math.min(...totalTimes),
        max: Math.max(...totalTimes),
        avg: totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length,
        p50: percentile(totalTimes, 50),
        p95: percentile(totalTimes, 95),
        p99: percentile(totalTimes, 99)
      }
    };
  }

  public middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const config = this.getConfigForEndpoint(req.method, req.path);
      
      console.log(`🚀 [TIMING MIDDLEWARE] ${req.method} ${req.path} - Config: baseline=${config.baselineMs}ms, jitter=±${config.jitterRange}ms, enabled=${config.enabled}`);
      
      if (!config.enabled) {
        console.log(`⏭️ [TIMING MIDDLEWARE] Skipping ${req.path} - disabled`);
        return next();
      }

      const startTime = process.hrtime.bigint();
      
      // Interceptar o final da resposta usando res.end (mais confiável)
      const originalEnd = res.end;
      res.end = function(this: Response, chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) {
        const endTime = process.hrtime.bigint();
        const actualTimeMs = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
        
        // Calcular delay necessário
        const jitter = timingNormalizer.generateSecureJitter(config.jitterRange);
        const targetTime = config.baselineMs + jitter;
        const delayNeeded = Math.max(0, targetTime - actualTimeMs);
        
        console.log(`🕐 [TIMING] ${req.method} ${req.path}: actual=${actualTimeMs.toFixed(2)}ms, target=${targetTime.toFixed(2)}ms, delay=${delayNeeded.toFixed(2)}ms`);
        
        // Aplicar delay artificial ANTES de enviar resposta
        setTimeout(() => {
          // Registrar métricas
          timingNormalizer.recordMetrics(req, res, actualTimeMs, delayNeeded);
          
          // Enviar resposta original com delay aplicado
          originalEnd.call(this, chunk, encoding as BufferEncoding, cb as (() => void));
        }, Math.round(delayNeeded));
        
        return this;
      };

      next();
    };
  }
}

// Singleton instance
export const timingNormalizer = new TimingNormalizer();

// Debug: Create middleware instance with logging
console.log('🚀 [TIMING MIDDLEWARE] Creating middleware instance...');
export const timingNormalizerMiddleware = timingNormalizer.middleware();
console.log('🚀 [TIMING MIDDLEWARE] Middleware instance created and exported');

// Export para debugging/monitoring
export { TimingNormalizer, TimingConfig, TimingMetrics };