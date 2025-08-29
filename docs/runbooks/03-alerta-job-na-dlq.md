# Runbook: Alerta de Job na Dead Letter Queue (DLQ)

## Objetivo
Plano de ação para quando jobs críticos do sistema Simpix são enviados para a Dead Letter Queue (DLQ), indicando falhas sistemáticas de processamento.

## Critérios de Ativação
- **Dashboard Alert:** DLQ contém > 5 jobs
- **Critical Jobs:** Jobs de tipos críticos (`payments`, `notifications`, `ccb_generation`) na DLQ
- **Manual:** Usuários reportando funcionalidades não executadas

## ⏱️ SLA de Resposta
- **Detecção:** Máximo 10 minutos
- **Análise Inicial:** Máximo 20 minutos  
- **Resolução:** Máximo 60 minutos

---

## 🎯 FASE 1: TRIAGEM E CLASSIFICAÇÃO (0-10min)

### 1.1 Acessar Dashboard de Filas
**URL:** `/admin/queues`
**Localização:** Seção "Dead Letter Queue"

### 1.2 Classificar Jobs por Criticidade

#### 🔴 **CRÍTICOS** (Ação Imediata):
- `payments` - Processamento de pagamentos
- `ccb_generation` - Geração de contratos CCB
- `notifications` - Notificações obrigatórias
- `backup_data` - Backup de dados críticos

#### 🟡 **IMPORTANTES** (Ação em 30min):
- `email_marketing` - Emails promocionais
- `report_generation` - Relatórios de gestão
- `data_sync` - Sincronização de dados

#### 🟢 **BAIXA PRIORIDADE** (Ação em 2h):
- `cleanup_tasks` - Limpeza de dados temporários
- `analytics_processing` - Processamento de métricas
- `log_rotation` - Rotação de logs

### 1.3 Coletar Informações dos Jobs
Para cada job na DLQ:

```json
{
  "jobId": "[ID_DO_JOB]",
  "jobType": "[TIPO]", 
  "attemptsMade": "[NÚMERO]",
  "lastError": "[MENSAGEM_ERRO]",
  "originalData": "[PAYLOAD]",
  "failedAt": "[TIMESTAMP]"
}
```

---

## 🔍 FASE 2: ANÁLISE DE CAUSA RAIZ (10-20min)

### 2.1 Análise de Padrões de Falha

#### Verificar Tipos de Erro Comuns:

**🔌 Erros de Conectividade:**
```
BUSCAR POR:
- "Connection timeout"
- "ECONNREFUSED" 
- "Network unreachable"
- "DNS resolution failed"
```
**Ação:** Verificar conectividade com serviços externos

**💾 Erros de Banco de Dados:**
```
BUSCAR POR:
- "relation does not exist"
- "duplicate key value"
- "connection terminated"
- "too many connections"
```
**Ação:** Verificar integridade e status do PostgreSQL

**📊 Erros de Dados:**
```
BUSCAR POR:
- "ValidationError"
- "invalid input syntax"  
- "null value in column"
- "foreign key constraint"
```
**Ação:** Validar integridade dos dados de entrada

**🔐 Erros de Autenticação:**
```
BUSCAR POR:
- "Unauthorized"
- "Invalid token"
- "Authentication failed"
- "Forbidden"
```
**Ação:** Verificar tokens e credenciais de APIs

### 2.2 Verificar Logs Correlacionados
```bash
# Buscar logs do período de falha
grep -A 10 -B 5 "[JOB_ID]" logs/combined.log

# Verificar erros relacionados ao tipo de job
grep -i "[JOB_TYPE]" logs/combined.log | tail -20
```

### 2.3 Verificar Status de Serviços Dependentes
```bash
# Testar conectividade Supabase
curl -f $SUPABASE_URL/rest/v1/ || echo "SUPABASE DOWN"

# Testar APIs externas críticas
curl -f https://clicksign.com/api/health || echo "CLICKSIGN DOWN"

# Verificar Redis (se aplicável)
redis-cli ping || echo "REDIS DOWN"
```

---

## ⚙️ FASE 3: DECISÃO DE REPROCESSAMENTO (20-40min)

### 3.1 Matriz de Decisão

| Tipo de Erro | Reprocessar? | Ação |
|--------------|-------------|------|
| Timeout/Conectividade | ✅ SIM | Retry após verificar serviço |
| Erro de Dados Temporário | ✅ SIM | Corrigir dados e retry |
| Erro de Schema/Código | ❌ NÃO | Escalar para desenvolvimento |
| Erro de Configuração | ✅ SIM | Corrigir config e retry |
| Erro de Autenticação | ✅ SIM | Atualizar tokens e retry |
| Dados Corrompidos | ❌ NÃO | Marcar como falha permanente |

### 3.2 Critérios para Descarte Definitivo

**❌ DESCARTAR SE:**
- Job tem > 5 tentativas falhadas
- Erro indica problema estrutural de código
- Dados de entrada são inválidos/corrompidos
- Job expirou (> 24h para jobs críticos, > 7 dias para não-críticos)
- Serviço de destino foi descontinuado

### 3.3 Processo de Validação Antes do Reprocessamento

**Para Jobs CRÍTICOS:**
```bash
# Validar integridade dos dados
echo "SELECT * FROM propostas WHERE id='[PROPOSAL_ID]';" | psql $DATABASE_URL

# Verificar dependências
echo "SELECT * FROM users WHERE id='[USER_ID]';" | psql $DATABASE_URL

# Testar conectividade do serviço de destino
curl -f [ENDPOINT_DE_DESTINO]/health
```

---

## 🔄 FASE 4: REPROCESSAMENTO (40-60min)

### 4.1 Reprocessamento via Dashboard

**Passos no Dashboard `/admin/queues`:**
1. Selecionar job na DLQ
2. Clicar em "View Details"
3. Verificar payload e erro
4. Clicar em "Retry Job"
5. Confirmar operação

### 4.2 Reprocessamento Manual (Casos Especiais)

**Para Jobs de Pagamento:**
```typescript
// Exemplo de reprocessamento manual
const jobData = {
  propostaId: "[ID]",
  valor: "[VALOR]", 
  metodoPagamento: "[MÉTODO]"
};

// Re-adicionar à fila
await paymentQueue.add('processPayment', jobData, {
  attempts: 3,
  backoff: 'exponential'
});
```

### 4.3 Monitoramento Pós-Reprocessamento

**Aguardar 10-15 minutos e verificar:**
- [ ] Job saiu da DLQ
- [ ] Job foi processado com sucesso
- [ ] Não gerou novos erros nos logs
- [ ] Funcionalidade esperada foi executada

---

## 📊 FASE 5: DOCUMENTAÇÃO E PREVENÇÃO (60+min)

### 5.1 Registro do Incidente

**Template de Documentação:**
```markdown
INCIDENTE DLQ - [DATA] - [HORÁRIO]
================================

JOBS AFETADOS:
- Tipo: [TIPO_JOB]
- Quantidade: [NÚMERO] 
- Período: [TIMESTAMP_INÍCIO] - [TIMESTAMP_FIM]

CAUSA RAIZ:
[DESCRIÇÃO DA CAUSA IDENTIFICADA]

RESOLUÇÃO APLICADA:
□ Reprocessamento automático
□ Correção de dados
□ Correção de configuração
□ Escalação para desenvolvimento
□ Descarte justificado

JOBS REPROCESSADOS: [X] de [Y]
JOBS DESCARTADOS: [X] de [Y]

PREVENÇÃO:
[MEDIDAS TOMADAS PARA EVITAR REINCIDÊNCIA]
```

### 5.2 Medidas Preventivas

**Baseado no Tipo de Falha:**

**Para Falhas de Conectividade:**
- Implementar circuit breaker
- Aumentar timeout de conexão
- Adicionar retry com backoff exponencial

**Para Falhas de Dados:**
- Melhorar validação de entrada
- Implementar sanitização de dados
- Adicionar logs de auditoria

**Para Falhas de Recursos:**
- Monitorar utilização de memória/CPU
- Implementar rate limiting
- Otimizar queries pesadas

---

## 🚨 ESCALAÇÃO PARA DESENVOLVIMENTO

### Critérios de Escalação:
1. **> 20 jobs críticos** na DLQ
2. **Erro estrutural** de código identificado
3. **Falha sistemática** afetando múltiplos tipos de job
4. **Perda de dados** ou corrupção detectada

### Template de Escalação:
```
SUBJECT: [CRÍTICO] Jobs Falhando em Massa - DLQ Alert

SITUAÇÃO:
- Jobs na DLQ: [NÚMERO]
- Tipos Críticos Afetados: [LISTA]
- Duração do Problema: [TEMPO]
- Impacto Estimado: [DESCRIÇÃO]

ANÁLISE TÉCNICA:
- Erro Predominante: [MENSAGEM]
- Padrão Identificado: [PADRÃO]
- Serviços Afetados: [LISTA]

LOGS RELEVANTES:
[INSERIR EXCERPT DOS LOGS COM TIMESTAMPS]

JOBS EM RISCO:
[LISTA DE JOBS QUE PODEM SER PERDIDOS]

TENTATIVAS DE RESOLUÇÃO:
□ [LISTA DE AÇÕES JÁ EXECUTADAS]

SOLICITAÇÃO:
□ Análise de código urgente
□ Correção de bug crítico
□ Revisão de arquitetura
□ Rollback de deploy recente

PRIORIDADE: CRÍTICA
```

---

## 📚 REFERÊNCIAS RÁPIDAS

### Comandos de Diagnóstico:
```bash
# Verificar status geral das filas
curl -s http://localhost:5000/admin/queues/stats

# Contar jobs na DLQ
redis-cli llen "bull:simpix:failed" 2>/dev/null || echo "N/A"

# Logs de jobs falhados
grep "Job.*failed" logs/combined.log | tail -10
```

### Jobs Críticos do Sistema:
- **payments** → Affect revenue directly
- **ccb_generation** → Legal compliance required  
- **notifications** → User experience impact
- **backup_data** → Data integrity risk

### Thresholds de Alerta:
- **0-5 jobs DLQ:** Normal
- **6-15 jobs DLQ:** Monitorar de perto
- **16-50 jobs DLQ:** Investigação ativa
- **50+ jobs DLQ:** Escalação imediata