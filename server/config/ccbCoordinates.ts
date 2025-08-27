/**
 * FASE 3: Estrutura de Mapeamento de Coordenadas da CCB
 * Baseado na resposta da IA externa
 *
 * IMPORTANTE: Todos os valores X e Y são PLACEHOLDERS (0).
 * Use o PDF de DEBUG (generateCoordinateGridPDF) para preencher com valores reais.
 */

export interface FieldCoordinate {
  x: number;
  y: number;
  fontSize: number;
  bold?: boolean;
  maxWidth?: number; // Essencial para campos multi-linha (endereços, descrições)
  align?: 'left' | 'center' | 'right'; // Alinhamento do texto
}

// Padrões de Fonte
const _FN = 10; // Fonte Normal
const _FL = 12; // Fonte Grande
const _FT = 14; // Fonte Título
const _FG = 16; // Fonte Grande (destaque)

// ATENÇÃO: TODOS OS VALORES X e Y SÃO PLACEHOLDERS (0).
// USE O PDF DE DEBUG (FASE 2) PARA PREENCHER COM VALORES REAIS.

export const CCB_FIELD_COORDINATES: Record<string, Record<string, FieldCoordinate>> = {
  // PÁGINA 1 - CAPA E IDENTIFICAÇÃO
  page1: {
    numeroCCB: { x: 450, y: 750, fontSize: FL, bold: true, align: 'right' },
    dataEmissao: { x: 450, y: 730, fontSize: FN, align: 'right' },
    nomeCliente: { x: 297, y: 400, fontSize: FT, bold: true, align: 'center' },
    cpfCliente: { x: 297, y: 380, fontSize: FL, align: 'center' },
    valorTotalFinanciado: { x: 297, y: 350, fontSize: FG, bold: true, align: 'center' },
    quantidadeParcelas: { x: 297, y: 330, fontSize: FL, align: 'center' },
    valorParcela: { x: 297, y: 310, fontSize: FL, align: 'center' },
  },

  // PÁGINA 2 - QUALIFICAÇÃO DO EMITENTE
  page2: {
    nomeCompleto: { x: 150, y: 700, fontSize: FN },
    cpf: { x: 150, y: 680, fontSize: FN },
    rg_orgao: { x: 150, y: 660, fontSize: FN }, // Combine RG e Órgão Expedidor
    dataNascimento: { x: 150, y: 640, fontSize: FN },
    estadoCivil: { x: 150, y: 620, fontSize: FN },
    nomeConjuge: { x: 150, y: 600, fontSize: FN }, // Condicional
    cpfConjuge: { x: 150, y: 580, fontSize: FN }, // Condicional
    profissao: { x: 150, y: 560, fontSize: FN },
    // Use maxWidth para endereços longos
    enderecoResidencial: { x: 150, y: 540, fontSize: FN, maxWidth: 400 },
    cep: { x: 150, y: 500, fontSize: FN },
    telefoneCelular: { x: 150, y: 480, fontSize: FN },
    email: { x: 150, y: 460, fontSize: FN },

    // Dados profissionais
    empresa: { x: 150, y: 420, fontSize: FN },
    cargo: { x: 150, y: 400, fontSize: FN },
    rendaMensal: { x: 150, y: 380, fontSize: FN },

    // Referências
    referencia1Nome: { x: 150, y: 340, fontSize: FN },
    referencia1Telefone: { x: 350, y: 340, fontSize: FN },
    referencia2Nome: { x: 150, y: 320, fontSize: FN },
    referencia2Telefone: { x: 350, y: 320, fontSize: FN },
  },

  // PÁGINA 3 - DADOS DO CRÉDITO
  page3: {
    valorPrincipal: { x: 200, y: 700, fontSize: FL, bold: true },
    taxaJurosMensal: { x: 200, y: 680, fontSize: FN },
    taxaJurosAnual: { x: 400, y: 680, fontSize: FN },
    cetMensal: { x: 200, y: 660, fontSize: FN },
    cetAnual: { x: 400, y: 660, fontSize: FN },
    iof: { x: 200, y: 640, fontSize: FN },
    tac: { x: 400, y: 640, fontSize: FN },
    seguro: { x: 200, y: 620, fontSize: FN },
    valorTotalEncargos: { x: 200, y: 600, fontSize: FL, bold: true },
    valorTotalPagar: { x: 200, y: 580, fontSize: FG, bold: true },

    formaPagamento: { x: 200, y: 540, fontSize: FN },
    quantidadeParcelas: { x: 200, y: 520, fontSize: FL, bold: true },
    valorParcela: { x: 400, y: 520, fontSize: FL, bold: true },
    primeiroVencimento: { x: 200, y: 500, fontSize: FN },
    ultimoVencimento: { x: 400, y: 500, fontSize: FN },
    diaVencimento: { x: 200, y: 480, fontSize: FN },

    // Tabela comercial
    tabelaComercial: { x: 200, y: 440, fontSize: FN },
    codigoTabela: { x: 400, y: 440, fontSize: FN },
  },

  // PÁGINA 4 - CONDIÇÕES GERAIS (geralmente texto padrão, mas pode ter campos)
  page4: {
    // Campos dinâmicos dentro do texto de condições
    taxaJurosRepete: { x: 250, y: 600, fontSize: FN, bold: true },
    multaAtraso: { x: 250, y: 580, fontSize: FN, bold: true },
    jurosMora: { x: 250, y: 560, fontSize: FN, bold: true },
  },

  // PÁGINA 5 - GARANTIAS (Condicional - só preencher se houver garantia)
  page5: {
    tipoGarantia: { x: 150, y: 700, fontSize: FL, bold: true },
    descricaoBem: { x: 150, y: 680, fontSize: FN, maxWidth: 400 },
    valorBem: { x: 150, y: 640, fontSize: FL, bold: true },

    // Se for veículo
    marcaModelo: { x: 150, y: 620, fontSize: FN },
    anoFabricacao: { x: 150, y: 600, fontSize: FN },
    placa: { x: 350, y: 600, fontSize: FN },
    chassi: { x: 150, y: 580, fontSize: FN },
    renavam: { x: 350, y: 580, fontSize: FN },
  },

  // PÁGINA 6 - DECLARAÇÕES (geralmente texto padrão com alguns campos)
  page6: {
    nomeDeclarante: { x: 200, y: 400, fontSize: FN, bold: true },
    cpfDeclarante: { x: 200, y: 380, fontSize: FN },
    dataDeclaracao: { x: 200, y: 360, fontSize: FN },
  },

  // PÁGINA 7 - AUTORIZAÇÃO DE DÉBITO
  page7: {
    banco: { x: 200, y: 650, fontSize: FN },
    agencia: { x: 200, y: 630, fontSize: FN },
    contaCorrente: { x: 400, y: 630, fontSize: FN },
    tipoConta: { x: 200, y: 610, fontSize: FN },

    valorParcelaDebito: { x: 200, y: 570, fontSize: FL, bold: true },
    diaVencimentoDebito: { x: 400, y: 570, fontSize: FL, bold: true },

    // Dados do pagamento
    formaPagamentoEscolhida: { x: 200, y: 530, fontSize: FN },

    // Se for boleto
    codigoBarras: { x: 100, y: 480, fontSize: 8, maxWidth: 400 },
    linhaDigitavel: { x: 100, y: 460, fontSize: 8, maxWidth: 400 },

    // Se for PIX
    chavePix: { x: 200, y: 440, fontSize: FN },
    qrCodePix: { x: 200, y: 420, fontSize: 8, maxWidth: 200 },
  },

  // PÁGINA 8 - ASSINATURAS
  page8: {
    localEData: { x: 100, y: 700, fontSize: FN },

    // Linha de assinatura do Emitente (cliente)
    linhaAssinaturaEmitente: { x: 100, y: 600, fontSize: 1 }, // Linha visual
    nomeEmitenteAssinatura: { x: 100, y: 580, fontSize: FN },
    cpfEmitenteAssinatura: { x: 100, y: 565, fontSize: 9 },

    // Linha de assinatura do Cônjuge (se aplicável)
    linhaAssinaturaConjuge: { x: 350, y: 600, fontSize: 1 },
    nomeConjugeAssinatura: { x: 350, y: 580, fontSize: FN },
    cpfConjugeAssinatura: { x: 350, y: 565, fontSize: 9 },

    // Testemunha 1
    linhaAssinaturaTestemunha1: { x: 100, y: 480, fontSize: 1 },
    nomeTestemunha1: { x: 100, y: 460, fontSize: FN },
    cpfTestemunha1: { x: 100, y: 445, fontSize: 9 },

    // Testemunha 2
    linhaAssinaturaTestemunha2: { x: 350, y: 480, fontSize: 1 },
    nomeTestemunha2: { x: 350, y: 460, fontSize: FN },
    cpfTestemunha2: { x: 350, y: 445, fontSize: 9 },

    // Credor (Simpix)
    linhaAssinaturaCredor: { x: 225, y: 360, fontSize: 1 },
    razaoSocialCredor: { x: 225, y: 340, fontSize: FN, align: 'center' },
    cnpjCredor: { x: 225, y: 325, fontSize: 9, align: 'center' },

    // Código de verificação e protocolo (assinatura eletrônica)
    codigoVerificacao: { x: 100, y: 250, fontSize: 9 },
    protocoloAssinatura: { x: 300, y: 250, fontSize: 9 },
    hashDocumento: { x: 100, y: 235, fontSize: 8, maxWidth: 400 },
    dataHoraAssinatura: { x: 100, y: 220, fontSize: 9 },
    ipAssinatura: { x: 300, y: 220, fontSize: 9 },
  },
};

/**
 * Função auxiliar para obter coordenadas de um campo específico
 */
export function getFieldCoordinate(page: string, field: string): FieldCoordinate | null {
  const _pageCoords = CCB_FIELD_COORDINATES[page];
  if (!pageCoords) return null; }

  return pageCoords[field] || null; }
}

/**
 * Função para converter coordenadas do topo para base (Y invertido)
 */
export function yFromTop(pageHeight: number, pixelsFromTop: number): number {
  return pageHeight - pixelsFromTop; }
}

/**
 * Configuração de páginas padrão A4
 */
export const A4_CONFIG = {
  width: 595.276, // pontos
  height: 841.89, // pontos
};

/**
 * Mapeamento de campos de dados para campos do template
 * Relaciona os dados que vêm do sistema com as posições no PDF
 */
export const DATA_TO_FIELD_MAPPING = {
  // Página 1
  numero_ccb: 'numeroCCB',
  data_emissao: 'dataEmissao',
  'cliente_data.nome_completo': 'nomeCliente',
  'cliente_data.cpf': 'cpfCliente',
  'condicoes_data.valor_financiado_formatado': 'valorTotalFinanciado',
  'condicoes_data.prazo_meses': 'quantidadeParcelas',
  'condicoes_data.valor_parcela_formatado': 'valorParcela',

  // Página 2
  'cliente_data.rg': 'rg_orgao',
  'cliente_data.data_nascimento': 'dataNascimento',
  'cliente_data.estado_civil': 'estadoCivil',
  'cliente_data.nome_conjuge': 'nomeConjuge',
  'cliente_data.cpf_conjuge': 'cpfConjuge',
  'cliente_data.profissao': 'profissao',
  'calculados.endereco_completo_cliente': 'enderecoResidencial',
  'cliente_data.cep': 'cep',
  'cliente_data.telefone_celular': 'telefoneCelular',
  'cliente_data.email': 'email',

  // ... mapear todos os outros campos
};
