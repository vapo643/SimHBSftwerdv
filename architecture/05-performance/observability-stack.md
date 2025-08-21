# 📊 Stack de Observabilidade - Simpix
**Autor:** GEM 01 (Arquiteto)
**Data:** 21/08/2025
**Status:** Ready for Execution
**Criticidade:** P0 - CRÍTICA

---

## 🎯 ESTRATÉGIA DE OBSERVABILIDADE

### Pilares da Observabilidade
```yaml
1. Logging:
   - Structured logs
   - Centralized aggregation
   - Searchable/filterable
   
2. Metrics:
   - Application metrics
   - Infrastructure metrics
   - Business KPIs
   
3. Tracing:
   - Distributed tracing
   - Request flow
   - Performance bottlenecks
```

---

## 📋 IMPLEMENTAÇÃO FASE 0 (SUPABASE)

### DIA 1: Logging Estruturado

#### Setup Winston
```javascript
// config/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'simpix-api',
    environment: process.env.NODE_ENV 
  },
  transports: [
    // Console para desenvolvimento
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File para produção
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// Adicionar correlation ID
logger.addCorrelationId = (req) => {
  const correlationId = req.headers['x-correlation-id'] || 
                        require('uuid').v4();
  req.correlationId = correlationId;
  return correlationId;
};

module.exports = logger;
```

#### Middleware de Logging
```javascript
// middleware/logging.js
const logger = require('../config/logger');

function requestLogger(req, res, next) {
  const correlationId = logger.addCorrelationId(req);
  const startTime = Date.now();
  
  // Log request
  logger.info('Request received', {
    correlationId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration
    });
    
    // Alert on slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        correlationId,
        url: req.url,
        duration
      });
    }
  });
  
  next();
}

module.exports = requestLogger;
```

### DIA 2: Error Tracking (Sentry)

#### Setup Sentry
```javascript
// config/sentry.js
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

function initSentry(app) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Integrations.Express({ app }),
      new Tracing.Integrations.Postgres(),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event, hint) {
      // Filtrar dados sensíveis
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.authorization;
      }
      return event;
    }
  });
  
  // Request Handler
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capturar apenas erros 500+
      return error.status >= 500;
    }
  });
}

module.exports = { initSentry, sentryErrorHandler };
```

### DIA 3: Health Checks e Métricas

#### Health Check Endpoint
```javascript
// routes/health.js
const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const logger = require('../config/logger');

router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };
  
  // Database check
  try {
    await db.query('SELECT 1');
    health.checks.database = { status: 'healthy' };
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = { 
      status: 'unhealthy',
      error: error.message 
    };
    logger.error('Health check failed - Database', { error });
  }
  
  // Redis check (se aplicável)
  try {
    if (global.redisClient) {
      await global.redisClient.ping();
      health.checks.redis = { status: 'healthy' };
    }
  } catch (error) {
    health.status = 'degraded';
    health.checks.redis = { 
      status: 'unhealthy',
      error: error.message 
    };
  }
  
  // External APIs check
  health.checks.bancoInter = await checkBancoInter();
  health.checks.clickSign = await checkClickSign();
  
  // Memory usage
  const memUsage = process.memoryUsage();
  health.memory = {
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
  };
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

async function checkBancoInter() {
  // Implementar ping para Banco Inter
  return { status: 'healthy' };
}

async function checkClickSign() {
  // Implementar ping para ClickSign
  return { status: 'healthy' };
}

module.exports = router;
```

#### Métricas Básicas
```javascript
// config/metrics.js
class MetricsCollector {
  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
  }
  
  // Contador (sempre incrementa)
  increment(name, labels = {}) {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
  }
  
  // Gauge (pode subir ou descer)
  setGauge(name, value, labels = {}) {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
  }
  
  // Histogram (distribuição)
  recordTime(name, duration, labels = {}) {
    const key = this.getKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key).push(duration);
  }
  
  getKey(name, labels) {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }
  
  // Export metrics (Prometheus format)
  export() {
    const lines = [];
    
    // Counters
    for (const [key, value] of this.counters) {
      lines.push(`${key} ${value}`);
    }
    
    // Gauges
    for (const [key, value] of this.gauges) {
      lines.push(`${key} ${value}`);
    }
    
    // Histograms (simplified)
    for (const [key, values] of this.histograms) {
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        lines.push(`${key}_sum ${sum}`);
        lines.push(`${key}_count ${values.length}`);
        lines.push(`${key}_avg ${avg}`);
      }
    }
    
    return lines.join('\n');
  }
}

const metrics = new MetricsCollector();

// Middleware para coletar métricas
function metricsMiddleware(req, res, next) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Métricas RED
    metrics.increment('http_requests_total', {
      method: req.method,
      route: req.route?.path || 'unknown',
      status: res.statusCode
    });
    
    if (res.statusCode >= 500) {
      metrics.increment('http_errors_total', {
        method: req.method,
        route: req.route?.path || 'unknown'
      });
    }
    
    metrics.recordTime('http_request_duration_ms', duration, {
      method: req.method,
      route: req.route?.path || 'unknown'
    });
  });
  
  next();
}

// Endpoint para expor métricas
function metricsEndpoint(req, res) {
  res.set('Content-Type', 'text/plain');
  res.send(metrics.export());
}

module.exports = { metrics, metricsMiddleware, metricsEndpoint };
```

---

## 📊 DASHBOARDS E ALERTAS

### Dashboard Inicial (Local)
```javascript
// routes/dashboard.js
router.get('/dashboard', async (req, res) => {
  const stats = {
    proposals: await getProposalStats(),
    payments: await getPaymentStats(),
    errors: await getErrorStats(),
    performance: await getPerformanceStats()
  };
  
  res.json(stats);
});

async function getProposalStats() {
  // Queries para estatísticas
  return {
    total: 150,
    pending: 45,
    approved: 80,
    rejected: 25,
    conversionRate: 0.53
  };
}
```

### Alertas Críticos
```yaml
Configurar alertas para:
  1. Error rate > 1%
  2. Response time p95 > 1s
  3. Database connection failures
  4. External API failures
  5. Memory usage > 80%
  6. Disk usage > 80%
```

---

## 🚀 MIGRAÇÃO PARA DATADOG (FUTURO)

### Setup DataDog
```javascript
// config/datadog.js
const StatsD = require('hot-shots');
const tracer = require('dd-trace');

// Initialize tracer
tracer.init({
  service: 'simpix-api',
  env: process.env.NODE_ENV,
  version: process.env.APP_VERSION
});

// Initialize StatsD client
const dogstatsd = new StatsD({
  host: process.env.DD_AGENT_HOST || 'localhost',
  port: 8125,
  globalTags: {
    env: process.env.NODE_ENV,
    service: 'simpix-api'
  }
});

module.exports = { tracer, dogstatsd };
```

---

## ✅ CHECKLIST PARA GEM 02

### DIA 1 - Logging
- [ ] Instalar Winston
- [ ] Configurar structured logging
- [ ] Adicionar correlation IDs
- [ ] Implementar request logging
- [ ] Testar log aggregation

### DIA 2 - Error Tracking
- [ ] Criar conta Sentry (free tier)
- [ ] Instalar SDK
- [ ] Configurar DSN
- [ ] Implementar error handler
- [ ] Testar captura de erros

### DIA 3 - Health & Metrics
- [ ] Criar /health endpoint
- [ ] Implementar checks
- [ ] Adicionar métricas básicas
- [ ] Criar /metrics endpoint
- [ ] Setup monitoring externo

---

## 📈 MÉTRICAS DE SUCESSO

```yaml
Targets:
  - 100% requests com correlation ID
  - 100% errors capturados
  - Health check response < 100ms
  - Zero logs com dados sensíveis
  - Alertas configurados
```

---

*Sem observabilidade = Voando às cegas em produção!*