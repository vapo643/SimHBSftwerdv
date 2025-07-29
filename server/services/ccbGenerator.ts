import { createServerSupabaseAdminClient } from '../lib/supabase';
import { PDFTemplateEngine, CCB_TEMPLATE } from './pdfTemplateEngine';
import { TemplateManager } from './templateManager';

interface ClientData {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  rg?: string;
  orgaoEmissor?: string;
  estadoCivil?: string;
  nacionalidade?: string;
  cep?: string;
  endereco?: string;
  ocupacao?: string;
  rendaMensal?: number;
}

interface CondicoesData {
  valor: number;
  prazo: number;
  finalidade?: string;
  valorTac?: number;
  valorIof?: number;
  valorTotalFinanciado?: number;
  parcela?: number;
  taxaJuros?: number;
}

export async function generateCCB(propostaId: string, templateId?: string): Promise<string> {
  try {
    console.log(`🔄 [CCB Generator] Iniciando geração de CCB com template para proposta ${propostaId}`);
    
    const supabase = createServerSupabaseAdminClient();
    
    // 1. Buscar dados da proposta
    const { data: proposta, error: propostaError } = await supabase
      .from('propostas')
      .select(`
        *,
        lojas (
          id,
          nome_loja,
          parceiros (
            id,
            razao_social,
            cnpj
          )
        )
      `)
      .eq('id', propostaId)
      .single();
    
    if (propostaError || !proposta) {
      throw new Error(`Proposta ${propostaId} não encontrada`);
    }

    // 2. Obter template
    const template = templateId ? 
      await TemplateManager.getTemplate(templateId) : 
      CCB_TEMPLATE;
    
    if (!template) {
      throw new Error(`Template ${templateId} não encontrado`);
    }

    // 3. Preparar dados para o template
    const clienteData = proposta.cliente_data as ClientData;
    const condicoesData = proposta.condicoes_data as CondicoesData;
    
    const templateData = {
      propostaId,
      dataEmissao: new Date(),
      dataVencimento: (() => {
        const vencimento = new Date();
        vencimento.setMonth(vencimento.getMonth() + (condicoesData.prazo || 12));
        return vencimento;
      })(),
      clienteData,
      condicoesData: {
        ...condicoesData,
        prazoMeses: `${condicoesData.prazo || 0} meses`
      },
      credorData: {
        razaoSocial: proposta.lojas?.parceiros?.razao_social || 'Sistema Simpix - Gestão de Crédito',
        cnpj: proposta.lojas?.parceiros?.cnpj || '00.000.000/0001-00'
      },
      pagamentoInfo: [
        '• Parcelas mensais, fixas e consecutivas',
        '• Vencimento da 1ª parcela: 30 dias após a liberação do crédito',
        `• Vencimento das demais: todo dia ${new Date().getDate()} dos meses subsequentes`
      ].join('\n'),
      clausulasGerais: [
        '1. VENCIMENTO ANTECIPADO: O não pagamento de qualquer parcela na data do vencimento acarretará o vencimento antecipado de toda a dívida.',
        '2. JUROS DE MORA: Em caso de inadimplemento, serão cobrados juros de mora de 1% ao mês.',
        '3. MULTA: Será aplicada multa de 2% sobre o valor da parcela em atraso.',
        '4. FORO: Fica eleito o foro da comarca de São Paulo/SP para dirimir questões oriundas desta cédula.'
      ].join('\n'),
      localData: `São Paulo/SP, ${new Date().toLocaleDateString('pt-BR')}`,
      assinaturaDevedor: [
        '_'.repeat(35),
        clienteData.nome,
        `CPF: ${clienteData.cpf}`
      ].join('\n'),
      assinaturaCredor: [
        '_'.repeat(35),
        'Sistema Simpix',
        'CNPJ: 00.000.000/0001-00'
      ].join('\n')
    };

    // 4. Gerar PDF usando template engine
    const templateEngine = new PDFTemplateEngine(template, templateData);
    const pdfBuffer = await templateEngine.generate();
    
    console.log(`📊 [CCB Generator] PDF criado com template - Tamanho: ${pdfBuffer.length} bytes`);
    
    // 5. Upload para Supabase
    const timestamp = Date.now();
    const filePath = `ccb/CCB-${propostaId}-${timestamp}.pdf`;
    
    console.log(`🔄 [CCB Generator] Upload para: ${filePath}`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
        metadata: {
          'proposta-id': propostaId,
          'document-type': 'ccb',
          'template-id': template.id,
          'generated-by': 'simpix-template-engine'
        }
      });
    
    if (uploadError) {
      console.error('Erro no upload:', uploadError);
      throw new Error(`Erro no upload: ${uploadError.message}`);
    }
    
    console.log(`✅ [CCB Generator] Upload concluído: ${uploadData.path}`);
    
    // 6. Atualizar proposta
    const { error: updateError } = await supabase
      .from('propostas')
      .update({
        ccb_gerado: true,
        caminho_ccb_assinado: uploadData.path
      })
      .eq('id', propostaId);
    
    if (updateError) {
      console.error('Erro ao atualizar proposta:', updateError);
      throw new Error(`Erro ao atualizar proposta: ${updateError.message}`);
    }
    
    console.log(`✅ [CCB Generator] CCB gerada com sucesso para ${propostaId} usando template ${template.id}`);
    return uploadData.path;
    
  } catch (error) {
    console.error(`❌ [CCB Generator] Erro geral:`, error);
    throw error;
  }
}