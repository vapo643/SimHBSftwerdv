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
    console.log(`🔄 [CCB Generator] Iniciando geração de CCB simplificada para proposta ${propostaId}`);
    
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
    
    // 2. Criar PDF ultra básico
    const doc = new PDFDocument({ 
      margin: 60, 
      size: 'A4',
      info: {
        Title: `CCB ${propostaId}`,
        Author: 'Sistema Simpix',
        Subject: 'CCB',
        Creator: 'Simpix',
        Producer: 'PDFKit',
        CreationDate: new Date(),
        ModDate: new Date()
      }
    });
    
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    
    // === CABEÇALHO ===
    doc.fontSize(20).font('Helvetica-Bold').text('CÉDULA DE CRÉDITO BANCÁRIO', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('(Lei nº 10.931/2004)', { align: 'center' });
    doc.moveDown(2);
    
    // === DADOS IDENTIFICADORES ===
    doc.fontSize(10).font('Helvetica-Bold');
    const startY = doc.y;
    
    // Linha superior de labels
    doc.text('Nº da Cédula:', 60, startY, { width: 120 });
    doc.text('Data de Emissão:', 240, startY, { width: 120 });
    doc.text('Vencimento:', 420, startY, { width: 120 });
    
    // Linha inferior de valores
    doc.fontSize(10).font('Helvetica');
    doc.text(propostaId, 60, startY + 15, { width: 120 });
    doc.text(new Date().toLocaleDateString('pt-BR'), 240, startY + 15, { width: 120 });
    const vencimento = new Date();
    vencimento.setMonth(vencimento.getMonth() + (condicoesData.prazo || 12));
    doc.text(vencimento.toLocaleDateString('pt-BR'), 420, startY + 15, { width: 120 });
    
    doc.y = startY + 40;
    doc.moveDown();
    
    // === SEÇÃO I - DEVEDOR ===
    doc.fontSize(12).font('Helvetica-Bold').text('I. DEVEDOR (EMITENTE)', { underline: true });
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica');
    const devedorY = doc.y;
    
    // Nome e CPF na mesma linha
    doc.font('Helvetica-Bold').text('Nome/Razão Social:', 60, devedorY, { width: 150 });
    doc.font('Helvetica').text(clienteData.nome, 220, devedorY, { width: 320 });
    
    doc.font('Helvetica-Bold').text('CPF/CNPJ:', 60, devedorY + 20, { width: 150 });
    doc.font('Helvetica').text(clienteData.cpf, 220, devedorY + 20, { width: 320 });
    
    // Endereço
    if (clienteData.endereco) {
      doc.font('Helvetica-Bold').text('Endereço:', 60, devedorY + 40, { width: 150 });
      doc.font('Helvetica').text(clienteData.endereco, 220, devedorY + 40, { width: 320 });
    }
    
    // Telefone e Email
    doc.font('Helvetica-Bold').text('Telefone:', 60, devedorY + 60, { width: 150 });
    doc.font('Helvetica').text(clienteData.telefone, 220, devedorY + 60, { width: 150 });
    
    doc.font('Helvetica-Bold').text('Email:', 320, devedorY + 60, { width: 80 });
    doc.font('Helvetica').text(clienteData.email, 370, devedorY + 60, { width: 170 });
    
    doc.y = devedorY + 90;
    doc.moveDown();
    
    // === SEÇÃO II - CREDOR ===
    doc.fontSize(12).font('Helvetica-Bold').text('II. CREDOR ORIGINÁRIO', { underline: true });
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica');
    const credorY = doc.y;
    
    doc.font('Helvetica-Bold').text('Razão Social:', 60, credorY, { width: 150 });
    doc.font('Helvetica').text('Sistema Simpix - Gestão de Crédito', 220, credorY, { width: 320 });
    
    doc.font('Helvetica-Bold').text('CNPJ:', 60, credorY + 20, { width: 150 });
    doc.font('Helvetica').text('00.000.000/0001-00', 220, credorY + 20, { width: 320 });
    
    doc.y = credorY + 50;
    doc.moveDown();
    
    // === SEÇÃO III - CONDIÇÕES DA OPERAÇÃO ===
    doc.fontSize(12).font('Helvetica-Bold').text('III. CONDIÇÕES DA OPERAÇÃO DE CRÉDITO', { underline: true });
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica');
    const operacaoY = doc.y;
    
    // Coluna esquerda
    doc.font('Helvetica-Bold').text('Valor Principal:', 60, operacaoY, { width: 150 });
    doc.font('Helvetica').text(`R$ ${condicoesData.valor?.toFixed(2) || '0,00'}`, 220, operacaoY, { width: 150 });
    
    doc.font('Helvetica-Bold').text('Prazo:', 60, operacaoY + 20, { width: 150 });
    doc.font('Helvetica').text(`${condicoesData.prazo || 0} meses`, 220, operacaoY + 20, { width: 150 });
    
    doc.font('Helvetica-Bold').text('Taxa de Juros:', 60, operacaoY + 40, { width: 150 });
    doc.font('Helvetica').text(`${condicoesData.taxaJuros?.toFixed(2) || '0,00'}% a.m.`, 220, operacaoY + 40, { width: 150 });
    
    // Coluna direita
    doc.font('Helvetica-Bold').text('Valor da Parcela:', 320, operacaoY, { width: 150 });
    doc.font('Helvetica').text(`R$ ${condicoesData.parcela?.toFixed(2) || '0,00'}`, 480, operacaoY, { width: 100 });
    
    doc.font('Helvetica-Bold').text('TAC:', 320, operacaoY + 20, { width: 150 });
    doc.font('Helvetica').text(`R$ ${condicoesData.valorTac?.toFixed(2) || '0,00'}`, 480, operacaoY + 20, { width: 100 });
    
    doc.font('Helvetica-Bold').text('IOF:', 320, operacaoY + 40, { width: 150 });
    doc.font('Helvetica').text(`R$ ${condicoesData.valorIof?.toFixed(2) || '0,00'}`, 480, operacaoY + 40, { width: 100 });
    
    doc.y = operacaoY + 70;
    doc.moveDown();
    
    // === SEÇÃO IV - FORMA DE PAGAMENTO ===
    doc.fontSize(12).font('Helvetica-Bold').text('IV. FORMA DE PAGAMENTO', { underline: true });
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica');
    doc.text('• Parcelas mensais, fixas e consecutivas');
    doc.text('• Vencimento da 1ª parcela: 30 dias após a liberação do crédito');
    doc.text('• Vencimento das demais: todo dia ' + new Date().getDate() + ' dos meses subsequentes');
    doc.moveDown();
    
    // === SEÇÃO V - CLÁUSULAS GERAIS ===
    doc.fontSize(12).font('Helvetica-Bold').text('V. CLÁUSULAS GERAIS', { underline: true });
    doc.moveDown(0.5);
    
    doc.fontSize(9).font('Helvetica');
    const clausulas = [
      'VENCIMENTO ANTECIPADO: O não pagamento de qualquer parcela na data do vencimento acarretará o vencimento antecipado de toda a dívida.',
      'JUROS DE MORA: Em caso de inadimplemento, serão cobrados juros de mora de 1% ao mês.',
      'MULTA: Será aplicada multa de 2% sobre o valor da parcela em atraso.',
      'FORO: Fica eleito o foro da comarca de São Paulo/SP para dirimir questões oriundas desta cédula.'
    ];
    
    clausulas.forEach((clausula, index) => {
      doc.text(`${index + 1}. ${clausula}`, { width: 480, align: 'justify' });
      doc.moveDown(0.3);
    });
    
    doc.moveDown(2);
    
    // === SEÇÃO VI - ASSINATURAS ===
    doc.fontSize(12).font('Helvetica-Bold').text('VI. ASSINATURAS', { underline: true });
    doc.moveDown();
    
    doc.fontSize(10).font('Helvetica');
    doc.text('Local e Data: São Paulo/SP, ' + new Date().toLocaleDateString('pt-BR'));
    doc.moveDown(3);
    
    // Assinaturas lado a lado
    const assinY = doc.y;
    
    // Devedor
    doc.text('_'.repeat(35), 60, assinY);
    doc.text('DEVEDOR', 60, assinY + 15, { width: 200 });
    doc.font('Helvetica-Bold').text(clienteData.nome, 60, assinY + 30, { width: 200 });
    doc.font('Helvetica').text(`CPF: ${clienteData.cpf}`, 60, assinY + 45, { width: 200 });
    
    // Credor
    doc.text('_'.repeat(35), 320, assinY);
    doc.text('CREDOR', 320, assinY + 15, { width: 200 });
    doc.font('Helvetica-Bold').text('Sistema Simpix', 320, assinY + 30, { width: 200 });
    doc.font('Helvetica').text('CNPJ: 00.000.000/0001-00', 320, assinY + 45, { width: 200 });
    
    // Finalizar
    doc.end();
    
    // 3. Aguardar criação
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