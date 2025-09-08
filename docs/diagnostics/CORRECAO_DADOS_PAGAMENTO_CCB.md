# Correção dos Dados de Pagamento na CCB

## 🐛 Problema Identificado

Os dados de pagamento do cliente não estavam sendo preenchidos na CCB (Cédula de Crédito Bancário), aparecendo sempre como "NÃO INFORMADO" mesmo quando preenchidos no formulário.

## 📊 Diagnóstico

1. **No banco de dados**: Campos `dados_pagamento_*` estavam todos NULL
2. **No JSON cliente_data**: Não havia campos de pagamento (banco, agência, conta, pix)
3. **No frontend**: Formulário coleta corretamente os dados em `ClientDataStep.tsx`
4. **No backend**: Mapeamento incorreto na rota de criação de propostas

## ✅ Correção Implementada

### Arquivo: `server/routes.ts`

#### 1. Adicionado mapeamento completo dos dados de pagamento

```javascript
// Dados de pagamento (separados para melhor controle)
metodo_pagamento: dataWithId.metodoPagamento, // 'conta_bancaria' ou 'pix'

// Dados bancários (quando conta_bancaria)
dados_pagamento_banco: dataWithId.dadosPagamentoBanco,
dados_pagamento_agencia: dataWithId.dadosPagamentoAgencia,
dados_pagamento_conta: dataWithId.dadosPagamentoConta,
dados_pagamento_digito: dataWithId.dadosPagamentoDigito,
dados_pagamento_codigo_banco: dataWithId.dadosPagamentoBanco,
dados_pagamento_tipo: "corrente",
dados_pagamento_nome_titular: dataWithId.dadosPagamentoNomeTitular || dataWithId.clienteNome,
dados_pagamento_cpf_titular: dataWithId.dadosPagamentoCpfTitular || dataWithId.clienteCpf,

// Dados PIX (quando pix)
dados_pagamento_pix: dataWithId.dadosPagamentoPix,
dados_pagamento_tipo_pix: dataWithId.dadosPagamentoTipoPix,
dados_pagamento_pix_banco: dataWithId.dadosPagamentoPixBanco,
dados_pagamento_pix_nome_titular: dataWithId.dadosPagamentoPixNomeTitular,
dados_pagamento_pix_cpf_titular: dataWithId.dadosPagamentoPixCpfTitular,
```

#### 2. Adicionado dados de pagamento no JSON cliente_data como fallback

```javascript
clienteData: {
  // ... outros campos ...
  // DADOS DE PAGAMENTO NO JSON PARA FALLBACK
  metodoPagamento: dataWithId.metodoPagamento,
  banco: dataWithId.dadosPagamentoBanco,
  agencia: dataWithId.dadosPagamentoAgencia,
  conta: dataWithId.dadosPagamentoConta,
  digito: dataWithId.dadosPagamentoDigito,
  chavePix: dataWithId.dadosPagamentoPix,
  tipoPix: dataWithId.dadosPagamentoTipoPix,
  pixBanco: dataWithId.dadosPagamentoPixBanco,
  pixNomeTitular: dataWithId.dadosPagamentoPixNomeTitular,
  pixCpfTitular: dataWithId.dadosPagamentoPixCpfTitular,
}
```

#### 3. Adicionado logs de debug para monitoramento

```javascript
console.log("💳 [NOVA PROPOSTA] Dados de pagamento recebidos do frontend:", {...});
console.log("💳 [NOVA PROPOSTA] Dados de pagamento que serão salvos no banco:", {...});
```

## 🔄 Fluxo de Dados Corrigido

1. **Frontend** (`ClientDataStep.tsx`): Coleta dados de pagamento
2. **Nova Proposta** (`nova.tsx`): Envia dados estruturados para API
3. **Backend** (`routes.ts`): Mapeia corretamente todos os campos
4. **Banco de Dados**: Salva em campos específicos + JSON fallback
5. **CCB Generation** (`ccbGenerationService.ts`): Busca dados e preenche PDF

## 📋 Campos de Pagamento Suportados

### Conta Bancária

- `dados_pagamento_banco`: Código do banco
- `dados_pagamento_agencia`: Número da agência
- `dados_pagamento_conta`: Número da conta
- `dados_pagamento_digito`: Dígito verificador
- `dados_pagamento_nome_titular`: Nome do titular
- `dados_pagamento_cpf_titular`: CPF do titular

### PIX

- `dados_pagamento_pix`: Chave PIX
- `dados_pagamento_tipo_pix`: Tipo da chave (cpf/cnpj/email/telefone/aleatoria)
- `dados_pagamento_pix_banco`: Banco do PIX
- `dados_pagamento_pix_nome_titular`: Nome do titular do PIX
- `dados_pagamento_pix_cpf_titular`: CPF/CNPJ do titular do PIX

## 🧪 Como Testar

1. Criar nova proposta preenchendo dados de pagamento
2. Verificar logs no console do servidor para confirmar dados recebidos
3. Gerar CCB e verificar se dados de pagamento aparecem corretamente
4. Testar tanto com conta bancária quanto com PIX

## 📝 Observações

- Dados salvos em dois locais: campos específicos + JSON para redundância
- Fallback automático se campos diretos estiverem vazios
- Compatibilidade mantida com propostas antigas
- Logs de debug ajudam no diagnóstico de problemas futuros
