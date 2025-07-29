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
    
    // 2. Criar o documento PDF com metadados de segurança para evitar falsos positivos
    const doc = new PDFDocument({ 
      margin: 40, 
      size: 'A4',
      info: {
        Title: `CCB - Cédula de Crédito Bancário ${propostaId}`,
        Author: 'Sistema Simpix - Gestão de Crédito',
        Subject: 'Cédula de Crédito Bancário',
        Keywords: 'CCB, Crédito, Bancário, Financeiro, Proposta',
        Creator: 'Simpix CCB Generator v1.0',
        Producer: 'PDFKit/Node.js',
        CreationDate: new Date(),
        ModDate: new Date()
      }
    });
    const chunks: Buffer[] = [];
    
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    
    // === HEADER ===
    doc.fontSize(16).font('Helvetica-Bold').text('CÉDULA DE CRÉDITO BANCÁRIO', { align: 'center' });
    doc.moveDown(0.5);
    
    // Campos do cabeçalho - primeira linha
    const yPos = doc.y;
    doc.fontSize(10).font('Helvetica');
    doc.text('Cédula Nº', 50, yPos, { width: 150 });
    doc.text('Data de Emissão', 200, yPos, { width: 150 });
    doc.text('Finalidade da Operação', 350, yPos, { width: 150 });
    
    // Segunda linha - valores
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(propostaId, 50, yPos + 15, { width: 150 });
    const dataEmissao = new Date(proposta.data_aprovacao || new Date()).toLocaleDateString('pt-BR');
    doc.text(dataEmissao, 200, yPos + 15, { width: 150 });
    doc.text('Empréstimo Pessoal', 350, yPos + 15, { width: 150 });
    
    doc.moveDown(2);
    
    // === I. EMITENTE ===
    doc.fontSize(12).font('Helvetica-Bold').text('I. EMITENTE');
    doc.moveDown(0.5);
    
    // Layout em duas colunas para campos do emitente
    const leftCol = 50;
    const rightCol = 300;
    let currentY = doc.y;
    
    doc.fontSize(9).font('Helvetica');
    doc.text('Nome/Razão Social', leftCol, currentY, { width: 200 });
    doc.text('CPF/CNPJ', rightCol, currentY, { width: 200 });
    
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(clienteData.nome, leftCol, currentY + 12, { width: 200 });
    doc.text(clienteData.cpf, rightCol, currentY + 12, { width: 200 });
    
    currentY += 35;
    doc.fontSize(9).font('Helvetica');
    doc.text('RG', leftCol, currentY, { width: 50 });
    doc.text('Expedidor', leftCol + 60, currentY, { width: 40 });
    doc.text('UF', leftCol + 110, currentY, { width: 30 });
    doc.text('Emissão', leftCol + 150, currentY, { width: 50 });
    doc.text('Nacionalidade', rightCol, currentY, { width: 100 });
    doc.text('Local Nascimento', rightCol + 110, currentY, { width: 100 });
    
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(clienteData.rg || 'N/A', leftCol, currentY + 12, { width: 50 });
    doc.text(clienteData.orgaoEmissor || 'N/A', leftCol + 60, currentY + 12, { width: 40 });
    doc.text('SP', leftCol + 110, currentY + 12, { width: 30 });
    doc.text('N/A', leftCol + 150, currentY + 12, { width: 50 });
    doc.text(clienteData.nacionalidade || 'Brasileira', rightCol, currentY + 12, { width: 100 });
    doc.text('São Paulo', rightCol + 110, currentY + 12, { width: 100 });
    
    currentY += 35;
    doc.fontSize(9).font('Helvetica');
    doc.text('Estado Civil', leftCol, currentY, { width: 200 });
    
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(clienteData.estadoCivil || 'N/A', leftCol, currentY + 12, { width: 200 });
    
    currentY += 35;
    doc.fontSize(9).font('Helvetica');
    doc.text('Endereço', leftCol, currentY, { width: 100 });
    doc.text('CEP', leftCol + 200, currentY, { width: 80 });
    doc.text('Cidade', rightCol, currentY, { width: 100 });
    doc.text('UF', rightCol + 150, currentY, { width: 50 });
    
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(clienteData.endereco || 'N/A', leftCol, currentY + 12, { width: 190 });
    doc.text(clienteData.cep || 'N/A', leftCol + 200, currentY + 12, { width: 80 });
    doc.text('São Paulo', rightCol, currentY + 12, { width: 100 });
    doc.text('SP', rightCol + 150, currentY + 12, { width: 50 });
    
    doc.moveDown(3);
    
    // === II. CREDOR ORIGINÁRIO ===
    doc.fontSize(12).font('Helvetica-Bold').text('II. CREDOR ORIGINÁRIO doravante ("Credor")');
    doc.moveDown(0.5);
    
    currentY = doc.y;
    doc.fontSize(9).font('Helvetica');
    doc.text('Razão Social', leftCol, currentY, { width: 200 });
    doc.text('CNPJ', rightCol, currentY, { width: 200 });
    
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(proposta.lojas?.parceiros?.razao_social || 'N/A', leftCol, currentY + 12, { width: 200 });
    doc.text(proposta.lojas?.parceiros?.cnpj || 'N/A', rightCol, currentY + 12, { width: 200 });
    
    currentY += 35;
    doc.fontSize(9).font('Helvetica');
    doc.text('Endereço', leftCol, currentY, { width: 100 });
    doc.text('CEP', leftCol + 200, currentY, { width: 80 });
    doc.text('Cidade', rightCol, currentY, { width: 100 });
    doc.text('UF', rightCol + 150, currentY, { width: 50 });
    
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('São Paulo, SP', leftCol, currentY + 12, { width: 190 });
    doc.text('01000-000', leftCol + 200, currentY + 12, { width: 80 });
    doc.text('São Paulo', rightCol, currentY + 12, { width: 100 });
    doc.text('SP', rightCol + 150, currentY + 12, { width: 50 });
    
    doc.moveDown(3);
    
    // === III. CONDIÇÕES E CARACTERÍSTICAS ===
    doc.fontSize(12).font('Helvetica-Bold').text('III. CONDIÇÕES E CARACTERÍSTICAS DESTA CÉDULA DE CRÉDITO BANCÁRIO');
    doc.moveDown(0.5);
    
    // Tabela de condições (campos 1-20)
    const tableData = [
      ['1. Valor de Principal:', `R$ ${condicoesData.valor?.toFixed(2).replace('.', ',') || '0,00'}`, '2. Data de Emissão:', dataEmissao, '3. Vencimento da 1ª Parcela:', 'A definir', '4. Vencimento da Última Parcela:', 'A definir'],
      ['5. Prazo de Amortização:', `${condicoesData.prazo || 0} mes(es)`, '6. Juros Modalidade:', 'Pré-Fixados', '7. Percentual/Índice:', `${condicoesData.taxaJuros || proposta.tabelas_comerciais?.taxa_juros || 0}% a.m.`, '8. Periodicidade da Capitalização dos Juros:', 'Diária, com base em um ano de 365 dias'],
      ['9. Taxa de Juros Efetiva Mensal:', `${condicoesData.taxaJuros || proposta.tabelas_comerciais?.taxa_juros || 0}%`, '10. Taxa de Juros Efetiva Anual:', 'A calcular', '11. IOF:', `R$ ${condicoesData.valorIof?.toFixed(2).replace('.', ',') || '0,00'}`, '12. Praça de Pagamento:', 'São Paulo/SP'],
      ['13. Formas de Pagamento das Parcelas:', 'Cobrança por boleto', '', '', 'TAC:', `R$ ${condicoesData.valorTac?.toFixed(2).replace('.', ',') || '0,00'}`],
      ['14. Ano Base:', '365 dias', '15. Cálculo dos Encargos:', 'Incidentes sobre o Saldo Devedor', '16. Custo Efetivo Total - CET:', 'A calcular'],
      ['17. Tarifa de TED:', 'R$ 0,00', '18. Taxa de Crédito:', 'R$ 0,00', '', ''],
      ['19. Data de liberação do recurso:', dataEmissao, '20. Valor líquido liberado:', `R$ ${condicoesData.valor?.toFixed(2).replace('.', ',') || '0,00'}`],
      ['20.a Valor Líquido Liberado ao Emissor:', `R$ ${condicoesData.valor?.toFixed(2).replace('.', ',') || '0,00'}`, '', '', '', '']
    ];
    
    // Renderizar tabela
    currentY = doc.y;
    const cellHeight = 20;
    const cellWidth = 125;
    
    for (let row = 0; row < tableData.length; row++) {
        const rowData = tableData[row];
        let x = leftCol;
        
        for (let col = 0; col < rowData.length; col += 2) {
            if (rowData[col]) {
                // Campo
                doc.rect(x, currentY, cellWidth, cellHeight).stroke();
                doc.fontSize(8).font('Helvetica');
                doc.text(rowData[col], x + 2, currentY + 2, { width: cellWidth - 4 });
                
                // Valor
                if (rowData[col + 1]) {
                    doc.fontSize(8).font('Helvetica-Bold');
                    doc.text(rowData[col + 1], x + 2, currentY + 12, { width: cellWidth - 4 });
                }
            }
            x += cellWidth;
        }
        currentY += cellHeight;
    }
    
    // Adicionar nova página para continuar
    doc.addPage();
    
    // === FLUXO DE PAGAMENTO ===
    doc.fontSize(12).font('Helvetica-Bold').text('FLUXO DE PAGAMENTO', { align: 'center' });
    doc.moveDown(0.5);
    
    // Cabeçalho da tabela de parcelas
    currentY = doc.y;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Parcela', leftCol, currentY, { width: 80, align: 'center' });
    doc.text('Data de Vencimento', leftCol + 80, currentY, { width: 120, align: 'center' });
    doc.text('Valor R$', leftCol + 200, currentY, { width: 100, align: 'center' });
    
    // Linha separadora
    doc.rect(leftCol, currentY + 15, 300, 1).fill();
    currentY += 25;
    
    // Gerar parcelas
    const valorParcela = condicoesData.parcela || calcularParcela(condicoesData.valor || 0, condicoesData.prazo || 1, condicoesData.taxaJuros || 0);
    
    for (let i = 1; i <= (condicoesData.prazo || 1); i++) {
        const dataVencimento = new Date();
        dataVencimento.setMonth(dataVencimento.getMonth() + i);
        
        doc.fontSize(9).font('Helvetica');
        doc.text(i.toString().padStart(2, '0'), leftCol, currentY, { width: 80, align: 'center' });
        doc.text(dataVencimento.toLocaleDateString('pt-BR'), leftCol + 80, currentY, { width: 120, align: 'center' });
        doc.text(`R$ ${valorParcela.toFixed(2).replace('.', ',')}`, leftCol + 200, currentY, { width: 100, align: 'center' });
        
        currentY += 15;
        
        // Nova página se necessário
        if (currentY > 700) {
            doc.addPage();
            currentY = 50;
        }
    }
    
    doc.moveDown(2);
    
    // === TEXTO PRINCIPAL ===
    doc.fontSize(10).font('Helvetica');
    const textoObrigacao = `Eu, ${clienteData.nome} (doravante denominado "Emitente"), prometo pagar por esta cédula de crédito bancário, emitida e assinada de forma física ou eletrônica ("Cédula" ou "CCB"), ao Credor, ou à sua ordem, na praça e nas datas indicadas no Campo IV e V do preâmbulo, em moeda corrente nacional, a quantia líquida, certa e exigível de principal acrescida dos encargos previstos nesta Cédula, observado o disposto nas demais cláusulas a seguir descritas. Referido valor corresponde ao empréstimo que me foi concedido pelo Credor mediante minha solicitação, cujos termos, valor, encargos, acessórios e condições a seguir enunciados foram aceitos com estrita boa-fé e de livre e espontânea vontade.`;
    
    doc.text(textoObrigacao, { align: 'justify' });
    doc.moveDown();
    
    const textoValor = `O valor das parcelas de principal acrescidas dos juros remuneratórios estabelecidos no Campo IV do preâmbulo será pago pelo Emitente de acordo com as datas de vencimento apresentadas, da forma indicada no preâmbulo, se outra forma não for convencionada com o Credor por escrito.`;
    
    doc.text(textoValor, { align: 'justify' });
    doc.moveDown();
    
    const textoLei = `A presente Cédula é regida, incluindo seus eventuais aditivos e anexos, pela legislação em vigor aplicável à espécie, incluindo, mas não se limitando à Lei nº 10.931, de 02 de agosto de 2004, conforme alterada ("Lei nº 10.931"), pelas condições do quadro preambular acima e pelas cláusulas a seguir:`;
    
    doc.text(textoLei, { align: 'justify' });
    doc.moveDown(2);
    
    // === CLÁUSULAS ===
    addClausulas(doc);
    
    // === ASSINATURAS ===
    doc.addPage();
    doc.fontSize(12).font('Helvetica-Bold').text('ASSINATURAS', { align: 'center' });
    doc.moveDown(2);
    
    doc.fontSize(11).font('Helvetica');
    doc.text(`Local e Data: São Paulo, ${dataEmissao}`);
    doc.moveDown(3);
    
    doc.text('_'.repeat(50));
    doc.text(`EMITENTE: ${clienteData.nome}`);
    doc.text(`CPF: ${clienteData.cpf}`);
    doc.moveDown(3);
    
    doc.text('_'.repeat(50));
    doc.text(`CREDOR: ${proposta.lojas?.parceiros?.razao_social || 'N/A'}`);
    doc.text(`CNPJ: ${proposta.lojas?.parceiros?.cnpj || 'N/A'}`);
    
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
    
    console.log(`🔄 [CCB Generator] Fazendo upload para bucket 'documents', caminho: ${filePath}`);
    console.log(`🔄 [CCB Generator] Tamanho do buffer: ${pdfBuffer.length} bytes`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
        metadata: {
          'x-document-type': 'ccb',
          'x-proposta-id': propostaId,
          'x-generated-by': 'simpix-system',
          'x-document-version': '1.0'
        }
      });
    
    if (uploadError) {
      console.error(`❌ [CCB Generator] Erro no upload: ${uploadError.message}`);
      console.error(`❌ [CCB Generator] Detalhes do erro:`, uploadError);
      throw new Error(`Erro ao fazer upload da CCB: ${uploadError.message}`);
    }
    
    console.log(`✅ [CCB Generator] Upload realizado com sucesso:`, uploadData);
    console.log(`✅ [CCB Generator] Path final no storage: ${uploadData?.path}`);
    console.log(`✅ [CCB Generator] Full path no storage: ${uploadData?.fullPath}`);
    
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

// Função para adicionar todas as cláusulas jurídicas
function addClausulas(doc: PDFKit.PDFDocument) {
  doc.fontSize(12).font('Helvetica-Bold').text('CLÁUSULAS E CONDIÇÕES');
  doc.moveDown();
  
  // Cláusula Primeira
  doc.fontSize(11).font('Helvetica-Bold').text('Cláusula Primeira');
  doc.fontSize(10).font('Helvetica');
  const clausula1 = `– O Credor concedeu ao Emitente um empréstimo no valor e nas demais condições indicadas no preâmbulo, cujo importe líquido, deduzido de despesas, tarifas e Imposto sobre Operações de Crédito ("IOF") cobrado antecipadamente, será liberado por meio de crédito em conta do Emitente, conforme indicada no preâmbulo, observado o disposto nesta CCB.`;
  doc.text(clausula1, { align: 'justify' });
  doc.moveDown();
  
  // Cláusula Segunda
  doc.fontSize(11).font('Helvetica-Bold').text('Cláusula Segunda');
  doc.fontSize(10).font('Helvetica');
  const clausula2 = `– O Emitente declara-se ciente e de acordo, bem como se obriga a restituir o valor mutuado ao Credor ou a quem este indicar, acrescido dos encargos, taxas, do Custo Efetivo Total – CET, nos prazos estabelecidos no preâmbulo. Os juros ajustados nesta Cédula serão calculados de forma exponencial e capitalizados diariamente, com base em um ano de 365 (trezentos e sessenta e cinco) dias.`;
  doc.text(clausula2, { align: 'justify' });
  doc.moveDown();
  
  doc.fontSize(10).font('Helvetica');
  const paragrafoPrimeiro = `§ Primeiro – O Emitente declara ter ciência que a presente CCB não está submetida ao limite de 12% (doze por cento) ao ano, como já decidiu o Supremo Tribunal Federal, sendo legítima a cobrança de juros e encargos superiores a esse percentual.`;
  doc.text(paragrafoPrimeiro, { align: 'justify' });
  doc.moveDown();
  
  // Cláusula Terceira - Encargos Moratórios
  doc.fontSize(11).font('Helvetica-Bold').text('Cláusula Terceira – Encargos Moratórios');
  doc.fontSize(10).font('Helvetica');
  const clausula3 = `– O atraso no pagamento de quaisquer importâncias devidas, vencidas e não pagas na época em que forem exigíveis por força do disposto nesta Cédula, ou nas hipóteses de vencimento antecipado da dívida adiante previstas, implicará automaticamente na mora, ficando o débito sujeito, do vencimento ao efetivo pagamento a:
• juros moratórios de 1% a.m. (um por cento ao mês) ou fração (pro rata temporis);
• juros remuneratórios às taxas indicadas no Campo III, aplicáveis sobre o capital devidamente corrigido; e
• multa de 2% (dois por cento) sobre o total do débito não pago, incluindo encargos moratórios e remuneratórios.`;
  doc.text(clausula3, { align: 'justify' });
  doc.moveDown();
  
  // Cláusula Quarta - Vencimento Antecipado
  doc.fontSize(11).font('Helvetica-Bold').text('Cláusula Quarta – Do Vencimento Antecipado desta Cédula');
  doc.fontSize(10).font('Helvetica');
  const clausula4 = `– Observados os prazos de cura aplicáveis, o presente título vencerá antecipadamente, permitindo ao Credor exigir de imediato o pagamento do Valor de Principal, conforme indicado no Campo III do preâmbulo, e de todos os encargos contratuais, independentemente de interpelação ou notificação judicial ou extrajudicial, nos casos previstos em lei, especialmente nos artigos 333 e 1.425 do Código Civil, e ainda na ocorrência de qualquer das seguintes hipóteses:
(a) caso seja decretada, contra o Emitente, qualquer decisão resultante de ação ou execução que afete a capacidade de pagamento do presente título;
(b) caso o Emitente deixe de cumprir quaisquer das obrigações de pagamento ou acessórias desta CCB, no tempo e modo convencionados neste título;
(c) caso o Emitente tenha título levado a protesto e/ou nome inserido em qualquer órgão de proteção ao crédito, sem a devida regularização no prazo de 25 (vinte e cinco) dias.`;
  doc.text(clausula4, { align: 'justify' });
  doc.moveDown();
  
  // Cláusula Quinta - Compensação
  doc.fontSize(11).font('Helvetica-Bold').text('Cláusula Quinta – Da Compensação');
  doc.fontSize(10).font('Helvetica');
  const clausula5 = `– O Emitente autoriza, desde já e expressamente, em caráter irrevogável e irretratável, o Credor a proceder à compensação de que trata o artigo 368 do Código Civil entre o débito decorrente desta Cédula e qualquer crédito do qual seja titular, existente ou que venha a existir, contra o Credor.`;
  doc.text(clausula5, { align: 'justify' });
  doc.moveDown();
  
  // Cláusula Sexta - Declarações
  doc.fontSize(11).font('Helvetica-Bold').text('Cláusula Sexta – Declarações e Obrigações Adicionais');
  doc.fontSize(10).font('Helvetica');
  const clausula6 = `– O Emitente declara e garante que:
(a) Possui plena capacidade e legitimidade para emitir a presente CCB;
(b) Está apto a cumprir as obrigações ora previstas nesta CCB;
(c) Não se encontra em estado de necessidade ou sob coação para emitir esta CCB;
(d) Não se opõe aos encargos cobrados nesta CCB;
(e) As informações prestadas ao Credor são verdadeiras;
(f) Leu a presente Cédula e não tem dúvidas sobre qualquer de suas condições.`;
  doc.text(clausula6, { align: 'justify' });
  doc.moveDown();
  
  // Disposições Finais
  doc.fontSize(11).font('Helvetica-Bold').text('Disposições Finais');
  doc.fontSize(10).font('Helvetica');
  const disposicoesFinals = `Esta Cédula é título executivo extrajudicial, nos termos da Lei nº 10.931/2004, e constitui a prova do débito e das condições de pagamento. Todas as despesas oriundas desta CCB, inclusive tributos, contribuições e demais despesas, serão suportadas integralmente pelo Emitente.`;
  doc.text(disposicoesFinals, { align: 'justify' });
  doc.moveDown(2);
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