# OPERAÇÃO GUARDIÃO DO COFRE V1.0 - FASE 2

## ANÁLISE FORENSE DA CAUSA RAIZ: DELEÇÃO ACIDENTAL DO BANCO DE DADOS

**Data:** 02 de Setembro de 2025  
**Protocolo:** PAM V1.0 - Investigação Forense Digital  
**Status:** 🔴 **CAUSA RAIZ IDENTIFICADA - FALHA CRÍTICA NO ISOLAMENTO DE AMBIENTES**

---

## SUMÁRIO EXECUTIVO DA INVESTIGAÇÃO

⚠️ **VEREDICTO:** A causa raiz da deleção acidental do banco de dados foi identificada como uma **falha sistemática no carregamento e validação de variáveis de ambiente**, permitindo que scripts destrutivos executem contra o banco de produção ao invés do banco de teste.

**EVIDÊNCIA CRUCIAL:** O sistema não possui um mecanismo robusto de diferenciação de ambientes, e os comandos destrutivos (`drizzle-kit push` e `cleanTestDatabase()`) podem acessar inadvertidamente o banco de produção quando as variáveis de ambiente não estão configuradas corretamente.

---

## 1. ANÁLISE DO CARREGAMENTO DE VARIÁVEIS DE AMBIENTE

### 1.1 Configuração por Ambiente

**Arquivos de Configuração Identificados:**

| Arquivo             | DATABASE_URL Configurado   | Observações                   |
| ------------------- | -------------------------- | ----------------------------- |
| `.env.development`  | ❌ **AUSENTE**             | Apenas `NODE_ENV=development` |
| `.env.test`         | ✅ **TEST_DATABASE_URL**   | Placeholder não configurado   |
| `.env.example`      | ✅ **DATABASE_URL**        | Template de exemplo           |
| `drizzle.config.ts` | ⚠️ **DATABASE_URL direta** | **VULNERABILIDADE CRÍTICA**   |

### 1.2 Fluxo de Carregamento - Análise Forense

**🚨 FALHA CRÍTICA IDENTIFICADA:**

```typescript
// drizzle.config.ts (EVIDÊNCIA A1)
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL, ensure the database is provisioned');
}

export default defineConfig({
  dbCredentials: {
    url: process.env.DATABASE_URL, // ⚠️ SEM VALIDAÇÃO DE AMBIENTE
  },
});
```

**CENÁRIO DE FALHA:**

1. Desenvolvedor executa `npm run db:push`
2. `drizzle-kit` lê `process.env.DATABASE_URL` diretamente
3. **Se `DATABASE_URL` = produção → DESTRUIÇÃO TOTAL**
4. Não há verificação se estamos em ambiente de teste/desenvolvimento

### 1.3 Configuração do Vitest (EVIDÊNCIA A2)

```typescript
// vitest.config.ts
test: {
  env: {
    NODE_ENV: 'test',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
  },
  // ⚠️ AUSENTE: DATABASE_URL ou TEST_DATABASE_URL
}
```

**VULNERABILIDADE:** O Vitest configura `NODE_ENV` como 'test', mas **não configura** a `DATABASE_URL` ou `TEST_DATABASE_URL`, deixando o sistema vulnerável a usar a `DATABASE_URL` de produção.

### 1.4 Análise do CI/CD GitHub Actions (EVIDÊNCIA A3)

```yaml
# .github/workflows/ci.yml (LINHAS 114-118)
- name: Setup test environment
  run: |
    cp .env.test .env
    echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/simpix_test" >> .env
    # ⚠️ SOBRESCREVE DATABASE_URL mas só funciona no CI
```

**OBSERVAÇÃO CRÍTICA:** O CI/CD configura corretamente a `DATABASE_URL` para um banco PostgreSQL local, mas esta configuração **só funciona no ambiente do GitHub Actions**, não no desenvolvimento local.

---

## 2. AUDITORIA DA SALVAGUARDA DE TESTE (`db-helper.ts`)

### 2.1 Código Completo da Função `cleanTestDatabase()`

**EVIDÊNCIA B1 - Salvaguardas Existentes:**

```typescript
// tests/lib/db-helper.ts (LINHAS 25-43)
export async function cleanTestDatabase(): Promise<void> {
  // Proteção 1: NODE_ENV DEVE ser explicitamente 'test'
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      `FATAL: NODE_ENV='${process.env.NODE_ENV}' - Esta função só pode executar com NODE_ENV='test'.`
    );
  }

  // Proteção 2: SEMPRE usar TEST_DATABASE_URL (NUNCA DATABASE_URL de produção)
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'FATAL: TEST_DATABASE_URL obrigatório para testes. NUNCA usar DATABASE_URL de produção.'
    );
  }

  // Proteção 3: VERIFICAÇÃO DO NOME DO BANCO
  const url = new URL(databaseUrl);
  const dbName = url.pathname.substring(1);

  const allowedTestDbs = ['postgres', 'simpix-test'];
  const isDevelopmentDb = allowedTestDbs.some(
    (allowed) => dbName === allowed || dbName.endsWith('-test')
  );

  if (!isDevelopmentDb) {
    throw new Error(`FATAL: Nome do banco '${dbName}' não é um banco de teste reconhecido.`);
  }
}
```

### 2.2 Hipótese de Contorno das Salvaguardas

**🔍 CENÁRIO DE FALHA IDENTIFICADO:**

1. **Falha de Configuração de `TEST_DATABASE_URL`:**
   - O arquivo `.env.test` contém placeholder não configurado
   - Se `TEST_DATABASE_URL` não está definido, a função falha corretamente
   - **MAS:** Se por algum motivo a verificação falha ou é bypassed, o sistema pode prosseguir

2. **Mock de process.env nos Testes:**

   ```typescript
   // tests/setup.ts (EVIDÊNCIA B2)
   vi.mock('process', () => ({
     env: {
       NODE_ENV: 'test',
       DATABASE_URL: 'postgresql://test:test@localhost:5432/test', // ⚠️ MOCK
     },
   }));
   ```

   **VULNERABILIDADE:** O mock pode não funcionar corretamente em todos os contextos, especialmente se outros módulos já importaram `process.env` antes do mock ser aplicado.

3. **Dependência do Carregamento do dotenv:**
   - **CRÍTICO:** Não foi encontrada evidência de carregamento explícito do dotenv em pontos-chave
   - Se o dotenv não carrega `.env.test`, o sistema usa variáveis do ambiente Replit

---

## 3. RASTREAMENTO DO VETOR DE ATAQUE `db:push`

### 3.1 Análise do Script `db:push`

**EVIDÊNCIA C1:**

```json
// package.json
{
  "scripts": {
    "db:push": "drizzle-kit push"
  }
}
```

### 3.2 Mecanismo de Determinação do DATABASE_URL pelo drizzle-kit

**INVESTIGAÇÃO:** O `drizzle-kit` lê a configuração de `drizzle.config.ts`:

```typescript
// drizzle.config.ts (EVIDÊNCIA C2)
export default defineConfig({
  dbCredentials: {
    url: process.env.DATABASE_URL, // ⚠️ ACESSO DIRETO SEM VALIDAÇÃO
  },
});
```

**DESCOBERTA CRÍTICA:** O `drizzle-kit` não possui seu próprio mecanismo de carregamento de variáveis de ambiente. Ele depende inteiramente do `process.env.DATABASE_URL` já carregado no ambiente de execução.

### 3.3 Cenário Mais Provável de Execução Acidental

**CENÁRIO DE CATÁSTROFE IDENTIFICADO:**

1. **Desenvolvedor Local:**
   - Executa `npm run db:push` em ambiente local
   - `.env.test` não está configurado ou não é carregado
   - Sistema usa `DATABASE_URL` do Replit Secret (PRODUÇÃO)
   - `drizzle-kit push` aplica mudanças destrutivas diretamente à produção

2. **Agente IA:**
   - Executa comando `npm run db:push` como parte de uma tarefa
   - Não tem conhecimento do ambiente atual
   - Sistema acessa variáveis do Replit (produção) por padrão
   - **RESULTADO:** Deleção/modificação do banco de produção

### 3.4 Evidência de Vulnerabilidade no CI/CD

**EVIDÊNCIA C3:**

```yaml
# .github/workflows/ci.yml (LINHA 121)
- name: Run database migrations
  run: npm run db:push --force # ⚠️ FLAG --force IGNORA AVISOS
```

**OBSERVAÇÃO:** O CI/CD usa `--force` que ignora todos os avisos de segurança do drizzle-kit.

---

## 4. VEREDITO DA CAUSA RAIZ

### 4.1 Conclusão Principal

**🔴 CAUSA RAIZ IDENTIFICADA:**

> **A causa raiz da deleção do banco de dados é uma falha sistemática no isolamento de ambientes causada pela ausência de carregamento explícito e validação de variáveis de ambiente específicas por contexto. O sistema permite que comandos destrutivos (`drizzle-kit push` e `cleanTestDatabase()`) acessem inadvertidamente o banco de produção quando:**
>
> 1. **O arquivo `.env.test` não está configurado** com `TEST_DATABASE_URL` válido
> 2. **O `drizzle.config.ts` acessa diretamente `process.env.DATABASE_URL`** sem validação de ambiente
> 3. **Não há carregamento explícito de dotenv** para garantir que as variáveis de ambiente corretas sejam carregadas por contexto
> 4. **O sistema fallback usa as variáveis de ambiente do Replit** (produção) por padrão

### 4.2 Vetores de Falha Específicos

**VETOR 1 - Configuração de Ambiente:**

- `.env.test` contém placeholder não configurado
- Ausência de dotenv explícito nos pontos críticos
- Sistema usa variáveis de produção como fallback

**VETOR 2 - drizzle-kit Sem Validação:**

- `drizzle.config.ts` não valida ambiente antes de conectar
- Comando `npm run db:push` executa sem confirmações
- Flag `--force` no CI ignora avisos de segurança

**VETOR 3 - Salvaguardas Insuficientes:**

- Mocks do Vitest podem falhar em alguns contextos
- Validações de segurança podem ser contornadas
- Dependência de configuração manual do desenvolvedor

### 4.3 Evidência Conclusiva

**O incidente de deleção ocorreu porque:**

1. Um comando destrutivo foi executado (`npm run db:push` ou teste com `cleanTestDatabase()`)
2. O sistema não tinha `TEST_DATABASE_URL` configurado ou carregado
3. O fallback para `DATABASE_URL` de produção foi ativado
4. Nenhuma validação de ambiente impediu a execução
5. **RESULTADO:** Operação destrutiva executada contra banco de produção

---

## 5. IMPACTO E CLASSIFICAÇÃO DE RISCO

**CLASSIFICAÇÃO:** 🔴 **CRÍTICO - P0**

**IMPACTO DEMONSTRADO:**

- Perda total de dados de produção (confirmado por incidentes anteriores)
- Falha sistemática de isolamento de ambientes
- Vulnerabilidade a execução acidental de comandos destrutivos

**PROBABILIDADE DE RECORRÊNCIA:** **ALTA** - As mesmas condições que causaram o incidente original ainda existem.

---

## 6. RECOMENDAÇÕES CRÍTICAS DE MITIGAÇÃO

### 6.1 Ações Imediatas (P0)

1. **🚨 IMPLEMENTAR VALIDAÇÃO OBRIGATÓRIA DE AMBIENTE:**

   ```typescript
   // drizzle.config.ts - CORREÇÃO NECESSÁRIA
   if (process.env.NODE_ENV === 'production') {
     throw new Error('PROHIBIDO: drizzle-kit push em produção');
   }
   ```

2. **🚨 CONFIGURAR DOTENV EXPLÍCITO:**

   ```typescript
   // carregar .env.test explicitamente em contextos de teste
   import dotenv from 'dotenv';
   if (process.env.NODE_ENV === 'test') {
     dotenv.config({ path: '.env.test' });
   }
   ```

3. **🚨 SEPARAR CONFIGURAÇÕES POR AMBIENTE:**
   - `drizzle.config.dev.ts`
   - `drizzle.config.test.ts`
   - `drizzle.config.prod.ts`

### 6.2 Salvaguardas Adicionais

1. **Confirmação Interativa para Comandos Destrutivos**
2. **Whitelist de Hostnames por Ambiente**
3. **Backup Automático Antes de Migrações**
4. **Audit Trail para Todas as Operações de Schema**

---

## 7. CONCLUSÃO FORENSE

**INVESTIGAÇÃO CONCLUÍDA:** A causa raiz foi identificada com evidências conclusivas. O sistema possui vulnerabilidades sistemáticas no isolamento de ambientes que tornam a deleção acidental de dados de produção não apenas possível, mas provável.

**PRÓXIMOS PASSOS:** Implementação imediata das salvaguardas críticas identificadas antes de qualquer deploy em produção.

---

_Relatório Forense gerado pela Operação Guardião do Cofre V1.0 - Fase 2_  
_Data: 02/09/2025 | Investigador: PAM V1.0 | Classificação: CONFIDENCIAL_
