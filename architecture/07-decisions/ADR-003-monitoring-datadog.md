# ADR-003: DataDog para Observability Platform

**Data:** 20/08/2025
**Status:** Accepted ✅
**Deciders:** GEM 01 (Arquiteto), GEM 02 (Dev)

## Contexto

Sistema atualmente com ZERO observabilidade. Precisamos visibilidade imediata para migração segura e operação em produção.

## Decisão

**Adotaremos DataDog como plataforma unificada de observabilidade.**

## Justificativa

1. **Velocidade**: Setup em horas, não semanas
2. **Unificado**: Logs, metrics, traces, APM em um lugar
3. **Azure Integration**: Native connectors
4. **AI/ML**: Detecção automática de anomalias
5. **Developer Experience**: UI intuitiva, ótima documentação

## Escopo de Implementação

```yaml
Fase 0 (Imediato):
  - APM agent no Node.js
  - Log aggregation
  - Basic dashboards
  - Error tracking

Fase 1 (1 mês):
  - Custom metrics
  - SLO tracking
  - Synthetic monitoring
  - Database monitoring

Fase 2 (3 meses):
  - Distributed tracing
  - RUM (Real User Monitoring)
  - Security monitoring
```

## Consequências

### Positivas

- ✅ Visibilidade imediata do sistema
- ✅ Reduced MTTR (Mean Time To Recovery)
- ✅ Proactive alerting
- ✅ Histórico para capacity planning

### Negativas

- ❌ Custo alto ($70-150/mês inicial)
- ❌ Vendor lock-in
- ❌ Learning curve para features avançadas

## Alternativas Consideradas

1. **Azure Monitor**: Limitado, experiência ruim
2. **New Relic**: Similar custo, menos features
3. **Prometheus + Grafana**: Free mas muito trabalho manual
4. **Elastic Stack**: Complexo demais para nossa equipe

## Budget e ROI

```
Custo: ~$100/mês
ROI: Redução de 80% no MTTR
      Prevenção de 1 incidente = 10x o custo mensal
```

---

_"You can't manage what you can't measure" - Decisão crítica para operação segura_
