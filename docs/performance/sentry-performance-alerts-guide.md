# 🔔 Guia de Configuração de Alertas de Performance - Sentry

**PAM V4.3 PERF-F4-001** - Sistema de Monitoramento Contínuo

## 📋 Visão Geral

Este guia fornece instruções passo-a-passo para configurar alertas de performance no Sentry, garantindo monitoramento proativo dos SLAs estabelecidos pela "Operação P95".

### 🎯 SLAs Monitorados

- **P95 Latência**: < 500ms (alerta em 750ms)
- **P99 Latência**: < 1000ms (alerta em 1200ms)
- **Taxa de Erro**: < 1% (alerta em 2%)
- **Disponibilidade**: > 99.9% (alerta em < 99.5%)

---

## 🛠️ Configuração de Alertas no Sentry

### STEP 1: Acessar Dashboard Sentry

1. Faça login no [Sentry.io](https://sentry.io)
2. Selecione o projeto **Simpix** 
3. Navegue para **Alerts** → **Create Alert**

### STEP 2: Configurar Alert de Latência P95

#### Configurações Básicas:
- **Alert Name**: `P95 Latency - Critical Endpoints`
- **Team**: Desenvolvimento
- **Environment**: `production`

#### Condições do Alert:
```
Metric: p95(transaction.duration)
Threshold: > 750ms
Time Window: 5 minutes
Frequency: Every minute
```

#### Filtros:
```
transaction:/api/propostas OR 
transaction:/api/produtos OR 
transaction:/api/tabelas-comerciais OR
transaction:/api/simulacao-credito
```

#### Actions:
- **Slack**: Canal `#alerts-performance`
- **Email**: equipe-dev@simpix.com
- **Severity**: High

### STEP 3: Configurar Alert de Taxa de Erro

#### Configurações:
- **Alert Name**: `Error Rate - Critical Endpoints`
- **Metric**: `failure_rate()`
- **Threshold**: `> 2%`
- **Time Window**: `5 minutes`

#### Filtros:
```
http.status_code:5xx OR http.status_code:4xx
transaction:/api/*
```

### STEP 4: Configurar Alert de Throughput

#### Configurações:
- **Alert Name**: `Low Throughput - System Health`
- **Metric**: `count()`
- **Threshold**: `< 10 requests/minute`
- **Time Window**: `10 minutes`

---

## 📊 Configurações Avançadas

### Dashboard Personalizado

Criar dashboard com as seguintes métricas:

1. **P95 Latency Timeline**
   ```
   p95(transaction.duration) by transaction
   ```

2. **Error Rate by Endpoint**
   ```
   failure_rate() by transaction
   ```

3. **Throughput Overview**
   ```
   count() by transaction
   ```

4. **Cache Hit Rate**
   ```
   count() where message:"CACHE HIT" / count() where message:"CACHE"
   ```

### Alert Rules YAML (para automação):

```yaml
# sentry-alerts-config.yml
alerts:
  - name: "P95-Latency-Critical"
    metric: "p95(transaction.duration)"
    threshold: 750
    unit: "ms"
    time_window: "5m"
    environment: "production"
    
  - name: "Error-Rate-Critical" 
    metric: "failure_rate()"
    threshold: 0.02
    time_window: "5m"
    environment: "production"
```

---

## 🚨 Plano de Resposta a Alertas

### Latência Elevada (P95 > 750ms)

**Ações Imediatas:**
1. Verificar Redis status (`/api/health/redis`)
2. Monitorar uso de CPU/memória
3. Verificar slow queries no PostgreSQL
4. Revisar cache hit rate

**Comandos de Diagnóstico:**
```bash
# Verificar status Redis
curl http://localhost:5000/api/health

# Monitorar performance em tempo real
artillery quick --count 10 --num 5 http://localhost:5000/api/propostas
```

### Taxa de Erro Elevada (> 2%)

**Ações:**
1. Verificar logs de erro no Sentry
2. Validar conectividade com banco de dados
3. Revisar rate limiting configurações
4. Verificar autenticação JWT

### Baixo Throughput (< 10 req/min)

**Possíveis Causas:**
- Rate limiting muito restritivo
- Problema de conectividade
- Falha no load balancer
- Manutenção programada

---

## 📋 Checklist de Configuração

### ✅ Pré-requisitos
- [ ] Acesso admin ao Sentry
- [ ] Projeto Simpix configurado
- [ ] Integração Slack ativa
- [ ] Environment tags configurados

### ✅ Alertas Obrigatórios
- [ ] P95 Latency Alert (750ms threshold)
- [ ] P99 Latency Alert (1200ms threshold)
- [ ] Error Rate Alert (2% threshold)
- [ ] Throughput Alert (10 req/min threshold)

### ✅ Integrações
- [ ] Slack notifications (#alerts-performance)
- [ ] Email notifications (equipe-dev@simpix.com)
- [ ] Dashboard personalizado criado
- [ ] On-call schedule definido

### ✅ Testes
- [ ] Testar alertas manualmente
- [ ] Validar tempo de resposta de notificações
- [ ] Confirmar dashboards funcionais
- [ ] Documentar runbooks de resposta

---

## 🔍 Monitoramento Complementar

### Logs Estruturados
Configurar alertas baseados em logs para:
- `[CACHE] MISS` rate > 50%
- `[SECURITY] TOKEN_INVALID` rate > 10/min
- `[PERFORMANCE] SLOW` requests > 5/min

### Métricas Customizadas
```javascript
// Exemplo: Instrumentação customizada
Sentry.addBreadcrumb({
  message: 'Cache operation',
  category: 'cache',
  data: { 
    operation: 'get',
    key: 'products:all',
    hit: true,
    duration: 15
  }
});
```

---

## 📞 Contatos de Emergência

- **Equipe DevOps**: devops@simpix.com
- **Arquiteto Chefe**: arquiteto@simpix.com  
- **On-call Engineer**: +55 (11) 99999-9999
- **Sentry Support**: help@sentry.io

---

**Última atualização:** 29/08/2025  
**Responsável:** Equipe DevOps Simpix  
**Revisão:** Trimestral