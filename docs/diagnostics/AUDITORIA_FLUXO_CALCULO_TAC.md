# AUDITORIA FORENSE DO FLUXO DE CÁLCULO TAC - TRACK 2 FASE 1

**Data:** 2025-09-03  
**Auditor:** Replit Agent  
**Protocolo:** PAM V1.0 + PACN V1.0  
**Status:** EM PROGRESSO

---

## 📋 CENÁRIO DE NEGÓCIO AUDITADO

**Regra a Implementar:** Durante a criação de uma nova proposta, o sistema deve:
1. Identificar se o cliente (CPF) é novo ou existente
2. Se novo: aplicar TAC de 10% sobre o valor da proposta  
3. Se existente: usar lógica atual de cálculo TAC

---

## 🔍 DESCOBERTAS FORENSES

### 1. PONTO DE VERIFICAÇÃO (Cliente Novo vs. Existente)

**Arquivo:** `server/repositories/cliente.repository.ts`  
**Função Responsável:** `clientExists(cpf: string): Promise<boolean>`

```typescript
// LINHAS 55-67
async clientExists(cpf: string): Promise<boolean> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(propostas)
      .where(eq(propostas.clienteCpf, cpf));

    return (result[0]?.count || 0) > 0;
  } catch (error) {
    console.error('[CLIENTE_REPO] Error checking client existence:', error);
    return false;
  }
}
```

**✅ EVIDÊNCIA:** A função verifica existência baseada em propostas com mesmo CPF na tabela `propostas`.

**Outros métodos relevantes:**
- `findByCPF(cpf)` - retorna dados da proposta mais recente
- `getProposalsByCPF(cpf)` - retorna todas as propostas do CPF

### 2. PONTO DE CÁLCULO (Lógica da TAC)

#### 2.1 Serviço Centralizado Identificado
**Arquivo:** `server/services/tacCalculationService.ts` 

**Método Principal:** `calculateTac(produtoId, valorEmprestimo, clienteCpf)`

```typescript
// LÓGICA ATUAL COMPLETA:
1. Verifica se cliente é cadastrado (via isClienteCadastrado)
2. Se cadastrado: TAC = 0 (isenção completa)
3. Se não cadastrado: calcula via produto
   - TAC Fixo: valor direto do produto  
   - TAC Percentual: (valorEmprestimo * tacValor) / 100
```

**Critério de Cliente Cadastrado:**
Status: ['aprovado', 'ASSINATURA_CONCLUIDA', 'QUITADO']

**🎯 DESCOBERTA CRÍTICA:** Este serviço JÁ implementa lógica de cliente novo vs existente!

#### 2.2 Cálculo no Use Case  
**Arquivo:** `server/modules/proposal/application/CreateProposalUseCase.ts`  
**Linha 158:** 

```typescript
const valorTac = dto.valorTac || (dto.valor * 0.02); // 2% do valor HARDCODED
```

**🚨 PROBLEMA CRÍTICO:** Lógica duplicada! O Use Case não usa o TacCalculationService.

**⚡ IMPACTO:** O sistema atual aplica TAC de 2% para TODOS os clientes, ignorando:
- Configuração por produto (tacValor/tacTipo)
- Isenção para clientes cadastrados
- Flexibilidade do TacCalculationService

#### 2.3 Configuração por Produto
**Tabela:** `produtos`  
**Campos:**
- `tacValor` - decimal(10,2) 
- `tacTipo` - text ('fixo' ou 'percentual')

### 3. PONTO DE PERSISTÊNCIA (Salvando a TAC)

**Tabela:** `propostas`  
**Campo:** `valorTac` - decimal(10,2)

**Fluxo de Persistência:**
1. Cálculo no Use Case (linha 158)
2. Construção do DTO (linha 181)  
3. Criação do agregado Proposal (linha 199)
4. Persistência via repository (linha 229)

---

## ⚠️ ANÁLISE DE RISCOS IDENTIFICADOS

### RISCO CRÍTICO - Lógica Descentralizada ✅ CONFIRMADO
- **Evidência:** TacCalculationService existe mas não é usado no CreateProposalUseCase
- **Impacto:** Clientes cadastrados pagam TAC (deveriam ter isenção)

### RISCO ALTO - Regra de Negócio Invertida ✅ CONFIRMADO  
- **Evidência:** Sistema atual: clientes cadastrados têm isenção (TAC = 0)
- **Nova regra:** Clientes NOVOS devem pagar 10%, existentes seguem produto
- **Impacto:** Lógica atual é oposta à nova regra

### RISCO MÉDIO - Configuração Ignorada ✅ CONFIRMADO
- **Evidência:** Produtos têm tacValor/tacTipo configurados mas não são usados
- **Impacto:** Flexibilidade do sistema não é aproveitada

---

## 📊 AVALIAÇÃO ARQUITETURAL

### Flexibilidade da Arquitetura Atual: **PARCIALMENTE ADEQUADA**

**Pontos Positivos:**
✅ TacCalculationService centralizado existe  
✅ Verificação de cliente existente implementada  
✅ Campo valorTac na proposta suporta novos valores  
✅ Configuração por produto via tacValor/tacTipo  

**Limitações Críticas:**
❌ Use Case não usa o serviço centralizado  
❌ Lógica atual é OPOSTA à nova regra (existentes isentos vs novos pagam 10%)  
❌ TacCalculationService precisa ser adaptado para nova regra

---

## 🔧 MUDANÇAS NECESSÁRIAS (Alto Nível)

1. **Refatorar CreateProposalUseCase:**
   - Remover cálculo hardcoded (linha 158)
   - Usar TacCalculationService
   - Adicionar verificação se cliente é novo

2. **Inverter Lógica do TacCalculationService:**
   - Clientes novos: 10% do valor do empréstimo
   - Clientes existentes: usar configuração do produto (tacValor/tacTipo)
   - Remover isenção atual para clientes cadastrados

3. **Estratégia de Implementação:**
   ```typescript
   // Nova lógica conceitual:
   const isClienteCadastrado = await TacCalculationService.isClienteCadastrado(cpf);
   const valorTac = !isClienteCadastrado 
     ? valorEmprestimo * 0.10  // 10% para clientes NOVOS
     : calcularTacPorProduto(produtoId, valorEmprestimo); // Existentes via produto
   ```

---

## 🎯 VEREDITO FINAL

**Viabilidade:** ✅ **ALTA** - Infraestrutura já existe  
**Complexidade:** 🟡 **MÉDIA** - Requer inversão da lógica atual  
**Risco de Regressão:** 🔴 **ALTO** - Mudança comportamental significativa

**⚠️ ATENÇÃO ESPECIAL:** Nova regra inverte comportamento atual:
- **Antes:** Clientes novos pagam TAC via produto, existentes isentos
- **Depois:** Clientes novos pagam 10%, existentes pagam via produto

**Próximos Passos:**
1. Implementar nova lógica no TacCalculationService
2. Refatorar CreateProposalUseCase para usar serviço
3. Testes para validar ambos os cenários (cliente novo/existente)

---

*Auditoria concluída conforme protocolo PACN V1.0*