# ADR-001: Estratégia de Landing Zone na Azure

**Data:** 21/08/2025  
**Status:** Proposto  
**Deciders:** GEM 01 (Arquiteto Senior), GEM 02 (Dev Specialist)  
**Tags:** #infraestrutura #azure #cloud #governance #migration

---

## Status

**Proposto** - Aguardando revisão e aprovação do comitê de arquitetura

Timeline:
- 21/08/2025: Documento criado (Proposto)
- Pendente: Revisão técnica
- Pendente: Aprovação final

---

## Contexto

### Problema
O sistema Simpix atualmente opera no Replit, uma plataforma que, embora adequada para prototipagem e desenvolvimento inicial, apresenta limitações significativas para um sistema financeiro em produção:

1. **Limitações de Escala:** Incapacidade de escalar horizontalmente sob demanda
2. **Compliance:** Dificuldade em atender requisitos regulatórios (LGPD, PCI DSS)
3. **Isolamento:** Falta de separação clara entre ambientes
4. **Governança:** Ausência de controles empresariais de segurança e auditoria
5. **SLAs:** Sem garantias de disponibilidade adequadas para sistema crítico

### Necessidade
Precisamos de uma forma padronizada, segura e escalável para organizar nossos recursos na nuvem, que suporte:
- Separação clara entre ambientes (Dev, Staging, Produção)
- Governança centralizada com controle de custos
- Conformidade com regulamentações financeiras
- Escalabilidade para suportar crescimento 10x previsto
- Disaster recovery e alta disponibilidade

### Drivers de Decisão
1. **Simplicidade inicial** - Evitar over-engineering na fase inicial
2. **Custo-benefício** - Otimizar custos mantendo qualidade
3. **Segurança** - Isolamento adequado entre ambientes
4. **Velocidade** - Time-to-market para migração
5. **Conformidade** - Aderência às melhores práticas Azure CAF

---

## Decisão

Adotaremos uma arquitetura de **Landing Zone simplificada** baseada no Azure Cloud Adoption Framework (CAF), com a seguinte estrutura organizacional:

### Estrutura Hierárquica

```
Azure Active Directory (Tenant)
└── Subscription: Simpix Production
    ├── Resource Group: rg-simpix-prod-brsouth-01
    ├── Resource Group: rg-simpix-staging-brsouth-01
    ├── Resource Group: rg-simpix-dev-brsouth-01
    └── Resource Group: rg-simpix-shared-brsouth-01
```

### Detalhamento dos Resource Groups

#### 1. **rg-simpix-prod-brsouth-01** (Produção)
**Propósito:** Ambiente de produção com dados reais e tráfego de clientes
**Recursos:**
- AKS cluster de produção (2-10 nodes auto-scaling)
- Azure Database for PostgreSQL (HA enabled)
- Azure Cache for Redis (Premium tier)
- Application Gateway com WAF
- Key Vault para segredos de produção
- Storage Account para backups e documentos

#### 2. **rg-simpix-staging-brsouth-01** (Staging)
**Propósito:** Ambiente de pré-produção para validação final
**Recursos:**
- AKS cluster de staging (1-3 nodes)
- Azure Database for PostgreSQL (cópia sanitizada de prod)
- Azure Cache for Redis (Standard tier)
- Application Gateway
- Key Vault para segredos de staging
- Storage Account para testes

#### 3. **rg-simpix-dev-brsouth-01** (Desenvolvimento)
**Propósito:** Ambiente de desenvolvimento e testes
**Recursos:**
- AKS cluster de dev (1-2 nodes)
- Azure Database for PostgreSQL (dados sintéticos)
- Azure Cache for Redis (Basic tier)
- Key Vault para segredos de dev
- Storage Account para desenvolvimento

#### 4. **rg-simpix-shared-brsouth-01** (Recursos Compartilhados)
**Propósito:** Recursos utilizados por todos os ambientes
**Recursos:**
- Azure Container Registry (ACR)
- Azure Monitor e Log Analytics Workspace
- Azure DevOps agents
- Backup Vault
- Network Watcher
- DNS zones

### Convenções de Nomenclatura

```
Padrão: [tipo]-[projeto]-[ambiente]-[região]-[instância]

Exemplos:
- aks-simpix-prod-brsouth-01
- psql-simpix-staging-brsouth-01
- kv-simpix-dev-brsouth-01
- acr-simpix-shared-brsouth-01
```

### Modelo de Governança

#### RBAC (Role-Based Access Control)
```yaml
Production:
  - Owner: CTO apenas
  - Contributor: DevOps Team (com PIM - Privileged Identity Management)
  - Reader: Desenvolvedores, Auditores

Staging:
  - Owner: Tech Lead
  - Contributor: DevOps Team, Senior Developers
  - Reader: Todos os desenvolvedores

Development:
  - Owner: Tech Lead
  - Contributor: Todos os desenvolvedores
  - Reader: Stakeholders

Shared:
  - Owner: DevOps Lead
  - Contributor: DevOps Team
  - Reader: Todos
```

#### Políticas Azure (Azure Policy)
- Enforce tagging obrigatório (environment, cost-center, owner, project)
- Deny recursos fora de Brazil South
- Require encryption at rest
- Audit recursos sem backup configurado
- Limit VM sizes por ambiente

#### Budget e Alertas
- Produção: Alert em 80% do budget mensal
- Staging: Alert em 60% do budget mensal
- Dev: Hard limit com auto-shutdown

---

## Justificativa

### Por que Landing Zone?
A Landing Zone fornece uma fundação padronizada e segura que acelera a adoção da nuvem enquanto mantém governança e compliance.

### Por que Subscrição Única (Inicialmente)?

**Vantagens:**
1. **Simplicidade Administrativa:** Gestão centralizada de billing e políticas
2. **Custo Reduzido:** Evita overhead de múltiplas subscrições
3. **Velocidade de Implementação:** Setup mais rápido
4. **Visibilidade:** Dashboard único para todos os recursos

**Mitigação de Riscos:**
- Isolamento via Resource Groups e RBAC
- Network segmentation com VNets separadas
- Políticas Azure para enforcement de governança
- Plano de evolução para multi-subscription quando necessário

### Por que Brazil South?

1. **Compliance:** Dados residentes no Brasil (LGPD)
2. **Latência:** < 20ms para usuários principais
3. **Disponibilidade:** Todos os serviços necessários disponíveis
4. **Custo:** Pricing competitivo vs outras regiões

### Alinhamento com Azure CAF

Nossa estrutura segue os princípios do Cloud Adoption Framework:
- ✅ **Ready:** Infrastructure-as-Code com Terraform
- ✅ **Govern:** Políticas e RBAC implementados
- ✅ **Manage:** Monitoring e alertas configurados
- ✅ **Secure:** Defense in depth, Zero Trust principles

---

## Consequências

### Positivas ✅

1. **Isolamento Claro:** Separação explícita entre ambientes
2. **Governança Simplificada:** RBAC no nível de Resource Group
3. **Custo Otimizado:** Billing consolidado com tags para chargeback
4. **Deployment Rápido:** CI/CD com service principals por ambiente
5. **Compliance Ready:** Estrutura preparada para auditorias
6. **Escalabilidade:** Fácil adição de novos ambientes/recursos
7. **DR Preparado:** Backup e recovery strategies por RG

### Negativas ⚠️

1. **Limite de Blast Radius:** Problema na subscrição afeta todos os ambientes
2. **Quotas Compartilhadas:** Limites de API/recursos são por subscrição
3. **Complexidade Futura:** Eventual migração para multi-subscription
4. **Single Point of Failure:** Dependência de uma única subscrição

### Mitigações Planejadas

1. **Fase 2 (6 meses):** Avaliar separação Prod em subscrição dedicada
2. **Monitoramento Proativo:** Alertas para quotas e limites
3. **Backup Cross-Region:** Replicação para Brazil South paired region
4. **Disaster Recovery Plan:** Documentado e testado trimestralmente

---

## Alternativas Consideradas

### Alternativa 1: Multi-Subscription desde o Início
**Estrutura:** Uma subscrição por ambiente
**Rejeitada porque:** Complexidade excessiva para o estágio atual, custo adicional de gestão, overhead administrativo desproporcional

### Alternativa 2: Management Groups Hierarchy
**Estrutura:** Management Groups com políticas hierárquicas
**Rejeitada porque:** Over-engineering para empresa única, complexidade desnecessária, benefícios não justificam o esforço inicial

### Alternativa 3: Single Resource Group
**Estrutura:** Todos os recursos em um único RG com tags
**Rejeitada porque:** Risco de segurança inaceitável, impossibilidade de RBAC granular, violação de melhores práticas

---

## Roadmap de Evolução

### Fase 1 - Atual (0-3 meses)
- ✅ Subscrição única com 4 Resource Groups
- ✅ RBAC básico implementado
- ✅ Políticas essenciais aplicadas

### Fase 2 - Maturidade (3-6 meses)
- 🎯 Avaliar separação de Produção
- 🎯 Implementar Hub-Spoke networking
- 🎯 Azure Front Door para multi-region

### Fase 3 - Escala (6-12 meses)
- 🎯 Management Groups se > 3 subscrições
- 🎯 Landing Zone Accelerator completo
- 🎯 Multi-region active-active

---

## Implementação

### Terraform Modules Structure
```hcl
modules/
├── resource-group/
├── networking/
│   ├── vnet/
│   ├── nsg/
│   └── private-endpoints/
├── compute/
│   ├── aks/
│   └── container-instances/
├── data/
│   ├── postgresql/
│   ├── redis/
│   └── storage/
├── security/
│   ├── key-vault/
│   └── managed-identity/
└── monitoring/
    ├── log-analytics/
    └── application-insights/
```

### Ordem de Implementação
1. **Semana 1:** Resource Groups e Networking
2. **Semana 2:** Shared resources (ACR, Key Vault)
3. **Semana 3:** Dev environment complete
4. **Semana 4:** Staging environment
5. **Semana 5-6:** Production environment
6. **Semana 7-8:** Migration e cutover

---

## Métricas de Sucesso

| Métrica | Target | Medição |
|---------|--------|---------|
| Tempo de provisionamento novo ambiente | < 30 min | Terraform apply time |
| Custo vs Replit | -20% | Monthly billing |
| Disponibilidade Produção | 99.9% | Azure Monitor |
| Tempo de deployment | < 10 min | CI/CD pipeline |
| Compliance score | > 85% | Azure Security Center |
| Recovery Time Objective | < 1 hora | DR tests |

---

## Riscos e Dependências

### Riscos
1. **Lock-in Azure:** Mitigado com containers e Kubernetes
2. **Custos inesperados:** Mitigado com budgets e alertas
3. **Complexidade de migração:** Mitigado com estratégia faseada

### Dependências
1. Azure Enterprise Agreement ou Pay-as-you-go
2. Equipe treinada em Azure e Kubernetes
3. Terraform expertise para IaC
4. Tempo de migração de dados (~48h)

---

## Referências

- [Azure Cloud Adoption Framework](https://docs.microsoft.com/azure/cloud-adoption-framework/)
- [Azure Landing Zone Conceptual Architecture](https://docs.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/)
- [Azure Naming Conventions](https://docs.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/naming-and-tagging)
- [Well-Architected Framework](https://docs.microsoft.com/azure/architecture/framework/)
- [Azure Security Baseline](https://docs.microsoft.com/security/benchmark/azure/)

---

## Registro de Decisão

| Campo | Valor |
|-------|-------|
| **ID** | ADR-001 |
| **Título** | Estratégia de Landing Zone na Azure |
| **Status** | Proposto |
| **Impacto** | Alto - Fundação de toda infraestrutura |
| **Autor** | GEM 02 (Dev Specialist) |
| **Data** | 21/08/2025 |
| **Revisão** | Pendente |
| **Aprovação** | Pendente |

---

## Assinaturas

| Papel | Nome | Data | Status |
|-------|------|------|--------|
| Autor | GEM 02 | 21/08/2025 | ✅ Submetido |
| Revisor Técnico | GEM 01 | Pendente | ⏳ Aguardando |
| Aprovador | CTO | Pendente | ⏳ Aguardando |
| Security Officer | - | Pendente | ⏳ Aguardando |

---

**FIM DO DOCUMENTO**