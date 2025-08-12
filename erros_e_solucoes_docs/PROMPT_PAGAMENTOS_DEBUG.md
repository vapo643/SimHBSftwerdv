# PROMPT PARA DEPURAÇÃO - TELA DE PAGAMENTOS NÃO MOSTRA PROPOSTAS CORRETAS

## CONTEXTO DO PROBLEMA
Estamos desenvolvendo um sistema de gestão de crédito em TypeScript/React/Express com PostgreSQL. A tela de pagamentos deveria mostrar:

1. **Propostas com status "pronto_pagamento"** - últimos passos antes do pagamento
2. **Propostas que têm boletos gerados e estão em cobrança** - para permitir o pagamento do empréstimo ao cliente

## PROBLEMA ATUAL
A query atual só retorna propostas com status "pronto_pagamento", mas NÃO está retornando as propostas que têm boletos gerados em cobrança.

## LOGS DO SISTEMA
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
  clienteNome: null
}
[PAGAMENTOS DEBUG] Total propostas encontradas: 2
```

## QUERY ATUAL (server/routes/pagamentos.ts)
```typescript
const result = await db
  .select({
    id: propostas.id,
    clienteNome: propostas.clienteNome,
    // ... outros campos
    temBoleto: sql<boolean>`CASE WHEN EXISTS (
      SELECT 1 FROM inter_collections 
      WHERE inter_collections.proposta_id = ${propostas.id}
    ) THEN true ELSE false END`
  })
  .from(propostas)
  .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
  .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
  .where(
    and(
      sql`${propostas.deletedAt} IS NULL`,
      or(
        // Propostas com boletos gerados no Inter Bank
        sql`EXISTS (SELECT 1 FROM inter_collections WHERE inter_collections.proposta_id = ${propostas.id})`,
        // Propostas com status pronto_pagamento
        eq(propostas.status, 'pronto_pagamento')
      )
    )
  )
  .orderBy(desc(propostas.dataAprovacao));
```

## TABELAS RELEVANTES
- `propostas` - tabela principal com dados das propostas
- `inter_collections` - tabela que armazena os boletos gerados pelo Banco Inter
- Status possíveis: 'rascunho', 'aguardando_analise', 'em_analise', 'aprovado', 'rejeitado', 'pronto_pagamento', 'pago', 'cancelado', 'pendente'

## FLUXO DE NEGÓCIO
1. Proposta é criada → aprovada → gera CCB → assina digitalmente → gera boleto → vai para cobrança
2. Quando chega em "pronto_pagamento" ou tem boleto gerado, deve aparecer na tela de pagamentos
3. Na tela de pagamentos, o financeiro pode aprovar o pagamento do empréstimo ao cliente

## QUESTÃO PRINCIPAL
**Por que a query não está retornando as propostas que têm boletos gerados mas podem ter status diferente de "pronto_pagamento"?**

O cliente relatou que existem propostas com boletos gerados que aparecem na tela de cobranças mas NÃO aparecem na tela de pagamentos.

## REQUISITOS DA SOLUÇÃO
1. A query deve retornar TODAS as propostas que:
   - Tenham status "pronto_pagamento" OU
   - Tenham boletos gerados (existam em inter_collections) independente do status

2. Não deve haver restrições desnecessárias como:
   - Exigir CCB gerado
   - Exigir assinatura eletrônica
   - Limitar por status específicos

## PERGUNTA
Como corrigir a query para garantir que TODAS as propostas com boletos gerados apareçam na tela de pagamentos, independente do status atual da proposta?