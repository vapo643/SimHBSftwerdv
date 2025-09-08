# 🔍 RELATÓRIO DE AUDITORIA COMPLETA

## API de Simulação de Empréstimo e Schema de Dados

**Data da Auditoria:** 11 de Agosto de 2025  
**Status:** ⚠️ CRÍTICO - API com dados hardcoded, necessita re-arquitetura  
**Versão do Sistema:** Simpix v4.3+

---

## 1. 🚨 AUDITORIA DO CÓDIGO ATUAL

### **Localização dos Endpoints de Simulação:**

**Arquivo:** `server/routes.ts`

#### **Endpoint 1: POST /api/simular** (Linha 3813)

```typescript
app.post('/api/simular', (req, res) => {
  const { valorSolicitado, prazoEmMeses, tabelaComercialId } = req.body;

  const taxaDeJurosMensal = obterTaxaJurosPorTabela(tabelaComercialId);
  const valorDaParcela = calcularParcela(valorSolicitado, prazoEmMeses, taxaDeJurosMensal);
  const cetAnual = taxaDeJurosMensal * 12 * 1.1; // ⚠️ CÁLCULO SIMPLIFICADO

  return res.json({ valorParcela: valorDaParcela, cet: parseFloat(cetAnual.toFixed(2)) });
});
```

#### **Endpoint 2: GET /api/simulacao** (Linha 3847)

```typescript
app.get('/api/simulacao', (req, res) => {
  const { valor, prazo, produto_id, incluir_tac, dataVencimento } = req.query;

  const { taxaDeJurosMensal, valorTac } = buscarTaxas(produto_id as string);
  const iof = calcularIOF(valorSolicitado);
  const tac = incluir_tac === 'true' ? valorTac : 0;

  // ... cálculos baseados em valores mock
});
```

### **🎯 SEÇÕES EXATAS COM VALORES FIXOS (HARDCODED):**

#### **Mock de Tabelas Comerciais** (Linha 3802)

```typescript
const tabelasComerciais: { [key: string]: number } = {
  'tabela-a': 5.0, // ⚠️ HARDCODED: 5% taxa de juros
  'tabela-b': 7.5, // ⚠️ HARDCODED: 7.5% taxa de juros
};
```

#### **Função Mock buscarTaxas()** (Linha 3832)

```typescript
const buscarTaxas = (produtoId: string) => {
  return {
    taxaDeJurosMensal: 5.0, // ⚠️ HARDCODED: 5% a.m.
    valorTac: 150.0, // ⚠️ HARDCODED: R$150 TAC
  };
};
```

#### **Função Mock calcularIOF()** (Linha 3837)

```typescript
const calcularIOF = (valor: number) => {
  return valor * 0.0038; // ⚠️ HARDCODED: 0.38% alíquota IOF
};
```

---

## 2. 📋 AUDITORIA DO SCHEMA DE DADOS E RELAÇÕES

### **Tabelas Mapeadas:**

#### **A. Tabela `parceiros`** (Linha 19-27)

```sql
parceiros {
  id: serial PRIMARY KEY,
  razaoSocial: text NOT NULL,
  cnpj: text NOT NULL UNIQUE,
  comissaoPadrao: decimal,               -- 🎯 TAXA CUSTOMIZADA
  tabelaComercialPadraoId: integer,      -- 🎯 REFERÊNCIA TABELA PADRÃO
  createdAt: timestamp,
  deletedAt: timestamp
}
```

#### **B. Tabela `produtos`** (Linha 283-299)

```sql
produtos {
  id: serial PRIMARY KEY,
  nomeProduto: text NOT NULL,
  tacValor: decimal(10,2) DEFAULT 0,            -- 🎯 VALOR TAC POR PRODUTO
  tacTipo: text DEFAULT 'fixo',                 -- 🎯 TIPO TAC (fixo/percentual)
  modalidadeJuros: text DEFAULT 'pre_fixado',   -- 🎯 PRÉ/PÓS FIXADO
  periodicidadeCapitalizacao: text DEFAULT 'mensal',
  anoBase: integer DEFAULT 365,
  tarifaTedPadrao: decimal(10,2) DEFAULT 10.00, -- 🎯 TARIFA TED
  taxaCreditoPadrao: decimal(10,2) DEFAULT 50.00, -- 🎯 TAXA CRÉDITO
  createdAt: timestamp,
  deletedAt: timestamp
}
```

#### **C. Tabela `tabelasComerciais`** (Linha 256-268)

```sql
tabelasComerciais {
  id: serial PRIMARY KEY,
  nomeTabela: text NOT NULL,
  taxaJuros: decimal(5,2) NOT NULL,        -- 🎯 TAXA DE JUROS PRINCIPAL
  taxaJurosAnual: decimal(5,2),            -- 🎯 TAXA ANUAL CALCULADA
  prazos: integer[] NOT NULL,              -- 🎯 PRAZOS PERMITIDOS
  parceiroId: integer REFERENCES parceiros(id),
  comissao: decimal(5,2) DEFAULT 0.00,     -- 🎯 COMISSÃO
  calculoEncargos: text,                   -- 🎯 FÓRMULA DE CÁLCULO
  cetFormula: text,                        -- 🎯 FÓRMULA CET
  createdAt: timestamp,
  deletedAt: timestamp
}
```

#### **D. Tabela de Junção `produto_tabela_comercial`** (Linha 271-280)

```sql
produto_tabela_comercial {
  id: serial PRIMARY KEY,
  produtoId: integer REFERENCES produtos(id),
  tabelaComercialId: integer REFERENCES tabelasComerciais(id),
  createdAt: timestamp
}
```

### **🔗 RELACIONAMENTOS IDENTIFICADOS:**

1. **Parceiro** `1:N` **Lojas** `1:N` **Usuários**
2. **Parceiro** `1:1` **Tabela Comercial Padrão** (via `tabelaComercialPadraoId`)
3. **Produtos** `N:N` **Tabelas Comerciais** (via `produto_tabela_comercial`)
4. **Propostas** `N:1` **Produto** e `N:1` **Tabela Comercial**

---

## 3. 🎯 AUDITORIA DAS REGRAS DE NEGÓCIO

### **Condições Especiais Identificadas:**

#### **A. Condições no Parceiro:**

- **Campo:** `comissaoPadrao` - Define comissão customizada por parceiro
- **Campo:** `tabelaComercialPadraoId` - Tabela comercial específica do parceiro
- **Regra:** Parceiro pode ter tabela comercial própria que sobrepõe configurações gerais

#### **B. Condições no Produto:**

- **Campo:** `tacValor` e `tacTipo` - TAC específico por produto
- **Campo:** `modalidadeJuros` - Pré-fixado vs Pós-fixado
- **Campo:** `taxaCreditoPadrao` - Taxa base por produto

#### **C. Hierarquia de Fallback Identificada:**

```
1. Tabela Específica do Produto-Parceiro (N:N)
     ↓ fallback
2. Tabela Padrão do Parceiro
     ↓ fallback
3. Configuração Geral do Produto
     ↓ fallback
4. Valores Default do Sistema
```

---

## 4. ⚠️ AUDITORIA DOS CÁLCULOS FINANCEIROS

### **Status da Implementação:**

#### **A. Cálculo CET (Custo Efetivo Total):**

- **Status:** ❌ **IMPLEMENTAÇÃO SIMPLIFICADA**
- **Código Atual:** `taxaDeJurosMensal * 12 * 1.1` (Linha 3826)
- **Problema:** Não considera IOF, TAC, carência, nem fórmula CET real
- **Campo Disponível:** `cetFormula` na tabela `tabelasComerciais` (🔥 NÃO UTILIZADO)

#### **B. Cálculo IOF:**

- **Status:** ❌ **VALOR HARDCODED**
- **Código Atual:** `valor * 0.0038` (0.38% fixo)
- **Problema:** Alíquota não reflete regras reais do IOF (progressivo por dias)

#### **C. Cálculo TAC:**

- **Status:** ❌ **VALOR MOCK FIXO**
- **Código Atual:** `R$ 150.00` fixo na função `buscarTaxas()`
- **Disponível no DB:** Campo `tacValor` na tabela `produtos` (🔥 NÃO UTILIZADO)

#### **D. Cálculo Tabela Price:**

- **Status:** ✅ **IMPLEMENTADO CORRETAMENTE**
- **Localização:** Função `calcularParcela()` (Linha 3787)
- **Fórmula:** PMT = PV × [i(1+i)^n] / [(1+i)^n - 1]

### **📋 STATUS FINAL:**

```
✅ Tabela Price: IMPLEMENTADA
❌ CET: LÓGICA DE CÁLCULO FINANCEIRO AUSENTE
❌ IOF: LÓGICA DE CÁLCULO FINANCEIRO AUSENTE
❌ TAC: LÓGICA DE CÁLCULO FINANCEIRO AUSENTE
```

---

## 🎯 RELATÓRIO FINAL - MAPA PARA IMPLEMENTAÇÃO

### **PROBLEMAS CRÍTICOS IDENTIFICADOS:**

1. **🚨 DESCONEXÃO TOTAL:** API não utiliza dados reais do banco
2. **🚨 VALORES MOCK:** Juros, CET, TAC e IOF são hardcoded
3. **🚨 REGRAS IGNORADAS:** Hierarquia Parceiro→Produto→Tabela não implementada
4. **🚨 CAMPOS INUTILIZADOS:** `tacValor`, `cetFormula`, `calculoEncargos` não são consultados

### **ARQUITETURA NECESSÁRIA:**

#### **Fase 1: Consulta Dinâmica**

```sql
-- Query que deveria ser implementada:
SELECT
  p.tacValor, p.tacTipo,
  tc.taxaJuros, tc.cetFormula, tc.calculoEncargos,
  pr.comissaoPadrao
FROM produtos p
JOIN produto_tabela_comercial ptc ON p.id = ptc.produtoId
JOIN tabelas_comerciais tc ON ptc.tabelaComercialId = tc.id
JOIN propostas prop ON prop.produtoId = p.id
JOIN lojas l ON prop.lojaId = l.id
JOIN parceiros pr ON l.parceiroId = pr.id
WHERE p.id = ? AND (tc.parceiroId = pr.id OR tc.parceiroId IS NULL)
ORDER BY tc.parceiroId DESC NULLS LAST -- Prioridade: específico > geral
```

#### **Fase 2: Engine de Cálculo Financeiro**

- Implementar cálculo CET real baseado em `cetFormula`
- Implementar IOF progressivo (tabela oficial)
- Usar valores de TAC do produto específico
- Aplicar regras de carência e capitalização

#### **Fase 3: Testes de Validação**

- Unit tests para cada cálculo financeiro
- Integration tests com dados reais do banco
- Simulações comparativas com planilhas de referência

---

**⚠️ CONCLUSÃO:** A API atual é uma versão de desenvolvimento com dados mock. Para produção, necessita **re-arquitetura completa** integrando com o schema real do banco de dados.

**🎯 PRÓXIMOS PASSOS:** Implementação da consulta dinâmica e engine de cálculo financeiro baseada nos campos já existentes no banco.
