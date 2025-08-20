# ADR-001: Escolha do Azure como Cloud Provider

**Data:** 20/08/2025
**Status:** Accepted ✅
**Deciders:** GEM 01 (Arquiteto), GEM 02 (Dev)

## Contexto

O sistema Simpix está atualmente hospedado no Replit com banco de dados Supabase. Precisamos migrar para uma plataforma cloud enterprise-grade que suporte crescimento de 10 para 1000+ usuários.

## Decisão

**Escolhemos Microsoft Azure como nosso cloud provider principal.**

## Justificativa

1. **Integração Corporativa**: Melhor integração com ambientes Microsoft (muitos clientes usam)
2. **Compliance**: Certificações para sistema financeiro brasileiro
3. **Azure Container Apps**: Balance entre simplicidade e poder (vs raw Kubernetes)
4. **Suporte Local**: Datacenters no Brasil (São Paulo)
5. **Custo Previsível**: Modelo de pricing transparente

## Consequências

### Positivas
- ✅ Ecossistema integrado (Key Vault, Database, Container Apps)
- ✅ Compliance LGPD/BACEN mais simples
- ✅ Suporte enterprise em português
- ✅ Path claro para escalar (Container Apps → AKS)

### Negativas
- ❌ Learning curve para equipe (mais familiarizada com AWS)
- ❌ Vendor lock-in parcial
- ❌ Custo inicial maior que Replit (~$400/mês vs $20/mês)

## Alternativas Consideradas

1. **AWS**: Mais maduro, mas complexo demais para nossa fase
2. **GCP**: Bom custo, mas menos suporte local
3. **Continuar no Replit**: Não escala, sem controle enterprise

## Decisão Final

Azure oferece o melhor balance entre capacidade enterprise, compliance brasileiro e path de crescimento.

---

*Decisão ratificada por GEM 01 e GEM 02 em 20/08/2025*