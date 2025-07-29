import PDFDocument from 'pdfkit';
import { createServerSupabaseAdminClient } from '../lib/supabase';

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
    console.log(`🔄 [CCB Generator] Iniciando geração de CCB organizada para proposta ${propostaId}`);
    
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
    
    const clienteData = proposta.cliente_data as ClientData;
    const condicoesData = proposta.condicoes_data as CondicoesData;
    
    // 2. Criar PDF com layout organizado
    const doc = new PDFDocument({ 
      margin: 50, 
      size: 'A4',
      info: {
        Title: `CCB ${propostaId}`,
        Author: 'Sistema Simpix',
        Subject: 'Cedula de Credito Bancario',
        Creator: 'Sistema Simpix',
        Producer: 'PDFKit',
        CreationDate: new Date(),
        ModDate: new Date()
      }
    });
    
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    
    // Configurações de layout
    const pageWidth = 595.28 - 100; // A4 width minus margins
    const leftMargin = 50;
    const lineHeight = 16;
    const sectionSpacing = 20;
    
    // === CABEÇALHO ===
    doc.fontSize(16).font('Helvetica-Bold')
       .text('CÉDULA DE CRÉDITO BANCÁRIO', leftMargin, doc.y, { 
         width: pageWidth, 
         align: 'center' 
       });
    
    doc.fontSize(10).font('Helvetica')
       .text('(Lei nº 10.931/2004)', leftMargin, doc.y + 5, { 
         width: pageWidth, 
         align: 'center' 
       });
    
    doc.y += sectionSpacing * 1.5;
    
    // === INFORMAÇÕES BÁSICAS ===
    doc.fontSize(12).font('Helvetica-Bold')
       .text('INFORMAÇÕES GERAIS', leftMargin, doc.y, { 
         width: pageWidth, 
         align: 'center' 
       });
    
    doc.y += sectionSpacing;
    
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Número da Cédula:', leftMargin, doc.y);
    doc.font('Helvetica').text(propostaId, leftMargin + 120, doc.y);
    
    doc.y += lineHeight;
    doc.font('Helvetica-Bold').text('Data de Emissão:', leftMargin, doc.y);
    doc.font('Helvetica').text(new Date().toLocaleDateString('pt-BR'), leftMargin + 120, doc.y);
    
    doc.y += sectionSpacing;
    
    // === SEÇÃO I - DADOS DO CLIENTE ===
    doc.fontSize(12).font('Helvetica-Bold')
       .text('I. DADOS DO CLIENTE', leftMargin, doc.y, { 
         width: pageWidth, 
         align: 'center' 
       });
    
    doc.y += sectionSpacing;
    
    doc.fontSize(10);
    doc.font('Helvetica-Bold').text('Nome Completo:', leftMargin, doc.y);
    doc.font('Helvetica').text(clienteData.nome, leftMargin + 120, doc.y, { width: pageWidth - 120 });
    
    doc.y += lineHeight;
    doc.font('Helvetica-Bold').text('CPF:', leftMargin, doc.y);
    doc.font('Helvetica').text(clienteData.cpf, leftMargin + 120, doc.y);
    
    doc.y += lineHeight;
    doc.font('Helvetica-Bold').text('E-mail:', leftMargin, doc.y);
    doc.font('Helvetica').text(clienteData.email, leftMargin + 120, doc.y, { width: pageWidth - 120 });
    
    doc.y += lineHeight;
    doc.font('Helvetica-Bold').text('Telefone:', leftMargin, doc.y);
    doc.font('Helvetica').text(clienteData.telefone, leftMargin + 120, doc.y);
    
    if (clienteData.endereco) {
      doc.y += lineHeight;
      doc.font('Helvetica-Bold').text('Endereço:', leftMargin, doc.y);
      doc.font('Helvetica').text(clienteData.endereco, leftMargin + 120, doc.y, { width: pageWidth - 120 });
    }
    
    if (clienteData.cep) {
      doc.y += lineHeight;
      doc.font('Helvetica-Bold').text('CEP:', leftMargin, doc.y);
      doc.font('Helvetica').text(clienteData.cep, leftMargin + 120, doc.y);
    }
    
    doc.y += sectionSpacing;
    
    // === SEÇÃO II - CONDIÇÕES DO EMPRÉSTIMO ===
    doc.fontSize(12).font('Helvetica-Bold')
       .text('II. CONDIÇÕES DO EMPRÉSTIMO', leftMargin, doc.y, { 
         width: pageWidth, 
         align: 'center' 
       });
    
    doc.y += sectionSpacing;
    
    doc.fontSize(10);
    doc.font('Helvetica-Bold').text('Valor do Empréstimo:', leftMargin, doc.y);
    doc.font('Helvetica').text(`R$ ${condicoesData.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}`, leftMargin + 120, doc.y);
    
    doc.y += lineHeight;
    doc.font('Helvetica-Bold').text('Prazo:', leftMargin, doc.y);
    doc.font('Helvetica').text(`${condicoesData.prazo || 0} meses`, leftMargin + 120, doc.y);
    
    doc.y += lineHeight;
    doc.font('Helvetica-Bold').text('Valor da Parcela:', leftMargin, doc.y);
    doc.font('Helvetica').text(`R$ ${condicoesData.parcela?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}`, leftMargin + 120, doc.y);
    
    if (condicoesData.taxaJuros) {
      doc.y += lineHeight;
      doc.font('Helvetica-Bold').text('Taxa de Juros:', leftMargin, doc.y);
      doc.font('Helvetica').text(`${condicoesData.taxaJuros.toFixed(2)}% ao mês`, leftMargin + 120, doc.y);
    }
    
    if (condicoesData.valorTac) {
      doc.y += lineHeight;
      doc.font('Helvetica-Bold').text('TAC:', leftMargin, doc.y);
      doc.font('Helvetica').text(`R$ ${condicoesData.valorTac.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, leftMargin + 120, doc.y);
    }
    
    if (condicoesData.valorIof) {
      doc.y += lineHeight;
      doc.font('Helvetica-Bold').text('IOF:', leftMargin, doc.y);
      doc.font('Helvetica').text(`R$ ${condicoesData.valorIof.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, leftMargin + 120, doc.y);
    }
    
    if (condicoesData.finalidade) {
      doc.y += lineHeight;
      doc.font('Helvetica-Bold').text('Finalidade:', leftMargin, doc.y);
      doc.font('Helvetica').text(condicoesData.finalidade, leftMargin + 120, doc.y, { width: pageWidth - 120 });
    }
    
    doc.y += sectionSpacing;
    
    // === SEÇÃO III - FORMA DE PAGAMENTO ===
    doc.fontSize(12).font('Helvetica-Bold')
       .text('III. FORMA DE PAGAMENTO', leftMargin, doc.y, { 
         width: pageWidth, 
         align: 'center' 
       });
    
    doc.y += sectionSpacing;
    
    doc.fontSize(10).font('Helvetica');
    doc.text('• Pagamento em parcelas mensais e consecutivas', leftMargin, doc.y, { width: pageWidth });
    doc.y += lineHeight;
    doc.text('• Primeira parcela vence 30 dias após a liberação do crédito', leftMargin, doc.y, { width: pageWidth });
    doc.y += lineHeight;
    doc.text(`• Demais parcelas vencem todo dia ${new Date().getDate()} de cada mês`, leftMargin, doc.y, { width: pageWidth });
    
    doc.y += sectionSpacing;
    
    // === SEÇÃO IV - CLÁUSULAS LEGAIS ===
    doc.fontSize(12).font('Helvetica-Bold')
       .text('IV. CLÁUSULAS LEGAIS', leftMargin, doc.y, { 
         width: pageWidth, 
         align: 'center' 
       });
    
    doc.y += sectionSpacing;
    
    doc.fontSize(9).font('Helvetica');
    const clausulas = [
      'Esta Cédula de Crédito Bancário é título executivo extrajudicial, regida pela Lei nº 10.931/2004.',
      'O atraso no pagamento de qualquer parcela acarretará o vencimento antecipado de toda a dívida.',
      'Em caso de inadimplemento, serão cobrados juros de mora de 1% ao mês sobre o valor em atraso.',
      'Será aplicada multa de 2% sobre o valor da parcela em atraso.',
      'Fica eleito o foro da comarca de São Paulo/SP para dirimir questões oriundas desta cédula.'
    ];
    
    clausulas.forEach((clausula, index) => {
      doc.text(`${index + 1}. ${clausula}`, leftMargin, doc.y, { 
        width: pageWidth, 
        align: 'justify' 
      });
      doc.y += lineHeight;
    });
    
    doc.y += sectionSpacing;
    
    // === SEÇÃO V - ASSINATURAS ===
    doc.fontSize(12).font('Helvetica-Bold')
       .text('V. ASSINATURAS', leftMargin, doc.y, { 
         width: pageWidth, 
         align: 'center' 
       });
    
    doc.y += sectionSpacing;
    
    doc.fontSize(10).font('Helvetica')
       .text(`São Paulo, ${new Date().toLocaleDateString('pt-BR')}`, leftMargin, doc.y, { 
         width: pageWidth, 
         align: 'center' 
       });
    
    doc.y += sectionSpacing * 1.5;
    
    // Assinatura do Cliente (esquerda)
    doc.text('_'.repeat(35), leftMargin, doc.y);
    doc.y += lineHeight * 0.8;
    doc.text('CLIENTE/DEVEDOR', leftMargin, doc.y);
    doc.y += lineHeight * 0.6;
    doc.text(clienteData.nome, leftMargin, doc.y);
    doc.y += lineHeight * 0.6;
    doc.text(`CPF: ${clienteData.cpf}`, leftMargin, doc.y);
    
    // Assinatura do Credor (direita)
    const rightX = leftMargin + 280;
    const signatureY = doc.y - (lineHeight * 2.8);
    
    doc.text('_'.repeat(35), rightX, signatureY);
    doc.text('CREDOR', rightX, signatureY + (lineHeight * 0.8));
    doc.text('Sistema Simpix', rightX, signatureY + (lineHeight * 1.4));
    doc.text('Gestão de Crédito', rightX, signatureY + (lineHeight * 2));
    
    doc.y += sectionSpacing;
    
    // === RODAPÉ ===
    doc.fontSize(8).font('Helvetica')
       .text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, leftMargin, doc.y, { 
         width: pageWidth, 
         align: 'center' 
       });
    
    // Finalizar PDF
    doc.end();
    
    // 3. Aguardar criação do PDF
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`📊 [CCB Generator] PDF criado - Tamanho: ${buffer.length} bytes`);
        resolve(buffer);
      });
      
      doc.on('error', (err) => {
        console.error(`❌ [CCB Generator] Erro:`, err);
        reject(err);
      });
    });
    
    // 4. Upload para Supabase
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
          'generated-by': 'simpix'
        }
      });
    
    if (uploadError) {
      console.error('Erro no upload:', uploadError);
      throw new Error(`Erro no upload: ${uploadError.message}`);
    }
    
    console.log(`✅ [CCB Generator] Upload concluído: ${uploadData.path}`);
    
    // 5. Atualizar proposta
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
    
    console.log(`✅ [CCB Generator] CCB gerada com sucesso para ${propostaId}`);
    return uploadData.path;
    
  } catch (error) {
    console.error(`❌ [CCB Generator] Erro geral:`, error);
    throw error;
  }
}