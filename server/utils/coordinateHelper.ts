/**
 * Utilitários para ajudar no mapeamento e teste de coordenadas CCB
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "pdf-lib";
import fs from "fs/promises";
import path from "path";

/**
 * Converte coordenadas do topo da página para o sistema de coordenadas PDF (base)
 */
export function yFromTop(pageHeight: number, pixelsFromTop: number): number {
  return pageHeight - pixelsFromTop;
}

/**
 * Converte polegadas para pontos
 */
export function inchesToPoints(inches: number): number {
  return inches * 72;
}

/**
 * Converte pontos para polegadas
 */
export function pointsToInches(points: number): number {
  return points / 72;
}

/**
 * Desenha uma cruz de referência em uma coordenada específica
 */
export function drawCrosshair(
  page: PDFPage,
  x: number,
  y: number,
  size: number = 10,
  color = rgb(1, 0, 0)
) {
  // Linha horizontal
  page.drawLine({
    start: { x: x - size, y: y },
    end: { x: x + size, y: y },
    thickness: 1,
    color: color,
  });

  // Linha vertical
  page.drawLine({
    start: { x: x, y: y - size },
    end: { x: x, y: y + size },
    thickness: 1,
    color: color,
  });
}

/**
 * Adiciona uma etiqueta com coordenadas em uma posição específica
 */
export function addCoordinateLabel(
  page: PDFPage,
  x: number,
  y: number,
  font: PDFFont,
  label?: string
) {
  const text = label || `(${x.toFixed(0)}, ${y.toFixed(0)})`;

  page.drawText(text, {
    x: x + 15,
    y: y + 5,
    size: 8,
    font: font,
    color: rgb(0.8, 0, 0.8),
  });
}

/**
 * Calcula a largura de um texto com uma fonte específica
 */
export function getTextWidth(text: string, font: PDFFont, fontSize: number): number {
  return font.widthOfTextAtSize(text, fontSize);
}

/**
 * Calcula a posição X para texto centralizado
 */
export function getCenteredX(
  text: string,
  font: PDFFont,
  fontSize: number,
  pageWidth: number
): number {
  const textWidth = getTextWidth(text, font, fontSize);
  return (pageWidth - textWidth) / 2;
}

/**
 * Calcula a posição X para texto alinhado à direita
 */
export function getRightAlignedX(
  text: string,
  font: PDFFont,
  fontSize: number,
  rightMargin: number
): number {
  const textWidth = getTextWidth(text, font, fontSize);
  return rightMargin - textWidth;
}

/**
 * Gera um PDF de teste com coordenadas específicas marcadas
 */
export async function generateTestCoordinatesPDF(
  coordinates: Array<{
    page: number;
    x: number;
    y: number;
    label: string;
    text?: string;
    fontSize?: number;
    bold?: boolean;
  }>
) {
  const templatePath = path.resolve(process.cwd(), "server/templates/template_ccb.pdf");
  const outputPath = path.resolve(process.cwd(), "template_ccb_COORDINATE_TEST.pdf");

  const templateBytes = await fs.readFile(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();

  for (const coord of coordinates) {
    if (coord.page > 0 && coord.page <= pages.length) {
      const page = pages[coord.page - 1];

      // Desenhar cruz de referência
      drawCrosshair(page, coord.x, coord.y, 8, rgb(1, 0, 0));

      // Adicionar etiqueta
      addCoordinateLabel(page, coord.x, coord.y, fontRegular, coord.label);

      // Adicionar texto de teste se fornecido
      if (coord.text) {
        const font = coord.bold ? fontBold : fontRegular;
        const fontSize = coord.fontSize || 10;

        page.drawText(coord.text, {
          x: coord.x,
          y: coord.y,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0.8), // Azul para destacar
        });
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);

  console.log(`✅ PDF de teste de coordenadas gerado: ${outputPath}`);
  return outputPath;
}

/**
 * Valida se as coordenadas estão dentro dos limites da página
 */
export function validateCoordinates(
  x: number,
  y: number,
  pageWidth: number,
  pageHeight: number
): boolean {
  return x >= 0 && x <= pageWidth && y >= 0 && y <= pageHeight;
}

/**
 * Sugere coordenadas baseadas em regiões comuns do template
 */
export const COORDINATE_REGIONS = {
  // Página 1 - Capa
  HEADER_RIGHT: { x: 450, y: 750 }, // Número CCB, data
  CENTER_TITLE: { x: 297, y: 400 }, // Nome do cliente (centro)
  CENTER_INFO: { x: 297, y: 350 }, // Valores centralizados

  // Página 2 - Dados pessoais
  LEFT_COLUMN: { x: 100, y: 700 }, // Início dados pessoais
  RIGHT_COLUMN: { x: 350, y: 700 }, // Segunda coluna

  // Página 3 - Dados financeiros
  FINANCIAL_LEFT: { x: 150, y: 650 }, // Valores financeiros
  FINANCIAL_RIGHT: { x: 400, y: 650 }, // Valores à direita

  // Página 8 - Assinaturas
  SIGNATURE_LEFT: { x: 100, y: 400 }, // Assinatura cliente
  SIGNATURE_CENTER: { x: 297, y: 300 }, // Assinatura credor
  SIGNATURE_RIGHT: { x: 450, y: 400 }, // Segunda assinatura
};

/**
 * Converte pixels da tela para pontos PDF
 * Útil se você está medindo em uma tela com DPI específico
 */
export function screenPixelsToPoints(pixels: number, screenDPI: number = 96): number {
  return (pixels / screenDPI) * 72;
}

/**
 * Ajusta coordenadas para garantir que o texto não saia da margem
 */
export function adjustCoordinatesForMargins(
  x: number,
  y: number,
  textWidth: number,
  textHeight: number,
  pageWidth: number,
  pageHeight: number,
  margin: number = 20
): { x: number; y: number } {
  let adjustedX = Math.max(margin, Math.min(x, pageWidth - textWidth - margin));
  let adjustedY = Math.max(margin, Math.min(y, pageHeight - textHeight - margin));

  return { x: adjustedX, y: adjustedY };
}
