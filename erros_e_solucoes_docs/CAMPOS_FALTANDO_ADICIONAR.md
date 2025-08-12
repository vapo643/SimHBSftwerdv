# 🚨 CAMPOS QUE FALTAM ADICIONAR NO SISTEMA

## 1️⃣ **NOVA PROPOSTA - FORMULÁRIO (CAMPOS DIGITÁVEIS)**

### 🔴 **CRÍTICOS - Adicionar URGENTE:**
```typescript
// Campos do RG Completos
clienteOrgaoExpedidor: text    // Ex: "SSP", "Detran", etc
clienteRgUf: text              // Ex: "SP", "RJ", etc  
clienteRgDataEmissao: text     // Data de emissão do RG

// Localização Detalhada
clienteLogradouro: text        // Rua/Avenida
clienteNumero: text            // Número do imóvel
clienteComplemento: text       // Apto, Bloco, etc
clienteBairro: text            // Bairro
clienteCidade: text            // Cidade
clienteUf: text                // Estado

// Nascimento
clienteLocalNascimento: text   // Cidade onde nasceu

// Tipo de Pessoa
tipoPessoa: 'PF' | 'PJ'       // Pessoa Física ou Jurídica

// Para PJ (aparecer se tipoPessoa = 'PJ')
clienteRazaoSocial: text       // Nome da empresa
clienteCnpj: text              // CNPJ da empresa
```

### 🟡 **IMPORTANTES - Adicionar para completar CCB:**
```typescript
// Dados Financeiros Detalhados
dataLiberacao: date            // Quando o dinheiro será liberado
valorLiquidoLiberado: decimal  // Valor após descontos
formaLiberacao: 'deposito' | 'ted' | 'pix'  // Como será liberado
pracaPagamento: text           // Cidade de pagamento
formaPagamento: 'boleto' | 'pix' | 'debito'  // Como cliente pagará
```

## 2️⃣ **PRODUTOS - CONFIGURAÇÃO (NÃO DIGITÁVEL)**

### 🔴 **Adicionar na tabela `produtos`:**
```typescript
// Configurações de Juros
modalidadeJuros: 'pre_fixado' | 'pos_fixado'     // Tipo de juros
periodicidadeCapitalizacao: 'mensal' | 'diaria'  // Quando capitaliza
anoBase: 360 | 365                               // Base de cálculo

// Tarifas padrão do produto
tarifaTedPadrao: decimal       // Tarifa TED padrão
taxaCreditoPadrao: decimal     // Taxa de análise de crédito
```

## 3️⃣ **TABELAS COMERCIAIS - CONFIGURAÇÃO (NÃO DIGITÁVEL)**

### 🟡 **Adicionar na tabela `tabelas_comerciais`:**
```typescript
// Taxa anual calculada
taxaJurosAnual: decimal        // Taxa anual (calcular da mensal)

// Configurações específicas
calculoEncargos: text          // Fórmula de cálculo
cetFormula: text               // Como calcular o CET
```

## 4️⃣ **CONFIGURAÇÃO DA EMPRESA (CRIAR NOVA TABELA)**

### 🔴 **Nova tabela `configuracao_empresa`:**
```typescript
export const configuracaoEmpresa = pgTable("configuracao_empresa", {
  id: serial("id").primaryKey(),
  
  // Dados da Simpix (Credor)
  razaoSocial: text("razao_social").notNull(),     // "SIMPIX LTDA"
  cnpj: text("cnpj").notNull(),                    // CNPJ da Simpix
  endereco: text("endereco").notNull(),            // Endereço completo
  cep: text("cep").notNull(),
  cidade: text("cidade").notNull(),
  uf: text("uf").notNull(),
  telefone: text("telefone"),
  email: text("email"),
  
  // Configurações de CCB
  pracaPagamentoPadrao: text("praca_pagamento_padrao"),
  anoBasePadrao: integer("ano_base_padrao").default(365),
  
  createdAt: timestamp("created_at").defaultNow()
});
```

## 📊 **RESUMO DO QUE FALTA:**

### **NO FORMULÁRIO DE NOVA PROPOSTA:**
| Categoria | Campos Faltando | Prioridade |
|-----------|-----------------|------------|
| **Documentos** | Órgão Expedidor RG, UF RG, Data Emissão RG | 🔴 CRÍTICO |
| **Endereço** | Logradouro, Número, Complemento, Bairro, Cidade, UF | 🔴 CRÍTICO |
| **Pessoal** | Local de Nascimento | 🟡 IMPORTANTE |
| **Empresa** | Tipo Pessoa, Razão Social, CNPJ | 🟡 IMPORTANTE |
| **Financeiro** | Data Liberação, Valor Líquido, Forma Liberação | 🟡 IMPORTANTE |

### **NOS PRODUTOS (NÃO DIGITÁVEL):**
| Campo | Descrição | Prioridade |
|-------|-----------|------------|
| modalidadeJuros | Pré ou Pós-fixado | 🔴 CRÍTICO |
| periodicidadeCapitalizacao | Mensal ou Diária | 🟡 IMPORTANTE |
| anoBase | 360 ou 365 dias | 🟡 IMPORTANTE |
| tarifaTedPadrao | Valor padrão TED | 🟢 OPCIONAL |

### **NAS TABELAS COMERCIAIS (NÃO DIGITÁVEL):**
| Campo | Descrição | Prioridade |
|-------|-----------|------------|
| taxaJurosAnual | Taxa anual calculada | 🟡 IMPORTANTE |
| calculoEncargos | Fórmula dos encargos | 🟢 OPCIONAL |

## 🎯 **AÇÃO IMEDIATA NECESSÁRIA:**

### **1. ATUALIZAR FORMULÁRIO DE NOVA PROPOSTA:**
- Adicionar seção "Documento de Identidade" com campos completos do RG
- Adicionar seção "Endereço Detalhado" com todos os campos
- Adicionar switch para "Tipo de Pessoa" (PF/PJ)
- Se PJ, mostrar campos de Razão Social e CNPJ

### **2. ATUALIZAR CADASTRO DE PRODUTOS:**
- Adicionar campo "Modalidade de Juros"
- Adicionar campo "Periodicidade de Capitalização"
- Adicionar campo "Ano Base"

### **3. CRIAR CADASTRO DE CONFIGURAÇÃO DA EMPRESA:**
- Tela administrativa para configurar dados da Simpix
- Esses dados serão usados automaticamente no CCB

## ✅ **CAMPOS QUE JÁ EXISTEM E ESTÃO OK:**
- ✅ Nome/CPF
- ✅ Valor/Prazo
- ✅ Finalidade
- ✅ Taxa de Juros (nas tabelas comerciais)
- ✅ IOF/TAC (calculados)
- ✅ Dados Bancários para pagamento
- ✅ Email/Telefone
- ✅ Data de Nascimento
- ✅ Renda
- ✅ Estado Civil
- ✅ Nacionalidade