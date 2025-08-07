/**
 * Debugger de Coordenadas CCB
 * Ajuda a entender e calibrar o posicionamento correto dos campos
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

export interface CoordinateTest {
  fieldName: string;
  x: number;
  y: number;
  testText: string;
  referenceType: 'center' | 'left' | 'right' | 'top-left' | 'bottom-left';
}

/**
 * SISTEMAS DE COORDENADAS NO PDF:
 * 
 * 1. PDF NATIVO: Origem (0,0) no CANTO INFERIOR ESQUERDO
 *    - Y cresce PARA CIMA
 *    - X cresce para a direita
 * 
 * 2. COORDENADAS VISUAIS: Como você vê na tela
 *    - Origem (0,0) no CANTO SUPERIOR ESQUERDO  
 *    - Y cresce PARA BAIXO
 *    - X cresce para a direita
 * 
 * 3. TIPOS DE REFERÊNCIA:
 *    - 'center': Coordenada é o CENTRO do campo
 *    - 'left': Coordenada é onde o texto COMEÇA (esquerda)
 *    - 'right': Coordenada é onde o texto TERMINA (direita)
 *    - 'top-left': Coordenada é o canto superior esquerdo do campo
 *    - 'bottom-left': Coordenada é o canto inferior esquerdo do campo
 */

export class CCBCoordinateDebugger {
  private templatePath: string;

  constructor() {
    this.templatePath = path.join(process.cwd(), 'server', 'templates', 'template_ccb.pdf');
  }

  /**
   * Gera PDF de teste com diferentes interpretações de coordenadas
   */
  async testCoordinateInterpretations(
    x: number, 
    y: number, 
    testText: string = "TESTE",
    page: number = 1
  ): Promise<Buffer> {
    console.log(`🧪 [COORD DEBUG] Testando coordenada (${x}, ${y}) na página ${page}`);

    const templateBytes = await fs.readFile(this.templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const pages = pdfDoc.getPages();
    const targetPage = pages[page - 1];
    const { height } = targetPage.getSize();

    // Converter Y visual para Y PDF se necessário
    const pdfY = height - y; // Se Y foi medido do topo, converter para PDF
    
    console.log(`🧪 [COORD DEBUG] Conversões: Visual Y=${y} → PDF Y=${pdfY}`);

    // 1. MARCA ORIGINAL (ponto exato que foi clicado)
    targetPage.drawCircle({
      x: x,
      y: pdfY,
      size: 3,
      color: rgb(1, 0, 0), // Vermelho
      opacity: 0.8
    });

    // 2. TEXTO ALINHADO À ESQUERDA (coordenada = início do texto)
    targetPage.drawText(`${testText} (LEFT)`, {
      x: x,
      y: pdfY + 15,
      size: 10,
      font: font,
      color: rgb(0, 0, 1) // Azul
    });

    // 3. TEXTO CENTRALIZADO (coordenada = centro do texto)
    const textWidth = font.widthOfTextAtSize(`${testText} (CENTER)`, 10);
    targetPage.drawText(`${testText} (CENTER)`, {
      x: x - (textWidth / 2),
      y: pdfY,
      size: 10,
      font: font,
      color: rgb(0, 0.5, 0) // Verde escuro
    });

    // 4. TEXTO ALINHADO À DIREITA (coordenada = fim do texto)  
    const rightTextWidth = font.widthOfTextAtSize(`${testText} (RIGHT)`, 10);
    targetPage.drawText(`${testText} (RIGHT)`, {
      x: x - rightTextWidth,
      y: pdfY - 15,
      size: 10,
      font: font,
      color: rgb(0.5, 0, 0.5) // Roxo
    });

    // 5. GRID DE REFERÊNCIA (cruz centrada no ponto)
    // Linha horizontal
    targetPage.drawLine({
      start: { x: x - 20, y: pdfY },
      end: { x: x + 20, y: pdfY },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.5
    });
    // Linha vertical
    targetPage.drawLine({
      start: { x: x, y: pdfY - 20 },
      end: { x: x, y: pdfY + 20 },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.5
    });

    // 6. LEGENDA
    targetPage.drawText(`Coord: (${x}, ${y})`, {
      x: x + 30,
      y: pdfY + 10,
      size: 8,
      font: font,
      color: rgb(0, 0, 0)
    });

    targetPage.drawText(`PDF Y: ${pdfY.toFixed(1)}`, {
      x: x + 30,
      y: pdfY - 5,
      size: 8,
      font: font,
      color: rgb(0, 0, 0)
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Testa múltiplas coordenadas de uma vez
   */
  async testMultipleCoordinates(coordinates: CoordinateTest[]): Promise<Buffer> {
    console.log(`🧪 [COORD DEBUG] Testando ${coordinates.length} coordenadas`);

    const templateBytes = await fs.readFile(this.templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    const pages = pdfDoc.getPages();
    const { height } = pages[0].getSize();

    for (const coord of coordinates) {
      const page = pages[0]; // Sempre página 1 para este teste
      const pdfY = height - coord.y;

      // Marca o ponto
      page.drawCircle({
        x: coord.x,
        y: pdfY,
        size: 4,
        color: rgb(1, 0, 0),
        opacity: 0.7
      });

      // Desenha o texto baseado no tipo de referência
      let textX = coord.x;
      
      if (coord.referenceType === 'center') {
        const textWidth = font.widthOfTextAtSize(coord.testText, 10);
        textX = coord.x - (textWidth / 2);
      } else if (coord.referenceType === 'right') {
        const textWidth = font.widthOfTextAtSize(coord.testText, 10);
        textX = coord.x - textWidth;
      }

      page.drawText(coord.testText, {
        x: textX,
        y: pdfY,
        size: 10,
        font: font,
        color: rgb(0, 0, 0.8)
      });

      // Label do campo
      page.drawText(`[${coord.fieldName}]`, {
        x: coord.x + 5,
        y: pdfY - 12,
        size: 7,
        font: font,
        color: rgb(0.6, 0.6, 0.6)
      });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Converte coordenadas visuais (topo = 0) para coordenadas PDF (base = 0)
   */
  convertVisualToPDF(visualY: number, pageHeight: number = 842.25): number {
    return pageHeight - visualY;
  }

  /**
   * Converte coordenadas PDF (base = 0) para coordenadas visuais (topo = 0)
   */
  convertPDFToVisual(pdfY: number, pageHeight: number = 842.25): number {
    return pageHeight - pdfY;
  }

  /**
   * Calcula posição X baseada no alinhamento
   */
  calculateTextX(
    referenceX: number, 
    text: string, 
    fontSize: number, 
    font: any, 
    alignment: 'left' | 'center' | 'right'
  ): number {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    
    switch (alignment) {
      case 'center':
        return referenceX - (textWidth / 2);
      case 'right':
        return referenceX - textWidth;
      case 'left':
      default:
        return referenceX;
    }
  }
}

export default CCBCoordinateDebugger;