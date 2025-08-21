# 📊 Requisitos Não-Funcionais (NFRs) - Simpix
**Autor:** GEM 01 (Arquiteto)
**Data:** 21/08/2025
**Status:** Mapeamento
**Versão:** 1.0

---

## 🎯 MATRIZ DE PRIORIZAÇÃO DE NFRs

### Prioridade P0 (Crítica)
| NFR | Categoria | SLO Target | Atual | Gap |
|-----|-----------|------------|-------|-----|
| **Segurança** | Security | Zero breaches | 96% | Falta WAF, DDoS protection |
| **Disponibilidade** | Reliability | 99.9% uptime | ~95% | Sem redundância |
| **Integridade de Dados** | Data | Zero data loss | 95% | Backup manual |

### Prioridade P1 (Alta)
| NFR | Categoria | SLO Target | Atual | Gap |
|-----|-----------|------------|-------|-----|
| **Performance** | Performance | p95 < 200ms | ~400ms | Sem cache, otimização |
| **Escalabilidade** | Scalability | 1000 users/day | 50 max | Monolito, sem auto-scale |
| **Observabilidade** | Operations | 100% visibility | 0% | Zero monitoring |

### Prioridade P2 (Média)
| NFR | Categoria | SLO Target | Atual | Gap |
|-----|-----------|------------|-------|-----|
| **Usabilidade** | UX | NPS > 50 | Unknown | Sem medição |
| **Manutenibilidade** | Maintainability | < 2h fix time | ~4h | Código acoplado |
| **Testabilidade** | Quality | 80% coverage | ~5% | Poucos testes |

---

## 📈 CENÁRIOS DE QUALIDADE (Quality Attribute Scenarios)

### Scenario 1: Peak Load Performance
```yaml
Stimulus: 100 usuários simultâneos criando propostas
Source: Black Friday ou campanha marketing
Environment: Produção, horário comercial
Response: 
  - Sistema mantém p95 < 200ms
  - Zero erros 500
  - Auto-scaling ativa
Measure: 
  - Response time medido por DataDog
  - Error rate < 0.1%
```

### Scenario 2: Security Breach Attempt
```yaml
Stimulus: SQL injection attempt em formulário
Source: Atacante externo
Environment: Produção, qualquer hora
Response:
  - WAF bloqueia request
  - Alert para security team
  - Log completo do ataque
Measure:
  - Zero penetração
  - Detecção < 1 segundo
```

### Scenario 3: Database Failure
```yaml
Stimulus: Primary database crash
Source: Hardware failure ou corrupção
Environment: Produção, horário crítico
Response:
  - Failover automático para replica
  - Zero perda de dados
  - Usuários não percebem
Measure:
  - RTO < 5 minutos
  - RPO = 0 (zero data loss)
```

### Scenario 4: Integration Timeout
```yaml
Stimulus: Banco Inter API não responde
Source: Problema no parceiro
Environment: Produção, processamento de pagamento
Response:
  - Circuit breaker ativa
  - Retry com exponential backoff
  - Fallback para processamento manual
Measure:
  - Degradação graceful
  - User notificado em < 30s
```

---

## 💰 ERROR BUDGET DEFINITION

### Cálculo do Orçamento de Erro
```yaml
SLO Target: 99.9% uptime
Período: 30 dias (43,200 minutos)
Error Budget: 0.1% = 43.2 minutos/mês

Distribuição:
  - Deploys planejados: 20 min (46%)
  - Incidentes: 15 min (35%)
  - Experiments: 8.2 min (19%)
```

### Política de Consumo
```yaml
Se Error Budget > 50%:
  - Releases normais permitidos
  - Features novas OK
  - Experiments permitidos

Se Error Budget 20-50%:
  - Apenas fixes e features críticas
  - Maior rigor em testes
  - Post-mortem obrigatório

Se Error Budget < 20%:
  - Code freeze
  - Apenas hotfixes críticos
  - Foco em estabilização
  - Revisão arquitetural
```

---

## ⚔️ ANÁLISE DE CONFLITOS DE NFRs

### Matriz de Interdependência

|  | Security | Performance | Cost | Usability | Availability |
|--|----------|-------------|------|-----------|--------------|
| **Security** | - | Conflito ⚠️ | Conflito ⚠️ | Conflito ⚠️ | Suporta ✅ |
| **Performance** | Conflito ⚠️ | - | Conflito ⚠️ | Suporta ✅ | Neutro ⚪ |
| **Cost** | Conflito ⚠️ | Conflito ⚠️ | - | Neutro ⚪ | Conflito ⚠️ |
| **Usability** | Conflito ⚠️ | Suporta ✅ | Neutro ⚪ | - | Suporta ✅ |
| **Availability** | Suporta ✅ | Neutro ⚪ | Conflito ⚠️ | Suporta ✅ | - |

### Resoluções de Conflitos

#### Security vs Performance
```yaml
Conflito: Encryption adiciona latência
Resolução:
  - Hardware acceleration para crypto
  - Cache de sessões autenticadas
  - Async security checks quando possível
Trade-off: +10ms latency aceitável para segurança
```

#### Performance vs Cost
```yaml
Conflito: Mais recursos = maior custo
Resolução:
  - Auto-scaling com limites
  - Reserved instances para baseline
  - Spot instances para picos
Trade-off: Budget máximo $500/mês
```

#### Security vs Usability
```yaml
Conflito: MFA adiciona fricção
Resolução:
  - Remember device por 30 dias
  - Biometria em mobile
  - SSO para empresas
Trade-off: 1 click extra aceitável
```

---

## 🔥 COMPORTAMENTO SOB ESTRESSE EXTREMO

### Ponto de Saturação do Sistema

#### Level 1: Normal Operation (0-50 req/s)
```yaml
Comportamento:
  - Todas features funcionando
  - Response time < 200ms
  - CPU < 50%
  - Memory < 60%
```

#### Level 2: High Load (50-100 req/s)
```yaml
Comportamento:
  - Auto-scaling ativa
  - Cache agressivo
  - Response time < 500ms
  - CPU 50-80%
Ações:
  - Horizontal scaling
  - Rate limiting suave
```

#### Level 3: Saturation (100-150 req/s)
```yaml
Comportamento:
  - Features não-críticas desligadas
  - Apenas leitura em dashboard
  - Response time < 2s
  - CPU > 80%
Ações:
  - Circuit breakers ativos
  - Queue para writes
  - Cache only para reads
```

#### Level 4: Degraded (>150 req/s)
```yaml
Comportamento:
  - Modo emergência
  - Apenas auth e core API
  - Mensagem manutenção
Ações:
  - Reject new connections
  - Serve from CDN
  - Manual intervention
```

---

## 📊 QUANTIFICAÇÃO DE SLOS

### Service Level Objectives Detalhados

#### API Availability
```yaml
SLI: Successful requests / Total requests
SLO: 99.9% (43.2 min downtime/month)
Measurement: DataDog synthetic checks
Alert: < 99.5% in 5 min window
```

#### API Latency
```yaml
SLI: Response time percentiles
SLO: 
  - p50 < 100ms
  - p95 < 200ms
  - p99 < 500ms
Measurement: APM metrics
Alert: p95 > 300ms for 5 min
```

#### Data Durability
```yaml
SLI: Successfully stored data / Total data
SLO: 99.999% (5 nines)
Measurement: Backup validation
Alert: Any data loss event
```

#### Error Rate
```yaml
SLI: 5xx errors / Total requests
SLO: < 0.1%
Measurement: Application logs
Alert: > 1% in 1 min window
```

---

## 🛡️ REQUISITOS DE COMPLIANCE

### LGPD Requirements
```yaml
Implementado:
  - Consentimento explícito ✅
  - Criptografia em trânsito ✅
  - Logs de acesso ⚠️
  
Pendente:
  - Right to deletion ❌
  - Data portability ❌
  - Privacy by design ⚠️
  - DPO designation ❌
```

### PCI DSS (Básico)
```yaml
Aplicável (Nível 4):
  - Não armazenar cartão ✅
  - Usar tokenização ✅
  - Secure communications ✅
  - Access control ⚠️
  - Regular testing ❌
```

### ISO 27001 (Futuro)
```yaml
Preparação:
  - Risk assessment
  - Security policies
  - Incident management
  - Business continuity
  - Supplier management
```

---

## 📈 MÉTRICAS DE MONITORAMENTO

### RED Metrics (Request-Oriented)
- **Rate**: Requests per second
- **Errors**: Error percentage
- **Duration**: Response time distribution

### USE Metrics (Resource-Oriented)
- **Utilization**: CPU, Memory, Disk, Network
- **Saturation**: Queue depth, Thread pool
- **Errors**: System errors, Timeouts

### Business KPIs
- **Proposals Created**: Por hora/dia
- **Conversion Rate**: Aprovadas/Total
- **Payment Success**: Pagos/Gerados
- **User Activity**: DAU, MAU

---

*NFRs definidos - Base para decisões arquiteturais*