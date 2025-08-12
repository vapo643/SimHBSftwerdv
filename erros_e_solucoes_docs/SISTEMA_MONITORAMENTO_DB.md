# 📊 Sistema de Monitoramento do Banco de Dados

## ✅ Implementado em 07/08/2025

### Recursos Disponíveis

#### 1. **Utilitários de Monitoramento** (`server/utils/dbMonitoring.ts`)
- `getDatabaseStats()` - Estatísticas gerais do banco
- `getTableStats()` - Métricas das tabelas (tamanho, linhas vivas/mortas)
- `getIndexUsage()` - Uso e eficiência dos índices
- `getActiveConnections()` - Conexões ativas e queries em execução
- `checkDatabaseHealth()` - Verificação automática de saúde
- `generateMonitoringReport()` - Relatório completo

#### 2. **API de Monitoramento** (`server/routes/monitoring.ts`)
Endpoints disponíveis (requer autenticação de admin):

```
GET /api/monitoring/stats       - Estatísticas gerais
GET /api/monitoring/tables      - Métricas das tabelas
GET /api/monitoring/indexes     - Uso de índices
GET /api/monitoring/connections - Conexões ativas
GET /api/monitoring/health      - Status de saúde
GET /api/monitoring/report      - Relatório completo
```

### Como Usar

#### Via API (Admin Only)
```javascript
// Exemplo de uso no frontend
const response = await fetch('/api/monitoring/health', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const health = await response.json();
```

#### Via Console do Servidor
```javascript
import { checkDatabaseHealth } from './server/utils/dbMonitoring';
const health = await checkDatabaseHealth();
console.log(health);
```

### Alertas Automáticos

O sistema detecta automaticamente:
- ⚠️ **Conexões altas**: > 80% do limite máximo
- ⚠️ **Tabelas inchadas**: > 20% de linhas mortas
- 🔴 **Crítico**: > 50% de linhas mortas
- ⚠️ **Queries longas**: > 5 minutos de execução

### Métricas Monitoradas

#### Performance
- Tempo médio de execução de queries
- Queries mais lentas
- Uso de CPU e memória

#### Estrutura
- Tamanho das tabelas
- Crescimento de dados
- Eficiência dos índices

#### Conexões
- Conexões ativas vs máximo
- Queries em execução
- Bloqueios e deadlocks

### Dashboard de Monitoramento

#### Status Atual do Banco
```
Database: postgres (Supabase)
Size: ~2.5 MB
Tables: 25
Active Connections: 2/100
Status: ✅ Healthy
```

#### Top 5 Tabelas por Tamanho
1. propostas - 344 kB
2. proposta_logs - 128 kB
3. inter_collections - 104 kB
4. profiles - 80 kB
5. parceiros - 48 kB

### Comandos SQL Úteis

```sql
-- Ver queries ativas
SELECT pid, state, query 
FROM pg_stat_activity 
WHERE state = 'active';

-- Ver uso de índices
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Ver bloat das tabelas
SELECT tablename, n_dead_tup, n_live_tup
FROM pg_stat_user_tables
WHERE n_dead_tup > 0;
```

### Manutenção Preventiva

#### Diária
- Verificar health check
- Monitorar conexões ativas

#### Semanal
- Analisar relatório completo
- Verificar crescimento das tabelas
- Revisar queries lentas

#### Mensal
- VACUUM ANALYZE nas tabelas principais
- Revisar e otimizar índices
- Analisar padrões de uso

### Integração com Alertas

O sistema pode ser integrado com:
- Slack/Discord para notificações
- Grafana para visualização
- PagerDuty para incidentes críticos

### Próximos Passos

1. **Frontend de Monitoramento**
   - Dashboard visual com gráficos
   - Alertas em tempo real
   - Histórico de métricas

2. **Automação**
   - VACUUM automático quando necessário
   - Otimização automática de índices
   - Alertas por email/SMS

3. **Machine Learning**
   - Previsão de problemas
   - Detecção de anomalias
   - Otimização preditiva

---

## 📈 Benefícios

- **Proatividade**: Detecta problemas antes que afetem usuários
- **Performance**: Mantém o banco otimizado
- **Economia**: Evita crescimento desnecessário
- **Confiabilidade**: Garante disponibilidade do sistema
- **Compliance**: Logs de auditoria para regulamentações

---

*Sistema implementado seguindo as melhores práticas de DevOps e SRE*