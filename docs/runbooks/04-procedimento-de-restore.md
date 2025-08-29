# Runbook: Procedimento de Restauração de Emergência

## Objetivo
Guia passo-a-passo para restauração completa do sistema Simpix em cenários de desastre, incluindo rollback de migrações e restauração de dados a partir de backups.

## Cenários de Ativação
- **Falha Crítica de Deploy:** Sistema inacessível após deploy
- **Corrupção de Dados:** Dados críticos corrompidos ou perdidos
- **Ataque/Breach:** Comprometimento de segurança detectado
- **Falha de Infraestrutura:** Perda total ou parcial de dados
- **Rollback Urgente:** Necessidade de voltar estado anterior

## ⚠️ CRITÉRIOS DE EMERGÊNCIA
**⏱️ SLA:** Máximo 4 horas para restauração completa
**👥 Autorização:** Requer aprovação de 2 pessoas (Tech Lead + Operations Manager)

---

## 🚨 FASE 0: AVALIAÇÃO E PREPARAÇÃO (0-30min)

### 0.1 Avaliação da Situação
```bash
# VERIFICAR GRAVIDADE DO PROBLEMA
echo "=== DIAGNÓSTICO INICIAL ==="
echo "1. Sistema respondendo?"
curl -f http://localhost:5000/health || echo "❌ SISTEMA DOWN"

echo "2. Banco de dados acessível?"
psql $DATABASE_URL -c "SELECT 1;" || echo "❌ DATABASE DOWN"

echo "3. Últimas tentativas de operação:"
tail -50 logs/combined.log | grep -E "(ERROR|CRITICAL|FATAL)"
```

### 0.2 Determinar Estratégia de Restauração

| Cenário | Estratégia | Tempo Estimado |
|---------|------------|----------------|
| Deploy com bugs | Rollback código + migração | 30-60min |
| Corrupção parcial | Restauração seletiva | 60-120min |
| Perda total de dados | Restauração completa | 120-240min |
| Compromisso segurança | Restauração + Auditoria | 240min+ |

### 0.3 Notificar Stakeholders
```bash
# Template de notificação de emergência
echo "🚨 PROCEDIMENTO DE RESTORE INICIADO - [DATA/HORA]
Problema: [DESCRIÇÃO_BREVE]
Estratégia: [ROLLBACK/RESTORE_PARCIAL/RESTORE_COMPLETO]
Tempo Estimado: [MINUTOS] minutos
Responsável: [NOME]
Status: EM PROGRESSO" | mail -s "EMERGÊNCIA: Restore Simpix" operations@empresa.com
```

---

## 🔄 FASE 1: ROLLBACK DE CÓDIGO E MIGRAÇÕES (30-60min)

### 1.1 Identificar Ponto de Restauração
```bash
# Listar últimas migrações aplicadas
echo "SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 10;" | psql $DATABASE_URL

# Verificar commits recentes
git log --oneline -10

# Identificar último estado estável conhecido
echo "🔍 ÚLTIMO ESTADO ESTÁVEL: [COMMIT_HASH] - [DATA]"
```

### 1.2 Executar Rollback de Migrações
**⚠️ ATENÇÃO: Operação destrutiva - pode causar perda de dados**

```bash
# Rollback de 1 migração (padrão)
tsx scripts/rollback.ts 1

# Rollback múltiplas migrações (usar com extrema cautela)
tsx scripts/rollback.ts 3

# Verificar resultado
echo "SELECT hash, success, error_message FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5;" | psql $DATABASE_URL
```

### 1.3 Rollback de Código
```bash
# Criar branch de emergência
git checkout -b emergency-rollback-$(date +%Y%m%d-%H%M%S)

# Resetar para commit estável
git reset --hard [COMMIT_HASH_ESTÁVEL]

# Reiniciar aplicação
# Em desenvolvimento: automático
# Em produção: seguir procedimento específico do ambiente
```

---

## 💾 FASE 2: RESTAURAÇÃO DE DADOS (60-180min)

### 2.1 Preparar Ambiente para Restore
```bash
# Parar aplicação (evitar corrupção durante restore)
pkill -f "node.*server"

# Criar backup do estado atual (mesmo corrompido)
pg_dump $DATABASE_URL > emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# Verificar backups disponíveis
ls -la backups/ | head -10
echo "💾 BACKUP MAIS RECENTE: $(ls -t backups/*.gz | head -1)"
```

### 2.2 Validar Integridade do Backup
```bash
# Escolher backup para restauração
BACKUP_FILE=$(ls -t backups/*.gz | head -1)
echo "📂 USANDO BACKUP: $BACKUP_FILE"

# Verificar integridade
gunzip -t $BACKUP_FILE
if [ $? -eq 0 ]; then
    echo "✅ Backup íntegro"
else
    echo "❌ Backup corrompido - tentando backup anterior"
    BACKUP_FILE=$(ls -t backups/*.gz | head -2 | tail -1)
fi

# Descomprimir temporariamente
gunzip -c $BACKUP_FILE > restore_temp.sql
echo "📊 TAMANHO DO BACKUP: $(wc -l < restore_temp.sql) linhas"
```

### 2.3 Executar Restauração Completa
**⚠️ PROCESSO DESTRUTIVO - CONFIRMAR AUTORIZAÇÃO**

```bash
echo "🚨 ATENÇÃO: Esta operação irá DESTRUIR todos os dados atuais"
echo "Backup sendo usado: $BACKUP_FILE"
echo "Pressione ENTER para continuar ou CTRL+C para cancelar"
read

# Dropar banco atual e recriar
dropdb -U [USERNAME] simpix_prod
createdb -U [USERNAME] simpix_prod

# Restaurar dados do backup
psql $DATABASE_URL < restore_temp.sql

# Verificar restauração
echo "SELECT COUNT(*) as total_propostas FROM propostas;" | psql $DATABASE_URL
echo "SELECT COUNT(*) as total_usuarios FROM users;" | psql $DATABASE_URL

# Limpeza
rm restore_temp.sql
```

### 2.4 Restauração Seletiva (Alternativa)
**Para casos onde apenas algumas tabelas precisam ser restauradas:**

```bash
# Extrair apenas tabelas específicas do backup
pg_restore -t propostas -t users restore_temp.sql > selective_restore.sql

# Fazer backup das tabelas que serão substituídas
pg_dump $DATABASE_URL -t propostas -t users > current_tables_backup.sql

# Dropar e restaurar tabelas específicas
echo "DROP TABLE propostas CASCADE;" | psql $DATABASE_URL
echo "DROP TABLE users CASCADE;" | psql $DATABASE_URL
psql $DATABASE_URL < selective_restore.sql
```

---

## 🔧 FASE 3: VALIDAÇÃO E REATIVAÇÃO (180-240min)

### 3.1 Validação de Integridade
```bash
# Verificar tabelas críticas
echo "=== VALIDAÇÃO DE DADOS ==="
echo "Propostas: $(echo "SELECT COUNT(*) FROM propostas;" | psql $DATABASE_URL -t)"
echo "Usuários: $(echo "SELECT COUNT(*) FROM users;" | psql $DATABASE_URL -t)"  
echo "Lojas: $(echo "SELECT COUNT(*) FROM lojas;" | psql $DATABASE_URL -t)"

# Verificar integridade referencial
echo "=== VERIFICAÇÃO DE CONSTRAINTS ==="
echo "
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT conname, conrelid::regclass, pg_get_constraintdef(oid) 
              FROM pg_constraint WHERE contype = 'f') 
    LOOP
        EXECUTE format('SET constraint_exclusion = off; EXPLAIN (ANALYZE, BUFFERS) %s', 
                      replace(pg_get_constraintdef(r.oid), 'FOREIGN KEY', 'SELECT 1 WHERE EXISTS(SELECT 1 FROM'));
        RAISE INFO 'Constraint % on % validated', r.conname, r.conrelid;
    END LOOP;
END;
\$\$;" | psql $DATABASE_URL
```

### 3.2 Testes de Funcionalidade Crítica
```bash
# Testar endpoints essenciais
echo "=== TESTES DE FUNCIONALIDADE ==="

# 1. Health check
curl -f http://localhost:5000/health && echo "✅ Health OK" || echo "❌ Health FAIL"

# 2. Autenticação
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' && echo "✅ Auth OK" || echo "❌ Auth FAIL"

# 3. Dashboard
curl -f http://localhost:5000/api/dashboard && echo "✅ Dashboard OK" || echo "❌ Dashboard FAIL"

# 4. Criação de proposta (teste crítico)
curl -X POST http://localhost:5000/api/propostas \
  -H "Content-Type: application/json" \
  -d '{"test":"restore_validation"}' && echo "✅ Propostas OK" || echo "❌ Propostas FAIL"
```

### 3.3 Reativar Monitoramento
```bash
# Verificar se Sentry está funcionando
curl -f $VITE_SENTRY_DSN && echo "✅ Sentry conectado"

# Verificar filas
curl -f http://localhost:5000/admin/queues && echo "✅ Filas ativas"

# Reiniciar jobs críticos
echo "📋 Reiniciando processamento de jobs..."
# Comandos específicos para restart de jobs
```

---

## 📊 FASE 4: MONITORAMENTO PÓS-RESTORE (240+min)

### 4.1 Monitoramento Intensivo (Primeiras 2 horas)
```bash
# Script de monitoramento contínuo
watch -n 30 '
echo "=== $(date) ==="
echo "Sistema: $(curl -s http://localhost:5000/health | jq -r .status 2>/dev/null || echo "DOWN")"
echo "Propostas: $(echo "SELECT COUNT(*) FROM propostas;" | psql $DATABASE_URL -t | tr -d " ")"
echo "Erros (5min): $(grep "$(date -d "5 minutes ago" "+%Y-%m-%d %H:%M")" logs/combined.log | grep -c ERROR)"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk "{print $2}" | cut -d"%" -f1)"
echo "Memória: $(free -m | awk "NR==2{printf \"%.1f\", $3*100/$2}")\%"
echo "=================="
'
```

### 4.2 Relatório de Restore
**Criar documentação completa do incidente:**

```markdown
RELATÓRIO DE RESTORE DE EMERGÊNCIA
==================================
Data: [DATA]
Duração: [INÍCIO] - [FIM] ([TOTAL] minutos)
Responsável: [NOME]

SITUAÇÃO INICIAL:
- Problema: [DESCRIÇÃO DETALHADA]
- Gravidade: [BAIXA/MÉDIA/ALTA/CRÍTICA]
- Sistemas Afetados: [LISTA]
- Usuários Impactados: [NÚMERO ESTIMADO]

ESTRATÉGIA EXECUTADA:
□ Rollback de código: [SIM/NÃO]
□ Rollback de migração: [SIM/NÃO] - [X] steps
□ Restore completo: [SIM/NÃO]
□ Restore seletivo: [SIM/NÃO] - Tabelas: [LISTA]

BACKUP UTILIZADO:
- Arquivo: [NOME_DO_BACKUP]
- Data do backup: [DATA]
- Idade dos dados: [X] horas
- Integridade: [OK/PARCIAL/PROBLEMAS]

DADOS RESTAURADOS:
- Propostas: [NÚMERO]
- Usuários: [NÚMERO]
- Período coberto: [DATA_INÍCIO] - [DATA_FIM]
- Dados perdidos: [PERÍODO_PERDIDO]

VALIDAÇÕES EXECUTADAS:
□ Integridade referencial
□ Testes de funcionalidade
□ Verificação de performance  
□ Validação de segurança

LIÇÕES APRENDIDAS:
[MELHORIAS IDENTIFICADAS]

AÇÕES PREVENTIVAS:
[MEDIDAS PARA EVITAR REINCIDÊNCIA]
```

---

## 🚨 TROUBLESHOOTING COMUM

### Problema: Backup Corrompido
```bash
# Tentar backup anterior
BACKUP_FILES=($(ls -t backups/*.gz))
for backup in "${BACKUP_FILES[@]}"; do
    echo "Testando: $backup"
    gunzip -t "$backup" && echo "✅ OK" && break
done
```

### Problema: Migração Não Reverte
```bash
# Forçar rollback manual
echo "DELETE FROM __drizzle_migrations WHERE hash='[HASH_PROBLEMÁTICO]';" | psql $DATABASE_URL

# Reverter mudanças SQL manualmente
echo "DROP TABLE IF EXISTS [TABELA_CRIADA_NA_MIGRAÇÃO];" | psql $DATABASE_URL
```

### Problema: Restore Parcial
```bash
# Identificar tabelas faltantes
echo "
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
" | psql $DATABASE_URL > current_tables.txt

# Comparar com backup esperado
echo "Tabelas esperadas vs encontradas:"
diff expected_tables.txt current_tables.txt
```

---

## ⚡ COMANDOS DE EMERGÊNCIA

### Abortar Restore em Andamento:
```bash
# Matar processos do PostgreSQL relacionados ao restore
pkill -f "psql.*$DATABASE_URL"
```

### Restore Ultra-Rápido (Últimas 24h):
```bash
# Para emergências onde dados das últimas 24h são suficientes
pg_dump $DATABASE_URL --where="created_at > NOW() - INTERVAL '1 day'" > quick_restore.sql
```

### Verificação Express de Integridade:
```bash
# Teste rápido dos dados críticos
echo "SELECT 'propostas', COUNT(*) FROM propostas 
UNION ALL SELECT 'users', COUNT(*) FROM users 
UNION ALL SELECT 'lojas', COUNT(*) FROM lojas;" | psql $DATABASE_URL
```

---

## 📞 CONTATOS DE EMERGÊNCIA

**24/7 On-Call:**
- Tech Lead: [TELEFONE]
- DevOps: [TELEFONE] 
- Database Admin: [TELEFONE]

**Escalação Externa:**
- Supabase Support: [SUPORTE_SUPABASE]
- Infrastructure Provider: [PROVIDER_SUPPORT]

**Comunicação:**
- Slack: #emergency-response
- Email: emergency@[EMPRESA].com
- Status Page: status.[EMPRESA].com