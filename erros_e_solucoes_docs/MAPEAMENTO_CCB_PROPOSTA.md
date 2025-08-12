# 📋 Mapeamento Completo: Campos CCB ↔ Dados da Proposta

## 🔴 PROBLEMAS IDENTIFICADOS

### Campos CCB que NÃO estão sendo preenchidos corretamente:

1. **RG do cliente** - Campo existe mas não está mapeado
2. **Endereço completo do emitente** - Campo existe mas não está mapeado
3. **Dados bancários** - Campos existem mas mapeamento incorreto
4. **Dados de pagamento/parcelas** - Sem dados reais das parcelas
5. **CET (Custo Efetivo Total)** - Valor fixo em vez de calculado

## ✅ CAMPOS DO PDF CCB SIMPIX (29 campos)

### Página 1 - Identificação e Valores

| Campo CCB          | Coordenadas | Mapeamento ATUAL                                               | Dados da Proposta          | STATUS            |
| ------------------ | ----------- | -------------------------------------------------------------- | -------------------------- | ----------------- |
| numeroCedula       | (110, 750)  | `data.numeroCcb \|\| 'CCB-' + data.id?.slice(0, 8)`            | `proposta.id`              | ⚠️ PARCIAL        |
| dataEmissao        | (315, 750)  | `data.dataEmissao \|\| new Date().toLocaleDateString('pt-BR')` | `proposta.createdAt`       | ⚠️ USAR createdAt |
| finalidadeOperacao | (485, 750)  | `data.finalidade \|\| 'Empréstimo Pessoal'`                    | `proposta.finalidade`      | ✅ OK             |
| cpfCnpj            | (475, 700)  | `data.clienteCpf \|\| data.cpf`                                | `proposta.clienteCpf`      | ✅ OK             |
| nomeRazaoSocial    | (160, 650)  | `data.clienteNome \|\| data.nome`                              | `proposta.clienteNome`     | ✅ OK             |
| rg                 | (270, 650)  | `data.clienteRg \|\| data.rg \|\| ''`                          | `proposta.clienteRg`       | ❌ NÃO MAPEADO    |
| enderecoEmitente   | (105, 600)  | `data.clienteEndereco \|\| data.endereco \|\| ''`              | `proposta.clienteEndereco` | ❌ NÃO MAPEADO    |
| razaoSocialCredor  | (115, 500)  | `'SIMPIX LTDA'`                                                | FIXO                       | ✅ OK             |
| enderecoCredor     | (105, 450)  | `'Rua Principal, 123 - Centro - São Paulo/SP'`                 | FIXO                       | ⚠️ ATUALIZAR      |
| valorPrincipal     | (155, 400)  | `formatCurrency(data.valor \|\| data.valorEmprestimo)`         | `proposta.valor`           | ✅ OK             |
| custoEfetivoTotal  | (455, 200)  | `data.cet \|\| '2,5% a.m.'`                                    | CALCULAR                   | ❌ CALCULAR       |

### Página 2 - Dados Bancários

| Campo CCB                 | Coordenadas | Mapeamento ATUAL                   | Dados da Proposta              | STATUS      |
| ------------------------- | ----------- | ---------------------------------- | ------------------------------ | ----------- |
| numeroBancoEmitente       | (160, 690)  | `data.banco \|\| ''`               | `proposta.dadosPagamentoBanco` | ❌ CORRIGIR |
| contaNumeroEmitente       | (430, 690)  | `data.conta \|\| ''`               | `proposta.dadosPagamentoConta` | ❌ CORRIGIR |
| nomeInstituicaoFavorecida | (55, 550)   | `data.dadosPagamentoBanco \|\| ''` | `proposta.dadosPagamentoBanco` | ✅ OK       |
| numeroContrato            | (255, 550)  | `data.id?.slice(0, 10) \|\| ''`    | `proposta.id`                  | ✅ OK       |
| linhaDigitavelBoleto      | (405, 550)  | `data.linhaDigitavel \|\| ''`      | INTEGRAÇÃO INTER               | ❌ BUSCAR   |

### Página 8 - Tabela de Pagamentos (6 parcelas)

| Campo CCB         | Coordenadas | Mapeamento ATUAL                 | Dados da Proposta | STATUS      |
| ----------------- | ----------- | -------------------------------- | ----------------- | ----------- |
| dataPagamento1-6  | (55, Y)     | `calculateVencimento()`          | CALCULAR          | ⚠️ CALCULAR |
| valorPagamento1-6 | (155, Y)    | `formatCurrency(valorParcela)`   | CALCULAR          | ⚠️ CALCULAR |
| linhaDigitavel1-6 | (255, Y)    | `data.linhaDigitavel{i} \|\| ''` | INTEGRAÇÃO INTER  | ❌ BUSCAR   |

## 📊 DADOS DISPONÍVEIS NA PROPOSTA

### Dados do Cliente

- ✅ `clienteNome` → Campo: nomeRazaoSocial
- ✅ `clienteCpf` → Campo: cpfCnpj
- ❌ `clienteRg` → Campo: rg (NÃO ESTÁ SENDO USADO)
- ❌ `clienteEndereco` → Campo: enderecoEmitente (NÃO ESTÁ SENDO USADO)
- ⭕ `clienteEmail` → Não usado no CCB
- ⭕ `clienteTelefone` → Não usado no CCB
- ⭕ `clienteDataNascimento` → Não usado no CCB
- ⭕ `clienteRenda` → Não usado no CCB
- ⭕ `clienteOrgaoEmissor` → Não usado no CCB
- ⭕ `clienteEstadoCivil` → Não usado no CCB
- ⭕ `clienteNacionalidade` → Não usado no CCB
- ⭕ `clienteCep` → Não usado no CCB
- ⭕ `clienteOcupacao` → Não usado no CCB

### Dados do Empréstimo

- ✅ `valor` → Campo: valorPrincipal
- ✅ `prazo` → Usado para calcular parcelas
- ✅ `finalidade` → Campo: finalidadeOperacao
- ⭕ `garantia` → Não usado no CCB atual
- ❌ `valorTac` → Deveria ser incluído no CCB
- ❌ `valorIof` → Deveria ser incluído no CCB
- ❌ `valorTotalFinanciado` → Deveria ser incluído no CCB
- ❌ `taxaJuros` → Deveria ser usado para calcular CET

### Dados de Pagamento (Destino)

- ❌ `dadosPagamentoBanco` → Campo: numeroBancoEmitente (MAL MAPEADO)
- ❌ `dadosPagamentoAgencia` → NÃO ESTÁ NO CCB (adicionar?)
- ❌ `dadosPagamentoConta` → Campo: contaNumeroEmitente (MAL MAPEADO)
- ⭕ `dadosPagamentoTipo` → Não usado no CCB
- ⭕ `dadosPagamentoNomeTitular` → Não usado no CCB
- ⭕ `dadosPagamentoCpfTitular` → Não usado no CCB
- ⭕ `dadosPagamentoPix` → Não usado no CCB

### Dados de Formalização

- ⭕ `ccbGerado` → Status interno
- ⭕ `caminhoCcb` → Caminho do arquivo
- ⭕ `clicksignDocumentKey` → Integração ClickSign
- ⭕ `dataAprovacao` → Poderia ser usada como dataEmissao

## 🔧 CORREÇÕES NECESSÁRIAS

### 1. Corrigir Mapeamento no arquivo `ccbFieldMappingV2.ts` (linha ~507)

```typescript
private getFieldValue(fieldName: string, data: any): string {
  const fieldMap: { [key: string]: string } = {
    // PÁGINA 1
    numeroCedula: data.id ? `CCB-${data.id.slice(0, 8).toUpperCase()}` : '',
    dataEmissao: data.createdAt ? new Date(data.createdAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    finalidadeOperacao: data.finalidade || 'Capital de Giro',
    cpfCnpj: data.clienteCpf || '',
    nomeRazaoSocial: data.clienteNome || '',
    rg: data.clienteRg || '', // CORRIGIDO: Agora usa clienteRg
    enderecoEmitente: data.clienteEndereco || '', // CORRIGIDO: Agora usa clienteEndereco
    razaoSocialCredor: 'SIMPIX LTDA',
    enderecoCredor: 'Av. Paulista, 1000 - Bela Vista - São Paulo/SP - CEP 01310-100', // ATUALIZAR com endereço real
    valorPrincipal: this.formatCurrency(data.valor),
    custoEfetivoTotal: this.calculateCET(data.taxaJuros, data.prazo), // CORRIGIDO: Calcular CET real

    // PÁGINA 2 - DADOS BANCÁRIOS
    numeroBancoEmitente: this.extractBankCode(data.dadosPagamentoBanco), // CORRIGIDO: Extrair código do banco
    contaNumeroEmitente: `${data.dadosPagamentoAgencia || ''} / ${data.dadosPagamentoConta || ''}`, // CORRIGIDO: Agência + Conta
    nomeInstituicaoFavorecida: data.dadosPagamentoBanco || '',
    numeroContrato: data.id || '',
    linhaDigitavelBoleto: await this.getLinhaDigitavel(data.id), // CORRIGIDO: Buscar da integração Inter

    // PÁGINA 8 - PAGAMENTOS
    ...this.generatePaymentFields(data)
  };

  return fieldMap[fieldName] || '';
}

// Métodos auxiliares necessários:
private extractBankCode(bankName: string): string {
  const bankCodes: { [key: string]: string } = {
    'Banco do Brasil': '001',
    'Bradesco': '237',
    'Itaú': '341',
    'Santander': '033',
    'Caixa': '104',
    'Inter': '077',
    // adicionar mais bancos...
  };

  for (const [name, code] of Object.entries(bankCodes)) {
    if (bankName?.toLowerCase().includes(name.toLowerCase())) {
      return code;
    }
  }
  return '';
}

private calculateCET(taxaJuros: number, prazo: number): string {
  if (!taxaJuros || !prazo) return '';

  // Cálculo simplificado do CET
  // CET = taxa de juros + IOF + TAC / prazo
  const taxaMensal = taxaJuros || 2.5;
  const iof = 0.38; // IOF fixo
  const tac = 50; // TAC fixo

  const cetMensal = taxaMensal + (iof / prazo) + (tac / (1000 * prazo));
  const cetAnual = Math.pow(1 + cetMensal / 100, 12) - 1;

  return `${cetMensal.toFixed(2)}% a.m. / ${(cetAnual * 100).toFixed(2)}% a.a.`;
}

private async getLinhaDigitavel(propostaId: string): Promise<string> {
  // Buscar da tabela inter_collections
  try {
    const collection = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, propostaId))
      .limit(1);

    return collection[0]?.linhaDigitavel || '';
  } catch {
    return '';
  }
}

private generatePaymentFields(data: any): { [key: string]: string } {
  const fields: { [key: string]: string } = {};
  const numParcelas = Math.min(data.prazo || 1, 6);
  const valorParcela = this.calculateParcela(data.valor, data.taxaJuros, data.prazo);

  for (let i = 1; i <= numParcelas; i++) {
    const vencimento = this.calculateVencimento(data.dataAprovacao || new Date(), i);
    fields[`dataPagamento${i}`] = vencimento;
    fields[`valorPagamento${i}`] = this.formatCurrency(valorParcela);
    fields[`linhaDigitavel${i}`] = ''; // Será preenchido quando boletos forem gerados
  }

  return fields;
}

private calculateParcela(valor: number, taxaJuros: number, prazo: number): number {
  if (!valor || !prazo) return 0;

  const taxa = (taxaJuros || 2.5) / 100;
  const parcela = valor * (taxa * Math.pow(1 + taxa, prazo)) / (Math.pow(1 + taxa, prazo) - 1);

  return parcela;
}
```

## 📌 RESUMO DAS CORREÇÕES

### ✅ Já funcionando:

- Nome do cliente
- CPF do cliente
- Valor principal
- Finalidade
- Prazo (para cálculos)

### ❌ Precisa corrigir AGORA:

1. **RG**: Mapear `proposta.clienteRg` → `campo rg`
2. **Endereço**: Mapear `proposta.clienteEndereco` → `campo enderecoEmitente`
3. **Banco**: Extrair código do banco de `proposta.dadosPagamentoBanco`
4. **Conta**: Combinar `proposta.dadosPagamentoAgencia` + `proposta.dadosPagamentoConta`
5. **CET**: Calcular baseado em `proposta.taxaJuros` e `proposta.prazo`
6. **Data Emissão**: Usar `proposta.createdAt` ou `proposta.dataAprovacao`
7. **Parcelas**: Calcular valores reais usando Tabela Price
8. **Linha Digitável**: Buscar da tabela `inter_collections`

### ⚠️ Dados que precisam ser preenchidos na proposta:

- `clienteRg` - Adicionar no formulário de proposta
- `clienteEndereco` - Adicionar no formulário de proposta
- `dadosPagamentoBanco` - Já existe, garantir preenchimento
- `dadosPagamentoAgencia` - Já existe, garantir preenchimento
- `dadosPagamentoConta` - Já existe, garantir preenchimento

## 🎯 PRÓXIMOS PASSOS

1. **Atualizar o método `getFieldValue` em `ccbFieldMappingV2.ts`** com as correções acima
2. **Garantir que os campos da proposta sejam preenchidos** no frontend
3. **Adicionar métodos auxiliares** para cálculos (CET, parcelas, etc.)
4. **Integrar com tabela `inter_collections`** para buscar linhas digitáveis dos boletos
5. **Testar geração** com dados reais de uma proposta completa
