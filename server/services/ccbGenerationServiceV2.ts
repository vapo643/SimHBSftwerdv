/**
 * Serviço de Geração CCB V2 - Com Detecção Inteligente de Campos
 * Sistema à prova de falhas com múltiplas estratégias de preenchimento
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { createServerSupabaseAdminClient } from '../lib/supabase';
import { CCB_FIELD_MAPPING_V2, FieldDetector, FallbackSystem } from './ccbFieldMappingV2';

export class CCBGenerationServiceV2 {
  private supabaseAdmin;
  private templatePath: string;
  private logs: string[] = [];
  
  constructor() {
    this.supabaseAdmin = createServerSupabaseAdminClient();
    this.templatePath = path.resolve(process.cwd(), 'server/templates/template_ccb.pdf');
  }
  
  /**
   * Gera CCB com sistema inteligente de detecção e preenchimento
   */
  async generateCCB(propostaData: any): Promise<{ success: boolean; pdfBytes?: Uint8Array; logs?: string[] }> {
    try {
      this.log('🚀 Iniciando geração CCB V2 com detecção inteligente');
      
      // 1. Carregar template
      const templateBytes = await fs.readFile(this.templatePath);
      const pdfDoc = await PDFDocument.load(templateBytes);
      
      // 2. Configurar fontes
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // 3. Inicializar detector inteligente
      const detector = new FieldDetector(pdfDoc);
      
      // 4. Preparar dados com todos os campos necessários
      const dadosCompletos = this.prepararDados(propostaData);
      
      // 5. Executar detecção e preenchimento inteligente
      await detector.detectAndFillFields(dadosCompletos, helvetica);
      
      // 6. Obter logs do detector
      const detectorLogs = detector.getLogs();
      this.logs.push(...detectorLogs);
      
      // 7. Aplicar fallback para campos críticos
      await this.applyFallbackForCriticalFields(pdfDoc, dadosCompletos, helvetica);
      
      // 8. Adicionar metadados
      this.addMetadata(pdfDoc, propostaData);
      
      // 9. Salvar PDF
      const pdfBytes = await pdfDoc.save();
      
      this.log('✅ CCB gerado com sucesso usando detecção inteligente');
      
      return {
        success: true,
        pdfBytes,
        logs: this.logs
      };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`❌ Erro na geração: ${errorMsg}`);
      
      return {
        success: false,
        logs: this.logs
      };
    }
  }
  
  /**
   * Prepara dados completos para preenchimento
   */
  private prepararDados(proposta: any): any {
    const hoje = new Date();
    const dataEmissao = hoje.toLocaleDateString('pt-BR');
    
    // Calcular parcelas
    const valorTotal = parseFloat(proposta.valor || proposta.valorEmprestimo || 0);
    const numeroParcelas = parseInt(proposta.prazo || 1);
    const valorParcela = valorTotal / numeroParcelas;
    
    return {
      // Identificação
      id: proposta.id,
      numeroCcb: `CCB-${proposta.id?.slice(0, 8) || 'NOVO'}`,
      dataEmissao,
      
      // Dados do cliente
      clienteNome: proposta.clienteNome || proposta.cliente_nome || '',
      clienteCpf: this.formatCPF(proposta.clienteCpf || proposta.cliente_cpf || ''),
      clienteRg: proposta.clienteRg || proposta.cliente_rg || '',
      clienteEndereco: proposta.clienteEndereco || proposta.cliente_endereco || '',
      
      // Dados do empréstimo
      valor: valorTotal,
      valorEmprestimo: valorTotal,
      prazo: numeroParcelas,
      valorParcela,
      finalidade: proposta.finalidade || 'Empréstimo Pessoal',
      taxaJuros: proposta.taxaJuros || proposta.taxa_juros || '',
      cet: this.calcularCET(valorTotal, valorParcela, numeroParcelas),
      
      // Dados bancários de destino
      dadosPagamentoBanco: proposta.dadosPagamentoBanco || proposta.dados_pagamento_banco || '',
      dadosPagamentoAgencia: proposta.dadosPagamentoAgencia || proposta.dados_pagamento_agencia || '',
      dadosPagamentoConta: proposta.dadosPagamentoConta || proposta.dados_pagamento_conta || '',
      dadosPagamentoTipo: proposta.dadosPagamentoTipo || proposta.dados_pagamento_tipo || '',
      dadosPagamentoNomeTitular: proposta.dadosPagamentoNomeTitular || proposta.dados_pagamento_nome_titular || '',
      dadosPagamentoCpfTitular: proposta.dadosPagamentoCpfTitular || proposta.dados_pagamento_cpf_titular || '',
      
      // Vencimentos
      dataVencimento: this.calcularPrimeiroVencimento(),
      
      // Linhas digitáveis (se houver)
      linhaDigitavel: proposta.linhaDigitavel || '',
      
      // Dados da empresa
      empresaNome: 'SIMPIX LTDA',
      empresaCnpj: '00.000.000/0001-00',
      empresaEndereco: 'Rua Principal, 123 - Centro - São Paulo/SP'
    };
  }
  
  /**
   * Aplica fallback para campos críticos que devem sempre ser preenchidos
   */
  private async applyFallbackForCriticalFields(
    pdfDoc: PDFDocument,
    dados: any,
    font: any
  ): Promise<void> {
    const pages = pdfDoc.getPages();
    const camposCriticos = ['numeroCedula', 'nomeRazaoSocial', 'cpfCnpj', 'valorPrincipal'];
    
    for (const campo of camposCriticos) {
      const coord = CCB_FIELD_MAPPING_V2[campo];
      if (!coord) continue;
      
      const pageIndex = coord.page - 1;
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];
        const valor = this.getValorCampo(campo, dados);
        
        if (valor) {
          const sucesso = await FallbackSystem.fillWithFallback(
            page,
            campo,
            valor,
            coord,
            font
          );
          
          if (sucesso) {
            this.log(`✓ Campo crítico ${campo} preenchido via fallback`);
          } else {
            this.log(`⚠ Falha no preenchimento do campo crítico ${campo}`);
          }
        }
      }
    }
  }
  
  /**
   * Obtém valor do campo baseado no nome
   */
  private getValorCampo(campo: string, dados: any): string {
    const mapeamento: { [key: string]: string } = {
      numeroCedula: dados.numeroCcb,
      nomeRazaoSocial: dados.clienteNome,
      cpfCnpj: dados.clienteCpf,
      valorPrincipal: this.formatarMoeda(dados.valor)
    };
    
    return mapeamento[campo] || '';
  }
  
  /**
   * Adiciona metadados ao PDF
   */
  private addMetadata(pdfDoc: PDFDocument, proposta: any): void {
    pdfDoc.setTitle(`CCB - ${proposta.clienteNome || 'Cliente'}`);
    pdfDoc.setSubject(`Cédula de Crédito Bancário - Proposta ${proposta.id}`);
    pdfDoc.setKeywords(['CCB', 'Crédito', 'Simpix', proposta.id]);
    pdfDoc.setProducer('Simpix Sistema de Crédito V2');
    pdfDoc.setCreator('CCB Generation Service V2');
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());
  }
  
  /**
   * Formata CPF
   */
  private formatCPF(cpf: string): string {
    if (!cpf) return '';
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  
  /**
   * Formata valor monetário
   */
  private formatarMoeda(valor: number): string {
    if (!valor) return 'R$ 0,00';
    return `R$ ${valor.toFixed(2).replace('.', ',')}`;
  }
  
  /**
   * Calcula CET aproximado
   */
  private calcularCET(valorTotal: number, valorParcela: number, numeroParcelas: number): string {
    if (!valorTotal || !valorParcela || !numeroParcelas) return '0,00% a.m.';
    
    const totalPago = valorParcela * numeroParcelas;
    const jurosTotal = totalPago - valorTotal;
    const taxaMensal = (jurosTotal / valorTotal / numeroParcelas) * 100;
    
    return `${taxaMensal.toFixed(2).replace('.', ',')}% a.m.`;
  }
  
  /**
   * Calcula primeiro vencimento (30 dias)
   */
  private calcularPrimeiroVencimento(): string {
    const data = new Date();
    data.setDate(data.getDate() + 30);
    return data.toLocaleDateString('pt-BR');
  }
  
  /**
   * Registra log
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.logs.push(logMessage);
    console.log(logMessage);
  }
  
  /**
   * Salva CCB no storage
   */
  async saveCCBToStorage(pdfBytes: Uint8Array, propostaId: string): Promise<string | null> {
    try {
      const fileName = `ccb_${propostaId}_${Date.now()}.pdf`;
      const filePath = `ccb/${fileName}`;
      
      const { data, error } = await this.supabaseAdmin.storage
        .from('documents')
        .upload(filePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true
        });
      
      if (error) {
        this.log(`❌ Erro ao salvar no storage: ${error.message}`);
        return null;
      }
      
      this.log(`✅ CCB salvo no storage: ${filePath}`);
      return filePath;
      
    } catch (error) {
      this.log(`❌ Erro ao salvar CCB: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Obtém URL pública temporária do CCB
   */
  async getCCBPublicUrl(filePath: string): Promise<string | null> {
    try {
      const { data } = await this.supabaseAdmin.storage
        .from('documents')
        .createSignedUrl(filePath, 3600); // 1 hora de validade
      
      return data?.signedUrl || null;
      
    } catch (error) {
      this.log(`❌ Erro ao gerar URL: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}