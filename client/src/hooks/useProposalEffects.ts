import { useEffect, useRef } from 'react';
import { useProposal, useProposalActions } from '@/contexts/ProposalContext';
import { useDebounce } from '@/hooks/use-debounce';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function useProposalEffects() {
  const { state } = useProposal();
  const { setSimulationResult, clearSimulation, setError, clearErrors } = useProposalActions();
  const { toast } = useToast();
  const lastSimulationRef = useRef<string>('');

  // Debounce loan values to avoid excessive API calls
  const debouncedValorSolicitado = useDebounce(state.loanData.valorSolicitado, 800);
  const debouncedPrazo = useDebounce(state.loanData.prazo, 800);

  // Auto-simulation effect
  useEffect(() => {
    const canSimulate = 
      state.loanData.produtoId &&
      state.loanData.tabelaComercialId &&
      debouncedValorSolicitado &&
      parseFloat(debouncedValorSolicitado.replace(/[^\d,]/g, '').replace(',', '.')) > 0 &&
      debouncedPrazo &&
      debouncedPrazo > 0;

    if (!canSimulate) {
      clearSimulation();
      return;
    }

    // Create simulation key to avoid duplicate requests
    const simulationKey = `${state.loanData.produtoId}-${state.loanData.tabelaComercialId}-${debouncedValorSolicitado}-${debouncedPrazo}-${state.loanData.incluirTac}-${state.loanData.dataCarencia || ''}`;
    
    if (simulationKey === lastSimulationRef.current) {
      return;
    }

    lastSimulationRef.current = simulationKey;

    // Find selected product and table
    const selectedProduct = state.context?.produtos.find(p => p.id === state.loanData.produtoId);
    const selectedTable = selectedProduct?.tabelasDisponiveis.find(t => t.id === state.loanData.tabelaComercialId);

    if (!selectedTable) {
      return;
    }

    // Perform simulation
    const performSimulation = async () => {
      try {
        clearErrors();
        
        // Calculate first payment date - if no grace period, use 30 days from now
        const dataVencimento = state.loanData.dataCarencia || 
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const params = new URLSearchParams({
          valor: debouncedValorSolicitado.replace(/[^\d,]/g, '').replace(',', '.'),
          prazo: debouncedPrazo.toString(),
          produto_id: state.loanData.produtoId.toString(),
          incluir_tac: state.loanData.incluirTac.toString(),
          dataVencimento: dataVencimento,
        });

        const response = await apiRequest(`/api/simulacao?${params.toString()}`);
        
        setSimulationResult({
          valorParcela: response.valorParcela,
          taxaJuros: response.taxaJuros,
          valorIOF: response.valorIOF,
          valorTAC: response.valorTAC,
          valorTotalFinanciado: response.valorTotalFinanciado,
          custoEfetivoTotal: response.custoEfetivoTotalAnual,
          jurosCarencia: response.jurosCarencia,
          diasCarencia: response.diasCarencia,
        });
      } catch (error) {
        console.error('Erro na simulação:', error);
        setError('simulation', 'Erro ao calcular simulação');
        
        if (error instanceof Error && error.message.includes('45 dias')) {
          toast({
            title: 'Prazo de carência excedido',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Erro na simulação',
            description: 'Não foi possível calcular a simulação. Tente novamente.',
            variant: 'destructive',
          });
        }
      }
    };

    performSimulation();
  }, [
    state.loanData.produtoId,
    state.loanData.tabelaComercialId,
    debouncedValorSolicitado,
    debouncedPrazo,
    state.loanData.incluirTac,
    state.loanData.dataCarencia,
    state.context,
    // Removed dispatch functions from dependencies as they are stable
  ]);

  // Validation effect for limits
  useEffect(() => {
    if (!state.context || !state.loanData.valorSolicitado) {
      return;
    }

    const valor = parseFloat(state.loanData.valorSolicitado.replace(/[^\d,]/g, '').replace(',', '.'));
    const { valorMinimo, valorMaximo } = state.context.limites;

    if (valor < valorMinimo) {
      setError('valorSolicitado', `Valor mínimo: R$ ${valorMinimo.toLocaleString('pt-BR')}`);
    } else if (valor > valorMaximo) {
      setError('valorSolicitado', `Valor máximo: R$ ${valorMaximo.toLocaleString('pt-BR')}`);
    } else {
      setError('valorSolicitado', '');
    }
  }, [state.loanData.valorSolicitado, state.context]);

  // Validation effect for term limits
  useEffect(() => {
    if (!state.context || !state.loanData.prazo) {
      return;
    }

    const { prazoMinimo, prazoMaximo } = state.context.limites;

    if (state.loanData.prazo < prazoMinimo) {
      setError('prazo', `Prazo mínimo: ${prazoMinimo} meses`);
    } else if (state.loanData.prazo > prazoMaximo) {
      setError('prazo', `Prazo máximo: ${prazoMaximo} meses`);
    } else {
      setError('prazo', '');
    }
  }, [state.loanData.prazo, state.context]);
}