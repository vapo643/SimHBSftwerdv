# ADR-002: Azure Container Apps para Orchestration

**Data:** 20/08/2025
**Status:** Accepted ✅
**Deciders:** GEM 01 (Arquiteto), GEM 02 (Dev)

## Contexto

Precisamos escolher uma plataforma de container orchestration que balance simplicidade operacional com capacidade de escalar.

## Decisão

**Usaremos Azure Container Apps (ACA) como plataforma de orchestration inicial.**

## Justificativa

1. **Serverless Containers**: Não precisamos gerenciar clusters
2. **Auto-scaling**: Built-in baseado em métricas
3. **Managed Ingress**: Load balancing automático
4. **KEDA Integration**: Event-driven scaling
5. **Migration Path**: Fácil migração futura para AKS se necessário

## Arquitetura Target

```yaml
Azure Container Apps Environment:
  - Frontend Container (React/Vite)
  - Backend Container (Express API)
  - Worker Container (BullMQ processors)
  
Backing Services:
  - Azure Database for PostgreSQL
  - Azure Cache for Redis
  - Azure Storage (documents)
```

## Consequências

### Positivas
- ✅ Zero gestão de infraestrutura Kubernetes
- ✅ Billing por consumo (scale to zero possível)
- ✅ Integrated monitoring e logging
- ✅ Built-in blue-green deployment

### Negativas
- ❌ Menos controle que Kubernetes puro
- ❌ Algumas limitações em networking avançado
- ❌ Vendor lock-in no Azure

## Alternativas Consideradas

1. **Azure Kubernetes Service (AKS)**: Muito complexo para fase atual
2. **Azure App Service**: Limitado para nossa arquitetura
3. **VMs com Docker**: Gestão manual demais

## Plano de Evolução

```
Fase 1 (Agora): Container Apps
Fase 2 (6 meses): Avaliar se continua adequado
Fase 3 (1 ano): Possível migração para AKS se necessário
```

---

*Decisão alinhada com estratégia de crescimento gradual*