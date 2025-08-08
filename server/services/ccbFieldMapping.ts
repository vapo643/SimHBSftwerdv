// Sistema de Mapeamento de Coordenadas para CCB Template SIMPIX
// Coordenadas baseadas no template real: CCB SIMPIX (1)_1754063031025.pdf

interface FieldCoordinates {
  x: number;
  y: number;
  size: number;
  maxWidth?: number; // Para quebra de linha automática
}

interface CCBFieldMapping {
  // Dados do Cliente
  nomeCliente: FieldCoordinates;
  cpfCliente: FieldCoordinates;
  rgCliente: FieldCoordinates;
  enderecoCliente: FieldCoordinates;

  // Dados do Empréstimo
  valorEmprestimo: FieldCoordinates;
  numeroParcelas: FieldCoordinates;
  valorParcela: FieldCoordinates;
  dataVencimento: FieldCoordinates;

  // Dados da Empresa
  nomeEmpresa: FieldCoordinates;
  cnpjEmpresa: FieldCoordinates;

  // Campos de Data
  dataEmissao: FieldCoordinates;
  localEmissao: FieldCoordinates;
}

/**
 * Mapeamento inicial de coordenadas para o template SIMPIX
 * NOTA: Essas coordenadas são estimativas baseadas no layout padrão de CCB
 * Devem ser refinadas com base no feedback visual do PDF gerado
 */
export const SIMPIX_CCB_MAPPING: CCBFieldMapping = {
  // === SEÇÃO SUPERIOR - DADOS DO DEVEDOR ===
  nomeCliente: {
    x: 120, // Após o texto "Nome:"
    y: 680, // Parte superior do documento
    size: 12,
    maxWidth: 400,
  },

  cpfCliente: {
    x: 120, // Após o texto "CPF:"
    y: 655, // Logo abaixo do nome
    size: 11,
  },

  rgCliente: {
    x: 320, // Lado direito, após "RG:"
    y: 655, // Mesma linha do CPF
    size: 11,
  },

  enderecoCliente: {
    x: 120, // Após o texto "Endereço:"
    y: 630, // Abaixo dos documentos
    size: 10,
    maxWidth: 450,
  },

  // === SEÇÃO CENTRAL - DADOS DO EMPRÉSTIMO ===
  valorEmprestimo: {
    x: 200, // Após "Valor do empréstimo: R$"
    y: 580, // Centro do documento
    size: 12,
  },

  numeroParcelas: {
    x: 180, // Após "Número de parcelas:"
    y: 555, // Abaixo do valor
    size: 11,
  },

  valorParcela: {
    x: 200, // Após "Valor da parcela: R$"
    y: 530, // Abaixo das parcelas
    size: 11,
  },

  dataVencimento: {
    x: 220, // Após "Primeiro vencimento:"
    y: 505, // Abaixo do valor da parcela
    size: 11,
  },

  // === SEÇÃO INFERIOR - DADOS DA EMPRESA ===
  nomeEmpresa: {
    x: 120, // Após "Credor:"
    y: 450, // Seção inferior
    size: 11,
    maxWidth: 300,
  },

  cnpjEmpresa: {
    x: 120, // Após "CNPJ:"
    y: 425, // Abaixo do nome da empresa
    size: 11,
  },

  // === SEÇÃO DE RODAPÉ - DATAS ===
  dataEmissao: {
    x: 100, // Local da data
    y: 150, // Parte inferior
    size: 10,
  },

  localEmissao: {
    x: 300, // Local da assinatura
    y: 150, // Mesma linha da data
    size: 10,
  },
};

/**
 * Coordenadas para testes visuais (texto grande e colorido)
 * Usado durante o desenvolvimento para identificar posições
 */
export const TEST_COORDINATES = {
  testTitle: {
    x: 50,
    y: 750,
    size: 24,
    color: [1, 0, 0] as [number, number, number], // Vermelho
  },

  testData: {
    x: 50,
    y: 700,
    size: 16,
    color: [0, 0.5, 0] as [number, number, number], // Verde
  },
};

/**
 * Utilitário para converter coordenadas baseadas em altura da página
 * @param pageHeight Altura total da página
 * @param yFromTop Distância do topo da página
 */
export function yFromTop(pageHeight: number, yFromTop: number): number {
  return pageHeight - yFromTop;
}

/**
 * Utilitário para formatar texto com quebra de linha
 * @param text Texto a ser formatado
 * @param maxWidth Largura máxima em caracteres (aproximado)
 */
export function formatTextWithLineBreaks(text: string, maxWidth: number = 50): string {
  if (text.length <= maxWidth) return text;

  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).length <= maxWidth) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.join("\n");
}
