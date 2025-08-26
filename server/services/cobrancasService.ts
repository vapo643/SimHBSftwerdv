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
    } catch (error: any) {
      console.error('[COBRANCAS_SERVICE] Error fetching proposals:', error);
      throw new Error('Erro ao buscar propostas de cobrança');
    }
  }

  /**
   * Get detailed billing info for a specific proposal
   */
  async getPropostaCobrancaDetalhes(propostaId: number): Promise<any> {
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
    } catch (error: any) {
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
  }): Promise<any> {
    try {
      const observation = await cobrancasRepository.createObservacao(data);

      if (!observation) {
        throw new Error('Erro ao criar observação');
      }

      // Log the action
      // Log action (to be implemented in repository if needed)
      console.log(`[COBRANCAS_SERVICE] Observation added for proposal ${data.proposta_id}`);

      return observation;
    } catch (error: any) {
      console.error('[COBRANCAS_SERVICE] Error adding observation:', error);
      throw error;
    }
  }

  /**
   * Update installment payment status
   */
  async updateParcelaStatus(parcelaId: number, status: string, updateData?: any): Promise<boolean> {
    try {
      const success = await cobrancasRepository.updateParcelaStatus(parcelaId, status, updateData);

      if (!success) {
        throw new Error('Erro ao atualizar status da parcela');
      }

      return success;
    } catch (error: any) {
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
    detalhes?: any;
    solicitado_por: string;
  }): Promise<any> {
    try {
      const request = await cobrancasRepository.createSolicitacaoModificacao(data);

      if (!request) {
        throw new Error('Erro ao criar solicitação de modificação');
      }

      // Log action (to be implemented in repository if needed)
      console.log(`[COBRANCAS_SERVICE] Modification requested for proposal ${data.proposta_id}`);

      return request;
    } catch (error: any) {
      console.error('[COBRANCAS_SERVICE] Error requesting modification:', error);
      throw error;
    }
  }

  /**
   * Get overdue statistics
   */
  async getOverdueStats(): Promise<{
    total: number;
    byDaysOverdue: any[];
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
    } catch (error: any) {
      console.error('[COBRANCAS_SERVICE] Error getting overdue stats:', error);
      throw error;
    }
  }

  /**
   * Calculate payment summary from installments
   */
  private calculatePaymentSummary(parcelas: any[]): any {
    if (!parcelas || parcelas.length === 0) {
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
    const parcelasPagas = parcelas.filter((p) => p.status_pagamento === 'pago');
    const parcelasPendentes = parcelas.filter((p) => p.status_pagamento === 'pendente');
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
    errors: any[];
  }> {
    try {
      let success = 0;
      let failed = 0;
      const errors: any[] = [];

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

          if (result) {
            success++;
          } else {
            failed++;
            errors.push({ parcelaId: update.parcelaId, error: 'Update failed' });
          }
        } catch (error: any) {
          failed++;
          errors.push({ parcelaId: update.parcelaId, error: error.message });
        }
      }

      return { success, failed, errors };
    } catch (error: any) {
      console.error('[COBRANCAS_SERVICE] Error in batch update:', error);
      throw error;
    }
  }
}

export const cobrancasService = new CobrancasService();
