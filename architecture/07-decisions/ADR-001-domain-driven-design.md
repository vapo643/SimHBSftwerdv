# ADR-001: Adoção de Domain-Driven Design e Bounded Contexts

**Status:** Aceito  
**Data:** 2025-08-21  
**Deciders:** GEM 01 (Arquiteto Chefe), GEM 02 (Dev Specialist), GEM 07 (AI Specialist)

## Contexto

Durante a Fase 0, identificamos que o sistema Simpix possui alta complexidade de domínio com múltiplas responsabilidades entrelaçadas:
- Gestão de propostas de crédito
- Análise de risco
- Geração de contratos
- Processamento de pagamentos
- Integração com APIs externas

O código atual está estruturado como um monolito com acoplamento significativo entre diferentes áreas de negócio.

## Decisão

Adotamos **Domain-Driven Design (DDD)** com **Bounded Contexts** claramente definidos para:
1. Estabelecer uma Linguagem Ubíqua consistente
2. Isolar domínios de negócio em contextos delimitados
3. Reduzir acoplamento entre diferentes áreas funcionais
4. Preparar o sistema para evolução futura (microserviços se necessário)

### Bounded Contexts Identificados

**Core Contexts:**
- Credit Proposal Context
- Credit Analysis Context
- Contract Management Context

**Supporting Contexts:**
- Payment Context
- Partner Management Context
- Notification Context

**Generic Contexts:**
- Authentication Context
- Audit Context

## Consequências

### Positivas
- **Manutenibilidade:** Código organizado por domínio de negócio
- **Testabilidade:** Contextos isolados são mais fáceis de testar
- **Evolução:** Preparado para extração futura de serviços
- **Clareza:** Linguagem Ubíqua reduz ambiguidades
- **Paralelização:** Times podem trabalhar em contextos diferentes

### Negativas
- **Complexidade Inicial:** Requer refatoração significativa
- **Curva de Aprendizado:** Time precisa aprender conceitos DDD
- **Overhead:** Comunicação entre contextos via contratos
- **Enforcement:** Necessita ferramentas de validação (dependency-cruiser)

## Implementação

### Fase 1.1 - Enforcement (2 semanas)
1. Configurar dependency-cruiser para validar limites
2. Criar testes de invariantes para agregados
3. Implementar Event Bus local
4. Definir contratos OpenAPI entre contextos

### Fase 1.2 - Refatoração (2 meses)
1. Isolar Credit Proposal Context
2. Extrair Payment Context
3. Implementar Saga Pattern
4. Criar Anti-Corruption Layers

## Métricas de Sucesso

- Zero violações de contexto no CI/CD
- 100% das invariantes com testes
- Redução de 50% no acoplamento
- Build time < 2 minutos

## Referências

- Evans, Eric. "Domain-Driven Design: Tackling Complexity in the Heart of Software"
- Vernon, Vaughn. "Implementing Domain-Driven Design"
- [Event Storming Session](../01-domain/ddd-event-storming-session.md)

## Decisões Relacionadas

- ADR-002: Padrão de Arquitetura Hexagonal (a ser criado)
- ADR-003: Estratégia de Migração para Azure (a ser criado)