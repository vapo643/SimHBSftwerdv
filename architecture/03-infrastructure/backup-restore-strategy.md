# 🔒 Estratégia de Backup e Restore - Simpix

**Autor:** GEM 01 (Arquiteto)
**Data:** 21/08/2025
**Status:** Ready for Execution
**Criticidade:** P0 - CRÍTICA

---

## 🎯 ESTRATÉGIA GERAL

### Princípios de Backup

```yaml
3-2-1 Rule (Conformidade Obrigatória):
  - 3 cópias dos dados (Primary + 2 backups)
  - 2 diferentes mídias (Azure Database + Azure Blob Storage)
  - 1 offsite backup (Azure Geo-Redundant Storage)
  - WORM compliance (Write-Once, Read-Many) para proteção contra insider threats

Imutabilidade:
  - Backups write-once
  - Proteção contra ransomware
  - Retention policies enforced
```

---

## 📊 IMPLEMENTAÇÃO POR AMBIENTE

### FASE 0: Supabase (AGORA)

#### Configuração Imediata

```yaml
Dashboard Supabase:
  1. Acessar: app.supabase.com
  2. Project Settings → Database
  3. Backups → Enable Point-in-Time Recovery
  4. Retention: 7 days (máximo free tier)

Backup Manual (Script):
  # Script para GEM 02 executar
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

  # Compactar
  gzip backup_*.sql

  # Upload para storage seguro
  # Supabase Storage ou Google Drive temporário
```

#### Procedimento de Restore

```yaml
Teste de Restore (CRÍTICO):
  1. Criar database de teste
  2. Restore do backup:
     psql $TEST_DATABASE_URL < backup.sql
  3. Validar integridade:
     - Row counts
     - Constraints
     - Sequences
  4. Documentar tempo de restore
```

### FASE 1: Azure (FUTURO)

#### Azure Database for PostgreSQL

```yaml
Configuração:
  Backup Type: Automated
  Frequency: Daily
  Retention: 35 days
  Geo-Redundancy: Enabled

Point-in-Time Recovery:
  Window: Continuous
  RPO: 5 minutes

Long-term Retention:
  Weekly: 4 weeks
  Monthly: 12 months
  Yearly: 5 years
```

---

## 📋 PLANO DE EXECUÇÃO IMEDIATA (GEM 02)

### Dia 1: Setup Básico

```bash
# 1. Verificar acesso Supabase Dashboard
# 2. Ativar Point-in-Time Recovery
# 3. Criar script backup.sh:

#!/bin/bash
# backup.sh - Supabase PostgreSQL Backup

# Variáveis
DB_URL="${DATABASE_URL}"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

# Criar diretório se não existir
mkdir -p ${BACKUP_DIR}

# Executar backup
echo "Iniciando backup..."
pg_dump ${DB_URL} > ${BACKUP_FILE}

# Comprimir
echo "Comprimindo..."
gzip ${BACKUP_FILE}

# Verificar tamanho
ls -lh ${BACKUP_FILE}.gz

echo "Backup completo: ${BACKUP_FILE}.gz"
```

### Dia 2: Automação

```yaml
Cron Job (GitHub Actions):
  name: Daily Backup
  schedule: '0 3 * * *' # 3AM UTC
  steps:
    - Run backup script
    - Upload to storage
    - Notify success/failure
```

### Dia 3: Validação

```yaml
Restore Test: 1. Criar DB teste
  2. Restore completo
  3. Validar dados
  4. Medir RTO
  5. Documentar processo
```

---

## 🔄 RESTORE PROCEDURES

### Cenário 1: Corrupção de Dados

```yaml
Detecção:
  - Monitoring alerts
  - User reports
  - Integrity checks fail

Ação: 1. Isolar problema
  2. Identificar last known good
  3. Point-in-time recovery
  4. Validar restauração
  5. Reabilitar acesso

RTO Target: < 4 horas # Realista com Azure Geo-Restore
```

### Cenário 2: Delete Acidental

```yaml
Detecção:
  - Audit logs
  - Missing data reports

Ação: 1. Identificar timestamp
  2. Restore para staging
  3. Extrair dados específicos
  4. Merge com produção
  5. Validar integridade

RTO Target: 30 minutos
```

### Cenário 3: Disaster Total

```yaml
Detecção:
  - Database inacessível
  - Região down

Ação: 1. Ativar DR plan
  2. Restore em nova região
  3. Update DNS
  4. Validar aplicação
  5. Comunicar usuários

RTO Target: < 4 horas # Realista com Azure Geo-Restore
```

---

## 📊 MÉTRICAS E SLAs

### Recovery Objectives

```yaml
Development:
  RTO: 8 horas
  RPO: 24 horas

Staging:
  RTO: 4 horas
  RPO: 12 horas

Production:
  RTO: < 4 horas # Alinhado com Azure Geo-Restore
  RPO: < 15 minutos # Alinhado com Azure Point-in-Time Restore
```

### Testes Obrigatórios

```yaml
Frequência:
  - Backup verification: Daily
  - Restore test: Weekly
  - Full DR drill: Monthly

Métricas:
  - Backup success rate: 100%
  - Restore success rate: 100%
  - Time to restore: < RTO
  - Data integrity: 100%
```

---

## 🛡️ SEGURANÇA DOS BACKUPS

### Encryption

```yaml
At Rest:
  - AES-256 encryption
  - Customer-managed keys

In Transit:
  - TLS 1.3
  - Certificate validation
```

### Access Control

```yaml
Permissions:
  - Backup: Automated only
  - Restore: Admin approval
  - Delete: Impossible (immutable)

Audit:
  - All access logged
  - Alert on unusual activity
```

### 3.4 Proteção Contra Ameaças Internas (Insider Threats)

**Requisito:** Todos os backups de produção DEVERÃO ser armazenados em uma conta de armazenamento Azure configurada com **Immutability Policies (WORM)**.
**Implementação:** Utilizar `Azure Blob Storage` com versionamento e `time-based retention policies` para impedir a deleção ou modificação de backups, mesmo por contas com privilégios de administrador, por um período de 30 dias.

### Ransomware Protection

```yaml
Estratégias:
  - Azure Immutable Storage (WORM - Write-Once, Read-Many)
  - Defense in Depth contra administradores comprometidos
  - Offline copies
  - Cross-account isolation
  - MFA for restore
  - Time-based retention (30 dias mínimo)
```

---

## 📝 DOCUMENTAÇÃO REQUERIDA

### Runbook: Backup Procedure

```markdown
# Backup Diário - Procedimento

1. **Verificação Pré-Backup**
   - Check disk space
   - Verify credentials
   - Test connectivity

2. **Execução**
   - Run backup script
   - Monitor progress
   - Verify completion

3. **Validação**
   - Check file size
   - Test restore sample
   - Update inventory

4. **Notificação**
   - Log success
   - Alert on failure
```

### Runbook: Emergency Restore

```markdown
# Restore de Emergência

1. **Avaliação**
   - Identify issue
   - Determine scope
   - Choose restore point

2. **Preparação**
   - Notify stakeholders
   - Prepare environment
   - Gather credentials

3. **Execução**
   - Execute restore
   - Monitor progress
   - Validate data

4. **Verificação**
   - Test application
   - Check integrations
   - Confirm functionality

5. **Comunicação**
   - Update status page
   - Notify users
   - Document incident
```

---

## ⚠️ RISCOS E MITIGAÇÕES

| Risco           | Probabilidade | Impacto | Mitigação             |
| --------------- | ------------- | ------- | --------------------- |
| Backup failure  | Baixa         | Crítico | Monitoring + alerts   |
| Corruption      | Muito baixa   | Crítico | Multiple copies       |
| Ransomware      | Baixa         | Crítico | Immutable storage     |
| Human error     | Média         | Alto    | Automation + approval |
| Storage failure | Baixa         | Alto    | Geo-redundancy        |

---

## ✅ CHECKLIST PARA GEM 02

### Imediato (Hoje)

- [ ] Acessar Supabase Dashboard
- [ ] Ativar Point-in-Time Recovery
- [ ] Criar script backup.sh
- [ ] Executar primeiro backup manual
- [ ] Verificar backup criado

### Amanhã

- [ ] Automatizar com cron/GitHub Actions
- [ ] Configurar notificações
- [ ] Documentar processo

### Dia 3

- [ ] Executar teste de restore
- [ ] Medir tempo de recuperação
- [ ] Criar runbook final
- [ ] Treinar procedimento

---

_CRÍTICO: Sem backup = Roleta russa com dados financeiros!_
