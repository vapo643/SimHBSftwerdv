# Análise dos Logs SQL do Sistema

## Resumo Executivo
Os logs SQL mostram atividade normal do sistema com queries de diferentes roles do Supabase. Não há indicação de problemas de performance.

## Roles Identificados nos Logs

### 1. **supabase_admin**
- Executa queries de manutenção e schema
- Query identificada: LOCK TABLE para migrations do Realtime
- **Status**: Normal, operações administrativas do Supabase

### 2. **postgres** 
- Queries complexas de metadados e estrutura
- Consultando informações de funções, tabelas e colunas
- **Propósito**: Introspecção do schema para ferramentas de desenvolvimento
- **Status**: Normal, queries do dashboard do Supabase

### 3. **authenticator**
- Queries relacionadas a timezones e tipos de dados
- **Propósito**: Validação e autenticação
- **Status**: Normal, parte do sistema de auth do Supabase

## Análise de Performance

### Estatísticas da Tabela `propostas`
```
Column      | Distinct Values | Correlation
------------|-----------------|-------------
id          | Único (-1)      | -0.51 (boa distribuição)
status      | ~30%            | 0.73 (boa localidade)
loja_id     | ~12%            | 0.69 (boa localidade)
cliente_cpf | ~46%            | 0.03 (distribuição aleatória)
```

### Interpretação:
- **Boa distribuição de dados**: IDs únicos bem distribuídos
- **Localidade de dados eficiente**: Status e loja_id têm boa correlação
- **Índices funcionando bem**: Queries por status e loja_id são eficientes

## Queries Pesadas Identificadas

### Query de Funções (postgres role)
- **Tamanho**: 9KB+ 
- **Tempo médio**: 9051ms
- **Frequência**: 4.3% do tempo
- **Impacto**: BAIXO - Query administrativa, não afeta operações normais

### Query de Tabelas (postgres role)
- **CTEs recursivas** para análise de estrutura
- **Propósito**: Dashboard do Supabase
- **Impacto**: BAIXO - Executada apenas quando acessando o dashboard

## Recomendações de Otimização

### 1. Índices Atuais Funcionando Bem
- Correlação de 0.73 para status indica boa performance
- Correlação de 0.69 para loja_id indica queries eficientes

### 2. Possíveis Melhorias
```sql
-- Índice composto para queries frequentes
CREATE INDEX IF NOT EXISTS idx_propostas_loja_status 
ON propostas(loja_id, status) 
WHERE deleted_at IS NULL;

-- Índice para busca por CPF
CREATE INDEX IF NOT EXISTS idx_propostas_cliente_cpf 
ON propostas(cliente_cpf) 
WHERE deleted_at IS NULL;
```

### 3. Monitoramento Contínuo
```sql
-- Query para monitorar performance
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Conclusão

✅ **Sistema Saudável**: Não há queries problemáticas em produção
✅ **Performance Adequada**: Estatísticas mostram boa distribuição de dados
✅ **Queries Administrativas**: As queries pesadas são apenas do dashboard Supabase
✅ **Banco Otimizado**: Índices e correlações indicam boa performance

## Próximos Passos

1. Continuar monitoramento regular
2. Implementar índices sugeridos se performance degradar
3. Configurar alertas para queries > 5 segundos
4. Revisar logs semanalmente

---
*Análise realizada em 07/08/2025*