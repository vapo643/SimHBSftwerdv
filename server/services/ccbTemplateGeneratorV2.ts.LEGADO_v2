import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { createServerSupabaseAdminClient } from '../lib/supabase';
import { getBrasiliaDate } from '../utils/dateHelpers';

interface CCBFieldsV2 {
  // Cabeçalho
  cedulaNumero: string;
  dataEmissao: string;
  
  // Emitente (Cliente)
  emitenteNome: string;
  emitenteCpf: string;
  emitenteRg: string;
  emitenteOrgaoEmissor: string;
  emitenteNacionalidade: string;
  emitenteEstadoCivil: string;
  emitenteEndereco: string;
  emitenteCep: string;
  emitenteCidade: string;
  emitenteUf: string;
  
  // Credor
  credorRazaoSocial: string;
  credorCnpj: string;
  credorEndereco: string;
  credorCep: string;
  
  // Condições Financeiras
  valorPrincipal: string;
  prazoAmortizacao: string;
  taxaJuros: string;
  taxaJurosAnual: string;
  valorIof: string;
  valorTac: string;
  valorLiquido: string;
  cet: string;
  dataLiberacao: string;
  vencimentoPrimeira: string;
  vencimentoUltima: string;
  
  // Dados Bancários
  bancoCliente: string;
  agenciaCliente: string;
  contaCliente: string;
  tipoContaCliente: string;
  
  // Parcelas
  parcelas: Array<{
    numero: number;
    vencimento: string;
    valor: string;
  }>;
}

export async function generateCCBFromTemplateV2(propostaId: string): Promise<string> {
  try {
    console.log(`🎯 [CCB Template V2] Iniciando geração com template para proposta ${propostaId}`);
    
    const templatePath = path.join(process.cwd(), 'server/templates/ccb_template.pdf');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template PDF não encontrado em: ${templatePath}`);
    }
    
    const supabase = createServerSupabaseAdminClient();
    
    // Buscar dados da proposta
    const { data: proposta, error } = await supabase
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
    
    if (error || !proposta) {
      throw new Error(`Proposta ${propostaId} não encontrada`);
    }
    
    // Preparar campos
    const fields = prepareFieldsV2(proposta);
    
    // Ler template e preencher
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const filledPdf = await fillTemplateV2(pdfDoc, fields);
    
    // Salvar no Supabase
    const fileName = `ccb-${propostaId}-${Date.now()}.pdf`;
    const filePath = `ccb/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, filledPdf, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      });
    
    if (uploadError) {
      throw uploadError;
    }
    
    // Atualizar proposta
    await supabase
      .from('propostas')
      .update({
        ccb_gerado: true,
        caminho_ccb_assinado: filePath,
        updated_at: getBrasiliaDate().toISOString()
      })
      .eq('id', propostaId);
    
    console.log(`✅ [CCB Template V2] CCB gerada com sucesso: ${filePath}`);
    return filePath;
    
  } catch (error) {
    console.error('❌ [CCB Template V2] Erro:', error);
    throw error;
  }
}

function prepareFieldsV2(proposta: any): CCBFieldsV2 {
  const clienteData = proposta.cliente_data || {};
  const condicoesData = proposta.condicoes_data || {};
  const hoje = getBrasiliaDate();
  
  // Calcular valores
  const valorSolicitado = Number(condicoesData.valor || proposta.valor_solicitado || 0);
  const prazo = Number(condicoesData.prazo || proposta.prazo || 12);
  const valorIof = Number(condicoesData.valorIof || 0);
  const valorTac = Number(condicoesData.valorTac || 0);
  const valorTotalFinanciado = Number(condicoesData.valorTotalFinanciado || valorSolicitado);
  const valorLiquido = valorSolicitado - valorTac - valorIof;
  const valorParcela = valorTotalFinanciado / prazo;
  
  // Gerar parcelas
  const parcelas = [];
  for (let i = 1; i <= prazo; i++) {
    const vencimento = new Date(hoje);
    vencimento.setMonth(vencimento.getMonth() + i);
    parcelas.push({
      numero: i,
      vencimento: formatDate(vencimento),
      valor: formatMoney(valorParcela)
    });
  }
  
  return {
    // Cabeçalho
    cedulaNumero: proposta.id.substring(0, 8).toUpperCase(),
    dataEmissao: formatDate(hoje),
    
    // Emitente
    emitenteNome: clienteData.nomeCompleto || clienteData.nome || proposta.nome_cliente || '',
    emitenteCpf: formatCPF(clienteData.cpf || proposta.cpf_cliente || ''),
    emitenteRg: clienteData.rg || '',
    emitenteOrgaoEmissor: clienteData.orgaoEmissor || 'SSP',
    emitenteNacionalidade: clienteData.nacionalidade || 'Brasileiro',
    emitenteEstadoCivil: clienteData.estadoCivil || 'Solteiro(a)',
    emitenteEndereco: clienteData.endereco || '',
    emitenteCep: formatCEP(clienteData.cep || ''),
    emitenteCidade: clienteData.cidade || '',
    emitenteUf: clienteData.uf || 'SP',
    
    // Credor
    credorRazaoSocial: 'SIMPIX FINANCEIRA LTDA',
    credorCnpj: '00.000.000/0001-00',
    credorEndereco: 'Rua Principal, 123, Centro',
    credorCep: '01000-000',
    
    // Condições
    valorPrincipal: formatMoney(valorSolicitado),
    prazoAmortizacao: `${prazo}`,
    taxaJuros: `${(condicoesData.taxaJuros || 2.5).toFixed(2)}% a.m.`,
    taxaJurosAnual: `${((condicoesData.taxaJuros || 2.5) * 12).toFixed(2)}% a.a.`,
    valorIof: formatMoney(valorIof),
    valorTac: formatMoney(valorTac),
    valorLiquido: formatMoney(valorLiquido),
    cet: `${(condicoesData.cet || 35).toFixed(2)}% a.a.`,
    dataLiberacao: formatDate(hoje),
    vencimentoPrimeira: formatDate(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 5)),
    vencimentoUltima: formatDate(new Date(hoje.getFullYear(), hoje.getMonth() + prazo, 5)),
    
    // Dados Bancários
    bancoCliente: clienteData.banco || '000',
    agenciaCliente: clienteData.agencia || '0000',
    contaCliente: clienteData.conta || '00000-0',
    tipoContaCliente: clienteData.tipoConta || 'Corrente',
    
    // Parcelas
    parcelas
  };
}

async function fillTemplateV2(pdfDoc: PDFDocument, fields: CCBFieldsV2): Promise<Uint8Array> {
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { height } = firstPage.getSize();
  
  // Fonte
  const helvetica = await pdfDoc.embedFont('Helvetica');
  const fontSize = 8;
  
  // Função auxiliar para desenhar texto
  const draw = (text: string, x: number, y: number) => {
    if (text) {
      firstPage.drawText(text.toString(), {
        x,
        y: height - y, // Converter para coordenadas PDF
        size: fontSize,
        font: helvetica,
      });
    }
  };
  
  // PREENCHIMENTO DOS CAMPOS (coordenadas em pixels do topo)
  
  // Cabeçalho
  draw(fields.cedulaNumero, 95, 88);
  draw(fields.dataEmissao, 265, 88);
  draw('Empréstimo Pessoal', 435, 88);
  
  // Emitente
  draw(fields.emitenteNome, 60, 135);
  draw(fields.emitenteCpf, 450, 135);
  draw(fields.emitenteRg, 50, 155);
  draw(fields.emitenteOrgaoEmissor, 120, 155);
  draw(fields.emitenteUf, 185, 155);
  draw(fields.emitenteNacionalidade, 270, 155);
  draw(fields.emitenteEstadoCivil, 95, 175);
  draw(fields.emitenteEndereco, 75, 195);
  draw(fields.emitenteCep, 275, 195);
  draw(fields.emitenteCidade, 370, 195);
  draw(fields.emitenteUf, 540, 195);
  
  // Credor
  draw(fields.credorRazaoSocial, 60, 250);
  draw(fields.credorCnpj, 450, 250);
  draw(fields.credorEndereco, 75, 270);
  draw(fields.credorCep, 230, 270);
  draw('São Paulo', 370, 270);
  draw('SP', 540, 270);
  
  // Condições Financeiras
  draw(fields.valorPrincipal, 115, 325);
  draw(fields.dataEmissao, 225, 325);
  draw(fields.vencimentoPrimeira, 350, 325);
  draw(fields.vencimentoUltima, 485, 325);
  draw(fields.prazoAmortizacao, 50, 355);
  draw(fields.taxaJuros, 295, 355);
  draw(fields.taxaJuros, 50, 385);
  draw(fields.taxaJurosAnual, 175, 385);
  draw(fields.valorIof, 295, 385);
  draw(fields.valorTac, 295, 405);
  draw(fields.cet, 485, 425);
  draw(fields.dataLiberacao, 195, 465);
  draw(fields.valorLiquido, 385, 465);
  draw(fields.valorLiquido, 195, 480);
  
  // Dados Bancários
  draw(fields.bancoCliente, 115, 530);
  draw(fields.agenciaCliente, 250, 530);
  draw(fields.contaCliente, 380, 530);
  draw(fields.tipoContaCliente, 485, 550);
  
  // Parcelas (até 12 na primeira página)
  let y = 650;
  for (let i = 0; i < Math.min(fields.parcelas.length, 12); i++) {
    const parcela = fields.parcelas[i];
    draw(`${parcela.numero}`, 150, y);
    draw(parcela.vencimento, 280, y);
    draw(parcela.valor, 420, y);
    y += 20;
  }
  
  return await pdfDoc.save();
}

// Funções auxiliares
function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatCEP(cep: string): string {
  return cep.replace(/(\d{5})(\d{3})/, '$1-$2');
}