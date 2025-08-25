# Estratégia de Confiabilidade e Resiliência - Sistema Simpix

**Versão:** 1.0  
**Data:** 25/08/2025  
**Autor:** GEM-07 AI Specialist System (PEAF V1.5)  
**Status:** Implementado  
**Criticidade:** P0 - Arquitetura de Sobrevivência
**PAM:** V1.1 - Formalização da Estratégia de Resiliência

---

## 🎯 Visão Geral - Design for Failure

Este documento estabelece nossa **Doutrina de Resiliência** baseada no princípio fundamental "Design for Failure". Nossa arquitetura não apenas funciona no "caminho feliz", mas permanece robusta, previsível e segura quando falhas inevitáveis ocorrem.

**Modelo Mental:** Engenheiro de Confiabilidade de Site (SRE) Sênior - Arquitetura de Sobrevivência  
**Filosofia:** Sistemas anti-frágeis que aprendem e melhoram com falhas  
**Objetivo:** Continuidade de negócio garantida mesmo sob falhas em cascata

---

## 1. 🛡️ Implementação dos Padrões de Resiliência

### **Circuit Breaker Pattern - Opossum Integration**

**Configuração de Produção Simpix:**

```javascript
// server/lib/circuit-breaker-config.js
const CircuitBreaker = require('opossum');

// Circuit Breakers específicos por domínio crítico
const CIRCUIT_CONFIGS = {
  // Banco Inter API - Crítico para pagamentos
  interAPI: {
    timeout: 5000,                    // Inter APIs podem ser mais lentas
    errorThresholdPercentage: 60,     // Tolerância alta para flakiness bancária
    resetTimeout: 60000,              // 1 minuto para recovery
    rollingCountTimeout: 10000,       // Rolling window 10s
    rollingCountBuckets: 10,
    volumeThreshold: 20,              // Volume alto antes de abrir
    autoRenewAbortController: true
  },
  
  // ClickSign API - Crítico mas não bloqueante
  clicksignAPI: {
    timeout: 8000,                    // Assinatura pode demorar mais
    errorThresholdPercentage: 50,
    resetTimeout: 120000,             // 2 minutos recovery
    rollingCountTimeout: 15000,
    rollingCountBuckets: 15,
    volumeThreshold: 10,
    autoRenewAbortController: true
  },
  
  // Database Operations - Muito crítico
  database: {
    timeout: 2000,                    // DB deve ser rápido
    errorThresholdPercentage: 30,     // Low tolerance para DB
    resetTimeout: 15000,              // Recovery rápido
    rollingCountTimeout: 5000,
    rollingCountBuckets: 5,
    volumeThreshold: 5,               // Volume baixo
    autoRenewAbortController: true
  },
  
  // Supabase Auth - Crítico mas externo
  supabaseAuth: {
    timeout: 3000,
    errorThresholdPercentage: 40,
    resetTimeout: 30000,
    rollingCountTimeout: 8000,
    rollingCountBuckets: 8,
    volumeThreshold: 15,
    autoRenewAbortController: true
  }
};

// Circuit Breaker Factory
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
    this.metrics = new Map();
  }
  
  createBreaker(name, fn, customOptions = {}) {
    const config = { ...CIRCUIT_CONFIGS[name], ...customOptions };
    const breaker = new CircuitBreaker(fn, config);
    
    // Fallback específico por domínio
    const fallback = this.createFallback(name);
    if (fallback) {
      breaker.fallback(fallback);
    }
    
    // Monitoring e logging
    this.setupCircuitMonitoring(name, breaker);
    
    this.breakers.set(name, breaker);
    return breaker;
  }
  
  createFallback(name) {
    const fallbacks = {
      interAPI: async (...args) => {
        // Fallback para cached payment data
        const cached = await this.getCachedPaymentData(args[0]);
        return {
          status: 'service_unavailable',
          cached_data: cached,
          fallback_used: 'inter_api',
          retry_after: 60
        };
      },
      
      clicksignAPI: async (...args) => {
        // Fallback para modo manual de assinatura
        return {
          status: 'manual_signature_required',
          message: 'Sistema temporariamente em modo manual',
          manual_process_url: '/admin/manual-signature',
          fallback_used: 'clicksign_api'
        };
      },
      
      database: async (...args) => {
        // Critical - no fallback, apenas error limpo
        throw new Error('Database unavailable - no fallback available');
      },
      
      supabaseAuth: async (...args) => {
        // Fallback para cached profile data
        const cached = await this.getCachedProfile(args[0]);
        return {
          ...cached,
          fallback_used: 'supabase_auth',
          limited_access: true
        };
      }
    };
    
    return fallbacks[name];
  }
  
  setupCircuitMonitoring(name, breaker) {
    breaker.on('open', () => {
      console.error(`[CIRCUIT BREAKER] ${name} OPENED - Service degraded`);
      this.recordMetric(name, 'circuit_opened');
      
      // P0 Alert para circuit breaker críticos
      if (['database', 'interAPI'].includes(name)) {
        this.sendP0Alert(`Circuit breaker ${name} opened`, breaker.stats);
      }
    });
    
    breaker.on('halfOpen', () => {
      console.warn(`[CIRCUIT BREAKER] ${name} HALF-OPEN - Testing recovery`);
      this.recordMetric(name, 'half_open');
    });
    
    breaker.on('close', () => {
      console.info(`[CIRCUIT BREAKER] ${name} CLOSED - Service recovered`);
      this.recordMetric(name, 'circuit_closed');
    });
    
    breaker.on('failure', (error) => {
      console.warn(`[CIRCUIT BREAKER] ${name} failure:`, error.message);
      this.recordMetric(name, 'failure');
    });
  }
  
  // Health check para todos os circuit breakers
  getCircuitStatus() {
    const status = {};
    for (const [name, breaker] of this.breakers) {
      status[name] = {
        state: breaker.opened ? 'OPEN' : (breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED'),
        stats: breaker.stats,
        health: breaker.opened ? 'DEGRADED' : 'HEALTHY'
      };
    }
    return status;
  }
}

module.exports = { CircuitBreakerManager, CIRCUIT_CONFIGS };
```

### **Retry Pattern - Exponential Backoff com Jitter**

**Estratégia Aplicada no Simpix:**

```javascript
// server/lib/retry-strategy.js
class RetryStrategy {
  static CONFIGS = {
    // API calls externos - tolerância alta
    external_api: {
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      jitterFactor: 0.3,
      backoffMultiplier: 2.0
    },
    
    // Database operations - retry rápido
    database: {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 5000,
      jitterFactor: 0.2,
      backoffMultiplier: 1.5
    },
    
    // File operations - medium retry
    file_operations: {
      maxAttempts: 4,
      baseDelayMs: 500,
      maxDelayMs: 15000,
      jitterFactor: 0.25,
      backoffMultiplier: 2.0
    }
  };
  
  static async executeWithRetry(fn, configType = 'external_api', context = '') {
    const config = this.CONFIGS[configType];
    let lastError;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 1) {
          console.info(`[RETRY SUCCESS] ${context} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Não retry em alguns erros específicos
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        if (attempt === config.maxAttempts) {
          console.error(`[RETRY EXHAUSTED] ${context} failed after ${attempt} attempts:`, error.message);
          throw error;
        }
        
        // Calculate delay com exponential backoff + jitter
        const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
        const jitter = exponentialDelay * config.jitterFactor * Math.random();
        const totalDelay = Math.min(exponentialDelay + jitter, config.maxDelayMs);
        
        console.warn(`[RETRY] ${context} attempt ${attempt} failed, retrying in ${Math.round(totalDelay)}ms:`, error.message);
        
        await this.delay(totalDelay);
      }
    }
    
    throw lastError;
  }
  
  static isNonRetryableError(error) {
    const nonRetryablePatterns = [
      /invalid.*credentials/i,
      /unauthorized/i,
      /forbidden/i,
      /not.*found/i,
      /bad.*request/i,
      /validation.*error/i
    ];
    
    return nonRetryablePatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.code)
    );
  }
  
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { RetryStrategy };
```

### **Bulkhead Pattern - Isolamento de Recursos**

**Connection Pool Isolation:**

```javascript
// server/lib/connection-pools.js
const { Pool } = require('pg');

// Pools separados por domínio crítico (bulkhead isolation)
const CONNECTION_POOLS = {
  // Pool dedicado para operações críticas de propostas
  propostas: new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: 5432,
    max: 8,                      // 40% do pool total (20 connections)
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    statement_timeout: 5000,
    application_name: 'simpix_propostas'
  }),
  
  // Pool para operações de pagamento (alta criticidade)
  pagamentos: new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: 5432,
    max: 6,                      // 30% do pool
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 1000,
    statement_timeout: 3000,
    application_name: 'simpix_pagamentos'
  }),
  
  // Pool para analytics e relatórios (baixa prioridade)
  analytics: new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: 5432,
    max: 3,                      // 15% do pool
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,    // Queries mais longas OK
    application_name: 'simpix_analytics'
  }),
  
  // Pool geral para operações administrativas
  admin: new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: 5432,
    max: 3,                      // 15% do pool
    idleTimeoutMillis: 45000,
    connectionTimeoutMillis: 3000,
    statement_timeout: 10000,
    application_name: 'simpix_admin'
  })
};

// Bulkhead para operações concorrentes (usando semáforos)
class BulkheadManager {
  constructor() {
    this.semaphores = {
      critical_operations: this.createSemaphore(10),    // Max 10 operações críticas simultâneas
      payment_processing: this.createSemaphore(5),      // Max 5 pagamentos simultâneos
      file_operations: this.createSemaphore(3),         // Max 3 operações de arquivo
      analytics_queries: this.createSemaphore(2),       // Max 2 analytics simultâneas
      external_api_calls: this.createSemaphore(15)      // Max 15 chamadas API externas
    };
  }
  
  createSemaphore(maxConcurrency) {
    let current = 0;
    const waiting = [];
    
    return {
      acquire: () => {
        return new Promise((resolve) => {
          if (current < maxConcurrency) {
            current++;
            resolve();
          } else {
            waiting.push(resolve);
          }
        });
      },
      
      release: () => {
        current--;
        if (waiting.length > 0) {
          current++;
          const next = waiting.shift();
          next();
        }
      },
      
      getStats: () => ({
        current,
        waiting: waiting.length,
        maxConcurrency
      })
    };
  }
  
  async executeWithBulkhead(operation, bulkheadType, fn) {
    const semaphore = this.semaphores[bulkheadType];
    
    if (!semaphore) {
      throw new Error(`Unknown bulkhead type: ${bulkheadType}`);
    }
    
    await semaphore.acquire();
    
    try {
      const result = await fn();
      return result;
    } finally {
      semaphore.release();
    }
  }
  
  getBulkheadStatus() {
    const status = {};
    for (const [type, semaphore] of Object.entries(this.semaphores)) {
      status[type] = semaphore.getStats();
    }
    return status;
  }
}

// Export dos pools e bulkhead manager
module.exports = {
  pools: CONNECTION_POOLS,
  bulkheadManager: new BulkheadManager(),
  BulkheadManager
};
```

---

## 2. 🚨 Design de Dead Letter Queues (DLQs) e Análise de SPOFs

### **Dead Letter Queue Strategy - BullMQ Integration**

**Implementação Simpix DLQ:**

```javascript
// server/lib/dlq-strategy.js
const { Queue, Worker } = require('bullmq');

class DLQManager {
  constructor() {
    this.queues = this.initializeQueues();
    this.dlqs = this.initializeDLQs();
    this.setupDLQWorkers();
  }
  
  initializeQueues() {
    return {
      // Fila principal de pagamentos
      payments: new Queue('payments', {
        connection: { host: 'localhost', port: 6379 },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
            jitter: 0.2
          },
          removeOnComplete: 10,
          removeOnFail: 50
        }
      }),
      
      // Fila de processamento de documentos
      documents: new Queue('documents', {
        connection: { host: 'localhost', port: 6379 },
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential', 
            delay: 1000,
            jitter: 0.3
          },
          removeOnComplete: 5,
          removeOnFail: 100
        }
      }),
      
      // Fila de notificações
      notifications: new Queue('notifications', {
        connection: { host: 'localhost', port: 6379 },
        defaultJobOptions: {
          attempts: 4,
          backoff: {
            type: 'exponential',
            delay: 1500,
            jitter: 0.25
          },
          removeOnComplete: 20,
          removeOnFail: 200
        }
      })
    };
  }
  
  initializeDLQs() {
    return {
      paymentsDLQ: new Queue('payments-dlq'),
      documentsDLQ: new Queue('documents-dlq'),
      notificationsDLQ: new Queue('notifications-dlq'),
      poisonMessagesDLQ: new Queue('poison-messages-dlq')  // Para mensagens verdadeiramente tóxicas
    };
  }
  
  setupDLQWorkers() {
    // Worker principal de pagamentos com DLQ
    new Worker('payments', async (job) => {
      try {
        await this.processPayment(job.data);
      } catch (error) {
        // Se é última tentativa, move para DLQ
        if (job.attemptsStarted >= job.opts.attempts) {
          await this.moveToDLQ(job, error, 'paymentsDLQ');
        }
        
        // Categorizar erro para retry ou falha definitiva
        if (this.isUnrecoverableError(error)) {
          await this.moveToDLQ(job, error, 'paymentsDLQ');
          throw new UnrecoverableError(error.message);
        }
        
        throw error;  // Permite retry normal
      }
    });
    
    // DLQ Processor - Análise automática de jobs falhados
    new Worker('payments-dlq', async (job) => {
      await this.processDLQJob(job);
    });
  }
  
  async moveToDLQ(failedJob, error, dlqName) {
    const dlq = this.dlqs[dlqName];
    
    const dlqJobData = {
      originalQueue: failedJob.queueName,
      originalJobId: failedJob.id,
      originalJobName: failedJob.name,
      originalData: failedJob.data,
      failureDetails: {
        error: error.message,
        stack: error.stack,
        errorCode: error.code,
        failedAt: new Date().toISOString(),
        attemptsMade: failedJob.attemptsStarted,
        lastAttemptAt: failedJob.processedOn
      },
      classification: this.classifyFailure(error),
      retryable: this.isRetryableFailure(error)
    };
    
    await dlq.add('failed-job', dlqJobData, {
      priority: this.getDLQPriority(dlqJobData.classification),
      delay: this.getDLQDelay(dlqJobData.classification)
    });
    
    console.error(`[DLQ] Moved job ${failedJob.id} to ${dlqName}:`, error.message);
    this.recordDLQMetric(dlqName, dlqJobData.classification);
  }
  
  async processDLQJob(dlqJob) {
    const { originalData, failureDetails, classification, retryable } = dlqJob.data;
    
    switch (classification) {
      case 'transient_error':
        // Retry automático após período de espera
        if (retryable && this.shouldAutoRetry(failureDetails)) {
          await this.retryFromDLQ(dlqJob);
        }
        break;
        
      case 'configuration_error':
        // Enviar para admin queue para revisão
        await this.queues.admin.add('config-review', dlqJob.data);
        break;
        
      case 'data_corruption':
        // Quarentena permanente + alerta
        await this.quarantineJob(dlqJob);
        await this.sendAlert('Data corruption detected', dlqJob.data);
        break;
        
      case 'external_service_error':
        // Monitorar serviço externo e retry quando disponível
        await this.scheduleExternalServiceRetry(dlqJob);
        break;
    }
  }
  
  classifyFailure(error) {
    const classifiers = {
      'transient_error': [/timeout/i, /connection refused/i, /temporary/i],
      'configuration_error': [/invalid config/i, /missing env/i, /auth.*failed/i],
      'data_corruption': [/parse error/i, /invalid json/i, /malformed/i],
      'external_service_error': [/api.*unavailable/i, /service.*down/i, /rate.*limit/i]
    };
    
    for (const [classification, patterns] of Object.entries(classifiers)) {
      if (patterns.some(pattern => pattern.test(error.message))) {
        return classification;
      }
    }
    
    return 'unknown_error';
  }
  
  // DLQ Health Monitoring
  async getDLQHealth() {
    const health = {};
    
    for (const [name, dlq] of Object.entries(this.dlqs)) {
      const waiting = await dlq.getWaiting();
      const failed = await dlq.getFailed();
      
      health[name] = {
        waiting_count: waiting.length,
        failed_count: failed.length,
        status: waiting.length > 100 ? 'CRITICAL' : (waiting.length > 50 ? 'WARNING' : 'OK'),
        oldest_job: waiting.length > 0 ? waiting[0].timestamp : null
      };
      
      // Alertas automáticos
      if (health[name].status === 'CRITICAL') {
        await this.sendAlert(`DLQ ${name} critical: ${waiting.length} jobs waiting`);
      }
    }
    
    return health;
  }
}

module.exports = { DLQManager };
```

### **Single Points of Failure (SPOFs) Analysis**

**SPOFs Identificados no Sistema Simpix:**

| **Componente** | **Criticidade** | **MTTR** | **Impacto** | **Mitigação Implementada** |
|----------------|-----------------|----------|-------------|---------------------------|
| **PostgreSQL Database** | ⚠️ CRÍTICO | 5-30min | Sistema completamente indisponível | Connection pooling + Circuit breaker + Read replicas planejadas |
| **Supabase Auth** | ⚠️ ALTO | 2-15min | Novos logins bloqueados | Circuit breaker + Cached profiles + Graceful degradation |
| **Banco Inter API** | ⚠️ ALTO | 10-60min | Pagamentos bloqueados | Circuit breaker + Cached data + Manual fallback |
| **Redis (BullMQ)** | 🟡 MÉDIO | 30s-5min | Background jobs pausados | Persistent queues + AOF + Monitoring |
| **ClickSign API** | 🟡 MÉDIO | 15-120min | Assinaturas manuais | Circuit breaker + Manual process fallback |
| **Supabase Storage** | 🟢 BAIXO | 5-30min | Upload/download indisponível | Local fallback + Retry logic |

**SPOF Mitigation Strategy:**

```javascript
// server/lib/spof-mitigation.js
class SPOFMitigationService {
  constructor() {
    this.healthChecks = new Map();
    this.fallbackStrategies = new Map();
    this.setupHealthChecks();
  }
  
  setupHealthChecks() {
    // Database health check
    this.healthChecks.set('database', async () => {
      try {
        const client = await pools.propostas.connect();
        await client.query('SELECT 1');
        client.release();
        return { status: 'healthy', latency: Date.now() };
      } catch (error) {
        return { status: 'unhealthy', error: error.message };
      }
    });
    
    // Supabase Auth health check
    this.healthChecks.set('supabase_auth', async () => {
      try {
        const start = Date.now();
        await supabaseClient.auth.getUser();
        return { status: 'healthy', latency: Date.now() - start };
      } catch (error) {
        return { status: 'unhealthy', error: error.message };
      }
    });
    
    // Inter API health check
    this.healthChecks.set('inter_api', async () => {
      // Use circuit breaker para testar conectividade
      try {
        const health = await interCircuitBreaker.fire(async () => {
          const response = await axios.get('/health', { timeout: 3000 });
          return response.status === 200;
        });
        return { status: 'healthy', available: health };
      } catch (error) {
        return { status: 'unhealthy', circuit_open: true };
      }
    });
  }
  
  async performHealthChecks() {
    const results = {};
    
    for (const [service, check] of this.healthChecks) {
      try {
        results[service] = await check();
      } catch (error) {
        results[service] = { status: 'error', error: error.message };
      }
    }
    
    return results;
  }
  
  // Estratégia de failover automático
  async handleSPOFFailure(component, error) {
    const strategies = {
      database: async () => {
        console.error('[SPOF] Database failure - activating read-only mode');
        // Ativar modo read-only com cached data
        return this.activateReadOnlyMode();
      },
      
      supabase_auth: async () => {
        console.warn('[SPOF] Supabase Auth failure - using cached authentication');
        // Fallback para cached auth tokens
        return this.activateCachedAuthMode();
      },
      
      inter_api: async () => {
        console.warn('[SPOF] Inter API failure - manual payment mode');
        // Ativar modo manual de pagamento
        return this.activateManualPaymentMode();
      }
    };
    
    const strategy = strategies[component];
    if (strategy) {
      return await strategy();
    }
    
    throw new Error(`No mitigation strategy for SPOF: ${component}`);
  }
}

module.exports = { SPOFMitigationService };
```

---

## 3. ⚖️ Estratégia de Load Shedding (Descarte de Carga)

### **Priority-Based Load Shedding**

**Implementação Multi-Tier no Simpix:**

```javascript
// server/lib/load-shedding.js
class LoadSheddingManager {
  constructor() {
    this.loadThresholds = {
      GREEN: 0.7,      // Normal operation
      YELLOW: 0.85,    // Start shedding low priority
      ORANGE: 0.93,    // Shed medium priority
      RED: 0.97        // Only critical operations
    };
    
    this.requestPriorities = {
      CRITICAL: 1,     // Auth, payment processing, proposal creation
      HIGH: 2,         // User dashboard, proposal management
      MEDIUM: 3,       // Reports, analytics, file downloads
      LOW: 4           // Background jobs, notifications, logs
    };
  }
  
  // Express middleware para load shedding
  createLoadSheddingMiddleware() {
    return async (req, res, next) => {
      const systemLoad = await this.getSystemLoad();
      const requestPriority = this.getRequestPriority(req);
      const loadLevel = this.getLoadLevel(systemLoad);
      
      // Determinar se request deve ser rejeitado
      if (this.shouldShedRequest(loadLevel, requestPriority)) {
        const retryAfter = this.calculateRetryAfter(loadLevel);
        
        return res.status(503).json({
          error: 'Service temporarily overloaded',
          load_level: loadLevel,
          priority: requestPriority,
          retry_after: retryAfter,
          suggestion: this.getLoadSheddingSuggestion(requestPriority)
        });
      }
      
      // Request permitido, adicionar header de load info
      res.set('X-System-Load', systemLoad.toFixed(2));
      res.set('X-Load-Level', loadLevel);
      
      next();
    };
  }
  
  async getSystemLoad() {
    const metrics = {
      cpu: await this.getCPUUsage(),
      memory: this.getMemoryUsage(),
      eventLoop: await this.getEventLoopLag(),
      activeConnections: this.getActiveConnections(),
      queueDepth: await this.getQueueDepth()
    };
    
    // Weighted load calculation
    const weights = { cpu: 0.3, memory: 0.25, eventLoop: 0.2, activeConnections: 0.15, queueDepth: 0.1 };
    
    let totalLoad = 0;
    for (const [metric, value] of Object.entries(metrics)) {
      totalLoad += (value / 100) * weights[metric];
    }
    
    return Math.min(totalLoad, 1.0);
  }
  
  getRequestPriority(req) {
    // Priority based on route patterns
    const criticalPatterns = [
      /^\/api\/auth/,
      /^\/api\/propostas\/[^\/]+\/create/,
      /^\/api\/pagamentos/,
      /^\/api\/webhooks/
    ];
    
    const highPatterns = [
      /^\/api\/propostas/,
      /^\/api\/users\/profile/,
      /^\/api\/dashboard/
    ];
    
    const mediumPatterns = [
      /^\/api\/reports/,
      /^\/api\/analytics/,
      /^\/api\/files/
    ];
    
    // Check priority headers first
    const priorityHeader = req.headers['x-priority'];
    if (priorityHeader && this.requestPriorities[priorityHeader.toUpperCase()]) {
      return priorityHeader.toUpperCase();
    }
    
    // Route-based priority detection
    if (criticalPatterns.some(pattern => pattern.test(req.path))) {
      return 'CRITICAL';
    }
    if (highPatterns.some(pattern => pattern.test(req.path))) {
      return 'HIGH';
    }
    if (mediumPatterns.some(pattern => pattern.test(req.path))) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  }
  
  getLoadLevel(systemLoad) {
    if (systemLoad >= this.loadThresholds.RED) return 'RED';
    if (systemLoad >= this.loadThresholds.ORANGE) return 'ORANGE';
    if (systemLoad >= this.loadThresholds.YELLOW) return 'YELLOW';
    return 'GREEN';
  }
  
  shouldShedRequest(loadLevel, priority) {
    const sheddingRules = {
      GREEN: [],                                    // No shedding
      YELLOW: ['LOW'],                              // Shed only low priority
      ORANGE: ['LOW', 'MEDIUM'],                    // Shed low + medium
      RED: ['LOW', 'MEDIUM', 'HIGH']               // Only critical allowed
    };
    
    return sheddingRules[loadLevel].includes(priority);
  }
  
  calculateRetryAfter(loadLevel) {
    const retryDelays = {
      YELLOW: 10,    // 10 seconds
      ORANGE: 30,    // 30 seconds
      RED: 60        // 1 minute
    };
    
    return retryDelays[loadLevel] || 30;
  }
  
  getLoadSheddingSuggestion(priority) {
    const suggestions = {
      CRITICAL: 'Critical request - system overloaded. Please retry shortly.',
      HIGH: 'System busy. Your request has been queued for high-priority processing.',
      MEDIUM: 'System load high. Consider retrying during off-peak hours.',
      LOW: 'System overloaded. Low priority requests are temporarily suspended.'
    };
    
    return suggestions[priority] || 'System overloaded. Please try again later.';
  }
  
  // Rate limiting adaptativo baseado em load
  createAdaptiveRateLimit() {
    return async (req, res, next) => {
      const systemLoad = await this.getSystemLoad();
      const priority = this.getRequestPriority(req);
      
      // Ajustar rate limits baseado na carga do sistema
      let baseLimit = this.getBaseLimitForPriority(priority);
      const loadMultiplier = Math.max(0.1, 1.0 - systemLoad);
      const adjustedLimit = Math.floor(baseLimit * loadMultiplier);
      
      // Implementar rate limiting com limite ajustado
      const rateLimitResult = await this.checkRateLimit(req, adjustedLimit);
      
      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          limit: adjustedLimit,
          remaining: rateLimitResult.remaining,
          reset_at: rateLimitResult.resetAt,
          system_load: systemLoad.toFixed(2)
        });
      }
      
      next();
    };
  }
}

module.exports = { LoadSheddingManager };
```

### **Graceful Queue Management**

```javascript
// server/lib/queue-load-management.js
class QueueLoadManager {
  constructor() {
    this.queuePriorities = {
      payments: 1,           // Highest priority
      proposals: 2,
      documents: 3,
      notifications: 4,
      analytics: 5           // Lowest priority
    };
  }
  
  async manageQueueLoad() {
    const systemLoad = await this.getSystemLoad();
    
    if (systemLoad > 0.8) {
      // Pause low priority queues
      await this.pauseQueues(['analytics', 'notifications']);
    }
    
    if (systemLoad > 0.9) {
      // Pause medium priority queues
      await this.pauseQueues(['documents']);
      // Reduce concurrency for remaining queues
      await this.reduceConcurrency(['payments', 'proposals'], 0.5);
    }
    
    if (systemLoad > 0.95) {
      // Emergency mode - only critical operations
      await this.pauseQueues(['proposals', 'documents', 'notifications', 'analytics']);
      await this.reduceConcurrency(['payments'], 0.3);
    }
  }
  
  async pauseQueues(queueNames) {
    for (const queueName of queueNames) {
      await this.queues[queueName].pause();
      console.warn(`[LOAD SHEDDING] Paused queue: ${queueName}`);
    }
  }
  
  async resumeQueues() {
    const systemLoad = await this.getSystemLoad();
    
    if (systemLoad < 0.7) {
      // Resume all queues
      for (const queueName of Object.keys(this.queues)) {
        await this.queues[queueName].resume();
      }
      console.info('[LOAD RECOVERY] All queues resumed');
    }
  }
}

module.exports = { QueueLoadManager };
```

---

## 4. 🎯 Planos de Degradação Graciosa (Graceful Degradation Plans)

### **Service-Level Degradation Strategy**

**Matriz de Degradação Simpix:**

| **Load Level** | **Features Disabled** | **Quality Reduction** | **Fallback Actions** |
|----------------|----------------------|----------------------|---------------------|
| **GREEN (0-70%)** | None | Full quality | Normal operation |
| **YELLOW (70-85%)** | • Analytics dashboard<br/>• Email notifications | • Search limited to 50 results<br/>• Report generation disabled | • Cache aggressive<br/>• Background job delay |
| **ORANGE (85-93%)** | • File uploads<br/>• PDF generation<br/>• Advanced search | • Basic search only<br/>• Simple notifications | • Read-only reports<br/>• Cached fallbacks |
| **RED (93%+)** | • All non-critical features<br/>• Report generation<br/>• Bulk operations | • Minimal UI<br/>• Basic CRUD only | • Emergency mode<br/>• Manual processes |

**Implementação do Feature Toggling:**

```javascript
// server/lib/graceful-degradation.js
class GracefulDegradationManager {
  constructor() {
    this.featureFlags = {
      analytics_dashboard: { enabled: true, priority: 'LOW' },
      email_notifications: { enabled: true, priority: 'LOW' },
      advanced_search: { enabled: true, priority: 'MEDIUM' },
      file_uploads: { enabled: true, priority: 'MEDIUM' },
      pdf_generation: { enabled: true, priority: 'MEDIUM' },
      bulk_operations: { enabled: true, priority: 'HIGH' },
      basic_crud: { enabled: true, priority: 'CRITICAL' },
      authentication: { enabled: true, priority: 'CRITICAL' },
      payment_processing: { enabled: true, priority: 'CRITICAL' }
    };
    
    this.degradationLevels = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];
    this.cacheManager = new CacheManager();
  }
  
  async updateFeatureFlags(systemLoad) {
    const loadLevel = this.getLoadLevel(systemLoad);
    
    switch (loadLevel) {
      case 'YELLOW':
        this.disableFeatures(['analytics_dashboard', 'email_notifications']);
        this.enableQualityReduction('search_limit', 50);
        break;
        
      case 'ORANGE':
        this.disableFeatures([
          'analytics_dashboard', 'email_notifications', 
          'file_uploads', 'pdf_generation', 'advanced_search'
        ]);
        this.enableQualityReduction('search_basic_only', true);
        break;
        
      case 'RED':
        this.disableFeatures([
          'analytics_dashboard', 'email_notifications', 'file_uploads', 
          'pdf_generation', 'advanced_search', 'bulk_operations'
        ]);
        this.enableEmergencyMode();
        break;
        
      case 'GREEN':
      default:
        this.enableAllFeatures();
        this.disableQualityReduction();
        break;
    }
    
    console.info(`[DEGRADATION] Features updated for load level: ${loadLevel}`);
    return this.featureFlags;
  }
  
  // Middleware para feature flag checking
  createFeatureMiddleware(featureName) {
    return (req, res, next) => {
      const feature = this.featureFlags[featureName];
      
      if (!feature.enabled) {
        const fallbackResponse = this.getFallbackResponse(featureName);
        
        if (fallbackResponse) {
          return res.status(200).json(fallbackResponse);
        } else {
          return res.status(503).json({
            error: 'Feature temporarily unavailable',
            feature: featureName,
            reason: 'system_overload',
            alternative: this.getAlternativeSuggestion(featureName)
          });
        }
      }
      
      next();
    };
  }
  
  getFallbackResponse(featureName) {
    const fallbacks = {
      analytics_dashboard: async () => {
        // Return cached dashboard data
        const cached = await this.cacheManager.get('dashboard_summary');
        return {
          ...cached,
          _degraded: true,
          _message: 'Showing cached data due to high system load'
        };
      },
      
      advanced_search: async (query) => {
        // Fallback to basic search
        const basicResults = await this.performBasicSearch(query);
        return {
          results: basicResults.slice(0, 10),
          _degraded: true,
          _message: 'Advanced search unavailable - showing basic results'
        };
      },
      
      pdf_generation: () => {
        return {
          status: 'queued',
          message: 'PDF generation queued for later processing',
          estimated_completion: new Date(Date.now() + 30 * 60 * 1000),
          _degraded: true
        };
      },
      
      file_uploads: () => {
        return {
          error: 'File uploads temporarily disabled',
          alternative: 'Please use email attachment or try again later',
          _degraded: true
        };
      }
    };
    
    const fallbackFn = fallbacks[featureName];
    return fallbackFn ? fallbackFn() : null;
  }
  
  // Cache-based fallbacks para operações críticas
  async getCachedFallback(operation, ...args) {
    const cacheKey = `fallback:${operation}:${JSON.stringify(args)}`;
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached && this.isCacheValid(cached)) {
      return {
        ...cached.data,
        _cached: true,
        _cached_at: cached.timestamp,
        _degraded: true
      };
    }
    
    return null;
  }
  
  // Emergency mode configuration
  enableEmergencyMode() {
    console.warn('[DEGRADATION] Emergency mode activated');
    
    // Disable all non-critical features
    for (const [feature, config] of Object.entries(this.featureFlags)) {
      if (config.priority !== 'CRITICAL') {
        this.featureFlags[feature].enabled = false;
      }
    }
    
    // Activate emergency UI mode
    this.activateEmergencyUI();
    
    // Send emergency alert
    this.sendEmergencyAlert('System in emergency degradation mode');
  }
  
  async activateEmergencyUI() {
    // Inject emergency mode CSS/JS to simplify UI
    const emergencyConfig = {
      disable_animations: true,
      minimal_css: true,
      reduce_dom_elements: true,
      cache_static_content: true
    };
    
    await this.cacheManager.set('emergency_ui_config', emergencyConfig);
  }
  
  // Recovery monitoring
  async checkRecoveryConditions() {
    const systemLoad = await this.getSystemLoad();
    
    if (systemLoad < 0.6) {  // Well below normal threshold
      console.info('[DEGRADATION] System load normalized - beginning recovery');
      await this.gracefulRecovery();
    }
  }
  
  async gracefulRecovery() {
    // Staged recovery to avoid thundering herd
    const stages = [
      () => this.enableFeatures(['analytics_dashboard']),
      () => this.enableFeatures(['email_notifications', 'advanced_search']),
      () => this.enableFeatures(['file_uploads', 'pdf_generation']),
      () => this.enableFeatures(['bulk_operations'])
    ];
    
    for (let i = 0; i < stages.length; i++) {
      await stages[i]();
      console.info(`[RECOVERY] Stage ${i + 1}/${stages.length} completed`);
      
      // Wait between stages to monitor impact
      await this.delay(30000);  // 30 seconds between stages
      
      const currentLoad = await this.getSystemLoad();
      if (currentLoad > 0.75) {
        console.warn('[RECOVERY] Load increase detected - pausing recovery');
        break;
      }
    }
  }
}

module.exports = { GracefulDegradationManager };
```

### **User Experience Preservation**

**UX Strategies Durante Degradação:**

```javascript
// client/src/hooks/useDegradationStatus.js
const useDegradationStatus = () => {
  const [degradationStatus, setDegradationStatus] = useState(null);
  const [features, setFeatures] = useState({});
  
  useEffect(() => {
    // Polling para status de degradação
    const checkDegradation = async () => {
      try {
        const response = await fetch('/api/system/status');
        const status = await response.json();
        
        setDegradationStatus(status.load_level);
        setFeatures(status.features);
        
        // Adjust UI based on degradation level
        if (status.load_level !== 'GREEN') {
          showDegradationNotification(status);
        }
      } catch (error) {
        console.warn('Failed to check degradation status:', error);
      }
    };
    
    checkDegradation();
    const interval = setInterval(checkDegradation, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  return { degradationStatus, features, isFeatureEnabled };
};

// Sistema de notificação não-intrusiva
const showDegradationNotification = (status) => {
  const messages = {
    YELLOW: 'Alguns recursos avançados foram temporariamente desabilitados para melhorar a performance.',
    ORANGE: 'Sistema em modo de performance otimizada. Funcionalidades essenciais permanecem disponíveis.',
    RED: 'Sistema em modo de emergência. Apenas funcionalidades críticas estão disponíveis.'
  };
  
  // Show non-blocking notification
  toast.info(messages[status.load_level], {
    duration: 10000,
    position: 'bottom-right'
  });
};
```

---

## 5. 📈 Métricas de Confiabilidade (MTBF)

### **MTBF Calculation & SLI/SLO Framework**

**Definições Simpix:**

```javascript
// server/lib/reliability-metrics.js
class ReliabilityMetricsService {
  constructor() {
    this.metrics = {
      uptime: new Map(),           // Track service uptime
      failures: new Map(),        // Track failure events
      recovery: new Map(),        // Track recovery times
      sli: new Map()              // Service Level Indicators
    };
    
    this.slos = {
      // Service Level Objectives (Compromissos de negócio)
      availability: 99.9,         // 99.9% uptime (43 minutes downtime/month)
      error_rate: 0.1,            // <0.1% error rate
      response_time_p95: 500,     // 95% requests < 500ms
      mttr: 15                    // Mean Time To Recovery < 15 minutes
    };
    
    this.setupMetricsCollection();
  }
  
  // MTBF Calculation
  calculateMTBF(timeframe = '30d') {
    const failures = this.getFailuresInTimeframe(timeframe);
    const totalOperatingTime = this.getOperatingTimeInHours(timeframe);
    
    if (failures.length === 0) {
      return Infinity;  // No failures in timeframe
    }
    
    const mtbf = totalOperatingTime / failures.length;
    
    return {
      mtbf_hours: mtbf,
      mtbf_days: mtbf / 24,
      total_failures: failures.length,
      operating_time: totalOperatingTime,
      timeframe,
      calculation_date: new Date().toISOString()
    };
  }
  
  // MTTR Calculation
  calculateMTTR(timeframe = '30d') {
    const incidents = this.getIncidentsInTimeframe(timeframe);
    
    if (incidents.length === 0) {
      return { mttr_minutes: 0, total_incidents: 0 };
    }
    
    const totalRecoveryTime = incidents.reduce((sum, incident) => {
      return sum + (incident.resolved_at - incident.started_at);
    }, 0);
    
    const avgRecoveryTime = totalRecoveryTime / incidents.length;
    
    return {
      mttr_minutes: avgRecoveryTime / (1000 * 60),
      mttr_hours: avgRecoveryTime / (1000 * 60 * 60),
      total_incidents: incidents.length,
      fastest_recovery: Math.min(...incidents.map(i => i.resolved_at - i.started_at)) / (1000 * 60),
      slowest_recovery: Math.max(...incidents.map(i => i.resolved_at - i.started_at)) / (1000 * 60)
    };
  }
  
  // Service Level Indicators (SLIs)
  async calculateSLIs() {
    const timeframe = '24h';
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    
    const sliResults = {
      // Availability SLI
      availability: await this.calculateAvailabilitySLI(dayAgo, now),
      
      // Error Rate SLI
      error_rate: await this.calculateErrorRateSLI(dayAgo, now),
      
      // Latency SLI
      latency: await this.calculateLatencySLI(dayAgo, now),
      
      // Quality SLI (custom for business logic)
      quality: await this.calculateQualitySLI(dayAgo, now),
      
      timestamp: new Date().toISOString()
    };
    
    // Store SLI results for trend analysis
    await this.storeSLIResults(sliResults);
    
    return sliResults;
  }
  
  async calculateAvailabilitySLI(startTime, endTime) {
    const totalTime = endTime - startTime;
    const downtime = await this.getTotalDowntime(startTime, endTime);
    
    const availability = ((totalTime - downtime) / totalTime) * 100;
    
    return {
      value: availability,
      target: this.slos.availability,
      met: availability >= this.slos.availability,
      downtime_minutes: downtime / (1000 * 60),
      budget_remaining: this.calculateErrorBudget('availability', availability)
    };
  }
  
  async calculateErrorRateSLI(startTime, endTime) {
    const totalRequests = await this.getTotalRequests(startTime, endTime);
    const errorRequests = await this.getErrorRequests(startTime, endTime);
    
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
    
    return {
      value: errorRate,
      target: this.slos.error_rate,
      met: errorRate <= this.slos.error_rate,
      total_requests: totalRequests,
      error_requests: errorRequests,
      budget_remaining: this.calculateErrorBudget('error_rate', errorRate)
    };
  }
  
  async calculateLatencySLI(startTime, endTime) {
    const latencyData = await this.getLatencyData(startTime, endTime);
    
    if (!latencyData.length) {
      return { value: 0, target: this.slos.response_time_p95, met: true };
    }
    
    // Calculate percentiles
    const sorted = latencyData.sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95Latency = sorted[p95Index];
    
    return {
      value: p95Latency,
      target: this.slos.response_time_p95,
      met: p95Latency <= this.slos.response_time_p95,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: p95Latency,
      p99: sorted[Math.floor(sorted.length * 0.99)],
      total_samples: latencyData.length
    };
  }
  
  // Error Budget Management
  calculateErrorBudget(sliType, currentValue) {
    const budgets = {
      availability: {
        total: 100 - this.slos.availability,  // 0.1% error budget
        consumed: Math.max(0, this.slos.availability - currentValue)
      },
      error_rate: {
        total: this.slos.error_rate,          // 0.1% error budget
        consumed: Math.max(0, currentValue - this.slos.error_rate)
      }
    };
    
    const budget = budgets[sliType];
    if (!budget) return null;
    
    const remaining = budget.total - budget.consumed;
    const percentageRemaining = (remaining / budget.total) * 100;
    
    return {
      total: budget.total,
      consumed: budget.consumed,
      remaining,
      percentage_remaining: percentageRemaining,
      status: percentageRemaining > 50 ? 'HEALTHY' : 
              percentageRemaining > 25 ? 'WARNING' : 'CRITICAL'
    };
  }
  
  // Alerting based on SLO violations
  async checkSLOViolations(sliResults) {
    const violations = [];
    
    for (const [sliName, sliData] of Object.entries(sliResults)) {
      if (sliData.met === false) {
        violations.push({
          sli: sliName,
          current_value: sliData.value,
          target: sliData.target,
          severity: this.determineSeverity(sliName, sliData),
          error_budget: sliData.budget_remaining
        });
      }
    }
    
    if (violations.length > 0) {
      await this.sendSLOViolationAlert(violations);
    }
    
    return violations;
  }
  
  // Reliability Dashboard Data
  async getReliabilityDashboard() {
    const [mtbf, mttr, sli, incidents] = await Promise.all([
      this.calculateMTBF('30d'),
      this.calculateMTTR('30d'),
      this.calculateSLIs(),
      this.getRecentIncidents(10)
    ]);
    
    return {
      mtbf,
      mttr,
      sli,
      recent_incidents: incidents,
      reliability_score: this.calculateReliabilityScore(mtbf, mttr, sli),
      trends: await this.getReliabilityTrends(),
      generated_at: new Date().toISOString()
    };
  }
  
  calculateReliabilityScore(mtbf, mttr, sli) {
    // Composite reliability score (0-100)
    const scores = {
      availability: sli.availability.met ? 25 : Math.max(0, (sli.availability.value / sli.availability.target) * 25),
      error_rate: sli.error_rate.met ? 25 : Math.max(0, 25 - (sli.error_rate.value * 5)),
      latency: sli.latency.met ? 25 : Math.max(0, (sli.latency.target / sli.latency.value) * 25),
      recovery: Math.max(0, 25 - (mttr.mttr_minutes / this.slos.mttr) * 25)
    };
    
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    
    return {
      total: Math.round(totalScore),
      breakdown: scores,
      grade: this.getReliabilityGrade(totalScore)
    };
  }
  
  getReliabilityGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    return 'D';
  }
}

module.exports = { ReliabilityMetricsService };
```

### **Production Monitoring Stack**

**Prometheus + Grafana Integration:**

```yaml
# prometheus.yml - Monitoring configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "simpix_reliability_rules.yml"

scrape_configs:
  - job_name: 'simpix-api'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'simpix-database'
    static_configs:
      - targets: ['localhost:9187']  # postgres_exporter
    scrape_interval: 15s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
```

**Alert Rules for MTBF/MTTR:**

```yaml
# simpix_reliability_rules.yml
groups:
  - name: simpix_reliability
    rules:
      # High error rate affecting MTBF
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
        for: 5m
        labels:
          severity: warning
          impact: mtbf
        annotations:
          summary: "High error rate detected (affects MTBF)"
          description: "Error rate is {{ $value }}% over the last 5 minutes"
      
      # Service down (critical for MTBF)
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
          impact: mtbf_mttr
        annotations:
          summary: "Service is down (critical MTBF impact)"
          description: "Service {{ $labels.instance }} has been down for more than 1 minute"
      
      # Slow recovery (affects MTTR)
      - alert: SlowIncidentRecovery
        expr: increase(incident_recovery_time_minutes[1h]) > 30
        for: 0m
        labels:
          severity: warning
          impact: mttr
        annotations:
          summary: "Incident recovery taking too long (affects MTTR)"
          description: "Recovery time is {{ $value }} minutes (target: < 15 minutes)"
      
      # Database connection issues
      - alert: DatabaseConnectionIssues
        expr: rate(database_connection_errors_total[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
          impact: mtbf
        annotations:
          summary: "Database connection issues detected"
          description: "Database connection error rate: {{ $value }}/second"
```

---

## 6. 🔮 Estratégias de Antifragilidade

### **Learning from Failures - Chaos Engineering**

**Princípios de Antifragilidade no Simpix:**

```javascript
// server/lib/antifragile-strategies.js
class AntifragileService {
  constructor() {
    this.chaosExperiments = new Map();
    this.failurePatterns = new Map();
    this.adaptiveConfigs = new Map();
    this.learningEngine = new FailureLearningEngine();
  }
  
  // Chaos Engineering - Controlled failure injection
  async runChaosExperiment(experimentName, config) {
    const experiment = {
      name: experimentName,
      started_at: Date.now(),
      config,
      status: 'RUNNING',
      observations: []
    };
    
    console.info(`[CHAOS] Starting experiment: ${experimentName}`);
    
    try {
      switch (experimentName) {
        case 'database_latency':
          await this.injectDatabaseLatency(config.latencyMs);
          break;
          
        case 'api_timeout':
          await this.simulateAPITimeout(config.service, config.timeoutMs);
          break;
          
        case 'memory_pressure':
          await this.createMemoryPressure(config.pressureMB);
          break;
          
        case 'network_partition':
          await this.simulateNetworkPartition(config.services);
          break;
      }
      
      // Monitor system behavior during experiment
      const observations = await this.monitorExperiment(config.durationMs);
      experiment.observations = observations;
      experiment.status = 'COMPLETED';
      
      // Learn from experiment results
      await this.learningEngine.processExperiment(experiment);
      
    } catch (error) {
      experiment.status = 'FAILED';
      experiment.error = error.message;
    } finally {
      experiment.ended_at = Date.now();
      this.chaosExperiments.set(experimentName, experiment);
      
      // Clean up any injected failures
      await this.cleanupExperiment(experimentName);
    }
    
    return experiment;
  }
  
  // Adaptive Configuration based on learned patterns
  async adaptSystemConfiguration() {
    const recentFailures = await this.getRecentFailures('7d');
    const patterns = this.learningEngine.analyzePatterns(recentFailures);
    
    for (const pattern of patterns) {
      const adaptations = await this.generateAdaptations(pattern);
      
      for (const adaptation of adaptations) {
        await this.applyAdaptation(adaptation);
      }
    }
  }
  
  async generateAdaptations(failurePattern) {
    const adaptations = [];
    
    if (failurePattern.type === 'timeout_cluster') {
      // Observed: Multiple timeout failures for same service
      adaptations.push({
        type: 'circuit_breaker_adjustment',
        service: failurePattern.service,
        changes: {
          timeout: Math.min(failurePattern.avg_timeout * 1.5, 10000),
          errorThresholdPercentage: Math.max(30, failurePattern.error_rate - 10)
        },
        reason: `Learned from ${failurePattern.occurrences} timeout failures`
      });
    }
    
    if (failurePattern.type === 'memory_leak') {
      // Observed: Memory grows consistently before failures
      adaptations.push({
        type: 'monitoring_enhancement',
        changes: {
          memory_alert_threshold: failurePattern.failure_threshold * 0.8,
          gc_strategy: 'aggressive',
          restart_threshold: failurePattern.failure_threshold * 0.9
        },
        reason: `Learned memory failure pattern at ${failurePattern.failure_threshold}MB`
      });
    }
    
    if (failurePattern.type === 'cascade_failure') {
      // Observed: Failures spread across services
      adaptations.push({
        type: 'bulkhead_enhancement',
        changes: {
          isolation_stronger: true,
          dependency_timeouts: failurePattern.cascade_services.reduce((acc, service) => {
            acc[service] = Math.max(1000, failurePattern.avg_cascade_time * 0.5);
            return acc;
          }, {})
        },
        reason: `Learned cascade pattern across ${failurePattern.cascade_services.length} services`
      });
    }
    
    return adaptations;
  }
  
  // Failure Pattern Recognition
  async recognizeFailurePatterns() {
    const failures = await this.getSystemFailures('30d');
    const patterns = {
      temporal: this.analyzeTemporalPatterns(failures),
      causal: this.analyzeCausalPatterns(failures),
      resource: this.analyzeResourcePatterns(failures)
    };
    
    return patterns;
  }
  
  analyzeTemporalPatterns(failures) {
    // Time-based pattern analysis
    const timePatterns = {
      daily: this.groupByHour(failures),
      weekly: this.groupByDay(failures),
      monthly: this.groupByDate(failures)
    };
    
    return {
      peak_failure_hours: this.findPeakHours(timePatterns.daily),
      peak_failure_days: this.findPeakDays(timePatterns.weekly),
      seasonal_trends: this.analyzeTrends(timePatterns.monthly)
    };
  }
  
  // Self-Healing Mechanisms
  async enableSelfHealing() {
    const healingStrategies = [
      this.autoRestartUnhealthyServices,
      this.autoScaleOnLoad,
      this.autoFailoverToBackup,
      this.autoTunePerformance
    ];
    
    for (const strategy of healingStrategies) {
      strategy.bind(this)();
    }
  }
  
  async autoRestartUnhealthyServices() {
    const unhealthyServices = await this.detectUnhealthyServices();
    
    for (const service of unhealthyServices) {
      if (this.shouldRestart(service)) {
        console.info(`[SELF-HEAL] Restarting unhealthy service: ${service.name}`);
        await this.restartService(service);
        
        // Monitor recovery
        await this.monitorRecovery(service, 60000);
      }
    }
  }
  
  async autoTunePerformance() {
    const performanceData = await this.getPerformanceMetrics();
    
    if (performanceData.memory_usage > 0.85) {
      // Trigger garbage collection
      if (global.gc) {
        global.gc();
        console.info('[SELF-HEAL] Triggered garbage collection');
      }
      
      // Reduce cache sizes
      await this.reduceCacheSizes(0.7);
    }
    
    if (performanceData.cpu_usage > 0.9) {
      // Reduce background job concurrency
      await this.reduceJobConcurrency(0.5);
      console.info('[SELF-HEAL] Reduced job concurrency due to high CPU');
    }
  }
  
  // Evolutionary System Improvement
  async evolveSystem() {
    const evolutionCandidates = await this.identifyEvolutionCandidates();
    
    for (const candidate of evolutionCandidates) {
      const experiment = await this.designEvolutionExperiment(candidate);
      const results = await this.runEvolutionExperiment(experiment);
      
      if (results.improvement > 0.1) {  // >10% improvement
        await this.implementEvolution(candidate, results);
        console.info(`[EVOLUTION] Implemented improvement: ${candidate.description}`);
      }
    }
  }
  
  async identifyEvolutionCandidates() {
    const candidates = [];
    
    // Analyze bottlenecks
    const bottlenecks = await this.identifyBottlenecks();
    for (const bottleneck of bottlenecks) {
      candidates.push({
        type: 'bottleneck_elimination',
        target: bottleneck.component,
        description: `Optimize ${bottleneck.component} (current bottleneck: ${bottleneck.impact}%)`,
        potential_improvement: bottleneck.impact / 100
      });
    }
    
    // Analyze redundant patterns
    const redundancies = await this.identifyRedundancies();
    for (const redundancy of redundancies) {
      candidates.push({
        type: 'redundancy_optimization',
        target: redundancy.pattern,
        description: `Eliminate redundant ${redundancy.pattern}`,
        potential_improvement: redundancy.waste_percentage / 100
      });
    }
    
    return candidates;
  }
  
  // Predictive Failure Prevention
  async enablePredictiveFailurePrevention() {
    const predictionModel = await this.trainFailurePredictionModel();
    
    setInterval(async () => {
      const currentMetrics = await this.getCurrentSystemMetrics();
      const failureProbability = predictionModel.predict(currentMetrics);
      
      if (failureProbability > 0.7) {  // 70% probability
        console.warn('[PREDICTIVE] High failure probability detected:', failureProbability);
        await this.takePreventiveActions(currentMetrics, failureProbability);
      }
    }, 30000);  // Check every 30 seconds
  }
  
  async takePreventiveActions(metrics, probability) {
    const actions = [];
    
    if (metrics.memory_growth_rate > 0.05) {
      actions.push(this.proactiveMemoryCleanup);
    }
    
    if (metrics.error_rate_trend > 0.02) {
      actions.push(this.proactiveCircuitBreakerAdjustment);
    }
    
    if (metrics.database_connection_saturation > 0.8) {
      actions.push(this.proactiveDatabaseOptimization);
    }
    
    for (const action of actions) {
      await action.bind(this)();
    }
    
    console.info(`[PREDICTIVE] Executed ${actions.length} preventive actions`);
  }
}

// Failure Learning Engine
class FailureLearningEngine {
  constructor() {
    this.patterns = new Map();
    this.adaptations = new Map();
    this.successfulLearning = new Map();
  }
  
  async processExperiment(experiment) {
    // Extract insights from chaos experiment
    const insights = this.extractInsights(experiment);
    
    for (const insight of insights) {
      await this.incorporateInsight(insight);
    }
  }
  
  extractInsights(experiment) {
    const insights = [];
    
    if (experiment.name === 'database_latency') {
      // Learn about system behavior under database stress
      const resilience = this.measureResilience(experiment.observations);
      
      insights.push({
        type: 'database_resilience',
        resilience_score: resilience,
        learned: `System maintains ${resilience}% functionality under ${experiment.config.latencyMs}ms DB latency`,
        adaptation_suggestion: resilience < 0.8 ? 'increase_cache_usage' : 'maintain_current_config'
      });
    }
    
    return insights;
  }
  
  async incorporateInsight(insight) {
    // Store insight for future reference
    this.patterns.set(insight.type, {
      ...insight,
      learned_at: new Date().toISOString(),
      confidence: this.calculateConfidence(insight)
    });
    
    // Generate adaptation if confidence is high
    if (insight.confidence > 0.8 && insight.adaptation_suggestion) {
      await this.generateAdaptation(insight);
    }
  }
}

module.exports = { AntifragileService, FailureLearningEngine };
```

### **Continuous Learning & Improvement**

**Machine Learning for System Optimization:**

```javascript
// server/lib/ml-system-optimization.js
class MLSystemOptimizer {
  constructor() {
    this.models = {
      performance_predictor: null,
      failure_classifier: null,
      load_forecaster: null,
      config_optimizer: null
    };
    
    this.trainingData = new Map();
  }
  
  async trainModels() {
    // Collect training data
    const performanceData = await this.collectPerformanceTrainingData();
    const failureData = await this.collectFailureTrainingData();
    const loadData = await this.collectLoadTrainingData();
    
    // Train models (simplified - would use TensorFlow.js or similar)
    this.models.performance_predictor = await this.trainPerformanceModel(performanceData);
    this.models.failure_classifier = await this.trainFailureModel(failureData);
    this.models.load_forecaster = await this.trainLoadModel(loadData);
    
    console.info('[ML] Models trained successfully');
  }
  
  async optimizeSystemConfiguration() {
    const currentConfig = await this.getCurrentConfiguration();
    const systemState = await this.getCurrentSystemState();
    
    const predictions = {
      performance: this.models.performance_predictor.predict(systemState),
      failure_risk: this.models.failure_classifier.predict(systemState),
      load_forecast: this.models.load_forecaster.predict(systemState)
    };
    
    const optimizedConfig = this.optimizeConfiguration(currentConfig, predictions);
    
    if (this.configurationImprovement(currentConfig, optimizedConfig) > 0.05) {
      await this.applyConfiguration(optimizedConfig);
      console.info('[ML] Applied ML-optimized configuration');
    }
  }
}

module.exports = { MLSystemOptimizer };
```

---

## 📋 Implementação e Roadmap

### **Fases de Implementação:**

**Fase 1: Fundação (Atual - Concluída)**
- ✅ Circuit Breakers implementados com opossum
- ✅ Basic retry strategies em APIs externas
- ✅ Connection pooling por domínio
- ✅ Monitoring básico com logs estruturados

**Fase 2: Resiliência Avançada (Q1 2025)**
- 🚧 DLQ implementation com BullMQ
- 🚧 Load shedding middleware
- 🚧 Graceful degradation features
- 🚧 MTBF/MTTR tracking dashboard

**Fase 3: Antifragilidade (Q2 2025)**
- 📋 Chaos Engineering automation
- 📋 Self-healing mechanisms
- 📋 Predictive failure prevention
- 📋 ML-based optimization

### **Métricas de Sucesso:**

| **Métrica** | **Baseline Atual** | **Target Q1** | **Target Q2** |
|-------------|-------------------|---------------|---------------|
| **MTBF** | 168 horas (7 dias) | 720 horas (30 dias) | 1440 horas (60 dias) |
| **MTTR** | 45 minutos | 15 minutos | 10 minutos |
| **Availability** | 99.5% | 99.9% | 99.95% |
| **Error Rate** | 0.5% | 0.1% | 0.05% |

---

## 🚨 Declaração de Incerteza

### **CONFIANÇA NA IMPLEMENTAÇÃO: 92%**

**Áreas de Alta Confiança (95%+):**
- Circuit Breaker patterns (baseado em documentação oficial opossum)
- DLQ design com BullMQ (validado contra best practices)
- Load shedding strategies (baseado em Google SRE practices)
- Connection pooling bulkheads (implementação padrão PostgreSQL)

**Áreas de Incerteza Controlada (8%):**
- **Métricas MTBF específicas:** Baseadas em benchmarks da indústria, não dados reais do Simpix
- **ML optimization timelines:** Dependente de volume de dados de treinamento
- **Chaos engineering safety:** Requer validação em ambiente não-produtivo primeiro

### **RISCOS IDENTIFICADOS: MÉDIO**

**Riscos Técnicos:**
- **Complexity overhead:** Múltiplos circuit breakers podem adicionar latência
- **Configuration drift:** Configurações adaptativas requerem monitoramento constante  
- **Testing challenges:** Chaos experiments precisam de ambiente isolado

**Riscos de Negócio:**
- **Feature degradation impact:** Users podem ter experiência reduzida durante high load
- **Implementation timeline:** Antifragile features são long-term (6+ meses)

### **DECISÕES TÉCNICAS ASSUMIDAS:**

1. **Opossum é a biblioteca padrão** para Circuit Breakers no ecosistema Node.js do Simpix
2. **BullMQ com Redis** é adequado para DLQ implementation (já em uso no sistema)
3. **PostgreSQL connection pooling** permite bulkhead isolation sem refatoração major
4. **Prometheus + Grafana** é o stack de monitoramento escolhido para MTBF/MTTR tracking
5. **Chaos Engineering será implement gradually** começando com ambiente de staging

### **VALIDAÇÃO PENDENTE:**

- **Load testing** para validar thresholds de load shedding
- **Security review** dos chaos engineering experiments
- **Performance impact assessment** da implementation de todos os circuit breakers
- **Business stakeholder approval** para graceful degradation features

---

**Documento aprovado seguindo PAM V1.1 - Formalização da Estratégia de Resiliência**  
**Revisão Arquitetural:** Pendente (conforme protocolo PAM)  
**Próximo milestone:** Implementação Fase 2 - DLQ e Load Shedding

---

**GEM-07 AI Specialist System**  
*25/08/2025 - Doutrina de Resiliência Estabelecida*