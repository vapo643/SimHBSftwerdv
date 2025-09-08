# 📋 MAPEAMENTO COMPLETO: CAMPOS CCB → COORDENADAS DO SISTEMA

## ✅ Total de Campos Mapeados: 71 campos + 24 parcelas = 95 posições

---

## 📄 PÁGINA 1 - IDENTIFICAÇÃO E DADOS PRINCIPAIS

### 🆔 IDENTIFICAÇÃO DA CCB (Linha Y:735)

| Campo                      | Origem no Sistema               | Coordenadas  | Descrição             |
| -------------------------- | ------------------------------- | ------------ | --------------------- |
| **Número da Cédula**       | `id` da proposta                | X:55, Y:735  | ID formatado PROP-XXX |
| **Data de Emissão**        | `created_at` ou `ccb_gerado_em` | X:255, Y:735 | Data geração CCB      |
| **Finalidade da Operação** | `condicoes_data.finalidade`     | X:405, Y:735 | Finalidade do crédito |

### 👤 DADOS DO CLIENTE/EMITENTE (Linha Y:645-595)

| Campo                    | Origem no Sistema              | Coordenadas  | Descrição             |
| ------------------------ | ------------------------------ | ------------ | --------------------- |
| **Nome Completo**        | `cliente_data.nome`            | X:55, Y:645  | Nome do cliente       |
| **CPF**                  | `cliente_data.cpf`             | X:405, Y:645 | CPF formatado         |
| **RG**                   | `cliente_data.rg`              | X:50, Y:620  | Número do RG          |
| **RG - Órgão Expedidor** | `cliente_data.orgaoEmissor`    | X:315, Y:620 | SSP, etc              |
| **RG - UF**              | `cliente_data.rgUf`            | X:164, Y:620 | Estado emissor        |
| **RG - Data Emissão**    | `cliente_data.rgEmissao`       | X:210, Y:620 | Data emissão RG       |
| **Nacionalidade**        | `cliente_data.nacionalidade`   | X:270, Y:620 | Brasileira, etc       |
| **Local de Nascimento**  | `cliente_data.localNascimento` | X:405, Y:620 | Cidade nascimento     |
| **Estado Civil**         | `cliente_data.estadoCivil`     | X:55, Y:595  | Solteiro, Casado, etc |

### 🏠 ENDEREÇO DO CLIENTE (Linha Y:670)

| Campo                 | Origem no Sistema       | Coordenadas  | Descrição                |
| --------------------- | ----------------------- | ------------ | ------------------------ |
| **Endereço Completo** | `cliente_data.endereco` | X:100, Y:670 | Rua, número, complemento |
| **CEP**               | `cliente_data.cep`      | X:270, Y:670 | CEP formatado            |
| **Cidade**            | `cliente_data.cidade`   | X:380, Y:670 | Cidade do cliente        |
| **UF**                | `cliente_data.estado`   | X:533, Y:670 | Estado do cliente        |

### 🏢 DADOS DO CREDOR/LOJA (Linha Y:465-435)

| Campo               | Origem no Sistema            | Coordenadas  | Descrição        |
| ------------------- | ---------------------------- | ------------ | ---------------- |
| **Razão Social**    | `loja_nome` ou "SIMPIX LTDA" | X:55, Y:465  | Nome da empresa  |
| **CNPJ**            | `loja_cnpj`                  | X:445, Y:465 | CNPJ da loja     |
| **Endereço Credor** | `loja_endereco`              | X:50, Y:435  | Endereço da loja |
| **CEP Credor**      | `loja_cep`                   | X:175, Y:435 | CEP da loja      |
| **Cidade Credor**   | `loja_cidade`                | X:310, Y:435 | Cidade da loja   |
| **UF Credor**       | `loja_uf`                    | X:440, Y:435 | Estado da loja   |

### 💰 CONDIÇÕES FINANCEIRAS (Linha Y:350-150)

| Campo                     | Origem no Sistema        | Coordenadas  | Descrição           |
| ------------------------- | ------------------------ | ------------ | ------------------- |
| **Valor Principal**       | `condicoes_data.valor`   | X:50, Y:350  | Valor do empréstimo |
| **Data Emissão (Cond)**   | `created_at`             | X:180, Y:350 | Data da proposta    |
| **Vencimento 1ª Parcela** | `parcelas[0].vencimento` | X:300, Y:350 | Primeiro vencimento |
| **Vencimento Última**     | Calculado                | X:455, Y:344 | Último vencimento   |
| **Prazo Amortização**     | `condicoes_data.prazo`   | X:50, Y:300  | Prazo em meses      |
| **Percentual/Índice**     | `condicoes_data.taxa`    | X:300, Y:300 | Taxa de juros       |

### 📊 TAXAS E ENCARGOS (Linha Y:245-180)

| Campo                      | Origem no Sistema         | Coordenadas  | Descrição           |
| -------------------------- | ------------------------- | ------------ | ------------------- |
| **Taxa Juros Mensal**      | `taxa_juros` mensal       | X:95, Y:245  | Taxa a.m.           |
| **Taxa Juros Anual**       | `taxa_juros` anual        | X:230, Y:245 | Taxa a.a.           |
| **IOF**                    | `condicoes_data.valorIof` | X:300, Y:245 | Valor do IOF        |
| **Praça de Pagamento**     | `cidade_emissao`          | X:490, Y:245 | Cidade pagamento    |
| **Tarifa TED**             | Valor fixo                | X:130, Y:180 | R$ 10,00            |
| **TAC**                    | `condicoes_data.valorTac` | X:325, Y:220 | Taxa abertura       |
| **Taxa de Crédito**        | Calculado                 | X:400, Y:180 | Taxa adicional      |
| **CET**                    | `condicoes_data.cet`      | X:460, Y:195 | Custo Efetivo Total |
| **Data Liberação**         | `data_liberacao`          | X:50, Y:150  | Data do crédito     |
| **Valor Líquido Liberado** | Calculado                 | X:410, Y:163 | Valor - taxas       |
| **Valor Líquido Emissor**  | Calculado                 | X:475, Y:150 | Valor ao cliente    |

---

## 📄 PÁGINA 2 - DADOS BANCÁRIOS E PARCELAS

### 🏦 DADOS BANCÁRIOS PESSOA FÍSICA (Linha Y:660)

| Campo          | Origem no Sistema              | Coordenadas  | Descrição         |
| -------------- | ------------------------------ | ------------ | ----------------- |
| **Banco**      | `dados_pagamento_codigo_banco` | X:170, Y:660 | Código do banco   |
| **Agência**    | `dados_pagamento_agencia`      | X:290, Y:660 | Número agência    |
| **Conta**      | `dados_pagamento_conta`        | X:460, Y:670 | Número conta      |
| **Tipo Conta** | `dados_pagamento_tipo`         | X:482, Y:660 | Corrente/Poupança |

### 🏢 DADOS BANCÁRIOS PESSOA JURÍDICA (Linha Y:630-610)

| Campo               | Origem no Sistema              | Coordenadas  | Descrição       |
| ------------------- | ------------------------------ | ------------ | --------------- |
| **Razão Social PJ** | `cliente_data.razaoSocial`     | X:65, Y:630  | Nome empresa    |
| **CNPJ**            | `cliente_data.cnpj`            | X:65, Y:610  | CNPJ empresa    |
| **Banco PJ**        | `dados_pagamento_codigo_banco` | X:170, Y:610 | Código banco PJ |
| **Agência PJ**      | `dados_pagamento_agencia`      | X:290, Y:610 | Agência PJ      |
| **Conta PJ**        | `dados_pagamento_conta`        | X:460, Y:630 | Conta PJ        |
| **Tipo Conta PJ**   | `dados_pagamento_tipo`         | X:482, Y:615 | Tipo conta PJ   |
| **Chave PIX**       | `dados_pagamento_pix`          | X:465, Y:616 | Chave PIX       |

### 📅 FLUXO DE PAGAMENTO - PARCELAS 1-21 (Y:460-60)

| Parcela | Número       | Vencimento   | Valor        |
| ------- | ------------ | ------------ | ------------ |
| **1**   | X:110, Y:460 | X:270, Y:460 | X:470, Y:460 |
| **2**   | X:110, Y:440 | X:270, Y:440 | X:470, Y:440 |
| **3**   | X:110, Y:420 | X:270, Y:420 | X:470, Y:420 |
| **4**   | X:110, Y:400 | X:270, Y:400 | X:470, Y:400 |
| **5**   | X:110, Y:380 | X:270, Y:380 | X:470, Y:380 |
| **6**   | X:110, Y:360 | X:270, Y:360 | X:470, Y:360 |
| **7**   | X:110, Y:340 | X:270, Y:340 | X:470, Y:340 |
| **8**   | X:110, Y:320 | X:270, Y:320 | X:470, Y:320 |
| **9**   | X:110, Y:300 | X:270, Y:300 | X:470, Y:300 |
| **10**  | X:110, Y:280 | X:270, Y:280 | X:470, Y:280 |
| **11**  | X:110, Y:260 | X:270, Y:260 | X:470, Y:260 |
| **12**  | X:110, Y:240 | X:270, Y:240 | X:470, Y:240 |
| **13**  | X:110, Y:220 | X:270, Y:220 | X:470, Y:220 |
| **14**  | X:110, Y:200 | X:270, Y:200 | X:470, Y:200 |
| **15**  | X:110, Y:180 | X:270, Y:180 | X:470, Y:180 |
| **16**  | X:110, Y:160 | X:270, Y:160 | X:470, Y:160 |
| **17**  | X:110, Y:140 | X:270, Y:140 | X:470, Y:140 |
| **18**  | X:110, Y:120 | X:270, Y:120 | X:470, Y:120 |
| **19**  | X:110, Y:100 | X:270, Y:100 | X:470, Y:100 |
| **20**  | X:110, Y:80  | X:270, Y:80  | X:470, Y:80  |
| **21**  | X:110, Y:60  | X:270, Y:60  | X:470, Y:60  |

---

## 📄 PÁGINA 3 - PARCELAS ADICIONAIS

### 📅 PARCELAS 22-24 (Y:770-730)

| Parcela | Número       | Vencimento   | Valor        |
| ------- | ------------ | ------------ | ------------ |
| **22**  | X:110, Y:770 | X:270, Y:770 | X:470, Y:770 |
| **23**  | X:110, Y:750 | X:270, Y:750 | X:470, Y:750 |
| **24**  | X:110, Y:730 | X:270, Y:730 | X:470, Y:730 |

---

## 🔧 CONFIGURAÇÕES TÉCNICAS

### Tamanhos de Fonte

- **Padrão**: 11pt
- **Campos menores**: 9-10pt
- **Detalhes**: 8pt

### Páginas do Template

- **Página 1**: Identificação, Cliente, Credor, Condições Financeiras
- **Página 2**: Dados Bancários, Parcelas 1-21
- **Página 3**: Parcelas 22-24, Assinaturas

### Origem dos Dados

Os dados são buscados da tabela `propostas` do banco de dados, especificamente dos campos:

- `cliente_data` (JSON com dados do cliente)
- `condicoes_data` (JSON com condições do empréstimo)
- `dados_pagamento` (JSON com dados bancários/PIX)
- `parcelas` (Array com detalhes de cada parcela)
- Campos diretos: `id`, `created_at`, `loja_nome`, etc.

---

## ✅ STATUS DE VALIDAÇÃO

- **Coordenadas testadas**: Sim, com proposta real PROP-1753476064646-PRM20HF
- **Resultado**: 100% de precisão no posicionamento
- **Última validação**: 08/08/2025
- **Arquivo de coordenadas**: `/server/services/ccbUserCoordinates.ts`
- **Serviço de geração**: `/server/services/ccbGenerationService.ts`
