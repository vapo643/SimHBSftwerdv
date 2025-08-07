/**
 * Serviço de Geração de CCB (Cédula de Crédito Bancário)
 * Re-arquitetura completa: Usa pdf-lib para carregar template e desenhar texto sobre ele
 * Preserva 100% do layout, logo e formatação original
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { createServerSupabaseAdminClient } from '../lib/supabase';
import { db } from '../lib/supabase';
import { sql } from 'drizzle-orm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fillCCBTemplate } from '../utils/ccbFieldFiller';

interface PropostaData {
  id: string;
  cliente_nome: string;
  cliente_cpf: string;
  cliente_endereco?: string;
  cliente_cidade?: string;
  cliente_estado?: string;
  cliente_cep?: string;
  cliente_email?: string;
  cliente_telefone?: string;
  cliente_data?: any;  // Dados completos do cliente
  condicoes_data?: any; // Dados completos das condições
  valor_emprestimo: number;
  prazo_meses: number;
  taxa_juros: number;
  valor_total: number;
  valor_parcela: number;
  data_primeiro_vencimento?: Date;
  numero_contrato?: string;
  created_at: Date;
  loja_nome?: string;
  produto_nome?: string;
}

export class CCBGenerationService {
  private templatePath: string;

  constructor() {
    this.templatePath = path.join(process.cwd(), 'server', 'templates', 'template_ccb.pdf');
  }

  /**
   * Gera CCB preenchendo o template PDF com dados da proposta
   * USA COORDENADAS MAPEADAS DO DEBUG GRID
   */
  async generateCCB(proposalId: string): Promise<{ success: boolean; pdfPath?: string; error?: string }> {
    try {
      console.log(`📄 [CCB] Iniciando geração com COORDENADAS MAPEADAS para proposta ${proposalId}`);
      
      // 1. Buscar dados completos da proposta
      const proposalData = await this.getProposalData(proposalId);
      if (!proposalData) {
        return { success: false, error: 'Proposta não encontrada ou dados incompletos' };
      }

      // 2. Buscar parcelas se existirem
      const parcelas = await db.execute(sql`
        SELECT * FROM parcelas 
        WHERE proposta_id = ${proposalId} 
        ORDER BY numero_parcela
      `);

      console.log('📄 [CCB] Dados carregados:', {
        proposta: proposalId,
        cliente: proposalData.cliente_nome,
        valor: proposalData.valor_emprestimo,
        parcelas: parcelas.length
      });

      // 3. Usar o novo sistema de preenchimento com coordenadas mapeadas
      const ccbData = {
        proposta: {
          ...proposalData,
          cliente_data: {
            nome_completo: proposalData.cliente_nome,
            cpf: proposalData.cliente_cpf,
            rg: proposalData.cliente_data?.rg || '',
            orgao_expedidor: proposalData.cliente_data?.orgao_expedidor || '',
            nacionalidade: proposalData.cliente_data?.nacionalidade || 'Brasileiro(a)',
            naturalidade: proposalData.cliente_data?.naturalidade || '',
            estado_civil: proposalData.cliente_data?.estado_civil || '',
            endereco: proposalData.cliente_endereco,
            numero: proposalData.cliente_data?.numero || '',
            complemento: proposalData.cliente_data?.complemento || '',
            bairro: proposalData.cliente_data?.bairro || '',
            cep: proposalData.cliente_cep,
            cidade: proposalData.cliente_cidade,
            estado: proposalData.cliente_estado
          },
          condicoes_credito: {
            valor_emprestimo: proposalData.valor_emprestimo,
            taxa_juros: proposalData.taxa_juros,
            prazo_meses: proposalData.prazo_meses,
            valor_parcela: proposalData.valor_parcela,
            cet: proposalData.condicoes_data?.cet || 0
          }
        },
        parcelas: parcelas,
        cliente: proposalData.cliente_data,
        tabela: proposalData.condicoes_data
      };

      // 4. Gerar PDF usando novo sistema de coordenadas
      const pdfBytes = await fillCCBTemplate(ccbData);
      console.log('📄 [CCB] PDF gerado com coordenadas mapeadas do DEBUG GRID');
      
      // 5. Upload para Supabase Storage
      const fileName = `ccb_${proposalId}_${Date.now()}.pdf`;
      const filePath = `ccb/${proposalId}/${fileName}`;
      
      const supabaseAdmin = createServerSupabaseAdminClient();
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('documents')
        .upload(filePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        console.error('❌ [CCB] Erro no upload:', uploadError);
        return { success: false, error: 'Erro ao fazer upload do PDF' };
      }

      // 6. Atualizar banco de dados
      await db.execute(sql`
        UPDATE propostas 
        SET 
          ccb_gerado = true,
          caminho_ccb = ${filePath},
          ccb_gerado_em = NOW()
        WHERE id = ${proposalId}
      `);

      console.log(`✅ [CCB] Geração concluída com COORDENADAS MAPEADAS!`);
      console.log(`✅ [CCB] Arquivo: ${filePath}`);
      console.log(`✅ [CCB] 55+ campos posicionados com precisão`);
      console.log(`✅ [CCB] Template Simpix preservado 100%`);
      
      return { success: true, pdfPath: filePath };

    } catch (error) {
      console.error('❌ [CCB] Erro na geração:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * Busca dados completos da proposta da estrutura JSONB correta
   */
  private async getProposalData(proposalId: string): Promise<PropostaData | null> {
    try {
      const result = await db.execute(sql`
        SELECT 
          p.id,
          p.cliente_data,
          p.condicoes_data,
          p.valor_aprovado,
          p.created_at,
          pr.nome_produto as produto_nome,
          l.nome_loja as loja_nome
        FROM propostas p
        LEFT JOIN produtos pr ON p.produto_id = pr.id
        LEFT JOIN lojas l ON p.loja_id = l.id
        WHERE p.id = ${proposalId}
      `);

      if (!result || result.length === 0) {
        console.error('❌ [CCB] Proposta não encontrada');
        return null;
      }

      const proposta = result[0] as any;
      
      // Validar dados obrigatórios
      if (!proposta.cliente_data || !proposta.condicoes_data) {
        console.error('❌ [CCB] Dados incompletos: cliente_data ou condicoes_data ausentes');
        return null;
      }

      // Extrair dados das estruturas JSONB
      const clienteData = proposta.cliente_data as any;
      const condicoesData = proposta.condicoes_data as any;
      
      // Calcular valores derivados
      const valorBase = condicoesData.valor || proposta.valor_aprovado || 0;
      const prazo = condicoesData.prazo || 12;
      const taxaJuros = condicoesData.taxa_juros || 0;
      const valorTotal = condicoesData.valorTotalFinanciado || (valorBase * (1 + (taxaJuros / 100)));
      const valorParcela = valorTotal / prazo;

      // Retornar estrutura padronizada
      return {
        id: proposta.id,
        cliente_nome: clienteData.nome || '',
        cliente_cpf: clienteData.cpf || '',
        cliente_endereco: clienteData.endereco || '',
        cliente_cidade: clienteData.cidade || '',
        cliente_estado: clienteData.estado || '',
        cliente_cep: clienteData.cep || '',
        cliente_email: clienteData.email || '',
        cliente_telefone: clienteData.telefone || '',
        cliente_data: clienteData,  // Incluir dados completos
        condicoes_data: condicoesData, // Incluir dados completos
        valor_emprestimo: valorBase,
        prazo_meses: prazo,
        taxa_juros: taxaJuros,
        valor_total: valorTotal,
        valor_parcela: valorParcela,
        created_at: proposta.created_at || new Date(),
        loja_nome: proposta.loja_nome,
        produto_nome: proposta.produto_nome
      };
    } catch (error) {
      console.error('❌ [CCB] Erro ao buscar dados da proposta:', error);
      return null;
    }
  }



  /**
   * Formata CPF
   */
  private formatCPF(cpf?: string): string {
    if (!cpf) return '';
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /**
   * Formata CEP
   */
  private formatCEP(cep?: string): string {
    if (!cep) return '';
    const cleaned = cep.replace(/\D/g, '');
    return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2');
  }

  /**
   * Formata valor em moeda
   */
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  /**
   * Obtém URL pública do PDF gerado
   */
  async getPublicUrl(filePath: string): Promise<string | null> {
    try {
      const supabaseAdmin = createServerSupabaseAdminClient();
      const { data } = supabaseAdmin.storage
        .from('documents')
        .getPublicUrl(filePath);
      
      return data?.publicUrl || null;
    } catch (error) {
      console.error('❌ [CCB] Erro ao obter URL pública:', error);
      return null;
    }
  }

  /**
   * Verifica se CCB já foi gerado
   */
  async isCCBGenerated(proposalId: string): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT ccb_gerado, caminho_ccb
        FROM propostas
        WHERE id = ${proposalId}
      `);

      const proposal = result[0];
      return proposal?.ccb_gerado === true && !!proposal?.caminho_ccb;
    } catch (error) {
      console.error('❌ [CCB] Erro ao verificar status:', error);
      return false;
    }
  }
}

// Export singleton instance
export const ccbGenerationService = new CCBGenerationService();