# PROMPT CRÍTICO: Erro de Tipos PostgreSQL na Tela de Pagamentos - Sistema Financeiro Simpix

## CONTEXTO DO SISTEMA

Sistema de gestão de crédito financeiro com integração bancária (Banco Inter) e assinatura eletrônica (ClickSign). A tela de Pagamentos está completamente quebrada devido a um erro persistente de comparação de tipos no PostgreSQL.

## ERRO PRINCIPAL

```
PostgresError: operator does not exist: text = uuid
hint: 'No operator matches the given name and argument types. You might need to add explicit type casts.'
position: '216'
```

Este erro acontece quando tentamos fazer JOIN entre:

- Tabela `propostas`: campo `id` é tipo UUID
- Tabela `inter_collections`: campo `proposta_id` é tipo TEXT

## HISTÓRICO DE TENTATIVAS FALHAS

### Tentativa 1: Query original com Drizzle ORM

```typescript
.innerJoin(propostas, eq(propostas.id, interCollections.propostaId))
```

Resultado: `operator does not exist: uuid = integer` (erro na posição 2571)

### Tentativa 2: Usar inArray do Drizzle

```typescript
inArray(propostas.id, idsComBoletos as string[]);
```

Resultado: Mesmo erro de tipos

### Tentativa 3: SQL raw com cast

```typescript
.innerJoin(propostas, sql`${propostas.id} = ${interCollections.propostaId}::uuid`)
```

Resultado: `operator does not exist: text = uuid` (erro mudou de posição para 216)

### Tentativa 4: Buscar dados separadamente

```typescript
// Primeiro buscar propostas elegíveis
const propostasElegiveis = await db.select()...
// Depois buscar boletos
const boletosInfo = await db.select()...
// Filtrar em memória
const result = propostasElegiveis.filter(...)
```

Resultado: Mesmo erro ao tentar buscar boletos

## IMPLEMENTAÇÃO CRÍTICA QUE PODE ESTAR CAUSANDO O PROBLEMA

### 1. Sistema de Segurança OWASP (implementado recentemente)

- **Row Level Security (RLS)** no Supabase
- **Políticas de segurança por role** (ADMINISTRADOR, FINANCEIRO, ATENDENTE)
- **Middleware de validação JWT** que enriquece req.user com roles
- **Guards de autorização** em todas as rotas

### 2. Migração de Banco de Dados

O campo `proposta_id` na tabela `inter_collections` foi definido como TEXT referenciando UUID:

```sql
CREATE TABLE inter_collections (
  id SERIAL PRIMARY KEY,
  proposta_id TEXT REFERENCES propostas(id) NOT NULL,
  ...
);
```

### 3. Sistema de Filtragem Complexa

A rota `/api/pagamentos` aplica múltiplos filtros de segurança:

- CCB deve estar assinada (`ccb_gerado = true`)
- Assinatura eletrônica concluída (`assinatura_eletronica_concluida = true`)
- Boletos devem estar gerados (JOIN com inter_collections)
- Status deve ser `pronto_pagamento`

## LOGS COMPLETOS DO SERVIDOR

```
[PAGAMENTOS DEBUG] Total propostas: 24
[PAGAMENTOS DEBUG] Propostas aprovadas: 10
[PAGAMENTOS DEBUG] Propostas com CCB assinada: 2
[PAGAMENTOS DEBUG] Propostas com boletos Inter: 1
[PAGAMENTOS DEBUG] Proposta com boleto Inter ID: 902183dd-b5d1-4e20-8a72-79d3d3559d4d
[PAGAMENTOS DEBUG] Status da proposta com boleto: {
  id: '902183dd-b5d1-4e20-8a72-79d3d3559d4d',
  status: 'pronto_pagamento',
  ccbGerado: true,
  assinaturaEletronicaConcluida: true,
  clienteNome: 'João Silva'
}
[PAGAMENTOS DEBUG] ========== ANÁLISE DE BOLETOS ==========
Erro ao buscar pagamentos: PostgresError: operator does not exist: text = uuid
```

## COMPORTAMENTO DO FRONTEND

1. Tela fica carregando por ~10 segundos
2. Erro 500 Internal Server Error
3. React Query tenta 3 vezes (retry padrão)
4. Usuário vê mensagem "Erro ao carregar pagamentos"

## ARQUIVOS RELEVANTES

1. **server/routes/pagamentos.ts** - Rota com erro
2. **shared/schema.ts** - Definição das tabelas
3. **server/routes.ts** - Registro das rotas
4. **client/src/pages/financeiro/pagamentos.tsx** - Frontend

## TEORIA DO PROBLEMA

Acredito que o problema está na incompatibilidade de tipos entre:

1. Como o Drizzle ORM está gerando o SQL
2. Como o PostgreSQL está interpretando os tipos
3. Possível interferência das políticas RLS do Supabase

## PERGUNTAS CRÍTICAS

1. **Por que o erro mudou de "uuid = integer" para "text = uuid"?**
2. **Por que a posição do erro mudou de 2571 para 216?**
3. **As políticas RLS podem estar interferindo na comparação de tipos?**
4. **Existe alguma forma de fazer esse JOIN funcionar sem alterar o schema?**

## SOLUÇÃO NECESSÁRIA

Precisamos de uma forma de fazer JOIN entre:

- `propostas.id` (UUID)
- `inter_collections.proposta_id` (TEXT)

Sem quebrar:

- As políticas de segurança RLS
- A integridade referencial
- A performance da query

## INFORMAÇÕES ADICIONAIS

- Banco: PostgreSQL via Supabase
- ORM: Drizzle ORM
- Framework: Express + TypeScript
- Todas as outras telas do sistema funcionam normalmente
- O problema é específico da tela de Pagamentos
- Sistema em produção na próxima semana

**URGENTE: Este é um bloqueador crítico para o deploy em produção.**
