import { useMemo, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type { ProposalState, ProposalAction, SimulationResult } from '@/contexts/ProposalContext';

interface UseProposalEffectsProps {
  state: ProposalState;
  dispatch: React.Dispatch<ProposalAction>;
}

interface SimulationParams {
  valor: number;
  prazo: number;
  produto_id: number;
  tabela_comercial_id: number;
  incluir_tac: boolean;
  dataVencimento: string;
}

export function useProposalEffects({ state, dispatch }: UseProposalEffectsProps) {
  // Derived state: Available tables for selected product
  const tabelasDisponiveis = useMemo(() => {
    if (!state.context || !state.loanData.produtoId) return [];
    
    const produto = state.context.produtos.find(
      p => p.id === state.loanData.produtoId
    );
    return produto?.tabelasDisponiveis || [];
  }, [state.context, state.loanData.produtoId]);

  // Derived state: Selected product details
  const selectedProduct = useMemo(() => {
    if (!state.context || !state.loanData.produtoId) return null;
    
    return state.context.produtos.find(
      p => p.id === state.loanData.produtoId
    );
  }, [state.context, state.loanData.produtoId]);

  // Derived state: Selected table details
  const selectedTabela = useMemo(() => {
    if (!tabelasDisponiveis.length || !state.loanData.tabelaComercialId) return null;
    
    return tabelasDisponiveis.find(
      t => t.id === state.loanData.tabelaComercialId
    );
  }, [tabelasDisponiveis, state.loanData.tabelaComercialId]);

  // Derived state: Available terms (prazos) for selected table
  const prazosDisponiveis = useMemo(() => {
    return selectedTabela?.prazos || [];
  }, [selectedTabela]);

  // Mutation for credit simulation
  const simulationMutation = useMutation({
    mutationFn: async (params: SimulationParams) => {
      const queryParams = new URLSearchParams({
        valor: params.valor.toString(),
        prazo: params.prazo.toString(),
        produto_id: params.produto_id.toString(),
        tabela_comercial_id: params.tabela_comercial_id.toString(),
        incluir_tac: params.incluir_tac.toString(),
        dataVencimento: params.dataVencimento,
      });
      const response = await api.get(`/api/simulacao?${queryParams}`);
      return response.data as SimulationResult;
    },
    onSuccess: (result) => {
      dispatch({ type: 'SET_SIMULATION', payload: result });
    },
    onError: () => {
      dispatch({ type: 'SET_SIMULATION', payload: null });
    },
  });

  // Effect: Auto-simulate when loan parameters change
  useEffect(() => {
    const canSimulate = 
      state.loanData.valor > 0 &&
      state.loanData.prazo > 0 &&
      state.loanData.produtoId !== null &&
      state.loanData.tabelaComercialId !== null &&
      state.loanData.dataVencimento !== '';

    if (canSimulate) {
      // Debounce simulation calls
      const timeoutId = setTimeout(() => {
        simulationMutation.mutate({
          valor: state.loanData.valor,
          prazo: state.loanData.prazo,
          produto_id: state.loanData.produtoId!,
          tabela_comercial_id: state.loanData.tabelaComercialId!,
          incluir_tac: state.loanData.incluirTac,
          dataVencimento: state.loanData.dataVencimento,
        });
      }, 500);

      return () => clearTimeout(timeoutId);
    } else {
      // Clear simulation if parameters are incomplete
      dispatch({ type: 'SET_SIMULATION', payload: null });
    }
  }, [
    state.loanData.valor,
    state.loanData.prazo,
    state.loanData.produtoId,
    state.loanData.tabelaComercialId,
    state.loanData.incluirTac,
    state.loanData.dataVencimento,
  ]);

  // Effect: Validate prazo when table changes
  useEffect(() => {
    if (selectedTabela && state.loanData.prazo > 0) {
      const validPrazo = selectedTabela.prazos.includes(state.loanData.prazo);
      if (!validPrazo) {
        // Reset prazo if it's not valid for the new table
        dispatch({ type: 'UPDATE_LOAN', payload: { prazo: 0 } });
      }
    }
  }, [selectedTabela, state.loanData.prazo]);

  // Validation functions
  const validateClientData = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!state.clientData.nome) errors.nome = 'Nome é obrigatório';
    if (!state.clientData.cpf) errors.cpf = 'CPF é obrigatório';
    if (!state.clientData.email) errors.email = 'Email é obrigatório';
    if (!state.clientData.telefone) errors.telefone = 'Telefone é obrigatório';
    if (!state.clientData.dataNascimento) errors.dataNascimento = 'Data de nascimento é obrigatória';
    if (!state.clientData.renda) errors.renda = 'Renda é obrigatória';
    if (!state.clientData.rg) errors.rg = 'RG é obrigatório';
    if (!state.clientData.cep) errors.cep = 'CEP é obrigatório';
    if (!state.clientData.endereco) errors.endereco = 'Endereço é obrigatório';
    
    Object.entries(errors).forEach(([field, message]) => {
      dispatch({ type: 'SET_ERROR', payload: { field, message } });
    });
    
    return Object.keys(errors).length === 0;
  };

  const validateLoanData = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!state.loanData.produtoId) errors.produtoId = 'Produto é obrigatório';
    if (!state.loanData.tabelaComercialId) errors.tabelaComercialId = 'Tabela comercial é obrigatória';
    if (state.loanData.valor < (state.context?.limites.valorMinimo || 0)) {
      errors.valor = `Valor mínimo é R$ ${state.context?.limites.valorMinimo}`;
    }
    if (state.loanData.valor > (state.context?.limites.valorMaximo || 0)) {
      errors.valor = `Valor máximo é R$ ${state.context?.limites.valorMaximo}`;
    }
    if (!state.loanData.prazo) errors.prazo = 'Prazo é obrigatório';
    if (!state.loanData.finalidade) errors.finalidade = 'Finalidade é obrigatória';
    if (!state.loanData.garantia) errors.garantia = 'Garantia é obrigatória';
    if (!state.loanData.dataVencimento) errors.dataVencimento = 'Data de vencimento é obrigatória';
    
    Object.entries(errors).forEach(([field, message]) => {
      dispatch({ type: 'SET_ERROR', payload: { field, message } });
    });
    
    return Object.keys(errors).length === 0;
  };

  const validateDocuments = (): boolean => {
    const requiredDocs = state.context?.documentosObrigatorios || [];
    return state.documents.length >= requiredDocs.length;
  };

  return {
    tabelasDisponiveis,
    selectedProduct,
    selectedTabela,
    prazosDisponiveis,
    isSimulating: simulationMutation.isPending,
    validateClientData,
    validateLoanData,
    validateDocuments,
  };
}