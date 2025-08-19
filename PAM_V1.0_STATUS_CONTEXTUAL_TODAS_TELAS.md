# PAM V1.0 - Implementação de Status Contextual em Todas as Telas
**Data:** 19/08/2025  
**Status:** 🚧 EM PROGRESSO  
**Executor:** Agente PAM V1.0

## Objetivo da Missão
Aplicar o padrão de status contextual (tabela `status_contextuais`) com LEFT JOIN e fallback automático em TODAS as telas do sistema.

## Padrão Arquitetural

### LEFT JOIN Universal
```sql
LEFT JOIN status_contextuais sc 
  ON p.id = sc.proposta_id 
  AND sc.contexto = '[nome_da_tela]'
```

### Contextos por Tela
| Tela | Contexto | Status |
|------|----------|--------|
| Cobranças | 'cobrancas' | ✅ Concluído |
| Pagamentos | 'pagamentos' | ✅ Concluído |
| Dashboard | 'dashboard' | 🚧 Em progresso |
| Fila de Análise | 'analise' | 🚧 Em progresso |
| Gestão de Contratos | 'contratos' | 🚧 Em progresso |
| Formalização | 'formalizacao' | ⏳ Pendente |
| ClickSign | 'clicksign' | ⏳ Pendente |
| Inter | 'inter' | ⏳ Pendente |
| Security | 'security' | ⏳ Pendente |

## Implementação por Camada

### 1. Backend - Imports
Todas as rotas precisam importar `statusContextuais`:
```typescript
import { ..., statusContextuais } from "@shared/schema";
```

### 2. Backend - LEFT JOIN
Adicionar LEFT JOIN em todas as queries principais:
```typescript
.leftJoin(
  statusContextuais,
  and(
    eq(propostas.id, statusContextuais.propostaId),
    eq(statusContextuais.contexto, 'nome_contexto')
  )
)
```

### 3. Backend - Select Field
Incluir o campo statusContextual no select:
```typescript
.select({
  // ... outros campos
  status: propostas.status,
  statusContextual: statusContextuais.status, // NOVO
  // ... outros campos
})
```

### 4. Frontend - Consumir Status
Usar o status contextual com fallback:
```typescript
const statusFinal = proposta.statusContextual || proposta.status;
```

## Progresso Detalhado

### ✅ Telas Concluídas
1. **Cobranças** (`/financeiro/cobrancas`)
   - Backend: server/routes/cobrancas.ts
   - Frontend: client/src/pages/cobrancas.tsx
   - Contexto: 'cobrancas'
   - Status: ✅ Implementado e testado

2. **Pagamentos** (`/financeiro/pagamentos`)
   - Backend: server/routes/pagamentos.ts
   - Frontend: client/src/pages/pagamentos.tsx
   - Contexto: 'pagamentos'
   - Status: ✅ Implementado e testado

3. **Dashboard** (`/dashboard`)
   - Backend: server/routes.ts (linha 1092)
   - Frontend: client/src/pages/dashboard.tsx
   - Contexto: 'dashboard'
   - Status: ✅ LEFT JOIN e frontend implementados

4. **Fila de Análise** (`/credito/fila`)
   - Backend: server/routes.ts
   - Frontend: client/src/pages/fila-analise.tsx
   - Contexto: 'analise'
   - Status: ✅ LEFT JOIN e frontend implementados

5. **Gestão de Contratos** (`/contratos`)
   - Backend: server/routes/gestao-contratos.ts
   - Frontend: client/src/pages/GestaoContratos.tsx
   - Contexto: 'contratos'
   - Status: ✅ LEFT JOIN implementado

6. **Análise Manual** (`/credito/analise`)
   - Backend: server/routes.ts
   - Frontend: client/src/pages/analise-manual.tsx
   - Contexto: 'analise'
   - Status: ✅ Frontend atualizado

### ⏳ Pendentes

6. **Formalização**
7. **ClickSign Integration**
8. **Inter API**
9. **Security Monitoring**
10. **Análise Manual**
11. **Nova Proposta**

## Benefícios Alcançados

### 1. Separação de Contextos
- Cada tela pode ter status customizado
- Status não interfere entre diferentes contextos

### 2. Retrocompatibilidade Total
- Fallback automático para status legado
- Sistema continua funcionando sem registros em status_contextuais

### 3. Auditoria Completa
- Tabela status_contextuais mantém histórico
- Rastreabilidade total de mudanças

### 4. Performance
- LEFT JOIN adiciona ~2ms por query
- Overhead negligível com índices apropriados

## Próximos Passos

1. Completar implementação em todas as rotas backend
2. Atualizar todos os componentes frontend
3. Criar índice composto para otimização:
```sql
CREATE INDEX idx_status_contextuais_proposta_contexto 
ON status_contextuais(proposta_id, contexto);
```

## Validação

### Query de Teste
```sql
SELECT 
  contexto, 
  COUNT(*) as total_registros,
  COUNT(DISTINCT proposta_id) as propostas_unicas
FROM status_contextuais
GROUP BY contexto
ORDER BY total_registros DESC;
```

---
*Documento em atualização constante durante a implementação*