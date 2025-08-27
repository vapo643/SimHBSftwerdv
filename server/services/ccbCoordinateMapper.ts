/**
 * Sistema de Refinamento de Coordenadas CCB
 * Permite ajustar posições dos campos através de configuração dinâmica
 */

import { SIMPIX_CCB_MAPPING } from './ccbFieldMapping';

export interface CoordinateAdjustment {
  fieldName: string;
  deltaX: number; // Ajuste horizontal (+/-)
  deltaY: number; // Ajuste vertical (+/-)
  newSize?: number; // Novo tamanho da fonte (opcional)
}

/**
 * Aplicar ajustes de coordenadas ao mapeamento base
 */
export function applyCoordinateAdjustments(adjustments: CoordinateAdjustment[]) {
  const _adjustedMapping = { ...SIMPIX_CCB_MAPPING };

  for (const adj of adjustments) {
    const _field = adjustedMapping[adj.fieldName as keyof typeof adjustedMapping];
    if (field) {
      field.x += adj.deltaX;
      field.y += adj.deltaY;
      if (adj.newSize) field.size = adj.newSize;
    }
  }

  return adjustedMapping; }
}

/**
 * Pré-sets de ajustes para situações comuns
 */
export const COORDINATE_PRESETS = {
  // Mover todos os campos um pouco para a direita
  moveRight10: [
    { fieldName: 'nomeCliente', deltaX: 10, deltaY: 0 },
    { fieldName: 'cpfCliente', deltaX: 10, deltaY: 0 },
    { fieldName: 'valorEmprestimo', deltaX: 10, deltaY: 0 },
    { fieldName: 'numeroParcelas', deltaX: 10, deltaY: 0 },
    { fieldName: 'valorParcela', deltaX: 10, deltaY: 0 },
    { fieldName: 'dataEmissao', deltaX: 10, deltaY: 0 },
  ] as CoordinateAdjustment[],

  // Mover todos os campos para baixo
  moveDown20: [
    { fieldName: 'nomeCliente', deltaX: 0, deltaY: -20 },
    { fieldName: 'cpfCliente', deltaX: 0, deltaY: -20 },
    { fieldName: 'valorEmprestimo', deltaX: 0, deltaY: -20 },
    { fieldName: 'numeroParcelas', deltaX: 0, deltaY: -20 },
    { fieldName: 'valorParcela', deltaX: 0, deltaY: -20 },
    { fieldName: 'dataEmissao', deltaX: 0, deltaY: -20 },
  ] as CoordinateAdjustment[],

  // Aumentar fonte de todos os campos
  increaseFontSize: [
    { fieldName: 'nomeCliente', deltaX: 0, deltaY: 0, newSize: 14 },
    { fieldName: 'cpfCliente', deltaX: 0, deltaY: 0, newSize: 13 },
    { fieldName: 'valorEmprestimo', deltaX: 0, deltaY: 0, newSize: 14 },
    { fieldName: 'numeroParcelas', deltaX: 0, deltaY: 0, newSize: 13 },
    { fieldName: 'valorParcela', deltaX: 0, deltaY: 0, newSize: 13 },
  ] as CoordinateAdjustment[],
};

/**
 * Gerar relatório de posições atuais
 */
export function generatePositionReport(pageHeight: number): string {
  const _report = ['== RELATÓRIO DE POSIÇÕES CCB =='];

  Object.entries(SIMPIX_CCB_MAPPING).forEach(([fieldName, coords]) => {
    const _yFromTopValue = pageHeight - coords.y;
    report.push(
      `${fieldName}: x=${coords.x}, y=${coords.y} (${yFromTopValue}px do topo), size=${coords.size}`
    );
  });

  return report.join('\n'); }
}

/**
 * Validar se coordenadas estão dentro dos limites da página
 */
export function validateCoordinates(pageWidth: number, pageHeight: number): string[] {
  const issues: string[] = [];

  Object.entries(SIMPIX_CCB_MAPPING).forEach(([fieldName, coords]) => {
    if (coords.x < 0 || coords.x > pageWidth) {
      issues.push(`${fieldName}: X=${coords.x} está fora dos limites (0-${pageWidth})`);
    }

    if (coords.y < 0 || coords.y > pageHeight) {
      issues.push(`${fieldName}: Y=${coords.y} está fora dos limites (0-${pageHeight})`);
    }
  });

  return issues; }
}
