# ANÁLISE FORENSE DE SCHEMA - TABELA `propostas`

**Data da Análise:** 02/09/2025  
**Versão do Schema:** shared/schema.ts (linhas 144-312)  
**Objetivo:** Mapeamento completo da estrutura de dados para investigação de campos NULL

---

## TABELA DE SCHEMA DETALHADA

| Nome da Coluna                    | Tipo de Dados | Permite Nulo? | Valor Padrão     | Referência (FK)      | Observações                               |
| --------------------------------- | ------------- | ------------- | ---------------- | -------------------- | ----------------------------------------- |
| **id**                            | text          | **Não**       | -                | -                    | Primary Key (UUID string format)          |
| **numeroProposta**                | integer       | **Não**       | -                | -                    | Sequential number (starts 300001), UNIQUE |
| **lojaId**                        | integer       | **Não**       | -                | -                    | Multi-tenant key                          |
| **produtoId**                     | integer       | **Sim**       | -                | produtos.id          | FK para produtos                          |
| **tabelaComercialId**             | integer       | **Sim**       | -                | tabelasComerciais.id | FK para tabelas comerciais                |
| **clienteNome**                   | text          | **Sim**       | -                | -                    | Dados básicos do cliente                  |
| **clienteCpf**                    | text          | **Sim**       | -                | -                    | Indexado para performance                 |
| **clienteEmail**                  | text          | **Sim**       | -                | -                    |                                           |
| **clienteTelefone**               | text          | **Sim**       | -                | -                    |                                           |
| **clienteDataNascimento**         | text          | **Sim**       | -                | -                    |                                           |
| **clienteRenda**                  | text          | **Sim**       | -                | -                    |                                           |
| **clienteRg**                     | text          | **Sim**       | -                | -                    | Novos campos normalizados                 |
| **clienteOrgaoEmissor**           | text          | **Sim**       | -                | -                    |                                           |
| **clienteRgUf**                   | text          | **Sim**       | -                | -                    |                                           |
| **clienteRgDataEmissao**          | text          | **Sim**       | -                | -                    |                                           |
| **clienteEstadoCivil**            | text          | **Sim**       | -                | -                    |                                           |
| **clienteNacionalidade**          | text          | **Sim**       | 'Brasileira'     | -                    |                                           |
| **clienteLocalNascimento**        | text          | **Sim**       | -                | -                    |                                           |
| **clienteCep**                    | text          | **Sim**       | -                | -                    | Endereço detalhado                        |
| **clienteEndereco**               | text          | **Sim**       | -                | -                    | Campo legado                              |
| **clienteLogradouro**             | text          | **Sim**       | -                | -                    |                                           |
| **clienteNumero**                 | text          | **Sim**       | -                | -                    |                                           |
| **clienteComplemento**            | text          | **Sim**       | -                | -                    |                                           |
| **clienteBairro**                 | text          | **Sim**       | -                | -                    |                                           |
| **clienteCidade**                 | text          | **Sim**       | -                | -                    |                                           |
| **clienteUf**                     | text          | **Sim**       | -                | -                    |                                           |
| **clienteOcupacao**               | text          | **Sim**       | -                | -                    |                                           |
| **tipoPessoa**                    | text          | **Sim**       | 'PF'             | -                    | PF ou PJ                                  |
| **clienteRazaoSocial**            | text          | **Sim**       | -                | -                    | Dados para PJ                             |
| **clienteCnpj**                   | text          | **Sim**       | -                | -                    |                                           |
| **valor**                         | decimal(15,2) | **Sim**       | -                | -                    | Dados do empréstimo                       |
| **prazo**                         | integer       | **Sim**       | -                | -                    |                                           |
| **finalidade**                    | text          | **Sim**       | -                | -                    |                                           |
| **garantia**                      | text          | **Sim**       | -                | -                    |                                           |
| **valorTac**                      | decimal(10,2) | **Sim**       | -                | -                    | Valores calculados                        |
| **valorIof**                      | decimal(10,2) | **Sim**       | -                | -                    |                                           |
| **valorTotalFinanciado**          | decimal(15,2) | **Sim**       | -                | -                    |                                           |
| **valorLiquidoLiberado**          | decimal(15,2) | **Sim**       | -                | -                    |                                           |
| **jurosModalidade**               | text          | **Sim**       | 'pre_fixado'     | -                    | Dados financeiros                         |
| **periodicidadeCapitalizacao**    | text          | **Sim**       | 'mensal'         | -                    |                                           |
| **taxaJurosAnual**                | decimal(5,2)  | **Sim**       | -                | -                    |                                           |
| **pracaPagamento**                | text          | **Sim**       | 'São Paulo'      | -                    |                                           |
| **formaPagamento**                | text          | **Sim**       | 'boleto'         | -                    |                                           |
| **anoBase**                       | integer       | **Sim**       | 365              | -                    |                                           |
| **tarifaTed**                     | decimal(10,2) | **Sim**       | '10.00'          | -                    |                                           |
| **taxaCredito**                   | decimal(10,2) | **Sim**       | -                | -                    |                                           |
| **dataLiberacao**                 | timestamp     | **Sim**       | -                | -                    |                                           |
| **formaLiberacao**                | text          | **Sim**       | 'deposito'       | -                    |                                           |
| **calculoEncargos**               | text          | **Sim**       | -                | -                    |                                           |
| **status**                        | text          | **Não**       | -                | -                    | Status da proposta                        |
| **analistaId**                    | text          | **Sim**       | -                | -                    | Campos de análise                         |
| **dataAnalise**                   | timestamp     | **Sim**       | -                | -                    |                                           |
| **motivoPendencia**               | text          | **Sim**       | -                | -                    |                                           |
| **valorAprovado**                 | decimal(15,2) | **Sim**       | -                | -                    |                                           |
| **taxaJuros**                     | decimal(5,2)  | **Sim**       | -                | -                    |                                           |
| **observacoes**                   | text          | **Sim**       | -                | -                    |                                           |
| **documentos**                    | text[]        | **Sim**       | -                | -                    | Array de documentos                       |
| **ccbDocumentoUrl**               | text          | **Sim**       | -                | -                    |                                           |
| **dataAprovacao**                 | timestamp     | **Sim**       | -                | -                    | Formalização                              |
| **documentosAdicionais**          | text[]        | **Sim**       | -                | -                    |                                           |
| **contratoGerado**                | boolean       | **Sim**       | false            | -                    |                                           |
| **contratoAssinado**              | boolean       | **Sim**       | false            | -                    |                                           |
| **dataAssinatura**                | timestamp     | **Sim**       | -                | -                    |                                           |
| **dataPagamento**                 | timestamp     | **Sim**       | -                | -                    |                                           |
| **observacoesFormalização**       | text          | **Sim**       | -                | -                    |                                           |
| **ccbGerado**                     | boolean       | **Não**       | false            | -                    | Tracking de CCB                           |
| **caminhoCcb**                    | text          | **Sim**       | -                | -                    |                                           |
| **ccbGeradoEm**                   | timestamp     | **Sim**       | -                | -                    |                                           |
| **assinaturaEletronicaConcluida** | boolean       | **Não**       | false            | -                    |                                           |
| **biometriaConcluida**            | boolean       | **Não**       | false            | -                    |                                           |
| **caminhoCcbAssinado**            | text          | **Sim**       | -                | -                    |                                           |
| **clicksignDocumentKey**          | text          | **Sim**       | -                | -                    | ClickSign Integration                     |
| **clicksignSignerKey**            | text          | **Sim**       | -                | -                    |                                           |
| **clicksignListKey**              | text          | **Sim**       | -                | -                    |                                           |
| **clicksignStatus**               | text          | **Sim**       | -                | -                    |                                           |
| **clicksignSignUrl**              | text          | **Sim**       | -                | -                    |                                           |
| **clicksignSentAt**               | timestamp     | **Sim**       | -                | -                    |                                           |
| **clicksignSignedAt**             | timestamp     | **Sim**       | -                | -                    |                                           |
| **dadosPagamentoBanco**           | text          | **Sim**       | -                | -                    | Dados bancários                           |
| **dadosPagamentoCodigoBanco**     | text          | **Sim**       | -                | -                    |                                           |
| **dadosPagamentoAgencia**         | text          | **Sim**       | -                | -                    |                                           |
| **dadosPagamentoConta**           | text          | **Sim**       | -                | -                    |                                           |
| **dadosPagamentoDigito**          | text          | **Sim**       | -                | -                    |                                           |
| **dadosPagamentoTipo**            | text          | **Sim**       | -                | -                    |                                           |
| **dadosPagamentoNomeTitular**     | text          | **Sim**       | -                | -                    |                                           |
| **dadosPagamentoCpfTitular**      | text          | **Sim**       | -                | -                    |                                           |
| **dadosPagamentoPix**             | text          | **Sim**       | -                | -                    | Dados PIX                                 |
| **dadosPagamentoTipoPix**         | text          | **Sim**       | -                | -                    |                                           |
| **dadosPagamentoPixBanco**        | text          | **Sim**       | -                | -                    |                                           |
| **dadosPagamentoPixNomeTitular**  | text          | **Sim**       | -                | -                    |                                           |
| **dadosPagamentoPixCpfTitular**   | text          | **Sim**       | -                | -                    |                                           |
| **metodoPagamento**               | text          | **Sim**       | 'conta_bancaria' | -                    |                                           |
| **urlComprovantePagamento**       | text          | **Sim**       | -                | -                    |                                           |
| **interBoletoGerado**             | boolean       | **Sim**       | false            | -                    | Banco Inter                               |
| **interBoletoGeradoEm**           | timestamp     | **Sim**       | -                | -                    |                                           |
| **clienteData**                   | text          | **Sim**       | -                | -                    | Campos JSONB legados                      |
| **condicoesData**                 | text          | **Sim**       | -                | -                    |                                           |
| **clienteEmpresaNome**            | text          | **Sim**       | -                | -                    | Dados do empregador                       |
| **clienteEmpresaCnpj**            | text          | **Sim**       | -                | -                    |                                           |
| **clienteCargoFuncao**            | text          | **Sim**       | -                | -                    |                                           |
| **clienteTempoEmprego**           | text          | **Sim**       | -                | -                    |                                           |
| **clienteRendaComprovada**        | boolean       | **Não**       | false            | -                    |                                           |
| **clienteDividasExistentes**      | decimal(12,2) | **Sim**       | -                | -                    | Dados financeiros                         |
| **clienteComprometimentoRenda**   | decimal(6,2)  | **Sim**       | -                | -                    |                                           |
| **clienteScoreSerasa**            | integer       | **Sim**       | -                | -                    |                                           |
| **clienteRestricoesCpf**          | boolean       | **Não**       | false            | -                    |                                           |
| **userId**                        | text          | **Sim**       | -                | -                    | Auditoria                                 |
| **createdAt**                     | timestamp     | **Sim**       | NOW()            | -                    |                                           |
| **updatedAt**                     | timestamp     | **Sim**       | NOW()            | -                    |                                           |
| **deletedAt**                     | timestamp     | **Sim**       | -                | -                    | Soft delete                               |

---

## ANÁLISE FUNCIONAL E AGRUPAMENTO

### 🔍 **Grupo 1: Identificação e Controle**

**Campos:** id, numeroProposta, lojaId, status, userId, createdAt, updatedAt, deletedAt  
**Propósito:** Controle básico da proposta, identificação única, multi-tenancy e auditoria fundamental.  
**Criticidade:** 🔴 **CRÍTICA** - Estes campos são essenciais para funcionamento básico.

### 👤 **Grupo 2: Dados Básicos do Cliente**

**Campos:** clienteNome, clienteCpf, clienteEmail, clienteTelefone, clienteDataNascimento, clienteRenda  
**Propósito:** Informações fundamentais do cliente para identificação e contato.  
**Criticidade:** 🟠 **ALTA** - Necessários para prosseguimento da análise.

### 📋 **Grupo 3: Dados Estendidos do Cliente**

**Campos:** clienteRg, clienteOrgaoEmissor, clienteRgUf, clienteRgDataEmissao, clienteEstadoCivil, clienteNacionalidade, clienteLocalNascimento  
**Propósito:** Documentação completa para compliance e verificação de identidade.  
**Criticidade:** 🟡 **MÉDIA** - Importantes para formalização, mas não bloqueiam análise inicial.

### 🏠 **Grupo 4: Endereço Completo**

**Campos:** clienteCep, clienteEndereco, clienteLogradouro, clienteNumero, clienteComplemento, clienteBairro, clienteCidade, clienteUf, clienteOcupacao  
**Propósito:** Localização completa do cliente para envio de documentos e verificações.  
**Criticidade:** 🟡 **MÉDIA** - Necessário para formalização.

### 🏢 **Grupo 5: Dados Pessoa Jurídica**

**Campos:** tipoPessoa, clienteRazaoSocial, clienteCnpj  
**Propósito:** Informações específicas para clientes PJ.  
**Criticidade:** 🟡 **CONDICIONAL** - Crítico apenas para propostas PJ.

### 💰 **Grupo 6: Condições do Empréstimo**

**Campos:** valor, prazo, finalidade, garantia, produtoId, tabelaComercialId  
**Propósito:** Definição das condições básicas do crédito solicitado.  
**Criticidade:** 🔴 **CRÍTICA** - Essencial para cálculos e aprovação.

### 🧮 **Grupo 7: Valores Calculados**

**Campos:** valorTac, valorIof, valorTotalFinanciado, valorLiquidoLiberado  
**Propósito:** Resultados dos cálculos financeiros automáticos.  
**Criticidade:** 🔴 **CRÍTICA** - Devem ser preenchidos após cálculos.

### 📊 **Grupo 8: Parâmetros Financeiros Detalhados**

**Campos:** jurosModalidade, periodicidadeCapitalizacao, taxaJurosAnual, pracaPagamento, formaPagamento, anoBase, tarifaTed, taxaCredito, dataLiberacao, formaLiberacao, calculoEncargos  
**Propósito:** Configurações avançadas para geração de CCB e cálculos.  
**Criticidade:** 🟠 **ALTA** - Necessários para formalização precisa.

### 🔍 **Grupo 9: Análise e Aprovação**

**Campos:** analistaId, dataAnalise, motivoPendencia, valorAprovado, taxaJuros, observacoes  
**Propósito:** Registro do processo de análise pelo analista.  
**Criticidade:** 🟠 **ALTA** - Críticos para propostas em análise.

### 📄 **Grupo 10: Documentos e CCB**

**Campos:** documentos, ccbDocumentoUrl, ccbGerado, caminhoCcb, ccbGeradoEm  
**Propósito:** Gestão de documentos e geração de CCB.  
**Criticidade:** 🟠 **ALTA** - Críticos para formalização.

### ✍️ **Grupo 11: Assinatura Digital (ClickSign)**

**Campos:** clicksignDocumentKey, clicksignSignerKey, clicksignListKey, clicksignStatus, clicksignSignUrl, clicksignSentAt, clicksignSignedAt, assinaturaEletronicaConcluida, biometriaConcluida  
**Propósito:** Integração com ClickSign para assinatura eletrônica.  
**Criticidade:** 🟠 **ALTA** - Críticos para conclusão legal.

### 🏦 **Grupo 12: Dados de Pagamento (Destino)**

**Campos:** dadosPagamentoBanco, dadosPagamentoCodigoBanco, dadosPagamentoAgencia, dadosPagamentoConta, dadosPagamentoDigito, dadosPagamentoTipo, dadosPagamentoNomeTitular, dadosPagamentoCpfTitular  
**Propósito:** Conta bancária de destino dos recursos.  
**Criticidade:** 🔴 **CRÍTICA** - Essencial para liberação.

### 📱 **Grupo 13: Dados PIX (Alternativo)**

**Campos:** dadosPagamentoPix, dadosPagamentoTipoPix, dadosPagamentoPixBanco, dadosPagamentoPixNomeTitular, dadosPagamentoPixCpfTitular, metodoPagamento  
**Propósito:** Opção alternativa PIX para recebimento.  
**Criticidade:** 🟡 **CONDICIONAL** - Crítico se PIX for escolhido.

### 🏦 **Grupo 14: Integração Banco Inter**

**Campos:** interBoletoGerado, interBoletoGeradoEm  
**Propósito:** Tracking de boletos gerados no Inter.  
**Criticidade:** 🟡 **MÉDIA** - Para acompanhamento de cobrança.

### 👔 **Grupo 15: Dados Profissionais**

**Campos:** clienteEmpresaNome, clienteEmpresaCnpj, clienteCargoFuncao, clienteTempoEmprego, clienteRendaComprovada  
**Propósito:** Informações trabalhistas para análise de renda.  
**Criticidade:** 🟠 **ALTA** - Importante para análise de crédito.

### 💳 **Grupo 16: Análise de Crédito**

**Campos:** clienteDividasExistentes, clienteComprometimentoRenda, clienteScoreSerasa, clienteRestricoesCpf  
**Propósito:** Dados para scoring e análise de risco.  
**Criticidade:** 🔴 **CRÍTICA** - Essencial para aprovação automatizada.

### 📚 **Grupo 17: Dados Legados**

**Campos:** clienteData, condicoesData, clienteEndereco, documentos, contratoGerado, contratoAssinado  
**Propósito:** Compatibilidade com versões anteriores do sistema.  
**Criticidade:** 🟡 **BAIXA** - Manter por compatibilidade.

---

## 🚨 LISTA DE COLUNAS NULLABLE PARA INVESTIGAÇÃO CRÍTICA

### **ALTA PRIORIDADE (Devem ser preenchidas após fluxo completo):**

1. **produtoId** - FK crítica para cálculos
2. **tabelaComercialId** - FK crítica para taxas
3. **clienteNome** - Dados básicos obrigatórios
4. **clienteCpf** - Identificação obrigatória
5. **valor** - Valor do empréstimo
6. **prazo** - Prazo do empréstimo
7. **valorTac** - Valor calculado
8. **valorIof** - Valor calculado
9. **valorTotalFinanciado** - Valor calculado
10. **taxaJuros** - Taxa aprovada
11. **analistaId** - Responsável pela análise
12. **ccbDocumentoUrl** - URL do CCB gerado
13. **dadosPagamentoBanco** - Dados de pagamento
14. **clienteComprometimentoRenda** - Cálculo de risco

### **MÉDIA PRIORIDADE (Podem permanecer NULL conforme contexto):**

15. **clienteEmail** - Pode ser fornecido posteriormente
16. **clienteTelefone** - Pode ser fornecido posteriormente
17. **finalidade** - Pode ser genérica
18. **garantia** - Pode não ter garantia
19. **observacoes** - Opcional por natureza
20. **motivoPendencia** - Só para propostas pendentes

### **BAIXA PRIORIDADE (NULL aceitável):**

21. **clienteRgDataEmissao** - Dados complementares
22. **clienteComplemento** - Endereço pode não ter
23. **clienteLocalNascimento** - Não crítico
24. **documentosAdicionais** - Opcional
25. **observacoesFormalização** - Opcional

---

## 🎯 CONCLUSÕES E RECOMENDAÇÕES

### **Campos Críticos que NÃO devem ser NULL após fluxo completo:**

- Todos os campos do **Grupo 1** (controle)
- **produtoId** e **tabelaComercialId** (relações)
- **clienteNome**, **clienteCpf** (identificação)
- **valor**, **prazo** (condições)
- **valorTac**, **valorIof**, **valorTotalFinanciado** (calculados)
- **dados de pagamento** (pelo menos um método)

### **Próximos Passos Recomendados:**

1. Investigar registros específicos com campos críticos NULL
2. Analisar fluxo de preenchimento durante processo de CCB
3. Identificar etapas onde campos obrigatórios não estão sendo preenchidos
4. Implementar validações de integridade para campos críticos

---

**Status:** ✅ Análise de Schema Concluída  
**Próxima Fase:** Investigação de Fluxo de Dados (Operação Raio-X Fase 2)
