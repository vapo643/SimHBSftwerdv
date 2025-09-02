import { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';

// Types from our orchestrator endpoint
interface Atendente {
  id: string;
  nome: string;
  loja: {
    id: number;
    nome: string;
    parceiro: {
      id: number;
      razaoSocial: string;
      cnpj: string;
    };
  };
}

interface TabelaComercial {
  id: number;
  nomeTabela: string;
  taxaJuros: string;
  prazos: number[];
  comissao: string;
  tipo: 'personalizada' | 'geral';
}

interface Produto {
  id: number;
  nome: string;
  tacValor: string;
  tacTipo: string;
  tabelasDisponiveis: TabelaComercial[];
}

interface OriginationContext {
  atendente: Atendente;
  produtos: Produto[];
  documentosObrigatorios: string[];
  limites: {
    valorMinimo: number;
    valorMaximo: number;
    prazoMinimo: number;
    prazoMaximo: number;
  };
}

// Client data interface
interface ClientData {
  // Tipo de pessoa
  tipoPessoa: 'PF' | 'PJ';

  // Dados pessoais
  cpf: string;
  nome: string;
  email: string;
  telefone: string;

  // Dados PJ (quando aplicável)
  razaoSocial?: string;
  cnpj?: string;

  // Documentação
  rg: string;
  orgaoEmissor: string;
  rgUf: string; // NOVO: UF do RG
  rgDataEmissao: string; // NOVO: Data de emissão do RG
  dataNascimento: string;
  localNascimento: string; // NOVO: Local de nascimento

  // Informações adicionais
  estadoCivil: string;
  nacionalidade: string;

  // Endereço detalhado
  cep: string;
  logradouro: string; // NOVO: Rua/Avenida separado
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;

  // Dados profissionais
  ocupacao: string;
  rendaMensal: string;
  telefoneEmpresa: string;

  // Novos campos de empregador e dados financeiros
  clienteEmpresaNome?: string; // Nome da Empresa
  clienteDataAdmissao?: string; // Data de Admissão (formato string para DatePicker)
  clienteDividasExistentes?: number; // Valor de Dívidas Existentes

  // Dados de pagamento
  metodoPagamento: 'conta_bancaria' | 'pix';

  // Dados bancários (quando conta_bancaria)
  dadosPagamentoBanco?: string;
  dadosPagamentoAgencia?: string;
  dadosPagamentoConta?: string;
  dadosPagamentoDigito?: string;
  dadosPagamentoTipo?: string; // Tipo de conta: conta_corrente ou conta_poupanca

  // Dados PIX (quando pix)
  dadosPagamentoPix?: string; // Chave PIX
  dadosPagamentoTipoPix?: string; // Tipo da chave (cpf, email, telefone, aleatoria)
  dadosPagamentoPixBanco?: string;
  dadosPagamentoPixNomeTitular?: string;
  dadosPagamentoPixCpfTitular?: string;
}

// Loan data interface
interface LoanData {
  produtoId: number | null;
  tabelaComercialId: number | null;
  valorSolicitado: string;
  prazo: number | null;
  incluirTac: boolean;
  dataCarencia?: string;
}

// Simulation result interface
interface SimulationResult {
  valorParcela: string;
  taxaJuros: string;
  taxaJurosAnual?: string;
  valorIOF: string;
  iofDetalhado?: {
    diario: string;
    adicional: string;
    total: string;
  };
  valorTAC: string;
  valorTotalFinanciado: string;
  valorTotalAPagar?: string;
  custoTotalOperacao?: string;
  custoEfetivoTotal: string;
  comissao?: string;
  comissaoPercentual?: string;
  cronogramaPagamento?: Array<{
    parcela: number;
    dataVencimento: string;
    valorParcela: number;
    valorJuros: number;
    valorAmortizacao: number;
    saldoDevedor: number;
  }>;
  jurosCarencia?: string;
  diasCarencia?: number;
  parametrosUtilizados?: {
    parceiroId?: number;
    produtoId?: number;
    taxaJurosMensal?: number;
    tacValor?: number;
    tacTipo?: string;
  };
}

// Document interface
interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  file: File;
}

// Personal reference interface
interface PersonalReference {
  nomeCompleto: string;
  grauParentesco: string;
  telefone: string;
  tipo_referencia: 'pessoal' | 'profissional'; // Campo obrigatório PAM V1.0
}

// Proposal state interface
interface ProposalState {
  context: OriginationContext | null;
  clientData: ClientData;
  loanData: LoanData;
  simulation: SimulationResult | null;
  documents: Document[];
  personalReferences: PersonalReference[];
  currentStep: number;
  errors: Record<string, string>;
  isLoading: boolean;
}

// Action types
type ProposalAction =
  | { type: 'SET_CONTEXT'; payload: OriginationContext }
  | { type: 'UPDATE_CLIENT'; payload: Partial<ClientData> }
  | { type: 'SELECT_PRODUCT'; payload: number }
  | { type: 'SELECT_TABLE'; payload: number }
  | { type: 'UPDATE_LOAN_CONDITIONS'; payload: Partial<LoanData> }
  | { type: 'SET_SIMULATION_RESULT'; payload: SimulationResult }
  | { type: 'CLEAR_SIMULATION' }
  | { type: 'ADD_DOCUMENT'; payload: Document }
  | { type: 'REMOVE_DOCUMENT'; payload: string }
  | { type: 'ADD_REFERENCE'; payload: PersonalReference }
  | { type: 'UPDATE_REFERENCE'; payload: { index: number; reference: PersonalReference } }
  | { type: 'REMOVE_REFERENCE'; payload: number }
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_ERROR'; payload: { field: string; message: string } }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RESET' };

// Initial state
const initialState: ProposalState = {
  context: null,
  clientData: {
    tipoPessoa: 'PF',
    cpf: '',
    nome: '',
    email: '',
    telefone: '',
    razaoSocial: '',
    cnpj: '',
    rg: '',
    orgaoEmissor: '',
    rgUf: '',
    rgDataEmissao: '',
    dataNascimento: '',
    localNascimento: '',
    estadoCivil: '',
    nacionalidade: 'Brasileira',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    ocupacao: '',
    rendaMensal: '',
    telefoneEmpresa: '',
    metodoPagamento: 'conta_bancaria',
    dadosPagamentoBanco: '',
    dadosPagamentoAgencia: '',
    dadosPagamentoConta: '',
    dadosPagamentoDigito: '',
    dadosPagamentoPix: '',
    dadosPagamentoTipoPix: '',
    dadosPagamentoPixBanco: '',
    dadosPagamentoPixNomeTitular: '',
    dadosPagamentoPixCpfTitular: '',
  },
  loanData: {
    produtoId: null,
    tabelaComercialId: null,
    valorSolicitado: '',
    prazo: null,
    incluirTac: true,
    dataCarencia: undefined,
  },
  simulation: null,
  documents: [],
  personalReferences: [],
  currentStep: 0,
  errors: {},
  isLoading: false,
};

// Reducer function
function proposalReducer(state: ProposalState, action: ProposalAction): ProposalState {
  switch (action.type) {
    case 'SET_CONTEXT':
      return {
        ...state,
        context: action.payload,
      };

    case 'UPDATE_CLIENT':
      return {
        ...state,
        clientData: {
          ...state.clientData,
          ...action.payload,
        },
      };

    case 'SELECT_PRODUCT':
      return {
        ...state,
        loanData: {
          ...state.loanData,
          produtoId: action.payload,
          tabelaComercialId: null, // Reset table when product changes
        },
        simulation: null, // Clear simulation when product changes
      };

    case 'SELECT_TABLE':
      return {
        ...state,
        loanData: {
          ...state.loanData,
          tabelaComercialId: action.payload,
        },
        simulation: null, // Clear simulation when table changes
      };

    case 'UPDATE_LOAN_CONDITIONS':
      return {
        ...state,
        loanData: {
          ...state.loanData,
          ...action.payload,
        },
        simulation: null, // Clear simulation when conditions change
      };

    case 'SET_SIMULATION_RESULT':
      return {
        ...state,
        simulation: action.payload,
      };

    case 'CLEAR_SIMULATION':
      return {
        ...state,
        simulation: null,
      };

    case 'ADD_DOCUMENT':
      return {
        ...state,
        documents: [...state.documents, action.payload],
      };

    case 'REMOVE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.filter((doc) => doc.id !== action.payload),
      };

    case 'ADD_REFERENCE':
      return {
        ...state,
        personalReferences: [...state.personalReferences, action.payload],
      };

    case 'UPDATE_REFERENCE':
      return {
        ...state,
        personalReferences: state.personalReferences.map((ref, index) =>
          index === action.payload.index ? action.payload.reference : ref
        ),
      };

    case 'REMOVE_REFERENCE':
      return {
        ...state,
        personalReferences: state.personalReferences.filter((_, index) => index !== action.payload),
      };

    case 'SET_STEP':
      return {
        ...state,
        currentStep: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.field]: action.payload.message,
        },
      };

    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: {},
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// Context
const ProposalContext = createContext<
  | {
      state: ProposalState;
      dispatch: React.Dispatch<ProposalAction>;
    }
  | undefined
>(undefined);

// Provider component
interface ProposalProviderProps {
  children: ReactNode;
}

export function ProposalProvider({ children }: ProposalProviderProps) {
  const [state, dispatch] = useReducer(proposalReducer, initialState);

  return (
    <ProposalContext.Provider value={{ state, dispatch }}>{children}</ProposalContext.Provider>
  );
}

// Custom hook
export function useProposal() {
  const context = useContext(ProposalContext);

  if (!context) {
    throw new Error('useProposal must be used within a ProposalProvider');
  }

  return context;
}

// Helper hook for common operations
export function useProposalActions() {
  const { dispatch } = useProposal();

  // REM-FCF-01.3: Memoizar todas as funções action para evitar loop infinito
  const setContext = useCallback(
    (context: OriginationContext) => dispatch({ type: 'SET_CONTEXT', payload: context }),
    [dispatch]
  );

  const updateClient = useCallback(
    (data: Partial<ClientData>) => dispatch({ type: 'UPDATE_CLIENT', payload: data }),
    [dispatch]
  );

  const selectProduct = useCallback(
    (productId: number) => dispatch({ type: 'SELECT_PRODUCT', payload: productId }),
    [dispatch]
  );

  const selectTable = useCallback(
    (tableId: number) => dispatch({ type: 'SELECT_TABLE', payload: tableId }),
    [dispatch]
  );

  const updateLoanConditions = useCallback(
    (data: Partial<LoanData>) => dispatch({ type: 'UPDATE_LOAN_CONDITIONS', payload: data }),
    [dispatch]
  );

  const setSimulationResult = useCallback(
    (result: SimulationResult) => dispatch({ type: 'SET_SIMULATION_RESULT', payload: result }),
    [dispatch]
  );

  const clearSimulation = useCallback(
    () => dispatch({ type: 'CLEAR_SIMULATION' }),
    [dispatch]
  );

  const addDocument = useCallback(
    (document: Document) => dispatch({ type: 'ADD_DOCUMENT', payload: document }),
    [dispatch]
  );

  const removeDocument = useCallback(
    (documentId: string) => dispatch({ type: 'REMOVE_DOCUMENT', payload: documentId }),
    [dispatch]
  );

  const addReference = useCallback(
    (reference: PersonalReference) => dispatch({ type: 'ADD_REFERENCE', payload: reference }),
    [dispatch]
  );

  const updateReference = useCallback(
    (index: number, reference: PersonalReference) =>
      dispatch({ type: 'UPDATE_REFERENCE', payload: { index, reference } }),
    [dispatch]
  );

  const removeReference = useCallback(
    (index: number) => dispatch({ type: 'REMOVE_REFERENCE', payload: index }),
    [dispatch]
  );

  const setStep = useCallback(
    (step: number) => dispatch({ type: 'SET_STEP', payload: step }),
    [dispatch]
  );

  const setError = useCallback(
    (field: string, message: string) => dispatch({ type: 'SET_ERROR', payload: { field, message } }),
    [dispatch]
  );

  const clearError = useCallback(
    (field: string) => dispatch({ type: 'SET_ERROR', payload: { field, message: '' } }),
    [dispatch]
  );

  const clearErrors = useCallback(
    () => dispatch({ type: 'CLEAR_ERRORS' }),
    [dispatch]
  );

  const setLoading = useCallback(
    (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),
    [dispatch]
  );

  const reset = useCallback(
    () => dispatch({ type: 'RESET' }),
    [dispatch]
  );

  return {
    setContext,
    updateClient,
    selectProduct,
    selectTable,
    updateLoanConditions,
    setSimulationResult,
    clearSimulation,
    addDocument,
    removeDocument,
    addReference,
    updateReference,
    removeReference,
    setStep,
    setError,
    clearError,
    clearErrors,
    setLoading,
    reset,
  };
}

// Custom hook for step validation
export function useStepValidation() {
  const { state } = useProposal();

  // UX-001: Função de validação por step para botão "Próximo"
  const isStepValid = useCallback((step: number): boolean => {
    switch (step) {
      case 0: // Dados do Cliente
        const clientData = state.clientData;
        const requiredClientFields = [
          clientData.nome,
          clientData.tipoPessoa === 'PF' ? clientData.cpf : clientData.cnpj,
          clientData.email,
          clientData.telefone,
          clientData.dataNascimento,
          clientData.cep,
          clientData.logradouro,
          clientData.numero,
          clientData.cidade,
          clientData.estado,
          clientData.ocupacao,
          clientData.rendaMensal,
        ];
        
        // Verificar se todos os campos obrigatórios estão preenchidos
        const allFieldsFilled = requiredClientFields.every(
          (field) => field && field.toString().trim() !== ''
        );
        
        // Verificar se não há erros de validação
        const hasValidationErrors = Object.keys(state.errors).some(key => 
          key.includes('cpf') || key.includes('email') || key.includes('telefone') || key.includes('cep')
        );
        
        return allFieldsFilled && !hasValidationErrors;

      case 1: // Referências Pessoais
        const references = state.personalReferences;
        
        // Deve ter exatamente 2 referências
        if (references.length !== 2) return false;
        
        // Cada referência deve ter todos os campos obrigatórios preenchidos
        const allReferencesValid = references.every(ref => 
          ref.nomeCompleto && ref.nomeCompleto.trim() !== '' &&
          ref.grauParentesco && ref.grauParentesco.trim() !== '' &&
          ref.telefone && ref.telefone.trim() !== ''
        );
        
        // Verificar se não há erros de validação de referências
        const hasReferenceErrors = Object.keys(state.errors).some(key => 
          key.includes('reference_')
        );
        
        return allReferencesValid && !hasReferenceErrors;

      case 2: // Condições do Empréstimo
        const loanData = state.loanData;
        
        // Verificar se todos os campos obrigatórios estão preenchidos
        const loanFieldsValid = 
          loanData.produtoId !== null &&
          loanData.tabelaComercialId !== null &&
          loanData.valorSolicitado && loanData.valorSolicitado.trim() !== '' &&
          loanData.prazo !== null;
        
        // Verificar se não há erros de validação de empréstimo
        const hasLoanErrors = Object.keys(state.errors).some(key => 
          key.includes('produto') || key.includes('tabela') || key.includes('valor') || key.includes('prazo')
        );
        
        return Boolean(loanFieldsValid && !hasLoanErrors);

      case 3: // Documentos
        // Step de documentos é opcional - sempre válido
        return true;

      default:
        return false;
    }
  }, [state.clientData, state.personalReferences, state.loanData, state.errors]);

  return { isStepValid };
}
