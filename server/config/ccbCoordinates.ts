/**
 * Coordenadas CCB mapeadas com base no DEBUG GRID PDF
 * Gerado em: ${new Date().toISOString()}
 * 
 * Sistema de coordenadas: origem no canto inferior esquerdo (padrão PDF)
 * Y cresce de baixo para cima, X cresce da esquerda para direita
 */

export interface CCBFieldConfig {
  x: number;
  y: number;
  fontSize?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
}

export interface CCBCoordinates {
  page1: Record<string, CCBFieldConfig>;
  page2: Record<string, CCBFieldConfig>;
  page3: Record<string, CCBFieldConfig>;
  page4: Record<string, CCBFieldConfig>;
  page5: Record<string, CCBFieldConfig>;
  page6: Record<string, CCBFieldConfig>;
  page7: Record<string, CCBFieldConfig>;
  page8: Record<string, CCBFieldConfig>;
}

export const ccbCoordinates: CCBCoordinates = {
  page1: {
    // Cabeçalho
    numeroCCB: { x: 150, y: 750, fontSize: 12, bold: true },
    dataEmissao: { x: 300, y: 750, fontSize: 10 },
    finalidadeOperacao: { x: 450, y: 750, fontSize: 10 },
    
    // Seção I - EMITENTE
    emitenteNome: { x: 150, y: 650, fontSize: 11, bold: true },
    emitenteCPF: { x: 300, y: 700, fontSize: 11 },
    emitenteRG: { x: 250, y: 650, fontSize: 10 },
    emitenteExpedidor: { x: 350, y: 650, fontSize: 10 },
    emitenteNacionalidade: { x: 450, y: 650, fontSize: 10 },
    emitenteLocalNascimento: { x: 500, y: 650, fontSize: 10 },
    emitenteEstadoCivil: { x: 150, y: 600, fontSize: 10 },
    emitenteEndereco: { x: 200, y: 600, fontSize: 10, maxWidth: 180 },
    emitenteCEP: { x: 400, y: 600, fontSize: 10 },
    emitenteCidade: { x: 450, y: 600, fontSize: 10 },
    emitenteUF: { x: 550, y: 600, fontSize: 10 },
    
    // Seção II - CREDOR ORIGINÁRIO
    credorRazaoSocial: { x: 150, y: 500, fontSize: 11, bold: true },
    credorCNPJ: { x: 400, y: 500, fontSize: 11 },
    credorEndereco: { x: 150, y: 450, fontSize: 10, maxWidth: 180 },
    credorCEP: { x: 350, y: 450, fontSize: 10 },
    credorCidade: { x: 450, y: 450, fontSize: 10 },
    credorUF: { x: 550, y: 450, fontSize: 10 },
    
    // Valores e Condições
    valorPrincipal: { x: 200, y: 400, fontSize: 12, bold: true },
    dataEmissaoValor: { x: 350, y: 400, fontSize: 10 },
    vencimentoParcela: { x: 500, y: 400, fontSize: 10 },
    vencimentoUltimaParcela: { x: 200, y: 350, fontSize: 10 },
    prazoAmortizacao: { x: 350, y: 350, fontSize: 10 },
    percentualIndice: { x: 500, y: 350, fontSize: 10 },
    taxaJurosEfetivaMensal: { x: 200, y: 300, fontSize: 11, bold: true },
    taxaJurosEfetivaAnual: { x: 350, y: 300, fontSize: 11, bold: true },
    iof: { x: 450, y: 300, fontSize: 10 },
    pracaPagamento: { x: 500, y: 300, fontSize: 10 },
    
    // CET e Taxas
    custoEfetivoTotal: { x: 250, y: 200, fontSize: 12, bold: true },
    tarifaTED: { x: 350, y: 200, fontSize: 10 },
    tac: { x: 400, y: 200, fontSize: 10 },
    taxaCredito: { x: 500, y: 200, fontSize: 10 },
    
    // Liberação
    dataLiberacaoRecurso: { x: 250, y: 150, fontSize: 10 },
    valorLiquidoLiberado: { x: 400, y: 150, fontSize: 11, bold: true },
    valorLiquidoLiberadoEmissor: { x: 500, y: 150, fontSize: 11 }
  },
  
  page2: {
    // Dados Bancários do Emitente
    emitenteBancoNumero: { x: 250, y: 650, fontSize: 10 },
    emitenteAgenciaNumero: { x: 350, y: 650, fontSize: 10 },
    emitenteContaNumero: { x: 450, y: 650, fontSize: 10 },
    emitenteTipoConta: { x: 550, y: 650, fontSize: 10 },
    
    // Emitente Empresa (se aplicável)
    emitenteEmpresaRazaoSocial: { x: 250, y: 650, fontSize: 11 },
    emitenteEmpresaCNPJ: { x: 150, y: 600, fontSize: 11 },
    
    // Dados Bancários para Pagamento
    pagamentoBancoNumero: { x: 400, y: 650, fontSize: 10 },
    pagamentoAgenciaNumero: { x: 500, y: 650, fontSize: 10 },
    pagamentoContaNumero: { x: 400, y: 600, fontSize: 10 },
    pagamentoTipoConta: { x: 500, y: 600, fontSize: 10 },
    
    // Descrição dos Serviços
    descricaoServicosFinanciados: { x: 150, y: 550, fontSize: 10, maxWidth: 400 },
    
    // Quitação de Dívidas
    instituicaoFavorecida: { x: 250, y: 550, fontSize: 10 },
    numeroContratoQuitacao: { x: 450, y: 550, fontSize: 10 },
    linhaDigitavelBoleto: { x: 250, y: 500, fontSize: 10, maxWidth: 300 },
    
    // Fluxo de Pagamento (primeira parcela)
    fluxoPagamentoParcela: { x: 200, y: 500, fontSize: 10 },
    fluxoPagamentoDataVencimento: { x: 350, y: 500, fontSize: 10 },
    fluxoPagamentoValor: { x: 500, y: 500, fontSize: 11, bold: true }
  },
  
  page3: {
    // Página 3 - Condições Gerais e Termos
    // Geralmente contém texto padrão, não precisa de campos dinâmicos
  },
  
  page4: {
    // Página 4 - Condições Gerais continuação
    // Geralmente contém texto padrão, não precisa de campos dinâmicos
  },
  
  page5: {
    // Página 5 - Cláusulas e Condições
    // Geralmente contém texto padrão, não precisa de campos dinâmicos
  },
  
  page6: {
    // Página 6 - Disposições Finais
    // Geralmente contém texto padrão, não precisa de campos dinâmicos
  },
  
  page7: {
    // Página 7 - Assinaturas
    // Os campos de assinatura são gerenciados pelo ClickSign
  },
  
  page8: {
    // Tabela de Pagamento - até 6 linhas
    tabelaPagamentoData1: { x: 150, y: 700, fontSize: 10 },
    tabelaPagamentoValor1: { x: 300, y: 700, fontSize: 10, bold: true },
    tabelaPagamentoBoleto1: { x: 400, y: 700, fontSize: 9, maxWidth: 180 },
    
    tabelaPagamentoData2: { x: 150, y: 650, fontSize: 10 },
    tabelaPagamentoValor2: { x: 300, y: 650, fontSize: 10, bold: true },
    tabelaPagamentoBoleto2: { x: 400, y: 650, fontSize: 9, maxWidth: 180 },
    
    tabelaPagamentoData3: { x: 150, y: 600, fontSize: 10 },
    tabelaPagamentoValor3: { x: 300, y: 600, fontSize: 10, bold: true },
    tabelaPagamentoBoleto3: { x: 400, y: 600, fontSize: 9, maxWidth: 180 },
    
    tabelaPagamentoData4: { x: 150, y: 550, fontSize: 10 },
    tabelaPagamentoValor4: { x: 300, y: 550, fontSize: 10, bold: true },
    tabelaPagamentoBoleto4: { x: 400, y: 550, fontSize: 9, maxWidth: 180 },
    
    tabelaPagamentoData5: { x: 150, y: 500, fontSize: 10 },
    tabelaPagamentoValor5: { x: 300, y: 500, fontSize: 10, bold: true },
    tabelaPagamentoBoleto5: { x: 400, y: 500, fontSize: 9, maxWidth: 180 },
    
    tabelaPagamentoData6: { x: 150, y: 450, fontSize: 10 },
    tabelaPagamentoValor6: { x: 300, y: 450, fontSize: 10, bold: true },
    tabelaPagamentoBoleto6: { x: 400, y: 450, fontSize: 9, maxWidth: 180 }
  }
};

/**
 * Função auxiliar para obter configuração de campo
 */
export function getFieldConfig(page: number, fieldName: string): CCBFieldConfig | null {
  const pageKey = `page${page}` as keyof CCBCoordinates;
  const pageConfig = ccbCoordinates[pageKey];
  return pageConfig?.[fieldName] || null;
}

/**
 * Lista de todos os campos mapeados por página
 */
export const mappedFields = {
  page1: Object.keys(ccbCoordinates.page1),
  page2: Object.keys(ccbCoordinates.page2),
  page3: Object.keys(ccbCoordinates.page3),
  page4: Object.keys(ccbCoordinates.page4),
  page5: Object.keys(ccbCoordinates.page5),
  page6: Object.keys(ccbCoordinates.page6),
  page7: Object.keys(ccbCoordinates.page7),
  page8: Object.keys(ccbCoordinates.page8)
};

/**
 * Mapeamento de campos da proposta para campos CCB
 */
export const proposalToCCBMapping = {
  // Página 1
  numeroCCB: (data: any) => data.numero_ccb || `CCB-${new Date().getFullYear()}-${data.id?.slice(0, 8)}`,
  dataEmissao: (data: any) => formatDate(data.created_at || new Date()),
  finalidadeOperacao: () => "EMPRÉSTIMO PESSOAL",
  
  // Emitente
  emitenteNome: (data: any) => data.cliente_data?.nome_completo || '',
  emitenteCPF: (data: any) => formatCPF(data.cliente_data?.cpf || ''),
  emitenteRG: (data: any) => data.cliente_data?.rg || '',
  emitenteExpedidor: (data: any) => data.cliente_data?.orgao_expedidor || '',
  emitenteNacionalidade: (data: any) => data.cliente_data?.nacionalidade || 'Brasileiro(a)',
  emitenteLocalNascimento: (data: any) => data.cliente_data?.naturalidade || '',
  emitenteEstadoCivil: (data: any) => data.cliente_data?.estado_civil || '',
  emitenteEndereco: (data: any) => formatAddress(data.cliente_data),
  emitenteCEP: (data: any) => formatCEP(data.cliente_data?.cep || ''),
  emitenteCidade: (data: any) => data.cliente_data?.cidade || '',
  emitenteUF: (data: any) => data.cliente_data?.estado || '',
  
  // Credor
  credorRazaoSocial: () => "SIMPIX LTDA",
  credorCNPJ: () => "12.345.678/0001-90", // Substituir pelo CNPJ real
  credorEndereco: () => "Rua Example, 123",
  credorCEP: () => "01234-567",
  credorCidade: () => "São Paulo",
  credorUF: () => "SP",
  
  // Valores
  valorPrincipal: (data: any) => formatCurrency(data.condicoes_credito?.valor_emprestimo || 0),
  taxaJurosEfetivaMensal: (data: any) => `${data.condicoes_credito?.taxa_juros || 0}%`,
  taxaJurosEfetivaAnual: (data: any) => `${((data.condicoes_credito?.taxa_juros || 0) * 12).toFixed(2)}%`,
  custoEfetivoTotal: (data: any) => `${data.condicoes_credito?.cet || 0}%`,
  
  // Página 8 - Tabela de Pagamento
  tabelaPagamentoData1: (data: any) => formatDate(data.parcelas?.[0]?.data_vencimento),
  tabelaPagamentoValor1: (data: any) => formatCurrency(data.parcelas?.[0]?.valor),
  // ... continuar para outras parcelas
};

// Funções auxiliares de formatação
function formatDate(date: string | Date): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR');
}

function formatCPF(cpf: string): string {
  if (!cpf) return '';
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatCEP(cep: string): string {
  if (!cep) return '';
  return cep.replace(/(\d{5})(\d{3})/, '$1-$2');
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function formatAddress(clienteData: any): string {
  if (!clienteData) return '';
  const parts = [
    clienteData.endereco,
    clienteData.numero,
    clienteData.complemento,
    clienteData.bairro
  ].filter(Boolean);
  return parts.join(', ');
}

export default ccbCoordinates;