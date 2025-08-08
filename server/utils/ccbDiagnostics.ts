/**
 * Ferramentas de Diagnóstico para CCB Template
 * Baseado na resposta da IA externa - Missão Crítica
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import fs from "fs/promises";
import path from "path";

/**
 * FASE 1: Verifica se o template possui AcroForms (campos editáveis)
 * Se tiver, não precisamos mapear coordenadas manualmente!
 */
export async function diagnoseAcroForms() {
  console.log("🔍 Iniciando diagnóstico de AcroForms no template CCB...");
  const templatePath = path.resolve(process.cwd(), "server/templates/template_ccb.pdf");

  try {
    const templateBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);

    const form = pdfDoc.getForm();

    if (form && form.getFields().length > 0) {
      console.log("✅✅✅ SUCESSO! AcroForms detectados. ✅✅✅");
      console.log("Use os nomes abaixo para preencher. IGNORE AS FASES 2 e 3.");

      const fields: string[] = [];
      form.getFields().forEach(field => {
        const fieldName = field.getName();
        console.log(`- Nome do Campo: ${fieldName}`);
        fields.push(fieldName);
      });

      return { hasAcroForms: true, fields };
    } else {
      console.log("❌ NENHUM AcroForm detectado. Prossiga para a FASE 2 (Mapeamento Manual).");
      return { hasAcroForms: false, fields: [] };
    }
  } catch (error) {
    console.error(
      "⚠️ Erro ao analisar o PDF (pode ser XFA ou protegido). Prossiga para a FASE 2.",
      error
    );
    return { hasAcroForms: false, fields: [], error };
  }
}

/**
 * FASE 2: Gera um PDF com grade de coordenadas sobreposta
 * Para identificar visualmente onde colocar cada campo
 */
export async function generateCoordinateGridPDF() {
  const templatePath = path.resolve(process.cwd(), "server/templates/template_ccb.pdf");
  const outputPath = path.resolve(process.cwd(), "template_ccb_DEBUG_GRID.pdf");

  console.log("📐 Gerando PDF com grade de coordenadas...");

  const templateBytes = await fs.readFile(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const diagnosticFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Configurações da Grade para Máxima Precisão
  const majorGridSpacing = 50; // Linhas principais a cada 50 pontos
  const minorGridSpacing = 10; // Linhas secundárias a cada 10 pontos
  const gridColor = rgb(0.1, 0.7, 0.9); // Azul claro
  const textColor = rgb(0.8, 0, 0); // Vermelho

  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    // Título de Diagnóstico
    page.drawText(`DEBUG GRID - PÁG ${i + 1} (W:${width.toFixed(1)} H:${height.toFixed(1)})`, {
      x: 10,
      y: height - 20,
      size: 10,
      font: diagnosticFont,
      color: textColor,
      opacity: 0.7,
    });

    // Linhas Verticais (X)
    for (let x = 0; x < width; x += minorGridSpacing) {
      const isMajor = x % majorGridSpacing === 0;
      page.drawLine({
        start: { x: x, y: 0 },
        end: { x: x, y: height },
        thickness: isMajor ? 0.5 : 0.2,
        color: gridColor,
        opacity: 0.5,
      });

      if (isMajor && x !== 0) {
        page.drawText(`X:${x}`, {
          x: x + 2,
          y: 10,
          size: 8,
          color: textColor,
          opacity: 0.7,
        });

        // Adicionar coordenadas no topo também
        page.drawText(`X:${x}`, {
          x: x + 2,
          y: height - 30,
          size: 8,
          color: textColor,
          opacity: 0.7,
        });
      }
    }

    // Linhas Horizontais (Y)
    for (let y = 0; y < height; y += minorGridSpacing) {
      const isMajor = y % majorGridSpacing === 0;
      page.drawLine({
        start: { x: 0, y: y },
        end: { x: width, y: y },
        thickness: isMajor ? 0.5 : 0.2,
        color: gridColor,
        opacity: 0.5,
      });

      if (isMajor && y !== 0) {
        page.drawText(`Y:${y}`, {
          x: 10,
          y: y + 2,
          size: 8,
          color: textColor,
          opacity: 0.7,
        });

        // Adicionar coordenadas na direita também
        page.drawText(`Y:${y}`, {
          x: width - 35,
          y: y + 2,
          size: 8,
          color: textColor,
          opacity: 0.7,
        });
      }
    }

    // Adicionar pontos de referência importantes
    const referencePoints = [
      { name: "Centro", x: width / 2, y: height / 2 },
      { name: "TopLeft", x: 0, y: height },
      { name: "TopRight", x: width, y: height },
      { name: "BottomLeft", x: 0, y: 0 },
      { name: "BottomRight", x: width, y: 0 },
    ];

    for (const point of referencePoints) {
      page.drawCircle({
        x: point.x,
        y: point.y,
        size: 3,
        color: rgb(1, 0, 0),
        opacity: 0.8,
      });

      page.drawText(`${point.name}(${point.x.toFixed(0)},${point.y.toFixed(0)})`, {
        x: point.x + 5,
        y: point.y + 5,
        size: 6,
        font: diagnosticFont,
        color: rgb(1, 0, 0),
        opacity: 0.8,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);
  console.log(`✅ PDF de Debug gerado: ${outputPath}`);
  console.log(`📋 Instruções:`);
  console.log(`   1. Baixe o arquivo: ${outputPath}`);
  console.log(`   2. Abra no seu visualizador de PDF`);
  console.log(`   3. Use o zoom para identificar as coordenadas exatas de cada campo`);
  console.log(`   4. Anote as coordenadas X,Y onde cada texto deve ser inserido`);

  return outputPath;
}

/**
 * Função auxiliar para desenhar texto alinhado à direita
 */
export function drawTextRightAligned(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: PDFFont
) {
  const textWidth = font.widthOfTextAtSize(text, size);
  const x = rightX - textWidth; // Calcula o ponto de início X

  page.drawText(text, {
    x: x,
    y: y,
    size: size,
    font: font,
    color: rgb(0, 0, 0),
  });
}

/**
 * Função auxiliar para desenhar texto centralizado
 */
export function drawTextCentered(
  page: PDFPage,
  text: string,
  centerX: number,
  y: number,
  size: number,
  font: PDFFont
) {
  const textWidth = font.widthOfTextAtSize(text, size);
  const x = centerX - textWidth / 2;

  page.drawText(text, {
    x: x,
    y: y,
    size: size,
    font: font,
    color: rgb(0, 0, 0),
  });
}

/**
 * Testa o preenchimento com coordenadas específicas
 * Útil para ajuste fino
 */
export async function testCoordinateMapping() {
  const templatePath = path.resolve(process.cwd(), "server/templates/template_ccb.pdf");
  const outputPath = path.resolve(process.cwd(), "template_ccb_TEST_FILL.pdf");

  console.log("🧪 Testando preenchimento de campos...");

  const templateBytes = await fs.readFile(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();

  // Teste na primeira página
  const firstPage = pages[0];

  // Adicionar textos de teste em várias posições
  const testFields = [
    { text: "TESTE TOPO", x: 100, y: 750, bold: true },
    { text: "TESTE CENTRO", x: 250, y: 400, bold: false },
    { text: "TESTE BAIXO", x: 100, y: 100, bold: false },
    { text: "Gabriel Santana", x: 150, y: 600, bold: true },
    { text: "CPF: 123.456.789-00", x: 150, y: 580, bold: false },
    { text: "R$ 50.000,00", x: 400, y: 600, bold: true },
  ];

  for (const field of testFields) {
    firstPage.drawText(field.text, {
      x: field.x,
      y: field.y,
      size: 12,
      font: field.bold ? fontBold : fontRegular,
      color: rgb(0, 0, 0.8), // Azul escuro para destacar
    });

    // Adicionar marcador visual
    firstPage.drawCircle({
      x: field.x,
      y: field.y,
      size: 2,
      color: rgb(1, 0, 0),
    });
  }

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);
  console.log(`✅ PDF de teste gerado: ${outputPath}`);

  return outputPath;
}
