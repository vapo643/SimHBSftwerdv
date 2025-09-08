# ADR-009: Estratégia do Monólito Migrável

**Status:** Proposto  
**Data:** 2025-08-22  
**Decisores:** Equipe de Arquitetura

---

## Decisão

Adotaremos o padrão **"Monólito Migrável"** como a nossa arquitetura principal. O desenvolvimento continuará num único repositório e com um único deploy, mas seguirá princípios de design rigorosos que garantam um baixo acoplamento e uma alta coesão entre os Bounded Contexts.

Esta decisão estabelece uma estratégia evolutiva que nos permite capturar os benefícios da simplicidade operacional de um monólito hoje, enquanto mantemos a flexibilidade para migrar para microserviços quando os gatilhos objetivos forem atingidos.

---

## Contexto e Justificativa (Racional de Negócio)

### Situação Atual

- **Volume de Transações:** Atualmente processamos aproximadamente **20 propostas/dia**
- **Equipe:** Uma equipe única de desenvolvimento
- **Stack Tecnológico:** TypeScript/Node.js unificado
- **Complexidade Operacional:** Baixa, com um único ambiente de deploy

### Projeção de Crescimento

Nossa trajetória de crescimento prevista segue esta progressão:

- **Fase 1 (Atual):** 20 propostas/dia
- **Fase 2 (3 meses):** 50 propostas/dia
- **Fase 3 (6 meses):** 100 propostas/dia
- **Fase 4 (9 meses):** 200 propostas/dia
- **Fase 5 (12 meses):** 800 propostas/dia
- **Fase 6 (18 meses):** 1000+ propostas/dia

### Justificativa da Decisão

1. **Velocidade de Desenvolvimento:** Um monólito bem estruturado oferece a maior velocidade de desenvolvimento para nosso volume atual, eliminando a complexidade de coordenação distribuída.

2. **Custo Operacional:** A complexidade operacional de microserviços (service discovery, tracing distribuído, gestão de falhas em cascata) não se justifica para nosso volume atual.

3. **Preparação para o Futuro:** Ao seguir princípios rigorosos de design, garantimos que a migração futura para microserviços seja uma evolução natural, não uma reescrita.

4. **Aprendizado do Domínio:** O monólito nos permite iterar rapidamente sobre os bounded contexts enquanto ainda estamos refinando nosso entendimento do domínio.

---

## Princípios de Design do "Monólito Migrável" (As Regras do Jogo)

### 1. Alta Modularidade

- **Mandatório:** Todo código deve residir dentro de um Bounded Context claramente definido
- **Estrutura de Pastas:** `/server/modules/{bounded-context}/`
- **Encapsulamento:** Cada módulo deve expor apenas interfaces públicas bem definidas

### 2. Comunicação Inter-Módulos

- **Regra de Ouro:** A comunicação entre Bounded Contexts distintos **DEVE** ser:
  - **Preferencialmente Assíncrona:** Via eventos usando um barramento de eventos in-memory (inicialmente) ou message broker (futuramente)
  - **Se Síncrona:** APENAS através de interfaces de API bem definidas (`/server/modules/{context}/api/`)
- **Proibido:**
  - Chamadas diretas de função entre bounded contexts
  - Importações diretas de código entre módulos
  - Acesso direto a estruturas de dados internas de outros módulos

### 3. Base de Dados Única, Schemas Separados

- **Estratégia:** Manteremos um único banco de dados PostgreSQL nesta fase
- **Isolamento Lógico:** Cada bounded context opera com schemas logicamente separados
- **Regras de Acesso:**
  - **Proibido:** JOINs diretos entre tabelas de bounded contexts distintos
  - **Permitido:** Materialização de dados via eventos ou APIs
  - **Naming Convention:** Tabelas prefixadas por contexto (ex: `propostas_`, `pagamentos_`, `usuarios_`)

### 4. API Unificada

- **Gateway Único:** Manteremos uma única API Gateway para o exterior
- **Organização Interna:** Rotas agrupadas por domínio (`/api/propostas/*`, `/api/pagamentos/*`)
- **Versionamento:** Preparado para versionamento independente por domínio

### 5. Observabilidade e Monitoramento

- **Correlation IDs:** Obrigatório em todas as operações inter-módulos
- **Métricas por Módulo:** Cada bounded context deve ter métricas isoladas
- **Logging Estruturado:** Com contexto de domínio em todos os logs

---

## O Anti-Padrão a Evitar (O Inimigo)

### Monólito Distribuído - Definição

Um **Monólito Distribuído** é uma arquitetura que possui as desvantagens tanto de monólitos quanto de microserviços:

- Múltiplos serviços que precisam ser implantados juntos
- Alta latência de comunicação sem benefícios de isolamento
- Complexidade operacional sem autonomia real das equipes
- Falhas em cascata sem resiliência real

### Como Nossos Princípios Previnem Este Anti-Padrão

1. **Desenvolvimento em Repositório Único:** Mantemos a simplicidade de coordenação até que a separação seja realmente necessária

2. **Interfaces Bem Definidas:** Quando migrarmos, as interfaces já estarão estabelecidas e testadas

3. **Comunicação Assíncrona:** Já teremos o padrão de comunicação resiliente implementado

4. **Isolamento de Dados:** A separação de schemas facilita a futura separação de bases de dados

5. **Métricas por Módulo:** Teremos dados objetivos sobre quais módulos realmente precisam ser extraídos

---

## Gatilhos de Migração para Microserviços (Os Sinais de Alerta)

### Gatilhos Técnicos

| Gatilho                     | Threshold                                          | Ação                                   |
| --------------------------- | -------------------------------------------------- | -------------------------------------- |
| **Tempo de Build CI/CD**    | > 15 minutos                                       | Avaliar extração do módulo mais pesado |
| **Contenção em Tabela**     | > 100ms p95 latência por lock contention           | Extrair domínio afetado                |
| **Divergência Tecnológica** | Módulo requer stack diferente (ex: Python para ML) | Extração imediata do módulo            |
| **Tamanho do Monólito**     | > 500k linhas de código                            | Avaliar decomposição                   |
| **Frequência de Deploy**    | Módulo específico precisa > 5 deploys/dia          | Considerar extração                    |
| **Consumo de Recursos**     | Módulo consome > 60% CPU/Memória                   | Isolar em serviço dedicado             |

### Gatilhos de Negócio/Equipe

| Gatilho                  | Threshold                                           | Ação                                  |
| ------------------------ | --------------------------------------------------- | ------------------------------------- |
| **Tamanho da Equipe**    | > 3 squads independentes                            | Iniciar planejamento de separação     |
| **Ciclos de Release**    | Módulos com ciclos incompatíveis (diário vs mensal) | Separar módulos com ciclos diferentes |
| **SLA Diferenciado**     | Módulo requer 99.99% vs 99.9% geral                 | Extrair para controle fino            |
| **Compliance/Regulação** | Requisitos de isolamento regulatório (ex: PCI-DSS)  | Extração mandatória                   |
| **Volume de Transações** | > 500 propostas/dia em módulo específico            | Avaliar extração para escalar         |
| **Parceiro Enterprise**  | Cliente requer API dedicada com SLA específico      | Considerar BFF ou serviço dedicado    |

### Processo de Decisão

Quando qualquer gatilho for atingido:

1. **Análise de Impacto:** Documentar custos e benefícios da extração
2. **Prova de Conceito:** Implementar extração em ambiente de staging
3. **Métricas de Validação:** Medir melhoria antes de promover para produção
4. **Extração Incremental:** Usar padrão Strangler Fig para migração gradual

---

## Consequências

### Positivas

- ✅ Máxima velocidade de desenvolvimento no curto prazo
- ✅ Complexidade operacional mínima
- ✅ Facilidade de refatoração entre bounded contexts
- ✅ Custo de infraestrutura otimizado
- ✅ Debugging e troubleshooting simplificados

### Negativas

- ⚠️ Risco de acoplamento se princípios não forem seguidos
- ⚠️ Escalabilidade limitada ao hardware único
- ⚠️ Deploys afetam todo o sistema
- ⚠️ Falha em um módulo pode afetar outros

### Mitigações

- Code reviews focados em verificar aderência aos princípios
- Testes de contrato entre módulos
- Feature flags para deploy seguro
- Circuit breakers internos entre módulos
- Monitoramento contínuo dos gatilhos definidos

---

## Revisões

| Data       | Autor                 | Mudanças       |
| ---------- | --------------------- | -------------- |
| 2025-08-22 | Equipe de Arquitetura | Versão inicial |

---

## Referências

- [Martin Fowler - MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)
- [Sam Newman - Monolith to Microservices](https://samnewman.io/books/monolith-to-microservices/)
- [Shopify - Deconstructing the Monolith](https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity)
- ADR-002: Primary Architectural Style (Monólito Modular)
- Doutrina Fase 1 - Ponto 9 (Modelagem DDD)
- Doutrina Fase 1 - Ponto 20 (Enforcement Automatizado)
