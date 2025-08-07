import { Router } from 'express';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

/**
 * Servir template como imagem para página específica
 */
router.get('/template-page/:page', async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const templatePath = path.resolve(process.cwd(), 'server/templates/template_ccb.pdf');
    
    if (!await fs.access(templatePath).then(() => true).catch(() => false)) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    const templateBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    
    if (page < 1 || page > pdfDoc.getPageCount()) {
      return res.status(400).json({ error: 'Página inválida' });
    }

    const pages = pdfDoc.getPages();
    const targetPage = pages[page - 1];
    
    // Criar novo documento com apenas a página solicitada
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(pdfDoc, [page - 1]);
    newDoc.addPage(copiedPage);
    
    const pdfBytes = await newDoc.save();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="template-page-${page}.pdf"`);
    res.send(Buffer.from(pdfBytes));
    
  } catch (error) {
    console.error('❌ [CCB MAPPER] Erro ao servir página do template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Gerar PDF com coordenadas marcadas para teste
 */
router.post('/test-coordinates', async (req, res) => {
  try {
    const { coordinates } = req.body;
    
    if (!Array.isArray(coordinates)) {
      return res.status(400).json({ error: 'Coordenadas devem ser um array' });
    }

    const templatePath = path.resolve(process.cwd(), 'server/templates/template_ccb.pdf');
    const templateBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const pages = pdfDoc.getPages();
    
    // Agrupar coordenadas por página
    const coordsByPage = coordinates.reduce((acc: any, coord: any) => {
      if (!acc[coord.page]) acc[coord.page] = [];
      acc[coord.page].push(coord);
      return acc;
    }, {});

    // Desenhar coordenadas em cada página
    Object.entries(coordsByPage).forEach(([pageNum, coords]: [string, any]) => {
      const pageIndex = parseInt(pageNum) - 1;
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];
        
        (coords as any[]).forEach((coord) => {
          // Desenhar cruz de referência
          const crossSize = 8;
          
          // Linha horizontal
          page.drawLine({
            start: { x: coord.x - crossSize, y: coord.y },
            end: { x: coord.x + crossSize, y: coord.y },
            thickness: 1,
            color: rgb(1, 0, 0)
          });
          
          // Linha vertical
          page.drawLine({
            start: { x: coord.x, y: coord.y - crossSize },
            end: { x: coord.x, y: coord.y + crossSize },
            thickness: 1,
            color: rgb(1, 0, 0)
          });

          // Desenhar texto de teste se fornecido
          if (coord.testText) {
            const font = coord.bold ? fontBold : fontRegular;
            const fontSize = coord.fontSize || 12;
            
            let textX = coord.x;
            if (coord.align === 'center') {
              const textWidth = font.widthOfTextAtSize(coord.testText, fontSize);
              textX = coord.x - (textWidth / 2);
            } else if (coord.align === 'right') {
              const textWidth = font.widthOfTextAtSize(coord.testText, fontSize);
              textX = coord.x - textWidth;
            }
            
            page.drawText(coord.testText, {
              x: textX,
              y: coord.y,
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0.8) // Azul para destacar
            });
          }

          // Etiqueta com informações
          const labelText = `${coord.label || coord.fieldName}`;
          page.drawText(labelText, {
            x: coord.x + 12,
            y: coord.y + 5,
            size: 8,
            font: fontRegular,
            color: rgb(0.8, 0, 0.8)
          });
          
          // Coordenadas
          const coordText = `(${coord.x}, ${coord.y})`;
          page.drawText(coordText, {
            x: coord.x + 12,
            y: coord.y - 8,
            size: 7,
            font: fontRegular,
            color: rgb(0.6, 0.6, 0.6)
          });
        });
      }
    });

    const pdfBytes = await pdfDoc.save();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="ccb-coordinates-test.pdf"');
    res.send(Buffer.from(pdfBytes));
    
    console.log(`✅ [CCB MAPPER] PDF de teste gerado com ${coordinates.length} coordenadas`);
    
  } catch (error) {
    console.error('❌ [CCB MAPPER] Erro ao gerar PDF de teste:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Salvar coordenadas mapeadas no arquivo de configuração
 */
router.post('/save-coordinates', async (req, res) => {
  try {
    const { coordinates } = req.body;
    
    if (!Array.isArray(coordinates)) {
      return res.status(400).json({ error: 'Coordenadas devem ser um array' });
    }

    // Agrupar coordenadas por página
    const coordsByPage = coordinates.reduce((acc: any, coord: any) => {
      if (!acc[coord.page]) acc[coord.page] = {};
      
      acc[coord.page][coord.fieldName] = {
        x: coord.x,
        y: coord.y,
        fontSize: coord.fontSize,
        bold: coord.bold,
        align: coord.align,
        ...(coord.maxWidth && { maxWidth: coord.maxWidth })
      };
      
      return acc;
    }, {});

    // Gerar arquivo TypeScript
    const configContent = `/**
 * Coordenadas CCB mapeadas automaticamente via interface web
 * Gerado em: ${new Date().toISOString()}
 */

export interface CCBFieldConfig {
  x: number;
  y: number;
  fontSize: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
}

export interface CCBCoordinates {
  ${Object.keys(coordsByPage).map(page => `page${page}: Record<string, CCBFieldConfig>;`).join('\n  ')}
}

export const ccbCoordinates: CCBCoordinates = {
${Object.entries(coordsByPage).map(([page, fields]) => `  page${page}: {
${Object.entries(fields as Record<string, any>).map(([fieldName, config]) => 
  `    ${fieldName}: ${JSON.stringify(config, null, 6).replace(/\n {6}/g, '\n      ')}`
).join(',\n')}
  }`).join(',\n')}
};

// Função auxiliar para obter configuração de campo
export function getFieldConfig(page: number, fieldName: string): CCBFieldConfig | null {
  const pageKey = \`page\${page}\` as keyof CCBCoordinates;
  const pageConfig = ccbCoordinates[pageKey];
  return pageConfig?.[fieldName] || null;
}

// Lista de todos os campos mapeados
export const mappedFields = {
${Object.entries(coordsByPage).map(([page, fields]) => 
  `  page${page}: [${Object.keys(fields as Record<string, any>).map(field => `'${field}'`).join(', ')}]`
).join(',\n')}
};

export default ccbCoordinates;
`;

    const configPath = path.resolve(process.cwd(), 'server/config/ccbCoordinates.ts');
    await fs.writeFile(configPath, configContent, 'utf8');
    
    console.log(`✅ [CCB MAPPER] Coordenadas salvas: ${coordinates.length} campos em ${Object.keys(coordsByPage).length} páginas`);
    
    res.json({
      success: true,
      message: `Coordenadas salvas com sucesso`,
      stats: {
        totalFields: coordinates.length,
        pages: Object.keys(coordsByPage).length,
        fieldsPerPage: Object.fromEntries(
          Object.entries(coordsByPage).map(([page, fields]) => [
            `page${page}`, 
            Object.keys(fields as Record<string, any>).length
          ])
        )
      }
    });
    
  } catch (error) {
    console.error('❌ [CCB MAPPER] Erro ao salvar coordenadas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;