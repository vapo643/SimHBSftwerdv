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
    
    // Conteúdo mínimo essencial
    doc.fontSize(18).text('CEDULA DE CREDITO BANCARIO', { align: 'center' });
    doc.moveDown(2);
    
    doc.fontSize(12);
    doc.text(`Numero da Cedula: ${propostaId}`);
    doc.text(`Data de Emissao: ${new Date().toLocaleDateString('pt-BR')}`);
    doc.moveDown();
    
    doc.text(`Nome do Cliente: ${clienteData.nome}`);
    doc.text(`CPF: ${clienteData.cpf}`);
    doc.text(`Valor do Emprestimo: R$ ${condicoesData.valor?.toFixed(2) || '0,00'}`);
    doc.text(`Prazo: ${condicoesData.prazo || 0} meses`);
    doc.text(`Valor da Parcela: R$ ${condicoesData.parcela?.toFixed(2) || '0,00'}`);
    
    doc.moveDown(3);
    doc.text('Este documento representa uma Cedula de Credito Bancario');
    doc.text('emitida em conformidade com a legislacao vigente.');
    
    doc.moveDown(4);
    doc.text('ASSINATURAS:', { underline: true });
    doc.moveDown(2);
    doc.text('Cliente: _________________________________');
    doc.moveDown();
    doc.text('Credor: _________________________________');
    
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