# 🚀 Plano de Migração Supabase → Azure

**Autor:** GEM 01 & GEM 02
**Data:** 20/08/2025
**Status:** In Progress
**Timeline:** 2-4 semanas

---

## 📋 CHECKLIST DE MIGRAÇÃO - PRÓXIMAS 48H

### ✅ Decisões Confirmadas
- [x] Cloud Provider: **Azure**
- [x] Orchestration: **Azure Container Apps**
- [x] Database: **Azure Database for PostgreSQL**
- [x] Monitoring: **DataDog**

### 🔴 DIA 1 (Hoje - 20/08)
```yaml
GEM 02 - Ações Imediatas:
  □ Criar conta Azure (se não tiver)
  □ Solicitar acesso Contributor
  □ Criar Resource Group: rg-simpix-prod
  □ Configurar Azure Key Vault
  □ Migrar primeiro secret (teste)

GEM 01 - Preparação:
  □ Desenhar arquitetura target
  □ Criar terraform modules base
  □ Definir naming conventions
  □ Configurar GitHub repository
  □ Setup branch protection
```

### 🟡 DIA 2 (21/08)
```yaml
Manhã:
  □ Configurar backup PostgreSQL automático
  □ Testar restore procedure
  □ Documentar processo
  
Tarde:
  □ Implementar /health endpoint
  □ Configurar structured logging
  □ Deploy Sentry integration
```

### 🟢 DIA 3 (22/08)
```yaml
CI/CD Pipeline:
  □ GitHub Actions workflow
  □ Docker build
  □ Container Registry push
  □ Deploy to staging
```

---

## 🏗️ ARQUITETURA TARGET AZURE

```
┌─────────────────────────────────────────────────────────┐
│                    Azure Subscription                     │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │           Resource Group: rg-simpix-prod         │    │
│  ├─────────────────────────────────────────────────┤    │
│  │                                                  │    │
│  │  ┌──────────────┐     ┌──────────────┐         │    │
│  │  │ Container     │     │ PostgreSQL   │         │    │
│  │  │ Apps Env      │────▶│ Flexible     │         │    │
│  │  │              │     │ Server       │         │    │
│  │  └──────────────┘     └──────────────┘         │    │
│  │         │                     │                 │    │
│  │         ▼                     ▼                 │    │
│  │  ┌──────────────┐     ┌──────────────┐         │    │
│  │  │ Redis Cache  │     │ Storage      │         │    │
│  │  │              │     │ Account      │         │    │
│  │  └──────────────┘     └──────────────┘         │    │
│  │                                                  │    │
│  │  ┌──────────────┐     ┌──────────────┐         │    │
│  │  │ Key Vault    │     │ Monitor      │         │    │
│  │  │              │     │ (DataDog)    │         │    │
│  │  └──────────────┘     └──────────────┘         │    │
│  │                                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 📊 FASES DA MIGRAÇÃO

### FASE 0: Fundação (Semana 1)
```yaml
Objetivo: Preparar terreno
Entregáveis:
  - Azure account setup ✓
  - Key Vault com secrets
  - Backup automation
  - Basic monitoring
  - CI/CD pipeline
Status: IN PROGRESS
```

### FASE 1: Staging (Semana 2)
```yaml
Objetivo: Deploy paralelo
Entregáveis:
  - Containers no Azure
  - Database replication
  - Integration testing
  - Load testing
Status: PLANNED
```

### FASE 2: Cutover (Semana 3)
```yaml
Objetivo: Migração final
Entregáveis:
  - DNS switch
  - Data migration
  - Monitoring validation
  - Rollback plan tested
Status: PLANNED
```

### FASE 3: Optimization (Semana 4)
```yaml
Objetivo: Fine tuning
Entregáveis:
  - Performance tuning
  - Cost optimization
  - Security hardening
  - Documentation complete
Status: PLANNED
```

---

## 🔄 **ESTRATÉGIA DE DEPLOYMENT: BLUE-GREEN**

### 4.1 **Azure Container Apps - Blue-Green Configuration**

```yaml
# Blue-Green Deployment Strategy
containerApps:
  configuration:
    activeRevisionsMode: "multiple"
    
  revisions:
    blue:
      suffix: "blue"
      trafficWeight: 100
      replicas: 2
    green:
      suffix: "green" 
      trafficWeight: 0
      replicas: 2
      
  deployment:
    strategy: "blue-green"
    healthCheck:
      path: "/health"
      initialDelaySeconds: 30
      periodSeconds: 10
      failureThreshold: 3
    
    trafficSplitting:
      phases:
        - weight: 0    # Initial - green gets no traffic
        - weight: 10   # Canary - 10% traffic after health checks
        - weight: 50   # Progressive - 50% traffic after 10min
        - weight: 100  # Full - 100% traffic after 30min
      
  rollback:
    automatic: true
    conditions:
      errorRate: "> 5%"
      latencyP99: "> 800ms"
      healthCheckFailures: 3
    maxRollbackTime: "5m"
    strategy: "immediate"
```

### 4.2 **Deployment Workflow**

```bash
#!/bin/bash
# Blue-Green Deployment Script

echo "🔄 Iniciando Blue-Green Deployment..."

# 1. Deploy Green Revision
az containerapp revision copy \
  --name simpix-api \
  --resource-group rg-simpix-prod \
  --from-revision blue \
  --to-revision green

# 2. Health Check Validation
echo "⏳ Validating Green revision health..."
for i in {1..10}; do
  health_status=$(curl -f https://simpix-green.azurecontainerapps.io/health)
  if [[ $health_status == "healthy" ]]; then
    echo "✅ Green revision healthy"
    break
  fi
  sleep 30
done

# 3. Progressive Traffic Shifting
echo "🔀 Shifting traffic progressively..."

# 10% to green
az containerapp revision set-traffic \
  --name simpix-api \
  --resource-group rg-simpix-prod \
  --revision-weight blue=90,green=10

sleep 600  # Wait 10 minutes

# 50% to green
az containerapp revision set-traffic \
  --name simpix-api \
  --resource-group rg-simpix-prod \
  --revision-weight blue=50,green=50

sleep 1200  # Wait 20 minutes

# 100% to green (full cutover)
az containerapp revision set-traffic \
  --name simpix-api \
  --resource-group rg-simpix-prod \
  --revision-weight green=100

echo "✅ Blue-Green deployment completed successfully!"
```

---

## 💰 ESTIMATIVA DE CUSTOS AZURE

### Recursos Mensais (CORRIGIDO)
```yaml
Container Apps:
  - 2 vCPU, 4GB RAM (2 revisions): $100
  - Requests + Traffic Manager: $25
  
PostgreSQL Flexible:
  - B2s (2 vCore, 4GB): $60
  - Storage 32GB: $5
  - Backup Geo-redundant: $15
  
Redis Cache:
  - C0 Basic (250MB): $20
  
Storage Account:
  - 100GB + transactions: $10
  - Egress data transfer: $45
  
Key Vault:
  - Operations + HSM: $25
  
Application Gateway:
  - Standard v2 + WAF: $85
  
DataDog:
  - APM + Logs + Infrastructure: $150
  
Network Security:
  - DDoS Protection: $30
  - VPN Gateway: $35
  
TOTAL REALÍSTICO: ~$605/mês
```

### ⚠️ **CORREÇÃO DE ESTIMATIVA CRÍTICA**

**Estimativa Original:** $295/mês ❌  
**Estimativa Corrigida:** $605/mês ✅  
**Diferença:** +$310/mês (+105% de aumento)

**Custos Omitidos Anteriormente:**
- Egress data transfer: $45/mês
- Application Gateway v2 + WAF: +$55/mês
- Backup geo-redundante: +$10/mês
- DDoS Protection: $30/mês
- Dual revision overhead: +$50/mês
- DataDog infrastructure monitoring: +$50/mês
- Key Vault HSM: +$20/mês

### Comparação
- **Atual (Replit + Supabase):** $20/mês
- **Azure (Inicial):** $295/mês
- **Azure (Otimizado):** $200/mês (após tuning)
- **ROI:** Escalabilidade 100x, SLA 99.9%, Compliance

---

## 🔧 SCRIPTS E COMANDOS

### Azure CLI Setup
```bash
# Login
az login

# Create Resource Group
az group create --name rg-simpix-prod --location brazilsouth

# Create Key Vault
az keyvault create \
  --name kv-simpix-prod \
  --resource-group rg-simpix-prod \
  --location brazilsouth

# Add Secret
az keyvault secret set \
  --vault-name kv-simpix-prod \
  --name "database-url" \
  --value "postgresql://..."
```

### Terraform Base
```hcl
# main.tf
provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = "rg-simpix-prod"
  location = "Brazil South"
}

resource "azurerm_key_vault" "main" {
  name                = "kv-simpix-prod"
  resource_group_name = azurerm_resource_group.main.name
  location           = azurerm_resource_group.main.location
  tenant_id          = data.azurerm_client_config.current.tenant_id
  sku_name           = "standard"
}
```

---

## 📝 DOCUMENTAÇÃO NECESSÁRIA

### Para GEM 02 criar:
- [ ] Runbook: Backup & Restore PostgreSQL
- [ ] Runbook: Incident Response
- [ ] Guide: Local development com Azure
- [ ] Troubleshooting: Common issues

### Para GEM 01 criar:
- [ ] Architecture diagrams (C4)
- [ ] Network topology
- [ ] Security baseline
- [ ] Disaster recovery plan

---

## ⚠️ RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Custo overrun | Média | Médio | Budget alerts, cost monitoring |
| Data loss | Baixa | Crítico | Backup antes, dual-write durante |
| Integration fail | Alta | Alto | Staging validation completo |
| Performance degr | Média | Médio | Load testing, monitoring |

---

## 🎯 CRITÉRIOS DE SUCESSO

### Técnicos
- ✅ Zero data loss
- ✅ Downtime < 1 hora
- ✅ Performance igual ou melhor
- ✅ All integrations working

### Negócio
- ✅ Usuários não percebem mudança
- ✅ Capacidade para 1000 users
- ✅ SLA 99.9% achieved
- ✅ Compliance requirements met

---

## 🚀 PRÓXIMOS PASSOS IMEDIATOS

1. **GEM 02**: Criar Azure account AGORA
2. **GEM 01**: Começar Terraform modules
3. **Ambos**: Daily sync 10min (status check)
4. **User**: Aprovar budget Azure (~$300/mês)

---

*"From Replit to Azure in 4 weeks" - Let's make it happen!*

---

*Documento atualizado: 20/08/2025 23:30 UTC*