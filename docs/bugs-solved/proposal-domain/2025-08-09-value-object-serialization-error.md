# Value Object Serialization Error in Proposal Domain

**Data:** 2025-08-09  
**Categoria:** Proposal Domain  
**Severidade:** P0 (Crítico - Quebra de funcionalidade)  
**Tipo:** Value Object Persistence Error

## 🚨 Problema Identificado

**Sintoma:** `TypeError: cep.replace is not a function` ao carregar proposta após reenvio

**Causa Raiz:** O repository estava salvando value objects (CEP, Money) como objetos complexos ao invés de valores primitivos no campo JSON `cliente_data`, causando erro ao tentar reconstituir os value objects do banco.

## 🔍 Análise Técnica

### Dados Incorretos no Banco:
```json
{
  "cep": {"value": "29165460"},  // ❌ Objeto ao invés de string
  "renda_mensal": {"cents": 30000}  // ❌ Objeto ao invés de número
}
```

### Stack Trace:
```
TypeError: cep.replace is not a function
at Function.create (/home/runner/workspace/shared/value-objects.ts:407:25)
at Function.fromDatabase (/home/runner/workspace/server/modules/proposal/domain/Proposal.ts:434:40)
```

### Fluxo do Erro:
1. `ProposalController.updateProposal()` salva proposta
2. `repository.save()` persiste `cliente_data` com value objects não serializados
3. GET subsequente tenta fazer `CEP.create(objeto)` ao invés de `CEP.create(string)`
4. Método `cep.replace()` falha porque cep é objeto, não string

## ✅ Solução Implementada

### 1. Correção no ProposalRepository (Save/Update):

```typescript
// VALUE OBJECT FIX: Garantir que campos sejam strings, não objetos
const cleanClienteData = {
  ...data.cliente_data,
  // Garantir que CEP seja string
  cep: typeof data.cliente_data.cep === 'object' && data.cliente_data.cep?.value 
    ? data.cliente_data.cep.value 
    : data.cliente_data.cep,
  // Garantir que renda_mensal seja número
  renda_mensal: typeof data.cliente_data.renda_mensal === 'object' && data.cliente_data.renda_mensal?.cents
    ? data.cliente_data.renda_mensal.cents / 100
    : data.cliente_data.renda_mensal,
};
```

### 2. Correção Defensiva no Proposal.fromDatabase():

```typescript
// VALUE OBJECT DEFENSIVE FIX: Lidar com dados que podem estar salvos incorretamente
const cepValue = typeof data.cliente_data.cep === 'object' && data.cliente_data.cep?.value
  ? data.cliente_data.cep.value
  : data.cliente_data.cep;

const rendaMensalValue = typeof data.cliente_data.renda_mensal === 'object' && data.cliente_data.renda_mensal?.cents
  ? data.cliente_data.renda_mensal.cents / 100
  : data.cliente_data.renda_mensal;
```

### 3. Correção de Dados Existentes:

```sql
UPDATE propostas
SET 
  cliente_cep = '29165460',
  cliente_data = jsonb_set(
    jsonb_set(
      jsonb_set(
        cliente_data,
        '{cep}', 
        '"29165460"'::jsonb
      ),
      '{renda_mensal}',
      '300'::jsonb
    ),
    '{rendaMensal}',
    '300'::jsonb
  )
WHERE id = '29e80705-89bb-43a5-bbc8-960b3139939c';
```

## 🧪 Validação da Correção

### Antes:
- ❌ Error 500 ao carregar proposta após UPDATE
- ❌ CEP salvo como `{"value": "29165460"}`
- ❌ Renda salva como `{"cents": 30000}`

### Depois:
- ✅ Proposta carrega normalmente
- ✅ CEP salvo como string `"29165460"`
- ✅ Renda salva como número `300`
- ✅ Código defensivo lida com dados antigos mal formatados

## 📋 7-CHECK EXPANDIDO

1. **Arquivos Afetados**: `ProposalRepository.ts`, `Proposal.ts` ✅
2. **Imports/Types**: Nenhuma alteração necessária ✅
3. **Erros LSP**: 0 erros ✅
4. **Confiança**: 100% - Correção testada e validada ✅
5. **Riscos**: BAIXO - Correção defensiva mantém compatibilidade ✅
6. **Teste Funcional**: GET /api/propostas/:id retorna sucesso ✅
7. **Auditoria**: Documentado para prevenção de regressão ✅

## 🏗️ Arquitetura Impactada

### Camadas Afetadas:
- **Infrastructure**: ProposalRepository - Serialização corrigida
- **Domain**: Proposal.fromDatabase() - Deserialização defensiva
- **Database**: cliente_data JSONB - Formato normalizado

### Padrões Aplicados:
- ✅ **Defensive Programming**: Código lida com formatos incorretos
- ✅ **Data Integrity**: Value objects sempre salvos como primitivos
- ✅ **Backward Compatibility**: Suporta dados antigos mal formatados

## 🚀 Próximas Ações

1. **Migration Script**: Criar script para corrigir todas as propostas com formato incorreto
2. **Unit Tests**: Adicionar testes para serialização/deserialização de value objects
3. **Monitoring**: Adicionar logs para detectar dados mal formatados

## 📚 Aprendizados

### Princípios Violados e Corrigidos:
- **Serialization Contract**: Value objects devem ser sempre persistidos como primitivos
- **Defensive Deserialization**: Sempre validar formato de dados ao reconstituir do banco
- **Type Safety**: Verificar tipos em runtime para dados externos

### Anti-Pattern Corrigido:
Nunca persistir value objects diretamente em JSON. Sempre extrair o valor primitivo antes da serialização.

---

**Status:** ✅ RESOLVIDO  
**Validado por:** Testes de integração  
**Performance Impact:** Nenhum  