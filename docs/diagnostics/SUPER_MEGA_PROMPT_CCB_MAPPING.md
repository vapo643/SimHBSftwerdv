# 🚨 MISSÃO CRÍTICA: MAPEAMENTO COMPLETO DE COORDENADAS PDF - CÉDULA DE CRÉDITO BANCÁRIO (CCB)

## CONTEXTO EMERGENCIAL

Estamos com um sistema de geração de CCB usando **pdf-lib** em Node.js que precisa preencher um template PDF real do Simpix (564KB, 8 páginas). O sistema está funcionando mas **NÃO CONSEGUE POSICIONAR OS CAMPOS CORRETAMENTE** no template. Precisamos de sua expertise para mapear TODAS as coordenadas exatas onde cada campo deve ser preenchido.

## ARQUITETURA TÉCNICA ATUAL

### Stack Tecnológica

```typescript
// Biblioteca principal
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Sistema de coordenadas PDF
// - Origem (0,0) = canto INFERIOR esquerdo
// - X aumenta para direita
// - Y aumenta para CIMA
// - Unidade: pontos (1 ponto = 1/72 polegada)

// Nossa função auxiliar para converter de topo para base
const yFromTop = (pageHeight: number, pixelsFromTop: number) => {
  return pageHeight - pixelsFromTop;
};

// Dimensões típicas do template
// Largura: 595.276 pontos (A4)
// Altura: 841.890 pontos (A4)
```

### Estrutura Atual de Mapeamento (INCOMPLETA E INCORRETA)

```typescript
// Arquivo: server/services/ccbFieldMapping.ts
export const CCB_FIELD_MAPPING = {
  nomeCliente: { x: 100, y: 200 }, // INCORRETO - precisa coordenada real
  cpfCliente: { x: 100, y: 220 }, // INCORRETO
  // ... todos estão com coordenadas erradas
};
```

## 📋 LISTA COMPLETA DE TODOS OS CAMPOS DISPONÍVEIS NO SISTEMA

### 1. DADOS DO CLIENTE (cliente_data)

```javascript
{
  // Identificação Pessoal
  nome_completo: "Gabriel Santana Jesus Santana",     // Nome completo do cliente
  cpf: "123.456.789-00",                             // CPF formatado
  rg: "12.345.678-9",                                // RG
  orgao_expedidor: "SSP/SP",                         // Órgão expedidor do RG
  data_nascimento: "15/03/1985",                     // Data de nascimento
  nacionalidade: "Brasileiro",                       // Nacionalidade
  naturalidade: "São Paulo - SP",                    // Cidade e estado natal
  estado_civil: "Casado",                            // Estado civil

  // Informações do Cônjuge (se casado)
  nome_conjuge: "Maria Silva Santana",               // Nome completo do cônjuge
  cpf_conjuge: "987.654.321-00",                    // CPF do cônjuge

  // Filiação
  nome_mae: "Ana Maria Santana",                     // Nome da mãe
  nome_pai: "José Carlos Santana",                   // Nome do pai

  // Contato
  telefone_celular: "(11) 98765-4321",              // Celular principal
  telefone_fixo: "(11) 3456-7890",                  // Telefone fixo
  email: "gabriel.santana@email.com",               // E-mail

  // Endereço Residencial
  cep: "01310-100",                                  // CEP
  logradouro: "Avenida Paulista",                   // Rua/Avenida
  numero: "1578",                                    // Número
  complemento: "Apto 142",                          // Complemento
  bairro: "Bela Vista",                             // Bairro
  cidade: "São Paulo",                              // Cidade
  estado: "SP",                                      // Estado (sigla)

  // Informações Profissionais
  profissao: "Engenheiro de Software",              // Profissão
  empresa: "Tech Solutions Ltda",                   // Nome da empresa
  cnpj_empresa: "12.345.678/0001-90",              // CNPJ da empresa
  cargo: "Analista Sênior",                         // Cargo
  tempo_empresa: "3 anos e 6 meses",                // Tempo na empresa
  renda_mensal: 8500.00,                            // Renda mensal bruta
  renda_mensal_formatada: "R$ 8.500,00",           // Renda formatada
  outras_rendas: 1500.00,                           // Outras rendas
  outras_rendas_formatada: "R$ 1.500,00",          // Outras rendas formatada

  // Endereço Comercial
  cep_comercial: "04567-000",                       // CEP comercial
  logradouro_comercial: "Rua dos Desenvolvedores",  // Endereço comercial
  numero_comercial: "42",                           // Número comercial
  complemento_comercial: "Sala 301",                // Complemento comercial
  bairro_comercial: "Vila Tech",                    // Bairro comercial
  cidade_comercial: "São Paulo",                    // Cidade comercial
  estado_comercial: "SP",                           // Estado comercial
  telefone_comercial: "(11) 3333-4444",            // Telefone comercial

  // Referências Pessoais
  referencia1_nome: "Carlos Alberto Silva",         // Nome referência 1
  referencia1_telefone: "(11) 99999-8888",         // Telefone referência 1
  referencia1_parentesco: "Amigo",                  // Parentesco/relação

  referencia2_nome: "Márcia Oliveira",             // Nome referência 2
  referencia2_telefone: "(11) 88888-7777",         // Telefone referência 2
  referencia2_parentesco: "Prima",                  // Parentesco/relação

  // Informações Bancárias
  banco: "Banco do Brasil",                         // Nome do banco
  agencia: "1234-5",                               // Agência
  conta: "56789-0",                                // Conta corrente
  tipo_conta: "Corrente",                          // Tipo de conta
  tempo_conta: "5 anos",                           // Tempo de conta

  // Documentação Adicional
  comprovante_residencia: "Conta de luz",          // Tipo de comprovante
  comprovante_renda: "Holerite",                   // Tipo de comprovante
}
```

### 2. DADOS DO EMPRÉSTIMO (condicoes_data)

```javascript
{
  // Valores do Empréstimo
  valor_solicitado: 50000.00,                      // Valor solicitado
  valor_solicitado_formatado: "R$ 50.000,00",      // Valor formatado
  valor_financiado: 52150.00,                      // Valor com taxas
  valor_financiado_formatado: "R$ 52.150,00",      // Valor financiado formatado
  valor_liquido: 49500.00,                         // Valor líquido liberado
  valor_liquido_formatado: "R$ 49.500,00",         // Valor líquido formatado

  // Parcelamento
  prazo_meses: 36,                                 // Número de parcelas
  prazo_extenso: "trinta e seis",                  // Prazo por extenso
  valor_parcela: 1865.45,                          // Valor da parcela
  valor_parcela_formatado: "R$ 1.865,45",          // Parcela formatada
  valor_parcela_extenso: "mil oitocentos e sessenta e cinco reais e quarenta e cinco centavos",
  primeira_parcela: "15/02/2025",                  // Data primeira parcela
  ultima_parcela: "15/01/2028",                    // Data última parcela
  dia_vencimento: 15,                              // Dia de vencimento

  // Taxas e Encargos
  taxa_juros_mensal: 2.89,                         // Taxa de juros ao mês (%)
  taxa_juros_anual: 40.77,                         // Taxa de juros ao ano (%)
  taxa_juros_mensal_formatada: "2,89% a.m.",       // Taxa mensal formatada
  taxa_juros_anual_formatada: "40,77% a.a.",       // Taxa anual formatada

  cet_mensal: 3.15,                                // CET mensal (%)
  cet_anual: 44.82,                                // CET anual (%)
  cet_mensal_formatado: "3,15% a.m.",              // CET mensal formatado
  cet_anual_formatado: "44,82% a.a.",              // CET anual formatado

  iof: 385.00,                                     // Valor do IOF
  iof_formatado: "R$ 385,00",                      // IOF formatado
  iof_adicional: 150.00,                           // IOF adicional
  iof_adicional_formatado: "R$ 150,00",            // IOF adicional formatado

  tac: 299.00,                                     // Taxa de abertura de crédito
  tac_formatado: "R$ 299,00",                      // TAC formatada

  seguro_prestamista: 45.00,                       // Seguro mensal
  seguro_prestamista_formatado: "R$ 45,00",        // Seguro formatado
  seguro_total: 1620.00,                           // Seguro total (36 meses)
  seguro_total_formatado: "R$ 1.620,00",           // Seguro total formatado

  // Valores Totais
  valor_total_pagar: 67156.20,                     // Total a pagar
  valor_total_pagar_formatado: "R$ 67.156,20",     // Total formatado
  valor_total_pagar_extenso: "sessenta e sete mil, cento e cinquenta e seis reais e vinte centavos",

  // Garantias
  tipo_garantia: "Alienação Fiduciária",           // Tipo de garantia
  bem_garantia: "Veículo Honda Civic 2020",        // Descrição do bem
  valor_bem: 95000.00,                             // Valor do bem
  valor_bem_formatado: "R$ 95.000,00",             // Valor do bem formatado

  // Forma de Pagamento
  forma_pagamento: "Boleto Bancário",              // Forma de pagamento
  banco_pagamento: "Banco Inter",                  // Banco para pagamento

  // Informações da Tabela Comercial
  tabela_comercial: "Tabela Flex Premium",         // Nome da tabela
  codigo_tabela: "FLEX-2025-01",                   // Código da tabela
  vigencia_tabela: "01/01/2025 a 31/12/2025",     // Vigência
}
```

### 3. DADOS DA LOJA/PARCEIRO

```javascript
{
  // Loja
  nome_loja: "Loja Centro SP",                     // Nome da loja
  codigo_loja: "LOJ-001",                          // Código interno
  cnpj_loja: "98.765.432/0001-10",                // CNPJ da loja
  endereco_loja: "Rua do Comércio, 100",          // Endereço da loja
  telefone_loja: "(11) 3333-2222",                // Telefone da loja
  gerente_loja: "Roberto Santos",                  // Nome do gerente

  // Parceiro
  razao_social_parceiro: "Simpix Financeira S.A.", // Razão social
  nome_fantasia_parceiro: "Simpix",                // Nome fantasia
  cnpj_parceiro: "11.222.333/0001-44",            // CNPJ parceiro
  endereco_parceiro: "Av. Financeira, 500",        // Endereço parceiro
}
```

### 4. DADOS DE PAGAMENTO (A SEREM IMPLEMENTADOS)

```javascript
{
  // Boletos Gerados
  codigo_barras_boleto: "34191.79001 01043.510047 91020.150008 5 91320026000",
  linha_digitavel: "34195913200260003419179001010435100479102015000",
  nosso_numero: "1234567890",                      // Nosso número
  numero_documento: "DOC-2025-001234",             // Número do documento

  // PIX
  chave_pix: "11222333000144",                     // Chave PIX (CNPJ)
  qr_code_pix: "00020126360014BR.GOV.BCB.PIX...", // Código QR PIX
  codigo_copia_cola: "00020126360014BR...",        // PIX copia e cola

  // Dados do Cedente/Beneficiário
  cedente_nome: "Simpix Financeira S.A.",          // Nome do cedente
  cedente_cnpj: "11.222.333/0001-44",             // CNPJ cedente
  cedente_endereco: "Av. Financeira, 500, São Paulo - SP",

  // Sacado (Cliente)
  sacado_nome: "Gabriel Santana Jesus Santana",    // Nome do sacado
  sacado_cpf: "123.456.789-00",                   // CPF do sacado
  sacado_endereco: "Av. Paulista, 1578, São Paulo - SP",

  // Informações Bancárias para Pagamento
  banco_codigo: "077",                             // Código do banco
  banco_nome: "Banco Inter S.A.",                  // Nome do banco
  agencia_cedente: "0001",                         // Agência cedente
  conta_cedente: "123456-7",                       // Conta cedente
  carteira: "109",                                 // Carteira
  especie_documento: "DM",                         // Espécie do documento
  aceite: "N",                                      // Aceite

  // Instruções para o Caixa
  instrucao1: "Não receber após o vencimento",
  instrucao2: "Em caso de dúvidas, contate: (11) 3333-2222",
  instrucao3: "Multa de 2% após vencimento",
  instrucao4: "Juros de 1% ao mês",
}
```

### 5. DADOS DE FORMALIZAÇÃO E ASSINATURA

```javascript
{
  // Dados da CCB
  numero_ccb: "CCB-2025-001234",                   // Número da cédula
  data_emissao: "07/01/2025",                      // Data de emissão
  data_emissao_extenso: "sete de janeiro de dois mil e vinte e cinco",
  local_emissao: "São Paulo - SP",                 // Local de emissão

  // Assinatura Eletrônica (ClickSign)
  codigo_verificacao: "ABC-123-XYZ",               // Código de verificação
  hash_documento: "a1b2c3d4e5f6...",               // Hash do documento
  protocolo_assinatura: "CLICK-2025-001234",       // Protocolo
  data_assinatura: "07/01/2025 14:35:22",          // Data/hora assinatura
  ip_assinatura: "192.168.1.100",                  // IP do assinante

  // Testemunhas
  testemunha1_nome: "João da Silva",               // Nome testemunha 1
  testemunha1_cpf: "111.222.333-44",              // CPF testemunha 1

  testemunha2_nome: "Maria Oliveira",              // Nome testemunha 2
  testemunha2_cpf: "555.666.777-88",              // CPF testemunha 2
}
```

### 6. CAMPOS CALCULADOS E FORMATADOS

```javascript
{
  // Datas
  data_atual: "07/01/2025",                        // Data atual
  data_atual_extenso: "sete de janeiro de dois mil e vinte e cinco",
  mes_ano_atual: "Janeiro/2025",                   // Mês/Ano

  // Endereço Completo Formatado
  endereco_completo_cliente: "Av. Paulista, 1578, Apto 142, Bela Vista, São Paulo - SP, CEP 01310-100",
  endereco_completo_empresa: "Rua dos Desenvolvedores, 42, Sala 301, Vila Tech, São Paulo - SP",

  // Valores por Extenso
  valor_entrada_extenso: "cinco mil reais",
  valor_financiado_extenso: "cinquenta e dois mil, cento e cinquenta reais",

  // Cálculos
  valor_total_juros: 15006.20,                     // Total de juros
  valor_total_juros_formatado: "R$ 15.006,20",     // Juros formatado
  percentual_entrada: 10,                          // % de entrada
  percentual_financiado: 90,                       // % financiado
}
```

## 🎯 CAMPOS QUE DEVEM APARECER NO PDF DA CCB

O template PDF tem 8 páginas e precisa ter os seguintes campos preenchidos:

### PÁGINA 1 - CAPA E IDENTIFICAÇÃO

1. **Número da CCB** (topo direito)
2. **Data de Emissão** (abaixo do número)
3. **Nome Completo do Cliente** (centro da página)
4. **CPF do Cliente** (abaixo do nome)
5. **Valor Total Financiado** (destaque)
6. **Quantidade de Parcelas** (ao lado do valor)
7. **Valor da Parcela** (abaixo)
8. **Logo Simpix** (já existe no template)

### PÁGINA 2 - QUALIFICAÇÃO DO EMITENTE

1. **Nome Completo**
2. **CPF**
3. **RG e Órgão Expedidor**
4. **Data de Nascimento**
5. **Estado Civil**
6. **Nome do Cônjuge** (se aplicável)
7. **CPF do Cônjuge** (se aplicável)
8. **Profissão**
9. **Endereço Residencial Completo**
10. **CEP**
11. **Telefone Celular**
12. **E-mail**

### PÁGINA 3 - DADOS DO CRÉDITO

1. **Valor do Principal** (valor solicitado)
2. **Taxa de Juros Mensal**
3. **Taxa de Juros Anual**
4. **CET Mensal**
5. **CET Anual**
6. **IOF**
7. **TAC**
8. **Seguro** (se houver)
9. **Valor Total dos Encargos**
10. **Valor Total a Pagar**
11. **Forma de Pagamento**
12. **Quantidade de Parcelas**
13. **Valor de Cada Parcela**
14. **Data do Primeiro Vencimento**
15. **Data do Último Vencimento**
16. **Dia de Vencimento**

### PÁGINA 4 - CONDIÇÕES GERAIS

(Texto padrão, mas precisa preencher):

1. **Taxa de Juros** (repetir)
2. **Multa por Atraso** (2%)
3. **Juros de Mora** (1% ao mês)

### PÁGINA 5 - GARANTIAS (se aplicável)

1. **Tipo de Garantia**
2. **Descrição do Bem**
3. **Valor do Bem**

### PÁGINA 6 - DECLARAÇÕES

(Texto padrão com campos):

1. **Nome do Emitente** (repetir)
2. **CPF** (repetir)

### PÁGINA 7 - AUTORIZAÇÃO DE DÉBITO

1. **Banco**
2. **Agência**
3. **Conta Corrente**
4. **Valor da Parcela** (repetir)
5. **Dia de Vencimento** (repetir)

### PÁGINA 8 - ASSINATURAS

1. **Local e Data**
2. **Campo para Assinatura do Emitente**
3. **Nome do Emitente** (abaixo da linha)
4. **CPF do Emitente** (abaixo do nome)
5. **Campo para Assinatura da Testemunha 1**
6. **Nome da Testemunha 1**
7. **CPF da Testemunha 1**
8. **Campo para Assinatura da Testemunha 2**
9. **Nome da Testemunha 2**
10. **CPF da Testemunha 2**
11. **Campo para Assinatura do Credor**
12. **Razão Social do Credor**
13. **CNPJ do Credor**

## 🔥 O QUE PRECISAMOS DE VOCÊ

### 1. ANÁLISE DO PDF ANEXADO

Por favor, analise o PDF template anexado (template_ccb.pdf - 564KB, 8 páginas) e:

1. **Identifique visualmente** onde cada campo deve ser preenchido
2. **Determine as coordenadas exatas** (x, y) em pontos para cada campo
3. **Considere o tamanho da fonte** apropriado para cada campo (geralmente 10-12pt para texto normal, 14-16pt para títulos)
4. **Identifique campos que se repetem** em múltiplas páginas

### 2. FORNEÇA O MAPEAMENTO COMPLETO

Precisamos um objeto JavaScript/TypeScript completo assim:

```typescript
export const CCB_FIELD_COORDINATES = {
  // Página 1
  page1: {
    numeroCCB: {
      x: ???,  // coordenada X exata
      y: ???,  // coordenada Y (lembre-se: medida de baixo para cima)
      fontSize: 12,
      bold: true
    },
    dataEmissao: {
      x: ???,
      y: ???,
      fontSize: 10
    },
    nomeCliente: {
      x: ???,
      y: ???,
      fontSize: 14,
      bold: true
    },
    cpfCliente: {
      x: ???,
      y: ???,
      fontSize: 12
    },
    valorFinanciado: {
      x: ???,
      y: ???,
      fontSize: 16,
      bold: true
    },
    // ... todos os outros campos da página 1
  },

  // Página 2
  page2: {
    nomeCompleto: { x: ???, y: ???, fontSize: 12 },
    cpf: { x: ???, y: ???, fontSize: 12 },
    rg: { x: ???, y: ???, fontSize: 10 },
    // ... todos os campos da página 2
  },

  // ... páginas 3-8
}
```

### 3. ESTRATÉGIAS ALTERNATIVAS

Se o mapeamento manual for muito complexo, sugira alternativas:

1. **Usar campos de formulário PDF** - O template tem campos editáveis que podemos preencher?
2. **OCR reverso** - Identificar texto existente e substituir?
3. **Biblioteca alternativa** - Existe uma biblioteca melhor que pdf-lib para isso?
4. **Geração do zero** - Seria melhor gerar o PDF do zero sem template?
5. **API de terceiros** - Usar serviço como DocuSign, Adobe Sign?

### 4. TESTES E VALIDAÇÃO

Forneça também:

1. **Código de teste** para validar cada coordenada
2. **Estratégia de debug visual** (desenhar retângulos coloridos nas coordenadas?)
3. **Função de ajuste fino** para pequenos ajustes sem recompilar

## 🆘 PROBLEMAS ATUAIS QUE ENFRENTAMOS

1. **Coordenadas incorretas** - Os textos aparecem fora do lugar ou sobrepostos
2. **Páginas diferentes** - Cada página tem layout diferente e não sabemos as coordenadas
3. **Fonte e tamanho** - Não sabemos o tamanho ideal da fonte para cada campo
4. **Alinhamento** - Alguns campos precisam estar alinhados à direita, outros centralizados
5. **Campos multi-linha** - Endereços e textos longos precisam quebrar linha
6. **Caracteres especiais** - Acentuação em português causa problemas

## 💡 INFORMAÇÕES TÉCNICAS ADICIONAIS

### Como estamos carregando o template:

```typescript
const templatePath = path.join(__dirname, '../templates/template_ccb.pdf');
const templateBytes = await fs.readFile(templatePath);
const pdfDoc = await PDFDocument.load(templateBytes);
const pages = pdfDoc.getPages();
const firstPage = pages[0];
const { width, height } = firstPage.getSize();
```

### Como estamos escrevendo texto:

```typescript
firstPage.drawText('Texto aqui', {
  x: 100, // coordenada X
  y: 700, // coordenada Y (de baixo para cima)
  size: 12, // tamanho da fonte
  font: helveticaFont, // fonte
  color: rgb(0, 0, 0), // cor preta
});
```

### Sistema de coordenadas:

- Origem (0,0) está no **canto inferior esquerdo**
- X aumenta para a **direita**
- Y aumenta para **cima** (não para baixo!)
- Medidas em **pontos** (72 pontos = 1 polegada)
- A4 = 595.276 x 841.890 pontos

## 🎯 RESULTADO ESPERADO

Precisamos que você nos forneça:

1. **Mapeamento completo** de TODAS as coordenadas
2. **Código pronto** para copiar e colar
3. **Instruções claras** de como implementar
4. **Soluções para problemas** conhecidos
5. **Testes para validar** que funciona

## 🚀 CONTEXTO URGENTE

Este é um sistema em produção que precisa gerar CCBs válidas legalmente. A precisão é CRÍTICA pois são documentos financeiros oficiais. Precisamos resolver isso HOJE para não atrasar os processos de crédito dos clientes.

Por favor, analise o PDF anexado e nos forneça a solução completa e definitiva. Temos todos os dados, temos o template, só precisamos saber EXATAMENTE onde colocar cada informação.

MUITO OBRIGADO PELA AJUDA! 🙏
