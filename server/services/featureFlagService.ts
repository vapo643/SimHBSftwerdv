import {
  initialize,
  isEnabled as unleashIsEnabled,
  startUnleash,
  getVariant,
} from 'unleash-client';
import winston from 'winston';

// Logger configurado para o serviço
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'feature-flags' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Interface para o contexto do usuário
export interface FeatureFlagContext {
  userId?: string;
  userRole?: string | null; // Changed to accept null from AuthenticatedRequest
  sessionId?: string;
  properties?: Record<string, string>;
  environment?: string;
  appName?: string;
  remoteAddress?: string;
}

// Interface para configuração de flags
export interface FeatureFlagConfig {
  url: string;
  appName: string;
  environment: string;
  customHeaders?: Record<string, string>;
  refreshInterval?: number;
  disableMetrics?: boolean;
}

class FeatureFlagService {
  private initialized = false;
  private defaultContext: FeatureFlagContext = {};
  private config: FeatureFlagConfig;
  private fallbackFlags: Map<string, boolean> = new Map();

  constructor() {
    // Configuração padrão para desenvolvimento/teste
    this.config = {
      url: process.env.UNLEASH_URL || 'http://localhost:4242/api',
      appName: process.env.UNLEASH_APP_NAME || 'simpix-app',
      environment: process.env.NODE_ENV || 'development',
      customHeaders: {
        Authorization: process.env.UNLEASH_API_KEY || '*:development.unleash-insecure-api-token',
      },
      refreshInterval: 15000, // 15 segundos
      disableMetrics: process.env.NODE_ENV == 'test',
    };

    // Flags de fallback para quando o serviço Unleash não estiver disponível
    this.setFallbackFlags();
  }

  /**
   * Define flags de fallback para desenvolvimento/teste
   */
  private setFallbackFlags(): void {
    // Flags de sistema
    this.fallbackFlags.set('maintenance-mode', false);
    this.fallbackFlags.set('read-only-mode', false);

    // Flags de feature
    this.fallbackFlags.set('nova-api-experimental', false);
    this.fallbackFlags.set('novo-dashboard', false);
    this.fallbackFlags.set('pagamento-pix-instant', false);
    this.fallbackFlags.set('relatorios-avancados', false);

    // Flags de experimento
    this.fallbackFlags.set('ab-test-onboarding', false);
    this.fallbackFlags.set('canary-release-api-v2', false);

    // Flags de circuit breaker
    this.fallbackFlags.set('circuit-breaker-payments', false);
    this.fallbackFlags.set('circuit-breaker-clicksign', false);
    this.fallbackFlags.set('circuit-breaker-banco-inter', false);
  }

  /**
   * Inicializa o cliente Unleash
   */
  async init(customConfig?: Partial<FeatureFlagConfig>): Promise<void> {
    if (this.initialized) {
      logger.info('Feature flag service already initialized');
      return;
    }

    // Merge configuração customizada
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    try {
      // Em modo teste ou quando UNLEASH_DISABLED=true, usa apenas fallback
      if (process.env.NODE_ENV == 'test' || process.env.UNLEASH_DISABLED == 'true') {
        logger.info('Feature flags running in fallback mode');
        this.initialized = true;
        return;
      }

      // Inicializa o cliente Unleash
      const unleash = initialize({
        url: this.config.url,
        appName: this.config.appName,
        environment: this.config.environment,
        customHeaders: this.config.customHeaders,
        refreshInterval: this.config.refreshInterval,
        disableMetrics: this.config.disableMetrics,
      });

      // Aguarda conexão inicial
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          logger.warn('Unleash connection timeout, using fallback flags');
          resolve();
        }, 5000);

        unleash.on('ready', () => {
          clearTimeout(timeout);
          logger.info('Unleash client connected successfully');
          resolve();
        });

        unleash.on('error', (error) => {
          clearTimeout(timeout);
          logger.error('Unleash initialization error:', error);
          logger.info('Switching to fallback mode due to Unleash connection error');
          // Marca para usar fallback ao invés de tentar conectar repetidamente
          process.env.UNLEASH_DISABLED = 'true';
          resolve(); // Não falha, usa fallback
        });
      });

      this.initialized = true;
      logger.info(`Feature flag service initialized for ${this.config.environment}`);
    }
catch (error) {
      logger.error('Failed to initialize feature flags:', error);
      this.initialized = true; // Marca como inicializado para usar fallback
    }
  }

  /**
   * Define contexto padrão para todas as verificações
   */
  setDefaultContext(context: FeatureFlagContext): void {
    this.defaultContext = context;
  }

  /**
   * Verifica se uma feature flag está habilitada
   */
  async isEnabled(flagName: string, context?: FeatureFlagContext): Promise<boolean> {
    // Garante inicialização
    if (!this.initialized) {
      await this.init();
    }

    // Merge contexto com padrão
    const fullContext = {
      ...this.defaultContext,
      ...context,
      appName: this.config.appName,
      environment: this.config.environment,
    };

    try {
      // Em modo fallback, retorna valor do mapa
      if (process.env.NODE_ENV == 'test' || process.env.UNLEASH_DISABLED == 'true') {
        const fallbackValue = this.fallbackFlags.get(flagName) ?? false;
        logger.debug(`Flag ${flagName} (fallback): ${fallbackValue}`);
        return fallbackValue;
      }

      // Verifica no Unleash (com contexto sanitizado)
      const sanitizedContext = {
        ...fullContext,
        userRole: fullContext.userRole || undefined, // Convert null to undefined
      };
      const enabled = unleashIsEnabled(flagName, sanitizedContext);
      logger.debug(`Flag ${flagName}: ${enabled}`, { context: sanitizedContext });
      return enabled;
    }
catch (error) {
      logger.error(`Error checking flag ${flagName}:`, error);
      // Em caso de erro, usa fallback
      return this.fallbackFlags.get(flagName) ?? false;
    }
  }

  /**
   * Verifica múltiplas flags de uma vez
   */
  async checkMultiple(
    flagNames: string[],
    context?: FeatureFlagContext
  ): Promise<Record<string, boolean>> {
    const _results: Record<string, boolean> = {};

    // Executa verificações em paralelo
    await Promise.all(
      flagNames.map(async (flagName) => {
        results[flagName] = await this.isEnabled(flagName, context);
      })
    );

    return _results;
  }

  /**
   * Obtém variante de uma flag (para A/B testing)
   */
  async getVariant(flagName: string, context?: FeatureFlagContext): Promise<unknown> {
    if (!this.initialized) {
      await this.init();
    }

    const fullContext = {
      ...this.defaultContext,
      ...context,
      appName: this.config.appName,
      environment: this.config.environment,
    };

    try {
      if (process.env.NODE_ENV == 'test' || process.env.UNLEASH_DISABLED == 'true') {
        return { name: 'disabled', enabled: false };
      }

      // Sanitizar contexto para o Unleash
      const sanitizedContext = {
        ...fullContext,
        userRole: fullContext.userRole || undefined, // Convert null to undefined
      };
      const variant = getVariant(flagName, sanitizedContext);
      logger.debug(`Variant for ${flagName}:`, variant);
      return variant;
    }
catch (error) {
      logger.error(`Error getting variant for ${flagName}:`, error);
      return { name: 'disabled', enabled: false };
    }
  }

  /**
   * Atualiza valor de fallback (útil para testes)
   */
  setFallbackFlag(flagName: string, value: boolean): void {
    this.fallbackFlags.set(flagName, value);
    logger.debug(`Fallback flag ${flagName} set to ${value}`);
  }

  /**
   * Retorna todas as flags disponíveis (para debug/admin)
   */
  getAllFlags(): string[] {
    return Array.from(this.fallbackFlags.keys());
  }

  /**
   * Destrói o cliente (para testes)
   */
  async destroy(): Promise<void> {
    if (this.initialized) {
      // Unleash client não tem método destroy, apenas reseta estado
      this.initialized = false;
      this.defaultContext = {};
      logger.info('Feature flag service destroyed');
    }
  }
}

// Singleton instance
export const featureFlagService = new FeatureFlagService();

// Export helper functions para uso direto
export const isEnabled = (flagName: string, context?: FeatureFlagContext) =>
  featureFlagService.isEnabled(flagName, context);

export const checkMultipleFlags = (flagNames: string[], context?: FeatureFlagContext) =>
  featureFlagService.checkMultiple(flagNames, context);

export default featureFlagService;
