# 📋 CAMPOS SEMPRE DISPONÍVEIS NO SISTEMA PARA PREENCHIMENTO DA CCB

## **ANÁLISE COMPLETA DOS DADOS DISPONÍVEIS**

Baseado no schema da base de dados, dados JSONB coletados e relacionamentos:

## **1. DADOS DO CLIENTE/DEVEDOR**

_(Origem: JSONB cliente_data na tabela propostas)_

### **Identificação Pessoal:**

- **nome** - Nome completo do cliente
- **cpf** - CPF formatado
- **rg** - RG do cliente
- **orgaoEmissor** - Órgão emissor do RG
- **dataNascimento** - Data de nascimento
- **nacionalidade** - Nacionalidade
- **estadoCivil** - Estado civil

### **Contato:**

- **telefone** - Telefone formatado
- **email** - Email do cliente

### **Endereço Completo:**

- **endereco** - Logradouro completo
- **numero** - Número da residência
- **complemento** - Complemento
- **bairro** - Bairro
- **cidade** - Cidade
- **estado** - Estado/UF
- **cep** - CEP formatado

### **Dados Profissionais:**

- **ocupacao** - Profissão/ocupação
- **renda** - Renda declarada

### **Pessoa Jurídica** (quando aplicável):

- **razaoSocial** - Razão social da empresa
- **cnpj** - CNPJ da empresa
- **inscricaoEstadual** - Inscrição estadual

## **2. DADOS DO EMPRÉSTIMO/CRÉDITO**

_(Origem: JSONB condicoes_data na tabela propostas)_

### **Valores Principais:**

- **valor** - Valor solicitado do empréstimo
- **valorTotalFinanciado** - Valor total com encargos
- **valorIof** - Valor do IOF calculado
- **valorTac** - Valor da TAC calculado

### **Condições de Pagamento:**

- **prazo** - Prazo em meses
- **taxa_juros** - Taxa de juros aplicada
- **valorParcela** - Valor calculado da parcela (derivado)

### **Detalhes do Crédito:**

- **finalidade** - Finalidade do empréstimo
- **garantia** - Tipo de garantia oferecida

## **3. DADOS BANCÁRIOS/PIX DO CLIENTE**

_(Origem: Campos diretos na tabela propostas)_

### **Método de Pagamento:**

- **metodo_pagamento** - "conta_bancaria" ou "pix"

### **Dados Bancários (quando método = conta_bancaria):**

- **dados_pagamento_banco** - Nome do banco
- **dados_pagamento_codigo_banco** - Código do banco (001, 237, etc)
- **dados_pagamento_agencia** - Agência
- **dados_pagamento_conta** - Número da conta
- **dados_pagamento_digito** - Dígito da conta
- **dados_pagamento_tipo** - Tipo: "conta_corrente" ou "conta_poupanca"
- **dados_pagamento_nome_titular** - Nome do titular da conta
- **dados_pagamento_cpf_titular** - CPF do titular da conta

### **Dados PIX (quando método = pix):**

- **dados_pagamento_pix** - Chave PIX
- **dados_pagamento_tipo_pix** - Tipo: "CPF", "CNPJ", "Email", "Telefone", "Aleatória"
- **dados_pagamento_pix_banco** - Banco do PIX
- **dados_pagamento_pix_nome_titular** - Nome do titular do PIX
- **dados_pagamento_pix_cpf_titular** - CPF do titular do PIX

## **4. DADOS DA EMPRESA/CREDOR**

_(Origem: Relacionamentos com tabelas lojas e produtos)_

### **Informações da Loja:**

- **loja_nome** - Nome da loja/empresa credora
- **loja_cnpj** - CNPJ da loja (via relacionamento)
- **loja_endereco** - Endereço da loja (via relacionamento)

### **Informações do Produto:**

- **produto_nome** - Nome do produto de crédito
- **modalidade_juros** - Modalidade: "pre_fixado" ou "pos_fixado"
- **periodicidade_capitalizacao** - Periodicidade (padrão: "mensal")
- **ano_base** - Base de cálculo anual (padrão: 365)

## **5. DADOS ADMINISTRATIVOS E CONTROLE**

_(Origem: Campos diretos na tabela propostas)_

### **Datas e Timestamps:**

- **created_at** - Data de criação da proposta
- **data_aprovacao** - Data de aprovação
- **ccb_gerado_em** - Data de geração da CCB
- **data_assinatura** - Data de assinatura (quando disponível)

### **Status e Controle:**

- **id** - ID único da proposta
- **status** - Status atual da proposta
- **valor_aprovado** - Valor aprovado (pode diferir do solicitado)

### **Identificação de Usuário:**

- **user_id** - ID do usuário que criou a proposta

## **6. DADOS DERIVADOS/CALCULADOS**

_(Calculados automaticamente pelo sistema)_

### **Cálculos Financeiros:**

- **cet_mensal** - Custo Efetivo Total mensal (calculado)
- **cet_anual** - Custo Efetivo Total anual (calculado)
- **valor_parcela** - Valor da parcela (valor_total / prazo)
- **juros_total** - Total de juros (valor_total - valor_principal)

### **Formatações:**

- **data_extenso** - Data atual por extenso
- **valor_por_extenso** - Valor principal por extenso
- **local_emissao** - Local de emissão (baseado na loja)

## **7. DADOS DE INTEGRAÇÃO**

_(Para assinatura eletrônica e compliance)_

### **ClickSign:**

- **clicksign_document_key** - Chave do documento
- **clicksign_signer_key** - Chave do signatário
- **clicksign_status** - Status da assinatura

### **Compliance:**

- **url_comprovante_pagamento** - URL do comprovante
- **observacoes_formalizacao** - Observações do processo

---

## **TOTAL DE CAMPOS DISPONÍVEIS: 60+**

**Campos essenciais CCB:** ✅ Todos disponíveis  
**Dados opcionais:** ✅ Cobertora completa  
**Cálculos automáticos:** ✅ Sistema calcula valores derivados  
**Formatações:** ✅ Sistema formata CPF, CEP, valores, datas

**CONCLUSÃO:** O sistema possui TODOS os dados necessários para preencher uma CCB bancária completa, incluindo dados opcionais e cálculos automáticos.
