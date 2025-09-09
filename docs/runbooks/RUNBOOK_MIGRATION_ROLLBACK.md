# 🚨 RUNBOOK DE EMERGÊNCIA - ROLLBACK DE MIGRAÇÃO

## ⚠️ PROTOCOLO DE ATIVAÇÃO

**Este runbook é ativado quando:**
- Migração de produção falhou e sistema está instável
- Dados corrompidos após migração
- Performance crítica degradada pós-migração
- Funcionalidades essenciais indisponíveis

---

## 📋 CHECKLIST DE ATIVAÇÃO RÁPIDA

**ANTES DE INICIAR:**
- [ ] **ISOLAMENTO:** Redirecionar tráfego (maintenance mode)
- [ ] **COMUNICAÇÃO:** Notificar stakeholders (Slack #incidents)
- [ ] **BACKUP CONFIRMADO:** Verificar existência de backup pré-migração
- [ ] **EQUIPE MOBILIZADA:** DevOps + Backend + DBA disponíveis

---

## 🔴 FASE 1: AVALIAÇÃO INICIAL (5 minutos)

### 1.1 Verificação de Estado
```bash
# Verificar se aplicação responde
curl -f https://app.sistemasimpix.com.br/health || echo "❌ APP DOWN"

# Verificar conexão com database
psql $PROD_DATABASE_URL -c "SELECT 1;" || echo "❌ DB CONNECTION FAILED"

# Verificar últimas migrações aplicadas
psql $PROD_DATABASE_URL -c "SELECT * FROM __drizzle_migrations ORDER BY id DESC LIMIT 5;"
```

### 1.2 Identificação da Causa Raiz
- **Migration ID problemática:** `____________________`
- **Hora do incidente:** `____________________`
- **Sintomas observados:** `____________________`
- **Logs de erro principais:** `____________________`

---

## 📢 FASE 2: NOTIFICAÇÃO DE EMERGÊNCIA (2 minutos)

### 2.1 Comunicação Interna
```
🚨 [INCIDENT] Migration Rollback em Progresso
- Sistema: Simpix Production
- Severidade: P0 (Critical)
- ETA Resolução: 30 minutos
- Responsável: [SEU NOME]
- Canal: #incidents
```

### 2.2 Status Page
```
⚠️ Manutenção de Emergência
Identificamos um problema técnico e estamos trabalhando na correção.
Estimativa: 30 minutos
```

---

## 🔐 FASE 3: ISOLAMENTO DO SISTEMA (3 minutos)

### 3.1 Ativação Modo Manutenção
```bash
# Replit: Pausar workflows
curl -X POST $REPLIT_API/workflows/pause

# Redirecionar tráfego para página de manutenção
# (Procedimento específico do provedor)
```

### 3.2 Bloqueio de Novas Transações
```sql
-- Apenas leitura temporária
ALTER DATABASE simpix_prod SET default_transaction_read_only = true;

-- Finalizar conexões ativas (CUIDADO!)
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'simpix_prod' AND pid <> pg_backend_pid();
```

---

## 🔄 FASE 4: EXECUÇÃO DO ROLLBACK (15 minutos)

### 4.1 Rollback de Código
```bash
# Voltar para versão estável
git checkout [TAG_VERSAO_ESTAVEL]
git push --force-with-lease origin main

# Redeployar
# (Procedimento específico do Replit)
```

### 4.2 Rollback de Database

#### Opção A: Rollback via SQL (Se migrations reversíveis)
```sql
-- Reverter migration específica
DELETE FROM __drizzle_migrations WHERE hash = '[MIGRATION_HASH]';

-- Executar SQL de rollback manual
-- [INSERIR SQL DE ROLLBACK ESPECÍFICO]
```

#### Opção B: Restore do Backup (Se indisponível Option A)
```bash
# ATENÇÃO: Operação destrutiva - confirme backup
pg_dump $PROD_DATABASE_URL > backup_pre_rollback_$(date +%Y%m%d_%H%M%S).sql

# Restore do backup pré-migração
psql $PROD_DATABASE_URL < backup_pre_migration_[TIMESTAMP].sql
```

### 4.3 Validação de Integridade
```sql
-- Verificar tabelas principais
SELECT COUNT(*) FROM propostas WHERE deleted_at IS NULL;
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM lojas WHERE is_active = true;

-- Verificar foreign keys
SELECT COUNT(*) FROM propostas p 
LEFT JOIN profiles pr ON p.analista_id = pr.id 
WHERE pr.id IS NULL AND p.deleted_at IS NULL;
```

---

## ✅ FASE 5: VALIDAÇÃO PÓS-ROLLBACK (5 minutos)

### 5.1 Testes de Fumo
```bash
# Teste básico de API
curl -f https://app.sistemasimpix.com.br/api/health
curl -f https://app.sistemasimpix.com.br/api/propostas -H "Authorization: Bearer [TOKEN]"

# Teste de autenticação
curl -f -X POST https://app.sistemasimpix.com.br/api/auth/login \
  -d '{"email":"teste@test.com","password":"test"}' \
  -H "Content-Type: application/json"
```

### 5.2 Validação Funcional
- [ ] **Login/Logout:** Funciona
- [ ] **Listagem propostas:** Funciona  
- [ ] **Criação proposta:** Funciona
- [ ] **Dashboard analytics:** Funciona
- [ ] **Uploads de documento:** Funciona

### 5.3 Verificação de Performance
```bash
# Tempo de resposta API
time curl -s https://app.sistemasimpix.com.br/api/propostas > /dev/null

# Conexões ativas de DB
psql $PROD_DATABASE_URL -c "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active';"
```

---

## 🟢 FASE 6: REATIVAÇÃO E MONITORAMENTO (5 minutos)

### 6.1 Reativação Gradual
```bash
# Desabilitar modo read-only
psql $PROD_DATABASE_URL -c "ALTER DATABASE simpix_prod SET default_transaction_read_only = false;"

# Reativar workflows
curl -X POST $REPLIT_API/workflows/resume

# Remover página de manutenção
# (Procedimento específico)
```

### 6.2 Monitoramento Intensivo (próximas 2 horas)
- **Logs de aplicação:** Monitorar erros
- **Métricas de DB:** CPU, connections, query time
- **Response times:** APIs críticas < 2s
- **Error rates:** < 0.1%

---

## 📊 FASE 7: PÓS-MORTEM E DOCUMENTAÇÃO

### 7.1 Coleta de Evidências
- **Backup dos logs de erro:** `logs_incident_[TIMESTAMP].tar.gz`
- **Estado do DB antes/depois:** Screenshots Replit Database
- **Timeline detalhada:** HH:MM - Ação realizada
- **Impacto nos usuários:** Número de usuários afetados

### 7.2 Documentação Obrigatória
```
📋 POST-MORTEM: Migration Rollback [DATA]

**Causa Raiz:**
[DESCRIÇÃO TÉCNICA DETALHADA]

**Ações Corretivas:**
1. [AÇÃO 1]
2. [AÇÃO 2]

**Prevenção:**
1. [MEDIDA PREVENTIVA 1]
2. [MEDIDA PREVENTIVA 2]

**Lições Aprendidas:**
[INSIGHTS PARA EVITAR RECORRÊNCIA]
```

---

## 🆘 CONTATOS DE EMERGÊNCIA

| Função | Nome | Slack | Telefone |
|---------|------|-------|----------|
| Tech Lead | [NOME] | @user | [TELEFONE] |
| DevOps | [NOME] | @user | [TELEFONE] |
| Product Owner | [NOME] | @user | [TELEFONE] |

---

## 🔧 COMANDOS ÚTEIS PARA CÓPIA RÁPIDA

```bash
# Status de migração atual
psql $PROD_DATABASE_URL -c "SELECT * FROM __drizzle_migrations ORDER BY id DESC LIMIT 3;"

# Backup rápido estrutural
pg_dump --schema-only $PROD_DATABASE_URL > schema_backup_$(date +%Y%m%d_%H%M%S).sql

# Verificar locks ativos
psql $PROD_DATABASE_URL -c "SELECT * FROM pg_locks WHERE NOT granted;"

# Verificar conexões por estado
psql $PROD_DATABASE_URL -c "SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;"
```

---

**⏰ TEMPO TOTAL ESTIMADO: 35 minutos**
**🎯 SLA DE RECUPERAÇÃO: < 45 minutos**

---
*Última atualização: $(date)*
*Versão: 1.0*