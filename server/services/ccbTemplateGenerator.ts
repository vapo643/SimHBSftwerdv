import { createServerSupabaseAdminClient } from '../lib/supabase';
import { getBrasiliaDate, formatBrazilianDate } from '../lib/timezone';
import { PDFDocument, PDFForm, PDFTextField } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

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
  localNascimento?: string;
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
  taxaJurosAnual?: number;
  cet?: number;
  dataVencimentoPrimeira?: string;
  dataVencimentoUltima?: string;
}

export async function generateCCBFromTemplate(propostaId: string, templatePath?: string): Promise<string> {
  try {
    console.log(`🎯 [Template CCB] Iniciando geração com template para proposta ${propostaId}`);
    
    // Usar template padrão se não especificado
    const defaultTemplatePath = path.join(process.cwd(), 'server/templates/ccb_template.pdf');
    const finalTemplatePath = templatePath || defaultTemplatePath;
    
    // Verificar se template existe
    if (!fs.existsSync(finalTemplatePath)) {
      console.log(`⚠️ [Template CCB] Template não encontrado em: ${finalTemplatePath}, usando gerador padrão`);
      const { generateCCB } = await import('./ccbGenerator');
      return await generateCCB(propostaId);
    }
    
    const supabase = createServerSupabaseAdminClient();
    
    // Buscar dados da proposta
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
    
    const clienteData = proposta.cliente_data as any || {};
    const condicoesData = proposta.condicoes_data as any || {};
    
    // Preparar campos para preenchimento
    const ccbFields = prepareCCBFields(propostaId, clienteData, condicoesData, proposta);
    
    // Ler template PDF
    const templateBytes = fs.readFileSync(finalTemplatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    
    // Criar nova CCB com template preenchido
    const newCCB = await createCCBWithTemplate(pdfDoc, ccbFields);
    
    // Salvar PDF no Supabase Storage
    const fileName = `ccb-${propostaId}-${Date.now()}.pdf`;
    const filePath = `ccb/${fileName}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, newCCB, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      });
    
    if (uploadError) {
      console.error('❌ Erro no upload da CCB:', uploadError);
      throw uploadError;
    }
    
    // Atualizar proposta com caminho da CCB
    const { error: updateError } = await supabase
      .from('propostas')
      .update({
        ccb_gerado: true,
        caminho_ccb_assinado: filePath,
        updated_at: getBrasiliaDate().toISOString()
      })
      .eq('id', propostaId);
    
    if (updateError) {
      console.error('❌ Erro ao atualizar proposta:', updateError);
      throw updateError;
    }
    
    console.log(`✅ [Template CCB] CCB gerada com sucesso: ${filePath}`);
    return filePath;
    
  } catch (error) {
    console.error('❌ [Template CCB] Erro:', error);
    throw error;
  }
}

function prepareCCBFields(propostaId: string, clienteData: any, condicoesData: any, proposta: any): CCBFields {
  const hoje = getBrasiliaDate();
  
  // Extrair dados do cliente (pode estar em diferentes formatos)
  const nomeCliente = clienteData.nomeCompleto || clienteData.nome || proposta.nome_cliente || '';
  const cpfCliente = clienteData.cpf || proposta.cpf_cliente || '';
  const emailCliente = clienteData.email || proposta.email_cliente || '';
  const telefoneCliente = clienteData.telefone || proposta.telefone_cliente || '';
  
  // Calcular valores financeiros
  const valorSolicitado = condicoesData.valor || proposta.valor_solicitado || 0;
  const prazo = condicoesData.prazo || proposta.prazo || 0;
  const valorIof = condicoesData.valorIof || 0;
  const valorTac = condicoesData.valorTac || 0;
  const valorTotalFinanciado = condicoesData.valorTotalFinanciado || valorSolicitado;
  const valorLiquido = valorSolicitado - valorTac - valorIof;
  
  // Dados do parceiro/loja
  const loja = proposta.lojas || {};
  const parceiro = loja.parceiros || {};
  
  return {
    // Cabeçalho
    cedulaNumero: propostaId,
    dataEmissao: formatBrazilianDate(hoje),
    finalidade: condicoesData.finalidade || 'Empréstimo Pessoal',
    
    // Emitente (Cliente)
    emitenteNome: nomeCliente,
    emitenteCpf: formatCPF(cpfCliente),
    emitenteRg: clienteData.rg || '',
    emitenteOrgaoEmissor: clienteData.orgaoEmissor || '',
    emitenteEstadoCivil: clienteData.estadoCivil || 'Não Informado',
    emitenteNacionalidade: clienteData.nacionalidade || 'Brasileiro',
    emitenteEndereco: clienteData.endereco || '',
    emitenteCep: clienteData.cep || '',
    emitenteEmail: emailCliente,
    emitenteTelefone: telefoneCliente,
    
    // Credor (Sempre SIMPIX)
    credorRazaoSocial: 'SIMPIX - Seu crédito rápido',
    credorCnpj: '00.000.000/0001-00', // CNPJ da Simpix (placeholder)
    credorEndereco: 'Rua Exemplo, 123, Centro', // Endereço da Simpix
    credorCep: '01000-000', // CEP da Simpix
    
    // Condições Financeiras
    valorPrincipal: formatCurrency(valorSolicitado),
    prazoAmortizacao: `${prazo} mês(es)`,
    taxaJuros: `${(condicoesData.taxaJuros || 2.5).toFixed(2)}%`,
    taxaJurosAnual: `${(condicoesData.taxaJurosAnual || 30).toFixed(2)}%`,
    valorIof: formatCurrency(valorIof),
    valorTac: formatCurrency(valorTac),
    valorLiquido: formatCurrency(valorLiquido),
    valorTotalFinanciado: formatCurrency(valorTotalFinanciado),
    cet: `${(condicoesData.cet || 35).toFixed(2)}%`,
    
    // Datas
    dataLiberacao: formatBrazilianDate(hoje),
    vencimentoPrimeira: calculateFirstDueDate(hoje),
    vencimentoUltima: calculateLastDueDate(hoje, prazo),
    
    // Dados Bancários do Cliente
    bancoCliente: clienteData.banco || '000',
    agenciaCliente: clienteData.agencia || '0000',
    contaCliente: clienteData.conta || '00000-0',
    tipoContaCliente: clienteData.tipoConta || 'Corrente',
    
    // Fluxo de pagamento (parcelas)
    parcelas: generateParcelas(prazo, valorTotalFinanciado / prazo, hoje)
  };
}

function generateParcelas(numeroParcelas: number, valorParcela: number, dataBase: Date) {
  const parcelas = [];
  for (let i = 1; i <= numeroParcelas; i++) {
    const dataVencimento = new Date(dataBase);
    dataVencimento.setMonth(dataVencimento.getMonth() + i);
    
    parcelas.push({
      numero: i,
      vencimento: formatBrazilianDate(dataVencimento),
      valor: formatCurrency(valorParcela)
    });
  }
  
  return parcelas;
}

// Função para criar CCB usando template
async function createCCBWithTemplate(pdfDoc: PDFDocument, fields: CCBFields): Promise<Uint8Array> {
  try {
    console.log('📝 [CCB Template] Preenchendo campos do template PDF...');
    
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    
    // Configurar fonte - usar tamanhos menores para não sobrepor
    const helvetica = await pdfDoc.embedFont('Helvetica');
    const fontSize = 9; // Tamanho padrão menor
    const smallFontSize = 8; // Para campos com menos espaço
    
    // Função auxiliar para desenhar texto com validação
    const drawSafeText = (text: string, x: number, y: number, options: any = {}) => {
      if (text && text.toString().trim()) {
        firstPage.drawText(text.toString(), {
          x,
          y,
          size: options.size || fontSize,
          font: options.font || helvetica,
          ...options
        });
      }
    };
    
    // CABEÇALHO - Linha 3 do template (Cédula Nº, Data de Emissão, Finalidade)
    drawSafeText(fields.cedulaNumero, 95, height - 88, { size: smallFontSize });
    drawSafeText(fields.dataEmissao, 265, height - 88, { size: smallFontSize });
    drawSafeText('Empréstimo Pessoal', 435, height - 88, { size: smallFontSize });
    
    // SEÇÃO I - EMITENTE (linha 10-16 do template)
    // Nome/Razão Social e CPF/CNPJ
    drawSafeText(fields.emitenteNome, 60, height - 135, { size: smallFontSize });
    drawSafeText(fields.emitenteCpf, 450, height - 135, { size: smallFontSize });
    
    // RG, Expedidor, etc (linha 12)
    drawSafeText(fields.emitenteRg || '', 50, height - 155, { size: smallFontSize });
    drawSafeText(fields.emitenteOrgaoEmissor || '', 120, height - 155, { size: smallFontSize });
    drawSafeText('SP', 185, height - 155, { size: smallFontSize }); // UF padrão
    drawSafeText(fields.emitenteNacionalidade || 'Brasileiro', 270, height - 155, { size: smallFontSize });
    
    // Estado Civil (linha 14)
    drawSafeText(fields.emitenteEstadoCivil || '', 95, height - 175, { size: smallFontSize });
    
    // Endereço (linha 16)
    drawSafeText(fields.emitenteEndereco, 75, height - 195, { size: smallFontSize });
    drawSafeText(fields.emitenteCep, 275, height - 195, { size: smallFontSize });
    drawSafeText(fields.emitenteCidade || '', 370, height - 195, { size: smallFontSize });
    drawSafeText('SP', 540, height - 195, { size: smallFontSize }); // UF padrão
    
    // SEÇÃO II - CREDOR (linha 25-28 do template)
    drawSafeText(fields.credorRazaoSocial, 60, height - 250, { size: smallFontSize });
    drawSafeText(fields.credorCnpj, 450, height - 250, { size: smallFontSize });
    drawSafeText(fields.credorEndereco, 75, height - 270, { size: smallFontSize });
    drawSafeText(fields.credorCep, 230, height - 270, { size: smallFontSize });
    drawSafeText('São Paulo', 370, height - 270, { size: smallFontSize });
    drawSafeText('SP', 540, height - 270, { size: smallFontSize });
    
    // SEÇÃO III - CONDIÇÕES (linha 35-52 do template)
    // Linha 35-36: Valor Principal, Data Emissão, Vencimentos
    drawSafeText(fields.valorPrincipal, 115, height - 325, { size: smallFontSize });
    drawSafeText(fields.dataEmissao, 225, height - 325, { size: smallFontSize });
    drawSafeText(fields.vencimentoPrimeira, 350, height - 325, { size: smallFontSize });
    drawSafeText(fields.vencimentoUltima, 485, height - 325, { size: smallFontSize });
    
    // Linha 38-41: Prazo, Juros, Taxa
    drawSafeText(fields.prazoAmortizacao, 50, height - 355, { size: smallFontSize });
    drawSafeText('Pré-Fixados', 170, height - 355, { size: smallFontSize });
    drawSafeText(fields.taxaJuros, 295, height - 355, { size: smallFontSize });
    
    // Linha 44-46: Taxa Mensal, Anual, IOF
    drawSafeText(fields.taxaJuros, 50, height - 385, { size: smallFontSize });
    drawSafeText(fields.taxaJurosAnual, 175, height - 385, { size: smallFontSize });
    drawSafeText(fields.valorIof, 295, height - 385, { size: smallFontSize });
    drawSafeText('São Paulo', 415, height - 385, { size: smallFontSize });
    
    // Linha 47: TAC
    drawSafeText(fields.valorTac, 295, height - 405, { size: smallFontSize });
    
    // Linha 49: CET
    drawSafeText(fields.cet, 485, height - 425, { size: smallFontSize });
    
    // Linha 52-53: Data liberação e Valor líquido
    drawSafeText(fields.dataLiberacao, 195, height - 465, { size: smallFontSize });
    drawSafeText(fields.valorLiquido, 385, height - 465, { size: smallFontSize });
    drawSafeText(fields.valorLiquido, 195, height - 480, { size: smallFontSize });
    
    // Linha 62-67: Dados bancários
    drawSafeText(fields.bancoCliente, 115, height - 530, { size: smallFontSize });
    drawSafeText(fields.agenciaCliente, 250, height - 530, { size: smallFontSize });
    drawSafeText(fields.contaCliente, 380, height - 530, { size: smallFontSize });
    drawSafeText(fields.tipoContaCliente, 485, height - 550, { size: smallFontSize });
    
    // FLUXO DE PAGAMENTO (linha 79+)
    // Vamos preencher até 12 parcelas na primeira página
    let parcelaY = height - 650;
    const maxParcelasPrimeiraPagina = 12;
    
    fields.parcelas.slice(0, maxParcelasPrimeiraPagina).forEach((parcela, index) => {
      drawSafeText(`${parcela.numero}`, 150, parcelaY, { size: smallFontSize });
      drawSafeText(parcela.vencimento, 280, parcelaY, { size: smallFontSize });
      drawSafeText(parcela.valor, 420, parcelaY, { size: smallFontSize });
      parcelaY -= 20;
    });
    
    // Se houver mais páginas e mais parcelas, continuar nas próximas páginas
    if (fields.parcelas.length > maxParcelasPrimeiraPagina && pages.length > 1) {
      // Implementar lógica para páginas adicionais se necessário
      console.log(`⚠️ [CCB Template] ${fields.parcelas.length} parcelas - algumas podem não aparecer no template`);
    }
    
    // Retornar PDF preenchido
    const pdfBytes = await pdfDoc.save();
    console.log('✅ [CCB Template] Template preenchido com sucesso');
    return pdfBytes;
    
  } catch (error) {
    console.error('❌ [CCB Template] Erro ao preencher template:', error);
    throw error;
  }
}
      font: helvetica,
    });
    
    currentY -= 20;
    
    firstPage.drawText(fields.emitenteRg, {
      x: 50, y: currentY, // RG
      size: 10,
      font: helvetica,
    });
    
    firstPage.drawText(fields.emitenteEstadoCivil, {
      x: 400, y: currentY, // Estado Civil
      size: 10,
      font: helvetica,
    });
    
    currentY -= 20;
    
    firstPage.drawText(fields.emitenteEndereco, {
      x: 50, y: currentY, // Endereço
      size: 10,
      font: helvetica,
    });
    
    firstPage.drawText(fields.emitenteCep, {
      x: 400, y: currentY, // CEP
      size: 10,
      font: helvetica,
    });
    
    // Seção II - CREDOR ORIGINÁRIO
    currentY -= 60;
    
    firstPage.drawText(fields.credorRazaoSocial, {
      x: 50, y: currentY, // Razão Social
      size: 10,
      font: helvetica,
    });
    
    firstPage.drawText(fields.credorCnpj, {
      x: 400, y: currentY, // CNPJ
      size: 10,
      font: helvetica,
    });
    
    currentY -= 20;
    
    firstPage.drawText(fields.credorEndereco, {
      x: 50, y: currentY, // Endereço
      size: 10,
      font: helvetica,
    });
    
    firstPage.drawText(fields.credorCep, {
      x: 400, y: currentY, // CEP
      size: 10,
      font: helvetica,
    });
    
    // Seção III - CONDIÇÕES E CARACTERÍSTICAS
    currentY -= 60;
    
    // Linha 1 dos campos
    firstPage.drawText(fields.valorPrincipal, {
      x: 50, y: currentY, // 1. Valor de Principal
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText(fields.dataEmissao, {
      x: 150, y: currentY, // 2. Data de Emissão
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText(fields.vencimentoPrimeira, {
      x: 250, y: currentY, // 3. Vencimento da Parcela
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText(fields.vencimentoUltima, {
      x: 400, y: currentY, // 4. Vencimento da Última Parcela
      size: 9,
      font: helvetica,
    });
    
    currentY -= 20;
    
    // Linha 2 dos campos
    firstPage.drawText(fields.prazoAmortizacao, {
      x: 50, y: currentY, // 5. Prazo de Amortização
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText('Pré-Fixados', {
      x: 150, y: currentY, // 6. Juros Modalidade
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText(fields.taxaJuros, {
      x: 250, y: currentY, // 7. Percentual/Índice
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText('Diária, 365 dias', {
      x: 400, y: currentY, // 8. Periodicidade da Capitalização
      size: 9,
      font: helvetica,
    });
    
    currentY -= 20;
    
    // Linha 3 dos campos
    firstPage.drawText(fields.taxaJuros, {
      x: 50, y: currentY, // 9. Taxa de Juros Efetiva Mensal
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText(fields.taxaJurosAnual, {
      x: 150, y: currentY, // 10. Taxa de Juros Efetiva Anual
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText(fields.valorIof, {
      x: 250, y: currentY, // 11. IOF
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText('São Paulo/SP', {
      x: 400, y: currentY, // 12. Praça de Pagamento
      size: 9,
      font: helvetica,
    });
    
    currentY -= 20;
    
    // Linha 4 dos campos
    firstPage.drawText('Cobrança por boleto', {
      x: 50, y: currentY, // 13. Formas de Pagamento
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText(fields.valorTac, {
      x: 300, y: currentY, // TAC
      size: 9,
      font: helvetica,
    });
    
    currentY -= 20;
    
    // Linha 5 dos campos
    firstPage.drawText('365 dias', {
      x: 50, y: currentY, // 14. Ano Base
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText('Sobre o Saldo Devedor', {
      x: 150, y: currentY, // 15. Cálculo dos Encargos
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText(fields.cet, {
      x: 350, y: currentY, // 16. CET
      size: 9,
      font: helvetica,
    });
    
    currentY -= 20;
    
    // Valores financeiros detalhados
    firstPage.drawText(fields.dataLiberacao, {
      x: 150, y: currentY, // 19. Data de liberação
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText(fields.valorLiquido, {
      x: 350, y: currentY, // 20. Valor líquido liberado
      size: 9,
      font: helvetica,
    });
    
    currentY -= 40;
    
    // Dados Bancários
    firstPage.drawText(fields.bancoCliente, {
      x: 150, y: currentY, // Banco
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText(fields.agenciaCliente, {
      x: 250, y: currentY, // Agência
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText(fields.contaCliente, {
      x: 350, y: currentY, // Conta
      size: 9,
      font: helvetica,
    });
    
    firstPage.drawText(fields.tipoContaCliente, {
      x: 450, y: currentY, // Tipo de Conta
      size: 9,
      font: helvetica,
    });
    
    // Adicionar uma página para o fluxo de pagamento se necessário
    if (fields.parcelas.length > 0) {
      currentY -= 80;
      
      firstPage.drawText('FLUXO DE PAGAMENTO', {
        x: 250, y: currentY,
        size: 12,
        font: helveticaBold,
      });
      
      currentY -= 30;
      
      // Listar algumas parcelas (limitar espaço)
      const maxParcelas = Math.min(fields.parcelas.length, 5);
      for (let i = 0; i < maxParcelas; i++) {
        const parcela = fields.parcelas[i];
        firstPage.drawText(`Parcela ${parcela.numero}: ${parcela.vencimento} - ${parcela.valor}`, {
          x: 50,
          y: currentY - (i * 15),
          size: 9,
          font: helvetica,
        });
      }
      
      if (fields.parcelas.length > maxParcelas) {
        firstPage.drawText(`... e mais ${fields.parcelas.length - maxParcelas} parcelas`, {
          x: 50,
          y: currentY - (maxParcelas * 15),
          size: 9,
          font: helvetica,
        });
      }
    }
    
    // Retornar o PDF modificado
    return await pdfDoc.save();
    
  } catch (error) {
    console.error('❌ [Template CCB] Erro ao preencher template:', error);
    throw error;
  }
}

// Funções auxiliares
function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function calculateFirstDueDate(baseDate: Date): string {
  const firstDue = new Date(baseDate);
  firstDue.setMonth(firstDue.getMonth() + 1);
  return formatBrazilianDate(firstDue);
}

function calculateLastDueDate(baseDate: Date, prazo: number): string {
  const lastDue = new Date(baseDate);
  lastDue.setMonth(lastDue.getMonth() + prazo);
  return formatBrazilianDate(lastDue);
}

// Campos que precisarão ser preenchidos no template:
interface CCBFields {
  // Cabeçalho
  cedulaNumero: string;
  dataEmissao: string;
  finalidade: string;
  
  // Emitente (Cliente)
  emitenteNome: string;
  emitenteCpf: string;
  emitenteRg: string;
  emitenteOrgaoEmissor: string;
  emitenteEstadoCivil: string;
  emitenteNacionalidade: string;
  emitenteEndereco: string;
  emitenteCep: string;
  emitenteEmail: string;
  emitenteTelefone: string;
  
  // Credor (Sempre SIMPIX)
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
  valorTotalFinanciado: string;
  cet: string;
  
  // Datas
  dataLiberacao: string;
  vencimentoPrimeira: string;
  vencimentoUltima: string;
  
  // Dados Bancários do Cliente
  bancoCliente: string;
  agenciaCliente: string;
  contaCliente: string;
  tipoContaCliente: string;
  
  // Fluxo de pagamento (parcelas)
  parcelas: Array<{
    numero: number;
    vencimento: string;
    valor: string;
  }>;
}