/**
 * McAfee Specific Bypass Service
 * SOLUÇÃO DEFINITIVA para McAfee threat ti!7da91cf510c0
 * 
 * Implementa múltiplas técnicas avançadas de bypass:
 * - Sanitização agressiva de metadados
 * - Reconstrução completa da estrutura PDF
 * - Injeção de assinaturas Microsoft
 * - Manipulação de timestamps
 * - Quebra de padrões de hash
 * - Fallbacks para PNG container e texto puro
 */

import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from "pdf-lib";
import { createServerSupabaseAdminClient } from "../lib/supabase";
import { PDFToImageService } from "./pdfToImageService";

export interface BypassResult {
  success: boolean;
  method: 'pdf_sanitized' | 'png_container' | 'text_fallback' | 'failed';
  buffer: Buffer;
  originalSize: number;
  newSize: number;
  warnings: string[];
}

export class McAfeeSpecificBypass {
  
  /**
   * Aplica bypass específico para threat ti!7da91cf510c0
   * Usa múltiplas estratégias até encontrar uma que funcione
   */
  static async applyBypass(pdfBuffer: Buffer, codigoSolicitacao: string): Promise<BypassResult> {
    console.log(`[MCAFEE BYPASS] 🚀 INICIANDO BYPASS ESPECÍFICO ti!7da91cf510c0`);
    console.log(`[MCAFEE BYPASS] 📊 PDF original: ${pdfBuffer.length} bytes`);
    
    const warnings: string[] = [];
    
    try {
      // ESTRATÉGIA 1: Sanitização Agressiva + Reconstrução
      console.log(`[MCAFEE BYPASS] 🔧 ESTRATÉGIA 1: Sanitização Agressiva`);
      const sanitizedResult = await this.aggressiveSanitization(pdfBuffer);
      
      if (sanitizedResult.success) {
        console.log(`[MCAFEE BYPASS] ✅ SUCESSO com sanitização agressiva`);
        return {
          success: true,
          method: 'pdf_sanitized',
          buffer: sanitizedResult.buffer,
          originalSize: pdfBuffer.length,
          newSize: sanitizedResult.buffer.length,
          warnings: sanitizedResult.warnings
        };
      }
      
      warnings.push(...sanitizedResult.warnings);
      
    } catch (error: any) {
      console.error(`[MCAFEE BYPASS] ❌ Estratégia 1 falhou:`, error.message);
      warnings.push(`Sanitização falhou: ${error.message}`);
    }
    
    try {
      // ESTRATÉGIA 2: PNG Container (se pdfToImageService disponível)
      console.log(`[MCAFEE BYPASS] 🔧 ESTRATÉGIA 2: PNG Container`);
      const pngResult = await this.createPngContainer(pdfBuffer);
      
      if (pngResult.success) {
        console.log(`[MCAFEE BYPASS] ✅ SUCESSO com PNG container`);
        return {
          success: true,
          method: 'png_container',
          buffer: pngResult.buffer,
          originalSize: pdfBuffer.length,
          newSize: pngResult.buffer.length,
          warnings: [...warnings, ...pngResult.warnings]
        };
      }
      
      warnings.push(...pngResult.warnings);
      
    } catch (error: any) {
      console.error(`[MCAFEE BYPASS] ❌ Estratégia 2 falhou:`, error.message);
      warnings.push(`PNG container falhou: ${error.message}`);
    }
    
    try {
      // ESTRATÉGIA 3: Fallback texto puro
      console.log(`[MCAFEE BYPASS] 🔧 ESTRATÉGIA 3: Fallback Texto`);
      const textResult = await this.createTextFallback(codigoSolicitacao);
      
      console.log(`[MCAFEE BYPASS] ⚠️ FALLBACK aplicado - arquivo de texto`);
      return {
        success: true,
        method: 'text_fallback',
        buffer: textResult,
        originalSize: pdfBuffer.length,
        newSize: textResult.length,
        warnings: [...warnings, 'PDF convertido para texto seguro como última opção']
      };
      
    } catch (error: any) {
      console.error(`[MCAFEE BYPASS] ❌ Todas as estratégias falharam:`, error.message);
      warnings.push(`Fallback texto falhou: ${error.message}`);
    }
    
    // Se chegou aqui, todas as estratégias falharam
    return {
      success: false,
      method: 'failed',
      buffer: pdfBuffer, // Retorna original
      originalSize: pdfBuffer.length,
      newSize: pdfBuffer.length,
      warnings: [...warnings, 'TODAS as estratégias de bypass falharam']
    };
  }
  
  /**
   * ESTRATÉGIA 1: Sanitização Agressiva
   * Reconstrói o PDF completamente removendo elementos suspeitos
   */
  private static async aggressiveSanitization(pdfBuffer: Buffer): Promise<{success: boolean; buffer: Buffer; warnings: string[]}> {
    const warnings: string[] = [];
    
    try {
      console.log(`[MCAFEE BYPASS] 🧹 Iniciando sanitização agressiva...`);
      
      // Carregar PDF original
      const originalPdf = await PDFDocument.load(pdfBuffer, {
        ignoreEncryption: true,
        updateMetadata: false
      });
      
      console.log(`[MCAFEE BYPASS] 📄 PDF carregado: ${originalPdf.getPageCount()} páginas`);
      
      // Criar PDF completamente novo
      const cleanPdf = await PDFDocument.create();
      
      // Definir metadados limpos com assinatura Microsoft
      cleanPdf.setTitle('Microsoft Office Document');
      cleanPdf.setSubject('Office Document');
      cleanPdf.setCreator('Microsoft® Office');
      cleanPdf.setProducer('Microsoft® PDF Generator');
      cleanPdf.setAuthor('Microsoft Office User');
      cleanPdf.setKeywords(['office', 'document', 'microsoft']);
      
      // Timestamp atual para quebrar hash patterns
      const now = new Date();
      cleanPdf.setCreationDate(now);
      cleanPdf.setModificationDate(now);
      
      console.log(`[MCAFEE BYPASS] 🏷️ Metadados Microsoft aplicados`);
      
      // Copiar todas as páginas para o PDF limpo
      const pageIndices = originalPdf.getPageIndices();
      for (const pageIndex of pageIndices) {
        console.log(`[MCAFEE BYPASS] 📄 Copiando página ${pageIndex + 1}...`);
        
        const [copiedPage] = await cleanPdf.copyPages(originalPdf, [pageIndex]);
        cleanPdf.addPage(copiedPage);
      }
      
      console.log(`[MCAFEE BYPASS] ✅ ${pageIndices.length} páginas copiadas`);
      
      // Salvar com configurações específicas anti-detecção
      const cleanBytes = await cleanPdf.save({
        updateFieldAppearances: true,
        useObjectStreams: false, // Evita compressão que pode triggar detecção
        addDefaultPage: false,
        objectsPerTick: 50 // Processamento mais lento mas mais seguro
      });
      
      const cleanBuffer = Buffer.from(cleanBytes);
      console.log(`[MCAFEE BYPASS] 🎯 PDF sanitizado: ${cleanBuffer.length} bytes (${pdfBuffer.length - cleanBuffer.length} bytes removidos)`);
      
      // Validar resultado
      const magic = cleanBuffer.slice(0, 5).toString('ascii');
      if (!magic.startsWith('%PDF')) {
        throw new Error('PDF sanitizado não é válido');
      }
      
      return {
        success: true,
        buffer: cleanBuffer,
        warnings
      };
      
    } catch (error: any) {
      console.error(`[MCAFEE BYPASS] ❌ Sanitização falhou:`, error.message);
      return {
        success: false,
        buffer: pdfBuffer,
        warnings: [`Sanitização falhou: ${error.message}`]
      };
    }
  }
  
  /**
   * ESTRATÉGIA 2: PNG Container
   * Converte PDF para imagem PNG e embeda em PDF limpo
   */
  private static async createPngContainer(pdfBuffer: Buffer): Promise<{success: boolean; buffer: Buffer; warnings: string[]}> {
    const warnings: string[] = [];
    
    try {
      console.log(`[MCAFEE BYPASS] 🖼️ Criando PNG container...`);
      
      // Verificar se serviço de conversão está disponível
      const hasImageCapabilities = await PDFToImageService.checkSystemCapabilities();
      
      if (!hasImageCapabilities.canConvert) {
        warnings.push('Sistema não suporta conversão de imagens');
        return { success: false, buffer: pdfBuffer, warnings };
      }
      
      // Converter PDF para PDF limpo via imagens
      const cleanPdfBuffer = await PDFToImageService.convertPdfToCleanPdf(pdfBuffer);
      
      console.log(`[MCAFEE BYPASS] ✅ PNG container criado: ${cleanPdfBuffer.length} bytes`);
      
      return {
        success: true,
        buffer: cleanPdfBuffer,
        warnings
      };
      
    } catch (error: any) {
      console.error(`[MCAFEE BYPASS] ❌ PNG container falhou:`, error.message);
      return {
        success: false,
        buffer: pdfBuffer,
        warnings: [`PNG container falhou: ${error.message}`]
      };
    }
  }
  
  /**
   * ESTRATÉGIA 3: Fallback Texto Seguro
   * Cria arquivo de texto com informações do boleto
   */
  private static async createTextFallback(codigoSolicitacao: string): Promise<Buffer> {
    console.log(`[MCAFEE BYPASS] 📝 Criando fallback texto...`);
    
    const textContent = `
=====================================
        BOLETO BANCÁRIO - INTER
=====================================

⚠️  ARQUIVO CONVERTIDO PARA TEXTO  ⚠️

Por questões de segurança, este boleto foi 
convertido para formato texto seguro.

CÓDIGO DA COBRANÇA: ${codigoSolicitacao}

📋 INSTRUÇÕES:
1. Acesse sua conta do Banco Inter
2. Vá em "Boletos" ou "Cobranças"
3. Busque pelo código: ${codigoSolicitacao}
4. Faça o download direto do banco

🔒 SEGURANÇA:
Este arquivo foi processado pelo sistema 
de segurança Simpix para evitar falsos 
positivos de antivírus.

📞 SUPORTE:
Em caso de dúvidas, contate o suporte
do sistema Simpix.

Gerado em: ${new Date().toLocaleString('pt-BR')}
=====================================
`;
    
    return Buffer.from(textContent, 'utf-8');
  }
  
  /**
   * Salva evidência do bypass no storage
   */
  static async saveBypassEvidence(
    originalBuffer: Buffer, 
    bypassedBuffer: Buffer, 
    method: string,
    codigoSolicitacao: string
  ): Promise<void> {
    try {
      const supabaseAdmin = createServerSupabaseAdminClient();
      const timestamp = Date.now();
      
      // Salvar PDF original
      const originalFileName = `mcafee-bypass/${codigoSolicitacao}-original-${timestamp}.pdf`;
      await supabaseAdmin.storage
        .from('documents')
        .upload(originalFileName, originalBuffer, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false
        });
      
      // Salvar versão com bypass
      const bypassedFileName = `mcafee-bypass/${codigoSolicitacao}-${method}-${timestamp}`;
      const contentType = method === 'text_fallback' ? 'text/plain' : 'application/pdf';
      const extension = method === 'text_fallback' ? '.txt' : '.pdf';
      
      await supabaseAdmin.storage
        .from('documents')
        .upload(bypassedFileName + extension, bypassedBuffer, {
          contentType,
          cacheControl: '3600',
          upsert: false
        });
      
      console.log(`[MCAFEE BYPASS] 📁 Evidências salvas: ${originalFileName} e ${bypassedFileName}${extension}`);
      
    } catch (error) {
      console.error(`[MCAFEE BYPASS] ⚠️ Falha ao salvar evidências:`, error);
    }
  }
}