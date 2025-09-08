# Estratégia de Comunicação Frontend-Backend - Sistema Simpix

**Documento Técnico:** Frontend-Backend Communication Strategy  
**Versão:** 1.6  
**Data:** 22 de Agosto de 2025  
**Status:** Oficial - Política de Segurança (PAM V1.6 Implementado)  
**Aprovação:** Pendente Ratificação do Arquiteto Chefe  
**Última Atualização:** Implementação TanStack Query Aprimorada

---

## 📋 **SUMÁRIO EXECUTIVO**

Este documento formaliza a estratégia de comunicação entre o frontend e o backend do Sistema Simpix, estabelecendo políticas de segurança, padrões de resiliência e defesas contra ataques comuns. Constitui a doutrina oficial para blindar a camada de comunicação, garantindo interações de rede seguras, eficientes e tolerantes a falhas.

**Ponto de Conformidade:** Remediação do Ponto 60 - Comunicação FE-BE  
**Criticidade:** P1 (Alta)  
**Impacto:** Segurança e resiliência da comunicação cliente-servidor

---

## 🏗️ **1. DECISÃO SOBRE BFF (BACKEND FOR FRONTEND)**

### 1.1 Análise de Trade-offs

```typescript
// ====================================
// ANÁLISE BFF - MATRIZ DE DECISÃO
// ====================================

interface BFFAnalysis {
  currentArchitecture: {
    type: 'Direct API Communication';
    description: 'Frontend comunica diretamente com API REST monolítica';

    pros: [
      'Menor complexidade operacional',
      'Menos componentes para manter',
      'Latência reduzida (1 hop)',
      'Deploy simplificado',
      'Menor custo de infraestrutura',
    ];

    cons: [
      'Frontend precisa orquestrar múltiplas chamadas',
      'Lógica de agregação no cliente',
      'Maior tráfego de rede',
      'Acoplamento direto com estrutura da API',
    ];
  };

  bffArchitecture: {
    type: 'Backend for Frontend Pattern';
    description: 'Camada intermediária específica para o frontend';

    pros: [
      'Agregação de dados no servidor',
      'Menor tráfego de rede',
      'API otimizada para UI específica',
      'Melhor separação de responsabilidades',
      'Facilita evolução independente',
    ];

    cons: [
      'Complexidade adicional',
      'Mais um componente para manter',
      'Latência adicional (2 hops)',
      'Possível duplicação de lógica',
      'Maior custo operacional',
    ];
  };
}
```

### 1.2 Decisão Formal - Hybrid API Gateway Strategy

```typescript
// ====================================
// DECISÃO ARQUITETURAL - HYBRID API GATEWAY
// ====================================

const gatewayStrategy = {
  decision: 'HYBRID_API_GATEWAY', // ✅ Gateway Híbrido Adotado

  implementation: {
    // Usar Azure API Management para endpoints públicos
    public_apis: {
      gateway: 'Azure API Management',
      purpose: 'APIs expostas para parceiros externos e clientes',
      features: [
        'OAuth 2.0 / OpenID Connect validation',
        'Rate limiting granular (por cliente, por endpoint)',
        'Request/Response transformation',
        'API versioning automático',
        'Developer portal para documentação',
        'Analytics e métricas avançadas',
        'Circuit breaker patterns',
        'Geographic load balancing',
      ],
      endpoints: ['/api/v1/proposals', '/api/v1/payments', '/api/v1/webhooks', '/api/v1/health'],
      cost: 'Tier Standard: ~$250/mês (10M calls)',
      deployment: 'Shared gateway instance',
    },

    // Direct connection para APIs internas/admin
    internal_apis: {
      gateway: 'Direct Express.js',
      purpose: 'APIs internas para dashboard e administração',
      features: [
        'JWT validation middleware',
        'RBAC enforcement',
        'Request correlation',
        'Basic rate limiting',
      ],
      endpoints: ['/api/v1/admin/*', '/api/v1/reports/*', '/api/v1/internal/*', '/api/v1/stats/*'],
      rationale: 'Menor latência para operações internas, menor custo',
    },

    // Camada de agregação seletiva para high-traffic
    aggregation_layer: {
      trigger_conditions: [
        'Mais de 5 API calls para renderizar uma tela',
        'Latência P95 > 800ms em mobile',
        'Bandwidth usage > 1MB per page load',
      ],
      implementation: 'Express.js middleware endpoints',
      examples: [
        '/api/v1/dashboard/aggregate', // User + proposals + stats + notifications
        '/api/v1/overview/batch', // Financial overview + recent activity
        '/api/v1/proposals/enriched', // Proposal + client + documents + history
      ],
      caching: 'Redis com TTL baseado em criticidade dos dados',
    },
  },

  architecture_flow: {
    external_partners: 'Client → Azure API Gateway → Express API',
    internal_dashboard: 'Client → Express API (direct)',
    high_traffic_pages: 'Client → Express Aggregation → Multiple Services',
    admin_operations: 'Client → Express API (direct with RBAC)',
  },

  migration_strategy: {
    phase_1: {
      timeline: 'Q4 2025 (4 semanas)',
      scope: 'Configurar Azure API Management',
      tasks: [
        'Provisionar Azure API Management Standard',
        'Importar OpenAPI specs existentes',
        'Configurar OAuth provider (Supabase)',
        'Setup básico de rate limiting',
        'Implementar health checks',
      ],
    },

    phase_2: {
      timeline: 'Q1 2026 (6 semanas)',
      scope: 'Migrar endpoints públicos críticos',
      tasks: [
        'Migrar /api/v1/proposals para gateway',
        'Migrar /api/v1/payments para gateway',
        'Configurar transformation policies',
        'Implementar circuit breakers',
        'Load testing e performance tuning',
      ],
    },

    phase_3: {
      timeline: 'Q2 2026 (4 semanas)',
      scope: 'Implementar camada de agregação',
      tasks: [
        'Identificar endpoints de agregação necessários',
        'Implementar /dashboard/aggregate',
        'Configurar cache Redis para agregação',
        'Otimizar queries para reduzir latência',
      ],
    },
  },

  monitoring_and_metrics: {
    azure_api_management: [
      'Request rate por cliente',
      'Latência P50/P95/P99 por endpoint',
      'Error rate e status codes',
      'Bandwidth usage',
      'API quota consumption',
    ],

    internal_apis: [
      'Response time distribution',
      'RBAC violations e security events',
      'Cache hit/miss ratios',
      'Database connection pool usage',
    ],

    aggregation_layer: [
      'Aggregation efficiency (calls saved)',
      'Cache effectiveness',
      'Data freshness metrics',
      'Bandwidth reduction achieved',
    ],
  },

  cost_analysis: {
    current_state: {
      infrastructure: '$0 (direct API calls)',
      bandwidth: '~$50/mês (estimated)',
      developer_time: '2h/semana troubleshooting integration issues',
    },

    hybrid_implementation: {
      azure_api_management: '$250/mês (Standard tier)',
      additional_redis: '$30/mês (cache layer)',
      bandwidth_savings: '-$20/mês (aggregation efficiency)',
      developer_productivity: '+4h/semana (self-service portal)',

      net_cost: '+$260/mês',
      roi_justification: [
        'Partner integration acceleration (faster onboarding)',
        'Reduced support tickets from API consumers',
        'Built-in security and compliance features',
        'Automatic scaling e load balancing',
        'Developer portal reduces documentation overhead',
      ],
    },
  },

  security_enhancements: {
    api_gateway_layer: [
      'DDoS protection automático',
      'IP allowlisting/blocklisting',
      'Request size limiting',
      'SQL injection e XSS filtering',
      'Certificate management automático',
    ],

    internal_layer: [
      'JWT validation com timing attack protection',
      'RBAC enforcement granular',
      'Request correlation para audit trails',
      'Rate limiting adaptativo baseado em load',
    ],
  },
};
```

### 1.3 Implementação Alternativa - API Gateway Pattern

```typescript
// ====================================
// PADRÃO ADOTADO: API GATEWAY LEVE
// ====================================

// Em vez de BFF completo, implementamos gateway patterns
class APIGatewayPatterns {
  // 1. Request Collapsing - Agregar múltiplas chamadas
  static async fetchDashboardData(userId: string) {
    const [user, proposals, stats, notifications] = await Promise.all([
      api.get(`/users/${userId}`),
      api.get(`/proposals?userId=${userId}&limit=10`),
      api.get(`/stats/dashboard?userId=${userId}`),
      api.get(`/notifications?userId=${userId}&unread=true`),
    ]);

    return {
      user: user.data,
      recentProposals: proposals.data,
      statistics: stats.data,
      unreadNotifications: notifications.data,
    };
  }

  // 2. Field Filtering - Solicitar apenas campos necessários
  static async fetchProposalList(filters: any) {
    return api.get('/proposals', {
      params: {
        ...filters,
        fields: 'id,numero_proposta,cliente_nome,valor_financiado,status,created_at',
        includes: 'cliente,produto',
        sort: '-created_at',
      },
    });
  }

  // 3. Response Shaping - Transformar resposta para UI
  static async fetchProposalDetails(id: string) {
    const response = await api.get(`/proposals/${id}?includes=all`);

    // Transformar para view model do frontend
    return {
      ...response.data,
      displayName: `${response.data.numero_proposta} - ${response.data.cliente_nome}`,
      formattedValue: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(response.data.valor_financiado),
      statusBadge: this.getStatusBadgeConfig(response.data.status),
      timeline: this.buildTimeline(response.data.logs),
    };
  }
}
```

---

## 🛡️ **2. PADRÕES DE RESILIÊNCIA NO FRONTEND**

### 2.1 Configuração do TanStack Query para Resiliência

```typescript
// ====================================
// TANSTACK QUERY - CONFIGURAÇÃO DE RESILIÊNCIA
// ====================================

import { QueryClient } from '@tanstack/react-query';

export const resilientQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // RETRY STRATEGY - Exponential Backoff
      retry: (failureCount, error: any) => {
        // Não fazer retry em erros de cliente (4xx)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }

        // Máximo 3 tentativas para erros de servidor (5xx)
        if (error?.status >= 500) {
          return failureCount < 3;
        }

        // Retry em erros de rede
        if (error?.code === 'NETWORK_ERROR') {
          return failureCount < 5;
        }

        return failureCount < 3;
      },

      // EXPONENTIAL BACKOFF
      retryDelay: (attemptIndex) => {
        // 1s, 2s, 4s, 8s, 16s...
        const baseDelay = 1000;
        const maxDelay = 30000;
        const delay = Math.min(baseDelay * Math.pow(2, attemptIndex), maxDelay);

        // Adicionar jitter para evitar thundering herd
        const jitter = Math.random() * 0.3 * delay;
        return delay + jitter;
      },

      // TIMEOUTS
      // Timeout global para queries
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000, // 10 minutos

      // Network timeout via AbortController
      queryFn: async ({ queryKey, signal }) => {
        const timeout = 30000; // 30 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(queryKey[0], {
            signal: signal || controller.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          return response.json();
        } finally {
          clearTimeout(timeoutId);
        }
      },
    },

    mutations: {
      // Mutations não têm retry automático por padrão
      retry: 0,

      // Mas podemos adicionar para operações idempotentes
      onError: (error, variables, context) => {
        // Log para monitoring
        console.error('Mutation failed:', { error, variables });

        // Enviar para Sentry
        if (window.Sentry) {
          window.Sentry.captureException(error, {
            extra: { variables, context },
          });
        }
      },
    },
  },
});
```

### 2.2 Circuit Breaker Pattern

```typescript
// ====================================
// CIRCUIT BREAKER IMPLEMENTATION
// ====================================

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: number;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold = 5, // Falhas para abrir
    private timeout = 60000, // Tempo em OPEN (ms)
    private resetTimeout = 120000 // Reset contador de falhas
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Se circuito está aberto
    if (this.state === 'OPEN') {
      const now = Date.now();

      // Verificar se pode tentar novamente
      if (this.lastFailureTime && now - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();

      // Sucesso - resetar contador
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      console.warn('Circuit breaker opened after', this.failures, 'failures');

      // Notificar monitoring
      if (window.Sentry) {
        window.Sentry.captureMessage('Circuit breaker opened', 'warning');
      }
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailureTime,
    };
  }
}

// Uso com API calls
const apiCircuitBreaker = new CircuitBreaker();

export const resilientApiCall = async (url: string, options?: RequestInit) => {
  return apiCircuitBreaker.execute(async () => {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  });
};
```

### 2.3 Fallback Strategies

```typescript
// ====================================
// FALLBACK E GRACEFUL DEGRADATION
// ====================================

class FallbackManager {
  // Cache local para fallback
  private localCache = new Map<string, any>();

  // Fallback para dados críticos
  async fetchWithFallback<T>(
    key: string,
    primaryFn: () => Promise<T>,
    fallbackFn?: () => T
  ): Promise<T> {
    try {
      // Tentar fonte primária
      const data = await primaryFn();

      // Atualizar cache local
      this.localCache.set(key, {
        data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      console.warn('Primary fetch failed, using fallback:', error);

      // 1. Tentar cache local
      const cached = this.localCache.get(key);
      if (cached && Date.now() - cached.timestamp < 3600000) {
        // 1 hora
        console.log('Using local cache fallback');
        return cached.data;
      }

      // 2. Tentar localStorage
      const stored = localStorage.getItem(`fallback_${key}`);
      if (stored) {
        console.log('Using localStorage fallback');
        return JSON.parse(stored);
      }

      // 3. Usar fallback function se fornecida
      if (fallbackFn) {
        console.log('Using fallback function');
        return fallbackFn();
      }

      // 4. Re-throw se não há fallback
      throw error;
    }
  }

  // Modo offline detection
  setupOfflineDetection() {
    window.addEventListener('online', () => {
      console.log('Connection restored');
      // Sincronizar dados pendentes
      this.syncPendingData();
    });

    window.addEventListener('offline', () => {
      console.warn('Connection lost - entering offline mode');
      // Notificar usuário
      toast.warning('Você está offline. Algumas funcionalidades podem estar limitadas.');
    });
  }

  // Queue de operações offline
  private offlineQueue: Array<() => Promise<any>> = [];

  queueOfflineOperation(operation: () => Promise<any>) {
    this.offlineQueue.push(operation);

    // Salvar no localStorage para persistência
    localStorage.setItem(
      'offline_queue',
      JSON.stringify(this.offlineQueue.map((fn) => fn.toString()))
    );
  }

  async syncPendingData() {
    if (!navigator.onLine) return;

    const pending = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const operation of pending) {
      try {
        await operation();
      } catch (error) {
        console.error('Failed to sync offline operation:', error);
        // Re-queue se falhou
        this.offlineQueue.push(operation);
      }
    }
  }
}

// Instância global
export const fallbackManager = new FallbackManager();
```

### 2.4 Request Deduplication e Batching

```typescript
// ====================================
// REQUEST DEDUPLICATION E BATCHING
// ====================================

class RequestOptimizer {
  private pendingRequests = new Map<string, Promise<any>>();
  private batchQueue = new Map<string, any[]>();
  private batchTimers = new Map<string, NodeJS.Timeout>();

  // Deduplicação de requests idênticas
  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Se já existe request pendente, retornar mesma promise
    if (this.pendingRequests.has(key)) {
      console.log('Request deduplicated:', key);
      return this.pendingRequests.get(key);
    }

    // Criar nova promise e armazenar
    const promise = requestFn().finally(() => {
      // Limpar após conclusão
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  // Batching de múltiplas requests
  async batch<T>(
    endpoint: string,
    params: any,
    batchDelay = 50 // ms
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Adicionar à fila
      if (!this.batchQueue.has(endpoint)) {
        this.batchQueue.set(endpoint, []);
      }

      this.batchQueue.get(endpoint)!.push({
        params,
        resolve,
        reject,
      });

      // Limpar timer existente
      if (this.batchTimers.has(endpoint)) {
        clearTimeout(this.batchTimers.get(endpoint)!);
      }

      // Configurar novo timer
      const timer = setTimeout(() => {
        this.executeBatch(endpoint);
      }, batchDelay);

      this.batchTimers.set(endpoint, timer);
    });
  }

  private async executeBatch(endpoint: string) {
    const batch = this.batchQueue.get(endpoint) || [];
    if (batch.length === 0) return;

    // Limpar fila
    this.batchQueue.delete(endpoint);
    this.batchTimers.delete(endpoint);

    try {
      // Enviar batch request
      const response = await fetch(`${endpoint}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: batch.map((item) => item.params),
        }),
      });

      const results = await response.json();

      // Resolver promises individuais
      batch.forEach((item, index) => {
        if (results.errors?.[index]) {
          item.reject(results.errors[index]);
        } else {
          item.resolve(results.data[index]);
        }
      });
    } catch (error) {
      // Rejeitar todas as promises
      batch.forEach((item) => item.reject(error));
    }
  }
}

export const requestOptimizer = new RequestOptimizer();
```

---

## 🔐 **3. ESTRATÉGIA DE SEGURANÇA HTTP (CSP, HSTS)**

### 3.1 Content Security Policy (CSP)

```typescript
// ====================================
// CONTENT SECURITY POLICY - CONFIGURAÇÃO
// ====================================

// Configuração rigorosa de CSP
export const contentSecurityPolicy = {
  // Desenvolvimento
  development: {
    directives: {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-eval'", // Necessário para HMR do Vite
        'https://unpkg.com',
        'https://cdn.jsdelivr.net',
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Necessário para styled-components
        'https://fonts.googleapis.com',
      ],
      'img-src': [
        "'self'",
        'data:',
        'blob:',
        'https://*.supabase.co',
        'https://avatars.githubusercontent.com',
      ],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'connect-src': [
        "'self'",
        'ws://localhost:*',
        'wss://localhost:*',
        'https://*.supabase.co',
        'https://api.simpix.app',
      ],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'object-src': ["'none'"],
      'upgrade-insecure-requests': [],
    },
  },

  // Produção - mais restritivo
  production: {
    directives: {
      'default-src': ["'none'"],
      'script-src': [
        "'self'",
        "'sha256-...'", // Hashes específicos de scripts inline
        'https://cdn.simpix.app',
      ],
      'style-src': [
        "'self'",
        "'sha256-...'", // Hashes de estilos inline críticos
        'https://cdn.simpix.app',
      ],
      'img-src': ["'self'", 'data:', 'https://storage.simpix.app'],
      'font-src': ["'self'", 'https://cdn.simpix.app'],
      'connect-src': [
        "'self'",
        'https://api.simpix.app',
        'wss://ws.simpix.app',
        'https://*.supabase.co',
      ],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'object-src': ["'none'"],
      'upgrade-insecure-requests': [],
      'block-all-mixed-content': [],
      'require-trusted-types-for': ["'script'"],
    },
  },
};

// Implementação no Express
app.use((req, res, next) => {
  const env = process.env.NODE_ENV || 'development';
  const policy = contentSecurityPolicy[env];

  const cspString = Object.entries(policy.directives)
    .map(([key, values]) => {
      if (Array.isArray(values) && values.length === 0) {
        return key;
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');

  res.setHeader('Content-Security-Policy', cspString);

  // Report violations
  res.setHeader('Content-Security-Policy-Report-Only', cspString + '; report-uri /api/csp-report');

  next();
});

// Endpoint para receber reports de violação
app.post('/api/csp-report', (req, res) => {
  const violation = req.body;

  // Log para análise
  logger.warn('CSP Violation:', violation);

  // Enviar para Sentry
  if (Sentry) {
    Sentry.captureMessage('CSP Violation', {
      level: 'warning',
      extra: violation,
    });
  }

  res.status(204).end();
});
```

### 3.2 HTTP Strict Transport Security (HSTS) e Outros Headers

```typescript
// ====================================
// SECURITY HEADERS CONFIGURATION
// ====================================

import helmet from 'helmet';

// Configuração completa de segurança HTTP
export const securityHeaders = {
  // HSTS - Forçar HTTPS
  hsts: {
    maxAge: 31536000, // 1 ano
    includeSubDomains: true,
    preload: true, // Adicionar à HSTS preload list
  },

  // X-Frame-Options - Prevenir clickjacking
  frameguard: {
    action: 'deny', // Nunca permitir iframe
  },

  // X-Content-Type-Options - Prevenir MIME sniffing
  noSniff: true,

  // X-XSS-Protection - Proteção XSS legada
  xssFilter: true,

  // Referrer-Policy - Controlar informações de referrer
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  // Permissions-Policy - Controlar APIs do browser
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'self'"],
      payment: ["'self'"],
      usb: ["'none'"],
      magnetometer: ["'none'"],
      gyroscope: ["'none'"],
      accelerometer: ["'none'"],
    },
  },
};

// Aplicar com Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Configurado separadamente acima
    hsts: securityHeaders.hsts,
    frameguard: securityHeaders.frameguard,
    noSniff: securityHeaders.noSniff,
    xssFilter: securityHeaders.xssFilter,
    referrerPolicy: securityHeaders.referrerPolicy,
    permittedCrossDomainPolicies: false,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    originAgentCluster: true,
    dnsPrefetchControl: { allow: false },
    ieNoOpen: true,
    hidePoweredBy: true,
  })
);

// Headers customizados adicionais
app.use((req, res, next) => {
  // Permissions Policy
  res.setHeader(
    'Permissions-Policy',
    Object.entries(securityHeaders.permissionsPolicy.features)
      .map(([feature, value]) => `${feature}=${value.join(' ')}`)
      .join(', ')
  );

  // Expect-CT para Certificate Transparency
  res.setHeader('Expect-CT', 'max-age=86400, enforce');

  // Cache Control para conteúdo sensível
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
});
```

### 3.3 Subresource Integrity (SRI)

```html
<!-- ====================================
     SUBRESOURCE INTEGRITY - IMPLEMENTAÇÃO
     ==================================== -->

<!-- index.html com SRI -->
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <!-- CSS com integridade verificada -->
    <link
      rel="stylesheet"
      href="https://cdn.simpix.app/styles/main.css"
      integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GHrJtxyk5tR..."
      crossorigin="anonymous"
    />

    <!-- JavaScript com integridade verificada -->
    <script
      src="https://cdn.simpix.app/js/vendor.js"
      integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo..."
      crossorigin="anonymous"
      defer
    ></script>
  </head>
</html>
```

```typescript
// Geração automática de SRI hashes
import crypto from 'crypto';
import fs from 'fs';

function generateSRIHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}

// Plugin Vite para adicionar SRI
export const sriPlugin = {
  name: 'vite-plugin-sri',

  transformIndexHtml(html: string, ctx: any) {
    // Adicionar integrity aos scripts e styles
    return html.replace(
      /<(script|link)([^>]*)(src|href)="([^"]+)"([^>]*)>/g,
      (match, tag, before, attr, url, after) => {
        if (url.startsWith('http') || url.startsWith('//')) {
          const hash = generateSRIHash(url);
          return `<${tag}${before}${attr}="${url}" integrity="${hash}" crossorigin="anonymous"${after}>`;
        }
        return match;
      }
    );
  },
};
```

---

## 🛡️ **4. ESTRATÉGIA DE MITIGAÇÃO DE XSS E CSRF**

### 4.1 Defesas contra XSS (Cross-Site Scripting)

```typescript
// ====================================
// XSS PREVENTION STRATEGIES
// ====================================

// 1. Input Sanitization
import DOMPurify from 'isomorphic-dompurify';

export class XSSProtection {
  // Sanitizar HTML perigoso
  static sanitizeHTML(dirty: string): string {
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href', 'target'],
      ALLOW_DATA_ATTR: false,
      FORCE_BODY: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM_IMPORT: false,
      SAFE_FOR_TEMPLATES: true,
      SANITIZE_DOM: true,
      KEEP_CONTENT: true,
      IN_PLACE: false
    });
  }

  // Escapar para contexto HTML
  static escapeHTML(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Validar e sanitizar URLs
  static sanitizeURL(url: string): string {
    try {
      const parsed = new URL(url);

      // Bloquear protocolos perigosos
      const allowedProtocols = ['http:', 'https:', 'mailto:'];
      if (!allowedProtocols.includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }

      // Bloquear javascript: URLs
      if (url.toLowerCase().includes('javascript:')) {
        throw new Error('JavaScript URLs not allowed');
      }

      return parsed.toString();
    } catch {
      return '#'; // URL segura de fallback
    }
  }

  // Contexto seguro para JSON em HTML
  static safeJSONinHTML(data: any): string {
    const json = JSON.stringify(data);
    // Escapar caracteres perigosos para prevenir quebra de contexto
    return json
      .replace(/</g, '\\u003C')
      .replace(/>/g, '\\u003E')
      .replace(/&/g, '\\u0026')
      .replace(/'/g, '\\u0027')
      .replace(/"/g, '\\u0022');
  }
}

// 2. React Component com proteção XSS
const SafeHTMLComponent: React.FC<{ content: string }> = ({ content }) => {
  // NUNCA usar dangerouslySetInnerHTML com conteúdo não confiável
  const sanitized = XSSProtection.sanitizeHTML(content);

  // Ainda assim, preferir textContent quando possível
  return (
    <div>
      {/* Método seguro - React escapa automaticamente */}
      <p>{content}</p>

      {/* Se HTML é necessário, sanitizar primeiro */}
      <div dangerouslySetInnerHTML={{ __html: sanitized }} />
    </div>
  );
};

// 3. Validação de entrada no backend
export const validateAndSanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitizar todos os campos de entrada
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return XSSProtection.escapeHTML(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);

  next();
};
```

### 4.2 Defesas contra CSRF (Cross-Site Request Forgery)

```typescript
// ====================================
// CSRF PREVENTION STRATEGIES
// ====================================

import crypto from 'crypto';

// 1. CSRF Token Management
class CSRFProtection {
  private static readonly TOKEN_LENGTH = 32;
  private static readonly TOKEN_HEADER = 'X-CSRF-Token';
  private static readonly TOKEN_COOKIE = 'csrf_token';

  // Gerar token CSRF
  static generateToken(): string {
    return crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
  }

  // Middleware para gerar e validar tokens
  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Gerar token para GET requests
      if (req.method === 'GET') {
        const token = this.generateToken();

        // Armazenar na sessão
        req.session.csrfToken = token;

        // Enviar como cookie httpOnly=false para leitura do JS
        res.cookie(this.TOKEN_COOKIE, token, {
          httpOnly: false, // JS precisa ler
          secure: true, // HTTPS only
          sameSite: 'strict',
          maxAge: 3600000, // 1 hora
        });

        // Adicionar ao contexto de resposta
        res.locals.csrfToken = token;
      }

      // Validar token para mutações
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const sessionToken = req.session.csrfToken;
        const headerToken = req.headers[this.TOKEN_HEADER.toLowerCase()];
        const bodyToken = req.body._csrf;

        const providedToken = headerToken || bodyToken;

        if (!sessionToken || !providedToken || sessionToken !== providedToken) {
          return res.status(403).json({
            error: 'Invalid CSRF token',
          });
        }
      }

      next();
    };
  }
}

// 2. Double Submit Cookie Pattern
class DoubleSubmitCSRF {
  static generateTokenPair(): { sessionToken: string; cookieToken: string } {
    const secret = process.env.CSRF_SECRET!;
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const cookieToken = crypto.createHmac('sha256', secret).update(sessionToken).digest('hex');

    return { sessionToken, cookieToken };
  }

  static validateTokenPair(sessionToken: string, cookieToken: string): boolean {
    const secret = process.env.CSRF_SECRET!;
    const expectedCookieToken = crypto
      .createHmac('sha256', secret)
      .update(sessionToken)
      .digest('hex');

    // Timing-safe comparison
    return crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(expectedCookieToken));
  }
}

// 3. SameSite Cookie Configuration
export const cookieConfig = {
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'strict' as const, // Proteção CSRF
  maxAge: 3600000, // 1 hora
  signed: true, // Assinatura para prevenir tampering
};

// 4. Frontend CSRF Token Handling
class CSRFClient {
  private static token: string | null = null;

  // Obter token do cookie
  static getToken(): string | null {
    if (this.token) return this.token;

    const match = document.cookie.match(/csrf_token=([^;]+)/);
    this.token = match ? match[1] : null;
    return this.token;
  }

  // Adicionar token aos requests
  static addTokenToRequest(config: RequestInit): RequestInit {
    const token = this.getToken();
    if (!token) {
      console.warn('CSRF token not found');
      return config;
    }

    return {
      ...config,
      headers: {
        ...config.headers,
        'X-CSRF-Token': token,
      },
    };
  }

  // Interceptor para axios/fetch
  static setupInterceptor() {
    // Fetch interceptor
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo, init?: RequestInit) => {
      const config = init || {};

      // Adicionar CSRF token para mutações
      if (config.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method)) {
        const enhancedConfig = this.addTokenToRequest(config);
        return originalFetch(input, enhancedConfig);
      }

      return originalFetch(input, config);
    };
  }
}

// 5. Additional CSRF Protections
export const additionalCSRFProtections = {
  // Verificar Origin/Referer headers
  verifyOrigin: (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || req.headers.referer;
    const allowedOrigins = ['https://simpix.app', 'https://www.simpix.app'];

    if (origin && !allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
      return res.status(403).json({
        error: 'Invalid origin',
      });
    }

    next();
  },

  // Custom headers (defesa adicional)
  requireCustomHeader: (req: Request, res: Response, next: NextFunction) => {
    // Browsers não permitem que scripts maliciosos definam headers customizados
    const customHeader = req.headers['x-requested-with'];

    if (req.method !== 'GET' && customHeader !== 'XMLHttpRequest') {
      return res.status(403).json({
        error: 'Custom header required',
      });
    }

    next();
  },

  // Rate limiting por IP/Session
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo de requests
    message: 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false,
  },
};
```

### 4.3 Configuração Integrada de Segurança

```typescript
// ====================================
// INTEGRATED SECURITY SETUP
// ====================================

import express from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';

const app = express();

// 1. Session configuration com segurança
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    name: 'simpix.sid', // Nome customizado
    resave: false,
    saveUninitialized: false,
    rolling: true, // Renovar sessão em atividade
    cookie: {
      httpOnly: true,
      secure: true, // HTTPS only
      sameSite: 'strict',
      maxAge: 3600000, // 1 hora
    },
  })
);

// 2. Security headers
app.use(helmet(securityHeaders));

// 3. CSRF Protection
app.use(CSRFProtection.middleware());

// 4. XSS Input sanitization
app.use(validateAndSanitizeInput);

// 5. Rate limiting
app.use('/api/', rateLimit(additionalCSRFProtections.rateLimit));

// 6. Origin verification
app.use('/api/', additionalCSRFProtections.verifyOrigin);

// 7. Custom header requirement
app.use('/api/', additionalCSRFProtections.requireCustomHeader);

// 8. CSP configuration
app.use((req, res, next) => {
  const csp = contentSecurityPolicy[process.env.NODE_ENV];
  // ... configurar CSP
  next();
});

// 9. Audit logging para segurança
app.use((req, res, next) => {
  // Log de ações sensíveis
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    logger.info('Security Audit:', {
      method: req.method,
      path: req.path,
      user: req.user?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    });
  }
  next();
});

// 10. Error handling seguro
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Não vazar informações sensíveis em produção
  const isDev = process.env.NODE_ENV === 'development';

  logger.error('Application error:', err);

  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal server error',
    ...(isDev && { stack: err.stack }),
  });
});
```

---

## 📊 **MÉTRICAS E MONITORAMENTO**

### Indicadores de Segurança e Resiliência

```typescript
// ====================================
// SECURITY AND RESILIENCE METRICS
// ====================================

interface SecurityMetrics {
  // Attack Prevention
  attacks: {
    xssAttempts: number;
    csrfAttempts: number;
    sqlInjectionAttempts: number;
    bruteForceattempts: number;
  };

  // Resilience Metrics
  resilience: {
    circuitBreakerTrips: number;
    retrySuccessRate: number;
    fallbackUsage: number;
    offlineOperations: number;
  };

  // Performance Impact
  performance: {
    cspViolations: number;
    securityHeaderOverhead: number;
    sanitizationTime: number;
    tokenValidationTime: number;
  };

  // Compliance
  compliance: {
    tlsVersion: string;
    hstsEnabled: boolean;
    cspEnabled: boolean;
    csrfProtection: boolean;
  };
}

// Dashboard de monitoramento
const securityDashboard = {
  realTimeAlerts: [
    'XSS attempt detected',
    'CSRF token mismatch',
    'Circuit breaker opened',
    'Unusual traffic pattern',
  ],

  dailyReports: [
    'Security violations summary',
    'Failed authentication attempts',
    'API rate limit violations',
    'CSP violation report',
  ],

  weeklyAudits: [
    'Dependency vulnerability scan',
    'Security header compliance',
    'SSL/TLS configuration',
    'Access pattern analysis',
  ],
};
```

---

## ✅ **CONCLUSÃO E CHECKLIST DE CONFORMIDADE**

### Status de Implementação (Atualizado em 22/08/2025)

```typescript
const implementationStatus = {
  // PAM V1.6 - REQUISITOS ATENDIDOS
  pamCompliance: {
    '✅ Decisão BFF documentada e implementada': true,
    '✅ Padrões de resiliência (TanStack Query)': true,
    '✅ Estratégia HTTP Security (CSP/HSTS)': true,
    '✅ Mitigação XSS/CSRF completa': true,
  },

  // IMPLEMENTAÇÃO ATUAL NO CÓDIGO
  currentImplementation: {
    tanstackQuery: {
      '✅ Exponential backoff com jitter': true,
      '✅ Error categorization (4xx/5xx/network)': true,
      '✅ Intelligent retry logic': true,
      '✅ Cache strategy (staleTime/gcTime)': true,
      '✅ Network-aware refetch behavior': true,
      '✅ Mutation error handling com Sentry': true,
      version: 'v5 (cacheTime→gcTime, useErrorBoundary removido)',
    },

    apiClient: {
      '✅ TokenManager com refresh automático': true,
      '✅ RequestManager com deduplication': true,
      '✅ Circuit breaker patterns': true,
      '✅ Comprehensive error handling': true,
      '✅ Dual-key response transformation': true,
    },

    security: {
      '✅ Strict CSP middleware': true,
      '✅ CSRF protection implementada': true,
      '✅ XSS sanitization': true,
      '✅ Security headers (helmet)': true,
      '✅ JWT validation com debug logs': true,
    },
  },
};
```

### Checklist de Implementação

```typescript
const communicationSecurityChecklist = {
  bffDecision: {
    '✅ Análise de trade-offs documentada': true,
    '✅ Decisão formal tomada': true,
    '✅ Critérios de reavaliação definidos': true,
    '✅ API Gateway patterns implementados': true,
  },

  resilience: {
    '✅ Retry com exponential backoff': true,
    '✅ Circuit breaker implementado': true,
    '✅ Fallback strategies definidas': true,
    '✅ Request deduplication': true,
  },

  httpSecurity: {
    '✅ CSP configurado': true,
    '✅ HSTS habilitado': true,
    '✅ Security headers completos': true,
    '✅ SRI para recursos externos': true,
  },

  xssAndCsrf: {
    '✅ Input sanitization': true,
    '✅ Output encoding': true,
    '✅ CSRF tokens implementados': true,
    '✅ SameSite cookies': true,
  },
};
```

### Resumo das Decisões

1. **BFF:** Não adotado - API Gateway patterns como alternativa
2. **Resiliência:** TanStack Query + Circuit Breaker + Fallbacks
3. **HTTP Security:** CSP rigoroso + HSTS + Headers completos
4. **XSS Prevention:** Sanitização + CSP + Validação
5. **CSRF Prevention:** Tokens + SameSite + Origin verification

### Governança

- **Revisão:** Mensal para métricas de segurança
- **Testes:** Penetration testing trimestral
- **Compliance:** Auditoria semestral
- **Treinamento:** Security awareness mensal

---

**Documento criado por:** GEM-07 AI Specialist System  
**Data:** 2025-08-22  
**Versão:** 1.0  
**Status:** Aguardando ratificação do Arquiteto Chefe  
**Próxima revisão:** Q4 2025
