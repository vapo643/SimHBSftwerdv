/**
 * CCB Field Filler - Utilitário para preencher campos no template CCB
 * Usa as coordenadas mapeadas para posicionar texto no PDF
 */

import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { ccbCoordinates, getFieldConfig, proposalToCCBMapping } from '../config/ccbCoordinates';
import fs from 'fs/promises';
import path from 'path';

export interface CCBData {
  proposta: any;
  parcelas?: any[];
  cliente?: any;
  tabela?: any;
}

/**
 * Preenche o template CCB com os dados da proposta
 */
export async function fillCCBTemplate(data: CCBData): Promise<Buffer> {
  console.log('📝 [CCB FILLER] Iniciando preenchimento do template com coordenadas mapeadas');
  
  try {
    // Carregar template
    const templatePath = path.resolve(process.cwd(), 'server/templates/template_ccb.pdf');
    const templateBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    
    // Embed fontes
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const pages = pdfDoc.getPages();
    
    // Processar cada página
    for (let pageNum = 1; pageNum <= pages.length; pageNum++) {
      const page = pages[pageNum - 1];
      const pageKey = `page${pageNum}` as keyof typeof ccbCoordinates;
      const pageConfig = ccbCoordinates[pageKey];
      
      if (!pageConfig || Object.keys(pageConfig).length === 0) {
        console.log(`📄 [CCB FILLER] Página ${pageNum} não tem campos mapeados, pulando...`);
        continue;
      }
      
      console.log(`📄 [CCB FILLER] Processando página ${pageNum} com ${Object.keys(pageConfig).length} campos`);
      
      // Preencher cada campo da página
      for (const [fieldName, config] of Object.entries(pageConfig)) {
        try {
          // Obter valor do campo usando o mapeamento
          const mappingFunc = proposalToCCBMapping[fieldName as keyof typeof proposalToCCBMapping];
          if (!mappingFunc) {
            console.log(`⚠️ [CCB FILLER] Sem mapeamento para campo: ${fieldName}`);
            continue;
          }
          
          const value = mappingFunc(data.proposta);
          if (!value) {
            console.log(`⚠️ [CCB FILLER] Valor vazio para campo: ${fieldName}`);
            continue;
          }
          
          // Configurar fonte
          const font = config.bold ? fontBold : fontRegular;
          const fontSize = config.fontSize || 11;
          
          // Calcular posição X baseada no alinhamento
          let xPosition = config.x;
          if (config.align === 'center') {
            const textWidth = font.widthOfTextAtSize(value, fontSize);
            xPosition = config.x - (textWidth / 2);
          } else if (config.align === 'right') {
            const textWidth = font.widthOfTextAtSize(value, fontSize);
            xPosition = config.x - textWidth;
          }
          
          // Desenhar texto (coordenadas já no formato PDF correto)
          page.drawText(value, {
            x: xPosition,
            y: config.y, // Coordenada já convertida manualmente
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
            maxWidth: config.maxWidth
          });
          
          console.log(`✅ [CCB FILLER] Campo preenchido: ${fieldName} = "${value}" em (${config.x}, ${config.y})`);
          
        } catch (fieldError) {
          console.error(`❌ [CCB FILLER] Erro ao preencher campo ${fieldName}:`, fieldError);
        }
      }
    }
    
    // Salvar PDF preenchido
    const pdfBytes = await pdfDoc.save();
    console.log(`✅ [CCB FILLER] Template preenchido com sucesso - ${pdfBytes.length} bytes`);
    
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    console.error('❌ [CCB FILLER] Erro ao preencher template:', error);
    throw error;
  }
}

/**
 * Valida se todos os campos obrigatórios estão presentes nos dados
 */
export function validateCCBData(data: CCBData): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];
  const requiredFields = [
    'emitenteNome',
    'emitenteCPF',
    'valorPrincipal',
    'taxaJurosEfetivaMensal',
    'custoEfetivoTotal'
  ];
  
  for (const field of requiredFields) {
    const mappingFunc = proposalToCCBMapping[field as keyof typeof proposalToCCBMapping];
    if (mappingFunc) {
      const value = mappingFunc(data.proposta);
      if (!value) {
        missingFields.push(field);
      }
    }
  }
  
  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Testa o preenchimento de campos específicos
 */
export async function testFieldFilling(fieldName: string, testValue: string, page: number = 1): Promise<Buffer> {
  console.log(`🧪 [CCB FILLER] Testando campo ${fieldName} na página ${page}`);
  
  const templatePath = path.resolve(process.cwd(), 'server/templates/template_ccb.pdf');
  const templateBytes = await fs.readFile(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const pages = pdfDoc.getPages();
  if (page < 1 || page > pages.length) {
    throw new Error(`Página ${page} inválida`);
  }
  
  const targetPage = pages[page - 1];
  const config = getFieldConfig(page, fieldName);
  
  if (!config) {
    throw new Error(`Campo ${fieldName} não encontrado na página ${page}`);
  }
  
  // Desenhar marcador de posição
  targetPage.drawCircle({
    x: config.x,
    y: config.y,
    size: 5,
    color: rgb(1, 0, 0),
    opacity: 0.5
  });
  
  // Desenhar texto de teste
  const font = config.bold ? fontBold : fontRegular;
  const fontSize = config.fontSize || 11;
  
  let xPosition = config.x;
  if (config.align === 'center') {
    const textWidth = font.widthOfTextAtSize(testValue, fontSize);
    xPosition = config.x - (textWidth / 2);
  } else if (config.align === 'right') {
    const textWidth = font.widthOfTextAtSize(testValue, fontSize);
    xPosition = config.x - textWidth;
  }
  
  targetPage.drawText(testValue, {
    x: xPosition,
    y: config.y,
    size: fontSize,
    font: font,
    color: rgb(0, 0, 0.8),
    maxWidth: config.maxWidth
  });
  
  // Adicionar etiqueta
  targetPage.drawText(`[${fieldName}]`, {
    x: config.x + 10,
    y: config.y + 10,
    size: 8,
    font: fontRegular,
    color: rgb(0.8, 0, 0)
  });
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export default {
  fillCCBTemplate,
  validateCCBData,
  testFieldFilling
};