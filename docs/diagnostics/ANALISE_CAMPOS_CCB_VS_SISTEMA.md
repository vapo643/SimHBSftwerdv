# 📊 ANÁLISE COMPLETA: Campos CCB vs Sistema de Propostas

## 🔴 CAMPOS FALTANDO NO SISTEMA

### 1. **DADOS PESSOAIS DO CLIENTE - FALTAM NO FORMULÁRIO:**

| Campo CCB                | Status no Sistema        | AÇÃO NECESSÁRIA                                     |
| ------------------------ | ------------------------ | --------------------------------------------------- |
| **RG - Órgão Expedidor** | ❌ NÃO EXISTE            | Adicionar `clienteOrgaoExpedidor`                   |
| **RG - UF Emissão**      | ❌ NÃO EXISTE            | Adicionar `clienteRgUf`                             |
| **RG - Data Emissão**    | ❌ NÃO EXISTE            | Adicionar `clienteRgDataEmissao`                    |
| **Local de Nascimento**  | ❌ NÃO EXISTE            | Adicionar `clienteLocalNascimento`                  |
| **Cidade**               | ❌ NÃO EXISTE            | Adicionar `clienteCidade`                           |
| **UF**                   | ❌ NÃO EXISTE            | Adicionar `clienteUf`                               |
| **Endereço Completo**    | ⚠️ EXISTE mas incompleto | Separar em campos: rua, número, complemento, bairro |

### 2. **DADOS FINANCEIROS - FALTAM NO SISTEMA:**

| Campo CCB                       | Status no Sistema      | AÇÃO NECESSÁRIA              |
| ------------------------------- | ---------------------- | ---------------------------- |
| **Prazo de Amortização**        | ✅ Existe como `prazo` | OK                           |
| **Juros Modalidade**            | ❌ NÃO EXISTE          | Adicionar (Pré/Pós-fixado)   |
| **Periodicidade Capitalização** | ❌ NÃO EXISTE          | Adicionar (Mensal/Diária)    |
| **Taxa Juros Efetiva Mensal**   | ⚠️ Existe `taxaJuros`  | Especificar se é mensal      |
| **Taxa Juros Efetiva Anual**    | ❌ NÃO EXISTE          | Calcular ou adicionar        |
| **Praça de Pagamento**          | ❌ NÃO EXISTE          | Adicionar campo              |
| **Formas de Pagamento**         | ❌ NÃO EXISTE          | Adicionar (Boleto/PIX/TED)   |
| **Ano Base**                    | ❌ NÃO EXISTE          | Adicionar (360/365 dias)     |
| **Cálculo dos Encargos**        | ❌ NÃO EXISTE          | Adicionar fórmula            |
| **Tarifa de TED**               | ❌ NÃO EXISTE          | Adicionar campo              |
| **Taxa de Crédito**             | ❌ NÃO EXISTE          | Adicionar campo              |
| **Data Liberação Recurso**      | ❌ NÃO EXISTE          | Adicionar `dataLiberacao`    |
| **Valor Líquido Liberado**      | ❌ NÃO EXISTE          | Calcular ou adicionar        |
| **Forma de Liberação**          | ❌ NÃO EXISTE          | Adicionar (Depósito/TED/PIX) |

### 3. **DADOS DO CREDOR (SIMPIX) - FALTAM CONFIGURAÇÃO:**

| Campo CCB               | Status no Sistema | AÇÃO NECESSÁRIA                     |
| ----------------------- | ----------------- | ----------------------------------- |
| **Razão Social Credor** | ❌ Hardcoded      | Criar tabela `configuracao_empresa` |
| **CNPJ Credor**         | ❌ Hardcoded      | Adicionar em configuração           |
| **Endereço Credor**     | ❌ Hardcoded      | Adicionar em configuração           |
| **CEP Credor**          | ❌ Hardcoded      | Adicionar em configuração           |
| **Cidade Credor**       | ❌ Hardcoded      | Adicionar em configuração           |
| **UF Credor**           | ❌ Hardcoded      | Adicionar em configuração           |

### 4. **DADOS PARA EMPRESA (PJ):**

| Campo CCB                 | Status no Sistema | AÇÃO NECESSÁRIA                |
| ------------------------- | ----------------- | ------------------------------ |
| **Razão Social Emitente** | ❌ NÃO EXISTE     | Adicionar `clienteRazaoSocial` |
| **CNPJ Emitente**         | ❌ NÃO EXISTE     | Adicionar `clienteCnpj`        |
| **Tipo de Pessoa**        | ❌ NÃO EXISTE     | Adicionar `tipoPessoa` (PF/PJ) |

## ✅ CAMPOS QUE JÁ EXISTEM NO SISTEMA

### **NA TABELA `propostas`:**

| Campo CCB         | Campo no Sistema                    | Status        |
| ----------------- | ----------------------------------- | ------------- |
| Nome/Razão Social | `clienteNome`                       | ✅ OK         |
| CPF/CNPJ          | `clienteCpf`                        | ✅ OK         |
| RG                | `clienteRg`                         | ✅ OK         |
| Endereço          | `clienteEndereco`                   | ⚠️ Incompleto |
| CEP               | `clienteCep`                        | ✅ OK         |
| Nacionalidade     | `clienteNacionalidade`              | ✅ OK         |
| Estado Civil      | `clienteEstadoCivil`                | ✅ OK         |
| Valor Principal   | `valor`                             | ✅ OK         |
| Prazo             | `prazo`                             | ✅ OK         |
| Finalidade        | `finalidade`                        | ✅ OK         |
| IOF               | `valorIof`                          | ✅ OK         |
| TAC               | `valorTac`                          | ✅ OK         |
| Taxa de Juros     | `taxaJuros`                         | ✅ OK         |
| CET               | Calculado                           | ✅ OK         |
| Dados Bancários   | `dadosPagamentoBanco/Agencia/Conta` | ✅ OK         |
| Tipo de Conta     | `dadosPagamentoTipo`                | ✅ OK         |

### **NA TABELA `produtos`:**

| Campo CCB    | Campo no Sistema | Status |
| ------------ | ---------------- | ------ |
| TAC          | `tacValor`       | ✅ OK  |
| Tipo TAC     | `tacTipo`        | ✅ OK  |
| Nome Produto | `nomeProduto`    | ✅ OK  |

### **NA TABELA `tabelasComerciais`:**

| Campo CCB     | Campo no Sistema | Status |
| ------------- | ---------------- | ------ |
| Taxa de Juros | `taxaJuros`      | ✅ OK  |
| Prazos        | `prazos`         | ✅ OK  |
| Comissão      | `comissao`       | ✅ OK  |

## 🔧 RESUMO DAS AÇÕES NECESSÁRIAS

### **1. ADICIONAR CAMPOS NA TABELA `propostas`:**

```sql
-- Campos do RG completos
ALTER TABLE propostas ADD COLUMN cliente_orgao_expedidor TEXT;
ALTER TABLE propostas ADD COLUMN cliente_rg_uf TEXT;
ALTER TABLE propostas ADD COLUMN cliente_rg_data_emissao TEXT;

-- Campos de endereço detalhado
ALTER TABLE propostas ADD COLUMN cliente_logradouro TEXT;
ALTER TABLE propostas ADD COLUMN cliente_numero TEXT;
ALTER TABLE propostas ADD COLUMN cliente_complemento TEXT;
ALTER TABLE propostas ADD COLUMN cliente_bairro TEXT;
ALTER TABLE propostas ADD COLUMN cliente_cidade TEXT;
ALTER TABLE propostas ADD COLUMN cliente_uf TEXT;

-- Campos pessoais adicionais
ALTER TABLE propostas ADD COLUMN cliente_local_nascimento TEXT;

-- Campos financeiros
ALTER TABLE propostas ADD COLUMN juros_modalidade TEXT; -- 'pre_fixado', 'pos_fixado'
ALTER TABLE propostas ADD COLUMN periodicidade_capitalizacao TEXT; -- 'mensal', 'diaria'
ALTER TABLE propostas ADD COLUMN taxa_juros_anual DECIMAL(5,2);
ALTER TABLE propostas ADD COLUMN praca_pagamento TEXT;
ALTER TABLE propostas ADD COLUMN forma_pagamento TEXT; -- 'boleto', 'pix', 'ted'
ALTER TABLE propostas ADD COLUMN ano_base INTEGER; -- 360 ou 365
ALTER TABLE propostas ADD COLUMN tarifa_ted DECIMAL(10,2);
ALTER TABLE propostas ADD COLUMN taxa_credito DECIMAL(10,2);
ALTER TABLE propostas ADD COLUMN data_liberacao TIMESTAMP;
ALTER TABLE propostas ADD COLUMN valor_liquido_liberado DECIMAL(15,2);
ALTER TABLE propostas ADD COLUMN forma_liberacao TEXT;

-- Campos para PJ
ALTER TABLE propostas ADD COLUMN tipo_pessoa TEXT DEFAULT 'PF'; -- 'PF' ou 'PJ'
ALTER TABLE propostas ADD COLUMN cliente_razao_social TEXT;
ALTER TABLE propostas ADD COLUMN cliente_cnpj TEXT;
```

### **2. CRIAR TABELA DE CONFIGURAÇÃO DA EMPRESA:**

```sql
CREATE TABLE configuracao_empresa (
  id SERIAL PRIMARY KEY,
  razao_social TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  endereco TEXT NOT NULL,
  cep TEXT NOT NULL,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **3. ADICIONAR CAMPOS NA TABELA `produtos`:**

```sql
ALTER TABLE produtos ADD COLUMN modalidade_juros TEXT DEFAULT 'pre_fixado';
ALTER TABLE produtos ADD COLUMN periodicidade_capitalizacao TEXT DEFAULT 'mensal';
ALTER TABLE produtos ADD COLUMN ano_base INTEGER DEFAULT 365;
ALTER TABLE produtos ADD COLUMN tarifa_ted_padrao DECIMAL(10,2) DEFAULT 10.00;
```

### **4. ADICIONAR CAMPOS NA TABELA `inter_collections`:**

```sql
ALTER TABLE inter_collections ADD COLUMN vencimento_primeira_parcela DATE;
ALTER TABLE inter_collections ADD COLUMN vencimento_ultima_parcela DATE;
ALTER TABLE inter_collections ADD COLUMN forma_pagamento TEXT;
```

## 📋 CAMPOS ORGANIZADOS POR PRIORIDADE

### **🔴 CRÍTICOS (Necessários para CCB):**

1. Órgão Expedidor do RG
2. UF do RG
3. Data Emissão do RG
4. Cidade/UF do cliente
5. Modalidade de Juros
6. Taxa Juros Anual
7. Data de Liberação
8. Valor Líquido Liberado

### **🟡 IMPORTANTES (Melhoram o CCB):**

1. Local de Nascimento
2. Endereço detalhado (rua, número, bairro)
3. Periodicidade de Capitalização
4. Praça de Pagamento
5. Forma de Pagamento
6. Tarifa TED
7. Configuração da Empresa Credora

### **🟢 OPCIONAIS (Nice to have):**

1. Ano Base
2. Taxa de Crédito
3. Forma de Liberação
4. Campos PJ (Razão Social, CNPJ)

## 🎯 RESUMO FINAL

### **Total de Campos no CCB:** 57

### **Campos que EXISTEM no sistema:** 25 (44%)

### **Campos que FALTAM:** 32 (56%)

### **Distribuição:**

- ✅ **Prontos:** 25 campos
- ⚠️ **Parciais:** 3 campos (precisam melhorias)
- ❌ **Faltando:** 29 campos

### **Por Categoria:**

- **Dados Pessoais:** Faltam 7 campos
- **Dados Financeiros:** Faltam 14 campos
- **Dados do Credor:** Faltam 6 campos
- **Dados PJ:** Faltam 3 campos
- **Dados Bancários:** OK ✅
