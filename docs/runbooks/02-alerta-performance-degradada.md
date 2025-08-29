# Runbook: Alerta de Performance Degradada

## Objetivo
Plano de ação estruturado para quando um alerta do Sentry indicar latência P95 > 750ms no sistema Simpix.

## Critérios de Ativação
- **Sentry Alert:** P95 > 750ms por mais de 5 minutos consecutivos
- **Manual:** Usuários reportando lentidão no sistema
- **Dashboard:** Filas com jobs acumulando (> 50 jobs pendentes)

## ⏱️ SLA de Resposta
- **Detecção:** Máximo 5 minutos
- **Análise Inicial:** Máximo 15 minutos
- **Resolução/Escalação:** Máximo 30 minutos

---

## 📊 FASE 1: DIAGNÓSTICO INICIAL (0-15min)

### 1.1 Identificar Endpoint Afetado
**Acesso:** Dashboard Sentry → Performance

**Passos:**
1. Navegar para seção **Performance**
2. Ordenar por **P95 Duration** (descendente)
3. Identificar endpoints com latência > 750ms
4. Anotar o **transaction name** mais afetado

**Exemplo de Saída:**
```
TOP 3 ENDPOINTS AFETADOS:
1. POST /api/propostas - P95: 1,250ms (CRÍTICO)
2. GET /api/dashboard - P95: 890ms (ALERTA)  
3. POST /api/simulacao - P95: 780ms (ALERTA)
```

### 1.2 Verificar Volume de Tráfego
**Objetivo:** Determinar se é problema de carga ou degradação

**Passos:**
1. No Sentry, verificar **Requests per minute** no endpoint afetado
2. Comparar com média histórica (últimos 7 dias)
3. Identificar se há **pico anômalo** de tráfego

**Critérios de Análise:**
- **Tráfego Normal + Alta Latência** = Degradação de código/infra
- **Alto Tráfego + Alta Latência** = Problema de capacidade

### 1.3 Verificar Status das Filas
**Comando:**
```bash
# Acesso ao dashboard de filas
curl -s http://localhost:5000/admin/queues
```

**Verificações:**
- [ ] Jobs pendentes em filas críticas
- [ ] Jobs falhando em massa
- [ ] Dead Letter Queue acumulando

---

## 🔍 FASE 2: ANÁLISE PROFUNDA (15-25min)

### 2.1 Inspecionar Logs Correlacionados
**Objetivo:** Encontrar a causa raiz usando correlationId

**Passos:**
1. No Sentry, copiar o **correlationId** de uma transação lenta
2. Buscar nos logs da aplicação:

```bash
# Buscar logs específicos do correlationId
grep "correlationId.*[ID_COPIADO]" logs/combined.log

# Buscar queries lentas no mesmo período
grep -A 5 -B 5 "duration.*[0-9][0-9][0-9][0-9]ms" logs/combined.log
```

### 2.2 Identificar Queries Lentas
**Padrões Críticos nos Logs:**
```
🔍 BUSCAR POR:
- "query took [XXXX]ms" (queries > 1000ms)
- "Connection timeout"
- "Pool exhausted"
- "Deadlock detected"
```

**Exemplo de Query Lenta:**
```
[2025-08-29 15:30:45] WARN: Query took 2340ms: 
SELECT p.*, l.nome_loja FROM propostas p 
JOIN lojas l ON p.loja_id = l.id 
WHERE p.status = 'aguardando_analise'
```

### 2.3 Verificar Recursos do Sistema
```bash
# CPU e Memória atual
top -n1 -b | head -10

# Conexões de banco ativas  
echo "SELECT count(*) FROM pg_stat_activity WHERE state='active';" | psql $DATABASE_URL

# Verificar locks no banco
echo "SELECT * FROM pg_locks WHERE NOT granted;" | psql $DATABASE_URL
```

---

## ⚡ FASE 3: AÇÕES CORRETIVAS (25-30min)

### 3.1 Correções Imediatas Automáticas

**Se Query Lenta Identificada:**
```bash
# Verificar e recriar índices críticos se necessário
echo "REINDEX INDEX CONCURRENTLY idx_propostas_loja_id;" | psql $DATABASE_URL
echo "REINDEX INDEX CONCURRENTLY idx_propostas_status;" | psql $DATABASE_URL
```

**Se Pool de Conexões Esgotado:**
```bash
# Reiniciar aplicação (libera conexões travadas)
# EM DESENVOLVIMENTO: reinicia automaticamente
# EM PRODUÇÃO: usar comando específico do ambiente
```

**Se Filas Travadas:**
```bash
# Limpar jobs travados (usar com cautela)
# Acessar dashboard /admin/queues e usar botão "Clean"
```

### 3.2 Otimizações de Emergência

**Ativar Feature Flag de Performance:**
```bash
# Se disponível, ativar modo de performance reduzida
curl -X POST http://localhost:5000/api/features/emergency-mode -d '{"enabled":true}'
```

**Ajustar Pool de Conexões:**
```typescript
// Aumentar temporariamente o pool de conexões
// server/lib/supabase.ts - linha ~75
max: 30,  // Aumentar de 20 para 30 temporariamente
```

---

## 📈 FASE 4: MONITORAMENTO E VALIDAÇÃO (30+min)

### 4.1 Verificar Melhoria
**Aguardar 5 minutos e verificar:**
- [ ] P95 voltou para < 500ms no Sentry
- [ ] Filas processando normalmente
- [ ] Logs não mostram mais queries > 1000ms

### 4.2 Alertas Preventivos
```bash
# Configurar alerta preventivo para evitar reincidência
# (se P95 > 600ms por 3min consecutivos)
```

---

## 🚨 ESCALAÇÃO PARA DESENVOLVIMENTO

### Critérios de Escalação:
1. **Correções automáticas falharam**
2. **P95 ainda > 1000ms após 30min**
3. **Queries lentas não identificadas**
4. **Erro crítico de código detectado**

### Informações para Escalação:

#### Template de Escalação:
```
SUBJECT: [CRÍTICO] Performance Degradada - P95: [VALOR]ms

RESUMO:
- Endpoint Afetado: [NOME]
- P95 Atual: [VALOR]ms
- Iniciado em: [TIMESTAMP]
- Duração: [MINUTOS] minutos

ANÁLISE REALIZADA:
□ Volume de tráfego: [NORMAL/ALTO/CRÍTICO]
□ Queries lentas identificadas: [SIM/NÃO]
□ Recursos do sistema: CPU [X]%, RAM [Y]%
□ Status das filas: [STATUS]

LOGS CRÍTICOS:
[INSERIR LOG EXCERPT COM CORRELATIONID]

AÇÕES JÁ EXECUTADAS:
□ Verificação de índices
□ Limpeza de conexões
□ [OUTRAS AÇÕES]

URGÊNCIA: [BAIXA/MÉDIA/ALTA/CRÍTICA]
```

### Contatos de Escalação:
- **Slack:** #emergency-response
- **Email:** dev-team@[EMPRESA].com
- **On-call:** [NÚMERO DE TELEFONE]

---

## 📚 REFERÊNCIAS RÁPIDAS

### Comandos Úteis:
```bash
# Top 10 queries mais lentas (último hora)
grep "query took" logs/combined.log | tail -10

# Status geral do sistema
curl -s http://localhost:5000/health

# Verificar conectividade com Supabase
curl -o /dev/null -s -w "%{time_total}\n" $SUPABASE_URL
```

### Dashboards de Referência:
- **Filas:** `/admin/queues`
- **Sentry:** [URL do dashboard]
- **Logs:** `tail -f logs/combined.log`

### Thresholds Críticos:
- **P95 Aceitável:** < 500ms
- **P95 Alerta:** 500-750ms  
- **P95 Crítico:** > 750ms
- **P95 Emergência:** > 1500ms