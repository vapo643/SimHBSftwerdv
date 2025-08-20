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

## 💰 ESTIMATIVA DE CUSTOS AZURE

### Recursos Mensais
```yaml
Container Apps:
  - 2 vCPU, 4GB RAM: $50
  - Requests: $10
  
PostgreSQL Flexible:
  - B2s (2 vCore, 4GB): $60
  - Storage 32GB: $5
  - Backup: $5
  
Redis Cache:
  - C0 Basic (250MB): $20
  
Storage Account:
  - 100GB + transactions: $10
  
Key Vault:
  - Operations: $5
  
Application Gateway:
  - Basic: $30
  
DataDog:
  - APM + Logs: $100
  
TOTAL: ~$295/mês
```

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