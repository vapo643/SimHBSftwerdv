import { PDFDocument } from 'pdf-lib';
import { interBankService } from './interBankService';
import { db, createServerSupabaseAdminClient } from '../lib/supabase';
import { interCollections } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { getBrasiliaTimestamp } from '../lib/timezone';

/**
 * Serviço para gerar carnê de boletos (PDF consolidado com todas as parcelas)
 */
export class PdfMergeService {
  /**
   * Gera um carnê PDF contendo todos os boletos de uma proposta
   * @param propostaId ID da proposta
   * @returns Buffer do PDF consolidado
   */
  async gerarCarneParaProposta(propostaId: string): Promise<Buffer> {
    console.log(`[PDF MERGE] 📚 Iniciando geração de carnê para proposta: ${propostaId}`);
    
    try {
      // 1. BUSCAR BOLETOS: Consultar tabela inter_collections
      console.log(`[PDF MERGE] 🔍 Buscando boletos da proposta...`);
      
      const collections = await db
        .select()
        .from(interCollections)
        .where(and(
          eq(interCollections.propostaId, propostaId),
          eq(interCollections.isActive, true)
        ))
        .orderBy(interCollections.numeroParcela);
      
      if (!collections || collections.length === 0) {
        throw new Error(`Nenhum boleto encontrado para a proposta ${propostaId}`);
      }
      
      console.log(`[PDF MERGE] 📊 Encontrados ${collections.length} boletos para processar`);
      
      // 2. DOWNLOAD EM LOTE: Baixar todos os PDFs
      console.log(`[PDF MERGE] ⬇️ Iniciando download dos PDFs...`);
      
      const pdfBuffers: Buffer[] = [];
      const errors: string[] = [];
      
      for (let i = 0; i < collections.length; i++) {
        const collection = collections[i];
        try {
          console.log(`[PDF MERGE] 📄 Baixando PDF parcela ${collection.numeroParcela}/${collection.totalParcelas} (${i + 1}/${collections.length})...`);
          
          const pdfBuffer = await interBankService.obterPdfCobranca(collection.codigoSolicitacao);
          
          // Validar PDF
          if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error(`PDF vazio para parcela ${collection.numeroParcela}`);
          }
          
          const pdfMagic = pdfBuffer.slice(0, 5).toString('ascii');
          if (!pdfMagic.startsWith('%PDF')) {
            throw new Error(`PDF inválido para parcela ${collection.numeroParcela}`);
          }
          
          pdfBuffers.push(pdfBuffer);
          console.log(`[PDF MERGE] ✅ PDF parcela ${collection.numeroParcela} baixado com sucesso (${pdfBuffer.length} bytes)`);
          
          // Delay entre requisições para evitar rate limiting (exceto na última)
          if (i < collections.length - 1) {
            console.log(`[PDF MERGE] ⏳ Aguardando 2s antes da próxima requisição...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (error: any) {
          console.error(`[PDF MERGE] ❌ Erro ao baixar parcela ${collection.numeroParcela}:`, error.message);
          errors.push(`Parcela ${collection.numeroParcela}: ${error.message}`);
        }
      }
      
      // Verificar se conseguiu baixar pelo menos um PDF
      if (pdfBuffers.length === 0) {
        throw new Error(`Não foi possível baixar nenhum PDF. Erros: ${errors.join('; ')}`);
      }
      
      if (errors.length > 0) {
        console.warn(`[PDF MERGE] ⚠️ ${errors.length} parcelas falharam no download`);
      }
      
      // 3. FUSÃO COM pdf-lib
      console.log(`[PDF MERGE] 🔀 Iniciando fusão de ${pdfBuffers.length} PDFs...`);
      
      // Criar documento PDF vazio
      const mergedPdfDoc = await PDFDocument.create();
      mergedPdfDoc.setTitle(`Carnê de Boletos - Proposta ${propostaId}`);
      mergedPdfDoc.setSubject('Carnê de Boletos Bancários');
      mergedPdfDoc.setCreator('Sistema Simpix');
      mergedPdfDoc.setProducer('pdf-lib');
      mergedPdfDoc.setCreationDate(new Date());
      mergedPdfDoc.setModificationDate(new Date());
      
      // Processar cada PDF
      for (let i = 0; i < pdfBuffers.length; i++) {
        try {
          console.log(`[PDF MERGE] 📑 Processando PDF ${i + 1}/${pdfBuffers.length}...`);
          
          // Carregar PDF individual
          const pdfDoc = await PDFDocument.load(pdfBuffers[i]);
          
          // Copiar todas as páginas
          const pages = await mergedPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
          
          // Adicionar páginas ao documento final
          for (const page of pages) {
            mergedPdfDoc.addPage(page);
          }
          
          console.log(`[PDF MERGE] ✅ PDF ${i + 1} adicionado (${pages.length} páginas)`);
          
        } catch (error: any) {
          console.error(`[PDF MERGE] ❌ Erro ao processar PDF ${i + 1}:`, error.message);
          // Continuar com os outros PDFs mesmo se um falhar
        }
      }
      
      // Verificar se tem páginas no documento final
      const totalPages = mergedPdfDoc.getPageCount();
      if (totalPages === 0) {
        throw new Error('Documento final não contém páginas');
      }
      
      console.log(`[PDF MERGE] 📊 Documento final contém ${totalPages} páginas`);
      
      // 4. SALVAR: Converter para buffer
      const mergedPdfBytes = await mergedPdfDoc.save();
      const mergedBuffer = Buffer.from(mergedPdfBytes);
      
      console.log(`[PDF MERGE] ✅ Carnê gerado com sucesso (${mergedBuffer.length} bytes)`);
      
      return mergedBuffer;
      
    } catch (error: any) {
      console.error(`[PDF MERGE] ❌ Erro ao gerar carnê:`, error);
      throw error;
    }
  }
  
  /**
   * Salva o carnê no Supabase Storage e retorna URL assinada
   * @param propostaId ID da proposta
   * @param pdfBuffer Buffer do PDF
   * @returns URL assinada para download
   */
  async salvarCarneNoStorage(propostaId: string, pdfBuffer: Buffer): Promise<string> {
    try {
      console.log(`[PDF MERGE] 💾 Salvando carnê no Supabase Storage...`);
      
      const timestamp = getBrasiliaTimestamp().replace(/[^0-9]/g, '');
      const fileName = `propostas/${propostaId}/carnes/carne-${timestamp}.pdf`;
      
      // Upload para o Supabase Storage
      const supabase = createServerSupabaseAdminClient();
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('documents')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });
      
      if (uploadError) {
        console.error(`[PDF MERGE] ❌ Erro no upload:`, uploadError);
        throw new Error(`Erro ao fazer upload do carnê: ${uploadError.message}`);
      }
      
      console.log(`[PDF MERGE] ✅ Upload concluído: ${fileName}`);
      
      // Gerar URL assinada (válida por 1 hora)
      const { data: signedUrlData, error: signedUrlError } = await supabase
        .storage
        .from('documents')
        .createSignedUrl(fileName, 3600); // 1 hora
      
      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error(`[PDF MERGE] ❌ Erro ao gerar URL assinada:`, signedUrlError);
        throw new Error('Erro ao gerar URL de download');
      }
      
      console.log(`[PDF MERGE] ✅ URL assinada gerada com sucesso`);
      
      return signedUrlData.signedUrl;
      
    } catch (error: any) {
      console.error(`[PDF MERGE] ❌ Erro ao salvar carnê:`, error);
      throw error;
    }
  }
}

// Exportar instância única
export const pdfMergeService = new PdfMergeService();