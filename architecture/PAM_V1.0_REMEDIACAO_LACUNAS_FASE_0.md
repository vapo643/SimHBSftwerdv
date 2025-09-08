# 📋 Pacote de Ativação de Missão (PAM) V1.0

## Remediação de Lacunas Críticas - Fase 0

**Missão:** Implementar Estratégia de Schema Migration com Zero Downtime  
**Prioridade:** P0 - CRÍTICA  
**Executor:** GEM 02 (Dev Specialist) + GEM 07 (AI Specialist)  
**Prazo:** 72 horas  
**Protocolo:** PEAF V1.4

---

## 🎯 OBJETIVO DA MISSÃO

Implementar uma estratégia robusta de migração de schema que garanta:

1. **Versionamento completo** de todas as mudanças de banco
2. **Zero downtime** durante migrações em produção
3. **Rollback automático** em caso de falha
4. **Compatibilidade** com migração Supabase → Azure

---

## 📊 CONTEXTO OPERACIONAL

### Situação Atual

- **PostgreSQL** rodando no Supabase
- **Drizzle ORM** como camada de abstração
- **50+ tabelas** em produção
- **Sem ferramenta de migração** formal implementada
- **Risco alto** de downtime em mudanças de schema

### Requisitos Críticos

- Suportar **migrações forward e backward**
- Manter **auditoria completa** de mudanças
- Implementar **padrão Expand/Contract**
- Garantir **idempotência** das migrações

---

## 🔧 ESCOPO TÉCNICO

### Fase 1: Seleção e Setup (24h)

#### 1.1 Implementar Drizzle-Kit Migration System

```bash
# Drizzle já está instalado, precisamos configurar migrations
npm install --save-dev drizzle-kit@latest

# Criar estrutura de migrations
mkdir -p migrations
mkdir -p migrations/meta
```

#### 1.2 Configurar drizzle.config.ts

```typescript
// drizzle.config.ts - ATUALIZAR configuração existente
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './shared/schema.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Configurações para Zero Downtime
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public',
  },
  // Verbose mode para debug
  verbose: true,
  strict: true,
});
```

#### 1.3 Scripts de Migração no package.json

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:rollback": "tsx scripts/rollback.ts",
    "db:status": "drizzle-kit status",
    "db:push": "drizzle-kit push",
    "db:pull": "drizzle-kit pull",
    "db:studio": "drizzle-kit studio",
    "db:check": "drizzle-kit check"
  }
}
```

### Fase 2: Implementar Padrão Expand/Contract (24h)

#### 2.1 Criar Script de Migração Segura

```typescript
// scripts/migrate.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '../shared/schema';

async function runMigration() {
  console.log('🔄 Iniciando migração segura...');

  const sql = postgres(process.env.DATABASE_URL!, {
    max: 1,
    onnotice: () => {},
  });

  const db = drizzle(sql, { schema });

  try {
    // EXPAND phase - adicionar sem remover
    await migrate(db, {
      migrationsFolder: './migrations',
      migrationsTable: '__drizzle_migrations',
    });

    console.log('✅ Migração EXPAND concluída');

    // Verificar integridade
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM __drizzle_migrations 
      WHERE success = true
    `;

    console.log(`📊 Total de migrações aplicadas: ${result[0].count}`);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
```

#### 2.2 Criar Script de Rollback

```typescript
// scripts/rollback.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

async function rollbackMigration(steps: number = 1) {
  console.log(`🔙 Iniciando rollback de ${steps} migração(ões)...`);

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  try {
    // Buscar últimas migrações aplicadas
    const migrations = await sql`
      SELECT * FROM __drizzle_migrations 
      ORDER BY created_at DESC 
      LIMIT ${steps}
    `;

    for (const migration of migrations) {
      const downFile = path.join('./migrations', migration.hash, 'down.sql');

      if (fs.existsSync(downFile)) {
        const downSQL = fs.readFileSync(downFile, 'utf-8');
        await sql.unsafe(downSQL);

        // Marcar como revertida
        await sql`
          UPDATE __drizzle_migrations 
          SET success = false 
          WHERE hash = ${migration.hash}
        `;

        console.log(`✅ Revertida: ${migration.hash}`);
      } else {
        console.warn(`⚠️ Arquivo down.sql não encontrado para ${migration.hash}`);
      }
    }
  } catch (error) {
    console.error('❌ Erro no rollback:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Aceitar número de steps via CLI
const steps = parseInt(process.argv[2] || '1');
rollbackMigration(steps);
```

### Fase 3: Documentar Zero Downtime Strategy (24h)

#### 3.1 Criar Documento de Estratégia

````markdown
# architecture/03-infrastructure/zero-downtime-migration.md

## Estratégia de Zero Downtime

### Padrão Expand/Contract

1. **EXPAND Phase**
   - Adicionar nova coluna/tabela SEM remover a antiga
   - Deploy do código que suporta AMBAS versões
   - Migrar dados gradualmente
2. **MIGRATE Phase**
   - Backfill de dados para nova estrutura
   - Validar integridade
   - Monitorar por 24-48h
3. **CONTRACT Phase**
   - Remover código que usa estrutura antiga
   - Deploy da versão final
   - Dropar colunas/tabelas antigas

### Exemplo Prático

```sql
-- EXPAND: Adicionar nova coluna
ALTER TABLE users ADD COLUMN email_normalized VARCHAR(255);

-- MIGRATE: Popular nova coluna
UPDATE users SET email_normalized = LOWER(TRIM(email));

-- CONTRACT: Remover coluna antiga (após validação)
ALTER TABLE users DROP COLUMN email;
ALTER TABLE users RENAME COLUMN email_normalized TO email;
```
````

````

#### 3.2 Criar Checklist de Migração
```yaml
# .github/MIGRATION_CHECKLIST.md

## Pre-Migration Checklist
- [ ] Backup completo do banco
- [ ] Migration testada em staging
- [ ] Rollback script preparado
- [ ] Monitoramento ativo
- [ ] Equipe em standby

## Durante Migration
- [ ] Executar em horário de baixo tráfego
- [ ] Monitorar latência de queries
- [ ] Verificar logs de erro
- [ ] Testar funcionalidades críticas

## Post-Migration
- [ ] Validar integridade dos dados
- [ ] Performance benchmarks
- [ ] Atualizar documentação
- [ ] Comunicar sucesso
````

---

## 📋 CRITÉRIOS DE SUCESSO

### Entregáveis Obrigatórios

1. ✅ **Drizzle-Kit configurado** com suporte a migrations
2. ✅ **Scripts de migração e rollback** funcionais
3. ✅ **Documentação Zero Downtime** completa
4. ✅ **Teste em ambiente dev** com migração real
5. ✅ **Checklist operacional** para produção

### Métricas de Validação

- **0 erros** durante migração de teste
- **< 100ms** de latência adicional durante migração
- **100% rollback** funcional testado
- **Auditoria completa** de todas as mudanças

---

## 🚨 RISCOS E MITIGAÇÕES

| Risco                 | Probabilidade | Impacto | Mitigação                       |
| --------------------- | ------------- | ------- | ------------------------------- |
| Corrupção de dados    | Baixa         | Crítico | Backup antes de cada migração   |
| Downtime inesperado   | Média         | Alto    | Padrão Expand/Contract rigoroso |
| Rollback falhar       | Baixa         | Crítico | Testes exaustivos em staging    |
| Performance degradada | Média         | Médio   | Índices e VACUUM após migração  |

---

## 🔄 SEQUÊNCIA DE EXECUÇÃO

### DIA 1 (Hoje)

```bash
09:00 - Setup Drizzle-Kit migrations
11:00 - Criar scripts migrate.ts e rollback.ts
14:00 - Testar primeira migração em dev
16:00 - Documentar processo
```

### DIA 2 (Amanhã)

```bash
09:00 - Implementar padrão Expand/Contract
11:00 - Criar migration de exemplo
14:00 - Testar rollback completo
16:00 - Validar com dados reais
```

### DIA 3 (Validação)

```bash
09:00 - Teste end-to-end em staging
11:00 - Documentação final
14:00 - Review com equipe
16:00 - Aprovação para produção
```

---

## 📊 MONITORAMENTO

### Queries de Validação

```sql
-- Status das migrations
SELECT * FROM __drizzle_migrations ORDER BY created_at DESC;

-- Verificar locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Monitor de performance
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## ✅ CHECKLIST DE CONCLUSÃO

- [ ] Drizzle-Kit migrations configurado
- [ ] Scripts testados em desenvolvimento
- [ ] Documentação Zero Downtime criada
- [ ] Padrão Expand/Contract implementado
- [ ] Rollback validado
- [ ] Equipe treinada no processo
- [ ] Aprovação para uso em produção

---

**AUTORIZAÇÃO DE EXECUÇÃO**

Esta missão está **AUTORIZADA** para execução imediata. GEM 02 tem autonomia total para implementar e testar em ambiente de desenvolvimento.

**Assinatura:** GEM 07 - AI Architecture Specialist  
**Data:** 2025-01-24  
**Status:** ATIVO - EM EXECUÇÃO

---

## 🎯 PRÓXIMAS MISSÕES (Após Conclusão)

1. **Skills Gap Analysis** - Mapear competências Azure
2. **Metric Cardinality Management** - Controle de custos de observabilidade
3. **Política de Higienização** - Sanitização de dados não-prod
4. **Plano de Mitigação** - Restrições críticas documentadas

**FIM DO PAM**
