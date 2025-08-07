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
import { SIMPIX_CCB_MAPPING, TEST_COORDINATES, yFromTop, formatTextWithLineBreaks } from './ccbFieldMapping';
import { CoordinateAdjustment, applyCoordinateAdjustments } from './ccbCoordinateMapper';

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
   * MÉTODO CORRETO: Carrega template e desenha texto sobre ele, preservando layout
   */
  async generateCCB(proposalId: string): Promise<{ success: boolean; pdfPath?: string; error?: string }> {
    return this.generateCCBWithAdjustments(proposalId, []);
  }

  /**
   * Gera CCB com ajustes de coordenadas personalizados
   */
  async generateCCBWithAdjustments(proposalId: string, adjustments: CoordinateAdjustment[] = []): Promise<{ success: boolean; pdfPath?: string; error?: string }> {
    try {
      console.log(`📄 [CCB] Iniciando geração CORRETA para proposta ${proposalId}`);
      console.log(`📄 [CCB] Template path: ${this.templatePath}`);

      // 1. Buscar dados da proposta
      const proposalData = await this.getProposalData(proposalId);
      if (!proposalData) {
        return { success: false, error: 'Proposta não encontrada ou dados incompletos' };
      }

      console.log('📄 [CCB] Dados da proposta carregados:', {
        nome: proposalData.cliente_nome,
        cpf: proposalData.cliente_cpf,
        valor: proposalData.valor_emprestimo
      });

      // 2. CARREGAR TEMPLATE PDF EXISTENTE (NÃO criar novo!)
      console.log('📄 [CCB] Carregando template PDF existente...');
      const templateBytes = await fs.readFile(this.templatePath);
      console.log(`📄 [CCB] Template carregado: ${templateBytes.length} bytes`);
      const pdfDoc = await PDFDocument.load(templateBytes);
      console.log(`📄 [CCB] PDF carregado: ${pdfDoc.getPageCount()} páginas`);
      
      // 3. Preparar fonte para desenhar texto
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      // 4. Obter a primeira página do template
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();
      
      console.log(`📄 [CCB] Dimensões da página: ${width}x${height}`);
      
      // 5. DESENHAR TEXTO SOBRE O TEMPLATE usando mapeamento de coordenadas
      
      // Aplicar ajustes de coordenadas se fornecidos (via parâmetro adjustments)
      const mapping = adjustments && adjustments.length > 0 ? applyCoordinateAdjustments(adjustments) : SIMPIX_CCB_MAPPING;
      
      console.log(`📄 [CCB] Preenchimento com mapeamento SIMPIX (${adjustments?.length || 0} ajustes aplicados)...`);
      
      // DADOS DO CLIENTE
      const nomeCoord = mapping.nomeCliente;
      firstPage.drawText(proposalData.cliente_nome || '', {
        x: nomeCoord.x,
        y: yFromTop(height, 120), // 120px do topo
        size: nomeCoord.size,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      console.log(`📄 [CCB] Nome: "${proposalData.cliente_nome}" em x:${nomeCoord.x}, y:${yFromTop(height, 120)}`);
      
      const cpfCoord = mapping.cpfCliente;
      firstPage.drawText(this.formatCPF(proposalData.cliente_cpf) || '', {
        x: cpfCoord.x,
        y: yFromTop(height, 145), // 145px do topo
        size: cpfCoord.size,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      console.log(`📄 [CCB] CPF: "${this.formatCPF(proposalData.cliente_cpf)}" em x:${cpfCoord.x}, y:${yFromTop(height, 145)}`);
      
      // DADOS DO EMPRÉSTIMO
      const valorCoord = mapping.valorEmprestimo;
      firstPage.drawText(this.formatCurrency(proposalData.valor_emprestimo), {
        x: valorCoord.x,
        y: yFromTop(height, 240), // 240px do topo
        size: valorCoord.size,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      console.log(`📄 [CCB] Valor: "${this.formatCurrency(proposalData.valor_emprestimo)}" em x:${valorCoord.x}, y:${yFromTop(height, 240)}`);
      
      const parcelasCoord = mapping.numeroParcelas;
      firstPage.drawText(`${proposalData.prazo_meses}x`, {
        x: parcelasCoord.x,
        y: yFromTop(height, 270), // 270px do topo
        size: parcelasCoord.size,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      console.log(`📄 [CCB] Parcelas: "${proposalData.prazo_meses}x" em x:${parcelasCoord.x}, y:${yFromTop(height, 270)}`);
      
      const valorParcelaCoord = mapping.valorParcela;
      firstPage.drawText(this.formatCurrency(proposalData.valor_parcela), {
        x: valorParcelaCoord.x,
        y: yFromTop(height, 300), // 300px do topo
        size: valorParcelaCoord.size,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      console.log(`📄 [CCB] Valor parcela: "${this.formatCurrency(proposalData.valor_parcela)}" em x:${valorParcelaCoord.x}, y:${yFromTop(height, 300)}`);
      
      // DATA DE EMISSÃO
      const dataCoord = mapping.dataEmissao;
      const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      firstPage.drawText(dataAtual, {
        x: dataCoord.x,
        y: yFromTop(height, 650), // 650px do topo (parte inferior)
        size: dataCoord.size,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      console.log(`📄 [CCB] Data: "${dataAtual}" em x:${dataCoord.x}, y:${yFromTop(height, 650)}`);
      
      // TEXTO DE TESTE PARA VALIDAÇÃO VISUAL (removível após ajustes)
      const testText = adjustments && adjustments.length > 0 ? '✓ CCB COM AJUSTES' : '✓ CCB PADRÃO';
      firstPage.drawText(testText, {
        x: TEST_COORDINATES.testTitle.x,
        y: yFromTop(height, 50), // 50px do topo
        size: TEST_COORDINATES.testTitle.size,
        font: helveticaFont,
        color: rgb(...TEST_COORDINATES.testTitle.color),
      });
      console.log(`📄 [CCB] Teste visual: "${testText}" em x:${TEST_COORDINATES.testTitle.x}, y:${yFromTop(height, 50)}`);
      
      // 6. Salvar PDF com dados preenchidos
      const pdfBytes = await pdfDoc.save();
      console.log('📄 [CCB] PDF preenchido gerado com sucesso');
      
      // 7. Upload para Supabase Storage
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

      // 8. Atualizar banco de dados
      await db.execute(sql`
        UPDATE propostas 
        SET 
          ccb_gerado = true,
          caminho_ccb = ${filePath},
          ccb_gerado_em = NOW()
        WHERE id = ${proposalId}
      `);

      console.log(`✅ [CCB] Geração CORRETA concluída! Arquivo: ${filePath}`);
      console.log(`✅ [CCB] IMPORTANTE: Template preservado com logo e formatação`);
      console.log(`✅ [CCB] Dados preenchidos: Nome, CPF e Valor`);
      console.log(`✅ [CCB] Próximo passo: Ajustar coordenadas conforme feedback visual`);
      
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