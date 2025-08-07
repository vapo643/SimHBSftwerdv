/**
 * Serviço de Geração CCB V2 - Sistema Inteligente
 * Com detecção automática e mapeamento corrigido
 */

import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FieldDetector } from './ccbFieldMappingV2';
import { supabase } from '../lib/supabase';

interface CCBGenerationResult {
  success: boolean;
  pdfBytes?: Uint8Array;
  error?: string;
  logs?: string[];
}

export class CCBGenerationServiceV2 {
  private templatePath = path.join(process.cwd(), 'server/templates/template_ccb.pdf');

  /**
   * Gera CCB com sistema inteligente V2
   */
  async generateCCB(propostaData: any): Promise<CCBGenerationResult> {
    try {
      console.log('🚀 [CCB V2] Iniciando geração inteligente para proposta:', propostaData.id);
      
      // Validar dados essenciais
      const validation = this.validatePropostaData(propostaData);
      if (!validation.valid) {
        return {
          success: false,
          error: `Dados incompletos: ${validation.missingFields.join(', ')}`,
          logs: [`❌ Validação falhou: Campos faltando - ${validation.missingFields.join(', ')}`]
        };
      }

      // Carregar template
      const templateBytes = await fs.readFile(this.templatePath);
      const pdfDoc = await PDFDocument.load(templateBytes);
      
      // Usar sistema de detecção inteligente
      const detector = new FieldDetector(pdfDoc);
      const font = await pdfDoc.embedFont('Helvetica');
      
      // Preencher campos com mapeamento corrigido
      await detector.detectAndFillFields(propostaData, font);
      
      // Obter logs do processo
      const logs = detector.getLogs();
      
      // Salvar PDF
      const pdfBytes = await pdfDoc.save();
      
      console.log('✅ [CCB V2] Geração concluída com sucesso');
      
      return {
        success: true,
        pdfBytes,
        logs
      };
      
    } catch (error) {
      console.error('❌ [CCB V2] Erro na geração:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        logs: [`❌ Erro fatal: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]
      };
    }
  }

  /**
   * Valida dados da proposta
   */
  private validatePropostaData(data: any): { valid: boolean; missingFields: string[] } {
    const requiredFields = [
      'id',
      'clienteNome',
      'clienteCpf',
      'valor',
      'prazo'
    ];
    
    const missingFields = requiredFields.filter(field => !data[field]);
    
    // Avisos para campos opcionais mas importantes
    const optionalButImportant = [
      'clienteRg',
      'clienteEndereco',
      'dadosPagamentoBanco',
      'dadosPagamentoAgencia',
      'dadosPagamentoConta',
      'taxaJuros'
    ];
    
    const missingOptional = optionalButImportant.filter(field => !data[field]);
    
    if (missingOptional.length > 0) {
      console.log(`⚠️ [CCB V2] Campos opcionais vazios: ${missingOptional.join(', ')}`);
    }
    
    return {
      valid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Salva CCB no Supabase Storage
   */
  async saveCCBToStorage(pdfBytes: Uint8Array, propostaId: string): Promise<string | null> {
    try {
      const fileName = `ccb_${propostaId}_${Date.now()}.pdf`;
      const filePath = `ccb/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true
        });
      
      if (error) {
        console.error('❌ [CCB V2] Erro ao salvar no storage:', error);
        return null;
      }
      
      console.log('✅ [CCB V2] CCB salvo no storage:', filePath);
      return filePath;
      
    } catch (error) {
      console.error('❌ [CCB V2] Erro ao salvar CCB:', error);
      return null;
    }
  }

  /**
   * Obtém URL pública do CCB
   */
  async getCCBPublicUrl(filePath: string): Promise<string | null> {
    try {
      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);
      
      if (!data?.publicUrl) {
        console.error('❌ [CCB V2] Erro ao gerar URL pública');
        return null;
      }
      
      return data.publicUrl;
      
    } catch (error) {
      console.error('❌ [CCB V2] Erro ao obter URL:', error);
      return null;
    }
  }

  /**
   * Busca linha digitável do boleto Inter
   */
  async getLinhaDigitavel(propostaId: string): Promise<string | null> {
    try {
      // Aqui você implementaria a busca na tabela inter_collections
      // Por enquanto retorna null
      console.log('🔍 [CCB V2] Buscando linha digitável para proposta:', propostaId);
      
      // TODO: Implementar query real
      // const result = await db
      //   .select()
      //   .from(interCollections)
      //   .where(eq(interCollections.propostaId, propostaId))
      //   .limit(1);
      
      return null;
      
    } catch (error) {
      console.error('❌ [CCB V2] Erro ao buscar linha digitável:', error);
      return null;
    }
  }
}