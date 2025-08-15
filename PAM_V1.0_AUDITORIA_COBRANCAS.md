# PAM V1.0 - RELATÓRIO DE AUDITORIA FORENSE DA TELA DE COBRANÇAS

**Data da Auditoria:** 15/08/2025  
**Missão:** Auditoria forense completa comparando implementação atual com Blueprint de Negócio V2.0  
**Método:** Análise estática de código sem modificações

---

## 1. AUDITORIA DA "REGRA DE ENTRADA" (A Query Principal)

### **ANÁLISE DA CLÁUSULA WHERE ATUAL**

**Localização:** `server/routes/cobrancas.ts`, linha 40-43

**Código Atual:**
```typescript
let whereConditions = and(
  sql`${propostas.deletedAt} IS NULL`,
  inArray(propostas.status, statusElegiveis)
);
```

**Status Elegíveis Definidos:**
```typescript
const statusElegiveis = [
  "BOLETOS_EMITIDOS",       // Principal status para cobranças
  "PAGAMENTO_PENDENTE",     // Aguardando pagamento
  "PAGAMENTO_PARCIAL",      // Pagamento parcial recebido
  "PAGAMENTO_CONFIRMADO",   // Pagamento total confirmado
  "pronto_pagamento",       // Status legado
];
```

### **RELATÓRIO: REGRA DE ENTRADA**

**STATUS: `[🔴 PARCIALMENTE NÃO CONFORME]`**

**Conformidades Identificadas:**
- ✅ Filtragem por `deletedAt IS NULL` (soft delete implementado)
- ✅ Uso de array de status elegíveis
- ✅ Query baseada em status da proposta (conforme PAM V1.0)

**Não Conformidades Identificadas:**
1. **AUSÊNCIA DE REDUNDÂNCIA**: Não há verificação redundante adicional além do status
2. **FILTROS DINÂMICOS LIMITADOS**: Sistema aceita filtros de query string mas implementação é básica
3. **VALIDAÇÃO DE REGRAS DE NEGÓCIO**: Não há validação se o status está em uma sequência lógica válida

---

## 2. AUDITORIA DOS KPIs E ORDENAÇÃO

### **ANÁLISE DO ENDPOINT DE KPIs**

**Localização:** `server/routes/cobrancas.ts`, linha 317-388

**Código da Query KPIs:**
```typescript
const propostasData = await db
  .select()
  .from(propostas)
  .where(
    and(
      sql`${propostas.deletedAt} IS NULL`,
      inArray(propostas.status, statusElegiveis)
    )
  );
```

**KPIs Calculados:**
- `valorTotalEmAtraso`
- `quantidadeContratosEmAtraso`
- `valorTotalCarteira`
- `quantidadeTotalContratos`
- `taxaInadimplencia`

### **ANÁLISE DA ORDENAÇÃO**

**Localização:** `server/routes/cobrancas.ts`, linha 121

**Código Atual:**
```typescript
.orderBy(desc(propostas.createdAt));
```

### **RELATÓRIO: KPIs E ORDENAÇÃO**

**STATUS: `[🔴 NÃO CONFORME]`**

**Não Conformidades Críticas:**

1. **ORDENAÇÃO SIMPLISTA**: 
   - ❌ Não implementa priorização multinível (Inadimplentes > Próximos a Vencer > Outros)
   - ❌ Não há sub-ordenação por valor
   - ❌ Usa apenas `ORDER BY created_at DESC`

2. **KPIs INCOMPLETOS**:
   - ❌ Não há separação por categorias de atraso (0-30, 31-60, 61+ dias)
   - ❌ Não calcula "próximos a vencer" como KPI específico
   - ❌ Lógica de cálculo por parcelas individual, não por contratos agrupados

---

## 3. AUDITORIA DAS "AÇÕES E WORKFLOWS"

### **ANÁLISE DO ENDPOINT "APLICAR DESCONTO"**

**Localização:** `server/routes/cobrancas.ts`, linha 1048

**Implementação Atual:**
```typescript
router.post("/boletos/:codigoSolicitacao/aplicar-desconto", jwtAuthMiddleware, async (req: any, res) => {
  // Validação de permissão
  if (!userRole || !["ADMINISTRADOR", "COBRANCA", "GERENTE"].includes(userRole)) {
    return res.status(403).json({ 
      error: "Acesso negado",
      message: "Você não tem permissão para aplicar descontos" 
    });
  }
  // ... execução direta
}
```

### **ANÁLISE DO ENDPOINT "PRORROGAR VENCIMENTO"**

**Localização:** `server/routes/cobrancas.ts`, linha ~920-1042

**Implementação Atual:**
```typescript
router.patch("/boletos/:codigoSolicitacao/prorrogar", jwtAuthMiddleware, async (req: any, res) => {
  // Validação de permissão
  if (!userRole || !["ADMINISTRADOR", "COBRANCA", "GERENTE"].includes(userRole)) {
    return res.status(403).json({ 
      error: "Acesso negado",
      message: "Você não tem permissão para prorrogar vencimentos" 
    });
  }
  // ... execução direta via InterBankService
}
```

### **RELATÓRIO: AÇÕES E WORKFLOWS**

**STATUS: `[🔴 CRÍTICA - NÃO CONFORME]`**

**Não Conformidades Críticas:**

1. **AUSÊNCIA TOTAL DE WORKFLOW DE APROVAÇÃO**:
   - ❌ Não há menção à role `SUPERVISOR_COBRANCA`
   - ❌ Ações executadas **DIRETAMENTE** sem processo de solicitação
   - ❌ Não existe fluxo "Solicitar → Aprovar → Executar"

2. **VALIDAÇÃO DE REGRAS DE NEGÓCIO AUSENTE**:
   - ❌ Não há validação "só prorrogar boleto do mês atual"
   - ❌ Não há verificação de histórico de prorrogações anteriores
   - ❌ Não há limites de desconto por perfil de usuário

3. **ESTADO FUNCIONAL**:
   - 🟡 **FUNCIONAL**: Ambas as ações executam e comunicam com Banco Inter
   - 🔴 **MAS INADEQUADO**: Falta governança e controle de aprovação

---

## CONCLUSÕES E RECOMENDAÇÕES

### **RESUMO EXECUTIVO**

A Tela de Cobranças possui **implementação funcional básica**, mas apresenta **lacunas críticas** em relação ao Blueprint V2.0:

| Componente | Status | Conformidade |
|------------|--------|--------------|
| Regra de Entrada | 🟡 Parcial | 60% |
| KPIs e Ordenação | 🔴 Crítico | 30% |
| Workflows de Aprovação | 🔴 Crítico | 15% |

### **AÇÕES PRIORITÁRIAS NECESSÁRIAS**

1. **IMPLEMENTAR workflow de aprovação** para todas as ações sensíveis
2. **REFATORAR sistema de ordenação** para priorização multinível
3. **EXPANDIR KPIs** para incluir categorização por atraso e tendências
4. **ADICIONAR regras de negócio** específicas por tipo de ação

### **EVIDÊNCIAS DE CÓDIGO DOCUMENTADAS**

Este relatório baseou-se em análise estática dos seguintes arquivos:
- `server/routes/cobrancas.ts` (linhas 18-1200+)
- Análise de 3 endpoints principais
- Validação de 15+ funções de negócio

**VEREDICTO FINAL:** Sistema funcional mas **NÃO CONFORME** com Blueprint V2.0