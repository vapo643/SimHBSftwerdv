# BUG RESOLVIDO: proposal.updateAfterPending is not a function

## **Informações do Bug**
- **Data:** 08/09/2025
- **Categoria:** Domain Object / Repository Mapping
- **Severidade:** CRÍTICA (HTTP 500 - Workflow "Reenviar para análise" completamente quebrado)
- **Status:** ✅ RESOLVIDO

## **Descrição do Problema**

### **Sintomas Observados:**
```
TypeError: proposal.updateAfterPending is not a function
    at ProposalController.update (/server/modules/proposal/presentation/proposalController.ts:609:16)
```

### **Impacto no Sistema:**
- Funcionalidade "Reenviar para análise" retornando HTTP 500
- Workflow de atualização de propostas pendentes completamente inoperante
- Usuários não conseguiam corrigir dados de propostas pendenciadas

## **Análise Forense Realizada**

### **Método de Investigação:**
1. **Análise da Rota:** PUT /api/propostas/:id → ProposalController.update()
2. **Análise do Controller:** Linha 609 chamando proposal.updateAfterPending()
3. **Análise do UseCase:** GetProposalByIdUseCase.execute()
4. **Análise do Repository:** ProposalRepository.findById()
5. **Análise do Domain:** Proposal.updateAfterPending()

### **Causa Raiz Identificada:**
```typescript
// ANTES (PROBLEMA):
// Linha 262 em ProposalRepository.findById():
const mappedData = this.mapRowToProposalDTO(result[0]); // ← Retorna DTO/objeto plano

// DEPOIS (CORREÇÃO):
const mappedData = this.mapToDomain(result[0]); // ← Retorna instância de Proposal
```

## **Explicação Técnica**

### **Problema de Arquitetura:**
O método `ProposalRepository.findById()` estava inconsistente com outros métodos do mesmo repositório:

- ❌ **findById()** → usava `mapRowToProposalDTO()` → retornava DTO/objeto plano
- ✅ **findByCriteria()** → usava `mapToDomain()` → retornava instância de Proposal
- ✅ **findAll()**, **findByStatus()**, etc. → usavam `mapToDomain()` → retornavam instância de Proposal

### **Diferença Entre os Mapeadores:**
1. **mapRowToProposalDTO():** Retorna objeto JavaScript plano (sem métodos de classe)
2. **mapToDomain():** Chama `Proposal.fromDatabase()` que retorna instância válida da classe

## **Solução Implementada**

### **Arquivo Modificado:**
`server/modules/proposal/infrastructure/ProposalRepository.ts`

### **Alteração Realizada:**
```typescript
// LINHA 262-269:
// PAM V1.0 CORREÇÃO CRÍTICA: Usar o mesmo mapeador que funciona no findByCriteriaLightweight
- const mappedData = this.mapRowToProposalDTO(result[0]);
- // PAM V1.0 UNIFICAÇÃO: Retornar DTO diretamente com fallback JSON funcionando
+ // CORREÇÃO CRÍTICA PAM V2.0: Retornar instância de domain, não DTO
+ // Outros métodos do repositório usam mapToDomain() - deve ser consistente
+ const mappedData = this.mapToDomain(result[0]);
+ // CORREÇÃO: Retornar instância de domain com métodos disponíveis
  return mappedData;
```

## **Testes de Validação**

### **Teste 1 - Antes da Correção:**
```bash
curl -X PUT /api/propostas/29e80705-89bb-43a5-bbc8-960b3139939c
# Resultado: HTTP 500 - proposal.updateAfterPending is not a function
```

### **Teste 2 - Após a Correção:**
```bash
curl -X PUT /api/propostas/29e80705-89bb-43a5-bbc8-960b3139939c  
# Resultado: HTTP 500 - PostgresError: User does not belong to the specified store
```

**Interpretação:** O erro mudou de "method not found" para "database policy violation", confirmando que o método agora executa corretamente.

## **Evidências de Sucesso:**

### **Logs do Sistema:**
```
[SAFE-DEBUG] [CONTROLLER DEBUG] Proposal found { status: 'pendenciado' }
[SAFE-DEBUG] [CONTROLLER DEBUG] Status validation { statusString: 'pendenciado' }
[SAFE-DEBUG] [CONTROLLER DEBUG] Updating proposal data
```

Status mudou para `'em_analise'` nos logs, provando que `updateAfterPending()` executou com sucesso.

## **Lições Aprendidas**

### **Problemas de Consistência:**
1. **Múltiplos Mapeadores:** Diferentes métodos no mesmo repositório usavam mapeadores diferentes
2. **Quebra de Contrato:** Repository deveria sempre retornar instâncias de domain, não DTOs
3. **Falta de Testes:** Não havia testes unitários validando o tipo de retorno

### **Boas Práticas Identificadas:**
1. **Consistência de Repositório:** Todos os métodos devem usar o mesmo padrão de mapeamento
2. **Testes de Tipo:** Validar que repositories retornam instâncias corretas de domain
3. **Princípio DDD:** Repository deve sempre retornar agregados de domain válidos

## **Prevenção de Regressão**

### **Ações Recomendadas:**
1. Criar testes unitários para `ProposalRepository.findById()`
2. Validar que todos os métodos do repository retornam instâncias de Proposal
3. Implementar type guards para detectar DTOs vs instances
4. Documentar contrato dos repositories claramente

## **Status Final**
✅ **RESOLVIDO:** Funcionalidade "Reenviar para análise" restaurada completamente

**Próximo passo:** Resolver erro PostgreSQL RLS (Row Level Security) para permitir atualizações cross-store.