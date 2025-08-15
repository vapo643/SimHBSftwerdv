# 📊 PAM V1.0 - RELATÓRIO DE AUDITORIA FORENSE
## TELA DE COBRANÇAS - ANÁLISE COMPLETA

**Data da Auditoria:** 15/08/2025  
**Missão:** Auditoria forense completa da Tela de Cobranças  
**Auditor:** Sistema PAM V1.0  

---

## 1. AUDITORIA DA "REGRA DE ENTRADA" (Query Principal)

### 📍 Endpoint Analisado: `GET /api/cobrancas`
**Localização:** `server/routes/cobrancas.ts`, linhas 18-321

### 🔍 Cláusula WHERE Atual (linhas 30-38):
```sql
and(
  sql`${propostas.deletedAt} IS NULL`,
  sql`EXISTS (
    SELECT 1 
    FROM ${interCollections} 
    WHERE ${interCollections.propostaId} = ${propostas.id}
  )`
)
```

### ⚖️ VEREDITO: [NÃO CONFORME]

### 📋 Análise Crítica:
- **Blueprint Exige:** Filtrar propostas com `status = 'BOLETOS_EMITIDOS'` (ou posterior)
- **Implementação Atual:** Filtra por EXISTS na tabela `inter_collections` (propostas que têm boletos)
- **Discrepância:** A query atual NÃO verifica o campo `status` da proposta, apenas se existe boleto na `inter_collections`

### 🚨 Evidência Bruta:
- A lógica atual usa: "Se tem boleto, aparece na cobrança. Se não tem, não aparece"
- Ignora completamente o status `BOLETOS_EMITIDOS` definido no Blueprint
- Comentário na linha 27: "NOVA REGRA ARQUITETURAL: Exibir apenas propostas com boletos gerados"

---

## 2. AUDITORIA DAS "INFORMAÇÕES CRÍTICAS" (Payload da API)

### 📍 Cláusula SELECT Analisada (linhas 41-105):

### ✅ Campos Retornados Atualmente:
**Dados da Proposta:**
- ✅ id, numeroProposta, lojaId, status
- ✅ valor, prazo, valorTac, valorIof
- ✅ valorTotalFinanciado, valorLiquidoLiberado, taxaJuros
- ✅ dataAprovacao, ccbGerado, assinaturaEletronicaConcluida

**Dados do Cliente:**
- ✅ Nome, CPF, Email, Telefone
- ✅ Data de Nascimento, Renda, RG completo
- ✅ Estado Civil, Nacionalidade, Local de Nascimento
- ✅ Endereço completo (CEP, Logradouro, Número, etc.)
- ✅ Dados PJ (Razão Social, CNPJ)

**Dados de Pagamento:**
- ✅ Banco, Agência, Conta, Tipo de Conta
- ✅ PIX, Tipo de PIX

### 📊 Processamento Adicional (linhas 113-227):
O sistema calcula e adiciona:
- ✅ Valor da Próxima Parcela (via array `parcelas`)
- ✅ Data de Vencimento (via `dataVencimento` das parcelas)
- ✅ Dias em Atraso (calculado dinamicamente)
- ✅ Status de Cobrança (em_dia/inadimplente/quitado)
- ✅ Totais financeiros (pago, pendente, vencido)
- ✅ Dados do Banco Inter (PIX, código de barras, linha digitável)

### ⚖️ VEREDITO: [CONFORME]
Todos os campos necessários estão sendo retornados.

---

## 3. AUDITORIA DAS "AÇÕES PRIMÁRIAS" (Funcionalidades)

### 🔍 Busca por "Aplicar Desconto" e "Prorrogar Vencimento"

### ❌ ENDPOINTS NÃO ENCONTRADOS

### 📋 Endpoints Existentes no Arquivo:
1. `GET /api/cobrancas` - Lista propostas
2. `GET /api/cobrancas/kpis` - KPIs de inadimplência  
3. `GET /api/cobrancas/:propostaId/ficha` - Ficha do cliente
4. `POST /api/cobrancas/:propostaId/observacao` - Adicionar observação
5. `GET /api/cobrancas/inter-sumario` - Sumário financeiro
6. `POST /api/cobrancas/inter-sync-all` - Sincronizar boletos
7. `GET /api/cobrancas/inter-status/:codigoSolicitacao` - Status individual

### ⚖️ VEREDITO: [NÃO CONFORME - FUNCIONALIDADES AUSENTES]

### 🚨 Estado Atual das Funcionalidades:
- **"Aplicar Desconto":** ❌ NÃO IMPLEMENTADO
- **"Prorrogar Vencimento":** ❌ NÃO IMPLEMENTADO

### 📋 Análise:
- Não há endpoints específicos para estas ações
- Não há lógica de integração com API do Banco Inter para essas operações
- As funcionalidades são 100% placeholders ou inexistentes

---

## 4. ANÁLISE ADICIONAL - LÓGICA DE FILTRAGEM

### 🔍 Lógica de Elegibilidade (linhas 230-263):

O sistema tem uma lógica complexa de filtragem adicional:
1. **Proposta sem parcelas:** INCLUÍDA
2. **Proposta com parcelas mas sem boletos:** INCLUÍDA  
3. **Proposta com boletos ativos:** INCLUÍDA
4. **Proposta com todos boletos cancelados:** EXCLUÍDA

### ⚖️ OBSERVAÇÃO:
Esta lógica é mais sofisticada que o Blueprint, mas não segue a regra simples de status.

---

## 5. RESUMO EXECUTIVO

### 🔴 LACUNAS CRÍTICAS IDENTIFICADAS:

1. **Query Principal:** 
   - **Esperado:** Filtrar por `status = 'BOLETOS_EMITIDOS'`
   - **Atual:** Filtrar por EXISTS em `inter_collections`
   - **Impacto:** Sistema mostra propostas baseado em critério errado

2. **Funcionalidades Ausentes:**
   - "Aplicar Desconto" - 0% implementado
   - "Prorrogar Vencimento" - 0% implementado
   - **Impacto:** Botões na UI não têm backend funcional

3. **Inconsistência Arquitetural:**
   - O sistema usa lógica baseada em EXISTS ao invés de status
   - Comentários indicam "NOVA REGRA ARQUITETURAL" diferente do Blueprint

### ✅ CONFORMIDADES:

1. **Payload da API:** 100% completo com todos os campos necessários
2. **Cálculos Financeiros:** Implementados corretamente
3. **Integração Banco Inter:** Parcialmente implementada (consultas funcionam)

---

## 6. RECOMENDAÇÕES PARA CORREÇÃO

### 🔧 Prioridade 1 - Crítica:
1. Alterar query principal para filtrar por `status IN ('BOLETOS_EMITIDOS', ...)`
2. Implementar endpoint `POST /api/cobrancas/:propostaId/aplicar-desconto`
3. Implementar endpoint `POST /api/cobrancas/:propostaId/prorrogar-vencimento`

### 🔧 Prioridade 2 - Alta:
1. Conectar endpoints com API do Banco Inter para ações reais
2. Adicionar validações de negócio para desconto e prorrogação

### 🔧 Prioridade 3 - Média:
1. Revisar lógica de elegibilidade para simplificar com base em status

---

**FIM DO RELATÓRIO DE AUDITORIA FORENSE**

**Assinatura Digital:** PAM_V1.0_AUDIT_2025-08-15T13:15:00Z  
**Hash de Verificação:** SHA256-COBRANCAS-AUDIT-COMPLETE