# Runbook: Monitoramento Diário - Simpix

## Objetivo

Checklist diário para a equipe de operações monitorar a saúde geral do sistema Simpix e detectar problemas antes que afetem os usuários finais.

## Frequência

**Executar diariamente às 09:00 AM (horário local)**

---

## ✅ CHECKLIST DIÁRIO DE MONITORAMENTO

### 1. 📊 Dashboard de Filas (BullMQ)

**Acesso:** `/admin/queues`

**Verificações:**

- [ ] **Fila Principal:** Verificar se há jobs pendentes há mais de 30 minutos
- [ ] **Dead Letter Queue (DLQ):** Deve estar **vazia** ou com no máximo 5 jobs
- [ ] **Jobs Ativos:** Verificar se não há jobs "travados" na mesma posição por mais de 15 minutos
- [ ] **Taxa de Falha:** Taxa deve ser < 5% nas últimas 24h

**🚨 Alertas Críticos:**

- **DLQ > 10 jobs:** Escalar imediatamente - seguir [03-alerta-job-na-dlq.md](./03-alerta-job-na-dlq.md)
- **Jobs pendentes > 50:** Possível degradação de performance - seguir [02-alerta-performance-degradada.md](./02-alerta-performance-degradada.md)

---

### 2. 🐛 Dashboard Sentry (Monitoramento de Erros)

**Acesso:** Dashboard Sentry (DSN configurado)

**Verificações:**

- [ ] **Novos Erros:** Verificar se há novos tipos de erro nas últimas 24h
- [ ] **Erros Críticos:** Deve haver **0 erros** com tag `level:fatal`
- [ ] **Performance P95:** Latência deve estar < 500ms
- [ ] **Taxa de Erro:** Deve ser < 1% do total de requests

**🚨 Alertas Críticos:**

- **P95 > 750ms:** Seguir [02-alerta-performance-degradada.md](./02-alerta-performance-degradada.md)
- **Erros Fatal:** Escalar imediatamente para desenvolvimento
- **Taxa de Erro > 5%:** Investigação urgente necessária

---

### 3. 📝 Logs da Aplicação

**Comando:**

```bash
# Verificar logs das últimas 24h
tail -f logs/combined.log | grep -E "(ERROR|FATAL|CRITICAL)"
```

**Verificações:**

- [ ] **Padrões Anormais:** Buscar por múltiplas ocorrências do mesmo erro
- [ ] **Erros de Conexão DB:** Não deve haver falhas de conexão com PostgreSQL
- [ ] **Timeouts:** Verificar se há timeouts excessivos em APIs externas
- [ ] **Correlação de IDs:** Verificar se logs críticos têm `correlationId` para rastreamento

**🔍 Padrões para Monitorar:**

```bash
# Erros de banco de dados
grep "database\|connection\|timeout" logs/combined.log

# Erros de memoria/performance
grep -i "memory\|performance\|slow" logs/combined.log

# Falhas de autenticação
grep -i "auth\|unauthorized\|forbidden" logs/combined.log
```

---

### 4. 💾 Verificação de Backups

**Script:** `scripts/backup.sh`

**Verificações:**

- [ ] **Backup Mais Recente:** Deve ter sido executado nas últimas 24h
- [ ] **Tamanho do Backup:** Verificar se não há variação > 50% do backup anterior
- [ ] **Integridade:** Script deve reportar "✅ Backup integrity verified"
- [ ] **Espaço em Disco:** Verificar se há espaço suficiente para próximos 7 dias

**Comandos:**

```bash
# Verificar último backup
ls -la backups/ | head -10

# Verificar espaço em disco
df -h | grep -E "(/$|/backup)"

# Testar integridade do último backup
gunzip -t backups/latest.sql.gz
```

---

### 5. 🌡️ Métricas do Sistema

**Sistema Operacional:**

**Verificações:**

- [ ] **CPU:** Utilização média < 70%
- [ ] **Memória:** Utilização < 80%
- [ ] **Disco:** Espaço livre > 20%
- [ ] **Rede:** Latência para Supabase < 50ms

**Comandos:**

```bash
# CPU e Memória
top -n1 | head -10

# Espaço em disco
df -h

# Teste de conectividade Supabase
curl -o /dev/null -s -w "%{time_total}\n" $SUPABASE_URL/rest/v1/
```

---

## 📋 TEMPLATE DE RELATÓRIO DIÁRIO

```
RELATÓRIO DE MONITORAMENTO - [DATA]
=====================================

🟢 FILAS: [OK/ALERTA/CRÍTICO]
   - Jobs DLQ: [NÚMERO]
   - Jobs Pendentes: [NÚMERO]
   - Status: [DESCRIÇÃO]

🟢 SENTRY: [OK/ALERTA/CRÍTICO]
   - Novos Erros: [NÚMERO]
   - P95 Latência: [VALOR]ms
   - Taxa de Erro: [PORCENTAGEM]%

🟢 LOGS: [OK/ALERTA/CRÍTICO]
   - Erros Críticos: [NÚMERO]
   - Padrões Anômalos: [SIM/NÃO]
   - Observações: [TEXTO]

🟢 BACKUP: [OK/ALERTA/CRÍTICO]
   - Último Backup: [TIMESTAMP]
   - Integridade: [OK/FALHA]
   - Espaço Disco: [PORCENTAGEM]% livre

🟢 SISTEMA: [OK/ALERTA/CRÍTICO]
   - CPU: [PORCENTAGEM]%
   - RAM: [PORCENTAGEM]%
   - Rede: [LATÊNCIA]ms

OBSERVAÇÕES: [QUALQUER ANOMALIA DETECTADA]
AÇÕES TOMADAS: [DESCREVER SE HOUVE ESCALAÇÃO/RESOLUÇÃO]
```

---

## 🚨 ESCALAÇÃO DE INCIDENTES

### Critérios para Escalação Imediata:

1. **DLQ > 20 jobs**
2. **P95 > 1000ms por mais de 15 minutos**
3. **Taxa de erro > 10%**
4. **Falha total de backup**
5. **Indisponibilidade de qualquer serviço crítico**

### Contatos de Escalação:

- **Desenvolvimento:** [A DEFINIR]
- **Arquitetura:** [A DEFINIR]
- **DevOps:** [A DEFINIR]

### Informações para Escalação:

1. **correlationId** do Sentry (se aplicável)
2. **Screenshot** do dashboard problemático
3. **Logs relevantes** (últimas 50 linhas)
4. **Horário de detecção** do problema
5. **Passos já executados** para resolução
