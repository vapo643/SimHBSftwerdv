/**
 * Serviço de Geração de CCB (Cédula de Crédito Bancário)
 * Utiliza template PDF existente e preenche com dados da proposta
 */

import { PDFDocument, PDFForm, PDFTextField, rgb } from 'pdf-lib';
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
      
      // 3. Acessar formulário do PDF
      const form = pdfDoc.getForm();
      
      // 4. Mapear e preencher campos
      await this.fillFormFields(form, proposalData);
      
      // 5. Achatar formulário (tornar campos permanentes)
      form.flatten();
      
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
   * Preenche os campos do formulário PDF
   */
  private async fillFormFields(form: PDFForm, data: PropostaData): Promise<void> {
    try {
      // Listar todos os campos disponíveis (para debug)
      const fields = form.getFields();
      console.log('📋 [CCB] Campos disponíveis no template:', fields.map(f => f.getName()));

      // Mapear campos comuns (ajustar conforme o template real)
      const fieldMappings: Record<string, string | number> = {
        // Dados do Cliente
        'nome_cliente': data.cliente_nome || '',
        'cpf_cliente': this.formatCPF(data.cliente_cpf) || '',
        'endereco_cliente': data.cliente_endereco || '',
        'cidade_cliente': data.cliente_cidade || '',
        'estado_cliente': data.cliente_estado || '',
        'cep_cliente': this.formatCEP(data.cliente_cep) || '',
        
        // Dados do Contrato
        'numero_contrato': data.numero_contrato || `SIMPIX-${data.id.slice(0, 8).toUpperCase()}`,
        'data_emissao': format(new Date(), 'dd/MM/yyyy', { locale: ptBR }),
        'valor_principal': this.formatCurrency(data.valor_liberado),
        'valor_total': this.formatCurrency(data.valor_total),
        'valor_parcela': this.formatCurrency(data.valor_parcela),
        'quantidade_parcelas': String(data.prazo),
        'taxa_juros': `${data.taxa_juros}% ao mês`,
        'data_primeiro_vencimento': data.data_primeiro_vencimento 
          ? format(new Date(data.data_primeiro_vencimento), 'dd/MM/yyyy', { locale: ptBR })
          : format(new Date(), 'dd/MM/yyyy', { locale: ptBR }),
        
        // Dados da Empresa (fixos por enquanto)
        'nome_credor': 'SIMPIX SOLUÇÕES FINANCEIRAS LTDA',
        'cnpj_credor': '00.000.000/0001-00',
        'endereco_credor': 'Av. Principal, 1000 - Centro',
        'cidade_credor': 'São Paulo - SP'
      };

      // Preencher campos
      for (const [fieldName, value] of Object.entries(fieldMappings)) {
        try {
          const field = form.getTextField(fieldName);
          if (field) {
            field.setText(String(value));
            // Opcional: estilizar o campo
            field.setFontSize(10);
            field.updateAppearances();
          } else {
            console.log(`⚠️ [CCB] Campo não encontrado: ${fieldName}`);
          }
        } catch (fieldError) {
          // Campo pode não existir no template, continuar
          console.log(`⚠️ [CCB] Campo ${fieldName} não pode ser preenchido`);
        }
      }

      // Tentar preencher campos genéricos se existirem
      this.tryFillGenericFields(form, data);

    } catch (error) {
      console.error('❌ [CCB] Erro ao preencher campos:', error);
      throw error;
    }
  }

  /**
   * Tenta preencher campos com nomes genéricos
   */
  private tryFillGenericFields(form: PDFForm, data: PropostaData): void {
    const genericMappings = [
      { patterns: ['nome', 'name', 'cliente'], value: data.cliente_nome },
      { patterns: ['cpf', 'documento'], value: this.formatCPF(data.cliente_cpf) },
      { patterns: ['valor', 'principal'], value: this.formatCurrency(data.valor_liberado) },
      { patterns: ['parcela'], value: this.formatCurrency(data.valor_parcela) },
      { patterns: ['prazo', 'meses'], value: String(data.prazo) },
      { patterns: ['juros', 'taxa'], value: `${data.taxa_juros}%` }
    ];

    const fields = form.getFields();
    
    for (const field of fields) {
      const fieldName = field.getName().toLowerCase();
      
      for (const mapping of genericMappings) {
        if (mapping.patterns.some(pattern => fieldName.includes(pattern))) {
          try {
            if (field instanceof PDFTextField && mapping.value) {
              field.setText(String(mapping.value));
              field.updateAppearances();
              console.log(`✅ [CCB] Campo genérico preenchido: ${field.getName()}`);
              break;
            }
          } catch (error) {
            // Ignorar erros em campos genéricos
          }
        }
      }
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