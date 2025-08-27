/**
 * 📋 SISTEMA COMPLETO DE MAPEAMENTO DE CAMPOS CCB
 * Baseado no template real Simpix e requerimentos completos de uma CCB bancária
 *
 * ROADMAP FORMALIZAÇÃO - COORDENADAS CCB ATUALIZADAS
 * Data: 2025-08-08
 */

export interface FieldPosition {
  x: number; // Posição horizontal
  y: number; // Posição vertical (origem no bottom-left do PDF)
  fontSize: number; // Tamanho da fonte
  fontWeight?: 'normal' | 'bold'; // Peso da fonte
  maxWidth?: number; // Largura máxima para quebra de linha
  alignment?: 'left' | 'center' | 'right'; // Alinhamento do texto
  color?: [number, number, number]; // Cor RGB (0-1)
  multiline?: boolean; // Permite múltiplas linhas
}

/**
 * MAPEAMENTO COMPLETO DE TODOS OS CAMPOS DA CCB
 * Organizados por seções conforme layout real do template
 */
export const CCB_COMPLETE_MAPPING = {
  // =====================================================
  // SEÇÃO 1: CABEÇALHO E IDENTIFICAÇÃO DO DOCUMENTO
  // =====================================================
  numeroCcb: {
    x: 450,
    y: 750,
    fontSize: 12,
    fontWeight: 'bold' as const,
    alignment: 'right' as const,
  },

  dataEmissao: {
    x: 450,
    y: 720,
    fontSize: 11,
    alignment: 'right' as const,
  },

  // =====================================================
  // SEÇÃO 2: DADOS DO DEVEDOR (PESSOA FÍSICA/JURÍDICA)
  // =====================================================

  // --- Pessoa Física ---
  devedorNome: {
    x: 120,
    y: 680,
    fontSize: 11,
    maxWidth: 400,
    fontWeight: 'normal' as const,
  },

  devedorCpf: {
    x: 120,
    y: 655,
    fontSize: 10,
  },

  devedorRg: {
    x: 280,
    y: 655,
    fontSize: 10,
  },

  devedorRgExpedidor: {
    x: 380,
    y: 655,
    fontSize: 10,
  },

  devedorNacionalidade: {
    x: 120,
    y: 630,
    fontSize: 10,
  },

  devedorEstadoCivil: {
    x: 250,
    y: 630,
    fontSize: 10,
  },

  devedorProfissao: {
    x: 380,
    y: 630,
    fontSize: 10,
  },

  // --- Endereço do Devedor ---
  devedorEndereco: {
    x: 120,
    y: 605,
    fontSize: 10,
    maxWidth: 200,
  },

  devedorNumero: {
    x: 320,
    y: 605,
    fontSize: 10,
  },

  devedorComplemento: {
    x: 380,
    y: 605,
    fontSize: 10,
  },

  devedorBairro: {
    x: 120,
    y: 580,
    fontSize: 10,
  },

  devedorCidade: {
    x: 280,
    y: 580,
    fontSize: 10,
  },

  devedorUf: {
    x: 420,
    y: 580,
    fontSize: 10,
  },

  devedorCep: {
    x: 450,
    y: 580,
    fontSize: 10,
  },

  devedorTelefone: {
    x: 120,
    y: 555,
    fontSize: 10,
  },

  devedorEmail: {
    x: 280,
    y: 555,
    fontSize: 10,
    maxWidth: 200,
  },

  // --- Pessoa Jurídica (campos adicionais) ---
  devedorRazaoSocial: {
    x: 120,
    y: 680,
    fontSize: 11,
    maxWidth: 400,
    fontWeight: 'normal' as const,
  },

  devedorCnpj: {
    x: 120,
    y: 655,
    fontSize: 10,
  },

  devedorInscricaoEstadual: {
    x: 280,
    y: 655,
    fontSize: 10,
  },

  // =====================================================
  // SEÇÃO 3: DADOS DO CRÉDITO E CONDIÇÕES FINANCEIRAS
  // =====================================================

  valorPrincipal: {
    x: 200,
    y: 480,
    fontSize: 12,
    fontWeight: 'bold' as const,
    alignment: 'right' as const,
  },

  valorPrincipalExtenso: {
    x: 120,
    y: 455,
    fontSize: 10,
    maxWidth: 400,
    multiline: true,
  },

  dataVencimento: {
    x: 350,
    y: 480,
    fontSize: 11,
  },

  jurosAoMes: {
    x: 200,
    y: 430,
    fontSize: 11,
    alignment: 'right' as const,
  },

  jurosAoAno: {
    x: 350,
    y: 430,
    fontSize: 11,
  },

  multa: {
    x: 200,
    y: 405,
    fontSize: 11,
  },

  taxaAdministracao: {
    x: 350,
    y: 405,
    fontSize: 11,
  },

  iof: {
    x: 200,
    y: 380,
    fontSize: 11,
  },

  cetMensal: {
    x: 350,
    y: 380,
    fontSize: 11,
  },

  cetAnual: {
    x: 450,
    y: 380,
    fontSize: 11,
  },

  valorTotalFinanciado: {
    x: 200,
    y: 355,
    fontSize: 12,
    fontWeight: 'bold' as const,
    alignment: 'right' as const,
  },

  numeroParcelas: {
    x: 350,
    y: 355,
    fontSize: 11,
  },

  valorParcela: {
    x: 450,
    y: 355,
    fontSize: 11,
    alignment: 'right' as const,
  },

  formaPagamento: {
    x: 120,
    y: 330,
    fontSize: 10,
    maxWidth: 400,
  },

  // =====================================================
  // SEÇÃO 4: DADOS BANCÁRIOS (PIX ou Conta Bancária)
  // =====================================================

  // --- PIX ---
  pixChave: {
    x: 120,
    y: 280,
    fontSize: 10,
    maxWidth: 300,
  },

  pixTitular: {
    x: 120,
    y: 255,
    fontSize: 10,
    maxWidth: 300,
  },

  // --- Dados Bancários ---
  banco: {
    x: 120,
    y: 280,
    fontSize: 10,
  },

  agencia: {
    x: 280,
    y: 280,
    fontSize: 10,
  },

  conta: {
    x: 350,
    y: 280,
    fontSize: 10,
  },

  titularConta: {
    x: 120,
    y: 255,
    fontSize: 10,
    maxWidth: 300,
  },

  // =====================================================
  // SEÇÃO 5: DADOS DO CREDOR
  // =====================================================

  credorNome: {
    x: 120,
    y: 200,
    fontSize: 11,
    fontWeight: 'bold' as const,
    maxWidth: 300,
  },

  credorCnpj: {
    x: 120,
    y: 175,
    fontSize: 10,
  },

  credorEndereco: {
    x: 280,
    y: 175,
    fontSize: 10,
    maxWidth: 200,
  },

  // =====================================================
  // SEÇÃO 6: ASSINATURAS E TESTEMUNHAS
  // =====================================================

  localAssinatura: {
    x: 120,
    y: 120,
    fontSize: 10,
  },

  dataAssinatura: {
    x: 280,
    y: 120,
    fontSize: 10,
  },

  testemunha1Nome: {
    x: 120,
    y: 80,
    fontSize: 9,
  },

  testemunha1Cpf: {
    x: 120,
    y: 65,
    fontSize: 9,
  },

  testemunha2Nome: {
    x: 320,
    y: 80,
    fontSize: 9,
  },

  testemunha2Cpf: {
    x: 320,
    y: 65,
    fontSize: 9,
  },

  // =====================================================
  // SEÇÃO 7: OBSERVAÇÕES E CLÁUSULAS ESPECIAIS
  // =====================================================

  observacoes: {
    x: 120,
    y: 300,
    fontSize: 9,
    maxWidth: 400,
    multiline: true,
  },
} as const;

/**
 * UTILITÁRIOS PARA MANIPULAÇÃO DE COORDENADAS
 */

/**
 * Converte coordenadas Y baseadas na altura do topo da página
 * (mais intuitivo para posicionamento visual)
 */
export function yFromTop(pageHeight: number, pixelsFromTop: number): number {
  return pageHeight - pixelsFromTop;
}

/**
 * Aplica escala nas coordenadas (útil para diferentes tamanhos de template)
 */
export function scaleCoordinates(position: FieldPosition, scale: number): FieldPosition {
  return {
    ...position,
    x: position.x * scale,
    y: position.y * scale,
    fontSize: position.fontSize * scale,
    maxWidth: position.maxWidth ? position.maxWidth * scale : undefined,
  };
}

/**
 * Aplica offset global em todas as coordenadas
 */
export function offsetCoordinates(
  position: FieldPosition,
  offsetX: number,
  offsetY: number
): FieldPosition {
  return {
    ...position,
    x: position.x + offsetX,
    y: position.y + offsetY,
  };
}

/**
 * Formatação inteligente de valores monetários para CCB
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Converte número para extenso (para valor principal)
 */
export function numberToWords(value: number): string {
  // Implementação básica - pode ser expandida com biblioteca específica
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezenas = [
    '',
    '',
    'vinte',
    'trinta',
    'quarenta',
    'cinquenta',
    'sessenta',
    'setenta',
    'oitenta',
    'noventa',
  ];
  const centenas = [
    '',
    'cem',
    'duzentos',
    'trezentos',
    'quatrocentos',
    'quinhentos',
    'seiscentos',
    'setecentos',
    'oitocentos',
    'novecentos',
  ];

  // Implementação simplificada - retorna apenas o valor formatado
  // Em produção, usar biblioteca como 'extenso' ou similar
  return `${formatCurrency(value)} (${Math.floor(value)} reais)`;
}

/**
 * PRESETS DE AJUSTES COMUNS
 */
export const COORDINATE_PRESETS = {
  // Move todos os campos principais 10px para direita
  adjustRight: {
    offsetX: 10,
    offsetY: 0,
  },

  // Move todos os campos principais 20px para baixo
  adjustDown: {
    offsetX: 0,
    offsetY: -20,
  },

  // Aumenta fonte de todos os campos em 1pt
  increaseFontSize: {
    fontSizeAdjustment: 1,
  },

  // Template para impressora com margem diferente
  printerOffset: {
    offsetX: 15,
    offsetY: 10,
  },
} as const;
