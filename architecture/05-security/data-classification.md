# 🔐 Classificação de Dados e Mapeamento PII

**Versão:** 1.0  
**Data:** 21/08/2025  
**Autor:** GEM 02 (Dev Specialist)  
**Status:** Draft - Aguardando Ratificação  
**Compliance:** LGPD / GDPR Ready

---

## 1. Definição dos Níveis de Sensibilidade

### **Nível 3 - Confidencial/Sensível** 🔴

**Definição:** Dados que, se expostos, podem causar dano significativo ao indivíduo ou ao negócio  
**Exemplos:** CPF, dados bancários, senhas, PII completo, dados financeiros pessoais  
**Proteção Requerida:**

- Criptografia em repouso e em trânsito (AES-256)
- Mascaramento em logs e interfaces
- Acesso restrito com auditoria completa
- Conformidade com LGPD/GDPR

### **Nível 2 - Interno/Restrito** 🟡

**Definição:** Dados de negócio que não são públicos, mas cuja exposição não causaria dano direto  
**Exemplos:** IDs internos, status de processos, metadados operacionais  
**Proteção Requerida:**

- Acesso controlado por RBAC
- Logs de acesso
- Proteção contra exposição pública

### **Nível 1 - Público** 🟢

**Definição:** Dados que podem ser expostos sem risco  
**Exemplos:** Nomes de produtos genéricos, configurações públicas  
**Proteção Requerida:**

- Controle de integridade
- Proteção contra modificação não autorizada

---

## 2. Mapeamento Completo de Tabelas e Colunas

### **2.1 Tabela: `propostas` (Proposta de Crédito)**

**Criticidade:** ⚠️ **MÁXIMA** - Contém dados financeiros e PII completos

| Nome da Coluna                     | Tipo de Dado       | Nível       | Observações                            |
| ---------------------------------- | ------------------ | ----------- | -------------------------------------- |
| `id`                               | Identificador      | Nível 2     | UUID interno                           |
| `numeroProposta`                   | Identificador      | Nível 2     | Número sequencial                      |
| `lojaId`                           | Referência         | Nível 2     | Multi-tenant key                       |
| **`clienteNome`**                  | **PII**            | **Nível 3** | **Nome completo do cliente**           |
| **`clienteCpf`**                   | **PII/Financeiro** | **Nível 3** | **CPF - Identificador único nacional** |
| **`clienteEmail`**                 | **PII**            | **Nível 3** | **Email pessoal**                      |
| **`clienteTelefone`**              | **PII**            | **Nível 3** | **Telefone pessoal**                   |
| **`clienteDataNascimento`**        | **PII**            | **Nível 3** | **Data de nascimento**                 |
| **`clienteRenda`**                 | **Financeiro**     | **Nível 3** | **Renda mensal declarada**             |
| **`clienteRg`**                    | **PII**            | **Nível 3** | **RG - Documento de identidade**       |
| `clienteOrgaoEmissor`              | PII                | Nível 2     | Órgão emissor do RG                    |
| `clienteRgUf`                      | PII                | Nível 2     | UF do RG                               |
| **`clienteRgDataEmissao`**         | **PII**            | **Nível 3** | **Data de emissão RG**                 |
| `clienteEstadoCivil`               | PII                | Nível 2     | Estado civil                           |
| `clienteNacionalidade`             | PII                | Nível 2     | Nacionalidade                          |
| `clienteLocalNascimento`           | PII                | Nível 2     | Local de nascimento                    |
| **`clienteCep`**                   | **PII**            | **Nível 3** | **CEP residencial**                    |
| **`clienteEndereco`**              | **PII**            | **Nível 3** | **Endereço completo**                  |
| **`clienteLogradouro`**            | **PII**            | **Nível 3** | **Logradouro residencial**             |
| **`clienteNumero`**                | **PII**            | **Nível 3** | **Número residencial**                 |
| `clienteComplemento`               | PII                | Nível 2     | Complemento do endereço                |
| **`clienteBairro`**                | **PII**            | **Nível 3** | **Bairro residencial**                 |
| **`clienteCidade`**                | **PII**            | **Nível 3** | **Cidade residencial**                 |
| `clienteUf`                        | PII                | Nível 2     | UF residencial                         |
| `clienteOcupacao`                  | PII                | Nível 2     | Ocupação profissional                  |
| **`clienteCnpj`**                  | **PII/Financeiro** | **Nível 3** | **CNPJ (Pessoa Jurídica)**             |
| `clienteRazaoSocial`               | PII                | Nível 2     | Razão social (PJ)                      |
| **`valor`**                        | **Financeiro**     | **Nível 3** | **Valor do empréstimo**                |
| **`valorTac`**                     | **Financeiro**     | **Nível 3** | **Taxa de abertura**                   |
| **`valorIof`**                     | **Financeiro**     | **Nível 3** | **IOF calculado**                      |
| **`valorTotalFinanciado`**         | **Financeiro**     | **Nível 3** | **Total financiado**                   |
| **`valorLiquidoLiberado`**         | **Financeiro**     | **Nível 3** | **Valor líquido**                      |
| **`valorAprovado`**                | **Financeiro**     | **Nível 3** | **Valor aprovado**                     |
| **`taxaJuros`**                    | **Financeiro**     | **Nível 3** | **Taxa de juros**                      |
| **`dadosPagamentoBanco`**          | **Financeiro**     | **Nível 3** | **Banco para depósito**                |
| **`dadosPagamentoAgencia`**        | **Financeiro**     | **Nível 3** | **Agência bancária**                   |
| **`dadosPagamentoConta`**          | **Financeiro**     | **Nível 3** | **Conta bancária**                     |
| **`dadosPagamentoDigito`**         | **Financeiro**     | **Nível 3** | **Dígito da conta**                    |
| **`dadosPagamentoNomeTitular`**    | **PII/Financeiro** | **Nível 3** | **Nome titular conta**                 |
| **`dadosPagamentoCpfTitular`**     | **PII/Financeiro** | **Nível 3** | **CPF titular conta**                  |
| **`dadosPagamentoPix`**            | **Financeiro**     | **Nível 3** | **Chave PIX**                          |
| **`dadosPagamentoPixNomeTitular`** | **PII/Financeiro** | **Nível 3** | **Nome titular PIX**                   |
| **`dadosPagamentoPixCpfTitular`**  | **PII/Financeiro** | **Nível 3** | **CPF titular PIX**                    |
| **`clienteEmpresaNome`**           | **PII**            | **Nível 3** | **Empresa empregadora**                |
| **`clienteEmpresaCnpj`**           | **PII**            | **Nível 3** | **CNPJ empregador**                    |
| `clienteCargoFuncao`               | PII                | Nível 2     | Cargo/função                           |
| `clienteTempoEmprego`              | PII                | Nível 2     | Tempo de emprego                       |
| **`clienteDividasExistentes`**     | **Financeiro**     | **Nível 3** | **Dívidas existentes**                 |
| **`clienteComprometimentoRenda`**  | **Financeiro**     | **Nível 3** | **% comprometimento**                  |
| **`clienteScoreSerasa`**           | **Financeiro**     | **Nível 3** | **Score de crédito**                   |
| **`clienteRestricoesCpf`**         | **Financeiro**     | **Nível 3** | **Restrições no CPF**                  |
| `ccbDocumentoUrl`                  | Documento          | Nível 2     | URL do CCB                             |
| `clicksignSignUrl`                 | Documento          | Nível 2     | URL para assinatura                    |
| `urlComprovantePagamento`          | Documento          | Nível 2     | URL do comprovante                     |
| `status`                           | Operacional        | Nível 2     | Status da proposta                     |
| `observacoes`                      | Operacional        | Nível 2     | Observações gerais                     |
| `createdAt`                        | Auditoria          | Nível 1     | Data de criação                        |
| `deletedAt`                        | Auditoria          | Nível 2     | Soft delete timestamp                  |

### **2.2 Tabela: `profiles` (Perfis de Usuário - Supabase Auth)**

**Criticidade:** Alta - Dados de identificação de usuários

| Nome da Coluna | Tipo de Dado    | Nível       | Observações         |
| -------------- | --------------- | ----------- | ------------------- |
| `id`           | Identificador   | Nível 2     | UUID do Supabase    |
| **`fullName`** | **PII**         | **Nível 3** | **Nome completo**   |
| `role`         | Controle Acesso | Nível 2     | Perfil de acesso    |
| `lojaId`       | Referência      | Nível 2     | Loja associada      |
| `createdAt`    | Auditoria       | Nível 1     | Data de criação     |
| `updatedAt`    | Auditoria       | Nível 1     | Data de atualização |
| `deletedAt`    | Auditoria       | Nível 2     | Soft delete         |

### **2.3 Tabela: `users` (Usuários Legado)**

**Criticidade:** Alta - Contém senhas (mesmo que hash)

| Nome da Coluna | Tipo de Dado    | Nível       | Observações         |
| -------------- | --------------- | ----------- | ------------------- |
| `id`           | Identificador   | Nível 2     | ID interno          |
| **`email`**    | **PII**         | **Nível 3** | **Email único**     |
| **`name`**     | **PII**         | **Nível 3** | **Nome do usuário** |
| **`password`** | **Segurança**   | **Nível 3** | **Senha (hash)**    |
| `role`         | Controle Acesso | Nível 2     | Perfil de acesso    |
| `createdAt`    | Auditoria       | Nível 1     | Data de criação     |

### **2.4 Tabela: `userSessions` (Sessões Ativas)**

**Criticidade:** Alta - Dados de sessão e localização

| Nome da Coluna   | Tipo de Dado        | Nível       | Observações         |
| ---------------- | ------------------- | ----------- | ------------------- |
| `id`             | Identificador       | Nível 2     | Session ID          |
| `userId`         | Referência          | Nível 2     | UUID do usuário     |
| **`token`**      | **Segurança**       | **Nível 3** | **Token JWT**       |
| **`ipAddress`**  | **PII/Localização** | **Nível 3** | **IP do usuário**   |
| `userAgent`      | Técnico             | Nível 2     | Browser/dispositivo |
| `device`         | Técnico             | Nível 2     | Tipo de dispositivo |
| `createdAt`      | Auditoria           | Nível 1     | Início da sessão    |
| `lastActivityAt` | Auditoria           | Nível 2     | Última atividade    |
| `expiresAt`      | Segurança           | Nível 2     | Expiração           |
| `isActive`       | Operacional         | Nível 2     | Status da sessão    |

### **2.5 Tabela: `parceiros` (Empresas Parceiras)**

**Criticidade:** Média - Dados empresariais

| Nome da Coluna            | Tipo de Dado    | Nível       | Observações      |
| ------------------------- | --------------- | ----------- | ---------------- |
| `id`                      | Identificador   | Nível 2     | ID interno       |
| `razaoSocial`             | Empresarial     | Nível 2     | Razão social     |
| **`cnpj`**                | **Empresarial** | **Nível 3** | **CNPJ único**   |
| `comissaoPadrao`          | Financeiro      | Nível 2     | Taxa de comissão |
| `tabelaComercialPadraoId` | Referência      | Nível 2     | Tabela padrão    |
| `createdAt`               | Auditoria       | Nível 1     | Data de criação  |
| `deletedAt`               | Auditoria       | Nível 2     | Soft delete      |

### **2.6 Tabela: `referenciaPessoal` (Referências Pessoais)**

**Criticidade:** Alta - PII de terceiros

| Nome da Coluna     | Tipo de Dado  | Nível       | Observações                |
| ------------------ | ------------- | ----------- | -------------------------- |
| `id`               | Identificador | Nível 2     | ID interno                 |
| `propostaId`       | Referência    | Nível 2     | Proposta relacionada       |
| **`nomeCompleto`** | **PII**       | **Nível 3** | **Nome da referência**     |
| `grauParentesco`   | PII           | Nível 2     | Relação com cliente        |
| **`telefone`**     | **PII**       | **Nível 3** | **Telefone da referência** |
| `createdAt`        | Auditoria     | Nível 1     | Data de criação            |

### **2.7 Tabela: `referenciasProfissionais` (Referências Profissionais)**

**Criticidade:** Alta - PII profissional de terceiros

| Nome da Coluna        | Tipo de Dado  | Nível       | Observações             |
| --------------------- | ------------- | ----------- | ----------------------- |
| `id`                  | Identificador | Nível 2     | ID interno              |
| `propostaId`          | Referência    | Nível 2     | Proposta relacionada    |
| **`nomeCompleto`**    | **PII**       | **Nível 3** | **Nome da referência**  |
| `cargoFuncao`         | PII           | Nível 2     | Cargo da referência     |
| `empresaNome`         | Empresarial   | Nível 2     | Empresa da referência   |
| **`empresaTelefone`** | **PII**       | **Nível 3** | **Telefone empresa**    |
| `tempoConhecimento`   | PII           | Nível 2     | Tempo de relacionamento |
| `tipoRelacionamento`  | PII           | Nível 2     | Tipo de relação         |
| `createdAt`           | Auditoria     | Nível 1     | Data de criação         |

### **2.8 Tabela: `interCollections` (Cobranças Banco Inter)**

**Criticidade:** Alta - Dados de pagamento

| Nome da Coluna           | Tipo de Dado   | Nível       | Observações          |
| ------------------------ | -------------- | ----------- | -------------------- |
| `id`                     | Identificador  | Nível 2     | ID interno           |
| `propostaId`             | Referência     | Nível 2     | Proposta relacionada |
| `codigoSolicitacao`      | Financeiro     | Nível 2     | ID do Inter          |
| `seuNumero`              | Financeiro     | Nível 2     | Nossa referência     |
| **`valorNominal`**       | **Financeiro** | **Nível 3** | **Valor do boleto**  |
| `dataVencimento`         | Financeiro     | Nível 2     | Vencimento           |
| `situacao`               | Operacional    | Nível 2     | Status no Inter      |
| `nossoNumero`            | Financeiro     | Nível 2     | Referência bancária  |
| **`codigoBarras`**       | **Financeiro** | **Nível 3** | **Código de barras** |
| **`linhaDigitavel`**     | **Financeiro** | **Nível 3** | **Linha digitável**  |
| **`pixTxid`**            | **Financeiro** | **Nível 3** | **ID transação PIX** |
| **`pixCopiaECola`**      | **Financeiro** | **Nível 3** | **Código PIX**       |
| **`valorTotalRecebido`** | **Financeiro** | **Nível 3** | **Valor recebido**   |
| `origemRecebimento`      | Financeiro     | Nível 2     | BOLETO ou PIX        |
| `numeroParcela`          | Financeiro     | Nível 2     | Número da parcela    |
| `totalParcelas`          | Financeiro     | Nível 2     | Total de parcelas    |
| `createdAt`              | Auditoria      | Nível 1     | Data de criação      |
| `updatedAt`              | Auditoria      | Nível 1     | Data de atualização  |

### **2.9 Tabela: `parcelas` (Controle de Parcelas)**

**Criticidade:** Alta - Dados financeiros de pagamento

| Nome da Coluna         | Tipo de Dado   | Nível       | Observações          |
| ---------------------- | -------------- | ----------- | -------------------- |
| `id`                   | Identificador  | Nível 2     | ID interno           |
| `propostaId`           | Referência     | Nível 2     | Proposta relacionada |
| `numeroParcela`        | Financeiro     | Nível 2     | Número da parcela    |
| **`valorParcela`**     | **Financeiro** | **Nível 3** | **Valor da parcela** |
| `dataVencimento`       | Financeiro     | Nível 2     | Data de vencimento   |
| `dataPagamento`        | Financeiro     | Nível 2     | Data do pagamento    |
| `status`               | Operacional    | Nível 2     | Status da parcela    |
| **`codigoBoleto`**     | **Financeiro** | **Nível 3** | **Código do boleto** |
| **`linhaDigitavel`**   | **Financeiro** | **Nível 3** | **Linha digitável**  |
| **`codigoBarras`**     | **Financeiro** | **Nível 3** | **Código de barras** |
| `formaPagamento`       | Financeiro     | Nível 2     | Forma de pagamento   |
| `comprovantePagamento` | Documento      | Nível 2     | URL do comprovante   |
| `observacoes`          | Operacional    | Nível 2     | Observações          |
| `createdAt`            | Auditoria      | Nível 1     | Data de criação      |
| `updatedAt`            | Auditoria      | Nível 1     | Data de atualização  |

### **2.10 Tabela: `auditDeleteLog` (Log de Exclusões)**

**Criticidade:** Alta - Auditoria de compliance

| Nome da Coluna   | Tipo de Dado        | Nível       | Observações                |
| ---------------- | ------------------- | ----------- | -------------------------- |
| `id`             | Identificador       | Nível 2     | UUID                       |
| `tableName`      | Auditoria           | Nível 2     | Tabela afetada             |
| `recordId`       | Auditoria           | Nível 2     | ID do registro             |
| `deletedBy`      | Auditoria           | Nível 2     | Usuário que deletou        |
| `deletedAt`      | Auditoria           | Nível 2     | Data da exclusão           |
| `deletionReason` | Auditoria           | Nível 2     | Motivo da exclusão         |
| **`recordData`** | **Auditoria**       | **Nível 3** | **Dados completos (JSON)** |
| **`ipAddress`**  | **PII/Localização** | **Nível 3** | **IP do usuário**          |
| `userAgent`      | Técnico             | Nível 2     | Browser/dispositivo        |
| `restoredAt`     | Auditoria           | Nível 2     | Data de restauração        |
| `restoredBy`     | Auditoria           | Nível 2     | Usuário que restaurou      |

### **2.11 Tabela: `security_logs` (Logs de Segurança)**

**Criticidade:** Alta - Monitoramento de segurança

| Nome da Coluna  | Tipo de Dado        | Nível       | Observações         |
| --------------- | ------------------- | ----------- | ------------------- |
| `id`            | Identificador       | Nível 2     | UUID                |
| `eventType`     | Segurança           | Nível 2     | Tipo de evento      |
| `severity`      | Segurança           | Nível 2     | Severidade          |
| **`ipAddress`** | **PII/Localização** | **Nível 3** | **IP do usuário**   |
| `userId`        | Referência          | Nível 2     | UUID do usuário     |
| `userAgent`     | Técnico             | Nível 2     | Browser/dispositivo |
| `endpoint`      | Técnico             | Nível 2     | Endpoint acessado   |
| `statusCode`    | Técnico             | Nível 2     | Código HTTP         |
| `success`       | Operacional         | Nível 2     | Sucesso/falha       |
| `details`       | Segurança           | Nível 2     | Detalhes (JSONB)    |
| `createdAt`     | Auditoria           | Nível 1     | Data do evento      |

### **2.12 Tabela: `lojas` (Lojas dos Parceiros)**

**Criticidade:** Baixa - Dados públicos de estabelecimentos

| Nome da Coluna | Tipo de Dado  | Nível   | Observações          |
| -------------- | ------------- | ------- | -------------------- |
| `id`           | Identificador | Nível 2 | ID interno           |
| `parceiroId`   | Referência    | Nível 2 | Parceiro relacionado |
| `nomeLoja`     | Empresarial   | Nível 1 | Nome da loja         |
| `endereco`     | Empresarial   | Nível 2 | Endereço comercial   |
| `isActive`     | Operacional   | Nível 2 | Status ativo         |
| `createdAt`    | Auditoria     | Nível 1 | Data de criação      |
| `deletedAt`    | Auditoria     | Nível 2 | Soft delete          |

### **2.13 Tabela: `produtos` (Produtos de Crédito)**

**Criticidade:** Baixa - Configuração de produtos

| Nome da Coluna               | Tipo de Dado  | Nível   | Observações      |
| ---------------------------- | ------------- | ------- | ---------------- |
| `id`                         | Identificador | Nível 2 | ID interno       |
| `nomeProduto`                | Produto       | Nível 1 | Nome do produto  |
| `isActive`                   | Operacional   | Nível 2 | Status ativo     |
| `tacValor`                   | Financeiro    | Nível 2 | Taxa de abertura |
| `tacTipo`                    | Configuração  | Nível 2 | Tipo de TAC      |
| `modalidadeJuros`            | Configuração  | Nível 2 | Modalidade       |
| `periodicidadeCapitalizacao` | Configuração  | Nível 2 | Capitalização    |
| `anoBase`                    | Configuração  | Nível 1 | Base de cálculo  |
| `tarifaTedPadrao`            | Financeiro    | Nível 2 | Tarifa TED       |
| `taxaCreditoPadrao`          | Financeiro    | Nível 2 | Taxa de crédito  |
| `createdAt`                  | Auditoria     | Nível 1 | Data de criação  |
| `deletedAt`                  | Auditoria     | Nível 2 | Soft delete      |

### **2.14 Tabela: `tabelasComerciais` (Tabelas de Taxas)**

**Criticidade:** Média - Dados comerciais sensíveis

| Nome da Coluna    | Tipo de Dado  | Nível   | Observações          |
| ----------------- | ------------- | ------- | -------------------- |
| `id`              | Identificador | Nível 2 | ID interno           |
| `nomeTabela`      | Configuração  | Nível 2 | Nome da tabela       |
| `taxaJuros`       | Financeiro    | Nível 2 | Taxa de juros        |
| `taxaJurosAnual`  | Financeiro    | Nível 2 | Taxa anual           |
| `prazos`          | Configuração  | Nível 2 | Prazos disponíveis   |
| `parceiroId`      | Referência    | Nível 2 | Parceiro relacionado |
| `comissao`        | Financeiro    | Nível 2 | Comissão             |
| `calculoEncargos` | Configuração  | Nível 2 | Fórmula de cálculo   |
| `cetFormula`      | Configuração  | Nível 2 | Fórmula CET          |
| `createdAt`       | Auditoria     | Nível 1 | Data de criação      |
| `deletedAt`       | Auditoria     | Nível 2 | Soft delete          |

---

## 3. Estratégia de Proteção por Nível

### **3.1 Proteção Nível 3 (Confidencial)**

**Criptografia:**

- ✅ Em repouso: AES-256-GCM
- ✅ Em trânsito: TLS 1.3 mínimo
- ✅ Chaves rotacionadas trimestralmente

**Mascaramento:**

```javascript
// Exemplo de mascaramento
CPF: 123.456.789-10 → ***.456.***-**
Telefone: (11) 98765-4321 → (11) ****-4321
Email: usuario@example.com → u***o@example.com
```

**Controle de Acesso:**

- Row Level Security (RLS) obrigatório
- Auditoria completa de leitura/escrita
- MFA para acesso administrativo

**Conformidade LGPD:**

- Consentimento explícito para coleta
- Direito ao esquecimento implementado
- Portabilidade de dados disponível
- Relatório de impacto (DPIA) requerido

### **3.2 Proteção Nível 2 (Interno)**

**Controle de Acesso:**

- RBAC com 5 perfis definidos
- Logs de acesso mantidos por 90 dias
- Princípio do menor privilégio

**Proteção:**

- Não expor em APIs públicas
- Validação de entrada obrigatória
- Rate limiting aplicado

### **3.3 Proteção Nível 1 (Público)**

**Proteção Básica:**

- Proteção contra SQL Injection
- Validação de integridade
- Cache permitido com TTL apropriado

---

## 4. Matriz de Risco e Impacto

### **4.1 Análise de Impacto de Vazamento**

| Tipo de Dado          | Impacto Legal                           | Impacto Financeiro                    | Impacto Reputacional             | Risco Total |
| --------------------- | --------------------------------------- | ------------------------------------- | -------------------------------- | ----------- |
| **CPF/CNPJ**          | CRÍTICO - Multa LGPD até 2% faturamento | ALTO - Fraude de identidade           | CRÍTICO - Perda de confiança     | **CRÍTICO** |
| **Dados Bancários**   | CRÍTICO - Regulação BACEN               | CRÍTICO - Transferências fraudulentas | CRÍTICO - Responsabilidade civil | **CRÍTICO** |
| **Senhas/Tokens**     | ALTO - Acesso não autorizado            | ALTO - Comprometimento sistêmico      | ALTO - Breach total              | **CRÍTICO** |
| **Endereços**         | MÉDIO - Privacidade                     | MÉDIO - Risco físico                  | MÉDIO - Exposição pessoal        | **ALTO**    |
| **Telefones/Emails**  | MÉDIO - LGPD                            | BAIXO - Spam/Phishing                 | MÉDIO - Harassment               | **MÉDIO**   |
| **Dados Financeiros** | ALTO - Sigilo bancário                  | ALTO - Análise competitiva            | ALTO - Confiança mercado         | **ALTO**    |

### **4.2 Priorização de Proteção**

1. **Prioridade Máxima:** CPF, CNPJ, Senhas, Tokens, Dados Bancários
2. **Prioridade Alta:** Endereços completos, RG, Dados financeiros
3. **Prioridade Média:** Telefones, Emails, Nomes
4. **Prioridade Baixa:** Metadados, IDs internos

---

## 5. Requisitos de Conformidade LGPD

### **5.1 Bases Legais para Processamento**

| Tipo de Dado           | Base Legal           | Justificativa                        |
| ---------------------- | -------------------- | ------------------------------------ |
| Dados de identificação | Execução de contrato | Necessário para concessão de crédito |
| Dados financeiros      | Obrigação legal      | Exigência BACEN/SCR                  |
| Dados de contato       | Legítimo interesse   | Comunicação sobre o contrato         |
| Score de crédito       | Consentimento        | Análise de risco opcional            |

### **5.2 Direitos do Titular Implementados**

- ✅ **Acesso:** API `/api/lgpd/meus-dados`
- ✅ **Retificação:** Interface de correção de dados
- ✅ **Exclusão:** Soft delete com período de retenção legal
- ✅ **Portabilidade:** Export em JSON/CSV
- ⚠️ **Oposição:** Parcialmente implementado
- ⚠️ **Revisão de decisões automatizadas:** Em desenvolvimento

### **5.3 Medidas Técnicas e Organizacionais**

**Técnicas:**

- Criptografia AES-256
- Pseudonimização de logs
- Backup criptografado
- Segregação de ambientes
- Testes de penetração trimestrais

**Organizacionais:**

- DPO nomeado
- Treinamento LGPD semestral
- Política de privacidade atualizada
- Processo de resposta a incidentes
- Avaliação de impacto (DPIA)

---

## 6. Plano de Ação para Remediação

### **6.1 Ações Imediatas (P0)**

| Ação                                 | Prazo   | Responsável | Status      |
| ------------------------------------ | ------- | ----------- | ----------- |
| Criptografar campos Nível 3 no banco | 7 dias  | DevOps      | ⏳ Pendente |
| Implementar mascaramento em logs     | 3 dias  | Backend     | ⏳ Pendente |
| Revisar políticas de backup          | 5 dias  | SRE         | ⏳ Pendente |
| Audit log para dados sensíveis       | 10 dias | Security    | ⏳ Pendente |

### **6.2 Ações de Médio Prazo (P1)**

| Ação                       | Prazo   | Responsável | Status       |
| -------------------------- | ------- | ----------- | ------------ |
| Tokenização de CPF/CNPJ    | 30 dias | Arquitetura | ⏳ Planejado |
| DLP (Data Loss Prevention) | 45 dias | Security    | ⏳ Planejado |
| Classificação automática   | 60 dias | Data Team   | ⏳ Planejado |
| Treinamento LGPD equipe    | 15 dias | RH          | ⏳ Agendado  |

### **6.3 Ações de Longo Prazo (P2)**

| Ação                    | Prazo    | Responsável | Status      |
| ----------------------- | -------- | ----------- | ----------- |
| Certificação ISO 27001  | 6 meses  | Compliance  | ⏳ Análise  |
| Privacy by Design       | Contínuo | Todos       | ⏳ Iniciado |
| Zero Trust Architecture | 12 meses | Security    | ⏳ Roadmap  |

---

## 7. Ferramentas e Tecnologias Recomendadas

### **7.1 Criptografia e Proteção**

- **HashiCorp Vault:** Gerenciamento de segredos
- **AWS KMS / Azure Key Vault:** Criptografia de chaves
- **PostgreSQL TDE:** Transparent Data Encryption
- **Supabase RLS:** Row Level Security nativo

### **7.2 Monitoramento e Detecção**

- **Datadog:** Monitoramento de acesso a dados sensíveis
- **Splunk:** SIEM para detecção de anomalias
- **Open Policy Agent:** Políticas de acesso declarativas
- **Falco:** Runtime security para containers

### **7.3 Compliance e Governança**

- **OneTrust:** Gestão de privacidade LGPD
- **Privacera:** Governança de dados automatizada
- **Apache Ranger:** Controle de acesso fino
- **Immuta:** Descoberta e classificação automática

---

## 8. Métricas e KPIs de Segurança

### **8.1 Métricas de Proteção**

| Métrica                             | Meta  | Atual | Status |
| ----------------------------------- | ----- | ----- | ------ |
| % Dados Nível 3 criptografados      | 100%  | 60%   | ⚠️     |
| Tempo médio para detectar vazamento | < 1h  | 4h    | ❌     |
| % Conformidade LGPD                 | 95%   | 75%   | ⚠️     |
| Acessos não autorizados/mês         | 0     | 2     | ❌     |
| Tempo para patch de segurança       | < 24h | 48h   | ⚠️     |

### **8.2 Indicadores de Maturidade**

```
Nível Atual: 2/5 - Gerenciado
Meta 2025: 4/5 - Otimizado

1. Inicial ❌
2. Gerenciado ✅ (Atual)
3. Definido ⏳
4. Otimizado 🎯 (Meta)
5. Inovador 🚀
```

---

## 9. Anexos e Referências

### **9.1 Referências Normativas**

- [Lei Geral de Proteção de Dados (LGPD)](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [GDPR - General Data Protection Regulation](https://gdpr.eu/)
- [PCI DSS v4.0](https://www.pcisecuritystandards.org/)
- [ISO/IEC 27001:2022](https://www.iso.org/standard/27001)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

### **9.2 Documentos Relacionados**

- [Política de Privacidade](../policies/privacy-policy.md)
- [Política de Segurança da Informação](../policies/security-policy.md)
- [Plano de Resposta a Incidentes](../incident-response/plan.md)
- [DPIA - Data Protection Impact Assessment](../compliance/dpia.md)

---

## 10. Controle de Versões

| Versão | Data       | Autor  | Mudanças                 |
| ------ | ---------- | ------ | ------------------------ |
| 1.0    | 21/08/2025 | GEM 02 | Documento inicial criado |

---

## 11. Assinaturas e Aprovações

**Status:** ⏳ AGUARDANDO REVISÃO

| Papel                         | Nome   | Data     | Assinatura |
| ----------------------------- | ------ | -------- | ---------- |
| Arquiteto Senior              | GEM 01 | Pendente | Pendente   |
| Security Officer              | -      | Pendente | Pendente   |
| DPO (Data Protection Officer) | -      | Pendente | Pendente   |
| Compliance Manager            | -      | Pendente | Pendente   |

---

**FIM DO DOCUMENTO**

⚠️ **CLASSIFICAÇÃO:** CONFIDENCIAL - Distribuição Restrita
