/**
 * PAM V1.0 - Rate Limiting Service with Exponential Backoff
 * Sistema inteligente de rate limiting com backoff exponencial
 * Para garantir escalabilidade e evitar throttling das APIs
 */

interface RateLimitConfig {
  maxRequestsPerSecond: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

interface RateLimitState {
  requestCount: number;
  windowStart: number;
  lastRequestTime: number;
  failureCount: number;
  currentDelay: number;
}

class RateLimitService {
  private states: Map<string, RateLimitState> = new Map();
  private defaultConfig: RateLimitConfig = {
    maxRequestsPerSecond: 5, // Limite observado do Banco Inter
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000
  };

  /**
   * Aguarda com rate limiting inteligente
   */
  async waitForRateLimit(
    serviceId: string, 
    customConfig?: Partial<RateLimitConfig>
  ): Promise<void> {
    const config = { ...this.defaultConfig, ...customConfig };
    
    // Inicializar estado se não existir
    if (!this.states.has(serviceId)) {
      this.states.set(serviceId, {
        requestCount: 0,
        windowStart: Date.now(),
        lastRequestTime: 0,
        failureCount: 0,
        currentDelay: config.baseDelayMs
      });
    }

    const state = this.states.get(serviceId)!;
    const now = Date.now();

    // Reset janela se passou 1 segundo
    if (now - state.windowStart >= 1000) {
      state.requestCount = 0;
      state.windowStart = now;
    }

    // Verificar limite de taxa
    if (state.requestCount >= config.maxRequestsPerSecond) {
      const waitTime = 1000 - (now - state.windowStart);
      if (waitTime > 0) {
        console.log(`[RATE LIMIT] ⏳ Aguardando ${waitTime}ms para respeitar limite de ${config.maxRequestsPerSecond} req/s`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Reset após espera
        state.requestCount = 0;
        state.windowStart = Date.now();
      }
    }

    // Aplicar delay mínimo entre requests
    const timeSinceLastRequest = now - state.lastRequestTime;
    const minDelay = 1000 / config.maxRequestsPerSecond; // 200ms para 5 req/s
    
    if (timeSinceLastRequest < minDelay) {
      const delayNeeded = minDelay - timeSinceLastRequest;
      console.log(`[RATE LIMIT] ⏱️ Delay mínimo de ${delayNeeded}ms entre requests`);
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }

    // Atualizar contadores
    state.requestCount++;
    state.lastRequestTime = Date.now();
  }

  /**
   * Registra falha e calcula backoff exponencial
   */
  async handleFailure(
    serviceId: string, 
    error: any,
    customConfig?: Partial<RateLimitConfig>
  ): Promise<boolean> {
    const config = { ...this.defaultConfig, ...customConfig };
    
    if (!this.states.has(serviceId)) {
      this.states.set(serviceId, {
        requestCount: 0,
        windowStart: Date.now(),
        lastRequestTime: 0,
        failureCount: 0,
        currentDelay: config.baseDelayMs
      });
    }

    const state = this.states.get(serviceId)!;
    state.failureCount++;

    // Verificar se é erro de rate limit (429) ou similar
    const isRateLimitError = error?.response?.status === 429 || 
                           error?.message?.includes('rate limit') ||
                           error?.message?.includes('too many requests');

    if (isRateLimitError) {
      // Backoff exponencial para erros de rate limit
      state.currentDelay = Math.min(
        state.currentDelay * 2,
        config.maxDelayMs
      );
      
      console.log(`[RATE LIMIT] 🔴 Rate limit atingido! Backoff: ${state.currentDelay}ms (tentativa ${state.failureCount}/${config.maxRetries})`);
    } else {
      // Delay menor para outros erros
      state.currentDelay = Math.min(
        config.baseDelayMs * state.failureCount,
        config.maxDelayMs / 2
      );
      
      console.log(`[RATE LIMIT] ⚠️ Erro detectado. Delay: ${state.currentDelay}ms (tentativa ${state.failureCount}/${config.maxRetries})`);
    }

    // Verificar se deve continuar tentando
    if (state.failureCount >= config.maxRetries) {
      console.error(`[RATE LIMIT] ❌ Máximo de tentativas (${config.maxRetries}) atingido para ${serviceId}`);
      return false; // Não deve tentar novamente
    }

    // Aguardar com backoff
    await new Promise(resolve => setTimeout(resolve, state.currentDelay));
    
    return true; // Pode tentar novamente
  }

  /**
   * Reset estado após sucesso
   */
  handleSuccess(serviceId: string): void {
    const state = this.states.get(serviceId);
    if (state) {
      state.failureCount = 0;
      state.currentDelay = this.defaultConfig.baseDelayMs;
      console.log(`[RATE LIMIT] ✅ Request bem-sucedido. Reset de contadores para ${serviceId}`);
    }
  }

  /**
   * Executar função com rate limiting e retry automático
   */
  async executeWithRateLimit<T>(
    serviceId: string,
    fn: () => Promise<T>,
    customConfig?: Partial<RateLimitConfig>
  ): Promise<T> {
    const config = { ...this.defaultConfig, ...customConfig };
    let lastError: any;

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      try {
        // Aguardar rate limit
        await this.waitForRateLimit(serviceId, config);
        
        // Executar função
        const result = await fn();
        
        // Registrar sucesso
        this.handleSuccess(serviceId);
        
        return result;
      } catch (error) {
        lastError = error;
        console.error(`[RATE LIMIT] Tentativa ${attempt + 1}/${config.maxRetries} falhou:`, error);
        
        // Verificar se deve tentar novamente
        const shouldRetry = await this.handleFailure(serviceId, error, config);
        
        if (!shouldRetry) {
          break;
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    throw lastError;
  }

  /**
   * Obter estatísticas do rate limiting
   */
  getStats(serviceId?: string): any {
    if (serviceId) {
      return this.states.get(serviceId) || null;
    }
    
    const stats: any = {};
    this.states.forEach((state, id) => {
      stats[id] = {
        ...state,
        windowRemaining: Math.max(0, 1000 - (Date.now() - state.windowStart))
      };
    });
    
    return stats;
  }

  /**
   * Limpar estado de um serviço
   */
  clearState(serviceId: string): void {
    this.states.delete(serviceId);
    console.log(`[RATE LIMIT] 🧹 Estado limpo para ${serviceId}`);
  }
}

// Singleton
export const rateLimitService = new RateLimitService();