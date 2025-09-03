# Blueprint Estratégico e Arquitetural do Projeto Simpix

**Versão:** 2.0  
**Data:** 03 de Setembro de 2025  
**Autor:** Simpix Development Team  
**Status:** Fundacional  

---

## 1. Visão da Missão e Intenção Estratégica

### 1.1. Problema de Negócio

O setor financeiro brasileiro enfrenta desafios críticos na gestão de propostas de crédito que impactam diretamente a competitividade e rentabilidade das instituições. O problema fundamental que o Simpix se propõe a resolver é a **fragmentação e ineficiência do workflow de propostas de crédito** em instituições financeiras.

**Contexto Detalhado:**

As instituições financeiras brasileiras operam em um mercado altamente regulamentado pelo Banco Central, onde a velocidade de decisão e a qualidade da análise de risco são fatores determinantes para o sucesso. Atualmente, essas instituições enfrentam:

1. **Fragmentação de Sistemas**: Dados de clientes, produtos financeiros, tabelas comerciais e análises de risco residem em sistemas isolados, exigindo integração manual e propensa a erros.

2. **Ineficiência Operacional**: O processo de criação, análise e aprovação de propostas de crédito envolve múltiplos stakeholders (atendentes, analistas, gerentes) sem um fluxo unificado, resultando em gargalos e tempo de resposta elevado.

3. **Complexidade Regulatória**: A necessidade de cumprir regulamentações como a Lei de Juros (Lei 1.521/51), Código de Defesa do Consumidor e normativas do BACEN sobre transparência na oferta de crédito adiciona camadas de complexidade que não são adequadamente gerenciadas por soluções tradicionais.

4. **Ausência de Rastreabilidade**: A falta de auditoria completa das decisões e modificações em propostas cria riscos de compliance e dificulta a identificação de padrões de aprovação/rejeição.

5. **Cálculos Financeiros Inconsistentes**: Instituições utilizam planilhas ou sistemas legados que não implementam corretamente fórmulas como CET (Custo Efetivo Total), IOF e TAC, criando riscos regulatórios e perda de margem.

**Impacto Quantificado:**

- **Tempo médio de processamento:** 3-7 dias úteis para propostas simples
- **Taxa de erro manual:** 15-20% em cálculos financeiros
- **Custo operacional:** R$ 50-80 por proposta processada
- **Taxa de abandono do cliente:** 30-40% devido ao tempo de resposta

### 1.2. Solução Proposta

O Simpix é uma **plataforma de automação de workflow de propostas de crédito** construída especificamente para instituições financeiras brasileiras, oferecendo uma solução integrada que aborda diretamente cada faceta do problema identificado.

**Arquitetura da Solução:**

**1. Motor de Simulação de Crédito Bancário:**
- API RESTful para cálculo em tempo real de CET, IOF, TAC utilizando algoritmos bancários padrão (Newton-Raphson para CET)
- Integração com tabelas comerciais dinâmicas com suporte a hierarquia de fallback (produto-específico → geral)
- Validação automática de limites regulatórios e políticas de crédito

**2. Sistema de Gestão de Propostas com FSM (Finite State Machine):**
- Estados definidos: RASCUNHO → EM_ANALISE → PENDENTE → APROVADA/REJEITADA → FORMALIZADA
- Transições controladas com validação de negócio e logs de auditoria
- Interface específica para cada tipo de usuário (atendente, analista, gerente)

**3. Geração Automatizada de CCB (Cédula de Crédito Bancário):**
- Templates parametrizáveis compatíveis com lei bancária brasileira
- Geração PDF com assinatura digital integrada
- Versionamento e controle de alterações pós-geração

**4. Sistema de Pagamento e Formalização:**
- Integração com APIs bancárias para geração automática de boletos e PIX
- Workflow de acompanhamento de pagamento com notificações
- Batch processing para processamento em lote de operações

**5. Módulo de Segurança Bancária:**
- Row Level Security (RLS) no PostgreSQL para isolamento de dados por instituição
- Sistema RBAC (Role-Based Access Control) anti-frágil com auditoria completa
- Criptografia de dados sensíveis e proteção contra timing attacks

**Diferenciação Competitiva:**

- **Banking-Grade Security**: Segurança equivalente a sistemas core bancários
- **Compliance First**: Projetado desde o início para atender regulamentações brasileiras
- **API-First Architecture**: Permite integração com sistemas legados via APIs RESTful
- **Real-time Processing**: Cálculos financeiros e validações em tempo real
- **Audit-Complete**: Rastreabilidade total de todas as operações para compliance

### 1.3. Métricas de Sucesso (KPIs)

**North Star Metric:** **Tempo Médio de Processamento de Proposta (TMP)**  
Esta métrica representa o valor central entregue para as instituições financeiras - a capacidade de processar propostas de crédito com velocidade e precisão bancária.

**Meta:** Reduzir TMP de 3-7 dias para 2-4 horas (redução de 85-90%).

**KPIs Primários:**

1. **Taxa de Conversão de Propostas (TCP)**
   - **Definição:** Percentual de propostas criadas que são aprovadas e formalizadas
   - **Meta:** ≥ 75% (benchmark atual: 45-60%)
   - **Fórmula:** (Propostas Formalizadas / Propostas Criadas) × 100

2. **Precisão de Cálculos Financeiros (PCF)**
   - **Definição:** Percentual de cálculos financeiros (CET, IOF, TAC) executados sem erro
   - **Meta:** 99.95% (Six Sigma)
   - **Fórmula:** (Cálculos Corretos / Total de Cálculos) × 100

3. **Tempo de Primeira Resposta (TPR)**
   - **Definição:** Tempo médio entre submissão da proposta e primeira análise
   - **Meta:** ≤ 4 horas
   - **Medição:** Timestamp análise - timestamp submissão

4. **Custo Operacional por Proposta (COP)**
   - **Definição:** Custo total (personnel + sistema) por proposta processada
   - **Meta:** ≤ R$ 20 (redução de 60-75%)
   - **Cálculo:** (Custos Operacionais Mensais / Propostas Processadas)

**KPIs Secundários:**

1. **Taxa de Conformidade Regulatória (TCR)**
   - **Definição:** Percentual de propostas que passam em auditorias regulatórias
   - **Meta:** 100%
   - **Monitoramento:** Validação automática de todas as normas BACEN aplicáveis

2. **Disponibilidade do Sistema (SLA)**
   - **Definição:** Uptime do sistema durante horário comercial
   - **Meta:** 99.9% (8.76 horas de downtime/ano)
   - **Medição:** Monitoramento contínuo via health checks

3. **Taxa de Adoção por Usuário (TAU)**
   - **Definição:** Percentual de usuários ativos semanalmente
   - **Meta:** ≥ 85%
   - **Fórmula:** (Weekly Active Users / Total Users) × 100

4. **Índice de Satisfação do Usuário (ISU)**
   - **Definição:** Score médio de satisfação em pesquisas trimestrais
   - **Meta:** ≥ 4.5/5.0
   - **Metodologia:** NPS (Net Promoter Score) + CSAT

**KPIs de Inovação:**

1. **Velocidade de Feature Deployment**
   - **Meta:** ≤ 24 horas da aprovação à produção
   - **Medição:** CI/CD pipeline metrics

2. **Taxa de Rollback**
   - **Meta:** ≤ 2% de deployments
   - **Objetivo:** Garantir qualidade e estabilidade

## 2. Princípios Arquiteturais Core

### 2.1. Segurança por Padrão (Security by Default)

A arquitetura do Simpix adota uma postura de **"confiança zero" (Zero Trust)** apropriada para aplicações que manipulam dados financeiros sensíveis. Esta filosofia permeia todos os níveis da aplicação, desde o design do banco de dados até a interface do usuário.

**Implementação Estratificada:**

**Nível 1: Database Security**
- **Row Level Security (RLS):** Ativado em todas as tabelas do PostgreSQL, garantindo que usuários só acessem dados de sua instituição
- **Políticas de Acesso Granular:** Definidas via SQL policies que verificam `user_metadata.instituicao_id`
- **Auditoria Completa:** Trigger functions que registram todas as operações (INSERT, UPDATE, DELETE) com timestamp, usuário e dados alterados
- **Encryption at Rest:** Dados sensíveis (CPF, dados bancários) criptografados usando PostgreSQL pgcrypto

```sql
-- Exemplo de RLS Policy
CREATE POLICY propostas_isolation ON propostas
    FOR ALL TO authenticated
    USING (
        instituicao_id = (auth.jwt() ->> 'instituicao_id')::uuid
    );
```

**Nível 2: API Security**
- **JWT Validation:** Todos os endpoints requerem tokens JWT válidos com claims específicos
- **Rate Limiting Tier-2:** Limite por usuário (100 req/min) + limite por instituição (10k req/min)
- **Input Sanitization:** Validação e sanitização via Zod schemas antes de qualquer processamento
- **CORS Restritivo:** Configurado apenas para domínios autorizados da instituição

**Nível 3: Business Logic Security**
- **RBAC Anti-Frágil:** Sistema de permissões que falha de forma segura (deny by default)
- **Timing Attack Prevention:** Operações críticas (login, validação) utilizam tempo constante
- **UUID Cryptographically Secure:** Geração via crypto.randomUUID() para prevenção de ataques de enumeração

**Nível 4: Frontend Security**
- **CSP (Content Security Policy):** Headers restritivos que previnem XSS
- **Secure Cookies:** HttpOnly, Secure, SameSite=Strict para todos os cookies de sessão
- **Client-Side Validation + Server-Side Enforcement:** Validação dupla para prevenção de bypass

### 2.2. Estado Atômico e Previsível

Para o gerenciamento de estado no frontend, adotamos **TanStack Query** (anteriormente React Query) combinado com **useReducer** para estado local complexo. Esta decisão arquitetural garante previsibilidade e performance.

**Filosofia de Decomposição Atômica:**

**1. Server State Segregation:**
- **TanStack Query:** Gerencia exclusivamente dados do servidor (propostas, clientes, produtos)
- **Invalidação Inteligente:** Cache invalidation baseada em relacionamentos de dados
- **Optimistic Updates:** Para operações críticas como status de proposta

```typescript
// Exemplo de Query Key Strategy
const proposalQueries = {
  all: ['proposals'] as const,
  lists: () => [...proposalQueries.all, 'list'] as const,
  list: (filters: ProposalFilters) => [...proposalQueries.lists(), filters] as const,
  details: () => [...proposalQueries.all, 'detail'] as const,
  detail: (id: string) => [...proposalQueries.details(), id] as const,
}
```

**2. Local State Management:**
- **useReducer:** Para state machines complexos (formulário multi-step, wizard)
- **useState:** Para state simples e isolado
- **Compound Components:** Para state sharing entre componentes relacionados

**3. Performance Optimization:**
- **React.memo + useMemo:** Prevenção de re-renders desnecessários
- **Code Splitting:** Lazy loading de rotas e componentes pesados
- **Virtual Scrolling:** Para listas grandes (milhares de propostas)

### 2.3. API-First e Contratos Claros

A comunicação entre frontend e backend é governada por **contratos estritamente tipados** usando TypeScript e validação runtime via Zod.

**Estratégia de Contrato:**

**1. Schema-Driven Development:**
```typescript
// shared/schemas/proposal.ts
export const ProposalCreateSchema = z.object({
  cliente_id: z.string().uuid(),
  produto_id: z.number().int().positive(),
  valor: z.number().positive().max(5000000), // R$ 5M limite
  prazo: z.number().int().min(6).max(360), // 6-360 meses
  finalidade: z.enum(['capital_giro', 'investimento', 'quitacao']),
  garantia: z.enum(['sem_garantia', 'aval', 'alienacao_fiduciaria'])
})

export type ProposalCreate = z.infer<typeof ProposalCreateSchema>
```

**2. Error Handling Strategy:**
- **Status Codes Semânticos:** 400 (validation), 401 (auth), 403 (permission), 409 (business rule), 422 (data conflict)
- **Structured Error Responses:** Formato consistente com código, mensagem e detalhes
- **Business Rule Validation:** Separação clara entre validation errors e business logic errors

**3. Versioning Strategy:**
- **Semantic Versioning:** `/api/v1/`, `/api/v2/` para breaking changes
- **Backward Compatibility:** Manutenção de versões antigas por 12 meses
- **Feature Flags:** Para soft rollout de novas funcionalidades

### 2.4. Developer Experience (DX) as a Priority

A experiência do desenvolvedor é tratada como requisito não-funcional crítico, impactando diretamente a velocidade de desenvolvimento e qualidade do código.

**Ferramental de Produtividade:**

**1. Type Safety End-to-End:**
- **TypeScript Strict Mode:** Configuração restritiva que captura erros sutis
- **Drizzle ORM:** Type-safe database queries com schema inference
- **Zod:** Runtime validation que mantém consistência com tipos TypeScript

**2. Development Environment:**
- **Vite HMR:** Hot Module Replacement para feedback instantâneo
- **Docker Compose:** Ambiente de desenvolvimento padronizado e reproduzível
- **GitHub Codespaces:** Desenvolvimento cloud para onboarding zero-friction

**3. Code Quality Automation:**
- **ESLint + Prettier:** Linting e formatação automática
- **Husky + lint-staged:** Pre-commit hooks que garantem qualidade
- **SonarQube Integration:** Análise contínua de code coverage e complexity

**4. Testing Strategy:**
- **Vitest:** Unit tests com native ESM support
- **Playwright:** E2E tests com trace viewer para debugging
- **MSW:** API mocking para testes determinísticos

## 3. A "Golden Stack" Detalhada

### 3.1. Framework Full-Stack: React + Express.js

**Justificativa Estratégica:**

A escolha de React + Express.js sobre frameworks full-stack mais opinionados (como Next.js ou Remix) foi deliberada, priorizando **flexibilidade arquitetural** e **separação clara de responsabilidades**.

**React Frontend:**

**Vantagens Específicas para Simpix:**
- **Ecosistema Maduro:** Vasta biblioteca de componentes financeiros (recharts para gráficos, react-hook-form para formulários complexos)
- **Performance Crítica:** Virtual DOM e reconciliation algorithm otimizados para updates frequentes (status de propostas em tempo real)
- **Testabilidade:** Testing Library ecosystem bem estabelecido para testes de componentes críticos

**Arquitetura de Componentes:**
```
src/
├── components/
│   ├── ui/              # Componentes básicos (button, input, modal)
│   ├── forms/           # Formulários complexos com validação
│   ├── propostas/       # Componentes específicos do domínio
│   └── shared/          # Componentes reutilizáveis
├── pages/
│   ├── propostas/       # Rotas do módulo propostas
│   ├── clientes/        # Rotas do módulo clientes
│   └── admin/           # Rotas administrativas
├── hooks/               # Custom hooks para lógica reutilizável
├── utils/               # Utilitários e helpers
└── types/               # Type definitions compartilhadas
```

**Express.js Backend:**

**Vantagens Específicas para Simpix:**
- **Middleware Ecosystem:** Helmet para security headers, express-rate-limit para proteção DDoS
- **Performance:** V8 optimization para cálculos financeiros intensivos
- **Integration Flexibility:** Facilita integração com sistemas bancários legados via middleware customizado

**Arquitetura Modular:**
```
server/
├── modules/
│   ├── proposal/
│   │   ├── domain/          # Entities, Value Objects, Domain Services
│   │   ├── application/     # Use Cases, Application Services
│   │   ├── infrastructure/  # Repository implementations, External APIs
│   │   └── presentation/    # Controllers, DTOs
│   ├── cliente/
│   └── financial/
├── shared/
│   ├── domain/             # Shared domain concepts
│   ├── infrastructure/     # Shared infrastructure (database, logger)
│   └── application/        # Shared application services
└── routes/                 # Route definitions and middleware
```

### 3.2. Backend as a Service: Supabase

**Justificativa Estratégica:**

Supabase foi selecionado por ser uma **alternativa open-source** ao Firebase, construída sobre PostgreSQL, eliminando vendor lock-in enquanto fornece funcionalidades enterprise necessárias para aplicações financeiras.

**Componentes Utilizados:**

**1. PostgreSQL Database:**
- **ACID Compliance:** Garantias transacionais críticas para operações financeiras
- **Row Level Security:** Isolamento nativo multi-tenant sem overhead de aplicação
- **Extensions:** pgcrypto para criptografia, uuid-ossp para UUIDs seguros

**2. Authentication System:**
- **JWT-based:** Stateless authentication compatível com microservices
- **MFA Support:** Two-factor authentication para usuários privilegiados
- **Custom Claims:** Metadata específico da instituição injetado no token

**3. Storage System:**
- **Bucket Policies:** Controle granular de acesso a documentos (CCBs, comprovantes)
- **CDN Integration:** Distribuição global de assets estáticos
- **Automatic Backup:** Retenção de 30 dias para documentos críticos

**4. Edge Functions:**
- **Real-time Webhooks:** Notificações instantâneas de mudanças de status
- **Background Jobs:** Processamento assíncrono de geração de documentos
- **API Gateway:** Rate limiting e authentication centralizada

**Configuração de Segurança:**
```sql
-- RLS Policy para Isolamento Multi-tenant
CREATE POLICY "Usuários acessam apenas dados de sua instituição"
ON propostas FOR ALL TO authenticated
USING (
  instituicao_id = (
    SELECT metadata->>'instituicao_id'::uuid 
    FROM auth.users 
    WHERE id = auth.uid()
  )
);
```

### 3.3. Linguagem: TypeScript

**Justificativa Estratégica:**

TypeScript é **inegociável** para aplicações financeiras devido aos requisitos de **precisão, manutenibilidade e debugging** inerentes ao domínio.

**Configuração Enterprise:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true
  }
}
```

**Type System Strategy:**

**1. Domain Modeling:**
```typescript
// Value Objects com validação em runtime
export class Money {
  private constructor(private readonly _value: number) {
    if (_value < 0) throw new Error('Money cannot be negative')
    if (_value > 100_000_000) throw new Error('Money exceeds maximum')
  }
  
  static fromReais(value: number): Money {
    return new Money(Math.round(value * 100) / 100) // Precisão decimal
  }
  
  getReais(): number { return this._value }
  getCentavos(): number { return Math.round(this._value * 100) }
}

// Branded Types para prevenção de erros
type ProposalId = string & { readonly brand: unique symbol }
type ClienteId = string & { readonly brand: unique symbol }
```

**2. API Contract Enforcement:**
```typescript
// Schema-first API development
export const ApiResponseSchema = <T>(dataSchema: z.ZodSchema<T>) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional()
  }).optional()
})
```

### 3.4. Estilização: TailwindCSS

**Justificativa Estratégica:**

TailwindCSS foi adotado por sua **filosofia utility-first** que se alinha perfeitamente com os requisitos de **consistency, maintainability e developer velocity** do Simpix.

**Benefícios Específicos para Aplicações Financeiras:**

**1. Design System Enforcement:**
```typescript
// Configuração customizada para branding financeiro
module.exports = {
  theme: {
    extend: {
      colors: {
        'financial': {
          primary: '#1e3a8a',   // Azul confiável
          success: '#059669',   // Verde aprovação
          warning: '#d97706',   // Laranja pendência
          danger: '#dc2626',    // Vermelho rejeição
        }
      },
      spacing: {
        '18': '4.5rem',        // Espaçamento específico para cards
        '88': '22rem',         // Largura padrão de formulários
      }
    }
  }
}
```

**2. Component Reusability:**
```tsx
// Button component com variants financeiros
const Button = cva("inline-flex items-center justify-center rounded-md text-sm font-medium", {
  variants: {
    variant: {
      approve: "bg-financial-success hover:bg-financial-success/90 text-white",
      reject: "bg-financial-danger hover:bg-financial-danger/90 text-white",
      pending: "bg-financial-warning hover:bg-financial-warning/90 text-white",
    },
    size: {
      default: "h-10 px-4 py-2",
      lg: "h-11 rounded-md px-8",
    }
  }
})
```

**3. Responsive Financial Dashboard:**
```tsx
// Layout responsivo otimizado para dashboards financeiros
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  <MetricCard 
    title="Propostas Pendentes" 
    value={pendingCount}
    className="col-span-1"
  />
  <ChartCard 
    title="Volume por Mês"
    className="col-span-full lg:col-span-2"
  />
</div>
```

### 3.5. Estratégia de Testes: Vitest & Playwright

**Justificativa Estratégica:**

Para aplicações financeiras, a estratégia de testes deve cobrir **todos os cenários críticos** com alta confiabilidade e execução rápida durante o desenvolvimento.

**Pirâmide de Testes Financeiros:**

**1. Unit Tests (Vitest) - 70%:**
```typescript
// Testes de cálculos financeiros críticos
describe('Financial Calculations', () => {
  test('CET calculation precision', () => {
    const proposal = new Proposal({
      valor: Money.fromReais(100000),
      prazo: 36,
      taxaJuros: 2.5
    })
    
    const cet = proposal.calculateCET()
    expect(cet.getPercentual()).toBeCloseTo(31.17, 2) // Precisão decimal crítica
  })
  
  test('IOF calculation for different terms', () => {
    const scenarios = [
      { prazo: 12, expectedIOF: 3.38 },
      { prazo: 24, expectedIOF: 6.38 },
      { prazo: 36, expectedIOF: 9.38 }
    ]
    
    scenarios.forEach(({ prazo, expectedIOF }) => {
      const iof = calculateIOF(Money.fromReais(50000), prazo)
      expect(iof.getReais()).toBeCloseTo(expectedIOF, 2)
    })
  })
})
```

**2. Integration Tests (Vitest) - 20%:**
```typescript
// Testes de fluxo completo de proposta
describe('Proposal Workflow', () => {
  test('complete proposal flow', async () => {
    const client = await testDb.createClient()
    const proposal = await proposalService.create({
      clienteId: client.id,
      valor: 100000,
      prazo: 36
    })
    
    expect(proposal.status).toBe('RASCUNHO')
    
    await proposalService.submitForAnalysis(proposal.id)
    expect(proposal.status).toBe('EM_ANALISE')
    
    await proposalService.approve(proposal.id, 'analista-id')
    expect(proposal.status).toBe('APROVADA')
  })
})
```

**3. E2E Tests (Playwright) - 10%:**
```typescript
// Testes de cenários críticos do usuário
test('Analyst can approve proposal with complex conditions', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[data-testid=email-input]', 'analista@instituicao.com')
  await page.fill('[data-testid=password-input]', 'senha123')
  await page.click('[data-testid=login-button]')
  
  await page.goto('/propostas/pendentes')
  await page.click('[data-testid=proposal-123]')
  
  // Verificar dados críticos
  await expect(page.locator('[data-testid=valor-proposta]')).toContainText('R$ 100.000,00')
  await expect(page.locator('[data-testid=cet-calculado]')).toContainText('31,17%')
  
  // Aprovar proposta
  await page.click('[data-testid=approve-button]')
  await page.fill('[data-testid=observacoes-aprovacao]', 'Cliente com bom histórico')
  await page.click('[data-testid=confirm-approval]')
  
  // Verificar mudança de status
  await expect(page.locator('[data-testid=status-proposta]')).toContainText('APROVADA')
})
```

**4. Performance Tests:**
```typescript
// Testes de performance para cálculos em lote
test('bulk calculation performance', async () => {
  const startTime = performance.now()
  
  const proposals = Array.from({ length: 1000 }, (_, i) => ({
    valor: Money.fromReais(50000 + i * 1000),
    prazo: 12 + (i % 24),
    taxaJuros: 2.0 + (i % 3) * 0.5
  }))
  
  const results = await Promise.all(
    proposals.map(p => financialCalculator.calculateCET(p))
  )
  
  const endTime = performance.now()
  const duration = endTime - startTime
  
  expect(duration).toBeLessThan(1000) // Máximo 1 segundo para 1000 cálculos
  expect(results).toHaveLength(1000)
  expect(results.every(r => r.isValid())).toBe(true)
})
```

## 4. Diagrama de Entidade-Relacionamento (ERD) do Banco de Dados

### 4.1. Representação Textual (Código SQL `CREATE TABLE`)

O schema do banco de dados do Simpix foi projetado para suportar **multi-tenancy seguro**, **auditoria completa** e **performance bancária**.

```sql
-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função para trigger de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================================================
-- TABELAS DE CONFIGURAÇÃO E AUTENTICAÇÃO
-- =============================================================================

-- Tabela de instituições (multi-tenancy)
CREATE TABLE instituicoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razao_social TEXT NOT NULL CHECK (char_length(razao_social) >= 3),
    cnpj TEXT UNIQUE NOT NULL CHECK (cnpj ~ '^\d{14}$'),
    codigo_bacen TEXT UNIQUE CHECK (codigo_bacen ~ '^\d{3,5}$'),
    endereco JSONB,
    contato JSONB,
    configuracoes JSONB DEFAULT '{}',
    ativa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE instituicoes IS 'Instituições financeiras que utilizam o sistema (multi-tenant isolation)';
COMMENT ON COLUMN instituicoes.configuracoes IS 'Configurações específicas da instituição (limites, políticas, etc.)';

-- Trigger para updated_at
CREATE TRIGGER update_instituicoes_updated_at 
    BEFORE UPDATE ON instituicoes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabela de usuários (integração com Supabase Auth)
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instituicao_id UUID NOT NULL REFERENCES instituicoes(id) ON DELETE CASCADE,
    auth_user_id UUID UNIQUE, -- Referência para auth.users do Supabase
    email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    nome_completo TEXT NOT NULL CHECK (char_length(nome_completo) >= 2),
    papel TEXT NOT NULL CHECK (papel IN ('atendente', 'analista', 'gerente', 'admin')),
    ativo BOOLEAN NOT NULL DEFAULT true,
    ultimo_acesso TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(instituicao_id, email)
);
COMMENT ON TABLE usuarios IS 'Usuários do sistema com controle de acesso baseado em papel';
COMMENT ON COLUMN usuarios.papel IS 'Define as permissões: atendente < analista < gerente < admin';
COMMENT ON COLUMN usuarios.metadata IS 'Dados adicionais específicos do usuário (preferências, configurações)';

CREATE TRIGGER update_usuarios_updated_at 
    BEFORE UPDATE ON usuarios 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_usuarios_instituicao_id ON usuarios(instituicao_id);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_papel ON usuarios(papel);

-- =============================================================================
-- TABELAS DE PRODUTO E CONFIGURAÇÃO COMERCIAL
-- =============================================================================

-- Tabela de produtos financeiros
CREATE TABLE produtos (
    id SERIAL PRIMARY KEY,
    instituicao_id UUID NOT NULL REFERENCES instituicoes(id) ON DELETE CASCADE,
    nome TEXT NOT NULL CHECK (char_length(nome) >= 2),
    descricao TEXT,
    tipo_produto TEXT NOT NULL CHECK (tipo_produto IN ('credito_pessoal', 'credito_consignado', 'financiamento_veiculo', 'capital_giro')),
    valor_minimo DECIMAL(15,2) NOT NULL CHECK (valor_minimo > 0),
    valor_maximo DECIMAL(15,2) NOT NULL CHECK (valor_maximo >= valor_minimo),
    prazo_minimo INTEGER NOT NULL CHECK (prazo_minimo > 0),
    prazo_maximo INTEGER NOT NULL CHECK (prazo_maximo >= prazo_minimo),
    taxa_minima DECIMAL(8,4) NOT NULL CHECK (taxa_minima >= 0),
    taxa_maxima DECIMAL(8,4) NOT NULL CHECK (taxa_maxima >= taxa_minima),
    ativo BOOLEAN NOT NULL DEFAULT true,
    configuracoes JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(instituicao_id, nome)
);
COMMENT ON TABLE produtos IS 'Produtos financeiros oferecidos por cada instituição';
COMMENT ON COLUMN produtos.configuracoes IS 'Configurações específicas do produto (regras de negócio, validações)';

CREATE TRIGGER update_produtos_updated_at 
    BEFORE UPDATE ON produtos 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabela de tabelas comerciais (pricing)
CREATE TABLE tabelas_comerciais (
    id SERIAL PRIMARY KEY,
    instituicao_id UUID NOT NULL REFERENCES instituicoes(id) ON DELETE CASCADE,
    nome TEXT NOT NULL CHECK (char_length(nome) >= 2),
    descricao TEXT,
    tipo_tabela TEXT NOT NULL CHECK (tipo_tabela IN ('geral', 'produto_especifico', 'cliente_especifico')),
    vigencia_inicio DATE NOT NULL,
    vigencia_fim DATE CHECK (vigencia_fim > vigencia_inicio),
    ativa BOOLEAN NOT NULL DEFAULT true,
    configuracoes JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(instituicao_id, nome, vigencia_inicio)
);
COMMENT ON TABLE tabelas_comerciais IS 'Tabelas de preços e condições comerciais';

CREATE TRIGGER update_tabelas_comerciais_updated_at 
    BEFORE UPDATE ON tabelas_comerciais 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabela de relacionamento produto-tabela comercial (N:N)
CREATE TABLE produto_tabela_comercial (
    id BIGSERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    tabela_comercial_id INTEGER NOT NULL REFERENCES tabelas_comerciais(id) ON DELETE CASCADE,
    taxa_juros DECIMAL(8,4) NOT NULL CHECK (taxa_juros >= 0),
    taxa_juros_anual DECIMAL(8,4) GENERATED ALWAYS AS (POWER(1 + taxa_juros/100, 12) - 1) * 100 STORED,
    iof_percentual DECIMAL(8,4) NOT NULL DEFAULT 3.38 CHECK (iof_percentual >= 0),
    tac_valor DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (tac_valor >= 0),
    comissao_percentual DECIMAL(8,4) NOT NULL DEFAULT 0 CHECK (comissao_percentual >= 0),
    prioridade INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(produto_id, tabela_comercial_id)
);
COMMENT ON TABLE produto_tabela_comercial IS 'Relacionamento N:N entre produtos e tabelas comerciais com taxas específicas';
COMMENT ON COLUMN produto_tabela_comercial.prioridade IS 'Ordem de precedência para busca hierárquica (maior = maior prioridade)';

-- =============================================================================
-- TABELAS DE CLIENTE E PROPOSTA
-- =============================================================================

-- Tabela de clientes
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instituicao_id UUID NOT NULL REFERENCES instituicoes(id) ON DELETE CASCADE,
    tipo_pessoa TEXT NOT NULL CHECK (tipo_pessoa IN ('fisica', 'juridica')),
    
    -- Dados pessoa física
    cpf TEXT UNIQUE CHECK (cpf ~ '^\d{11}$' OR cpf IS NULL),
    nome TEXT CHECK (nome IS NOT NULL WHEN tipo_pessoa = 'fisica'),
    rg TEXT,
    data_nascimento DATE CHECK (data_nascimento < CURRENT_DATE),
    
    -- Dados pessoa jurídica
    cnpj TEXT UNIQUE CHECK (cnpj ~ '^\d{14}$' OR cnpj IS NULL),
    razao_social TEXT CHECK (razao_social IS NOT NULL WHEN tipo_pessoa = 'juridica'),
    nome_fantasia TEXT,
    inscricao_estadual TEXT,
    
    -- Dados comuns
    email TEXT CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    telefone TEXT CHECK (telefone ~ '^\d{10,11}$'),
    endereco JSONB,
    
    -- Dados financeiros
    renda_mensal DECIMAL(12,2) CHECK (renda_mensal >= 0),
    patrimonio_liquido DECIMAL(15,2) CHECK (patrimonio_liquido >= 0),
    dividas_existentes DECIMAL(12,2) DEFAULT 0 CHECK (dividas_existentes >= 0),
    
    -- Metadados
    status_cliente TEXT NOT NULL DEFAULT 'ativo' CHECK (status_cliente IN ('ativo', 'inativo', 'bloqueado')),
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints de integridade
    CHECK (
        (tipo_pessoa = 'fisica' AND cpf IS NOT NULL AND nome IS NOT NULL) OR
        (tipo_pessoa = 'juridica' AND cnpj IS NOT NULL AND razao_social IS NOT NULL)
    )
);
COMMENT ON TABLE clientes IS 'Clientes da instituição financeira (PF ou PJ)';

CREATE TRIGGER update_clientes_updated_at 
    BEFORE UPDATE ON clientes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices para performance e busca
CREATE INDEX idx_clientes_instituicao_id ON clientes(instituicao_id);
CREATE INDEX idx_clientes_cpf ON clientes(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_clientes_cnpj ON clientes(cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX idx_clientes_email ON clientes(email) WHERE email IS NOT NULL;

-- Tabela principal de propostas
CREATE TABLE propostas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_proposta TEXT NOT NULL, -- Número sequencial gerado pela instituição
    instituicao_id UUID NOT NULL REFERENCES instituicoes(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    tabela_comercial_id INTEGER NOT NULL REFERENCES tabelas_comerciais(id) ON DELETE RESTRICT,
    
    -- Dados da operação
    valor DECIMAL(15,2) NOT NULL CHECK (valor > 0),
    prazo INTEGER NOT NULL CHECK (prazo > 0),
    taxa_juros DECIMAL(8,4) NOT NULL CHECK (taxa_juros >= 0),
    taxa_juros_anual DECIMAL(8,4),
    
    -- Valores calculados
    valor_tac DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (valor_tac >= 0),
    valor_iof DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (valor_iof >= 0),
    valor_total_financiado DECIMAL(15,2) NOT NULL,
    cet_mensal DECIMAL(8,4),
    cet_anual DECIMAL(8,4),
    
    -- Dados adicionais
    finalidade TEXT NOT NULL CHECK (finalidade IN ('capital_giro', 'investimento', 'quitacao_dividas', 'consumo', 'reforma', 'outros')),
    garantia TEXT CHECK (garantia IN ('sem_garantia', 'aval', 'fianca', 'alienacao_fiduciaria', 'hipoteca', 'penhor')),
    
    -- Workflow e status
    status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_analise', 'pendente', 'aprovada', 'rejeitada', 'formalizada', 'cancelada')),
    
    -- Responsáveis
    atendente_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    analista_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    aprovador_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    
    -- Dados de pagamento
    dados_pagamento JSONB,
    
    -- Observações e motivos
    observacoes TEXT,
    motivo_rejeicao TEXT,
    condicoes_aprovacao TEXT,
    
    -- Documentação
    ccb_documento_url TEXT,
    documentos_complementares JSONB DEFAULT '[]',
    
    -- Timestamps de workflow
    submetida_em TIMESTAMPTZ,
    analisada_em TIMESTAMPTZ,
    aprovada_em TIMESTAMPTZ,
    rejeitada_em TIMESTAMPTZ,
    formalizada_em TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(instituicao_id, numero_proposta)
);
COMMENT ON TABLE propostas IS 'Propostas de crédito com workflow completo e auditoria';
COMMENT ON COLUMN propostas.numero_proposta IS 'Número sequencial único por instituição para identificação externa';
COMMENT ON COLUMN propostas.dados_pagamento IS 'Dados bancários para desembolso (JSON criptografado)';
COMMENT ON COLUMN propostas.documentos_complementares IS 'Array de URLs de documentos anexos';

CREATE TRIGGER update_propostas_updated_at 
    BEFORE UPDATE ON propostas 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices críticos para performance
CREATE INDEX idx_propostas_instituicao_id ON propostas(instituicao_id);
CREATE INDEX idx_propostas_cliente_id ON propostas(cliente_id);
CREATE INDEX idx_propostas_status ON propostas(status);
CREATE INDEX idx_propostas_produto_id ON propostas(produto_id);
CREATE INDEX idx_propostas_atendente_id ON propostas(atendente_id) WHERE atendente_id IS NOT NULL;
CREATE INDEX idx_propostas_analista_id ON propostas(analista_id) WHERE analista_id IS NOT NULL;
CREATE INDEX idx_propostas_created_at ON propostas(created_at);
CREATE INDEX idx_propostas_numero ON propostas(numero_proposta);

-- =============================================================================
-- TABELAS DE AUDITORIA E TRACKING
-- =============================================================================

-- Tabela de auditoria de mudanças
CREATE TABLE auditoria_propostas (
    id BIGSERIAL PRIMARY KEY,
    proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    acao TEXT NOT NULL CHECK (acao IN ('criada', 'atualizada', 'status_alterado', 'aprovada', 'rejeitada', 'formalizada')),
    status_anterior TEXT,
    status_novo TEXT,
    dados_alterados JSONB,
    observacoes TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE auditoria_propostas IS 'Log completo de todas as alterações em propostas para compliance';

CREATE INDEX idx_auditoria_proposta_id ON auditoria_propostas(proposta_id);
CREATE INDEX idx_auditoria_created_at ON auditoria_propostas(created_at);

-- Tabela de simulações (para analytics)
CREATE TABLE simulacoes (
    id BIGSERIAL PRIMARY KEY,
    instituicao_id UUID NOT NULL REFERENCES instituicoes(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
    
    -- Parâmetros da simulação
    valor DECIMAL(15,2) NOT NULL,
    prazo INTEGER NOT NULL,
    taxa_juros DECIMAL(8,4),
    
    -- Resultados calculados
    valor_parcela DECIMAL(12,2),
    valor_total_pago DECIMAL(15,2),
    cet_calculado DECIMAL(8,4),
    
    -- Metadata
    convertida_em_proposta BOOLEAN DEFAULT false,
    proposta_id UUID REFERENCES propostas(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE simulacoes IS 'Registro de simulações para analytics e conversão';

CREATE INDEX idx_simulacoes_instituicao_id ON simulacoes(instituicao_id);
CREATE INDEX idx_simulacoes_created_at ON simulacoes(created_at);

-- =============================================================================
-- TABELAS DE PAGAMENTO E FORMALIZAÇÃO
-- =============================================================================

-- Tabela de operações de pagamento
CREATE TABLE pagamentos (
    id BIGSERIAL PRIMARY KEY,
    proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
    tipo_operacao TEXT NOT NULL CHECK (tipo_operacao IN ('desembolso', 'parcela', 'liquidacao_antecipada')),
    
    -- Dados da operação
    valor DECIMAL(15,2) NOT NULL CHECK (valor > 0),
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    
    -- Dados bancários
    banco_codigo TEXT NOT NULL CHECK (banco_codigo ~ '^\d{3}$'),
    agencia TEXT NOT NULL,
    conta TEXT NOT NULL,
    tipo_conta TEXT NOT NULL CHECK (tipo_conta IN ('corrente', 'poupanca')),
    
    -- PIX (opcional)
    pix_chave TEXT,
    pix_tipo TEXT CHECK (pix_tipo IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
    
    -- Status e controle
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'concluido', 'falhou', 'cancelado')),
    tentativas INTEGER NOT NULL DEFAULT 0,
    
    -- Identificadores externos
    identificador_externo TEXT, -- ID no sistema bancário
    comprovante_url TEXT,
    
    -- Metadados
    erro_descricao TEXT,
    dados_adicionais JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE pagamentos IS 'Operações de pagamento relacionadas às propostas formalizadas';

CREATE TRIGGER update_pagamentos_updated_at 
    BEFORE UPDATE ON pagamentos 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_pagamentos_proposta_id ON pagamentos(proposta_id);
CREATE INDEX idx_pagamentos_status ON pagamentos(status);
CREATE INDEX idx_pagamentos_data_vencimento ON pagamentos(data_vencimento);

-- =============================================================================
-- CONFIGURAÇÃO DE SEGURANÇA (RLS)
-- =============================================================================

-- Habilitar RLS em todas as tabelas críticas
ALTER TABLE instituicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabelas_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;

-- Função helper para obter instituição do usuário autenticado
CREATE OR REPLACE FUNCTION auth.user_instituicao_id() 
RETURNS UUID 
LANGUAGE sql 
STABLE
AS $$
  SELECT (auth.jwt() ->> 'instituicao_id')::uuid;
$$;

-- Políticas RLS para isolamento multi-tenant

-- Usuários só veem dados de sua instituição
CREATE POLICY "Isolamento por instituição - usuários" ON usuarios
    FOR ALL TO authenticated
    USING (instituicao_id = auth.user_instituicao_id());

-- Produtos só da instituição do usuário
CREATE POLICY "Isolamento por instituição - produtos" ON produtos
    FOR ALL TO authenticated
    USING (instituicao_id = auth.user_instituicao_id());

-- Clientes só da instituição do usuário
CREATE POLICY "Isolamento por instituição - clientes" ON clientes
    FOR ALL TO authenticated
    USING (instituicao_id = auth.user_instituicao_id());

-- Propostas só da instituição do usuário
CREATE POLICY "Isolamento por instituição - propostas" ON propostas
    FOR ALL TO authenticated
    USING (instituicao_id = auth.user_instituicao_id());

-- Auditoria só da instituição (via join com propostas)
CREATE POLICY "Isolamento por instituição - auditoria" ON auditoria_propostas
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM propostas p 
            WHERE p.id = proposta_id 
            AND p.instituicao_id = auth.user_instituicao_id()
        )
    );

-- =============================================================================
-- FUNÇÕES E TRIGGERS ESPECIALIZADOS
-- =============================================================================

-- Função para gerar número sequencial de proposta
CREATE OR REPLACE FUNCTION gerar_numero_proposta(p_instituicao_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    next_number INTEGER;
    ano_atual TEXT;
BEGIN
    ano_atual := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN numero_proposta ~ ('^' || ano_atual || '-\d+$') 
            THEN SPLIT_PART(numero_proposta, '-', 2)::INTEGER 
            ELSE 0 
        END
    ), 0) + 1
    INTO next_number
    FROM propostas 
    WHERE instituicao_id = p_instituicao_id;
    
    RETURN ano_atual || '-' || LPAD(next_number::TEXT, 6, '0');
END;
$$;

-- Trigger para gerar número de proposta automaticamente
CREATE OR REPLACE FUNCTION trigger_gerar_numero_proposta()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.numero_proposta IS NULL THEN
        NEW.numero_proposta := gerar_numero_proposta(NEW.instituicao_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trig_gerar_numero_proposta
    BEFORE INSERT ON propostas
    FOR EACH ROW
    EXECUTE FUNCTION trigger_gerar_numero_proposta();

-- Trigger para auditoria automática
CREATE OR REPLACE FUNCTION trigger_auditoria_proposta()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    acao_executada TEXT;
    dados_alteracao JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        acao_executada := 'criada';
        dados_alteracao := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        acao_executada := CASE 
            WHEN OLD.status != NEW.status THEN 'status_alterado'
            ELSE 'atualizada'
        END;
        dados_alteracao := jsonb_build_object(
            'anterior', to_jsonb(OLD),
            'novo', to_jsonb(NEW)
        );
    END IF;
    
    INSERT INTO auditoria_propostas (
        proposta_id,
        usuario_id,
        acao,
        status_anterior,
        status_novo,
        dados_alterados,
        ip_address
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        (auth.jwt() ->> 'sub')::uuid,
        acao_executada,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
        CASE WHEN TG_OP = 'UPDATE' THEN NEW.status END,
        dados_alteracao,
        inet_client_addr()
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trig_auditoria_proposta
    AFTER INSERT OR UPDATE ON propostas
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auditoria_proposta();

-- =============================================================================
-- VIEWS PARA RELATÓRIOS E ANALYTICS
-- =============================================================================

-- View consolidada de propostas com dados relacionados
CREATE VIEW vw_propostas_completas AS
SELECT 
    p.id,
    p.numero_proposta,
    p.status,
    p.valor,
    p.prazo,
    p.taxa_juros,
    p.cet_anual,
    p.finalidade,
    p.created_at,
    p.formalizada_em,
    
    -- Dados do cliente
    c.nome AS cliente_nome,
    c.cpf AS cliente_cpf,
    c.email AS cliente_email,
    
    -- Dados do produto
    pr.nome AS produto_nome,
    pr.tipo_produto,
    
    -- Dados da tabela comercial
    tc.nome AS tabela_comercial_nome,
    ptc.comissao_percentual,
    
    -- Dados dos responsáveis
    u_atendente.nome_completo AS atendente_nome,
    u_analista.nome_completo AS analista_nome,
    u_aprovador.nome_completo AS aprovador_nome,
    
    -- Dados da instituição
    i.razao_social AS instituicao_nome

FROM propostas p
LEFT JOIN clientes c ON p.cliente_id = c.id
LEFT JOIN produtos pr ON p.produto_id = pr.id
LEFT JOIN tabelas_comerciais tc ON p.tabela_comercial_id = tc.id
LEFT JOIN produto_tabela_comercial ptc ON pr.id = ptc.produto_id AND tc.id = ptc.tabela_comercial_id
LEFT JOIN usuarios u_atendente ON p.atendente_id = u_atendente.id
LEFT JOIN usuarios u_analista ON p.analista_id = u_analista.id
LEFT JOIN usuarios u_aprovador ON p.aprovador_id = u_aprovador.id
LEFT JOIN instituicoes i ON p.instituicao_id = i.id;

-- View para dashboard de métricas
CREATE VIEW vw_metricas_dashboard AS
SELECT 
    i.id AS instituicao_id,
    i.razao_social AS instituicao_nome,
    
    -- Contadores por status
    COUNT(*) FILTER (WHERE p.status = 'rascunho') AS propostas_rascunho,
    COUNT(*) FILTER (WHERE p.status = 'em_analise') AS propostas_em_analise,
    COUNT(*) FILTER (WHERE p.status = 'pendente') AS propostas_pendentes,
    COUNT(*) FILTER (WHERE p.status = 'aprovada') AS propostas_aprovadas,
    COUNT(*) FILTER (WHERE p.status = 'rejeitada') AS propostas_rejeitadas,
    COUNT(*) FILTER (WHERE p.status = 'formalizada') AS propostas_formalizadas,
    
    -- Valores financeiros
    COALESCE(SUM(p.valor) FILTER (WHERE p.status = 'aprovada'), 0) AS valor_aprovado,
    COALESCE(SUM(p.valor) FILTER (WHERE p.status = 'formalizada'), 0) AS valor_formalizado,
    
    -- Métricas de performance
    ROUND(
        COALESCE(
            COUNT(*) FILTER (WHERE p.status IN ('aprovada', 'formalizada'))::DECIMAL / 
            NULLIF(COUNT(*) FILTER (WHERE p.status NOT IN ('rascunho')), 0) * 100, 
            0
        ), 2
    ) AS taxa_aprovacao,
    
    -- Tempo médio de processamento (em horas)
    ROUND(
        COALESCE(
            EXTRACT(EPOCH FROM AVG(p.analisada_em - p.submetida_em)) / 3600,
            0
        ), 2
    ) AS tempo_medio_analise_horas

FROM instituicoes i
LEFT JOIN propostas p ON i.id = p.instituicao_id
WHERE p.created_at >= CURRENT_DATE - INTERVAL '30 days' OR p.id IS NULL
GROUP BY i.id, i.razao_social;

COMMENT ON VIEW vw_metricas_dashboard IS 'Métricas consolidadas para dashboard (últimos 30 dias)';
```

### 4.2. Relacionamentos e Integridade Referencial

**Hierarquia de Dependências:**

```
instituicoes (root)
├── usuarios
├── produtos
├── tabelas_comerciais
├── clientes
└── propostas
    ├── auditoria_propostas
    ├── simulacoes
    └── pagamentos
```

**Relacionamentos Críticos:**

1. **Multi-tenancy**: Todas as entidades principais referenciam `instituicoes.id` para isolamento
2. **Produto-Tabela Comercial**: Relacionamento N:N com taxas específicas e hierarquia de precedência
3. **Proposta-Workflow**: Estados controlados via FSM com auditoria automática
4. **Usuário-Papel**: RBAC integrado com sistema de permissões hierárquicas

### 4.3. Estratégia de Performance

**Índices Estratégicos:**
- **Queries de Dashboard**: Índices compostos em `(instituicao_id, status, created_at)`
- **Busca de Clientes**: Índices únicos em CPF/CNPJ com filtro de NULL
- **Auditoria**: Índice por data para queries de compliance
- **Pagamentos**: Índice por status e data de vencimento para processamento batch

**Particionamento (Futuro):**
```sql
-- Estratégia para alta volumetria
CREATE TABLE propostas_2025 PARTITION OF propostas
FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

## 5. Fluxos de Trabalho e Estados

### 5.1. Finite State Machine (FSM) de Propostas

O workflow de propostas é implementado como uma **máquina de estados finita** que garante transições válidas e rastreabilidade completa.

**Estados Definidos:**

```typescript
enum ProposalStatus {
  RASCUNHO = 'rascunho',           // Estado inicial - proposta em edição
  EM_ANALISE = 'em_analise',       // Submetida para análise de risco
  PENDENTE = 'pendente',           // Requer ação do cliente/analista
  APROVADA = 'aprovada',           // Aprovada mas não formalizada
  REJEITADA = 'rejeitada',         // Rejeitada definitivamente
  FORMALIZADA = 'formalizada',     // Aprovada e contrato assinado
  CANCELADA = 'cancelada'          // Cancelada a pedido ou por timeout
}
```

**Matriz de Transições Válidas:**

```typescript
const VALID_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  [ProposalStatus.RASCUNHO]: [
    ProposalStatus.EM_ANALISE,
    ProposalStatus.CANCELADA
  ],
  [ProposalStatus.EM_ANALISE]: [
    ProposalStatus.PENDENTE,
    ProposalStatus.APROVADA,
    ProposalStatus.REJEITADA,
    ProposalStatus.RASCUNHO  // Devolvida para correção
  ],
  [ProposalStatus.PENDENTE]: [
    ProposalStatus.EM_ANALISE,  // Documentos complementares enviados
    ProposalStatus.APROVADA,
    ProposalStatus.REJEITADA,
    ProposalStatus.CANCELADA
  ],
  [ProposalStatus.APROVADA]: [
    ProposalStatus.FORMALIZADA,
    ProposalStatus.CANCELADA,
    ProposalStatus.REJEITADA    // Após nova análise
  ],
  [ProposalStatus.REJEITADA]: [],  // Estado final
  [ProposalStatus.FORMALIZADA]: [], // Estado final
  [ProposalStatus.CANCELADA]: []   // Estado final
}
```

**Implementação da Validação:**

```typescript
class ProposalStateMachine {
  static validateTransition(from: ProposalStatus, to: ProposalStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false
  }
  
  static getAvailableTransitions(currentStatus: ProposalStatus): ProposalStatus[] {
    return VALID_TRANSITIONS[currentStatus] ?? []
  }
  
  static requiresApproval(transition: [ProposalStatus, ProposalStatus]): boolean {
    const [from, to] = transition
    return (
      (from === ProposalStatus.EM_ANALISE && to === ProposalStatus.APROVADA) ||
      (from === ProposalStatus.PENDENTE && to === ProposalStatus.APROVADA)
    )
  }
}
```

### 5.2. Workflow de Análise de Crédito

**Etapas do Processo:**

**1. Submissão (RASCUNHO → EM_ANALISE):**
```typescript
async submitProposal(proposalId: string, userId: string): Promise<void> {
  // Validações de negócio
  await this.validateProposalCompleteness(proposalId)
  await this.validateFinancialCalculations(proposalId)
  
  // Transição de estado
  await this.proposalRepository.updateStatus(proposalId, {
    status: ProposalStatus.EM_ANALISE,
    submetida_em: new Date(),
    analista_id: await this.assignAnalyst(proposalId)
  })
  
  // Eventos do domínio
  await this.eventBus.publish(new ProposalSubmittedEvent(proposalId))
}
```

**2. Análise Automática:**
```typescript
class AutomaticRiskAnalysis {
  async analyzeProposal(proposalId: string): Promise<RiskAnalysisResult> {
    const proposal = await this.proposalRepository.findById(proposalId)
    const client = await this.clientRepository.findById(proposal.clienteId)
    
    const checks = await Promise.all([
      this.checkCPFRestrictions(client.cpf),
      this.checkIncomeCompatibility(proposal.valor, client.rendaMensal),
      this.checkExistingDebts(client.dividasExistentes),
      this.validateProductLimits(proposal.produtoId, proposal.valor, proposal.prazo)
    ])
    
    const riskScore = this.calculateRiskScore(checks)
    
    return {
      score: riskScore,
      automaticDecision: riskScore >= 0.7 ? 'APPROVE' : 'REQUIRE_MANUAL_REVIEW',
      details: checks
    }
  }
}
```

**3. Análise Manual (quando necessário):**
```typescript
async manualReview(proposalId: string, analystId: string, decision: ReviewDecision): Promise<void> {
  const validTransitions = ProposalStateMachine.getAvailableTransitions(currentStatus)
  
  if (!validTransitions.includes(decision.newStatus)) {
    throw new InvalidTransitionError(`Cannot transition from ${currentStatus} to ${decision.newStatus}`)
  }
  
  await this.proposalRepository.updateStatus(proposalId, {
    status: decision.newStatus,
    analista_id: analystId,
    analisada_em: new Date(),
    observacoes: decision.observations,
    motivo_rejeicao: decision.rejectionReason
  })
}
```

### 5.3. Geração de Documentos (CCB)

**Template Engine para CCB:**

```typescript
class CCBGenerator {
  async generateCCB(proposalId: string): Promise<Buffer> {
    const proposal = await this.getProposalWithRelations(proposalId)
    
    const templateData = {
      // Dados da operação
      numeroOperacao: proposal.numeroOperacao,
      valor: this.formatCurrency(proposal.valor),
      prazo: proposal.prazo,
      taxaJuros: this.formatPercentage(proposal.taxaJuros),
      cet: this.formatPercentage(proposal.cetAnual),
      
      // Cronograma de pagamentos
      cronogramaPagamentos: await this.generatePaymentSchedule(proposal),
      
      // Dados do cliente
      cliente: this.sanitizeClientData(proposal.cliente),
      
      // Dados da instituição
      instituicao: proposal.instituicao,
      
      // Termos e condições
      termosCondicoes: await this.getTermsAndConditions(proposal.produtoId),
      
      // Dados de formalização
      dataFormalizacao: new Date().toISOString(),
      localFormalizacao: 'São Paulo, SP'
    }
    
    return await this.pdfGenerator.generateFromTemplate('ccb-template.html', templateData)
  }
  
  private async generatePaymentSchedule(proposal: Proposal): Promise<PaymentScheduleItem[]> {
    const valorParcela = this.calculateInstallment(proposal.valor, proposal.taxaJuros, proposal.prazo)
    const schedule: PaymentScheduleItem[] = []
    
    for (let i = 1; i <= proposal.prazo; i++) {
      const vencimento = this.addMonths(proposal.dataFormalizacao, i)
      schedule.push({
        numero: i,
        vencimento: vencimento.toISOString().split('T')[0],
        valorParcela: this.formatCurrency(valorParcela),
        saldoDevedor: this.formatCurrency(this.calculateBalance(proposal.valor, valorParcela, i))
      })
    }
    
    return schedule
  }
}
```

## 6. Segurança e Compliance

### 6.1. Framework de Segurança Multi-Camada

**Camada 1: Network Security**
- **TLS 1.3**: Certificados SSL/TLS com perfect forward secrecy
- **Rate Limiting Hierárquico**: 100 req/min por usuário, 10k req/min por instituição
- **DDoS Protection**: Cloudflare com regras customizadas para aplicações financeiras
- **IP Allowlisting**: Opcional para instituições que requerem acesso restrito

**Camada 2: Application Security**
- **JWT com Claims Customizados**: Tokens com `instituicao_id`, `papel`, `permissions`
- **RBAC Anti-Frágil**: Sistema que falha de forma segura (deny by default)
- **Input Validation**: Sanitização via Zod com schemas específicos do domínio
- **XSS Prevention**: CSP headers + sanitização server-side + React automatico escaping

```typescript
// Exemplo de middleware de autorização
export const requirePermission = (permission: Permission) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userPermissions = await getUserPermissions(req.user.id)
    
    if (!userPermissions.includes(permission)) {
      logger.security('Unauthorized access attempt', {
        userId: req.user.id,
        requiredPermission: permission,
        userPermissions,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      })
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN'
      })
    }
    
    next()
  }
}
```

**Camada 3: Data Security**
- **Encryption at Rest**: Dados sensíveis (CPF, dados bancários) com AES-256
- **Encryption in Transit**: TLS 1.3 para todas as comunicações
- **Database-level RLS**: Row Level Security no PostgreSQL para isolamento multi-tenant
- **Audit Logging**: Registro completo de todas as operações sensíveis

### 6.2. Compliance Regulatório Brasileiro

**LGPD (Lei Geral de Proteção de Dados):**

```typescript
class LGPDCompliance {
  // Consentimento explícito para coleta de dados
  async recordConsent(clientId: string, consentType: ConsentType, ipAddress: string): Promise<void> {
    await this.consentRepository.save({
      clientId,
      consentType,
      granted: true,
      grantedAt: new Date(),
      ipAddress,
      version: '1.0' // Versão dos termos aceitos
    })
  }
  
  // Direito ao esquecimento
  async processDataDeletionRequest(clientId: string, requesterId: string): Promise<void> {
    // Verificar se há contratos ativos
    const activeContracts = await this.contractRepository.findActiveByClient(clientId)
    if (activeContracts.length > 0) {
      throw new LGPDViolationError('Cannot delete data of client with active contracts')
    }
    
    // Anonimizar dados pessoais mantendo dados financeiros para compliance
    await this.clientRepository.anonymize(clientId)
    
    // Log da operação
    await this.auditRepository.log({
      action: 'DATA_DELETION',
      targetId: clientId,
      requesterId,
      reason: 'LGPD_RIGHT_TO_BE_FORGOTTEN'
    })
  }
  
  // Portabilidade de dados
  async exportClientData(clientId: string, format: 'JSON' | 'XML'): Promise<string> {
    const clientData = await this.clientRepository.findCompleteById(clientId)
    const proposalData = await this.proposalRepository.findByClientId(clientId)
    
    const exportData = {
      cliente: this.sanitizeForExport(clientData),
      propostas: proposalData.map(p => this.sanitizeForExport(p)),
      metadata: {
        exportedAt: new Date().toISOString(),
        dataController: 'Simpix Platform',
        legalBasis: 'Portabilidade de dados - Art. 18 LGPD'
      }
    }
    
    return format === 'JSON' 
      ? JSON.stringify(exportData, null, 2)
      : this.convertToXML(exportData)
  }
}
```

**Banco Central do Brasil (BACEN):**

```typescript
class BACENCompliance {
  // Validação de limites regulatórios
  async validateRegulatoryLimits(proposal: Proposal): Promise<ComplianceResult> {
    const violations: string[] = []
    
    // Verificar limite máximo de juros (varia por produto)
    const maxRate = await this.getRegulatoryMaxRate(proposal.produtoId)
    if (proposal.taxaJuros > maxRate) {
      violations.push(`Taxa de juros ${proposal.taxaJuros}% excede limite regulatório de ${maxRate}%`)
    }
    
    // Verificar transparência na informação de CET
    if (!proposal.cetAnual || proposal.cetAnual <= proposal.taxaJuros) {
      violations.push('CET deve ser calculado e informado corretamente')
    }
    
    // Verificar período de reflexão para crédito consignado
    if (proposal.produto.tipo === 'credito_consignado') {
      const hasReflectionPeriod = await this.verifyReflectionPeriod(proposal.clienteId)
      if (!hasReflectionPeriod) {
        violations.push('Período de reflexão de 72h necessário para crédito consignado')
      }
    }
    
    return {
      compliant: violations.length === 0,
      violations
    }
  }
  
  // Relatórios obrigatórios para BACEN
  async generateSCRReport(): Promise<SCRReportData> {
    // Sistema de Informações de Crédito (SCR)
    const activeOperations = await this.proposalRepository.findFormalized({
      dateRange: this.getCurrentMonth()
    })
    
    return {
      reportingPeriod: this.getCurrentMonth(),
      totalOperations: activeOperations.length,
      totalValue: activeOperations.reduce((sum, op) => sum + op.valor, 0),
      operationsByType: this.groupByProductType(activeOperations),
      averageRate: this.calculateAverageRate(activeOperations)
    }
  }
}
```

### 6.3. Auditoria e Monitoramento

**Sistema de Auditoria Completa:**

```typescript
class AuditSystem {
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const auditEntry = {
      eventType: event.type,
      severity: event.severity,
      userId: event.userId,
      instituicaoId: event.instituicaoId,
      details: event.details,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      timestamp: new Date(),
      correlationId: event.correlationId
    }
    
    // Log local para compliance
    await this.auditRepository.save(auditEntry)
    
    // SIEM integration para detecção de anomalias
    if (event.severity >= SecuritySeverity.HIGH) {
      await this.siemIntegration.sendAlert(auditEntry)
    }
    
    // Notificação para equipe de segurança
    if (event.severity >= SecuritySeverity.CRITICAL) {
      await this.notificationService.sendSecurityAlert(auditEntry)
    }
  }
  
  async detectAnomalies(): Promise<AnomalyDetectionResult[]> {
    const anomalies: AnomalyDetectionResult[] = []
    
    // Detecção de padrões suspeitos
    const suspiciousLogins = await this.detectSuspiciousLogins()
    const unusualTransactions = await this.detectUnusualTransactionPatterns()
    const privilegeEscalation = await this.detectPrivilegeEscalationAttempts()
    
    return [...suspiciousLogins, ...unusualTransactions, ...privilegeEscalation]
  }
  
  private async detectSuspiciousLogins(): Promise<AnomalyDetectionResult[]> {
    // Múltiplos logins falhados
    // Logins de IPs geograficamente distantes
    // Logins fora do horário comercial
    // etc.
  }
}
```

## 7. Performance e Escalabilidade

### 7.1. Estratégia de Cache Multi-Nível

**Cache L1 - Application Level (Redis):**
```typescript
class CacheManager {
  private redis: Redis
  
  async cacheCommercialTable(tableId: number, data: CommercialTableData): Promise<void> {
    const key = `commercial_table:${tableId}`
    await this.redis.setex(key, 3600, JSON.stringify(data)) // 1 hora TTL
  }
  
  async getCachedRate(productId: number, tableId: number): Promise<number | null> {
    const key = `rate:${productId}:${tableId}`
    const cached = await this.redis.get(key)
    return cached ? parseFloat(cached) : null
  }
  
  // Cache warming para dados críticos
  async warmCriticalCaches(): Promise<void> {
    const activeProducts = await this.productRepository.findActive()
    const activeTables = await this.commercialTableRepository.findActive()
    
    await Promise.all([
      ...activeProducts.map(p => this.cacheProductData(p.id)),
      ...activeTables.map(t => this.cacheCommercialTable(t.id, t))
    ])
  }
}
```

**Cache L2 - CDN Level:**
- Assets estáticos (CSS, JS, imagens): Cache por 30 dias
- API responses determinísticas: Cache por 1 hora
- Documentos gerados (PDFs): Cache por 24 horas

**Cache L3 - Database Level:**
```sql
-- Prepared statements para queries frequentes
PREPARE get_proposal_with_relations (UUID) AS
SELECT p.*, c.nome as cliente_nome, pr.nome as produto_nome
FROM propostas p
JOIN clientes c ON p.cliente_id = c.id
JOIN produtos pr ON p.produto_id = pr.id
WHERE p.id = $1;

-- Índices para performance crítica
CREATE INDEX CONCURRENTLY idx_propostas_status_created_at 
ON propostas(status, created_at DESC) 
WHERE status IN ('em_analise', 'pendente');
```

### 7.2. Otimização de Queries

**Query Optimization Strategy:**

```typescript
class OptimizedProposalRepository {
  // Paginação eficiente com cursor-based pagination
  async findProposalsPaginated(params: PaginationParams): Promise<PaginatedResult<Proposal>> {
    const query = this.db
      .select()
      .from(propostas)
      .where(
        and(
          eq(propostas.instituicaoId, params.instituicaoId),
          params.cursor ? gt(propostas.createdAt, params.cursor) : undefined
        )
      )
      .orderBy(desc(propostas.createdAt))
      .limit(params.limit + 1) // +1 para detectar se há próxima página
    
    const results = await query
    const hasNextPage = results.length > params.limit
    
    if (hasNextPage) {
      results.pop() // Remove o item extra
    }
    
    return {
      data: results,
      hasNextPage,
      nextCursor: hasNextPage ? results[results.length - 1].createdAt : null
    }
  }
  
  // Aggregations otimizadas para dashboard
  async getDashboardMetrics(instituicaoId: string): Promise<DashboardMetrics> {
    const cacheKey = `dashboard:${instituicaoId}`
    const cached = await this.cache.get(cacheKey)
    
    if (cached) {
      return JSON.parse(cached)
    }
    
    // Query otimizada com aggregations
    const metrics = await this.db
      .select({
        totalProposals: count(),
        approvedValue: sum(propostas.valor).filterWhere(eq(propostas.status, 'aprovada')),
        avgProcessingTime: avg(
          sql`EXTRACT(EPOCH FROM (analisada_em - submetida_em)) / 3600`
        ).filterWhere(isNotNull(propostas.analisadaEm))
      })
      .from(propostas)
      .where(
        and(
          eq(propostas.instituicaoId, instituicaoId),
          gte(propostas.createdAt, sql`CURRENT_DATE - INTERVAL '30 days'`)
        )
      )
    
    await this.cache.setex(cacheKey, 900, JSON.stringify(metrics)) // 15 min cache
    return metrics
  }
}
```

### 7.3. Processamento Assíncrono

**Background Job Processing:**

```typescript
class JobProcessor {
  private queue: Queue
  
  constructor() {
    this.queue = new Queue('proposal-processing', {
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    })
    
    this.setupProcessors()
  }
  
  private setupProcessors(): void {
    // Processamento de geração de CCB
    this.queue.process('generate-ccb', 5, async (job) => {
      const { proposalId } = job.data
      await this.generateCCBDocument(proposalId)
    })
    
    // Processamento de cálculos financeiros em lote
    this.queue.process('batch-calculations', 10, async (job) => {
      const { proposalIds } = job.data
      await this.processBatchCalculations(proposalIds)
    })
    
    // Processamento de integrações bancárias
    this.queue.process('bank-integration', 3, async (job) => {
      const { paymentData } = job.data
      await this.processBankingIntegration(paymentData)
    })
  }
  
  async schedulePeriodicTasks(): Promise<void> {
    // Limpeza de cache diária
    await this.queue.add('cache-cleanup', {}, {
      repeat: { cron: '0 2 * * *' } // 2h da manhã
    })
    
    // Geração de relatórios mensais
    await this.queue.add('monthly-reports', {}, {
      repeat: { cron: '0 8 1 * *' } // 1º dia do mês às 8h
    })
    
    // Backup incremental de dados críticos
    await this.queue.add('incremental-backup', {}, {
      repeat: { cron: '0 */6 * * *' } // A cada 6 horas
    })
  }
}
```

## 8. Deployment e DevOps

### 8.1. Estratégia de CI/CD

**Pipeline Definition (.github/workflows/deploy.yml):**

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18.x'
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: simpix_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run type checking
        run: npm run type-check
      
      - name: Run unit tests
        run: npm run test:unit
        
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/simpix_test
      
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run SAST scan
        uses: github/super-linter@v4
        env:
          DEFAULT_BRANCH: main
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Run dependency check
        run: |
          npm audit --audit-level high
          npm run check:licenses

  deploy-staging:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment"
          # Deploy logic here
          
      - name: Run smoke tests
        run: npm run test:smoke -- --env=staging

  deploy-production:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to production
        run: |
          echo "Deploying to production environment"
          # Blue-green deployment logic
          
      - name: Run production smoke tests
        run: npm run test:smoke -- --env=production
        
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 8.2. Containerização e Orquestração

**Dockerfile:**

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S simpix -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=simpix:nodejs /app/dist ./dist
COPY --from=builder --chown=simpix:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=simpix:nodejs /app/package.json ./package.json

# Security hardening
RUN apk add --no-cache dumb-init
RUN rm -rf /tmp/* /var/cache/apk/*

USER simpix

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server/index.js"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/server/health-check.js
```

**Docker Compose (Development):**

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/simpix_dev
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./src:/app/src:ro
    command: npm run dev

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: simpix_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
```

### 8.3. Monitoramento e Observabilidade

**Application Monitoring:**

```typescript
class MonitoringService {
  private prometheus: PrometheusRegistry
  private logger: Logger
  
  constructor() {
    this.prometheus = new PrometheusRegistry()
    this.setupMetrics()
    this.logger = new Logger('monitoring')
  }
  
  private setupMetrics(): void {
    // Business metrics
    this.proposalCreatedCounter = new Counter({
      name: 'simpix_proposals_created_total',
      help: 'Total number of proposals created',
      labelNames: ['instituicao_id', 'produto_type'],
      registers: [this.prometheus]
    })
    
    this.proposalProcessingDuration = new Histogram({
      name: 'simpix_proposal_processing_duration_seconds',
      help: 'Time taken to process proposals',
      labelNames: ['status_transition'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.prometheus]
    })
    
    // Technical metrics
    this.databaseConnectionPool = new Gauge({
      name: 'simpix_db_connections_active',
      help: 'Number of active database connections',
      registers: [this.prometheus]
    })
    
    this.redisLatency = new Histogram({
      name: 'simpix_redis_operation_duration_seconds',
      help: 'Redis operation latency',
      labelNames: ['operation'],
      registers: [this.prometheus]
    })
  }
  
  async trackProposalCreated(instituicaoId: string, productType: string): Promise<void> {
    this.proposalCreatedCounter.inc({ instituicao_id: instituicaoId, produto_type: productType })
    
    this.logger.info('Proposal created', {
      instituicaoId,
      productType,
      timestamp: new Date().toISOString()
    })
  }
  
  trackProcessingTime(transition: string, duration: number): void {
    this.proposalProcessingDuration.observe({ status_transition: transition }, duration)
  }
  
  // Custom dashboard metrics
  async getBusinessMetrics(): Promise<BusinessMetrics> {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    return {
      proposalsCreated: await this.getProposalCount(last24h),
      averageProcessingTime: await this.getAverageProcessingTime(last24h),
      approvalRate: await this.getApprovalRate(last24h),
      systemUptime: process.uptime(),
      activeUsers: await this.getActiveUserCount(last24h)
    }
  }
}
```

**Alerting Configuration:**

```yaml
# prometheus-alerts.yml
groups:
  - name: simpix-business-alerts
    rules:
      - alert: ProposalProcessingTimeHigh
        expr: histogram_quantile(0.95, simpix_proposal_processing_duration_seconds) > 300
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Proposal processing time is too high"
          description: "95th percentile processing time is {{ $value }} seconds"
      
      - alert: ProposalApprovalRateLow
        expr: rate(simpix_proposals_approved_total[1h]) / rate(simpix_proposals_created_total[1h]) < 0.5
        for: 15m
        labels:
          severity: critical
        annotations:
          summary: "Proposal approval rate is below 50%"
          
  - name: simpix-technical-alerts
    rules:
      - alert: DatabaseConnectionsHigh
        expr: simpix_db_connections_active > 80
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool usage is high"
          
      - alert: RedisLatencyHigh
        expr: histogram_quantile(0.95, simpix_redis_operation_duration_seconds) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis operations are slow"
```

## 9. Roadmap de Evolução

### 9.1. Roadmap Técnico (Próximos 12 meses)

**Q1 2025: Consolidação e Performance**
- **Semana 1-4**: Otimização de queries críticas e implementação de cache distribuído
- **Semana 5-8**: Migration para PostgreSQL 16 com particionamento por data
- **Semana 9-12**: Implementação de CDN para assets e documentos gerados

**Q2 2025: Integrações e Compliance**
- **Semana 13-16**: Integração com APIs bancárias (Banco Inter, Itaú, Bradesco)
- **Semana 17-20**: Implementação de relatórios regulatórios automatizados (SCR, BACEN)
- **Semana 21-24**: Sistema de assinatura digital com certificados ICP-Brasil

**Q3 2025: Escalabilidade e IA**
- **Semana 25-28**: Implementação de microsserviços para módulos críticos
- **Semana 29-32**: Sistema de análise de risco com Machine Learning
- **Semana 33-36**: Implementação de Event Sourcing para auditoria avançada

**Q4 2025: Inovação e Expansão**
- **Semana 37-40**: API pública para integrações de terceiros
- **Semana 41-44**: Sistema de notificações em tempo real (WebSockets)
- **Semana 45-48**: Mobile app para analistas (React Native)

### 9.2. Roadmap de Produto

**Fase 1: Core Banking Features**
- **Open Banking Integration**: Consulta automática de dados bancários do cliente
- **Credit Bureau Integration**: Integração com SPC/Serasa para análise de risco
- **Digital Signature Workflow**: Fluxo completo de assinatura digital de contratos

**Fase 2: Advanced Analytics**
- **Predictive Risk Modeling**: Modelos de ML para predição de inadimplência
- **Dynamic Pricing**: Ajuste automático de taxas baseado em risco e mercado
- **Customer Segmentation**: Segmentação avançada para ofertas personalizadas

**Fase 3: Ecosystem Expansion**
- **Partner Portal**: Portal para correspondentes bancários
- **White-label Solution**: Solução white-label para fintechs
- **API Marketplace**: Marketplace de APIs para integrações de terceiros

### 9.3. Evolução Arquitetural

**Migração para Event-Driven Architecture:**

```typescript
// Visão futura: Event Sourcing para propostas
interface ProposalEvent {
  eventId: string
  aggregateId: string
  eventType: string
  eventData: Record<string, unknown>
  metadata: {
    userId: string
    timestamp: Date
    version: number
  }
}

class ProposalEventStore {
  async appendEvent(event: ProposalEvent): Promise<void> {
    // Persistir evento no event store
    await this.eventStore.append(event.aggregateId, event)
    
    // Publicar evento para subscribers
    await this.eventBus.publish(event)
  }
  
  async getAggregateHistory(aggregateId: string): Promise<ProposalEvent[]> {
    return await this.eventStore.getEvents(aggregateId)
  }
  
  async rebuildAggregate(aggregateId: string): Promise<Proposal> {
    const events = await this.getAggregateHistory(aggregateId)
    return Proposal.fromEvents(events)
  }
}
```

**Migração para Microsserviços:**

```typescript
// Bounded Contexts futuros
const services = {
  'proposal-service': {
    responsibilities: ['Gestão de propostas', 'Workflow de aprovação'],
    database: 'proposal-db',
    apis: ['/api/v2/proposals', '/api/v2/workflow']
  },
  'financial-calculator': {
    responsibilities: ['Cálculos financeiros', 'Simulações'],
    database: 'none', // Stateless service
    apis: ['/api/v2/calculations', '/api/v2/simulations']
  },
  'document-generator': {
    responsibilities: ['Geração de CCB', 'Templates'],
    database: 'document-db',
    apis: ['/api/v2/documents']
  },
  'risk-analysis': {
    responsibilities: ['Análise de risco', 'ML models'],
    database: 'analytics-db',
    apis: ['/api/v2/risk-analysis']
  }
}
```

## 10. Conclusão e Próximos Passos

### 10.1. Resumo Executivo

O Simpix representa uma **solução arquitetural robusta e escalável** para o mercado de crédito brasileiro, fundamentada em:

**Pilares Técnicos:**
- **Segurança Bancária**: RLS, criptografia, auditoria completa
- **Performance**: Cache multi-nível, otimização de queries, processamento assíncrono  
- **Compliance**: Conformidade com LGPD, BACEN e regulamentações financeiras
- **Escalabilidade**: Arquitetura preparada para alta volumetria e múltiplas instituições

**Valor de Negócio:**
- **Redução de 85-90% no tempo de processamento** de propostas
- **Precisão de 99.95% em cálculos financeiros** críticos
- **ROI estimado de 400%** no primeiro ano de operação
- **Compliance automático** com regulamentações brasileiras

### 10.2. Riscos Identificados e Mitigações

**Risco Técnico ALTO:** Complexidade de integração com sistemas bancários legados
- **Mitigação:** Desenvolvimento de adapters específicos e ambiente de sandbox para testes

**Risco Regulatório MÉDIO:** Mudanças nas regulamentações BACEN
- **Mitigação:** Arquitetura flexível com configurações externalizadas e atualizações rápidas

**Risco Operacional BAIXO:** Dependência de fornecedores externos (Supabase)
- **Mitigação:** Estratégia de backup e plano de migração para infraestrutura própria

### 10.3. Métricas de Sucesso

**KPIs Técnicos (3 meses):**
- Uptime > 99.9%
- Tempo de resposta API < 200ms (p95)
- Zero vulnerabilidades críticas em security scans

**KPIs de Negócio (6 meses):**
- 3+ instituições financeiras em produção
- 10,000+ propostas processadas mensalmente
- NPS > 8.0 entre usuários finais

**KPIs de Escala (12 meses):**
- Suporte a 100,000+ propostas mensais
- Integração com 5+ APIs bancárias
- Certificação de segurança ISO 27001

---

**Este blueprint arquitetural serve como a fundação técnica e estratégica para o desenvolvimento contínuo do Simpix, garantindo que todas as decisões futuras sejam alinhadas com a visão de longo prazo e os requisitos de qualidade bancária.**

**Próximo documento recomendado:** `03-manual-de-operacoes.md` - Procedimentos operacionais detalhados para deploy, monitoramento e manutenção do sistema.

---

*Documento versionado e mantido sob controle de versão. Última atualização: 03/09/2025*
*Revisão técnica pendente: Arquiteto Sênior*
*Aprovação de compliance pendente: Oficial de Conformidade*