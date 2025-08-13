import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';

/**
 * Script de teste para validar a viabilidade de fusão de múltiplos PDFs
 * usando a biblioteca pdf-lib.
 * 
 * Este teste cria documentos PDF simples e os funde em um único documento
 * para provar que a funcionalidade é possível.
 */

async function testPdfMerging() {
  console.log('🧪 [PDF MERGE TEST] Iniciando teste de viabilidade...');
  
  try {
    // 1. Criar primeiro documento PDF
    console.log('📄 [STEP 1] Criando primeiro documento PDF...');
    const pdfDoc1 = await PDFDocument.create();
    const font = await pdfDoc1.embedFont(StandardFonts.Helvetica);
    
    const page1 = pdfDoc1.addPage([595, 842]); // A4 size
    page1.drawText('PARCELA 1/3 - Boleto Bancário', {
      x: 50,
      y: 750,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });
    page1.drawText('Valor: R$ 1.500,00', {
      x: 50,
      y: 700,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    page1.drawText('Vencimento: 15/09/2025', {
      x: 50,
      y: 680,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });

    // 2. Criar segundo documento PDF
    console.log('📄 [STEP 2] Criando segundo documento PDF...');
    const pdfDoc2 = await PDFDocument.create();
    const font2 = await pdfDoc2.embedFont(StandardFonts.Helvetica);
    
    const page2 = pdfDoc2.addPage([595, 842]);
    page2.drawText('PARCELA 2/3 - Boleto Bancário', {
      x: 50,
      y: 750,
      size: 16,
      font: font2,
      color: rgb(0, 0, 0),
    });
    page2.drawText('Valor: R$ 1.500,00', {
      x: 50,
      y: 700,
      size: 12,
      font: font2,
      color: rgb(0, 0, 0),
    });
    page2.drawText('Vencimento: 15/10/2025', {
      x: 50,
      y: 680,
      size: 12,
      font: font2,
      color: rgb(0, 0, 0),
    });

    // 3. Criar terceiro documento PDF
    console.log('📄 [STEP 3] Criando terceiro documento PDF...');
    const pdfDoc3 = await PDFDocument.create();
    const font3 = await pdfDoc3.embedFont(StandardFonts.Helvetica);
    
    const page3 = pdfDoc3.addPage([595, 842]);
    page3.drawText('PARCELA 3/3 - Boleto Bancário', {
      x: 50,
      y: 750,
      size: 16,
      font: font3,
      color: rgb(0, 0, 0),
    });
    page3.drawText('Valor: R$ 1.500,00', {
      x: 50,
      y: 700,
      size: 12,
      font: font3,
      color: rgb(0, 0, 0),
    });
    page3.drawText('Vencimento: 15/11/2025', {
      x: 50,
      y: 680,
      size: 12,
      font: font3,
      color: rgb(0, 0, 0),
    });

    // 4. Criar documento de destino (merged)
    console.log('🔗 [STEP 4] Criando documento de destino para fusão...');
    const mergedPdf = await PDFDocument.create();
    const mergedFont = await mergedPdf.embedFont(StandardFonts.Helvetica);

    // Adicionar página de capa
    const coverPage = mergedPdf.addPage([595, 842]);
    coverPage.drawText('CARNÊ DE BOLETOS - PROPOSTA', {
      x: 150,
      y: 750,
      size: 18,
      font: mergedFont,
      color: rgb(0, 0, 0),
    });
    coverPage.drawText('3 parcelas de R$ 1.500,00', {
      x: 180,
      y: 700,
      size: 14,
      font: mergedFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    coverPage.drawText('Total: R$ 4.500,00', {
      x: 200,
      y: 680,
      size: 14,
      font: mergedFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // 5. Copiar páginas dos documentos originais
    console.log('📋 [STEP 5] Copiando páginas dos documentos originais...');
    
    // Copiar página do documento 1
    const [copiedPage1] = await mergedPdf.copyPages(pdfDoc1, [0]);
    mergedPdf.addPage(copiedPage1);
    
    // Copiar página do documento 2
    const [copiedPage2] = await mergedPdf.copyPages(pdfDoc2, [0]);
    mergedPdf.addPage(copiedPage2);
    
    // Copiar página do documento 3
    const [copiedPage3] = await mergedPdf.copyPages(pdfDoc3, [0]);
    mergedPdf.addPage(copiedPage3);

    // 6. Salvar o resultado final
    console.log('💾 [STEP 6] Salvando documento fusionado...');
    const mergedPdfBytes = await mergedPdf.save();
    
    fs.writeFileSync('merged_test.pdf', mergedPdfBytes);
    
    // 7. Validar resultado
    console.log('✅ [STEP 7] Validando resultado...');
    const fileStats = fs.statSync('merged_test.pdf');
    const pageCount = mergedPdf.getPageCount();
    
    console.log(`📊 [RESULT] Arquivo criado: merged_test.pdf`);
    console.log(`📊 [RESULT] Tamanho: ${fileStats.size} bytes`);
    console.log(`📊 [RESULT] Páginas: ${pageCount}`);
    console.log(`📊 [RESULT] Estrutura: 1 capa + 3 boletos = 4 páginas total`);
    
    // Verificar se o arquivo é um PDF válido
    const savedPdfBytes = fs.readFileSync('merged_test.pdf');
    const isPdfValid = savedPdfBytes.subarray(0, 4).toString() === '%PDF';
    
    console.log(`✅ [VALIDATION] PDF válido: ${isPdfValid}`);
    console.log(`✅ [VALIDATION] Magic bytes: ${savedPdfBytes.subarray(0, 8).toString()}`);
    
    return {
      success: true,
      fileSize: fileStats.size,
      pageCount: pageCount,
      isValid: isPdfValid,
      filePath: './merged_test.pdf'
    };
    
  } catch (error) {
    console.error('❌ [ERROR] Falha no teste de fusão:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Executar teste se for chamado diretamente
const isMain = process.argv[1] && process.argv[1].endsWith('test-pdf-merge.ts');
if (isMain) {
  testPdfMerging().then(result => {
    console.log('\n🎯 [FINAL RESULT]', result);
    if (result.success) {
      console.log('✅ PROVA DE CONCEITO: Fusão de PDFs com pdf-lib é VIÁVEL!');
    } else {
      console.log('❌ FALHA: Fusão de PDFs não é viável com configuração atual');
    }
  });
}

export { testPdfMerging };