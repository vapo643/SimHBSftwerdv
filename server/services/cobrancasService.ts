/**
 * Cobrancas Service
 * Business logic for billing and collection operations
 * PAM V1.0 - Service layer implementation
 */

import { cobrancasRepository } from '../repositories/cobrancas.repository.js';
import { maskCPF, maskEmail, maskRG, maskTelefone } from '../utils/masking.js';
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';

export class CobrancasService {
  /**
   * Get all proposals with billing information
   */
  async getPropostasCobranca(filters: {
    status?: string;
    atraso?: string;
    userRole?: string;
  }): Promise<any[]> {
    try {
      console.log('🔍 [COBRANCAS_SERVICE] Fetching proposals with filters:', filters);

      // Get proposals from repository
      const propostas = await cobrancasRepository.getPropostasCobranca(filters);

      // Process each proposal
      const processedPropostas = await Promise.all(
        propostas.map(async (proposta) => {
          const { propostas: prop } = proposta;

          // Get installments
          const parcelas = await cobrancasRepository.getParcelasProposta(prop.id);

          // Get Inter collections
          const collections = await cobrancasRepository.getInterCollections(prop.id);

          // Calculate payment summary
          const paymentSummary = this.calculatePaymentSummary(parcelas);

          // Apply PII masking
          const maskedData = {
            ...prop,
            clienteCpf: prop.clienteCpf ? maskCPF(prop.clienteCpf) : null,
            clienteEmail: prop.clienteEmail ? maskEmail(prop.clienteEmail) : null,
            clienteTelefone: prop.clienteTelefone ? maskTelefone(prop.clienteTelefone) : null,
            clienteRg: prop.clienteRg ? maskRG(prop.clienteRg) : null,
          };

          return {
            ...maskedData,
  parcelas,
            interCollections: collections,
  paymentSummary,
            statusContextual: proposta.statusContextuais?.status || prop.status,
          };
        })
      );

      return processedPropostas;
    }
catch (error) {
      console.error('[COBRANCAS_SERVICE] Error fetching proposals:', error);
      throw new Error('Erro ao buscar propostas de cobrança');
    }
  }

  /**
   * Get detailed billing info for a specific proposal
   */
  async getPropostaCobrancaDetalhes(propostaId: number): Promise<unknown> {
    try {
      // Get proposal details
      const [propostaData] = await cobrancasRepository.getPropostasCobranca({});
      const proposta = propostaData?.propostas;

      if (!proposta) {
        throw new Error('Proposta não encontrada');
      }

      // Get all related data
      const [parcelas, collections, observacoes, solicitacoes, logs] = await Promise.all([
        cobrancasRepository.getParcelasProposta(propostaId),
        cobrancasRepository.getInterCollections(propostaId),
        cobrancasRepository.getObservacoesCobranca(propostaId),
        cobrancasRepository.getSolicitacoesModificacao(propostaId),
        cobrancasRepository.getPropostaLogs(propostaId),
      ]);

      // Calculate payment summary
      const paymentSummary = this.calculatePaymentSummary(parcelas);

      // Apply masking
      const maskedProposta = {
        ...proposta,
        clienteCpf: proposta.clienteCpf ? maskCPF(proposta.clienteCpf) : null,
        clienteEmail: proposta.clienteEmail ? maskEmail(proposta.clienteEmail) : null,
        clienteTelefone: proposta.clienteTelefone ? maskTelefone(proposta.clienteTelefone) : null,
        clienteRg: proposta.clienteRg ? maskRG(proposta.clienteRg) : null,
      };

      return {
        proposta: maskedProposta,
  parcelas,
        interCollections: collections,
  observacoes,
  solicitacoes,
  logs,
  paymentSummary,
      };
    }
catch (error) {
      console.error('[COBRANCAS_SERVICE] Error fetching proposal details:', error);
      throw error;
    }
  }

  /**
   * Add observation to a proposal
   */
  async addObservacao(data: {
    proposta_id: number;
    observacao: string;
    tipo: string;
    created_by: string;
  }): Promise<unknown> {
    try {
      const observation = await cobrancasRepository.createObservacao(_data);

      if (!observation) {
        throw new Error('Erro ao criar observação');
      }

      // Log the action
      // Log action (to be implemented in repository if needed)
      console.log(`[COBRANCAS_SERVICE] Observation added for proposal ${data.proposta_id}`);

      return observation;
    }
catch (error) {
      console.error('[COBRANCAS_SERVICE] Error adding observation:', error);
      throw error;
    }
  }

  /**
   * Update installment payment status
   */
  async updateParcelaStatus(
    parcelaId: number,
    status: string,
    updateData?: unknown
  ): Promise<boolean> {
    try {
      const success = await cobrancasRepository.updateParcelaStatus(parcelaId, status, updateData);

      if (!success) {
        throw new Error('Erro ao atualizar status da parcela');
      }

      return success;
    }
catch (error) {
      console.error('[COBRANCAS_SERVICE] Error updating installment:', error);
      throw error;
    }
  }

  /**
   * Request modification for a proposal
   */
  async requestModification(data: {
    proposta_id: number;
    tipo: string;
    motivo: string;
    detalhes?: unknown;
    solicitado_por: string;
  }): Promise<unknown> {
    try {
      const request = await cobrancasRepository.createSolicitacaoModificacao(_data);

      if (!request) {
        throw new Error('Erro ao criar solicitação de modificação');
      }

      // Log action (to be implemented in repository if needed)
      console.log(`[COBRANCAS_SERVICE] Modification requested for proposal ${data.proposta_id}`);

      return request;
    }
catch (error) {
      console.error('[COBRANCAS_SERVICE] Error requesting modification:', error);
      throw error;
    }
  }

  /**
   * Get overdue statistics
   */
  async getOverdueStats(): Promise<{
    total: number;
    byDaysOverdue: unknown[];
  }> {
    try {
      const total = await cobrancasRepository.getOverdueCount();

      // TODO: Implement detailed overdue breakdown by days
      const byDaysOverdue = [
        { range: '1-30 dias', count: 0 },
        { range: '31-60 dias', count: 0 },
        { range: '61-90 dias', count: 0 },
        { range: '90+ dias', count: 0 },
      ];

      return {
  total,
  byDaysOverdue,
      };
    }
catch (error) {
      console.error('[COBRANCAS_SERVICE] Error getting overdue stats:', error);
      throw error;
    }
  }

  /**
   * Calculate payment summary from installments
   */
  private calculatePaymentSummary(parcelas: unknown[]): unknown {
    if (!parcelas || parcelas.length == 0) {
      return {
        totalParcelas: 0,
        parcelasPagas: 0,
        parcelasPendentes: 0,
        valorTotal: 0,
        valorPago: 0,
        valorPendente: 0,
        proximoVencimento: null,
        diasAtraso: 0,
      };
    }

    const today = new Date();
    const parcelasPagas = parcelas.filter((p) => p.status_pagamento == 'pago');
    const parcelasPendentes = parcelas.filter((p) => p.status_pagamento == 'pendente');
    const parcelasVencidas = parcelasPendentes.filter(
      (p) => p.data_vencimento && isAfter(today, parseISO(p.data_vencimento))
    );

    const valorTotal = parcelas.reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0);
    const valorPago = parcelasPagas.reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0);
    const valorPendente = valorTotal - valorPago;

    const proximaParcela = parcelasPendentes
      .filter((p) => p.data_vencimento && isAfter(parseISO(p.data_vencimento), today))
      .sort(
        (a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()
      )[0];

    const parcelaMaisVencida = parcelasVencidas.sort(
      (a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()
    )[0];

    const diasAtraso = parcelaMaisVencida?.data_vencimento
      ? differenceInDays(today, parseISO(parcelaMaisVencida.data_vencimento))
      : 0;

    return {
      totalParcelas: parcelas.length,
      parcelasPagas: parcelasPagas.length,
      parcelasPendentes: parcelasPendentes.length,
      parcelasVencidas: parcelasVencidas.length,
  valorTotal,
  valorPago,
  valorPendente,
      proximoVencimento: proximaParcela?.data_vencimento || null,
  diasAtraso,
    };
  }

  /**
   * Process batch payment update
   */
  async processBatchPaymentUpdate(
    updates: Array<{
      parcelaId: number;
      status: string;
      dataPagamento?: string;
      valorPago?: number;
    }>
  ): Promise<{
    success: number;
    failed: number;
    errors: unknown[];
  }> {
    try {
      let _success = 0;
      let _failed = 0;
      const errors: unknown[] = [];

      for (const update of updates) {
        try {
          const result = await cobrancasRepository.updateParcelaStatus(
            update.parcelaId,
            update.status,
            {
              data_pagamento: update.dataPagamento,
              valor_pago: update.valorPago,
            }
          );

          if (_result) {
            success++;
          }
else {
            failed++;
            errors.push({ parcelaId: update.parcelaId, error: 'Update failed' });
          }
        }
catch (error) {
          failed++;
          errors.push({ parcelaId: update.parcelaId, error: error.message });
        }
      }

      return { success, failed, errors }
    }
catch (error) {
      console.error('[COBRANCAS_SERVICE] Error in batch update:', error);
      throw error;
    }
  }
  /**
   * Get KPIs for billing dashboard
   */
  async getKPIs(): Promise<unknown> {
    try {
      console.log('[COBRANCAS_SERVICE] Calculating KPIs...');

      // Get basic proposal counts
      const propostas = await cobrancasRepository.getPropostasCobranca({});

      // Calculate basic metrics
      let _valorTotalEmAtraso = 0;
      let _quantidadeContratosEmAtraso = 0;
      let _valorTotalCarteira = 0;
      let _quantidadeTotalContratos = propostas.length;

      const hoje = new Date();

      // Process each proposal to calculate detailed metrics
      for (const proposta of propostas) {
        const { propostas: prop } = proposta;
        valorTotalCarteira += Number(prop.valorTotalFinanciado) || 0;

        // Get installments to check for overdue payments
        const parcelas = await cobrancasRepository.getParcelasProposta(prop.id);

        let _temParcelaVencida = false;
        for (const parcela of parcelas) {
          const dataVencimento = parseISO(parcela.dataVencimento);
          const vencida = isAfter(hoje, dataVencimento) && parcela.status !== 'pago';

          if (vencida) {
            valorTotalEmAtraso += Number(parcela.valorParcela);
            temParcelaVencida = true;
          }
        }

        if (temParcelaVencida) {
          quantidadeContratosEmAtraso++;
        }
      }

      // Calculate rates
      const taxaInadimplencia =
        quantidadeTotalContratos > 0
          ? (quantidadeContratosEmAtraso / quantidadeTotalContratos) * 100
          : 0;

      const percentualValorEmAtraso =
        valorTotalCarteira > 0 ? (valorTotalEmAtraso / valorTotalCarteira) * 100 : 0;

      const kpis = {
  valorTotalEmAtraso,
  quantidadeContratosEmAtraso,
  valorTotalCarteira,
  quantidadeTotalContratos,
        taxaInadimplencia: Number(taxaInadimplencia.toFixed(2)),
        percentualValorEmAtraso: Number(percentualValorEmAtraso.toFixed(2)),
        dataAtualizacao: format(hoje, 'yyyy-MM-dd HH:mm:ss'),
      };

      console.log('[COBRANCAS_SERVICE] KPIs calculated:', kpis);
      return kpis;
    }
catch (error) {
      console.error('[COBRANCAS_SERVICE] Error calculating KPIs:', error);
      throw new Error('Erro ao calcular KPIs de cobrança');
    }
  }
}

export const cobrancasService = new CobrancasService();
