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
   * Delay helper para evitar rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Exportar instância singleton
export const boletoStorageService = new BoletoStorageService();