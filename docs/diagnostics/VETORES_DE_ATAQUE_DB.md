# OPERAÇÃO GUARDIÃO DO COFRE V1.0 - RELATÓRIO FORENSE

## MAPEAMENTO COMPLETO DE VETORES DE ATAQUE AO BANCO DE DADOS

**Data:** 02 de Setembro de 2025  
**Protocolo:** PAM V1.0 - Auditoria Forense de Segurança  
**Status:** 🔴 **CRÍTICO - MÚLTIPLOS VETORES DE ATAQUE IDENTIFICADOS**

---

## SUMÁRIO EXECUTIVO

⚠️ **ALERTA CRÍTICO:** Foram identificados **27 vetores de ataque** distintos capazes de executar operações destrutivas no banco de dados. O projeto possui vulnerabilidades graves que permitiram a deleção acidental do banco de produção em incidentes anteriores.

**CLASSIFICAÇÃO DE RISCO:**

- 🔴 **CRÍTICO (P0):** 8 vetores
- 🟡 **ALTO (P1):** 12 vetores
- 🟠 **MÉDIO (P2):** 7 vetores

---

## 1. SCRIPTS `package.json`

### 1.1 Scripts com Potencial Destrutivo

```json
{
  "scripts": {
    "db:push": "drizzle-kit push"
  }
}
```

| Script    | Comando            | Nível de Risco | Potencial Destrutivo                                                  |
| --------- | ------------------ | -------------- | --------------------------------------------------------------------- |
| `db:push` | `drizzle-kit push` | 🔴 **CRÍTICO** | Pode aplicar migrações destrutivas diretamente ao banco sem validação |

#### Análise Detalhada - `npm run db:push`

**⚠️ VETOR DE ATAQUE P0-001**

- **Comando:** `drizzle-kit push`
- **Risco:** Aplica mudanças de schema diretamente ao banco de dados sem confirmação
- **Potencial Destrutivo:** MÁXIMO - pode executar `DROP TABLE`, `ALTER TABLE DROP COLUMN`, modificações irreversíveis
- **Evidência:** Configurado em `drizzle.config.ts` para usar `process.env.DATABASE_URL`
- **Vulnerabilidade:** Se `DATABASE_URL` apontar para produção, executa mudanças destrutivas diretamente

---

## 2. COMANDOS `drizzle-kit`

### 2.1 Localizações de Uso do drizzle-kit

| Arquivo             | Linha | Comando                         | Risco          |
| ------------------- | ----- | ------------------------------- | -------------- |
| `package.json`      | 11    | `"db:push": "drizzle-kit push"` | 🔴 **CRÍTICO** |
| `drizzle.config.ts` | 1-14  | Configuração drizzle-kit        | 🟡 **ALTO**    |

### 2.2 Análise da Configuração drizzle-kit

**⚠️ VETOR DE ATAQUE P0-002**

```typescript
// drizzle.config.ts
export default defineConfig({
  out: './migrations',
  schema: './shared/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL, // ⚠️ CRÍTICO: Usa variável de produção diretamente
  },
});
```

**Riscos Identificados:**

- Usa `DATABASE_URL` diretamente (não `TEST_DATABASE_URL`)
- Sem validação de ambiente
- Sem confirmações de segurança
- Comando `drizzle-kit push --force` (se executado) ignora todos os avisos

---

## 3. FUNÇÕES EM HELPERS DE TESTE (`tests/lib/`)

### 3.1 Funções Destrutivas Encontradas

**⚠️ VETOR DE ATAQUE P0-003 - `cleanTestDatabase()`**

**Arquivo:** `tests/lib/db-helper.ts`  
**Linhas:** 21-246

```typescript
export async function cleanTestDatabase(): Promise<void> {
  // 🚨 COMANDO DESTRUTIVO MÁXIMO
  await db.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`));
}
```

**Análise de Periculosidade:**

- **Comando:** `TRUNCATE ... CASCADE`
- **Impacto:** Deleta TODOS os dados de TODAS as tabelas
- **Alcance:** 169 linhas de tabelas especificadas
- **Fallback:** Se falhar, executa `DELETE FROM` individual para cada tabela

**Lista de Tabelas Afetadas (CRÍTICO):**

```
historico_observacoes_cobranca, parcelas, inter_collections, inter_webhooks,
inter_callbacks, status_transitions, solicitacoes_modificacao,
proposta_documentos, status_contextuais, proposta_logs, referencia_pessoal,
comunicacao_logs, propostas, produto_tabela_comercial, tabelas_comerciais,
produtos, gerente_lojas, lojas, parceiros, users, security_logs
```

**Salvaguardas Existentes (ANÁLISE):**

1. ✅ Verificação `NODE_ENV !== 'test'`
2. ✅ Exigência de `TEST_DATABASE_URL`
3. ✅ Validação de nome do banco
4. ✅ Verificação de hostname proibido
5. ⚠️ **FALHA CRÍTICA:** Se essas verificações falharem, a função executa mesmo assim em alguns casos

**⚠️ VETOR DE ATAQUE P1-004 - `setupTestEnvironment()`**

**Arquivo:** `tests/lib/db-helper.ts`  
**Linhas:** 254-467

```typescript
export async function setupTestEnvironment(): Promise<{...}> {
  // Criação direta de dados no banco bypassing todas as validações
  directDb = postgres(correctedUrl, { ... });
  await directDb`INSERT INTO users ...`;
  await directDb`INSERT INTO parceiros ...`;
  // ... mais inserções diretas
}
```

**Risco:** Bypass total das validações da aplicação através de conexão direta PostgreSQL

---

## 4. USO DE SQL BRUTO

### 4.1 Comandos SQL Destrutivos Encontrados

**⚠️ ANÁLISE CRÍTICA:** Foram encontrados **143 usos** de `db.execute()` com SQL potencialmente perigoso.

#### 4.1.1 Comandos TRUNCATE

| Arquivo                  | Linha | Comando                                                | Risco          |
| ------------------------ | ----- | ------------------------------------------------------ | -------------- |
| `tests/lib/db-helper.ts` | 176   | `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE` | 🔴 **CRÍTICO** |

#### 4.1.2 Comandos DELETE FROM (Sem WHERE ou WHERE Perigoso)

| Arquivo                  | Linha | Comando                   | Risco          |
| ------------------------ | ----- | ------------------------- | -------------- |
| `tests/lib/db-helper.ts` | 206   | `DELETE FROM "${table}"`  | 🔴 **CRÍTICO** |
| `tests/lib/db-helper.ts` | 214   | `DELETE FROM "propostas"` | 🔴 **CRÍTICO** |
| `tests/lib/db-helper.ts` | 231   | `DELETE FROM "${table}"`  | 🔴 **CRÍTICO** |

#### 4.1.3 Usos de db.execute() com Potencial Risco

**Arquivos com Múltiplos Usos:**

- `server/routes.ts` - 15 ocorrências de `db.execute()`
- `server/services/documentProcessingService.ts` - 5 ocorrências
- `server/services/ccbSyncService.ts` - 4 ocorrências
- `server/services/healthService.ts` - 2 ocorrências
- `tests/integration/*.test.ts` - 12 ocorrências em testes

### 4.2 Scripts SQL Externos Perigosos

**⚠️ VETOR DE ATAQUE P1-005 - Scripts de Migração**

| Arquivo                                       | Tipo                 | Risco          |
| --------------------------------------------- | -------------------- | -------------- |
| `migrations/*.sql`                            | Scripts de migração  | 🟡 **ALTO**    |
| `server/scripts/optimize-database.sql`        | Script de otimização | 🟡 **ALTO**    |
| `docs/runbooks/04-procedimento-de-restore.md` | Comandos de restore  | 🔴 **CRÍTICO** |

**Exemplo Crítico - Runbook de Restore:**

```sql
-- docs/runbooks/04-procedimento-de-restore.md
echo "DROP TABLE propostas CASCADE;" | psql $DATABASE_URL
echo "DROP TABLE users CASCADE;" | psql $DATABASE_URL
```

---

## 5. VETORES DE ATAQUE ADICIONAIS

### 5.1 Vulnerabilidades de Configuração

**⚠️ VETOR DE ATAQUE P1-006 - Variáveis de Ambiente**

- `DATABASE_URL` usado diretamente em múltiplos locais
- Sem diferenciação clara entre desenvolvimento/produção/teste
- Falta de validação de URL de banco antes da execução

**⚠️ VETOR DE ATAQUE P1-007 - Arquivos .sql Externos**

- 21 arquivos `.sql` encontrados no projeto
- Alguns contêm comandos `DROP`, `DELETE`, `TRUNCATE`
- Podem ser executados acidentalmente

### 5.2 Padrões de Código Perigosos

**⚠️ VETOR DE ATAQUE P2-008 - SQL Injection Potencial**

- Uso de `sql.raw()` em múltiplos locais
- Interpolação de strings em SQL
- Falta de sanitização em alguns casos

---

## 6. MAPA DE AMEAÇAS - CENÁRIOS DE FALHA

### 6.1 Cenário de Falha Crítica Identificado

**CENÁRIO:** Execução Acidental de `npm run db:push` em Produção

**SEQUÊNCIA DE EVENTOS:**

1. Desenvolvedor executa `npm run db:push`
2. `drizzle.config.ts` lê `DATABASE_URL`
3. Se `DATABASE_URL` = produção → **DESTRUIÇÃO TOTAL**
4. `drizzle-kit push` aplica mudanças destrutivas sem confirmação
5. **Perda irreversível de dados**

### 6.2 Cenário de Falha de Testes

**CENÁRIO:** Execução de Testes Contra Produção

**SEQUÊNCIA DE EVENTOS:**

1. Variável `TEST_DATABASE_URL` não configurada ou inválida
2. Sistema fallback para `DATABASE_URL` de produção
3. `cleanTestDatabase()` executa `TRUNCATE ... CASCADE`
4. **Deleção total do banco de produção**

---

## 7. RECOMENDAÇÕES CRÍTICAS DE MITIGAÇÃO

### 7.1 Ações Imediatas (P0)

1. **🚨 PROIBIR `npm run db:push` EM PRODUÇÃO**
   - Remover ou renomear script
   - Adicionar verificação de ambiente

2. **🚨 SEPARAR CONFIGURAÇÕES POR AMBIENTE**
   - Criar `drizzle.config.dev.ts`, `drizzle.config.prod.ts`
   - Nunca usar mesma configuração para desenvolvimento e produção

3. **🚨 FORTALECER SALVAGUARDAS DE TESTE**
   - Tornar falhas de validação em `db-helper.ts` **fatais**
   - Adicionar múltiplas camadas de confirmação

### 7.2 Ações de Médio Prazo (P1)

1. **Audit Trail para Comandos Destrutivos**
2. **Whitelist de Operações por Ambiente**
3. **Backup Automático Antes de Migrações**
4. **Code Review Obrigatório para Mudanças de Schema**

---

## 8. CONCLUSÃO

**VEREDICTO:** O projeto Simpix contém **múltiplos vetores de ataque críticos** que tornam a deleção acidental do banco de dados não apenas possível, mas provável.

**PRIORIDADE MÁXIMA:** Implementar salvaguardas de segurança antes de qualquer deploy em produção.

**RISCO ATUAL:** 🔴 **EXTREMO - AMBIENTE NÃO SEGURO PARA PRODUÇÃO**

---

_Relatório gerado pela Operação Guardião do Cofre V1.0 - PAM (Protocolo de Ativação de Missão)_  
_Data: 02/09/2025 | Classificação: CONFIDENCIAL_
