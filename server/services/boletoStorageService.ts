/**
 * Boleto Storage Service
 * Serviço para sincronizar e armazenar PDFs de boletos no Supabase Storage
 * 
 * Arquitetura:
 * - Download sequencial de boletos do Banco Inter
 * - Armazenamento organizado no Supabase Storage
 * - Estrutura de pastas: propostas/{propostaId}/boletos/emitidos_pendentes/{codigoSolicitacao}.pdf
 */

import { interBankService } from './interBankService';
import { storage } from '../storage';
import { supabaseAdmin } from '../lib/supabase-admin';
import { PDFDocument } from 'pdf-lib';

interface BoletoSyncResult {
  success: boolean;
  propostaId: string;
  totalBoletos: number;
  boletosProcessados: number;
  boletosComErro: number;
  erros: Array<{
    codigoSolicitacao: string;
    erro: string;
  }>;
  caminhosPdf: string[];
}

class BoletoStorageService {
  private supabase: any;

  constructor() {
    this.supabase = supabaseAdmin;
  }

  /**
   * Sincroniza todos os boletos de uma proposta
   * Baixa PDFs do Banco Inter e salva no Supabase Storage
   */
  async sincronizarBoletosDaProposta(propostaId: string): Promise<BoletoSyncResult> {
    console.log(`[BOLETO STORAGE] 🚀 Iniciando sincronização de boletos para proposta: ${propostaId}`);
    
    const result: BoletoSyncResult = {
      success: true,
      propostaId,
      totalBoletos: 0,
      boletosProcessados: 0,
      boletosComErro: 0,
      erros: [],
      caminhosPdf: []
    };

    try {
      // 1. Buscar todos os códigos de solicitação da proposta
      const collections = await storage.getInterCollectionsByProposalId(propostaId);
      
      if (!collections || collections.length === 0) {
        console.log(`[BOLETO STORAGE] ⚠️ Nenhum boleto encontrado para proposta ${propostaId}`);
        return result;
      }

      result.totalBoletos = collections.length;
      console.log(`[BOLETO STORAGE] 📊 Encontrados ${collections.length} boletos para processar`);

      // 2. Loop sequencial para processar cada boleto
      for (const collection of collections) {
        const { codigoSolicitacao, numeroParcela } = collection;
        
        console.log(`[BOLETO STORAGE] 📄 Processando boleto ${numeroParcela}/${collections.length} - Código: ${codigoSolicitacao}`);
        
        try {
          // 2.1. Baixar PDF do Banco Inter
          console.log(`[BOLETO STORAGE] ⬇️ Baixando PDF do Banco Inter...`);
          const pdfBuffer = await interBankService.obterPdfCobranca(codigoSolicitacao);
          
          if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error('PDF vazio ou inválido recebido do Banco Inter');
          }
          
          console.log(`[BOLETO STORAGE] ✅ PDF baixado com sucesso (${pdfBuffer.length} bytes)`);
          
          // 2.2. Definir caminho no Storage
          const caminhoArquivo = `propostas/${propostaId}/boletos/emitidos_pendentes/${codigoSolicitacao}.pdf`;
          
          // 2.3. Upload para Supabase Storage
          console.log(`[BOLETO STORAGE] 📤 Fazendo upload para: ${caminhoArquivo}`);
          
          const { data: uploadData, error: uploadError } = await this.supabase.storage
            .from('documents')
            .upload(caminhoArquivo, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: true // Sobrescrever se já existir
            });
          
          if (uploadError) {
            throw new Error(`Erro no upload: ${uploadError.message}`);
          }
          
          console.log(`[BOLETO STORAGE] ✅ Upload concluído: ${caminhoArquivo}`);
          
          result.boletosProcessados++;
          result.caminhosPdf.push(caminhoArquivo);
          
          // Adicionar delay entre requisições para evitar rate limiting
          await this.delay(500); // 500ms entre cada boleto
          
        } catch (error: any) {
          console.error(`[BOLETO STORAGE] ❌ Erro ao processar boleto ${codigoSolicitacao}:`, error);
          
          result.boletosComErro++;
          result.erros.push({
            codigoSolicitacao,
            erro: error.message || 'Erro desconhecido'
          });
          
          // Continuar processando outros boletos mesmo se um falhar
          continue;
        }
      }

      // 3. Determinar sucesso geral
      result.success = result.boletosProcessados > 0;
      
      // 4. Log final
      console.log(`[BOLETO STORAGE] 📊 Sincronização concluída:`);
      console.log(`[BOLETO STORAGE]   - Total: ${result.totalBoletos}`);
      console.log(`[BOLETO STORAGE]   - Processados: ${result.boletosProcessados}`);
      console.log(`[BOLETO STORAGE]   - Com erro: ${result.boletosComErro}`);
      
      if (result.erros.length > 0) {
        console.log(`[BOLETO STORAGE] ⚠️ Erros encontrados:`, result.erros);
      }

      return result;
      
    } catch (error: any) {
      console.error(`[BOLETO STORAGE] ❌ Erro crítico na sincronização:`, error);
      
      result.success = false;
      result.erros.push({
        codigoSolicitacao: 'GERAL',
        erro: error.message || 'Erro crítico desconhecido'
      });
      
      return result;
    }
  }

  /**
   * Verifica se um boleto já existe no Storage
   */
  async verificarBoletoExiste(propostaId: string, codigoSolicitacao: string): Promise<boolean> {
    try {
      const caminhoArquivo = `propostas/${propostaId}/boletos/emitidos_pendentes/${codigoSolicitacao}.pdf`;
      
      const { data, error } = await this.supabase.storage
        .from('documents')
        .list(`propostas/${propostaId}/boletos/emitidos_pendentes`, {
          limit: 1,
          search: `${codigoSolicitacao}.pdf`
        });
      
      if (error) {
        console.error(`[BOLETO STORAGE] Erro ao verificar existência:`, error);
        return false;
      }
      
      return data && data.length > 0;
      
    } catch (error) {
      console.error(`[BOLETO STORAGE] Erro ao verificar boleto:`, error);
      return false;
    }
  }

  /**
   * Lista todos os boletos salvos de uma proposta
   */
  async listarBoletosSalvos(propostaId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase.storage
        .from('documents')
        .list(`propostas/${propostaId}/boletos/emitidos_pendentes`, {
          limit: 100
        });
      
      if (error) {
        console.error(`[BOLETO STORAGE] Erro ao listar boletos:`, error);
        return [];
      }
      
      return data?.map((file: any) => file.name) || [];
      
    } catch (error) {
      console.error(`[BOLETO STORAGE] Erro ao listar:`, error);
      return [];
    }
  }

  /**
   * Remove boletos salvos de uma proposta (útil para re-sincronização)
   */
  async limparBoletosSalvos(propostaId: string): Promise<boolean> {
    try {
      const boletos = await this.listarBoletosSalvos(propostaId);
      
      if (boletos.length === 0) {
        return true;
      }
      
      const caminhos = boletos.map(
        nome => `propostas/${propostaId}/boletos/emitidos_pendentes/${nome}`
      );
      
      const { data, error } = await this.supabase.storage
        .from('documents')
        .remove(caminhos);
      
      if (error) {
        console.error(`[BOLETO STORAGE] Erro ao limpar boletos:`, error);
        return false;
      }
      
      console.log(`[BOLETO STORAGE] ${caminhos.length} boletos removidos`);
      return true;
      
    } catch (error) {
      console.error(`[BOLETO STORAGE] Erro ao limpar:`, error);
      return false;
    }
  }

  /**
   * Gera um carnê (PDF consolidado) a partir dos boletos salvos no Storage
   * @param propostaId ID da proposta
   * @returns URL do carnê gerado ou erro
   */
  async gerarCarneDoStorage(propostaId: string): Promise<{ success: boolean; url?: string; error?: string }> {
    console.log(`[CARNE DEBUG] Iniciando geração de carnê para a proposta ${propostaId}`);
    
    try {
      // 1. LISTAR FICHEIROS: Listar todos os PDFs na pasta emitidos_pendentes
      console.log(`[CARNE DEBUG] Listando ficheiros em propostas/${propostaId}/boletos/emitidos_pendentes/`);
      
      const { data: files, error: listError } = await this.supabase.storage
        .from('documents')
        .list(`propostas/${propostaId}/boletos/emitidos_pendentes`, {
          limit: 100,
          sortBy: { column: 'name', order: 'asc' }
        });
      
      if (listError) {
        console.log(`[CARNE DEBUG] ❌ Erro ao listar ficheiros:`, listError);
        throw new Error(`Erro ao listar ficheiros: ${listError.message}`);
      }
      
      if (!files || files.length === 0) {
        console.log(`[CARNE DEBUG] ⚠️ Nenhum ficheiro encontrado na pasta`);
        throw new Error('Nenhum boleto encontrado no Storage para esta proposta');
      }
      
      console.log(`[CARNE DEBUG] ${files.length} ficheiros encontrados.`);
      
      // 2. DOWNLOAD EM LOTE DO STORAGE
      console.log(`[CARNE DEBUG] Iniciando download dos buffers do Storage...`);
      
      const pdfBuffers: Buffer[] = [];
      const errors: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = `propostas/${propostaId}/boletos/emitidos_pendentes/${file.name}`;
        
        try {
          console.log(`[CARNE DEBUG] Baixando ficheiro: ${file.name}`);
          
          // Download do ficheiro
          const { data: fileData, error: downloadError } = await this.supabase.storage
            .from('documents')
            .download(filePath);
          
          if (downloadError) {
            console.log(`[CARNE DEBUG] ❌ Erro no download de ${file.name}:`, downloadError);
            throw new Error(`Erro no download: ${downloadError.message}`);
          }
          
          if (!fileData) {
            console.log(`[CARNE DEBUG] ⚠️ Ficheiro vazio: ${file.name}`);
            throw new Error('Ficheiro vazio');
          }
          
          // Converter Blob para Buffer
          const arrayBuffer = await fileData.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Validar PDF
          const pdfMagic = buffer.slice(0, 5).toString('ascii');
          if (!pdfMagic.startsWith('%PDF')) {
            console.log(`[CARNE DEBUG] ⚠️ Ficheiro ${file.name} não é PDF válido. Magic bytes: ${pdfMagic}`);
            throw new Error('Ficheiro não é um PDF válido');
          }
          
          pdfBuffers.push(buffer);
          console.log(`[CARNE DEBUG] ✅ Buffer de ${file.name} adicionado (${buffer.length} bytes)`);
          
        } catch (error: any) {
          console.error(`[CARNE DEBUG] ❌ Erro ao processar ${file.name}:`, error.message);
          errors.push(`${file.name}: ${error.message}`);
        }
      }
      
      if (pdfBuffers.length === 0) {
        console.log(`[CARNE DEBUG] ❌ Nenhum PDF válido foi baixado`);
        throw new Error('Nenhum PDF válido foi baixado do Storage');
      }
      
      console.log(`[CARNE DEBUG] Download de todos os ${pdfBuffers.length} buffers concluído. Iniciando fusão com pdf-lib...`);
      
      // 3. LÓGICA DE FUSÃO COM PDF-LIB
      const mergedPdf = await PDFDocument.create();
      let totalPages = 0;
      
      for (let i = 0; i < pdfBuffers.length; i++) {
        try {
          console.log(`[CARNE DEBUG] Processando PDF ${i + 1} de ${pdfBuffers.length}...`);
          
          const pdfDoc = await PDFDocument.load(pdfBuffers[i], {
            ignoreEncryption: true,
            throwOnInvalidObject: false
          });
          
          const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
          pages.forEach(page => {
            mergedPdf.addPage(page);
            totalPages++;
          });
          
          console.log(`[CARNE DEBUG] PDF ${i + 1} adicionado com ${pages.length} páginas`);
          
        } catch (error: any) {
          console.error(`[CARNE DEBUG] ⚠️ Erro ao processar PDF ${i + 1}:`, error.message);
          // Continuar mesmo se um PDF falhar
        }
      }
      
      if (totalPages === 0) {
        console.log(`[CARNE DEBUG] ❌ Nenhuma página foi adicionada ao carnê`);
        throw new Error('Nenhuma página foi adicionada ao carnê');
      }
      
      // Gerar buffer do PDF final
      const mergedPdfBytes = await mergedPdf.save();
      const mergedBuffer = Buffer.from(mergedPdfBytes);
      
      console.log(`[CARNE DEBUG] Fusão concluída com sucesso. Tamanho do carnê: ${mergedBuffer.length} bytes. Iniciando upload para o Storage...`);
      
      // 4. UPLOAD DO CARNÊ
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
      const carnePath = `propostas/${propostaId}/carnes/carne-${timestamp}.pdf`;
      
      console.log(`[CARNE DEBUG] Fazendo upload para: ${carnePath}`);
      
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('documents')
        .upload(carnePath, mergedBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });
      
      if (uploadError) {
        console.log(`[CARNE DEBUG] ❌ Erro no upload:`, uploadError);
        throw new Error(`Erro no upload do carnê: ${uploadError.message}`);
      }
      
      console.log(`[CARNE DEBUG] Upload do carnê concluído. Gerando URL assinada...`);
      
      // 5. GERAR URL ASSINADA
      const { data: urlData, error: urlError } = await this.supabase.storage
        .from('documents')
        .createSignedUrl(carnePath, 86400); // URL válida por 24 horas
      
      if (urlError) {
        console.log(`[CARNE DEBUG] ❌ Erro ao gerar URL:`, urlError);
        throw new Error(`Erro ao gerar URL: ${urlError.message}`);
      }
      
      console.log(`[CARNE DEBUG] URL do carnê gerada com sucesso.`);
      
      return {
        success: true,
        url: urlData.signedUrl
      };
      
    } catch (error: any) {
      console.error(`[CARNE STORAGE] ❌ Erro crítico na geração do carnê:`, error);
      
      return {
        success: false,
        error: error.message || 'Erro desconhecido'
      };
    }
  }

  /**
   * Delay helper para evitar rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Exportar instância singleton
export const boletoStorageService = new BoletoStorageService();