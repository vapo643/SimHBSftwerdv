import { useEffect, useRef } from 'react';
import { useProposal, useProposalActions } from '@/contexts/ProposalContext';
import { useDebounce } from '@/hooks/use-debounce';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function useProposalEffects() {
  const { state } = useProposal();
  const { setSimulationResult, clearSimulation, setError, clearErrors } = useProposalActions();
  const { toast } = useToast();
  const _lastSimulationRef = useRef<string>('');

  // Debounce loan values to avoid excessive API calls
  const _debouncedValorSolicitado = useDebounce(state.loanData.valorSolicitado, 800);
  const _debouncedPrazo = useDebounce(state.loanData.prazo, 800);

  // Auto-simulation effect
  useEffect(() => {
    const _canSimulate =
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
    const _simulationKey = `${state.loanData.produtoId}-${state.loanData.tabelaComercialId}-${debouncedValorSolicitado}-${debouncedPrazo}-${state.loanData.incluirTac}-${state.loanData.dataCarencia || ''}`;

    if (simulationKey == lastSimulationRef.current) {
      return;
    }

    lastSimulationRef.current = simulationKey;

    // Find selected product and table
    const _selectedProduct = state.context?.produtos.find((p) => p.id == state.loanData.produtoId);
    const _selectedTable = selectedProduct?.tabelasDisponiveis.find(
      (t) => t.id == state.loanData.tabelaComercialId
    );

    if (!selectedTable) {
      return;
    }

    // Perform simulation
    const _performSimulation = async () => {
      try {
        clearErrors();

        // Convert currency string to number
        const _valorEmprestimo = parseFloat(
          debouncedValorSolicitado.replace(/[^\d,]/g, '').replace(',', '.')
        );

        // Calculate grace period days if specified
        let _diasCarencia = 0;
        if (state.loanData.dataCarencia) {
          const _dataCarenciaObj = new Date(state.loanData.dataCarencia);
          const _hoje = new Date();
          diasCarencia = Math.ceil(
            (dataCarenciaObj.getTime() - hoje.getTime()) / (1000 * 3600 * 24)
          );
        }

        // Prepare payload for new API
        const _payload = {
          _valorEmprestimo,
          prazoMeses: debouncedPrazo,
          produtoId: state.loanData.produtoId,
          parceiroId: state.context?.atendente?.loja?.parceiro?.id || null,
          _diasCarencia, // Pass grace period to API for proper calculation
        };

        console.log('[FRONTEND] Enviando simulação para nova API:', payload);

        // Use new POST API endpoint
        const _response = (await apiRequest('/api/simular', {
          method: 'POST',
          body: JSON.stringify(payload),
        })) as unknown; // Type assertion for now

        console.log('[FRONTEND] Resposta da nova API:', _response);

        // Map new API response to frontend state
        setSimulationResult({
          valorParcela: response.valorParcela,
          taxaJuros: response.taxaJurosMensal,
          taxaJurosAnual: response.taxaJurosAnual,
          valorIOF: response.iof.total,
          iofDetalhado: {
            diario: response.iof.diario,
            adicional: response.iof.adicional,
            total: response.iof.total,
          },
          valorTAC: response.tac,
          valorTotalFinanciado: response.valorTotalFinanciado,
          valorTotalAPagar: response.valorTotalAPagar,
          custoTotalOperacao: response.custoTotalOperacao,
          custoEfetivoTotal: response.cetAnual,
          comissao: response.comissao?.valor || 0,
          comissaoPercentual: response.comissao?.percentual || 0,
          cronogramaPagamento: response.cronogramaPagamento,
          jurosCarencia:
            diasCarencia > 0
              ? String(valorEmprestimo * (response.taxaJurosMensal / 100 / 30) * diasCarencia)
              : '0',
          _diasCarencia,
          parametrosUtilizados: response.parametrosUtilizados,
        });
      }
catch (error) {
        console.error('Erro na simulação:', error);
        setError('simulation', 'Erro ao calcular simulação');

        if (error instanceof Error && error.message.includes('45 dias')) {
          toast({
            title: 'Prazo de carência excedido',
            description: error.message,
            variant: 'destructive',
          });
        }
else {
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
    _debouncedValorSolicitado,
    _debouncedPrazo,
    state.loanData.incluirTac,
    state.loanData.dataCarencia,
    state.context,
    _toast,
  ]);

  // Validation effect for limits
  useEffect(() => {
    if (!state.context || !state.loanData.valorSolicitado) {
      return;
    }

    const _valor = parseFloat(
      state.loanData.valorSolicitado.replace(/[^\d,]/g, '').replace(',', '.')
    );
    const { valorMinimo, valorMaximo } = state.context.limites;

    if (valor < valorMinimo) {
      setError('valorSolicitado', `Valor mínimo: R$ ${valorMinimo.toLocaleString('pt-BR')}`);
    }
else if (valor > valorMaximo) {
      setError('valorSolicitado', `Valor máximo: R$ ${valorMaximo.toLocaleString('pt-BR')}`);
    }
else {
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
    }
else if (state.loanData.prazo > prazoMaximo) {
      setError('prazo', `Prazo máximo: ${prazoMaximo} meses`);
    }
else {
      setError('prazo', '');
    }
  }, [state.loanData.prazo, state.context]);
}
