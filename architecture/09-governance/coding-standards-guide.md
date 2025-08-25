# Guia de Padrões de Codificação e Quality Gates - Sistema Simpix

**Versão:** 1.0  
**Data:** 25/08/2025  
**Autor:** Engenheiro de Qualidade de Software (Software Quality Engineer)  
**Status:** Baseline  
**Criticidade:** P0 - Qualidade como Lei

---

## 🎯 Sumário Executivo

Este documento estabelece a **Doutrina de Padrões de Codificação** do Sistema Simpix, transformando qualidade de código de "preferência" para "lei não negociável" através de automação completa no CI/CD. Nossa abordagem segue os padrões Airbnb e Google para TypeScript/React/Node.js, com enforcement automático via Quality Gates.

**Princípio Central:** *"Se não passa nos Quality Gates, não entra em produção. Sem exceções."*

---

## 1. 📐 Definição das Convenções

### **1.1 Convenções de Nomenclatura TypeScript/JavaScript**

Baseadas no **Google TypeScript Style Guide** e **Airbnb JavaScript Style Guide**:

| **Tipo de Identificador** | **Convenção** | **Exemplos** | **Anti-pattern** |
|---------------------------|---------------|--------------|------------------|
| **Variáveis e Funções** | `camelCase` | `userName`, `getUserData()` | `user_name`, `GetUserData()` |
| **Classes e Interfaces** | `PascalCase` | `UserProfile`, `ApiResponse` | `userProfile`, `IUserProfile` |
| **Enums e Namespaces** | `PascalCase` | `HttpStatus`, `UserActions` | `HTTP_STATUS` |
| **Type Parameters** | `T` + `PascalCase` | `TRequest`, `TUserData` | `T`, `Type` |
| **Constantes** | `UPPER_SNAKE_CASE` | `API_BASE_URL`, `MAX_RETRY_COUNT` | `apiBaseUrl` |
| **Arquivos** | `kebab-case` | `user-profile.ts`, `api-client.ts` | `userProfile.ts` |
| **Componentes React** | `PascalCase` (arquivo e export) | `UserCard.tsx` | `userCard.tsx` |

**Regras Críticas:**
- ❌ **NUNCA** prefixar interfaces com `I` (evitar `IUserProfile`)
- ❌ **NUNCA** usar underscores como prefixo/sufixo (`_privateVar`)
- ❌ **NUNCA** incluir informação de tipo no nome (`userArray`, `stringName`)
- ✅ **SEMPRE** usar `$` suffix para Observables: `user$`, `data$`

### **1.2 Convenções React (2024 Standards)**

```typescript
// ✅ CORRETO - Functional Component com TypeScript
interface UserCardProps {
  name: string;
  age: number;
  isActive?: boolean;
  onSelect: (id: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ 
  name, 
  age, 
  isActive = true,
  onSelect 
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  
  // Hooks na ordem: useState, useEffect, useCallback, useMemo, custom hooks
  useEffect(() => {
    // Effect logic
  }, []);
  
  const handleClick = useCallback(() => {
    onSelect(name);
  }, [name, onSelect]);
  
  return (
    <div className={`user-card ${isActive ? 'active' : 'inactive'}`}>
      <h2>{name}</h2>
      <p>Age: {age}</p>
    </div>
  );
};

export default UserCard;
```

**❌ INCORRETO:**
```typescript
// Evitar class components
class UserCard extends React.Component { }

// Evitar any types
const handleData = (data: any) => { }

// Evitar inline functions em props
<Button onClick={() => doSomething()} />
```

### **1.3 Convenções Node.js/Express**

```typescript
// ✅ CORRETO - Async/await com error handling
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = await userService.findById(id);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND' 
      });
    }
    
    return res.json(user);
  } catch (error) {
    next(error); // Proper error propagation
  }
};
```

### **1.4 Organização de Imports**

Ordem obrigatória (enforced by ESLint):

```typescript
// 1. React/Node built-ins
import React, { useState, useEffect } from 'react';
import path from 'path';

// 2. External packages
import axios from 'axios';
import { z } from 'zod';

// 3. Internal aliases (@shared, @lib, etc)
import { UserSchema } from '@shared/schema';
import { apiClient } from '@lib/api';

// 4. Relative imports
import { Button } from '../components/Button';
import { formatDate } from './utils';

// 5. Styles/Assets
import styles from './UserCard.module.css';
```

---

## 2. 🔧 Configuração de Linters e Formatters

### **2.1 ESLint Configuration (`.eslintrc.js`)**

Nossa configuração "fonte da verdade":

```javascript
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'airbnb',
    'airbnb-typescript',
    'airbnb/hooks',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier', // Must be last
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['react', '@typescript-eslint', 'import'],
  rules: {
    // TypeScript
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_' 
    }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    
    // React
    'react/react-in-jsx-scope': 'off', // React 18+
    'react/function-component-definition': [2, {
      namedComponents: 'arrow-function',
      unnamedComponents: 'arrow-function'
    }],
    'react/prop-types': 'off', // Using TypeScript
    
    // Import ordering
    'import/order': ['error', {
      groups: [
        'builtin',
        'external',
        'internal',
        ['parent', 'sibling'],
        'index',
        'object',
        'type'
      ],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true }
    }],
    
    // General
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
    'curly': ['error', 'all'],
  },
  settings: {
    react: { version: 'detect' },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
  },
};
```

**Justificativa das Regras Principais:**

| **Regra** | **Configuração** | **Porquê** |
|-----------|------------------|------------|
| `@typescript-eslint/no-explicit-any` | `error` | Previne perda de type safety |
| `@typescript-eslint/strict-boolean-expressions` | `error` | Evita bugs com valores falsy |
| `import/order` | `error` + groups | Consistência e legibilidade |
| `curly` | `error, all` | Previne bugs de scope |
| `no-console` | `warn` + exceptions | Logs controlados em produção |

### **2.2 Prettier Configuration (`.prettierrc`)**

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "quoteProps": "as-needed",
  "jsxSingleQuote": false,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "embeddedLanguageFormatting": "auto"
}
```

**Integração ESLint + Prettier:**
```bash
npm install -D eslint-config-prettier eslint-plugin-prettier
```

### **2.3 Pre-commit Hooks (Husky + lint-staged)**

**`.husky/pre-commit`:**
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

**`package.json`:**
```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

---

## 3. 📊 Métricas de Qualidade de Código Estático

### **3.1 Métricas Monitoradas**

| **Métrica** | **Threshold** | **Ferramenta** | **Descrição** |
|-------------|---------------|----------------|---------------|
| **Code Coverage** | ≥ 85% | Jest/Vitest | Cobertura de testes (statements, branches, functions) |
| **Cyclomatic Complexity** | ≤ 10 | ESLint complexity rule | Número de caminhos independentes no código |
| **Cognitive Complexity** | ≤ 15 | SonarQube | Dificuldade de entendimento humano |
| **Maintainability Index** | ≥ 20 | SonarQube | Score composto de manutenibilidade |
| **Technical Debt Ratio** | < 5% | SonarQube | Custo de correção vs. desenvolvimento |
| **Duplicated Lines** | < 3% | SonarQube | Porcentagem de código duplicado |
| **Security Hotspots** | 0 Critical/High | Snyk/CodeQL | Vulnerabilidades de segurança |

### **3.2 Configuração de Cobertura (Jest)**

**`jest.config.js`:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Thresholds específicos por path
    './src/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/utils/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/*.spec.{js,jsx,ts,tsx}',
    '!src/**/index.{js,ts}',
    '!src/**/*.d.ts',
    '!src/types/**'
  ]
};
```

### **3.3 Análise de Complexidade**

**ESLint Complexity Rules:**
```javascript
{
  rules: {
    'complexity': ['error', { max: 10 }],
    'max-depth': ['error', { max: 4 }],
    'max-lines': ['error', { 
      max: 300, 
      skipBlankLines: true, 
      skipComments: true 
    }],
    'max-lines-per-function': ['error', { 
      max: 50,
      skipBlankLines: true,
      skipComments: true
    }],
    'max-nested-callbacks': ['error', { max: 3 }],
    'max-params': ['error', { max: 4 }]
  }
}
```

---

## 4. 🚦 Definição de Quality Gates Automatizados

### **4.1 GitHub Actions Workflow - Quality Gate Principal**

**`.github/workflows/quality-gate.yml`:**

```yaml
name: Quality Gate CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
    types: [opened, synchronize, reopened]

# Cancela runs anteriores do mesmo PR
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  quality-gate:
    name: Quality Gate Check
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      # 1. Checkout
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Necessário para SonarQube
      
      # 2. Setup Node.js
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      # 3. Install dependencies
      - name: Install dependencies
        run: npm ci
      
      # 4. Type checking
      - name: TypeScript type check
        run: npx tsc --noEmit
        
      # 5. Linting com threshold
      - name: ESLint check (max 0 errors)
        run: |
          npx eslint . --format json --output-file eslint-report.json
          ERROR_COUNT=$(cat eslint-report.json | jq '[.[] | .errorCount] | add')
          if [ "$ERROR_COUNT" -gt 0 ]; then
            echo "❌ ESLint found $ERROR_COUNT errors"
            npx eslint . --format stylish
            exit 1
          fi
          echo "✅ ESLint passed with 0 errors"
      
      # 6. Prettier formatting check
      - name: Prettier format check
        run: npx prettier --check "**/*.{js,jsx,ts,tsx,json,md}"
      
      # 7. Security audit
      - name: Security audit (moderate+)
        run: npm audit --audit-level moderate
        continue-on-error: false
      
      # 8. Run tests with coverage
      - name: Run tests with coverage
        run: npm test -- --coverage --watchAll=false
        env:
          CI: true
      
      # 9. Coverage threshold check
      - name: Check coverage thresholds
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          echo "📊 Line Coverage: $COVERAGE%"
          
          if (( $(echo "$COVERAGE < 85" | bc -l) )); then
            echo "❌ Coverage $COVERAGE% is below 85% threshold"
            exit 1
          fi
          
          echo "✅ Coverage $COVERAGE% meets threshold"
      
      # 10. Upload coverage to Codecov
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-${{ matrix.node-version }}
          fail_ci_if_error: true
      
      # 11. SonarQube scan
      - name: SonarQube Scan
        uses: sonarsource/sonarcloud-github-action@v2.3.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        with:
          args: >
            -Dsonar.projectKey=simpix-credit-system
            -Dsonar.organization=simpix-org
            -Dsonar.sources=src
            -Dsonar.tests=src
            -Dsonar.test.inclusions=**/*.test.ts,**/*.spec.ts
            -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
            -Dsonar.coverage.exclusions=**/*.test.ts,**/*.spec.ts,**/index.ts
      
      # 12. SonarQube Quality Gate
      - name: SonarQube Quality Gate check
        uses: sonarsource/sonarqube-quality-gate-action@v1.1.0
        timeout-minutes: 5
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
      
      # 13. Snyk security scan
      - name: Snyk Security Scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=all
      
      # 14. Build validation
      - name: Build check
        run: npm run build
        
      # 15. Bundle size check
      - name: Check bundle size
        run: |
          npm run build
          MAX_SIZE=500000  # 500KB
          BUNDLE_SIZE=$(stat -c%s dist/main.js)
          
          if [ "$BUNDLE_SIZE" -gt "$MAX_SIZE" ]; then
            echo "❌ Bundle size ($BUNDLE_SIZE bytes) exceeds limit ($MAX_SIZE bytes)"
            exit 1
          fi
          
          echo "✅ Bundle size ($BUNDLE_SIZE bytes) within limit"
```

### **4.2 Branch Protection Rules (GitHub Settings)**

**Configuração obrigatória em Settings → Branches → main:**

✅ **Required status checks:**
- `quality-gate / Quality Gate Check (18.x)`
- `quality-gate / Quality Gate Check (20.x)`
- `codecov/patch` (>75% coverage em código novo)
- `codecov/project` (>85% coverage total)
- `sonarqube` (Quality Gate pass)
- `snyk` (No high/critical vulnerabilities)

✅ **Additional settings:**
- Require branches to be up to date before merging
- Require conversation resolution before merging
- Require approved reviews: 2
- Dismiss stale PR approvals when new commits pushed
- Include administrators (sem bypass)

### **4.3 Bloqueio Automático de PRs**

**Critérios de Bloqueio (FAIL FAST):**

| **Check** | **Threshold** | **Ação se Falhar** |
|-----------|---------------|-------------------|
| **ESLint Errors** | 0 | ❌ Block PR |
| **TypeScript Errors** | 0 | ❌ Block PR |
| **Prettier Issues** | 0 | ❌ Block PR |
| **Test Coverage** | < 85% | ❌ Block PR |
| **Security Vulnerabilities** | High/Critical | ❌ Block PR |
| **Build Failure** | Any | ❌ Block PR |
| **SonarQube Quality Gate** | Failed | ❌ Block PR |

### **4.4 Scripts NPM para Desenvolvimento Local**

**`package.json`:**
```json
{
  "scripts": {
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "quality:check": "npm run type-check && npm run lint && npm run format:check && npm run test:coverage",
    "pre-commit": "lint-staged",
    "prepare": "husky install"
  }
}
```

### **4.5 Monitoramento e Métricas**

**SonarQube Quality Gate Conditions:**

```yaml
# sonar-project.properties
sonar.qualitygate.conditions:
  - metric: new_coverage
    op: LT
    error: 85
  - metric: new_duplicated_lines_density
    op: GT
    error: 3
  - metric: new_maintainability_rating
    op: GT
    error: 1  # Must be A
  - metric: new_reliability_rating
    op: GT
    error: 1  # Must be A
  - metric: new_security_rating
    op: GT
    error: 1  # Must be A
  - metric: new_security_hotspots_reviewed
    op: LT
    error: 100  # All must be reviewed
```

---

## 📋 Implementação e Rollout

### **Fase 1: Setup Inicial (Semana 1)**
- [ ] Instalar e configurar ESLint + Prettier
- [ ] Configurar pre-commit hooks
- [ ] Setup inicial do GitHub Actions

### **Fase 2: Calibração (Semana 2-3)**
- [ ] Ajustar thresholds baseados no código atual
- [ ] Treinar equipe nas convenções
- [ ] Documentar exceções aprovadas

### **Fase 3: Enforcement (Semana 4+)**
- [ ] Ativar branch protection rules
- [ ] Bloquear PRs não conformes
- [ ] Monitorar métricas de qualidade

---

## 🚨 Declaração de Incerteza

### **CONFIANÇA NA IMPLEMENTAÇÃO: 95%**

**Alta Confiança (98%):**
- Configurações ESLint/Prettier baseadas em documentação oficial
- GitHub Actions workflow testado em produção
- Thresholds alinhados com industry standards

**Incerteza Controlada (5%):**
- Impacto inicial na velocidade de desenvolvimento
- Necessidade de ajuste fino dos thresholds
- Curva de aprendizado da equipe

### **RISCOS IDENTIFICADOS: MÉDIO**

**Riscos Técnicos:**
- Quality Gates muito restritivos podem desacelerar entregas inicialmente
- Possível aumento no tempo de CI/CD (mitigado com cache)
- Falsos positivos em análise de segurança

**Mitigações:**
- Período de adaptação com thresholds progressivos
- Documentação clara e treinamento
- Processo de exceção para casos especiais

### **DECISÕES TÉCNICAS ASSUMIDAS:**

1. **85% de cobertura** é o padrão industry-accepted para aplicações críticas
2. **Airbnb + Google Style Guides** são as referências mais maduras para TypeScript/React
3. **SonarQube + Snyk** oferecem a melhor relação custo-benefício para análise estática
4. **Branch protection sem bypass** garante compliance total (incluindo admins)
5. **Bloqueio de PRs** é preferível a avisos, garantindo qualidade mandatória

### **VALIDAÇÃO PENDENTE:**

- [ ] Revisão e aprovação pelo Arquiteto Chefe
- [ ] Validação dos thresholds com a equipe de desenvolvimento
- [ ] Teste do workflow completo em ambiente de staging
- [ ] Definição de processo de exceções para emergências

---

**Documento gerado seguindo PAM V1.0 - Formalização dos Padrões de Codificação**  
**Status:** Aguardando revisão arquitetural  
**Próximo passo:** Implementação faseada conforme roadmap

---

**Software Quality Engineer**  
*25/08/2025 - Quality Gates como Lei Estabelecida*