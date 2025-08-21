# 📋 FASE 0: MAPEAMENTO DETALHADO - Fundação Imediata
**Autor:** GEM 01 (Arquiteto)
**Data:** 21/08/2025
**Status:** MAPPING PHASE
**Objetivo:** Mapear completamente antes de executar

---

## 🎯 CLARIFICAÇÃO ESTRATÉGICA

### Estratégia de Execução Confirmada
```yaml
FASE 0 (Agora → 2 semanas):
  Ambiente: Supabase ATUAL
  Objetivo: Preparar aplicação para ser "Azure-Ready"
  Ações: Blindar, estabilizar, desacoplar
  
FASE 1 (2-4 semanas):
  Ambiente: Azure STAGING
  Objetivo: Deploy paralelo para validação
  Ações: Provisionar, testar, validar
  
FASE 2 (4 semanas):
  Ambiente: Azure PRODUCTION
  Objetivo: Migração final
  Ações: Cutover, DNS switch, monitoring
```

**DECISÃO:** Fase 0 será executada NO AMBIENTE ATUAL (Supabase) para preparar migração segura.

---

## 📊 MAPEAMENTO COMPLETO - ROADMAP ESTRATÉGICO

### I. FUNDAMENTOS ESTRATÉGICOS

#### Ponto 6: Definição dos Limites do Sistema (Scope)
```yaml
Estado Atual:
  - MVP: 80% completo
  - Features core: Propostas, Pagamentos, Documentos
  - Integrações: Banco Inter, ClickSign
  
Ações Necessárias:
  1. Documentar features IN-SCOPE:
     - Gestão de propostas de crédito
     - Cálculo de TAC e simulações
     - Geração de boletos/PIX
     - Assinatura digital CCB
     - Dashboard analítico
     
  2. Documentar OUT-OF-SCOPE:
     - Mobile app
     - Integração com outros bancos
     - BI avançado
     - Multi-tenant
     
  3. Criar Change Management Process:
     - Requisição formal
     - Análise de impacto
     - Aprovação comitê
     - Documentação ADR
```

#### Ponto 7: Requisitos Arquiteturalmente Significativos (RAS)
```yaml
NFRs Críticos Identificados:
  1. Disponibilidade:
     - SLO: 99.9% uptime
     - Error Budget: 43 min/mês
     - Ponto Saturação: 100 req/s
     
  2. Performance:
     - Response time p95 < 200ms
     - Throughput: 50 req/s sustained
     - Database queries < 50ms
     
  3. Segurança:
     - PCI DSS compliance básico
     - LGPD compliance
     - Encryption at rest/transit
     
  4. Escalabilidade:
     - Horizontal scaling ready
     - Stateless application
     - Cache layer preparado
     
Matriz de Conflitos:
  Performance ←→ Segurança
  Custo ←→ Disponibilidade
  Simplicidade ←→ Escalabilidade
```

#### Ponto 8: Restrições (Constraints)
```yaml
Restrições DURAS (não negociáveis):
  - PostgreSQL obrigatório
  - Integração Banco Inter mantida
  - LGPD compliance
  - Budget: $500/mês máximo
  
Restrições SUAVES (negociáveis):
  - Replit como plataforma
  - Supabase como provider
  - Monolito architecture
  
Skills Gap Analysis:
  - Azure: Baixo conhecimento
  - Kubernetes: Médio conhecimento
  - Terraform: Baixo conhecimento
  - Monitoring: Baixo conhecimento
  
Plano de Mitigação:
  - Treinamento Azure (1 semana)
  - Consultoria pontual
  - Documentação exaustiva
  - Pair programming
```

---

## 📐 II. MACRO-ARQUITETURA

### Ponto 18: Diagramas de Arquitetura (AS-IS)

#### C4 Level 1 - System Context
```
[Usuários] → [Simpix System] → [Banco Inter API]
                ↓                      ↓
         [Supabase Auth]        [ClickSign API]
                ↓
         [PostgreSQL DB]
```

#### C4 Level 2 - Container Diagram
```
┌─────────────────────────────────────────┐
│            Simpix System                 │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────┐     ┌──────────┐         │
│  │  React   │────▶│ Express  │         │
│  │  SPA     │     │  API     │         │
│  └──────────┘     └──────────┘         │
│                         ↓               │
│              ┌──────────────────┐       │
│              │  BullMQ Workers  │       │
│              └──────────────────┘       │
│                         ↓               │
│              ┌──────────────────┐       │
│              │   PostgreSQL     │       │
│              └──────────────────┘       │
└─────────────────────────────────────────┘
```

### Deployment View (Current - Replit)
```yaml
Replit Environment:
  - Single VM instance
  - 2 vCPU, 2GB RAM
  - Shared PostgreSQL
  - No redundancy
  - Manual deployment
```

---

## 💾 V. ARQUITETURA DE DADOS

### Ponto 41: Estratégia de Persistência
```yaml
Estado Atual:
  - Drizzle ORM
  - Migrations manuais
  - No version control
  - No rollback plan
  
Ações Mapeadas:
  1. Implementar Drizzle Kit migrations
  2. Versionar schema changes
  3. Criar seed data scripts
  4. Documentar rollback procedures
  5. Implement Expand/Contract pattern
  
Zero Downtime Strategy:
  - Step 1: Add new column (nullable)
  - Step 2: Dual write
  - Step 3: Backfill data
  - Step 4: Switch reads
  - Step 5: Remove old column
```

### Ponto 45: Classificação de Dados
```yaml
Dados Sensíveis (PII):
  - users.cpf
  - users.email
  - propostas.client_data
  - parcelas.payment_data
  
Dados Financeiros:
  - propostas.valor_financiado
  - parcelas.valor
  - inter_collections
  
Dados Públicos:
  - produtos.nome
  - tabelas_comerciais.taxas
  
Estratégia DLP:
  - Masking em dev/staging
  - Audit logs para acesso PII
  - Encryption at rest
  - Row-level security
```

---

## 🚀 VII. INFRAESTRUTURA E DEPLOYMENT

### Ponto 62: Estratégia de Nuvem
```yaml
Exit Strategy Replit:
  Semana 1:
    - Containerizar aplicação
    - Externalizar configs
    - Backup dados
    
  Semana 2:
    - Provisionar Azure
    - Deploy staging
    - Validar integrações
    
  Semana 3-4:
    - Migração production
    - DNS switch
    - Monitoring setup
    
Landing Zone Azure:
  - Subscription: Production
  - Resource Groups:
    - rg-simpix-shared
    - rg-simpix-dev
    - rg-simpix-staging
    - rg-simpix-prod
```

### Ponto 67: Estratégia de Ambientes
```yaml
Development (Atual):
  - Replit + Supabase
  - Dados fake
  - Sem backups
  
Staging (Novo):
  - Azure Container Apps
  - Dados sanitizados
  - Backups diários
  
Production (Futuro):
  - Azure Container Apps
  - Dados reais
  - Backups contínuos
  - Multi-region DR
```

### Ponto 71: Gerenciamento de Configuração
```yaml
12-Factor App Compliance:
  1. Codebase: Git monorepo ✅
  2. Dependencies: package.json ✅
  3. Config: Environment vars ⚠️
  4. Backing services: Treated as attached ⚠️
  5. Build/release/run: Separated ❌
  6. Processes: Stateless ⚠️
  7. Port binding: Self-contained ✅
  8. Concurrency: Process model ⚠️
  9. Disposability: Fast startup/shutdown ❌
  10. Dev/prod parity: Similar environments ❌
  11. Logs: Event streams ❌
  12. Admin processes: One-off processes ⚠️
  
Ações:
  - Externalizar ALL configs
  - Implementar graceful shutdown
  - Structured logging
  - Separate build from runtime
```

### Ponto 72: Pipelines CI/CD
```yaml
Pipeline Stages:
  1. Source:
     - GitHub webhook
     - Branch protection
     
  2. Build:
     - Install dependencies
     - TypeScript compile
     - Run linters
     
  3. Test:
     - Unit tests
     - Integration tests
     - Security scan
     
  4. Package:
     - Docker build
     - Push to registry
     
  5. Deploy Staging:
     - Update Container Apps
     - Run smoke tests
     
  6. Approval:
     - Manual gate
     
  7. Deploy Production:
     - Blue-green deployment
     - Health checks
     - Rollback ready
     
DORA Metrics Target:
  - Deploy frequency: Daily
  - Lead time: < 2 hours
  - MTTR: < 30 minutes
  - Change failure: < 5%
```

### Ponto 76: Backup e Restore
```yaml
Backup Strategy:
  Frequência:
    - Production: Continuous (PITR)
    - Staging: Daily
    - Dev: Weekly
    
  Retenção:
    - Daily: 7 days
    - Weekly: 4 weeks
    - Monthly: 12 months
    
  Teste Restore:
    - Automated weekly
    - Full DR drill monthly
    
  RTO/RPO:
    - RTO: 1 hour
    - RPO: 15 minutes
    
  Imutabilidade:
    - Backup to separate account
    - Write-once storage
    - Encryption at rest
```

---

## 🔒 VIII. QUALIDADES SISTÊMICAS

### Ponto 82: Gestão de Segredos
```yaml
Secrets Inventory:
  Application:
    - SUPABASE_URL
    - SUPABASE_ANON_KEY
    - DATABASE_URL
    - JWT_SECRET
    - SESSION_SECRET
    
  Integrations:
    - INTER_CLIENT_ID
    - INTER_CLIENT_SECRET
    - INTER_CERTIFICATE
    - CLICKSIGN_TOKEN
    
  Infrastructure:
    - AZURE_SUBSCRIPTION_ID
    - AZURE_TENANT_ID
    - DATADOG_API_KEY
    
Migration Plan:
  1. Azure Key Vault setup
  2. Service Principal creation
  3. Managed Identity config
  4. Secret rotation policy
  5. Audit logging
```

### Ponto 92: Observabilidade
```yaml
Logging:
  - Structured JSON format
  - Correlation IDs
  - Log levels (ERROR, WARN, INFO, DEBUG)
  - Centralized aggregation
  
Metrics:
  - RED metrics (Rate, Errors, Duration)
  - USE metrics (Utilization, Saturation, Errors)
  - Business KPIs
  
Tracing:
  - OpenTelemetry integration
  - Distributed tracing
  - Service dependency map
  
Monitoring Stack:
  - DataDog APM
  - Custom dashboards
  - Alert rules
  - SLO tracking
```

### Ponto 93: Gestão de Incidentes
```yaml
Incident Response Plan:
  Severity Levels:
    - SEV1: Production down
    - SEV2: Major feature broken
    - SEV3: Minor issue
    - SEV4: Cosmetic
    
  Response Times:
    - SEV1: 15 minutes
    - SEV2: 1 hour
    - SEV3: 4 hours
    - SEV4: Next business day
    
  Runbooks:
    - Database recovery
    - Service restart
    - Rollback procedure
    - Integration reset
    
  Communication:
    - Status page
    - Email alerts
    - Slack channel
    - Post-mortem docs
```

---

## 📅 CRONOGRAMA DETALHADO

### Semana 1: Preparação no Supabase
```yaml
Dia 1-2:
  - Backup automation
  - Secrets audit
  - Health checks
  
Dia 3-4:
  - Logging estruturado
  - Error tracking
  - Monitoring básico
  
Dia 5:
  - Documentation
  - Testing
  - Review
```

### Semana 2: Azure Setup
```yaml
Dia 6-7:
  - Azure provisioning
  - Terraform setup
  - Network config
  
Dia 8-9:
  - Container Apps
  - Database setup
  - Storage config
  
Dia 10:
  - Integration testing
  - Performance testing
  - Security scan
```

### Semana 3-4: Migration
```yaml
Dia 11-15:
  - Staging deployment
  - Data migration test
  - Load testing
  
Dia 16-20:
  - Production prep
  - Cutover planning
  - Go-live
```

---

## ✅ CHECKLIST PRÉ-EXECUÇÃO

### Decisões Necessárias
- [ ] Confirmar Azure como provider
- [ ] Aprovar budget ($300-500/mês)
- [ ] Definir janela de migração
- [ ] Escolher monitoring tool
- [ ] Confirmar estratégia de backup

### Pré-requisitos
- [ ] Azure subscription criada
- [ ] GitHub repository preparado
- [ ] Team treinado em Azure basics
- [ ] Runbooks documentados
- [ ] Plano de rollback definido

### Riscos Aceitos
- [ ] Downtime de 1 hora na migração
- [ ] Custo inicial maior
- [ ] Learning curve Azure
- [ ] Possíveis bugs pós-migração

---

*Mapeamento completo - Aguardando aprovação para iniciar execução*