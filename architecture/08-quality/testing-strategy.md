# Estratégia de Testes do Projeto Simpix

## Visão Geral

Este documento estabelece a estratégia formal de testes para o projeto Simpix, definindo nossa abordagem à qualidade de software, padrões de teste e distribuição de esforços. Nossa filosofia é baseada na **prevenção de defeitos através de testes automatizados** e na **garantia de robustez progressiva** da base de código.

**Princípios Fundamentais:**

- **Fail Fast:** Detectar problemas o mais cedo possível no ciclo de desenvolvimento
- **Shift Left:** Integrar testes desde as primeiras fases do desenvolvimento
- **Automação Primeiro:** Priorizar testes automatizados sobre manuais
- **Isolamento Robusto:** Testes devem ser independentes e reproduzíveis
- **Segurança de Produção:** Proteção rigorosa contra execução acidental em produção

---

## 1. A Pirâmide de Testes Simpix

Nossa estratégia segue a **Pirâmide de Testes** clássica, otimizada para o contexto do projeto Simpix com arquitetura Domain-Driven Design (DDD).

### 1.1 Testes Unitários (Base da Pirâmide - 70%)

**Propósito:**

- Validar unidades isoladas de código (funções, métodos, classes)
- Garantir que a lógica de negócio funciona corretamente
- Detectar regressões rapidamente com execução em segundos

**Quando Usar:**

- **Lógica de Domínio Pura:** Agregados, Value Objects, Domain Services
- **Serviços de Aplicação:** Use Cases e orquestrações
- **Utilitários:** Funções auxiliares, validadores, transformadores
- **Componentes React:** Comportamento isolado de componentes UI

**Ferramentas:**

- **Vitest** - Test runner principal
- **@testing-library/react** - Testes de componentes React
- **@testing-library/jest-dom** - Matchers customizados para DOM

**Localização:** `tests/unit/`

**Exemplo de Estrutura:**

```
tests/unit/
├── domain/
│   ├── aggregates/
│   │   └── proposal.test.ts
│   └── services/
│       └── credit-analysis.test.ts
├── application/
│   └── proposal-service.test.ts
└── components/
    └── ProposalCard.test.tsx
```

### 1.2 Testes de Integração (Meio da Pirâmide - 25%)

**Propósito:**

- Validar interações entre componentes
- Testar endpoints de API completos
- Verificar integração com banco de dados
- Garantir que contratos entre camadas são respeitados

**Quando Usar:**

- **Endpoints de API:** Validação completa de rotas HTTP
- **Integração com Banco:** Operações CRUD reais
- **Fluxos de Autenticação:** Login, autorização, middlewares
- **Integrações Externas:** APIs de terceiros (Banco Inter, ClickSign)

**Ferramentas:**

- **Vitest** - Test runner
- **Supertest** - Testes HTTP/API
- **db-helper.ts** - Utilitário robusto para limpeza de dados

**Localização:** `tests/integration/`

**Características dos Nossos Testes de Integração:**

- **Proteção Tripla contra Produção:**
  - Validação `NODE_ENV === 'test'`
  - Exigência de `TEST_DATABASE_URL`
  - Detecção de padrões de URL de produção
- **Limpeza Automática:** `cleanTestDatabase()` com CASCADE
- **Setup Completo:** Criação de dados de teste realistas
- **Isolamento:** Cada teste executa em ambiente limpo

### 1.3 Testes de Ponta a Ponta - E2E (Topo da Pirâmide - 5%)

**Propósito:**

- Validar jornadas completas do usuário
- Testar o sistema como um todo (frontend + backend)
- Verificar funcionalidades críticas de negócio

**Estratégia Futura:**
Atualmente não implementado, mas planejamos adotar **Playwright** para:

- Fluxos críticos de criação de propostas
- Processo completo de análise de crédito
- Jornadas de pagamento e formalização
- Testes cross-browser em cenários de produção

**Quando Implementar:**

- **Fase 2** do roadmap arquitetural
- Após estabilização da base de testes unitários e integração
- Quando tivermos ambientes de staging estáveis

---

## 2. Metas de Cobertura de Código (Code Coverage)

### 2.1 Objetivos de Cobertura

**Para Código Novo (Obrigatório):**

- **Testes Unitários:** `≥ 85%` de cobertura de linha
- **Testes de Integração:** `≥ 75%` de cobertura de API endpoints
- **Cobertura Combinada:** `≥ 80%` do código total

**Para Código Legado (Melhoria Contínua):**

- **Meta Inicial:** `≥ 60%` de cobertura
- **Incremento Mensal:** `+5%` até atingir as metas de código novo
- **Priorização:** Funcionalidades críticas primeiro

### 2.2 Configuração Atual

Nossa configuração Vitest já inclui:

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  exclude: [
    "node_modules/",
    "dist/",
    "tests/setup.ts",
    "**/*.d.ts",
    "**/*.config.*"
  ],
}
```

### 2.3 Métricas de Acompanhamento

**Coverage Reports:**

- **Texto:** Feedback imediato no terminal
- **HTML:** Relatórios detalhados para revisão
- **JSON:** Integração com CI/CD pipeline

**Exclusões Justificadas:**

- Arquivos de configuração (`*.config.*`)
- Definições de tipos (`*.d.ts`)
- Setup de testes (`tests/setup.ts`)
- Dependências externas (`node_modules/`)

---

## 3. Estratégia de Testes de Contrato

### 3.1 Consumer-Driven Contract Testing (CDC)

**Justificativa:**
O Simpix integra com múltiplas APIs externas críticas. Testes de contrato garantem que mudanças em APIs não quebrem nossas integrações.

**Integrações Críticas Identificadas:**

- **Banco Inter API:** Geração de boletos e PIX
- **ClickSign API:** Assinaturas eletrônicas
- **Supabase API:** Autenticação e dados
- **APIs Internas:** Comunicação entre microserviços (futuro)

### 3.2 Implementação Planejada

**Ferramenta Escolhida:** **Pact**

- Padrão da indústria para CDC testing
- Suporte robusto para TypeScript
- Integração com CI/CD pipelines
- Documentação automática de contratos

**Roadmap de Implementação:**

1. **Fase 1** (Q4 2025): Implementar Pact para Banco Inter
2. **Fase 2** (Q1 2026): Adicionar ClickSign e Supabase
3. **Fase 3** (Q2 2026): Expandir para APIs internas

**Estrutura Planejada:**

```
tests/contracts/
├── banco-inter/
│   ├── boleto.contract.test.ts
│   └── pix.contract.test.ts
├── clicksign/
│   └── signature.contract.test.ts
└── pacts/
    └── generated-contracts/
```

### 3.3 Benefícios Esperados

- **Detecção Precoce:** Quebras de contrato identificadas antes da produção
- **Documentação Viva:** Contratos servem como documentação atualizada
- **Independência de Desenvolvimento:** Times podem evoluir APIs independentemente
- **Confiança em Atualizações:** Deploy seguro com validação automática

---

## 4. Estratégia de Testes de Mutação

### 4.1 Conceito e Objetivo

**Mutation Testing** valida a **eficácia** da nossa suíte de testes através de:

- Introdução de mutações (alterações) propositais no código
- Verificação se os testes detectam essas mutações
- Identificação de "código morto" ou testes inadequados

**Meta de Mutation Score:** `≥ 75%` (percentual de mutações detectadas)

### 4.2 Implementação Futura

**Ferramenta Planejada:** **Stryker.js**

- Suporte nativo para TypeScript e Vitest
- Relatórios detalhados de mutações
- Integração com pipelines CI/CD
- Configuração granular por diretório

**Roadmap:**

1. **Q2 2026:** Implementação piloto em módulos críticos
2. **Q3 2026:** Expansão gradual para toda a base de código
3. **Q4 2026:** Integração no pipeline de CI obrigatório

**Foco Inicial:**

- **Lógica de Domínio:** Agregados e serviços críticos
- **Cálculos Financeiros:** TAC, IOF, juros, parcelas
- **Validações de Negócio:** Regras de aprovação de crédito

### 4.3 Benefícios Esperados

- **Qualidade dos Testes:** Identificar testes superficiais ou redundantes
- **Confiança:** Garantir que alterações no código são detectadas
- **Evolução:** Base de código mais robusta e resistente a bugs

---

## 5. Estratégia de Testes em Produção

### 5.1 Testing in Production com Feature Flags

**Aproveitando a Infraestrutura Existente:**
O Simpix já possui um sistema robusto de Feature Flags (Unleash) que habilita testes seguros em produção.

**Feature Flags Implementadas:**

```typescript
{
  "maintenance-mode": false,
  "read-only-mode": false,
  "novo-dashboard": false,
  "pagamento-pix-instant": false,
  "relatorios-avancados": false,
  "ab-test-onboarding": false,
  "nova-api-experimental": false
}
```

### 5.2 Estratégias de Testing in Production

#### 5.2.1 Canary Releases

- **Rollout Gradual:** Novos recursos para % pequeno de usuários
- **Monitoramento:** Métricas de performance e erro em tempo real
- **Rollback Automático:** Reversão imediata se anomalias detectadas

#### 5.2.2 A/B Testing

- **Comparação Controlada:** Versões A vs B com grupos de usuários
- **Métricas de Negócio:** Taxa de conversão, satisfação, performance
- **Decisões Data-Driven:** Escolha baseada em dados reais

#### 5.2.3 Dark Launching

- **Código Novo em Paralelo:** Execução silenciosa sem impacto no usuário
- **Validação de Performance:** Testes de carga reais
- **Debugging Seguro:** Logs e métricas sem afetar a experiência

### 5.3 Implementação Progressiva

**Fase 1 - Canary Releases (Q1 2026):**

- Implementar rollout gradual para novas funcionalidades
- Integrar com Sentry para monitoramento de erros
- Configurar alertas automáticos para métricas críticas

**Fase 2 - A/B Testing (Q2 2026):**

- Implementar framework de A/B testing
- Definir métricas de sucesso para cada feature
- Criar dashboard para acompanhamento de resultados

**Fase 3 - Observabilidade Avançada (Q3 2026):**

- Health checks automatizados
- Synthetic monitoring
- User journey monitoring

### 5.4 Segurança e Governança

**Proteções Implementadas:**

- **Circuit Breaker:** Isolamento automático de falhas
- **Rate Limiting:** Proteção contra sobrecarga
- **Rollback Automatizado:** Reversão baseada em thresholds

**Aprovação de Produção:**

- Código review obrigatório
- Aprovação de arquiteto sênior para flags críticas
- Documentação de plano de rollback

---

## 6. Ferramentas e Configuração

### 6.1 Stack de Testes Atual

**Test Runner:**

- **Vitest** - Rápido, TypeScript nativo, hot reload

**Testes de API:**

- **Supertest** - HTTP assertions, integração com Express

**Testes Frontend:**

- **@testing-library/react** - Testing utilities para React
- **@testing-library/jest-dom** - Custom matchers para DOM
- **@testing-library/user-event** - Simulação de interações

**Utilitários:**

- **db-helper.ts** - Limpeza robusta de banco de dados
- **auth-helper.ts** - Utilitários de autenticação para testes

### 6.2 Configuração de Ambiente

**Environment Variables Obrigatórias:**

```bash
NODE_ENV=test
TEST_DATABASE_URL=postgresql://...
DATABASE_URL=postgresql://test-db...
```

**Proteções de Segurança:**

- Validação de ambiente antes da execução
- Rejeição de padrões de produção em URLs
- Logs de segurança para execuções suspeitas

### 6.3 Scripts de Teste

**Comandos Disponíveis:**

```bash
npm run test              # Executa todos os testes
npm run test:unit         # Apenas testes unitários
npm run test:integration  # Apenas testes de integração
npm run test:coverage     # Gera relatório de cobertura
npm run test:watch        # Modo watch para desenvolvimento
```

---

## 7. Métricas e Monitoramento

### 7.1 KPIs de Qualidade

**Métricas Principais:**

- **Coverage Percentage:** Meta ≥ 80%
- **Test Execution Time:** < 30 segundos para unit, < 5 minutos para integration
- **Flaky Test Rate:** < 2% de testes instáveis
- **Mean Time to Detection (MTTD):** < 5 minutos
- **Mean Time to Recovery (MTTR):** < 15 minutos

**Métricas de Regressão:**

- **Bug Escape Rate:** < 5% bugs chegando à produção
- **Test Maintenance Effort:** < 20% do tempo de desenvolvimento
- **False Positive Rate:** < 3% de falsos alarmes

### 7.2 Relatórios e Dashboards

**Relatórios Automatizados:**

- Coverage reports HTML gerados a cada commit
- Relatórios de performance de testes no CI/CD
- Alertas por email para quedas significativas de coverage

**Integração com Sentry:**

- Tracking de erros em testes
- Performance monitoring
- Release health monitoring

---

## 8. Próximos Passos e Roadmap

### 8.1 Prioridades Imediatas (Q4 2025)

1. **Aumentar Coverage:** Atingir 80% em módulos críticos
2. **Documentar Padrões:** Criar templates para novos testes
3. **CI/CD Integration:** Bloquear merges com coverage < meta
4. **Performance Optimization:** Acelerar execução de testes

### 8.2 Evoluções Futuras (2026)

**Q1 2026:** Contract Testing com Pact
**Q2 2026:** Mutation Testing com Stryker
**Q3 2026:** E2E Testing com Playwright
**Q4 2026:** Testing in Production maduro

### 8.3 Investimento em Tooling

- **Pact:** CDC testing para APIs externas
- **Stryker.js:** Mutation testing
- **Playwright:** E2E testing
- **Dashboards:** Métricas centralizadas de qualidade

---

## 9. Conclusão

Nossa estratégia de testes do Simpix estabelece uma base sólida para qualidade de software progressiva e sustentável. Com foco em:

- **Automação máxima** para eficiência
- **Proteção rigorosa** contra execução em produção
- **Evolução gradual** da cobertura e sofisticação
- **Integração com arquitetura DDD** para alinhamento com design

Esta estratégia nos posiciona para:
✅ **Detecção precoce** de defeitos  
✅ **Deploy confiante** com testes robustos  
✅ **Evolução segura** da base de código  
✅ **Experiência de usuário** consistente  
✅ **Preparação para migração Azure** com confidence

**Próxima revisão:** Q2 2026 ou após implementação de CDC testing.

---

_Documento criado em: 21 de Agosto de 2025_  
_Versão: 1.0_  
_Autor: GEM-07 AI Specialist System_  
_Aprovação pendente: Arquiteto Chefe_
