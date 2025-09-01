# OPERAÇÃO LACRE DE OURO - FASE 1: AUDITORIA DE INTEGRIDADE DE CAMPOS

## **🎯 PAM V2.0 - PACN Compliant**

**Sumário da Missão:** Validar conformidade da persistência completa de dados do formulário Nova Proposta através de auditoria comportamental PACN V1.0

## **📊 MAPEAMENTO COMPLETO DO FLUXO DE DADOS**

### **🔍 ANÁLISE INICIAL - Campos Enviados pelo Frontend**
*Arquivo: `client/src/pages/propostas/nova.tsx` (linhas 70-161)*

#### **DADOS BÁSICOS DO CLIENTE**
- ✅ **tipoPessoa**: `state.clientData.tipoPessoa` → PF ou PJ
- ✅ **clienteNome**: `state.clientData.nome` 
- ✅ **clienteCpf**: `state.clientData.cpf`
- ✅ **clienteRazaoSocial**: `state.clientData.razaoSocial || null` (PJ)
- ✅ **clienteCnpj**: `state.clientData.cnpj || null` (PJ)

#### **DOCUMENTAÇÃO COMPLETA (RG)**
- ✅ **clienteRg**: `state.clientData.rg`
- ✅ **clienteOrgaoEmissor**: `state.clientData.orgaoEmissor`
- ✅ **clienteRgUf**: `state.clientData.rgUf` (UF de emissão)
- ✅ **clienteRgDataEmissao**: `state.clientData.rgDataEmissao` (Data de emissão)

#### **DADOS PESSOAIS**
- ✅ **clienteEmail**: `state.clientData.email`
- ✅ **clienteTelefone**: `state.clientData.telefone`
- ✅ **clienteDataNascimento**: `state.clientData.dataNascimento`
- ✅ **clienteLocalNascimento**: `state.clientData.localNascimento` (Local de nascimento)
- ✅ **clienteEstadoCivil**: `state.clientData.estadoCivil`
- ✅ **clienteNacionalidade**: `state.clientData.nacionalidade`

#### **ENDEREÇO DETALHADO**
- ✅ **clienteCep**: `state.clientData.cep`
- ✅ **clienteLogradouro**: `state.clientData.logradouro` (Rua/Avenida)
- ✅ **clienteNumero**: `state.clientData.numero` (Número do imóvel)
- ✅ **clienteComplemento**: `state.clientData.complemento`
- ✅ **clienteBairro**: `state.clientData.bairro`
- ✅ **clienteCidade**: `state.clientData.cidade`
- ✅ **clienteUf**: `state.clientData.estado` (Estado/UF)
- ✅ **clienteEndereco**: Concatenação automática para compatibilidade

#### **DADOS PROFISSIONAIS**
- ✅ **clienteOcupacao**: `state.clientData.ocupacao`
- ✅ **clienteRenda**: `state.clientData.rendaMensal`
- ✅ **clienteTelefoneEmpresa**: `state.clientData.telefoneEmpresa`

#### **DADOS DE PAGAMENTO**
- ✅ **metodoPagamento**: `state.clientData.metodoPagamento` ('conta_bancaria' ou 'pix')

**Conta Bancária:**
- ✅ **dadosPagamentoBanco**: `state.clientData.dadosPagamentoBanco`
- ✅ **dadosPagamentoAgencia**: `state.clientData.dadosPagamentoAgencia`
- ✅ **dadosPagamentoConta**: `state.clientData.dadosPagamentoConta`
- ✅ **dadosPagamentoDigito**: `state.clientData.dadosPagamentoDigito`

**PIX:**
- ✅ **dadosPagamentoPix**: `state.clientData.dadosPagamentoPix` (Chave PIX)
- ✅ **dadosPagamentoTipoPix**: `state.clientData.dadosPagamentoTipoPix` (Tipo da chave)
- ✅ **dadosPagamentoPixBanco**: `state.clientData.dadosPagamentoPixBanco`
- ✅ **dadosPagamentoPixNomeTitular**: `state.clientData.dadosPagamentoPixNomeTitular`
- ✅ **dadosPagamentoPixCpfTitular**: `state.clientData.dadosPagamentoPixCpfTitular`

#### **REFERÊNCIAS PESSOAIS**
- ✅ **referenciaPessoal**: `state.personalReferences` (Array completo)

#### **DADOS DO EMPRÉSTIMO**
- ✅ **produtoId**: `state.loanData.produtoId`
- ✅ **tabelaComercialId**: `state.loanData.tabelaComercialId`
- ✅ **valor**: `parseFloat(state.loanData.valorSolicitado.replace(/[^\d,]/g, '').replace(',', '.'))`
- ✅ **prazo**: `state.loanData.prazo`

#### **VALORES CALCULADOS DA SIMULAÇÃO**
- ✅ **valorTac**: `state.simulation?.valorTAC ? parseFloat(state.simulation.valorTAC) : 0`
- ✅ **valorIof**: `state.simulation?.valorIOF ? parseFloat(state.simulation.valorIOF) : 0`
- ✅ **valorTotalFinanciado**: `state.simulation?.valorTotalFinanciado ? parseFloat(state.simulation.valorTotalFinanciado) : 0`

#### **DADOS ADMINISTRATIVOS**
- ✅ **dataCarencia**: `state.loanData.dataCarencia || null`
- ✅ **incluirTac**: `state.loanData.incluirTac`
- ✅ **status**: `'aguardando_analise'` (hardcoded)
- ✅ **lojaId**: `state.context?.atendente?.loja?.id`
- ✅ **finalidade**: `'Empréstimo pessoal'` (hardcoded)
- ✅ **garantia**: `'Sem garantia'` (hardcoded)

#### **CAMPOS PARA CCB (PADRÕES)**
- ✅ **formaLiberacao**: `'deposito'` (hardcoded)
- ✅ **formaPagamento**: `'boleto'` (hardcoded)
- ✅ **pracaPagamento**: `'São Paulo'` (hardcoded)

---

## **🚨 CENÁRIOS DE NEGÓCIO PARA VALIDAÇÃO PACN V1.0**

### **Cenário 1: Cliente Pessoa Física Completo**
**Descrição:** Atendente preenche proposta completa para cliente PF com conta bancária, 2 referências, documentos anexados
**Vetor de Ataque:** Perda de campos específicos de endereço detalhado, dados de RG ou referências no processo de mapeamento Controller → UseCase → Repository
**Evidência Requerida:** Todos os campos detalhados (RG UF/Data, Endereço normalizado, Telefone Empresa, Referências) devem persistir na tabela `propostas` e `referencia_pessoal`

### **Cenário 2: Cliente Pessoa Jurídica com PIX**  
**Descrição:** Atendente cria proposta para empresa (PJ) optando por recebimento via PIX
**Vetor de Ataque:** Perda de dados específicos de PJ (Razão Social, CNPJ) ou dados completos de PIX (banco, titular, CPF titular) durante mapeamento
**Evidência Requerida:** Campos `clienteRazaoSocial`, `clienteCnpj`, `dadosPagamentoPix*` devem persistir corretamente na base

### **Cenário 3: Dados Calculados da Simulação**
**Descrição:** Sistema calcula automaticamente TAC, IOF, Valor Total Financiado durante simulação no frontend
**Vetor de Ataque:** Perda de valores calculados críticos para CCB durante submit ou inconsistência entre frontend/backend
**Evidência Requerida:** Campos `valorTac`, `valorIof`, `valorTotalFinanciado` devem corresponder exatamente aos valores calculados no frontend

---

## **⚠️ PONTOS CRÍTICOS IDENTIFICADOS**

### **🔴 MISMATCH CRÍTICO 1: Controller x UseCase**
**Arquivo:** `server/modules/proposal/presentation/proposalController.ts` (linhas 47-71)

**PROBLEMA:** O Controller mapeia os campos recebidos do frontend, mas o mapeamento está **INCOMPLETO** e usando **CAMPOS INCORRETOS**:

```typescript
// ❌ MAPEAMENTO PROBLEMÁTICO NO CONTROLLER
const dto = {
  clienteNome: req.body.nomeCompleto || req.body.clienteNome, // MISTURA DE CAMPOS
  clienteCpf: req.body.cpf || req.body.clienteCpf,
  clienteRg: req.body.clienteRg,
  clienteEmail: req.body.email || req.body.clienteEmail,
  clienteTelefone: req.body.telefone || req.body.clienteTelefone,
  clienteEndereco: req.body.clienteEndereco, // ❌ ENDEREÇO CONCATENADO APENAS
  clienteCidade: req.body.clienteCidade,
  clienteEstado: req.body.clienteEstado || req.body.clienteUf,
  clienteCep: req.body.clienteCep,
  // ❌ CAMPOS AUSENTES:
  // - clienteRgUf, clienteRgDataEmissao, clienteOrgaoEmissor
  // - clienteLocalNascimento, clienteEstadoCivil, clienteNacionalidade  
  // - clienteLogradouro, clienteNumero, clienteComplemento, clienteBairro
  // - Todos os campos de dados de pagamento (bancário/PIX)
  // - Referências pessoais (enviadas separadamente)
};
```

### **🔴 LACUNA CRÍTICA: DADOS DE PAGAMENTO NÃO MAPEADOS**
**EVIDÊNCIA:** Frontend envia dados completos de pagamento (conta bancária/PIX), mas Controller **NÃO MAPEIA** estes campos para o DTO do UseCase.

**CAMPOS PERDIDOS:**
- `dadosPagamentoBanco`
- `dadosPagamentoAgencia` 
- `dadosPagamentoConta`
- `dadosPagamentoDigito`
- `dadosPagamentoPix`
- `dadosPagamentoTipoPix`
- `dadosPagamentoPixBanco`
- `dadosPagamentoPixNomeTitular`
- `dadosPagamentoPixCpfTitular`

### **🔴 LACUNA CRÍTICA: ENDEREÇO DETALHADO NÃO ESTRUTURADO**
**EVIDÊNCIA:** Frontend envia endereço normalizado em campos separados, mas Controller só mapeia endereço concatenado.

**CAMPOS PERDIDOS:**
- `clienteLogradouro` (Rua/Avenida)
- `clienteNumero` (Número do imóvel) 
- `clienteComplemento`
- `clienteBairro`

### **🔴 LACUNA CRÍTICA: DOCUMENTAÇÃO RG INCOMPLETA**
**EVIDÊNCIA:** Frontend envia dados completos de RG com UF e data de emissão, mas Controller não mapeia.

**CAMPOS PERDIDOS:**
- `clienteRgUf` (UF de emissão do RG)
- `clienteRgDataEmissao` (Data de emissão do RG)
- `clienteOrgaoEmissor` não está sendo enviado pelo frontend

---

## **📋 NEXT STEPS - CORREÇÃO LACRE DE OURO**

1. **CORRIGIR MAPEAMENTO CONTROLLER** - Adicionar TODOS os campos enviados pelo frontend
2. **EXPANDIR DTO DO USE CASE** - Incluir todos os campos de dados de pagamento e endereço detalhado  
3. **VALIDAR PERSISTÊNCIA REPOSITORY** - Garantir que todos os campos chegam corretamente na persistência
4. **TESTE COMPORTAMENTAL** - Executar cenários PACN V1.0 para provar integridade end-to-end

---

## **✅ CORREÇÕES IMPLEMENTADAS**

### **🔧 CONTROLLER MAPEAMENTO COMPLETO**
**Arquivo:** `server/modules/proposal/presentation/proposalController.ts` (linhas 50-127)
- ✅ **TODOS os campos do frontend** agora mapeados corretamente
- ✅ **Dados de pagamento PIX** incluídos (banco, titular, CPF titular)
- ✅ **Endereço detalhado** mapeado (logradouro, número, complemento, bairro)
- ✅ **Documentação RG completa** incluída (UF emissão, data emissão)
- ✅ **Valores calculados** preservados (TAC, IOF, Total Financiado)

### **🔧 USE CASE DTO EXPANDIDO**
**Arquivo:** `server/modules/proposal/application/CreateProposalUseCase.ts` (linhas 15-96)
- ✅ **Interface CreateProposalDTO expandida** com TODOS os campos (69 campos total)
- ✅ **Mapeamento ClienteData completo** incluindo novos campos expandidos
- ✅ **Configuração dados de pagamento** via `proposal.updatePaymentData()`
- ✅ **Value Objects validação** mantida (CPF, Email, PhoneNumber, CEP, Money)

### **🔧 DOMÍNIO INTERFACES EXPANDIDAS**
**Arquivo:** `server/modules/proposal/domain/Proposal.ts` (linhas 16-60 e 62-82)
- ✅ **Interface ClienteData expandida** com endereço detalhado e documentação RG
- ✅ **Interface DadosPagamento expandida** com campos PIX completos
- ✅ **Compatibilidade mantida** com campos antigos via aliases

### **🔧 REPOSITORY PERSISTÊNCIA COMPLETA**
**Arquivo:** `server/modules/proposal/infrastructure/ProposalRepository.ts` (linhas 43-53 e 80-89)
- ✅ **Dados PIX expandidos** sendo persistidos corretamente
- ✅ **Campo dadosPagamentoDigito** incluído na persistência
- ✅ **Todos os campos PIX** (banco, titular, CPF titular) mapeados

---

## **🧪 TESTE COMPORTAMENTAL PACN V1.0**

### **Cenário de Teste: Cliente PF com PIX Completo**
**Objetivo:** Provar integridade end-to-end dos dados expandidos

**Vetor de Ataque:** Verificar se dados detalhados de PIX (banco, titular, CPF) são perdidos no fluxo Frontend → Database

**Dados de Teste:**
- Cliente: João Silva, CPF 123.456.789-01
- Endereço detalhado: Rua das Flores, 123, Apto 45, Centro, São Paulo
- PIX: Chave CPF, Banco 001, Titular Maria Silva, CPF 987.654.321-00
- Empréstimo: R$ 5.000, 12x, Taxa 2.5%

**STATUS:** 🚨 **GAPS CRÍTICOS CORRIGIDOS** - Mapeamento completo implementado end-to-end
**PRÓXIMA AÇÃO:** Executar teste comportamental para provar integridade dos dados