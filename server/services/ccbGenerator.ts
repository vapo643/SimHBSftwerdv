import { createServerSupabaseAdminClient } from '../lib/supabase';
import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';

interface PropostaData {
  id: string;
  clienteData: any;
  condicoesData: any;
  lojaId: number;
  produtoId: number;
  tabelaComercialId: number;
  dataAprovacao: string;
}

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

export async function generateCCB(propostaId: string): Promise<string> {
  try {
    console.log(`🔄 [CCB Generator] Iniciando geração de CCB para proposta ${propostaId}`);
    
    const supabase = createServerSupabaseAdminClient();
    
    // 1. Buscar dados completos da proposta
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
        ),
        produtos (
          id,
          nome_produto,
          tac_valor,
          tac_tipo
        ),
        tabelas_comerciais (
          id,
          nome_tabela,
          taxa_juros,
          comissao
        )
      `)
      .eq('id', propostaId)
      .single();
    
    if (propostaError || !proposta) {
      throw new Error(`Proposta ${propostaId} não encontrada`);
    }
    
    const clienteData = proposta.cliente_data as ClientData;
    const condicoesData = proposta.condicoes_data as CondicoesData;
    
    // 2. Criar o documento PDF
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    
    // Header
    doc.fontSize(20).text('CÉDULA DE CRÉDITO BANCÁRIO', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(`CCB Nº ${propostaId}`, { align: 'center' });
    doc.moveDown(2);
    
    // Dados do Parceiro/Loja
    doc.fontSize(14).text('DADOS DO CREDOR', { underline: true });
    doc.fontSize(12);
    doc.text(`Razão Social: ${proposta.lojas?.parceiros?.razao_social || 'N/A'}`);
    doc.text(`CNPJ: ${proposta.lojas?.parceiros?.cnpj || 'N/A'}`);
    doc.text(`Loja: ${proposta.lojas?.nome_loja || 'N/A'}`);
    doc.moveDown();
    
    // Dados do Cliente
    doc.fontSize(14).text('DADOS DO DEVEDOR', { underline: true });
    doc.fontSize(12);
    doc.text(`Nome: ${clienteData.nome}`);
    doc.text(`CPF: ${clienteData.cpf}`);
    doc.text(`RG: ${clienteData.rg || 'N/A'} - ${clienteData.orgaoEmissor || 'N/A'}`);
    doc.text(`Estado Civil: ${clienteData.estadoCivil || 'N/A'}`);
    doc.text(`Nacionalidade: ${clienteData.nacionalidade || 'Brasileira'}`);
    doc.text(`Endereço: ${clienteData.endereco || 'N/A'} - CEP: ${clienteData.cep || 'N/A'}`);
    doc.text(`Telefone: ${clienteData.telefone}`);
    doc.text(`Email: ${clienteData.email}`);
    doc.text(`Ocupação: ${clienteData.ocupacao || 'N/A'}`);
    doc.text(`Renda Mensal: R$ ${clienteData.rendaMensal?.toFixed(2) || '0,00'}`);
    doc.moveDown();
    
    // Dados do Crédito
    doc.fontSize(14).text('DADOS DO CRÉDITO', { underline: true });
    doc.fontSize(12);
    doc.text(`Produto: ${proposta.produtos?.nome_produto || 'N/A'}`);
    doc.text(`Valor do Crédito: R$ ${condicoesData.valor?.toFixed(2) || '0,00'}`);
    doc.text(`Prazo: ${condicoesData.prazo} meses`);
    doc.text(`Taxa de Juros: ${condicoesData.taxaJuros || proposta.tabelas_comerciais?.taxa_juros || 0}% ao mês`);
    doc.text(`Valor da Parcela: R$ ${condicoesData.parcela?.toFixed(2) || '0,00'}`);
    doc.text(`IOF: R$ ${condicoesData.valorIof?.toFixed(2) || '0,00'}`);
    doc.text(`TAC: R$ ${condicoesData.valorTac?.toFixed(2) || '0,00'}`);
    doc.text(`Valor Total Financiado: R$ ${condicoesData.valorTotalFinanciado?.toFixed(2) || '0,00'}`);
    doc.text(`Finalidade: ${condicoesData.finalidade || 'Crédito Pessoal'}`);
    doc.moveDown();
    
    // Data de Aprovação
    doc.fontSize(14).text('APROVAÇÃO', { underline: true });
    doc.fontSize(12);
    const dataAprovacao = new Date(proposta.data_aprovacao);
    doc.text(`Data de Aprovação: ${dataAprovacao.toLocaleDateString('pt-BR')}`);
    doc.moveDown(2);
    
    // Cláusulas
    doc.fontSize(14).text('CLÁUSULAS E CONDIÇÕES', { underline: true });
    doc.fontSize(10);
    doc.text('1. O DEVEDOR reconhece e confessa dever ao CREDOR a quantia líquida, certa e exigível mencionada acima.');
    doc.text('2. O DEVEDOR se obriga a pagar o valor total em parcelas mensais conforme descrito.');
    doc.text('3. Em caso de inadimplência, incidirão juros de mora de 1% ao mês e multa de 2% sobre o valor devido.');
    doc.text('4. Esta cédula é título executivo extrajudicial, nos termos da Lei nº 10.931/2004.');
    doc.moveDown(2);
    
    // Assinaturas
    doc.fontSize(12);
    doc.text('Local e Data: _________________________________, ' + dataAprovacao.toLocaleDateString('pt-BR'));
    doc.moveDown(2);
    
    doc.text('_______________________________________');
    doc.text('DEVEDOR: ' + clienteData.nome);
    doc.text('CPF: ' + clienteData.cpf);
    doc.moveDown(2);
    
    doc.text('_______________________________________');
    doc.text('CREDOR: ' + (proposta.lojas?.parceiros?.razao_social || 'N/A'));
    doc.text('CNPJ: ' + (proposta.lojas?.parceiros?.cnpj || 'N/A'));
    
    // Finalizar o PDF
    doc.end();
    
    // 3. Aguardar a criação do PDF
    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
    });
    
    // 4. Fazer upload do PDF para o Supabase Storage
    const fileName = `CCB-${propostaId}-${Date.now()}.pdf`;
    const filePath = `ccb/${fileName}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });
    
    if (uploadError) {
      throw new Error(`Erro ao fazer upload da CCB: ${uploadError.message}`);
    }
    
    // 5. Gerar URL assinada para acesso ao documento
    const { data: signedUrlData } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600 * 24 * 30); // 30 dias
    
    // 6. Atualizar a proposta com os dados da CCB
    const { error: updateError } = await supabase
      .from('propostas')
      .update({
        ccb_gerado: true,
        caminho_ccb_assinado: filePath,
        ccb_documento_url: signedUrlData?.signedUrl
      })
      .eq('id', propostaId);
    
    if (updateError) {
      console.error(`❌ [CCB Generator] Erro ao atualizar proposta: ${updateError.message}`);
    }
    
    console.log(`✅ [CCB Generator] CCB gerada com sucesso para proposta ${propostaId}: ${filePath}`);
    return filePath;
    
  } catch (error) {
    console.error(`❌ [CCB Generator] Erro ao gerar CCB:`, error);
    throw error;
  }
}

// Função auxiliar para calcular parcelas (se não estiver calculada)
function calcularParcela(valor: number, prazo: number, taxaJuros: number): number {
  if (taxaJuros === 0) {
    return valor / prazo;
  }
  
  const i = taxaJuros / 100;
  const parcela = valor * (i * Math.pow(1 + i, prazo)) / (Math.pow(1 + i, prazo) - 1);
  return Math.round(parcela * 100) / 100; // Arredondar para 2 casas decimais
}