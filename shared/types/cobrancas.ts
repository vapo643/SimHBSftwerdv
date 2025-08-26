/**
 * Interfaces TypeScript para o módulo de Cobranças
 * PAM V1.0 - Refatoração de Type Safety
 */

// Interface para propostas de cobrança
export interface PropostaCobranca {
  id: string;
  numeroContrato?: string;
  numero_proposta?: string;
  nomeCliente: string;
  cpfCliente: string;
  status: 'em_dia' | 'inadimplente' | 'quitado' | 'pendente';
  valorParcela: number;
  valorTotal: number;
  dataProximoVencimento?: string;
  diasAtraso: number;
  parcelasAtrasadas?: number;
  valorEmAtraso?: number;
  quantidadeParcelas?: number;
  parcelasPagas?: number;

  // Dados do Banco Inter
  interSituacao?: string;
  nossoNumero?: string;
  seuNumero?: string;
  dataVencimento?: string;
  valorNominal?: number;
  codigoBarras?: string;
  linhaDigitavel?: string;
  pixCopiaECola?: string;
  pixQrCode?: string;

  // Dados de contato
  telefone?: string;
  email?: string;
  celular?: string;

  // Status de formalizacao
  ccbAssinada?: boolean;
  linkCcb?: string;

  // Propriedades adicionais para compatibilidade
  codigoSolicitacao?: string;
  numeroParcela?: number;
  valor?: number;
  situacao?: 'Em dia' | 'Atraso' | 'Vencido';
}

// Interface para KPIs de cobrança
export interface KPIsCobranca {
  valorTotalEmAtraso: number;
  quantidadeContratosEmAtraso: number;
  taxaInadimplencia: number;
  valorTotalCarteira: number;
  quantidadeTotalContratos: number;
}

// Interface para observações
export interface ObservacaoCobranca {
  id: number;
  usuario_nome: string;
  observacao: string;
  status: string;
  created_at: string;
  createdAt?: string; // Alias para compatibilidade
  is_promessa?: boolean;
  data_promessa?: string;
  valor_promessa?: number;
  tipoContato?: string;
  userName?: string; // Alias para usuario_nome
}

// Interface para ficha do cliente (já existe mas vou melhorar)
export interface FichaCliente {
  cliente: {
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
    dataNascimento: string;
    endereco: string;
    cep: string;
    ocupacao: string;
  };
  dadosBancarios: {
    banco: string;
    agencia: string;
    conta: string;
    tipoConta: string;
    pix: string;
    tipoPix: string;
    titular: string;
  };
  referencias: Array<{
    id: number;
    nomeCompleto: string;
    grauParentesco: string;
    telefone: string;
  }>;
  contrato: {
    numeroContrato: string;
    dataContrato: string;
    valorTotal: number;
    valorFinanciado: number;
    prazo: number;
    taxaJuros: number;
    ccbAssinada: boolean;
    status: string;
  };
  parcelas: Array<{
    id: number;
    numeroParcela: number;
    valorParcela: number;
    dataVencimento: string;
    dataPagamento?: string;
    status: 'pago' | 'vencido' | 'pendente';
    diasAtraso?: number;
    valorPago?: number;
    // Dados do Banco Inter
    nossoNumero?: string;
    situacao?: string;
    interSituacao?: string; // Status real do Banco Inter
    codigoSolicitacao?: string;
    linhaDigitavel?: string;
    codigoBarras?: string;
    pixCopiaECola?: string;
  }>;
  resumoFinanceiro: {
    totalPago: number;
    totalPendente: number;
    totalVencido: number;
    proximoVencimento?: string;
    valorProximaParcela?: number;
  };
  observacoes: ObservacaoCobranca[];
}

// Interface para informações de dívida (desconto de quitação)
export interface DebtInfo {
  propostaId: string;
  valorTotal: number;
  valorPendente: number;
  parcelasPendentes: number;
  valorPago?: number;
  valorRestante?: number;
  totalBoletosAtivos?: number;
  boletosAtivos?: Array<{
    codigoSolicitacao: string;
    valor: number;
    vencimento: string;
    status: string;
  }>;
  parcelas: Array<{
    numero: number;
    valor: number;
    vencimento: string;
    status: string;
  }>;
}

// Interface para resposta de exportação
export interface ExportacaoInadimplentes {
  inadimplentes: Array<{
    [key: string]: any;
  }>;
  total: number;
}

// Interface para dados de prorrogação de boletos
export interface ProrrogacaoData {
  codigosSolicitacao: string[];
  novaDataVencimento: string;
}

// Interface para dados de desconto de quitação
export interface DescontoQuitacaoData {
  propostaId: string;
  desconto: number;
  novasParcelas: Array<{
    valor: number;
    dataVencimento: string;
  }>;
}

// Interface para resposta de mutations
export interface MutationResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

// Interface para coleções do Banco Inter
export interface InterCollection {
  id: string;
  proposta_id: string;
  codigo_solicitacao: string;
  nosso_numero: string;
  seu_numero?: string;
  situacao: string;
  data_vencimento: string;
  valor_nominal: number;
  linha_digitavel?: string;
  codigo_barras?: string;
  pix_copia_e_cola?: string;
  pix_qr_code?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Tipo para status de vencimento
export interface StatusVencimento {
  text: string;
  color: string;
}

// Tipo para filtros
export type StatusFilter = 'todos' | 'em_dia' | 'inadimplente' | 'quitado';
export type AtrasoFilter = 'todos' | '1-30' | '31-60' | '61-90' | '90+';

// Tipo para status de observação
export type StatusObservacao =
  | 'Contato Realizado'
  | 'Promessa de Pagamento'
  | 'Sem Retorno'
  | 'Recado'
  | 'Número Inexistente'
  | 'Outros';
