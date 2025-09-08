# 📊 Plano de Monitoramento Contínuo - Simpix Performance

**PAM V4.3 PERF-F4-001** - Validação e Monitoramento Contínuo

## 🎯 Objetivos Estratégicos

Garantir que as otimizações de performance implementadas nas Fases 1-3 da "Operação P95" sejam **sustentadas em produção**, com detecção proativa de degradações e resposta automatizada.

### 📈 SLAs Estabelecidos

| Métrica             | Target   | Warning     | Critical | Ação               |
| ------------------- | -------- | ----------- | -------- | ------------------ |
| **P95 Latência**    | < 500ms  | 500-750ms   | > 750ms  | Auto-scale + Alert |
| **P99 Latência**    | < 1000ms | 1000-1200ms | > 1200ms | Investigation      |
| **Taxa de Erro**    | < 1%     | 1-2%        | > 2%     | Immediate Response |
| **Disponibilidade** | > 99.9%  | 99.5-99.9%  | < 99.5%  | Emergency          |
| **Cache Hit Rate**  | > 85%    | 70-85%      | < 70%    | Cache Review       |

---

## 🔍 Endpoints Monitorados (Prioridade CRÍTICA)

### Tier 1: Mission Critical

- `GET /api/propostas` - **Query optimized (JOINs)**
- `POST /api/simulacao-credito` - **Core business logic**
- `GET /api/produtos` - **Cache-optimized**
- `GET /api/tabelas-comerciais` - **Cache-optimized**

### Tier 2: Important

- `POST /api/propostas` - **Proposal creation**
- `GET /api/propostas/:id` - **Proposal details**
- `POST /api/pagamentos` - **Payment processing**
- `GET /api/health` - **System health baseline**

### Tier 3: Supporting

- `GET /api/features` - **Feature flags**
- `GET /api/lojas` - **Store data**
- `GET /api/parceiros` - **Partners data**

---

## 🛠️ Stack de Monitoramento

### Observabilidade Primária

- **APM**: Sentry (performance + errors)
- **Logs**: Winston structured logging
- **Metrics**: Custom middleware + Artillery load testing
- **Alerts**: Sentry notifications → Slack

### Infraestrutura

- **Cache**: Redis Cloud monitoring
- **Database**: PostgreSQL slow query log
- **Application**: Express.js performance middleware
- **Load Testing**: Artillery scheduled runs

---

## ⚡ Sistema de Alertas Multi-Camada

### 🚨 Nível 1: Automático (Sem Intervenção)

**Condição**: P95 > 500ms por 2 minutos consecutivos
**Ação**:

- Investigação automática via scripts
- Restart do cache Redis se necessário
- Log detalhado para análise posterior

### 🔔 Nível 2: Notificação (Low Priority)

**Condição**: P95 500-750ms por 5 minutos
**Ação**:

- Slack notification (#performance-monitoring)
- Email para equipe dev (não on-call)
- Dashboard highlight

### 🚨 Nível 3: Alerta (High Priority)

**Condição**: P95 > 750ms por 5 minutos OU Error Rate > 2%
**Ação**:

- Slack alert (@channel)
- SMS para on-call engineer
- PagerDuty incident creation
- Auto-investigation script execution

### 🆘 Nível 4: Emergência (Critical)

**Condição**: P95 > 1000ms OU Availability < 99.5%
**Ação**:

- Immediate phone calls to on-call + backup
- Auto-scaling if available
- Incident commander activation
- Customer communication prepared

---

## 📊 Dashboards de Monitoramento

### Primary Performance Dashboard

**URL**: `https://sentry.io/simpix/performance`

**Widgets**:

1. **P95/P99 Latency Trend** (last 24h)
2. **Error Rate by Endpoint** (real-time)
3. **Throughput Overview** (req/min)
4. **Cache Hit Rate** (Products + Commercial Tables)
5. **Database Connection Pool** utilization
6. **Redis Connection Status**

### Secondary Operational Dashboard

**Métricas**:

- Memory/CPU utilization
- Slow query detection (>100ms)
- Rate limiting triggers
- JWT validation failures
- Background job queue length

---

## 🔄 Testes de Carga Programados

### Teste Diário (Automated)

**Schedule**: 03:00 UTC (off-peak)
**Duration**: 5 minutos
**Load**: 20 VUs → 30 VUs gradual
**Goal**: Baseline validation

```bash
# Comando executado via cron
artillery run /scripts/load-test/daily-baseline.yml --output /logs/daily-$(date +%Y%m%d).json
```

### Teste Semanal (Comprehensive)

**Schedule**: Domingo 02:00 UTC  
**Duration**: 15 minutos
**Load**: 50 VUs peak
**Goal**: Capacity validation + SLA verification

### Teste Mensal (Stress Test)

**Schedule**: Último domingo do mês
**Duration**: 30 minutos
**Load**: Até 100 VUs
**Goal**: Breaking point identification

---

## 🧪 Cenários de Validação

### Cache Performance Test

```yaml
scenario: 'Cache Hit Rate Validation'
phases:
  - duration: 60
    arrivalRate: 10
  - duration: 180
    arrivalRate: 30
target_endpoints:
  - /api/produtos (expect >90% cache hits)
  - /api/tabelas-comerciais (expect >85% cache hits)
```

### Database Optimization Test

```yaml
scenario: 'JOIN Optimization Validation'
phases:
  - duration: 120
    arrivalRate: 25
target_endpoints:
  - /api/propostas (expect P95 <300ms)
success_criteria:
  - p95 < 300ms
  - error_rate < 0.5%
```

---

## 📋 Runbooks de Resposta

### Performance Degradation (P95 > 750ms)

**STEP 1: Immediate Assessment (< 2 min)**

```bash
# Health check
curl -s http://localhost:5000/api/health | jq

# Cache status
redis-cli -h [REDIS_HOST] ping

# Database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

**STEP 2: Identify Bottleneck (< 5 min)**

- Check Sentry transaction breakdown
- Review slow query logs
- Verify Redis hit rates
- Monitor CPU/memory usage

**STEP 3: Apply Fix (< 10 min)**

- Restart Redis if cache issues
- Kill long-running queries if DB issues
- Scale up if resource constraints
- Enable maintenance mode if critical

### Cache Miss Rate High (< 70%)

**Investigation Steps**:

1. Check Redis connectivity and memory
2. Verify TTL configurations
3. Review cache invalidation logic
4. Analyze data mutation patterns

**Resolution**:

1. Restart Redis connection pool
2. Increase Redis memory if needed
3. Adjust TTL if data is too stale
4. Fix invalidation logic if broken

### Error Rate Spike (> 2%)

**Triage Process**:

1. **5xx errors**: Server/database issues → Infrastructure team
2. **4xx errors**: Client/authentication issues → Application team
3. **429 errors**: Rate limiting → Review thresholds
4. **401 errors**: Authentication problems → Security review

---

## 📈 Performance Metrics Collection

### Application Metrics

```javascript
// Express middleware para coleta automática
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;

    // Log estruturado
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      isCritical: duration > 500,
    });

    // Enviar para Sentry
    if (duration > 1000) {
      Sentry.addBreadcrumb({
        message: 'Slow request detected',
        data: { method: req.method, path: req.path, duration },
      });
    }
  });
  next();
});
```

### Database Metrics

```sql
-- Query de monitoramento (executada a cada minuto)
SELECT
  schemaname,
  tablename,
  n_tup_ins + n_tup_upd + n_tup_del as total_writes,
  n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY total_writes DESC;
```

---

## 🔧 Manutenção e Revisão

### Revisão Semanal

- [ ] Analisar tendências de performance
- [ ] Revisar alertas disparados
- [ ] Verificar eficácia das otimizações
- [ ] Atualizar thresholds se necessário

### Revisão Mensal

- [ ] Executar teste de stress completo
- [ ] Revisar capacidade de infraestrutura
- [ ] Analisar crescimento de dados/tráfego
- [ ] Planejar otimizações futuras

### Revisão Trimestral

- [ ] Auditoria completa do stack de monitoramento
- [ ] Revisão de SLAs baseada em dados reais
- [ ] Atualização de runbooks
- [ ] Treinamento da equipe em novos cenários

---

## 👥 Responsabilidades

### DevOps Team

- Infraestrutura de monitoramento
- Alertas e dashboards
- Automação de resposta
- Capacity planning

### Development Team

- Application metrics
- Performance optimization
- Bug fixes relacionados a performance
- Code review com foco em performance

### On-Call Engineer

- Primeira resposta a alertas críticos
- Execução de runbooks
- Escalação para especialistas
- Documentação de incidentes

---

## 📞 Escalação e Contatos

### Tier 1: On-Call Engineer

- **Response Time**: < 5 minutos
- **Responsibility**: Immediate mitigation
- **Escalation Trigger**: Unable to restore service in 15 min

### Tier 2: Tech Lead

- **Response Time**: < 15 minutos
- **Responsibility**: Technical decisions + resource allocation
- **Escalation Trigger**: Service impact > 30 min

### Tier 3: Engineering Manager

- **Response Time**: < 30 minutos
- **Responsibility**: External communication + incident command
- **Escalation Trigger**: Customer impact or SLA breach

---

**Documentação validada:** 29/08/2025  
**Próxima revisão:** 29/11/2025  
**Owner:** DevOps Team Simpix
