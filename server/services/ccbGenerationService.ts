/**
 * Serviço de Geração de CCB (Cédula de Crédito Bancário)
 * Utiliza template PDF existente e preenche com dados da proposta
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { supabase } from '../lib/supabase';
import { db } from '../lib/supabase';
import { sql } from 'drizzle-orm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PropostaData {
  id: string;
  cliente_nome: string;
  cliente_cpf: string;
  cliente_endereco?: string;
  cliente_cidade?: string;
  cliente_estado?: string;
  cliente_cep?: string;
  valor_liberado: number;
  prazo: number;
  taxa_juros: number;
  valor_total: number;
  valor_parcela: number;
  data_primeiro_vencimento?: Date;
  numero_contrato?: string;
  created_at: Date;
}

export class CCBGenerationService {
  private templatePath: string;

  constructor() {
    this.templatePath = path.join(process.cwd(), 'server', 'templates', 'template_ccb.pdf');
  }

  /**
   * Gera CCB preenchendo o template PDF com dados da proposta
   */
  async generateCCB(proposalId: string): Promise<{ success: boolean; pdfPath?: string; error?: string }> {
    try {
      console.log(`📄 [CCB] Iniciando geração para proposta ${proposalId}`);

      // 1. Buscar dados da proposta
      const proposalData = await this.getProposalData(proposalId);
      if (!proposalData) {
        return { success: false, error: 'Proposta não encontrada' };
      }

      // 2. Carregar template PDF
      const templateBytes = await fs.readFile(this.templatePath);
      const pdfDoc = await PDFDocument.load(templateBytes);
      
      // 3. Adicionar fonte
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      // 4. Pegar a primeira página
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      
      // 5. Adicionar texto nas posições corretas
      await this.addTextToPage(firstPage, font, proposalData);
      
      // 6. Salvar PDF preenchido
      const pdfBytes = await pdfDoc.save();
      
      // 7. Upload para Supabase Storage
      const fileName = `ccb_${proposalId}_${Date.now()}.pdf`;
      const filePath = `ccb/${proposalId}/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        console.error('❌ [CCB] Erro no upload:', uploadError);
        return { success: false, error: 'Erro ao fazer upload do PDF' };
      }

      // 8. Atualizar banco de dados
      await db.execute(sql`
        UPDATE propostas 
        SET 
          ccb_gerado = true,
          caminho_ccb = ${filePath},
          ccb_gerado_em = NOW()
        WHERE id = ${proposalId}
      `);

      // 9. Registrar log
      await db.execute(sql`
        INSERT INTO proposta_logs (
          proposta_id,
          acao,
          detalhes,
          usuario_id,
          created_at
        ) VALUES (
          ${proposalId},
          'CCB_GERADO',
          ${{ caminho: filePath, tamanho: pdfBytes.length }},
          'system',
          NOW()
        )
      `);

      console.log(`✅ [CCB] Geração concluída para proposta ${proposalId}`);
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
   * Busca dados completos da proposta
   */
  private async getProposalData(proposalId: string): Promise<PropostaData | null> {
    try {
      const result = await db.execute(sql`
        SELECT 
          p.id,
          p.cliente_nome,
          p.cliente_cpf,
          p.cliente_endereco,
          p.cliente_cidade,
          p.cliente_estado,
          p.cliente_cep,
          p.valor_liberado,
          p.prazo,
          p.taxa_juros,
          p.valor_total,
          p.valor_parcela,
          p.data_primeiro_vencimento,
          p.numero_contrato,
          p.created_at,
          pr.nome as produto_nome,
          l.nome as loja_nome
        FROM propostas p
        LEFT JOIN produtos pr ON p.produto_id = pr.id
        LEFT JOIN lojas l ON p.loja_id = l.id
        WHERE p.id = ${proposalId}
      `);

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as PropostaData;
    } catch (error) {
      console.error('❌ [CCB] Erro ao buscar dados da proposta:', error);
      return null;
    }
  }

  /**
   * Adiciona texto diretamente na página do PDF
   */
  private async addTextToPage(page: any, font: any, data: PropostaData): Promise<void> {
    try {
      const { width, height } = page.getSize();
      const fontSize = 10;
      const color = rgb(0, 0, 0);
      
      // Coordenadas baseadas no template CCB fornecido
      // Ajustadas para corresponder ao layout do PDF
      
      // SEÇÃO I - EMITENTE
      // Nome/Razão Social
      page.drawText(data.cliente_nome || '', {
        x: 50,
        y: height - 175,
        size: fontSize,
        font,
        color
      });
      
      // CPF/CNPJ
      page.drawText(this.formatCPF(data.cliente_cpf) || '', {
        x: 450,
        y: height - 175,
        size: fontSize,
        font,
        color
      });
      
      // Endereço
      if (data.cliente_endereco) {
        page.drawText(data.cliente_endereco, {
          x: 50,
          y: height - 230,
          size: fontSize,
          font,
          color
        });
      }
      
      // CEP
      if (data.cliente_cep) {
        page.drawText(this.formatCEP(data.cliente_cep), {
          x: 320,
          y: height - 230,
          size: fontSize,
          font,
          color
        });
      }
      
      // Cidade
      if (data.cliente_cidade) {
        page.drawText(data.cliente_cidade, {
          x: 400,
          y: height - 230,
          size: fontSize,
          font,
          color
        });
      }
      
      // UF
      if (data.cliente_estado) {
        page.drawText(data.cliente_estado, {
          x: 540,
          y: height - 230,
          size: fontSize,
          font,
          color
        });
      }
      
      // SEÇÃO III - CONDIÇÕES E CARACTERÍSTICAS
      // Valor de Principal
      page.drawText(this.formatCurrency(data.valor_liberado), {
        x: 50,
        y: height - 380,
        size: fontSize,
        font,
        color
      });
      
      // Data de Emissão
      page.drawText(format(new Date(), 'dd/MM/yyyy', { locale: ptBR }), {
        x: 175,
        y: height - 380,
        size: fontSize,
        font,
        color
      });
      
      // Prazo de Amortização
      page.drawText(`${data.prazo} mês(es)`, {
        x: 50,
        y: height - 410,
        size: fontSize,
        font,
        color
      });
      
      // Taxa de Juros
      page.drawText(`${data.taxa_juros}%`, {
        x: 370,
        y: height - 410,
        size: fontSize,
        font,
        color
      });
      
      // Valor da Parcela (adicionando na tabela de parcelas)
      const numParcelas = data.prazo || 12;
      const valorParcela = this.formatCurrency(data.valor_parcela);
      let yPosition = height - 570;
      
      for (let i = 1; i <= Math.min(numParcelas, 12); i++) {
        // Número da parcela
        page.drawText(String(i), {
          x: 50,
          y: yPosition,
          size: fontSize,
          font,
          color
        });
        
        // Valor da parcela
        page.drawText(valorParcela, {
          x: 450,
          y: yPosition,
          size: fontSize,
          font,
          color
        });
        
        yPosition -= 20;
      }
      
      // Número da Cédula (usando o ID da proposta)
      page.drawText(data.id, {
        x: 50,
        y: height - 115,
        size: fontSize,
        font,
        color
      });
      
      // Data de Emissão (no cabeçalho)
      page.drawText(format(new Date(), 'dd/MM/yyyy', { locale: ptBR }), {
        x: 250,
        y: height - 115,
        size: fontSize,
        font,
        color
      });
      
      // Finalidade da Operação
      page.drawText('Empréstimo Pessoal', {
        x: 450,
        y: height - 115,
        size: fontSize,
        font,
        color
      });

    } catch (error) {
      console.error('❌ [CCB] Erro ao adicionar texto:', error);
      throw error;
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
      const { data } = supabase.storage
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

      const proposal = result.rows[0];
      return proposal?.ccb_gerado === true && !!proposal?.caminho_ccb;
    } catch (error) {
      console.error('❌ [CCB] Erro ao verificar status:', error);
      return false;
    }
  }
}

// Export singleton instance
export const ccbGenerationService = new CCBGenerationService();