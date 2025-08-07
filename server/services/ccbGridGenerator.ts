/**
 * 🎯 Gerador de CCB com Grade de Coordenadas
 * Para facilitar o mapeamento visual manual
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { createServerSupabaseAdminClient } from '../lib/supabase';

export class CCBGridGenerator {
  private templatePath: string;

  constructor() {
    this.templatePath = path.join(process.cwd(), 'server', 'templates', 'template_ccb.pdf');
  }

  /**
   * Gera CCB com grade de coordenadas para mapeamento visual
   */
  async generateWithGrid(): Promise<{ success: boolean; pdfPath?: string; error?: string }> {
    try {
      console.log('🎯 [CCB GRID] Gerando template com grade de coordenadas...');

      // Carregar template
      const templateBytes = await fs.readFile(this.templatePath);
      const pdfDoc = await PDFDocument.load(templateBytes);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();
      
      console.log(`📐 Dimensões da página: ${width}x${height}`);
      
      // DESENHAR GRADE DE COORDENADAS
      
      // Linhas verticais a cada 50px
      for (let x = 0; x <= width; x += 50) {
        firstPage.drawLine({
          start: { x, y: 0 },
          end: { x, y: height },
          thickness: x % 100 === 0 ? 1 : 0.5,
          color: rgb(0.9, 0.9, 0.9),
        });
        
        // Números de coordenada X a cada 100px
        if (x % 100 === 0) {
          firstPage.drawText(x.toString(), {
            x: x + 2,
            y: height - 20,
            size: 8,
            font: helveticaFont,
            color: rgb(0.7, 0.7, 0.7),
          });
        }
      }
      
      // Linhas horizontais a cada 50px
      for (let y = 0; y <= height; y += 50) {
        firstPage.drawLine({
          start: { x: 0, y },
          end: { x: width, y },
          thickness: y % 100 === 0 ? 1 : 0.5,
          color: rgb(0.9, 0.9, 0.9),
        });
        
        // Números de coordenada Y a cada 100px
        if (y % 100 === 0) {
          firstPage.drawText(y.toString(), {
            x: 5,
            y: y + 2,
            size: 8,
            font: helveticaFont,
            color: rgb(0.7, 0.7, 0.7),
          });
        }
      }
      
      // MARCADORES DE TESTE PARA CAMPOS PRINCIPAIS
      const testMarkers = [
        { label: 'NOME', x: 120, y: 722, color: rgb(1, 0, 0) }, // Vermelho
        { label: 'CPF', x: 120, y: 697, color: rgb(0, 1, 0) },  // Verde
        { label: 'VALOR', x: 200, y: 602, color: rgb(0, 0, 1) }, // Azul
        { label: 'PARCELAS', x: 180, y: 572, color: rgb(1, 0.5, 0) }, // Laranja
        { label: 'VALOR_PARCELA', x: 200, y: 542, color: rgb(1, 0, 1) }, // Magenta
        { label: 'DATA', x: 100, y: 192, color: rgb(0.5, 0, 0.5) }, // Roxo
      ];
      
      testMarkers.forEach(marker => {
        // Desenhar círculo marcador
        firstPage.drawCircle({
          x: marker.x,
          y: marker.y,
          size: 8,
          color: marker.color,
        });
        
        // Label do campo
        firstPage.drawText(marker.label, {
          x: marker.x + 15,
          y: marker.y - 3,
          size: 10,
          font: helveticaFont,
          color: marker.color,
        });
        
        // Coordenadas exatas
        firstPage.drawText(`(${marker.x},${marker.y})`, {
          x: marker.x + 15,
          y: marker.y - 15,
          size: 8,
          font: helveticaFont,
          color: marker.color,
        });
      });
      
      // TÍTULO DA GRADE
      firstPage.drawText('CCB TEMPLATE COM GRADE DE COORDENADAS', {
        x: 50,
        y: height - 50,
        size: 16,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      
      firstPage.drawText('Grade: 50px | Marcadores coloridos mostram posições atuais dos campos', {
        x: 50,
        y: height - 70,
        size: 10,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5),
      });
      
      // Salvar PDF
      const pdfBytes = await pdfDoc.save();
      
      // Upload para Supabase
      const fileName = `ccb_grid_${Date.now()}.pdf`;
      const filePath = `ccb/grid/${fileName}`;
      
      const supabaseAdmin = createServerSupabaseAdminClient();
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('documents')
        .upload(filePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        console.error('❌ [CCB GRID] Erro no upload:', uploadError);
        return { success: false, error: 'Erro ao fazer upload do PDF' };
      }

      console.log(`✅ [CCB GRID] Grade gerada! Arquivo: ${filePath}`);
      return { success: true, pdfPath: filePath };

    } catch (error) {
      console.error('❌ [CCB GRID] Erro na geração:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * Obtém URL pública do PDF
   */
  async getPublicUrl(filePath: string): Promise<string | null> {
    try {
      const supabaseAdmin = createServerSupabaseAdminClient();
      const { data } = supabaseAdmin.storage
        .from('documents')
        .getPublicUrl(filePath);
      
      return data?.publicUrl || null;
    } catch (error) {
      console.error('❌ [CCB GRID] Erro ao obter URL pública:', error);
      return null;
    }
  }
}

export const ccbGridGenerator = new CCBGridGenerator();