# 🚀 Estratégia de Zero Downtime Migration

**Autor:** GEM 07 (AI Specialist) + GEM 02 (Dev Specialist)  
**Data:** 2025-01-24  
**Status:** Implementado  
**Criticidade:** P0 - CRÍTICA

---

## 📋 SUMÁRIO EXECUTIVO

Esta documentação define a estratégia oficial para realizar migrações de schema de banco de dados com **ZERO DOWNTIME** em produção, utilizando o padrão **Expand/Contract** e ferramentas de automação.

---

## 🎯 PRINCÍPIOS FUNDAMENTAIS

### 1. Nunca Quebrar Compatibilidade

- **SEMPRE** manter compatibilidade com versão anterior
- **NUNCA** remover colunas/tabelas em uso
- **SEMPRE** testar rollback antes de produção

### 2. Padrão Expand/Contract

```
EXPAND → MIGRATE → CONTRACT
```

- **EXPAND:** Adicionar sem remover
- **MIGRATE:** Coexistência de versões
- **CONTRACT:** Limpar após validação

### 3. Idempotência Obrigatória

- Toda migração deve ser executável múltiplas vezes
- Usar `IF NOT EXISTS` e `IF EXISTS`
- Verificar estado antes de modificar

---

## 🔄 PADRÃO EXPAND/CONTRACT DETALHADO

### **FASE 1: EXPAND (Expansão)**

**Objetivo:** Adicionar nova estrutura mantendo a antiga funcional

```sql
-- ✅ CORRETO: Adicionar nova coluna opcional
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_normalized VARCHAR(255);

-- ✅ CORRETO: Criar nova tabela
CREATE TABLE IF NOT EXISTS users_v2 (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  -- nova estrutura
);

-- ❌ ERRADO: Remover coluna existente
ALTER TABLE users DROP COLUMN email; -- NUNCA na fase EXPAND!
```

**Código da aplicação:**

```typescript
// Suportar AMBAS as versões
interface User {
  email?: string; // antiga
  email_normalized?: string; // nova
}

// Lógica de fallback
const getUserEmail = (user: User) => {
  return user.email_normalized || user.email;
};
```

### **FASE 2: MIGRATE (Migração de Dados)**

**Objetivo:** Popular nova estrutura e validar integridade

```sql
-- Migrar dados em batches para evitar locks
DO $$
DECLARE
  batch_size INTEGER := 1000;
  offset_val INTEGER := 0;
  total_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_rows FROM users WHERE email_normalized IS NULL;

  WHILE offset_val < total_rows LOOP
    UPDATE users
    SET email_normalized = LOWER(TRIM(email))
    WHERE id IN (
      SELECT id FROM users
      WHERE email_normalized IS NULL
      LIMIT batch_size
    );

    offset_val := offset_val + batch_size;

    -- Pausa para não sobrecarregar
    PERFORM pg_sleep(0.1);

    RAISE NOTICE 'Migrado % de % registros', offset_val, total_rows;
  END LOOP;
END $$;

-- Validar migração
SELECT
  COUNT(*) FILTER (WHERE email IS NOT NULL) as old_count,
  COUNT(*) FILTER (WHERE email_normalized IS NOT NULL) as new_count
FROM users;
```

**Monitoramento durante migração:**

```sql
-- Verificar progresso
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE email_normalized IS NOT NULL) as migrated,
  COUNT(*) FILTER (WHERE email_normalized IS NULL) as pending
FROM users;

-- Verificar performance
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%users%'
ORDER BY mean_exec_time DESC;
```

### **FASE 3: CONTRACT (Contração)**

**Objetivo:** Remover estrutura antiga após validação completa

**Pré-requisitos:**

- ✅ 100% dos dados migrados
- ✅ Aplicação usando apenas nova estrutura
- ✅ Monitoramento por 24-48h sem erros
- ✅ Backup completo realizado

```sql
-- Remover código que usa estrutura antiga primeiro!
-- Depois de deploy confirmado:

-- 1. Tornar nova coluna obrigatória
ALTER TABLE users
ALTER COLUMN email_normalized SET NOT NULL;

-- 2. Criar constraints
ALTER TABLE users
ADD CONSTRAINT email_normalized_unique
UNIQUE (email_normalized);

-- 3. Remover coluna antiga (após validação final)
ALTER TABLE users
DROP COLUMN IF EXISTS email;

-- 4. Renomear para manter compatibilidade de nome
ALTER TABLE users
RENAME COLUMN email_normalized TO email;
```

---

## 📊 EXEMPLOS PRÁTICOS

### **Exemplo 1: Adicionar Campo com Default**

```sql
-- EXPAND
ALTER TABLE propostas
ADD COLUMN IF NOT EXISTS status_v2 VARCHAR(50) DEFAULT 'DRAFT';

-- MIGRATE
UPDATE propostas
SET status_v2 =
  CASE status
    WHEN 0 THEN 'DRAFT'
    WHEN 1 THEN 'SUBMITTED'
    WHEN 2 THEN 'APPROVED'
    ELSE 'UNKNOWN'
  END
WHERE status_v2 = 'DRAFT';

-- CONTRACT (após validação)
ALTER TABLE propostas DROP COLUMN status;
ALTER TABLE propostas RENAME COLUMN status_v2 TO status;
```

### **Exemplo 2: Mudar Tipo de Coluna**

```sql
-- EXPAND: Adicionar nova coluna com tipo correto
ALTER TABLE produtos
ADD COLUMN IF NOT EXISTS preco_decimal DECIMAL(10,2);

-- MIGRATE: Converter dados
UPDATE produtos
SET preco_decimal = preco::DECIMAL(10,2);

-- CONTRACT: Substituir coluna antiga
ALTER TABLE produtos DROP COLUMN preco;
ALTER TABLE produtos RENAME COLUMN preco_decimal TO preco;
```

### **Exemplo 3: Criar Índice sem Bloquear**

```sql
-- Criar índice CONCURRENTLY (não bloqueia tabela)
CREATE INDEX CONCURRENTLY IF NOT EXISTS
idx_users_email_normalized
ON users(email_normalized);

-- Verificar progresso
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname = 'idx_users_email_normalized';
```

---

## 🛠️ FERRAMENTAS E SCRIPTS

### **Scripts Disponíveis**

1. **Migração Segura**

```bash
# Executar migração com verificações
tsx scripts/migrate.ts

# Features:
# - Verificação de pré-condições
# - Backup automático
# - Logging detalhado
# - Rollback em caso de erro
```

2. **Rollback Controlado**

```bash
# Reverter última migração
tsx scripts/rollback.ts 1

# Reverter múltiplas migrações
tsx scripts/rollback.ts 3

# Features:
# - Verificação de segurança
# - Ponto de restauração
# - Validação de integridade
```

3. **Helper para Execução**

```bash
# Usar o helper de migração
./migrate.sh          # Executar migração
./migrate.sh rollback # Executar rollback
./migrate.sh status   # Ver status
```

---

## ✅ CHECKLIST DE MIGRAÇÃO

### **Pré-Migração**

- [ ] Backup completo do banco realizado
- [ ] Migração testada em ambiente de staging
- [ ] Rollback testado e validado
- [ ] Equipe avisada sobre janela de manutenção
- [ ] Monitoramento ativo configurado
- [ ] Scripts de rollback prontos

### **Durante Migração**

- [ ] Executar em horário de baixo tráfego
- [ ] Monitorar latência de queries em tempo real
- [ ] Verificar logs de erro continuamente
- [ ] Testar funcionalidades críticas após EXPAND
- [ ] Validar integridade dos dados

### **Pós-Migração**

- [ ] Confirmar 100% dos dados migrados
- [ ] Performance dentro dos SLAs
- [ ] Zero erros nos logs por 1 hora
- [ ] Backup pós-migração realizado
- [ ] Documentação atualizada
- [ ] Equipe notificada do sucesso

### **Antes do CONTRACT**

- [ ] Mínimo 24h de monitoramento
- [ ] Zero erros relacionados à migração
- [ ] Código antigo removido e deployado
- [ ] Backup antes do CONTRACT
- [ ] Janela de rollback preparada

---

## 🚨 TROUBLESHOOTING

### **Problema: Migração travada**

```sql
-- Verificar locks
SELECT
  pid,
  usename,
  application_name,
  client_addr,
  query_start,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- Matar query específica (com cuidado!)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid = <pid_number>;
```

### **Problema: Performance degradada**

```sql
-- Analisar e recriar estatísticas
ANALYZE users;
VACUUM ANALYZE users;

-- Reindexar se necessário
REINDEX TABLE users;
```

### **Problema: Rollback falhou**

```bash
# Restore de backup point-in-time
pg_restore -d database_name backup_file.sql

# Ou usar snapshot do cloud provider
# AWS RDS: Restore from snapshot
# Azure: Point-in-time restore
# Supabase: Dashboard → Backups → Restore
```

---

## 📈 MÉTRICAS DE SUCESSO

### **KPIs de Migração**

- **Downtime:** 0 segundos
- **Erros durante migração:** < 0.01%
- **Degradação de performance:** < 10%
- **Tempo de rollback:** < 5 minutos
- **Dados corrompidos:** 0

### **Queries de Validação**

```sql
-- Verificar integridade referencial
SELECT
  conname,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE contype = 'f'
AND NOT EXISTS (
  SELECT 1 FROM pg_constraint c2
  WHERE c2.conname = pg_constraint.conname
  AND c2.connamespace != pg_constraint.connamespace
);

-- Verificar dados órfãos
SELECT
  'propostas' as table_name,
  COUNT(*) as orphan_count
FROM propostas p
LEFT JOIN users u ON p.user_id = u.id
WHERE u.id IS NULL;
```

---

## 🔄 PROCESSO DE GOVERNANÇA

### **Aprovações Necessárias**

| Tipo de Mudança           | Aprovador       | Critério               |
| ------------------------- | --------------- | ---------------------- |
| Adicionar coluna opcional | Dev Lead        | Automático se nullable |
| Remover coluna            | Arquiteto       | Análise de impacto     |
| Mudar tipo de dados       | DBA + Arquiteto | Teste em staging       |
| Criar/Dropar tabela       | Product Owner   | Alinhamento negócio    |
| Mudanças em produção      | SRE Team        | Janela aprovada        |

### **Documentação Obrigatória**

1. ADR (Architecture Decision Record)
2. Plano de migração detalhado
3. Plano de rollback testado
4. Análise de impacto
5. Comunicação para stakeholders

---

## 📚 REFERÊNCIAS

- [PostgreSQL Documentation - DDL](https://www.postgresql.org/docs/current/ddl.html)
- [Expand/Contract Pattern](https://martinfowler.com/bliki/ParallelChange.html)
- [Zero-Downtime Deployments](https://www.brunton-spall.co.uk/post/2014/05/06/database-migrations-done-right/)
- Scripts implementados: `/scripts/migrate.ts`, `/scripts/rollback.ts`

---

**FIM DO DOCUMENTO**

_Última atualização: 2025-01-24_  
_Próxima revisão: 2025-02-24_
