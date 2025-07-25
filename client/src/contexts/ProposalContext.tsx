import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { api } from '@/lib/apiClient';
import { useQuery } from '@tanstack/react-query';

// Types
interface ClientFormData {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  dataNascimento: string;
  renda: string;
  rg: string;
  orgaoEmissor: string;
  estadoCivil: string;
  nacionalidade: string;
  cep: string;
  endereco: string;
  ocupacao: string;
}

interface LoanFormData {
  produtoId: number | null;
  tabelaComercialId: number | null;
  valor: number;
  prazo: number;
  finalidade: string;
  garantia: string;
  incluirTac: boolean;
  dataVencimento: string;
}

interface SimulationResult {
  valorParcela: number;
  taxaJurosMensal: number;
  iof: number;
  valorTac: number;
  cet: number;
}

interface DocumentState {
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  storageUrl?: string;
  uploadId: string;
}

interface OriginationContext {
  atendente: {
    id: string;
    nome: string;
    loja: {
      id: number;
      nome: string;
      parceiro: {
        id: number;
        nome: string;
      };
    };
  };
  produtos: Array<{
    id: number;
    nome: string;
    tacValor: number;
    tacTipo: 'fixo' | 'percentual';
    tabelasDisponiveis: Array<{
      id: number;
      nome: string;
      taxaJuros: number;
      prazos: number[];
      comissao: number;
    }>;
  }>;
  documentosObrigatorios: string[];
  limites: {
    valorMinimo: number;
    valorMaximo: number;
    prazoMaximo: number;
  };
}

interface ProposalState {
  context: OriginationContext | null;
  clientData: ClientFormData;
  loanData: LoanFormData;
  simulation: SimulationResult | null;
  documents: DocumentState[];
  currentStep: 'client' | 'loan' | 'documents';
  errors: Record<string, string>;
  isLoading: boolean;
}

type ProposalAction =
  | { type: 'SET_CONTEXT'; payload: OriginationContext }
  | { type: 'UPDATE_CLIENT'; payload: Partial<ClientFormData> }
  | { type: 'UPDATE_LOAN'; payload: Partial<LoanFormData> }
  | { type: 'SELECT_PRODUCT'; payload: number }
  | { type: 'SELECT_TABELA'; payload: number }
  | { type: 'SET_SIMULATION'; payload: SimulationResult | null }
  | { type: 'ADD_DOCUMENT'; payload: DocumentState }
  | { type: 'REMOVE_DOCUMENT'; payload: string }
  | { type: 'UPDATE_DOCUMENT_STATUS'; payload: { uploadId: string; status: DocumentState['status']; storageUrl?: string } }
  | { type: 'SET_STEP'; payload: ProposalState['currentStep'] }
  | { type: 'SET_ERROR'; payload: { field: string; message: string } }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RESET' };

// Initial state
const initialClientData: ClientFormData = {
  nome: '',
  cpf: '',
  email: '',
  telefone: '',
  dataNascimento: '',
  renda: '',
  rg: '',
  orgaoEmissor: '',
  estadoCivil: '',
  nacionalidade: 'Brasileira',
  cep: '',
  endereco: '',
  ocupacao: '',
};

const initialLoanData: LoanFormData = {
  produtoId: null,
  tabelaComercialId: null,
  valor: 0,
  prazo: 0,
  finalidade: '',
  garantia: '',
  incluirTac: false,
  dataVencimento: '',
};

const initialState: ProposalState = {
  context: null,
  clientData: initialClientData,
  loanData: initialLoanData,
  simulation: null,
  documents: [],
  currentStep: 'client',
  errors: {},
  isLoading: false,
};

// Reducer
function proposalReducer(state: ProposalState, action: ProposalAction): ProposalState {
  switch (action.type) {
    case 'SET_CONTEXT':
      return { ...state, context: action.payload };

    case 'UPDATE_CLIENT':
      return {
        ...state,
        clientData: { ...state.clientData, ...action.payload },
        errors: {},
      };

    case 'UPDATE_LOAN':
      return {
        ...state,
        loanData: { ...state.loanData, ...action.payload },
        errors: {},
      };

    case 'SELECT_PRODUCT':
      return {
        ...state,
        loanData: {
          ...state.loanData,
          produtoId: action.payload,
          tabelaComercialId: null, // Reset table when product changes
        },
        simulation: null, // Clear simulation
      };

    case 'SELECT_TABELA':
      return {
        ...state,
        loanData: {
          ...state.loanData,
          tabelaComercialId: action.payload,
        },
      };

    case 'SET_SIMULATION':
      return { ...state, simulation: action.payload };

    case 'ADD_DOCUMENT':
      return {
        ...state,
        documents: [...state.documents, action.payload],
      };

    case 'REMOVE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.filter(d => d.uploadId !== action.payload),
      };

    case 'UPDATE_DOCUMENT_STATUS':
      return {
        ...state,
        documents: state.documents.map(d =>
          d.uploadId === action.payload.uploadId
            ? { ...d, status: action.payload.status, storageUrl: action.payload.storageUrl }
            : d
        ),
      };

    case 'SET_STEP':
      return { ...state, currentStep: action.payload };

    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.payload.field]: action.payload.message },
      };

    case 'CLEAR_ERRORS':
      return { ...state, errors: {} };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// Context
interface ProposalContextValue {
  state: ProposalState;
  dispatch: React.Dispatch<ProposalAction>;
}

const ProposalContext = createContext<ProposalContextValue | null>(null);

// Provider
interface ProposalProviderProps {
  children: ReactNode;
}

export function ProposalProvider({ children }: ProposalProviderProps) {
  const [state, dispatch] = useReducer(proposalReducer, initialState);

  // Fetch origination context on mount
  const { data: context } = useQuery({
    queryKey: ['origination-context'],
    queryFn: async () => {
      const response = await api.get('/api/origination/context');
      return response.data as OriginationContext;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Set context when data is loaded
  React.useEffect(() => {
    if (context) {
      dispatch({ type: 'SET_CONTEXT', payload: context });
    }
  }, [context]);

  return (
    <ProposalContext.Provider value={{ state, dispatch }}>
      {children}
    </ProposalContext.Provider>
  );
}

// Hook
export function useProposal() {
  const context = useContext(ProposalContext);
  if (!context) {
    throw new Error('useProposal must be used within ProposalProvider');
  }
  return context;
}

// Export types
export type {
  ClientFormData,
  LoanFormData,
  SimulationResult,
  DocumentState,
  OriginationContext,
  ProposalState,
  ProposalAction,
};