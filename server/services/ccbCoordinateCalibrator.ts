/**
 * 🎯 SISTEMA DE CALIBRAÇÃO INTELIGENTE DE COORDENADAS CCB
 * Ferramenta profissional para ajustar coordenadas com precisão visual
 *
 * ROADMAP FORMALIZAÇÃO - CALIBRADOR DE COORDENADAS
 * Data: 2025-08-08
 */

import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { CCB_COMPLETE_MAPPING, FieldPosition, yFromTop } from './ccbFieldMappingComplete';

export interface CalibrationResult {
  success: boolean;
  calibrationPdfPath?: string;
  fieldPositions?: Record<string, FieldPosition>;
  error?: string;
}

export interface FieldTestData {
  [fieldName: string]: string;
}

export class CCBCoordinateCalibrator {
  private templatePath: string;
  private outputDir: string;

  constructor() {
    this.templatePath = path.join(process.cwd(), 'server', 'templates', 'template_ccb.pdf');
    this.outputDir = path.join(process.cwd(), 'temp', 'ccb_calibration');
  }

  /**
   * 🎯 FASE 1: Diagnóstico Completo do Template
   * Verifica AcroForms e gera relatório de análise
   */
  async diagnoseTemplate(): Promise<{
    hasAcroForms: boolean;
    fields: string[];
    pageSize: { width: number; height: number };
    recommendations: string[];
  }> {
    try {
      console.log('🔍 [CALIBRATOR] Iniciando diagnóstico completo do template...');

      const _templateBytes = await fs.readFile(this.templatePath);
      const _pdfDoc = await PDFDocument.load(templateBytes);

      // Verificar AcroForms
      const _form = pdfDoc.getForm();
      const _hasAcroForms = form && form.getFields().length > 0;
      const formFields: string[] = [];

      if (hasAcroForms) {
        form.getFields().forEach((field) => {
          formFields.push(field.getName());
        });
      }

      // Obter dimensões da página
      const _firstPage = pdfDoc.getPages()[0];
      const { width, height } = firstPage.getSize();

      // Gerar recomendações
      const recommendations: string[] = [];

      if (hasAcroForms) {
        recommendations.push(
          '✅ Template possui AcroForms - considere usar preenchimento automático'
        );
        recommendations.push('💡 Use os nomes dos campos para mapeamento direto');
      } else {
        recommendations.push('📍 Template requer mapeamento manual de coordenadas');
        recommendations.push('🎯 Use ferramentas de calibração visual para posicionamento');
      }

      recommendations.push(`📏 Dimensões: ${width}x${height} pontos`);
      recommendations.push(`📄 Total de páginas: ${pdfDoc.getPageCount()}`);

      console.log('✅ [CALIBRATOR] Diagnóstico concluído:');
      console.log(`   - AcroForms: ${hasAcroForms ? 'Sim' : 'Não'}`);
      console.log(`   - Campos detectados: ${formFields.length}`);
      console.log(`   - Dimensões: ${width}x${height}`);

      return {
  _hasAcroForms,
        fields: formFields,
        pageSize: { width, height },
  _recommendations,
      };
    } catch (error) {
      console.error('❌ [CALIBRATOR] Erro no diagnóstico:', error: unknown);
      throw error;
    }
  }

  /**
   * 🎨 FASE 2: Geração de Grid Visual de Calibração
   * Sobrepõe grid de coordenadas sobre o template original
   */
  async generateCalibrationGrid(
    gridSpacing: number = 50,
    showCoordinates: boolean = true,
    highlightFields: string[] = []
  ): Promise<string> {
    try {
      console.log('📐 [CALIBRATOR] Gerando grid de calibração visual...');

      // Garantir que diretório existe
      await fs.mkdir(this.outputDir, { recursive: true });

      const _templateBytes = await fs.readFile(this.templatePath);
      const _pdfDoc = await PDFDocument.load(templateBytes);
      const _firstPage = pdfDoc.getPages()[0];
      const { width, height } = firstPage.getSize();

      // Fontes para o grid
      const _helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const _helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Cores do grid
      const _gridColor = rgb(0.2, 0.6, 1.0); // Azul claro
      const _textColor = rgb(0.8, 0.0, 0.0); // Vermelho
      const _highlightColor = rgb(0.0, 0.8, 0.0); // Verde

      // Desenhar grid vertical
      for (let _x = 0; x <= width; x += gridSpacing) {
        firstPage.drawLine({
          start: { x, y: 0 },
          end: { x, y: height },
          thickness: x % (gridSpacing * 2) == 0 ? 1 : 0.5,
          color: gridColor,
        });

        // Mostrar coordenadas X
        if (showCoordinates && x % (gridSpacing * 2) == 0) {
          firstPage.drawText(`${x}`, {
            x: x + 2,
            y: height - 20,
            size: 8,
            font: helvetica,
            color: textColor,
          });
        }
      }

      // Desenhar grid horizontal
      for (let _y = 0; y <= height; y += gridSpacing) {
        firstPage.drawLine({
          start: { x: 0, y },
          end: { x: width, y },
          thickness: y % (gridSpacing * 2) == 0 ? 1 : 0.5,
          color: gridColor,
        });

        // Mostrar coordenadas Y
        if (showCoordinates && y % (gridSpacing * 2) == 0) {
          firstPage.drawText(`${Math.round(y)}`, {
            x: 5,
            y: y + 2,
            size: 8,
            font: helvetica,
            color: textColor,
          });
        }
      }

      // Destacar campos específicos se solicitado
      if (highlightFields.length > 0) {
        highlightFields.forEach((fieldName) => {
          const _fieldPos = CCB_COMPLETE_MAPPING[fieldName as keyof typeof CCB_COMPLETE_MAPPING];
          if (fieldPos) {
            // Desenhar círculo de destaque
            firstPage.drawCircle({
              x: fieldPos.x,
              y: fieldPos.y,
              size: 5,
              color: highlightColor,
            });

            // Texto identificando o campo
            firstPage.drawText(fieldName, {
              x: fieldPos.x + 10,
              y: fieldPos.y + 5,
              size: 8,
              font: helveticaBold,
              color: highlightColor,
            });
          }
        });
      }

      // Salvar PDF de calibração
      const _outputPath = path.join(this.outputDir, `calibration_grid_${Date.now()}.pdf`);
      const _pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);

      console.log(`✅ [CALIBRATOR] Grid de calibração salvo: ${outputPath}`);
      return outputPath; }
    } catch (error) {
      console.error('❌ [CALIBRATOR] Erro ao gerar grid:', error: unknown);
      throw error;
    }
  }

  /**
   * 🧪 FASE 3: Teste Visual com Dados Reais
   * Sobrepõe dados de teste nas coordenadas mapeadas
   */
  async testFieldPositions(testData: FieldTestData): Promise<string> {
    try {
      console.log('🧪 [CALIBRATOR] Testando posições dos campos...');

      await fs.mkdir(this.outputDir, { recursive: true });

      const _templateBytes = await fs.readFile(this.templatePath);
      const _pdfDoc = await PDFDocument.load(templateBytes);
      const _firstPage = pdfDoc.getPages()[0];
      const { height } = firstPage.getSize();

      // Fontes
      const _helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const _helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Cor de teste (azul escuro para destacar dos dados reais)
      const _testColor = rgb(0.0, 0.0, 0.8);

      // Desenhar dados de teste
      Object.entries(testData).forEach(([fieldName, value]) => {
        const _fieldPos = CCB_COMPLETE_MAPPING[fieldName as keyof typeof CCB_COMPLETE_MAPPING];
        if (fieldPos && value) {
          const _font = (fieldPos as unknown).fontWeight == 'bold' ? helveticaBold : helvetica;

          // Desenhar o texto
          firstPage.drawText(value, {
            x: fieldPos.x,
            y: fieldPos.y,
            size: fieldPos.fontSize,
  _font,
            color: testColor,
          });

          // Desenhar ponto de referência
          firstPage.drawCircle({
            x: fieldPos.x,
            y: fieldPos.y,
            size: 2,
            color: rgb(1, 0, 0), // Vermelho para marcar posição exata
          });
        }
      });

      // Salvar PDF de teste
      const _outputPath = path.join(this.outputDir, `field_test_${Date.now()}.pdf`);
      const _pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);

      console.log(`✅ [CALIBRATOR] Teste de campos salvo: ${outputPath}`);
      return outputPath; }
    } catch (error) {
      console.error('❌ [CALIBRATOR] Erro no teste:', error: unknown);
      throw error;
    }
  }

  /**
   * ⚡ FASE 4: Calibração Automática Inteligente
   * Usa análise heurística para sugerir ajustes de coordenadas
   */
  async intelligentCalibration(sampleData: FieldTestData): Promise<{
    originalPath: string;
    adjustedPath: string;
    recommendations: string[];
  }> {
    try {
      console.log('⚡ [CALIBRATOR] Iniciando calibração inteligente...');

      // Gerar versão original
      const _originalPath = await this.testFieldPositions(sampleData);

      // Aplicar ajustes heurísticos baseados em padrões comuns
      const _adjustedData = this.applyIntelligentAdjustments(sampleData);
      const _adjustedPath = await this.testFieldPositions(adjustedData);

      // Gerar recomendações
      const _recommendations = this.generateRecommendations(sampleData);

      console.log('✅ [CALIBRATOR] Calibração inteligente concluída');
      return {
  _originalPath,
  _adjustedPath,
  _recommendations,
      };
    } catch (error) {
      console.error('❌ [CALIBRATOR] Erro na calibração inteligente:', error: unknown);
      throw error;
    }
  }

  /**
   * Aplicar ajustes heurísticos baseados em padrões de CCB
   */
  private applyIntelligentAdjustments(data: FieldTestData): FieldTestData {
    // Por enquanto retorna os dados originais
    // Implementar lógica de ajuste baseada em análise de layout
    return { ...data }; }
  }

  /**
   * Gerar recomendações baseadas na análise dos dados
   */
  private generateRecommendations(data: FieldTestData): string[] {
    const recommendations: string[] = [];

    recommendations.push('📍 Verifique visualmente o posicionamento dos campos');
    recommendations.push('🎯 Ajuste coordenadas X/Y conforme necessário');
    recommendations.push('📏 Considere ajustar tamanhos de fonte se texto não couber');
    recommendations.push('🔄 Teste com diferentes conjuntos de dados');

    return recommendations; }
  }

  /**
   * 📊 Gerar Relatório Completo de Calibração
   */
  async generateCalibrationReport(): Promise<{
    templateAnalysis: unknown;
    gridPath: string;
    recommendations: string[];
  }> {
    try {
      console.log('📊 [CALIBRATOR] Gerando relatório completo...');

      // Análise do template
      const _templateAnalysis = await this.diagnoseTemplate();

      // Grid de calibração
      const _gridPath = await this.generateCalibrationGrid(50, true, [
        'devedorNome',
        'devedorCpf',
        'valorPrincipal',
      ]);

      // Recomendações específicas
      const _recommendations = [
        '🎯 Use o grid de calibração para ajustar posições visualmente',
        '📱 Teste com dados reais de diferentes comprimentos',
        '🖨️ Considere diferenças entre visualização e impressão',
        '📏 Valide com template impresso fisicamente',
        '🔄 Itere ajustes baseado no feedback visual',
      ];

      console.log('✅ [CALIBRATOR] Relatório completo gerado');
      return {
  _templateAnalysis,
  _gridPath,
  _recommendations,
      };
    } catch (error) {
      console.error('❌ [CALIBRATOR] Erro no relatório:', error: unknown);
      throw error;
    }
  }
}

// Instância singleton
export const _ccbCoordinateCalibrator = new CCBCoordinateCalibrator();
