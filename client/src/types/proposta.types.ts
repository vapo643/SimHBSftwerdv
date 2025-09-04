// ViewModel para a tela de análise - Contrato explícito de dados
export interface PropostaAnaliseViewModel {
  // Identificação
  id: string;
  numeroProposta?: number;
  status: string;
  
  // Dados do Cliente (estruturado e plano)
  cliente: {
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
    dataNascimento: string;
    rendaMensal: string;
    rg: string;
    orgaoEmissor: string;
    estadoCivil: string;
    nacionalidade: string;
    cep: string;
    endereco: string;
    ocupacao: string;
  };
  
  // Condições do Empréstimo
  condicoes: {
    valorSolicitado: string | number;
    prazo: number;
    finalidade: string;
    garantia: string;
    valorTac: string | number;
    valorIof: string | number;
    valorTotalFinanciado: string | number;
    taxaJuros?: number;
  };
  
  // Informações da Proposta
  loja: {
    id?: number;
    nome: string;
  };
  
  produto: {
    id?: number;
    nome: string;
  };
  
  tabelaComercial: {
    id?: number;
    nome: string;
    taxa?: number;
  };
  
  // Metadados
  createdAt?: string;
  updatedAt?: string;
  
  // Análise
  motivoPendencia?: string;
  motivoRejeicao?: string;
  observacoes?: string;
  
  // Documentos
  documentos?: Array<{
    id: string;
    tipo: string;
    url: string;
    nome: string;
  }>;
}

// DTO da API - estrutura bruta recebida do backend
export interface PropostaApiResponse {
  success: boolean;
  data: {
    id: string;
    numero_proposta?: number;
    status: string;
    cliente_data?: any; // JSON string ou objeto
    clienteData?: any;  // Duplicado para compatibilidade
    
    // Dados do cliente (podem vir como campos planos em casos legados)
    cliente_nome?: string;
    clienteNome?: string;
    cliente_cpf?: string;
    clienteCpf?: string;
    cliente_email?: string;
    clienteEmail?: string;
    cliente_telefone?: string;
    clienteTelefone?: string;
    cliente_data_nascimento?: string;
    clienteDataNascimento?: string;
    cliente_renda?: any;
    clienteRenda?: any;
    cliente_rg?: string;
    clienteRg?: string;
    cliente_orgao_emissor?: string;
    clienteOrgaoEmissor?: string;
    cliente_estado_civil?: string;
    clienteEstadoCivil?: string;
    cliente_nacionalidade?: string;
    clienteNacionalidade?: string;
    cliente_cep?: string;
    clienteCep?: string;
    cliente_endereco?: string;
    clienteEndereco?: string;
    cliente_ocupacao?: string;
    clienteOcupacao?: string;
    
    // Dados financeiros
    valor?: any;
    valor_solicitado?: any;
    valorSolicitado?: any;
    prazo?: any;
    prazo_meses?: any;
    taxa_juros?: any;
    taxaJuros?: any;
    valor_tac?: any;
    valorTac?: any;
    valor_iof?: any;
    valorIof?: any;
    valor_total_financiado?: any;
    valorTotalFinanciado?: any;
    finalidade?: string;
    garantia?: string;
    
    // Dados relacionados
    loja_id?: number;
    loja_nome?: string;
    produto_id?: number;
    produto_nome?: string;
    tabela_comercial_id?: number;
    tabela_comercial_nome?: string;
    tabela_comercial_taxa?: number;
    
    // Metadados
    created_at?: string;
    createdAt?: string;
    updated_at?: string;
    updatedAt?: string;
    motivo_pendencia?: string;
    motivoPendencia?: string;
    motivo_rejeicao?: string;
    motivoRejeicao?: string;
    observacoes?: string;
    documentos?: any[];
    
    // Campos adicionais que podem vir
    [key: string]: any;
  };
}