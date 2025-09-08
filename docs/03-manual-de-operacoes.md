# Manual de Operações e Padrões do Projeto Simpix

**Versão:** 3.0  
**Data:** 03 de Setembro de 2025  
**Autor:** Simpix Development Team  
**Status:** Operacional

---

## 1. Padrões de Qualidade de Código

Esta seção define as ferramentas e regras que garantem a qualidade e a consistência do nosso código-fonte. A adesão a estes padrões é **inegociável** para manter a confiabilidade de um sistema bancário.

### 1.1. Configuração Completa do ESLint (`.eslintrc.json`)

O ESLint atua como nosso "detetive de código", identificando padrões problemáticos, potenciais bugs e violações de segurança antes que cheguem à produção. A configuração atual é especificamente ajustada para aplicações financeiras críticas.

```json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended", // Regras base fundamentais
    "plugin:@typescript-eslint/recommended", // Regras TypeScript essenciais
    "plugin:@typescript-eslint/recommended-requiring-type-checking", // Type checking avançado
    "plugin:react/recommended", // Regras React para componentes seguros
    "plugin:react-hooks/recommended", // Validação de hooks
    "plugin:jsx-a11y/recommended", // Acessibilidade WCAG 2.1
    "prettier" // Integração Prettier (DEVE SER O ÚLTIMO)
  ],
  "plugins": [
    "@typescript-eslint", // Plugin TypeScript com 50+ regras de segurança
    "react", // Plugin React com validação de props
    "react-hooks", // Plugin para regras de hooks
    "jsx-a11y", // Plugin de acessibilidade
    "prettier" // Plugin de formatação
  ],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module",
    "project": "./tsconfig.json", // Habilita type checking avançado
    "ecmaFeatures": {
      "jsx": true // Suporte JSX nativo
    }
  },
  "env": {
    "browser": true,
    "es2022": true,
    "node": true
  },
  "rules": {
    // === REGRAS DE SEGURANÇA CRÍTICAS ===
    "@typescript-eslint/no-explicit-any": "error", // Proíbe 'any' - crítico para type safety
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/no-floating-promises": "error", // Previne promises não tratadas
    "@typescript-eslint/no-misused-promises": "error", // Previne uso incorreto de promises
    "@typescript-eslint/await-thenable": "error", // Garante await apenas em thenables

    // === REGRAS DE QUALIDADE ===
    "@typescript-eslint/no-unnecessary-type-assertion": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error", // Usa ?? em vez de ||
    "@typescript-eslint/prefer-optional-chain": "error", // Usa ?. para navigation

    // === REGRAS REACT ESPECÍFICAS ===
    "react/react-in-jsx-scope": "off", // React 18+ não precisa import
    "react/prop-types": "off", // TypeScript substitui PropTypes

    // === REGRAS DE DESENVOLVIMENTO ===
    "prettier/prettier": "error", // Formatação obrigatória
    "no-console": ["warn", { "allow": ["warn", "error"] }], // Apenas logs críticos
    "no-debugger": "error", // Proíbe debugger em produção
    "no-alert": "error", // Proíbe alert() - UX ruim
    "prefer-const": "error", // Força imutabilidade
    "no-var": "error", // Proíbe var legacy
    "eqeqeq": ["error", "always", { "null": "ignore" }], // Força === exceto para null
    "curly": ["error", "all"], // Força chaves em if/for/while
    "no-throw-literal": "error" // Força throw new Error()
  },
  "overrides": [
    // Configuração específica para arquivos de teste
    {
      "files": ["tests/**/*", "**/*.test.ts", "**/*.spec.ts"],
      "env": {
        "jest": true,
        "vitest-globals/env": true,
        "node": true
      },
      "globals": {
        "describe": "readonly",
        "it": "readonly",
        "expect": "readonly",
        "beforeAll": "readonly",
        "afterAll": "readonly",
        "beforeEach": "readonly",
        "afterEach": "readonly"
      }
    }
  ],
  "ignorePatterns": ["node_modules/", "dist/", "build/", "*.config.js", "*.config.ts", "demo/**/*"]
}
```

**Explicação Detalhada das Regras Críticas:**

**1. `@typescript-eslint/no-explicit-any`: "error"`**

- **Propósito**: Elimina completamente o uso de `any`, forçando tipagem explícita
- **Justificativa**: Em sistemas financeiros, types corretos previnem bugs de cálculo que podem custar milhões
- **Alternativa**: Use `unknown` para tipos desconhecidos e faça type narrowing

**2. `@typescript-eslint/no-floating-promises`: "error"`**

- **Propósito**: Previne promises não tratadas que podem causar silent failures
- **Justificativa**: Operações assíncronas falhas (ex: salvar proposta) devem ser explicitamente tratadas
- **Solução**: Sempre use `await` ou `.catch()` em promises

**3. `react-hooks/exhaustive-deps`: "warn"`**

- **Propósito**: Garante que todas as dependências de hooks sejam declaradas
- **Justificativa**: Previne bugs de estado inconsistente e renderizações infinitas
- **Exemplo**: `useEffect(() => {}, [dependency])` deve incluir TODAS as variáveis usadas

### 1.2. Configuração Completa do Prettier (`.prettierrc`)

O Prettier funciona como nosso "esteticista de código", garantindo formatação 100% consistente em toda a base de código. A configuração foi otimizada para legibilidade e colaboração em equipe.

```json
{
  "semi": true, // Ponto e vírgula obrigatório - clareza e consistência
  "trailingComma": "es5", // Vírgula final apenas onde ES5 permite
  "singleQuote": true, // Aspas simples por padrão - mais limpo
  "printWidth": 100, // 100 caracteres - balanceio legibilidade/densidade
  "tabWidth": 2, // 2 espaços - padrão da indústria TypeScript
  "useTabs": false, // Espaços > tabs - consistência cross-platform
  "endOfLine": "lf", // Line endings Unix - padrão para Docker/Linux
  "arrowParens": "always", // Parênteses em arrow functions - consistência
  "bracketSpacing": true, // Espaços em objetos: { foo: bar }
  "bracketSameLine": false // JSX closing bracket em nova linha - legibilidade
}
```

**Justificativas Técnicas das Configurações:**

**`printWidth: 100`**: Escolhido baseado em estudos de legibilidade que mostram que 80-120 caracteres é o range ótimo. 100 permite maior densidade sem sacrificar legibilidade em monitores modernos.

**`trailingComma: "es5"`**: Gera diffs Git mais limpos ao adicionar/remover items de arrays/objetos, mas mantém compatibilidade ES5 em funções.

**`singleQuote: true`**: Reduz ruído visual e é mais rápido de digitar. Exceção automática para strings que contêm aspas simples.

**`endOfLine: "lf"`**: Previne problemas cross-platform entre Windows (CRLF) e Unix (LF). Essencial para Docker e CI/CD.

### 1.3. Diretrizes de Estilo e Boas Práticas (TypeScript)

Estas convenções vão além do que as ferramentas podem automatizar e definem a "personalidade" do nosso código.

#### **Nomenclatura (Naming Conventions)**

**Interfaces e Tipos**

```typescript
// ✅ Correto - PascalCase descritivo
interface UserProfile {
  id: string;
  email: Email; // Value Object
  preferences: UserPreferences;
}

type PaymentStatus = 'pending' | 'completed' | 'failed';

// ❌ Incorreto
interface userProfile {} // camelCase
interface IUserProfile {} // Prefixo I desnecessário
type paymentStatus = string; // Não restrito
```

**Componentes React**

```typescript
// ✅ Correto - PascalCase com nomes descritivos
export function ProposalAnalysisCard({ proposal }: Props) {}
export const UserAvatar = ({ user }: AvatarProps) => {};

// ❌ Incorreto
export function proposalCard() {} // camelCase
export const userAv = () => {}; // Nome muito curto
```

**Variáveis e Funções**

```typescript
// ✅ Correto - camelCase descritivo
const userName = 'João Silva';
const calculateMonthlyPayment = (amount: number, rate: number) => {};
const isUserAuthenticated = user.authStatus === 'authenticated';

// ❌ Incorreto
const user_name = ''; // snake_case
const calc = () => {}; // Nome muito curto
const flag = true; // Nome não descritivo
```

**Constantes**

```typescript
// ✅ Correto - UPPER_SNAKE_CASE para constantes globais
const MAX_RETRIES = 3;
const API_BASE_URL = 'https://api.simpix.com';
const DATABASE_CONNECTION_TIMEOUT = 30000;

// Para enums, use PascalCase
enum ProposalStatus {
  DRAFT = 'draft',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
}
```

#### **Tipagem Explícita vs Inferência**

**Regra Geral**: Use inferência para variáveis simples, tipagem explícita para contratos públicos.

```typescript
// ✅ Inferência apropriada
const count = 0; // number inferido
const users = []; // any[] inferido - CUIDADO!
const users: User[] = []; // Melhor - tipo explícito

// ✅ Tipagem explícita obrigatória
export function calculateInterestRate(principal: number, rate: number, periods: number): number {
  return principal * (rate / 100) * periods;
}

// ✅ Para objetos complexos, sempre explicite
interface ProposalRequest {
  clientId: string;
  amount: number;
  termMonths: number;
  productId: string;
}

export async function createProposal(request: ProposalRequest): Promise<Proposal> {
  // implementação
}
```

#### **Uso de unknown vs any**

O tipo `any` é **PROIBIDO** no projeto. Para tipos desconhecidos, use `unknown` e realize type narrowing.

```typescript
// ❌ PROIBIDO - any desativa type checking
function processApiResponse(data: any) {
  return data.user.name; // Pode quebrar em runtime
}

// ✅ Correto - unknown com type narrowing
function processApiResponse(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'user' in data &&
    typeof data.user === 'object' &&
    data.user !== null &&
    'name' in data.user &&
    typeof data.user.name === 'string'
  ) {
    return data.user.name;
  }
  throw new Error('Invalid API response format');
}

// ✅ Ainda melhor - use um schema validator como Zod
const ApiResponseSchema = z.object({
  user: z.object({
    name: z.string(),
  }),
});

function processApiResponse(data: unknown): string {
  const validated = ApiResponseSchema.parse(data);
  return validated.user.name;
}
```

#### **Estrutura de Arquivos e Organização**

**Princípio**: Arquivos relacionados devem ficar próximos, com separação clara entre domínios.

```
client/src/
├── components/          # Componentes reutilizáveis
│   ├── ui/             # Componentes básicos (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── card.tsx
│   ├── forms/          # Formulários específicos do domínio
│   │   ├── ProposalForm/
│   │   │   ├── ProposalForm.tsx
│   │   │   ├── ProposalForm.test.tsx
│   │   │   └── index.ts
│   │   └── ClientForm/
│   └── domain/         # Componentes específicos do negócio
│       ├── proposals/
│       ├── clients/
│       └── analytics/
├── hooks/              # Custom hooks reutilizáveis
│   ├── useProposal.ts
│   ├── useAuth.ts
│   └── useLocalStorage.ts
├── pages/              # Páginas da aplicação
│   ├── propostas/
│   ├── clientes/
│   └── admin/
├── lib/                # Utilitários e configurações
│   ├── utils.ts
│   ├── apiClient.ts
│   └── validators.ts
└── types/              # Type definitions globais
    ├── api.ts
    ├── business.ts
    └── ui.ts
```

**Regras de Importação:**

```typescript
// ✅ Ordem correta de imports
// 1. Bibliotecas externas
import React from 'react';
import { z } from 'zod';
import { Button } from '@radix-ui/react-button';

// 2. Imports internos (organizados por nível)
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { ProposalCard } from '@/components/domain/proposals';

// 3. Imports relativos (sempre por último)
import './Component.css';

// ❌ Avoid default exports para componentes reutilizáveis
export default function Button() {}

// ✅ Prefer named exports
export function Button() {}
export { Button };
```

## 2. Protocolo de Versionamento

### 2.1. Estratégia de Branching: Git Flow Simplificado para Banking

Nosso modelo de branching foi adaptado para sistemas críticos onde estabilidade e rastreabilidade são primordiais.

```
main (PRODUÇÃO)
├── hotfix/critical-payment-bug
├── release/v2.1.0
│   ├── feature/proposal-automation
│   ├── feature/enhanced-security
│   └── bugfix/calculation-precision
└── develop (INTEGRAÇÃO)
    ├── feature/ai-risk-analysis
    ├── feature/mobile-app
    └── refactor/payment-engine
```

#### **Branch Hierarchy e Responsabilidades**

**1. `main` - Branch de Produção**

- **Status**: Sempre estável e deployable
- **Commits**: Apenas merges de `release/*` ou `hotfix/*`
- **Proteção**: Requires signed commits + 2 reviewer approval
- **CI/CD**: Deploy automático para produção após merge
- **Retention**: Histórico completo permanente

```bash
# Exemplo de merge para main
git checkout main
git merge --no-ff release/v2.1.0
git tag -a v2.1.0 -m "Release v2.1.0: Enhanced security and automation"
git push origin main --tags
```

**2. `develop` - Branch de Integração**

- **Status**: Latest development features
- **Commits**: Merges de `feature/*` e `bugfix/*`
- **Testing**: Full test suite + integration tests
- **CI/CD**: Deploy automático para staging environment

**3. `feature/<feature-name>` - Branches de Funcionalidade**

- **Origem**: Criada a partir de `develop`
- **Nomenclatura**: `feature/proposal-automation`, `feature/ai-risk-analysis`
- **Lifetime**: Temporária - deletada após merge
- **Testing**: Unit tests obrigatórios antes do merge

```bash
# Criação de feature branch
git checkout develop
git pull origin develop
git checkout -b feature/proposal-automation
# ... desenvolvimento ...
git push origin feature/proposal-automation
# Criar Pull Request para develop
```

**4. `release/<version>` - Branches de Release**

- **Origem**: Criada a partir de `develop` quando ready for production
- **Propósito**: Bug fixes, documentation, release preparation
- **Proibido**: New features
- **Merge**: Para `main` E `develop`

**5. `hotfix/<critical-issue>` - Correções Críticas**

- **Origem**: Criada a partir de `main`
- **Uso**: Apenas para bugs críticos de produção
- **Prioridade**: P0 - Deploy imediato após teste
- **Merge**: Para `main` E `develop`

```bash
# Exemplo de hotfix crítico
git checkout main
git checkout -b hotfix/payment-calculation-error
# ... correção ...
git commit -m "fix: correct interest calculation in payment engine"
# Merge para main e develop
```

### 2.2. Padrão de Comunicação: Conventional Commits

Nosso padrão de commits foi estendido para suportar auditoria bancária e rastreabilidade regulatória.

#### **Estrutura Mandatória**

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### **Tipos Principais com Classificação de Risco**

**`feat` - Novas Funcionalidades [RISCO: MÉDIO-ALTO]**

```bash
feat(auth): add two-factor authentication
feat(payment): implement PIX integration
feat(api): add proposal risk scoring endpoint
```

**`fix` - Correção de Bugs [RISCO: VARIÁVEL]**

```bash
fix(calc): correct CET calculation formula
fix(auth): prevent JWT token leakage in logs
fix(db): resolve race condition in payment processing
```

**`security` - Correções de Segurança [RISCO: CRÍTICO]**

```bash
security(auth): fix SQL injection in login endpoint
security(data): implement data encryption at rest
security(api): add rate limiting to prevent DDoS
```

**`perf` - Melhorias de Performance [RISCO: BAIXO-MÉDIO]**

```bash
perf(db): optimize proposal query with indexing
perf(api): implement Redis caching for user sessions
perf(frontend): lazy load proposal components
```

**`refactor` - Reestruturação [RISCO: MÉDIO]**

```bash
refactor(payment): extract payment processing to service
refactor(types): consolidate proposal type definitions
refactor(db): migrate to new schema structure
```

**`test` - Testes [RISCO: BAIXO]**

```bash
test(auth): add integration tests for login flow
test(payment): increase unit test coverage to 95%
test(e2e): add automated regression tests
```

**`docs` - Documentação [RISCO: NULO]**

```bash
docs(api): update endpoint documentation
docs(setup): add development environment guide
docs(security): document encryption key rotation
```

**`chore` - Manutenção [RISCO: BAIXO]**

```bash
chore(deps): update TypeScript to v5.2.0
chore(ci): optimize build pipeline performance
chore(lint): fix ESLint configuration warnings
```

#### **Scopes Permitidos (Bounded Contexts)**

```bash
# Domínios de Negócio
(auth)          # Autenticação e autorização
(proposal)      # Gestão de propostas
(payment)       # Processamento de pagamentos
(client)        # Gestão de clientes
(risk)          # Análise de risco
(compliance)    # Conformidade regulatória

# Camadas Técnicas
(api)           # Camada de API/endpoints
(db)            # Database e persistência
(ui)            # Interface do usuário
(infra)         # Infraestrutura e DevOps
(config)        # Configurações do sistema

# Funcionalidades Específicas
(calc)          # Calculadoras financeiras
(ccb)           # Geração de CCB
(webhook)       # Integração via webhooks
(worker)        # Background jobs
```

#### **Breaking Changes e Versionamento Semântico**

Para mudanças que quebram compatibilidade, use `!` após o tipo:

```bash
feat(api)!: change user ID from integer to UUID

BREAKING CHANGE: User IDs are now UUIDs instead of integers.
Migration script available at scripts/migrate-user-ids.sql
```

#### **Footers Especiais para Compliance**

```bash
feat(payment): implement anti-money laundering checks

Implements AML screening according to BACEN regulation 3.461/2018
Refs: JIRA-1234, COMPLIANCE-567
Reviewed-by: compliance-team@simpix.com
Security-review: security-team@simpix.com
```

### 2.3. Code Review e Quality Gates

#### **Processo de Review Obrigatório**

**1. Automated Checks (Pre-Review)**

```yaml
# .github/workflows/pull-request.yml
- ESLint (zero errors allowed)
- TypeScript compilation
- Unit tests (minimum 80% coverage)
- Security scan (SAST)
- Dependency vulnerability check
```

**2. Human Review Requirements**

- **Mínimo**: 2 aprovações para código de negócio
- **Crítico**: 3 aprovações + security team para auth/payment
- **Compliance**: Legal review para features regulatórias

**3. Review Checklist Template**

```markdown
## Code Review Checklist

### Functional Requirements

- [ ] Feature works as specified
- [ ] Error handling is comprehensive
- [ ] Edge cases are covered
- [ ] Performance impact is acceptable

### Security Review

- [ ] No hardcoded secrets or credentials
- [ ] Input validation is present
- [ ] SQL injection prevention
- [ ] XSS prevention measures

### Code Quality

- [ ] Code follows project conventions
- [ ] Functions are single-responsibility
- [ ] Complex logic is documented
- [ ] Tests cover happy and sad paths

### Banking Compliance

- [ ] Audit logging is implemented
- [ ] Data encryption requirements met
- [ ] Regulatory compliance validated
- [ ] Privacy requirements satisfied
```

## 3. Guia de Estilo de UI/UX

### 3.1. Design System Foundation

O design system do Simpix foi construído sobre princípios de **confiança, clareza e eficiência** - valores essenciais para interfaces financeiras.

#### **Fonte da Verdade do Design**

- **Figma Project**: [Simpix Design System](https://figma.com/simpix-design-system)
- **Component Library**: shadcn/ui com customizações bancárias
- **Documentation**: Storybook em desenvolvimento

### 3.2. Sistema de Cores

Nossa paleta foi desenvolvida considerando **acessibilidade WCAG 2.1 AA** e **psicologia das cores** para interfaces financeiras.

#### **Cores Primárias - Confiança e Segurança**

```css
:root {
  /* Primary - Azul Bancário (inspirado em instituições tradicionais) */
  --primary: 220 90% 56%; /* #1e40af - Azul confiável */
  --primary-foreground: 0 0% 98%; /* #fafafa - Branco quase puro */

  /* Secondary - Verde Financeiro (sucesso, aprovação) */
  --secondary: 142 76% 36%; /* #059669 - Verde aprovação */
  --secondary-foreground: 0 0% 9%; /* #171717 - Cinza escuro */
}
```

#### **Cores Semânticas - Estados e Feedback**

```css
:root {
  /* Success - Verde para aprovações e confirmações */
  --success: 142 71% 45%; /* #10b981 - Verde claro */
  --success-foreground: 0 0% 9%; /* #171717 */

  /* Destructive - Vermelho para rejeições e erros */
  --destructive: 0 84% 60%; /* #ef4444 - Vermelho visível */
  --destructive-foreground: 0 0% 98%; /* #fafafa */

  /* Warning - Amarelo/Laranja para pendências */
  --warning: 43 96% 56%; /* #f59e0b - Amarelo ouro */
  --warning-foreground: 0 0% 9%; /* #171717 */

  /* Info - Azul claro para informações */
  --info: 199 89% 48%; /* #0ea5e9 - Azul informativo */
  --info-foreground: 0 0% 98%; /* #fafafa */
}
```

#### **Cores Neutras - Estrutura e Legibilidade**

```css
:root {
  /* Background layers */
  --background: 0 0% 100%; /* #ffffff - Branco puro */
  --foreground: 240 10% 3.9%; /* #0a0a0a - Preto quase puro */

  /* Card and elevated surfaces */
  --card: 0 0% 100%; /* #ffffff */
  --card-foreground: 240 10% 3.9%; /* #0a0a0a */

  /* Muted backgrounds for secondary content */
  --muted: 240 4.8% 95.9%; /* #f1f5f9 - Cinza claro */
  --muted-foreground: 240 3.8% 46.1%; /* #64748b - Cinza médio */

  /* Borders and separators */
  --border: 240 5.9% 90%; /* #e2e8f0 - Cinza borda */
  --input: 240 5.9% 90%; /* #e2e8f0 - Mesmo que border */

  /* Focus rings and interactive states */
  --ring: 240 5% 64.9%; /* #94a3b8 - Cinza focus */
}
```

#### **Dark Mode Support (Tema Escuro)**

```css
.dark {
  --background: 240 10% 3.9%; /* #0a0a0a */
  --foreground: 0 0% 98%; /* #fafafa */

  --card: 240 10% 3.9%; /* #0a0a0a */
  --card-foreground: 0 0% 98%; /* #fafafa */

  --primary: 220 90% 56%; /* Mantém o azul primário */
  --primary-foreground: 0 0% 98%; /* #fafafa */

  --muted: 240 3.7% 15.9%; /* #262626 - Cinza escuro */
  --muted-foreground: 240 5% 64.9%; /* #94a3b8 */

  --border: 240 3.7% 15.9%; /* #262626 */
  --input: 240 3.7% 15.9%; /* #262626 */
}
```

### 3.3. Tipografia e Hierarquia

#### **Font Stack Banking-Grade**

```css
:root {
  --font-sans:
    'Poppins', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
    Arial, sans-serif;
  --font-mono: 'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace;
}
```

**Justificativa da Escolha:**

- **Poppins**: Font humanista que transmite confiança e modernidade
- **System fonts fallback**: Performance e consistência cross-platform
- **Monospace**: Para valores financeiros e códigos (importante para alinhamento)

#### **Escala Tipográfica Harmônica**

```css
/* Headings - Hierarquia visual clara */
.text-4xl {
  font-size: 2.25rem;
  line-height: 2.5rem;
} /* 36px - Page titles */
.text-3xl {
  font-size: 1.875rem;
  line-height: 2.25rem;
} /* 30px - Section headers */
.text-2xl {
  font-size: 1.5rem;
  line-height: 2rem;
} /* 24px - Card titles */
.text-xl {
  font-size: 1.25rem;
  line-height: 1.75rem;
} /* 20px - Subsections */
.text-lg {
  font-size: 1.125rem;
  line-height: 1.75rem;
} /* 18px - Large body */

/* Body text - Legibilidade otimizada */
.text-base {
  font-size: 1rem;
  line-height: 1.5rem;
} /* 16px - Default body */
.text-sm {
  font-size: 0.875rem;
  line-height: 1.25rem;
} /* 14px - Small text */
.text-xs {
  font-size: 0.75rem;
  line-height: 1rem;
} /* 12px - Captions */

/* Weight hierarchy */
.font-black {
  font-weight: 900;
} /* Emphasis extremo */
.font-bold {
  font-weight: 700;
} /* Headers principais */
.font-semibold {
  font-weight: 600;
} /* Headers secundários */
.font-medium {
  font-weight: 500;
} /* Call-to-actions */
.font-normal {
  font-weight: 400;
} /* Body text padrão */
.font-light {
  font-weight: 300;
} /* Text secundário */
```

#### **Guidelines de Uso Tipográfico**

```typescript
// ✅ Exemplo de hierarquia correta
export function ProposalCard({ proposal }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          Proposta #{proposal.number}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Cliente: {proposal.clientName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Valor Solicitado:</span>
            <span className="text-lg font-bold font-mono">
              R$ {formatCurrency(proposal.amount)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3.4. Espaçamento e Layout

#### **Sistema de Espaçamento Consistente**

Nossa escala de espaçamento segue uma progressão matemática que garante harmonia visual:

```css
/* Progressão: 4px base * powers of 2 + golden ratio adjustments */
.space-0 {
  gap: 0px;
} /* Sem espaçamento */
.space-0.5 {
  gap: 2px;
} /* Micro spacing */
.space-1 {
  gap: 4px;
} /* Tight spacing */
.space-1.5 {
  gap: 6px;
} /* Small spacing */
.space-2 {
  gap: 8px;
} /* Default spacing */
.space-3 {
  gap: 12px;
} /* Medium spacing */
.space-4 {
  gap: 16px;
} /* Large spacing */
.space-5 {
  gap: 20px;
} /* Extra large */
.space-6 {
  gap: 24px;
} /* Section spacing */
.space-8 {
  gap: 32px;
} /* Component spacing */
.space-10 {
  gap: 40px;
} /* Page section spacing */
.space-12 {
  gap: 48px;
} /* Major section spacing */
.space-16 {
  gap: 64px;
} /* Page-level spacing */
```

#### **Grid e Layout Patterns**

```typescript
// ✅ Layout de Dashboard Responsivo
export function DashboardLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header com altura fixa */}
      <header className="sticky top-0 z-50 h-16 bg-background border-b">
        <div className="container h-full flex items-center justify-between px-4">
          <Logo />
          <UserNav />
        </div>
      </header>

      {/* Main content com sidebar */}
      <div className="flex">
        <aside className="hidden md:block w-64 min-h-[calc(100vh-4rem)] bg-muted/30">
          <Navigation />
        </aside>

        <main className="flex-1 p-6 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// ✅ Grid de Cards Responsivo
export function ProposalGrid({ proposals }: Props) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {proposals.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} />
      ))}
    </div>
  );
}
```

### 3.5. Biblioteca de Componentes Reutilizáveis

Nossa biblioteca é baseada em **shadcn/ui** com extensões específicas para o domínio financeiro.

#### **Componentes Base (Foundation)**

**Button - Sistema de Variantes Completo**

```typescript
const buttonVariants = cva(
  // Base styles - comum a todas as variantes
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Banking-specific variants
        success: "bg-success text-success-foreground hover:bg-success/90",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        xl: "h-12 rounded-lg px-10 text-base", // Para CTAs importantes
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// ✅ Uso prático nos formulários
<Button variant="success" size="lg" type="submit">
  Aprovar Proposta
</Button>

<Button variant="destructive" size="default" onClick={handleReject}>
  Rejeitar
</Button>

<Button variant="outline" size="sm">
  Ver Detalhes
</Button>
```

**Input - Validação e Estados Visuais**

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, success, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leftIcon}
            </div>
          )}

          <input
            className={cn(
              // Base styles
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              // State-specific styles
              error && "border-destructive focus-visible:ring-destructive",
              success && "border-success focus-visible:ring-success",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className
            )}
            ref={ref}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);
```

#### **Componentes Financeiros Específicos**

**CurrencyInput - Input Monetário com Formatação**

```typescript
interface CurrencyInputProps extends Omit<InputProps, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
  currency?: 'BRL' | 'USD' | 'EUR';
  locale?: string;
}

export function CurrencyInput({
  value,
  onChange,
  currency = 'BRL',
  locale = 'pt-BR',
  ...props
}: CurrencyInputProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^\d]/g, '');
    const numericValue = parseInt(rawValue) / 100;
    onChange(numericValue);
  };

  return (
    <Input
      {...props}
      value={formatCurrency(value)}
      onChange={handleChange}
      className="font-mono text-right"
      leftIcon={<DollarSign className="h-4 w-4" />}
    />
  );
}
```

**StatusBadge - Badge para Status de Propostas**

```typescript
const statusVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        draft: "bg-muted text-muted-foreground",
        pending: "bg-warning/10 text-warning border border-warning/20",
        approved: "bg-success/10 text-success border border-success/20",
        rejected: "bg-destructive/10 text-destructive border border-destructive/20",
        completed: "bg-primary/10 text-primary border border-primary/20",
      }
    }
  }
);

interface StatusBadgeProps {
  status: ProposalStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusLabels = {
    draft: 'Rascunho',
    pending: 'Pendente',
    approved: 'Aprovada',
    rejected: 'Rejeitada',
    completed: 'Finalizada',
  };

  const statusIcons = {
    draft: <Edit className="w-3 h-3" />,
    pending: <Clock className="w-3 h-3" />,
    approved: <CheckCircle className="w-3 h-3" />,
    rejected: <XCircle className="w-3 h-3" />,
    completed: <Check className="w-3 h-3" />,
  };

  return (
    <span className={cn(statusVariants({ status }), className)}>
      {statusIcons[status]}
      {statusLabels[status]}
    </span>
  );
}
```

## 4. Arquitetura de Componentes

### 4.1. Padrão de Composição e Slots

Utilizamos o padrão **Compound Components** para componentes complexos, permitindo máxima flexibilidade sem sacrificar a consistência.

```typescript
// ✅ Compound Component Pattern
interface ProposalCardProps {
  children: React.ReactNode;
  className?: string;
}

interface ProposalCardHeaderProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
}

interface ProposalCardContentProps {
  children: React.ReactNode;
}

// Componente principal
export function ProposalCard({ children, className }: ProposalCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {children}
    </Card>
  );
}

// Sub-componentes
ProposalCard.Header = function ProposalCardHeader({
  children,
  actions
}: ProposalCardHeaderProps) {
  return (
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
      <div className="space-y-1">
        {children}
      </div>
      {actions && (
        <div className="flex items-center space-x-2">
          {actions}
        </div>
      )}
    </CardHeader>
  );
};

ProposalCard.Content = function ProposalCardContent({
  children
}: ProposalCardContentProps) {
  return (
    <CardContent className="space-y-4">
      {children}
    </CardContent>
  );
};

// ✅ Uso do compound component
export function ProposalList({ proposals }: Props) {
  return (
    <div className="grid gap-4">
      {proposals.map((proposal) => (
        <ProposalCard key={proposal.id}>
          <ProposalCard.Header
            actions={
              <>
                <Button variant="outline" size="sm">
                  Editar
                </Button>
                <Button variant="default" size="sm">
                  Analisar
                </Button>
              </>
            }
          >
            <CardTitle>Proposta #{proposal.number}</CardTitle>
            <CardDescription>
              Cliente: {proposal.client.name}
            </CardDescription>
          </ProposalCard.Header>

          <ProposalCard.Content>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Valor Solicitado</label>
                <p className="text-lg font-mono">
                  {formatCurrency(proposal.amount)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <StatusBadge status={proposal.status} />
              </div>
            </div>
          </ProposalCard.Content>
        </ProposalCard>
      ))}
    </div>
  );
}
```

### 4.2. Custom Hooks para Lógica Reutilizável

#### **useLocalStorage - State Persistente**

```typescript
function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // State para armazenar nosso valor
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Wrapper para setValue que persiste no localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}

// ✅ Uso prático
export function UserPreferences() {
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'light');
  const [language, setLanguage] = useLocalStorage<'pt' | 'en'>('language', 'pt');

  return (
    <div className="space-y-4">
      <Select value={theme} onValueChange={setTheme}>
        <SelectItem value="light">Claro</SelectItem>
        <SelectItem value="dark">Escuro</SelectItem>
      </Select>
    </div>
  );
}
```

#### **useDebounce - Performance em Inputs**

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ✅ Uso em busca de clientes
export function ClientSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients', debouncedSearchTerm],
    queryFn: () => searchClients(debouncedSearchTerm),
    enabled: debouncedSearchTerm.length > 2,
  });

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar cliente por nome ou CPF..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {isLoading && <LoadingSpinner />}

      <ClientList clients={clients} />
    </div>
  );
}
```

### 4.3. Error Boundaries e Tratamento de Erros

#### **ErrorBoundary Bancário**

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ProposalErrorBoundary extends Component<
  PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log para Sentry em produção
    console.error('Proposal Error Boundary caught an error:', error, errorInfo);

    // Reportar erro crítico
    if (process.env.NODE_ENV === 'production') {
      // Sentry.captureException(error, { extra: errorInfo });
    }

    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">
              Erro no Sistema de Propostas
            </CardTitle>
            <CardDescription>
              Ocorreu um erro inesperado. Nossa equipe foi notificada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Recarregar Página
              </Button>

              {process.env.NODE_ENV === 'development' && (
                <details className="text-sm">
                  <summary>Detalhes do Erro (Dev Mode)</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs bg-muted p-4 rounded">
                    {this.state.error?.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
```

## 5. Protocolos de Desenvolvimento

### 5.1. Fluxo de Desenvolvimento Feature-Complete

#### **Processo de Desenvolvimento de Features**

**1. Planning & Analysis**

```bash
# Criar branch de feature
git checkout develop
git pull origin develop
git checkout -b feature/proposal-risk-scoring

# Estrutura inicial de arquivos
mkdir -p client/src/components/risk-analysis
mkdir -p server/modules/risk/domain
mkdir -p server/modules/risk/application
mkdir -p server/modules/risk/infrastructure
```

**2. TDD (Test-Driven Development)**

```typescript
// ✅ Começar sempre com o teste
// tests/risk-analysis.test.ts
describe('Risk Analysis Service', () => {
  it('should calculate risk score for low-risk client', async () => {
    const client = createMockClient({ creditScore: 800, income: 10000 });
    const proposal = createMockProposal({ amount: 50000, term: 24 });

    const riskScore = await riskAnalysisService.calculateRisk(client, proposal);

    expect(riskScore.score).toBeGreaterThan(0.8);
    expect(riskScore.category).toBe('LOW_RISK');
  });
});

// Implementar a funcionalidade para passar no teste
export class RiskAnalysisService {
  async calculateRisk(client: Client, proposal: Proposal): Promise<RiskScore> {
    // Implementação aqui
  }
}
```

**3. Implementation Pattern**

```typescript
// ✅ Seguir arquitetura em camadas
// 1. Domain (regras de negócio)
export class RiskScore {
  constructor(
    private readonly score: number,
    private readonly category: RiskCategory,
    private readonly factors: RiskFactor[]
  ) {
    this.validateInvariants();
  }

  private validateInvariants() {
    if (this.score < 0 || this.score > 1) {
      throw new DomainException('Risk score must be between 0 and 1');
    }
  }
}

// 2. Application (casos de uso)
export class CalculateRiskScoreUseCase {
  constructor(
    private readonly riskRepository: RiskRepository,
    private readonly clientRepository: ClientRepository
  ) {}

  async execute(request: CalculateRiskRequest): Promise<RiskScore> {
    // Orquestração dos serviços de domínio
  }
}

// 3. Infrastructure (detalhes técnicos)
export class PostgresRiskRepository implements RiskRepository {
  async saveRiskScore(riskScore: RiskScore): Promise<void> {
    // Implementação específica do PostgreSQL
  }
}

// 4. Presentation (controllers)
export class RiskController {
  async calculateRisk(req: Request, res: Response): Promise<void> {
    // Validação de entrada e resposta HTTP
  }
}
```

### 5.2. Code Review Guidelines

#### **Checklist de Review Completo**

**Security & Banking Compliance**

```markdown
## Security Review Checklist

### Input Validation

- [ ] Todos os inputs são validados usando Zod schemas
- [ ] SQL injection prevention está implementada
- [ ] XSS prevention em outputs que vão para o DOM
- [ ] Sanitização adequada de dados sensíveis

### Authentication & Authorization

- [ ] Endpoints protegidos requerem autenticação
- [ ] Autorização baseada em papéis implementada
- [ ] Tokens JWT têm expiração adequada
- [ ] Refresh token rotation implementado

### Data Protection

- [ ] Dados pessoais são criptografados at-rest
- [ ] Logs não contêm informações sensíveis
- [ ] PII masking implementado onde necessário
- [ ] Backup e recovery considerados

### Banking Regulations

- [ ] Audit trails completos para operações críticas
- [ ] Compliance com LGPD verificado
- [ ] Regulamentações BACEN consideradas
- [ ] Rate limiting implementado
```

**Code Quality Standards**

```markdown
## Code Quality Checklist

### TypeScript & Type Safety

- [ ] Uso de 'any' evitado (usar 'unknown' quando necessário)
- [ ] Interfaces bem definidas para contratos de API
- [ ] Generic types usados apropriadamente
- [ ] Type guards implementados para runtime validation

### React Best Practices

- [ ] Componentes são single-responsibility
- [ ] Custom hooks extraem lógica reutilizável
- [ ] Error boundaries implementados
- [ ] Accessibility (a11y) considerado
- [ ] Performance otimizada (React.memo, useCallback quando apropriado)

### Testing

- [ ] Unit tests cobrem happy path e edge cases
- [ ] Integration tests para fluxos críticos
- [ ] E2E tests para user journeys principais
- [ ] Coverage mínimo de 80% atingido

### Performance

- [ ] Lazy loading implementado onde apropriado
- [ ] Database queries otimizadas
- [ ] Caching strategies implementadas
- [ ] Bundle size impact considerado
```

### 5.3. Debugging e Troubleshooting

#### **Estratégia de Debug Sistemática**

**1. Client-Side Debugging**

```typescript
// ✅ Logging estruturado no frontend
const logger = {
  info: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[INFO] ${message}`, data);
    }
  },

  error: (message: string, error?: Error, data?: any) => {
    console.error(`[ERROR] ${message}`, { error, data });

    // Reportar para Sentry em produção
    if (process.env.NODE_ENV === 'production') {
      // Sentry.captureException(error, { extra: { message, data } });
    }
  },

  warning: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data);
  },
};

// Uso em componentes
export function ProposalForm() {
  const { mutate: createProposal } = useMutation({
    mutationFn: (data: ProposalData) => {
      logger.info('Creating proposal', { clientId: data.clientId });
      return apiClient.createProposal(data);
    },
    onError: (error) => {
      logger.error('Failed to create proposal', error, { userId: user.id });
      toast.error('Erro ao criar proposta. Tente novamente.');
    },
    onSuccess: (proposal) => {
      logger.info('Proposal created successfully', { proposalId: proposal.id });
      toast.success('Proposta criada com sucesso!');
    },
  });
}
```

**2. Server-Side Debugging**

```typescript
// ✅ Winston logger configurado para banking
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'simpix-api',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
  },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

// Performance e audit logging
export const auditLogger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({
      filename: 'logs/audit.log',
    }),
  ],
});

// Middleware de audit para endpoints críticos
export function auditMiddleware(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      auditLogger.info('API Operation', {
        action,
        userId: req.user?.id,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
    });

    next();
  };
}
```

**3. Database Query Debugging**

```typescript
// ✅ Query logging e optimization
export class ProposalRepository {
  async findById(id: string): Promise<Proposal | null> {
    const startTime = Date.now();

    try {
      const result = await this.db
        .select()
        .from(proposals)
        .where(eq(proposals.id, id))
        .leftJoin(clients, eq(proposals.clientId, clients.id))
        .leftJoin(products, eq(proposals.productId, products.id));

      const queryTime = Date.now() - startTime;

      // Log slow queries (> 100ms)
      if (queryTime > 100) {
        logger.warn('Slow query detected', {
          query: 'ProposalRepository.findById',
          duration: queryTime,
          proposalId: id,
        });
      }

      return result[0] ? Proposal.fromDatabase(result[0]) : null;
    } catch (error) {
      logger.error('Database query failed', error, {
        query: 'ProposalRepository.findById',
        proposalId: id,
      });
      throw error;
    }
  }
}
```

### 5.4. Performance Monitoring

#### **Métricas Críticas de Performance**

```typescript
// ✅ Performance monitoring hooks
export function usePerformanceMonitoring(operation: string) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>();

  const startMeasurement = useCallback(() => {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize;

    return {
      end: () => {
        const endTime = performance.now();
        const endMemory = (performance as any).memory?.usedJSHeapSize;

        const measurement = {
          operation,
          duration: endTime - startTime,
          memoryDelta: endMemory ? endMemory - startMemory : 0,
          timestamp: new Date().toISOString()
        };

        setMetrics(measurement);

        // Log slow operations
        if (measurement.duration > 1000) {
          logger.warning('Slow operation detected', measurement);
        }

        return measurement;
      }
    };
  }, [operation]);

  return { metrics, startMeasurement };
}

// Uso em componentes críticos
export function ProposalAnalysis({ proposalId }: Props) {
  const { metrics, startMeasurement } = usePerformanceMonitoring('proposal-analysis');

  const { data: analysis, isLoading } = useQuery({
    queryKey: ['proposal-analysis', proposalId],
    queryFn: async () => {
      const measurement = startMeasurement();
      try {
        const result = await analyzeProposal(proposalId);
        return result;
      } finally {
        measurement.end();
      }
    }
  });

  return (
    <div>
      {/* Component content */}
      {process.env.NODE_ENV === 'development' && metrics && (
        <div className="text-xs text-muted-foreground">
          Analysis took {metrics.duration.toFixed(2)}ms
        </div>
      )}
    </div>
  );
}
```

## 6. Testing Strategy

### 6.1. Pyramid de Testes Banking-Grade

Nossa estratégia de testes prioriza **confiabilidade** sobre velocidade de execução, adequada para sistemas financeiros.

```
                 E2E Tests (10%)
               ├─ Critical user journeys
               ├─ Complete proposal workflow
               └─ Payment processing flows

            Integration Tests (20%)
          ├─ API endpoint testing
          ├─ Database operations
          ├─ External service mocking
          └─ Authentication flows

       Unit Tests (70%)
     ├─ Business logic validation
     ├─ Domain model testing
     ├─ Utility functions
     ├─ Component testing
     └─ Financial calculations
```

#### **Unit Tests - Fundação da Qualidade**

```typescript
// ✅ Domain model testing
describe('Proposal Domain Model', () => {
  describe('financial calculations', () => {
    it('should calculate CET correctly for 24-month loan', () => {
      const proposal = new Proposal({
        amount: Money.fromReais(100000),
        termMonths: 24,
        interestRate: 2.5, // 2.5% ao mês
        iof: 3.38,
        tac: 500
      });

      const cet = proposal.calculateCET();

      // CET deve incluir juros + IOF + TAC
      expect(cet.getPercentual()).toBeCloseTo(31.17, 2);
    });

    it('should throw error for invalid interest rate', () => {
      expect(() => {
        new Proposal({
          amount: Money.fromReais(50000),
          termMonths: 12,
          interestRate: 15, // Taxa acima do limite legal
          iof: 3.38,
          tac: 0
        });
      }).toThrow('Interest rate exceeds legal limit');
    });
  });

  describe('business rules validation', () => {
    it('should enforce minimum loan amount', () => {
      expect(() => {
        new Proposal({
          amount: Money.fromReais(500), // Abaixo do mínimo
          termMonths: 12,
          interestRate: 2.0,
          iof: 3.38,
          tac: 0
        });
      }).toThrow('Loan amount below minimum threshold');
    });
  });
});

// ✅ Component testing com React Testing Library
describe('ProposalForm', () => {
  const mockCreateProposal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should validate required fields before submission', async () => {
    render(
      <ProposalForm
        onSubmit={mockCreateProposal}
        clients={mockClients}
      />
    );

    const submitButton = screen.getByRole('button', { name: /criar proposta/i });
    await user.click(submitButton);

    // Verificar mensagens de erro
    expect(screen.getByText(/cliente é obrigatório/i)).toBeInTheDocument();
    expect(screen.getByText(/valor é obrigatório/i)).toBeInTheDocument();
    expect(mockCreateProposal).not.toHaveBeenCalled();
  });

  it('should format currency input correctly', async () => {
    render(<ProposalForm onSubmit={mockCreateProposal} clients={mockClients} />);

    const amountInput = screen.getByLabelText(/valor solicitado/i);
    await user.type(amountInput, '50000');

    // Verificar formatação monetária
    expect(amountInput).toHaveValue('R$ 50.000,00');
  });

  it('should calculate installment preview in real-time', async () => {
    render(<ProposalForm onSubmit={mockCreateProposal} clients={mockClients} />);

    // Preencher campos necessários
    await user.selectOptions(screen.getByLabelText(/cliente/i), 'client-1');
    await user.type(screen.getByLabelText(/valor/i), '100000');
    await user.selectOptions(screen.getByLabelText(/prazo/i), '24');

    // Verificar cálculo automático
    await waitFor(() => {
      expect(screen.getByText(/parcela estimada/i)).toBeInTheDocument();
      expect(screen.getByText(/r\$ 4\.817,12/i)).toBeInTheDocument();
    });
  });
});
```

#### **Integration Tests - Validação de Fluxos**

```typescript
// ✅ API integration testing
describe('Proposal API Integration', () => {
  let app: Express;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    app = createTestApp(testDb);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    await testDb.reset();
  });

  describe('POST /api/proposals', () => {
    it('should create proposal with valid data', async () => {
      const client = await testDb.createClient({
        name: 'João Silva',
        cpf: '12345678901',
        income: 5000,
      });

      const proposalData = {
        clientId: client.id,
        amount: 50000,
        termMonths: 24,
        productId: 'personal-loan',
      };

      const response = await request(app).post('/api/proposals').send(proposalData).expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        status: 'draft',
        amount: 50000,
        termMonths: 24,
        client: {
          id: client.id,
          name: 'João Silva',
        },
      });

      // Verificar no banco de dados
      const savedProposal = await testDb.findProposal(response.body.id);
      expect(savedProposal).toBeDefined();
      expect(savedProposal.amount).toBe(50000);
    });

    it('should return 400 for invalid client ID', async () => {
      const proposalData = {
        clientId: 'invalid-id',
        amount: 50000,
        termMonths: 24,
        productId: 'personal-loan',
      };

      const response = await request(app).post('/api/proposals').send(proposalData).expect(400);

      expect(response.body.error).toMatch(/client not found/i);
    });
  });

  describe('Authentication integration', () => {
    it('should require valid JWT token', async () => {
      await request(app).get('/api/proposals').expect(401);

      await request(app)
        .get('/api/proposals')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should allow access with valid token', async () => {
      const token = generateTestJWT({ userId: 'user-1', role: 'analyst' });

      await request(app).get('/api/proposals').set('Authorization', `Bearer ${token}`).expect(200);
    });
  });
});
```

#### **E2E Tests - Jornadas Críticas do Usuário**

```typescript
// ✅ Playwright E2E testing
import { test, expect } from '@playwright/test';

test.describe('Proposal Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login como analista
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'analista@simpix.com');
    await page.fill('[data-testid="password-input"]', 'senha123');
    await page.click('[data-testid="login-button"]');

    // Aguardar redirect para dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('should create complete proposal end-to-end', async ({ page }) => {
    // Navegar para criação de proposta
    await page.click('[data-testid="create-proposal-button"]');
    await expect(page).toHaveURL('/propostas/nova');

    // Passo 1: Selecionar cliente
    await page.click('[data-testid="client-search-input"]');
    await page.fill('[data-testid="client-search-input"]', 'João Silva');
    await page.click('[data-testid="client-option-12345678901"]');

    // Passo 2: Preencher dados financeiros
    await page.fill('[data-testid="amount-input"]', '100000');
    await page.selectOption('[data-testid="term-select"]', '24');
    await page.selectOption('[data-testid="product-select"]', 'personal-loan');

    // Verificar cálculo automático
    await expect(page.locator('[data-testid="monthly-payment"]')).toContainText('R$ 4.817,12');
    await expect(page.locator('[data-testid="total-amount"]')).toContainText('R$ 115.610,88');

    // Passo 3: Adicionar finalidade
    await page.fill('[data-testid="purpose-input"]', 'Capital de giro');

    // Passo 4: Submeter proposta
    await page.click('[data-testid="submit-proposal-button"]');

    // Verificar criação bem-sucedida
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      'Proposta criada com sucesso'
    );

    // Verificar redirect para listagem
    await expect(page).toHaveURL(/\/propostas/);

    // Verificar proposta na lista
    await expect(page.locator('[data-testid="proposal-list"]')).toContainText('João Silva');
    await expect(page.locator('[data-testid="proposal-list"]')).toContainText('R$ 100.000,00');
  });

  test('should handle validation errors gracefully', async ({ page }) => {
    await page.goto('/propostas/nova');

    // Tentar submeter sem preencher campos obrigatórios
    await page.click('[data-testid="submit-proposal-button"]');

    // Verificar mensagens de erro
    await expect(page.locator('[data-testid="client-error"]')).toContainText(
      'Cliente é obrigatório'
    );
    await expect(page.locator('[data-testid="amount-error"]')).toContainText('Valor é obrigatório');

    // Preencher valor inválido
    await page.fill('[data-testid="amount-input"]', '500'); // Abaixo do mínimo
    await page.click('[data-testid="submit-proposal-button"]');

    await expect(page.locator('[data-testid="amount-error"]')).toContainText(
      'Valor mínimo é R$ 1.000,00'
    );
  });
});

test.describe('Proposal Analysis Flow', () => {
  test('analyst can approve proposal with conditions', async ({ page }) => {
    // Criar proposta via API para teste
    const proposalId = await createTestProposal({
      clientName: 'Maria Santos',
      amount: 75000,
      term: 36,
    });

    await page.goto(`/propostas/${proposalId}/analise`);

    // Verificar dados da proposta
    await expect(page.locator('[data-testid="client-name"]')).toContainText('Maria Santos');
    await expect(page.locator('[data-testid="proposal-amount"]')).toContainText('R$ 75.000,00');

    // Executar análise automática
    await page.click('[data-testid="run-analysis-button"]');

    // Aguardar resultado da análise
    await expect(page.locator('[data-testid="risk-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="recommendation"]')).toContainText(
      'Aprovação recomendada'
    );

    // Aprovar com condições
    await page.click('[data-testid="approve-button"]');
    await page.fill(
      '[data-testid="conditions-textarea"]',
      'Solicitar comprovante de renda atualizado'
    );
    await page.click('[data-testid="confirm-approval-button"]');

    // Verificar aprovação
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('Aprovada');
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      'Proposta aprovada com sucesso'
    );
  });
});
```

### 6.2. Continuous Testing e Coverage

#### **Coverage Requirements**

```json
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 85,
          functions: 90,
          lines: 85,
          statements: 85
        },
        // Exigências mais rigorosas para módulos críticos
        'server/modules/financial/': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        'server/modules/payment/': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    }
  }
});
```

## 7. Deployment e DevOps

### 7.1. Pipeline de CI/CD Banking-Grade

```yaml
# .github/workflows/ci-cd.yml
name: Banking-Grade CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '18.x'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  security-scan:
    name: Security Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  quality-gate:
    name: Quality Gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type checking
        run: npm run check

      - name: Linting
        run: npm run lint -- --max-warnings 0

      - name: Unit tests
        run: npm run test:unit -- --coverage

      - name: Integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3

  build-and-test:
    name: Build & E2E Tests
    runs-on: ubuntu-latest
    needs: [security-scan, quality-gate]

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
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/simpix_test

      - name: Upload E2E artifacts
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build-and-test
    if: github.ref == 'refs/heads/develop'

    environment:
      name: staging
      url: https://staging.simpix.app

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # Deployment logic here

      - name: Run smoke tests
        run: npm run test:smoke -- --env=staging

      - name: Notify team
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build-and-test
    if: github.ref == 'refs/heads/main'

    environment:
      name: production
      url: https://app.simpix.com

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          echo "Deploying to production..."
          # Blue-green deployment logic

      - name: Run production health checks
        run: npm run test:health -- --env=production

      - name: Rollback on failure
        if: failure()
        run: |
          echo "Rolling back deployment..."
          # Rollback logic
```

## 8. Conclusão e Próximos Passos

### 8.1. Resumo dos Padrões Estabelecidos

Este manual codifica os **padrões operacionais críticos** para desenvolvimento bancário no projeto Simpix:

**✅ Qualidade de Código Inegociável:**

- ESLint + TypeScript strict para prevenção de bugs críticos
- Prettier para consistência visual total
- Zero tolerance para `any` types e silent failures

**✅ Versionamento e Colaboração:**

- Git Flow adaptado para sistemas críticos
- Conventional Commits com classificação de risco
- Code review obrigatório com checklists de segurança

**✅ Design System Bancário:**

- Paleta de cores baseada em confiança e acessibilidade
- Componentes financeiros especializados (CurrencyInput, StatusBadge)
- Typography otimizada para legibilidade de dados críticos

**✅ Testing Strategy 70/20/10:**

- Unit tests para business logic e calculations
- Integration tests para API e database operations
- E2E tests para critical user journeys

**✅ DevOps Banking-Grade:**

- Security scanning automático
- Multi-stage deployment com health checks
- Monitoring e observability completa

### 8.2. Próximos Documentos Recomendados

**1. `04-runbook-operacional.md`** - Procedimentos de produção, troubleshooting e incident response

**2. `05-security-playbook.md`** - Protocolos de segurança detalhados, threat modeling e response plans

**3. `06-api-reference.md`** - Documentação completa de todas as APIs com exemplos e schemas

### 8.3. Enforcement e Evolução

**Automation Enforcement:**

- Pre-commit hooks validam todos os padrões automaticamente
- CI/CD pipeline falha se padrões não forem seguidos
- Monitoring contínuo de adherence aos guidelines

**Continuous Improvement:**

- Review trimestral dos padrões baseado em lessons learned
- Feedback loops com equipe de desenvolvimento
- Atualização baseada em mudanças regulatórias

---

**Este manual é um documento vivo que evolui com o projeto. Toda contribuição deve manter os padrões de qualidade e segurança estabelecidos, garantindo que o Simpix continue sendo uma plataforma confiável para o setor financeiro brasileiro.**

**Versão:** 3.0  
**Próxima revisão:** Q4 2025  
**Responsável:** Simpix Technical Team
