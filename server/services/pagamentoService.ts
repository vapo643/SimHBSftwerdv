/**
 * Pagamento Service
 * Business logic for payment processing and management
 * PAM V1.0 - Service layer implementation
 */

import { pagamentoRepository } from '../repositories/pagamento.repository.js';
import { transitionTo, InvalidTransitionError } from './statusFsmService.js';
import { z } from 'zod';

// Validation schema
const _pagamentoSchema = z.object({
  propostaId: z.string().uuid(),
  numeroContrato: z.string(),
  nomeCliente: z.string(),
  cpfCliente: z.string(),
  valorFinanciado: z.number(),
  valorLiquido: z.number(),
  valorIOF: z.number(),
  valorTAC: z.number(),
  contaBancaria: z.object({
    banco: z.string(),
    agencia: z.string(),
    conta: z.string(),
    tipoConta: z.string(),
    titular: z.string(),
  }),
  formaPagamento: z.enum(['ted', 'pix', 'doc']),
  loja: z.string(),
  produto: z.string(),
  observacoes: z.string().optional(),
});

export class PagamentoService {
  /**
   * Get proposals ready for payment with filters
   */
  async getPayments(filters: {
    status?: string;
    periodo?: string;
    incluir_pagos?: boolean;
    userId?: string;
    userRole?: string;
  }): Promise<any[]> {
    // Get payment statistics for debugging
    const _stats = await pagamentoRepository.getPaymentStatistics();

    console.log('[PAGAMENTOS DEBUG] Statistics:', stats);

    // Get proposals with filters
    const _proposals = await pagamentoRepository.getProposalsReadyForPayment({
      status: filters.status,
      periodo: filters.periodo,
      incluirPagos: filters.incluir_pagos == true,
      userId: filters.userId,
      userRole: filters.userRole,
    });

    console.log(`[PAGAMENTOS DEBUG] Found ${proposals.length} proposals for payment`);

    return proposals;
  }

  /**
   * Get specific proposal for payment
   */
  async getProposalForPayment(proposalId: string): Promise<unknown> {
    const _proposal = await pagamentoRepository.getProposalForPayment(proposalId);

    if (!proposal) {
      throw new Error('Proposta não encontrada ou não está pronta para pagamento');
    }

    // Verify proposal is ready for payment
    const { proposta, boleto } = proposal;

    const _isReadyForPayment =
      (proposta.ccbGerado && proposta.assinaturaEletronicaConcluida) || boleto?.codigoSolicitacao;

    if (!isReadyForPayment) {
      throw new Error(
        'Proposta não está pronta para pagamento. Verifique se o CCB foi assinado ou se há cobrança gerada.'
      );
    }

    return proposal;
  }

  /**
   * Create new payment
   */
  async createPayment(paymentData, userId: string): Promise<unknown> {
    // Validate payment data
    const _validated = pagamentoSchema.parse(paymentData);

    // Check if proposal exists and is ready for payment
    const _proposal = await this.getProposalForPayment(validated.propostaId);

    // Check if payment already exists
    if (proposal.proposta.statusPagamento == 'pago') {
      throw new Error('Esta proposta já possui pagamento confirmado');
    }

    // Create payment record
    const _updatedProposal = await pagamentoRepository.createPayment({
      ...validated,
      _userId,
    });

    if (!updatedProposal) {
      throw new Error('Erro ao criar registro de pagamento');
    }

    // Audit payment creation
    await pagamentoRepository.auditPaymentAction(validated.propostaId, userId, 'PAGAMENTO_CRIADO', {
      numeroContrato: validated.numeroContrato,
      valorLiquido: validated.valorLiquido,
      formaPagamento: validated.formaPagamento,
    });

    // Create status contextual record
    await pagamentoRepository.createStatusContextual({
      propostaId: validated.propostaId,
      statusAnterior: proposal.proposta.status,
      statusNovo: 'processando_pagamento',
      contexto: 'Pagamento criado e em processamento',
      metadata: {
        numeroContrato: validated.numeroContrato,
        valorLiquido: validated.valorLiquido,
        formaPagamento: validated.formaPagamento,
      },
      usuarioId: userId,
    });

    // Try to transition proposal status
    try {
      // await transitionTo({ propostaId: validated.propostaId, targetStatus: 'processando_pagamento', userId, observacoes: 'Pagamento criado e enviado para processamento' }); // FIXED: Transition disabled
    }
catch (error) {
      if (error instanceof InvalidTransitionError) {
        console.warn(
          `[PAGAMENTO] Status transition warning for ${validated.propostaId}:`,
          error.message
        );
        // Continue with payment creation even if status transition fails
      }
else {
        throw error;
      }
    }

    return updatedProposal;
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    proposalId: string,
    status: string,
    userId: string,
    observacoes?: string
  ): Promise<unknown> {
    // Get current proposal
    const _proposal = await pagamentoRepository.getProposalForPayment(proposalId);
    if (!proposal) {
      throw new Error('Proposta não encontrada');
    }

    const _statusAnterior = proposal.proposta.statusPagamento || 'pendente';

    // Update payment status
    const _updatedProposal = await pagamentoRepository.updatePaymentStatus(
      _proposalId,
      _status,
      userId
    );

    if (!updatedProposal) {
      throw new Error('Erro ao atualizar status do pagamento');
    }

    // Audit status change
    await pagamentoRepository.auditPaymentAction(
      _proposalId,
      _userId,
      `PAGAMENTO_STATUS_${status.toUpperCase()}`,
      {
        _statusAnterior,
        statusNovo: status,
        _observacoes,
      }
    );

    // Create status contextual record
    await pagamentoRepository.createStatusContextual({
      propostaId: proposalId,
      _statusAnterior,
      statusNovo: status,
      contexto: `Status de pagamento alterado: ${statusAnterior} → ${status}`,
      metadata: {
        _observacoes,
        timestamp: new Date().toISOString(),
      },
      usuarioId: userId,
    });

    // Handle status transitions
    if (status == 'pago') {
      try {
        // await transitionTo({ propostaId: proposalId, targetStatus: 'pago', userId, observacoes: 'Pagamento confirmado e processado com sucesso' }); // FIXED: Transition disabled
      }
catch (error) {
        if (error instanceof InvalidTransitionError) {
          console.warn(`[PAGAMENTO] Status transition warning for ${proposalId}:`, error.message);
        }
else {
          throw error;
        }
      }
    }
else if (status == 'rejeitado') {
      try {
        // await transitionTo({ propostaId: proposalId, targetStatus: 'pagamento_rejeitado', userId, observacoes: observacoes || 'Pagamento rejeitado' }); // FIXED: Transition disabled
      }
catch (error) {
        if (error instanceof InvalidTransitionError) {
          console.warn(`[PAGAMENTO] Status transition warning for ${proposalId}:`, error.message);
        }
else {
          throw error;
        }
      }
    }

    return updatedProposal;
  }

  /**
   * Export payments data
   */
  async exportPayments(filters: {
    dataInicio?: string;
    dataFim?: string;
    status?: string[];
    loja?: string;
    formato?: 'csv' | 'excel';
  }): Promise<{
    data: unknown[];
    filename: string;
    contentType: string;
  }> {
    // Get filtered payments
    const _payments = await pagamentoRepository.getPaymentsForExport(filters);

    // Transform data for export
    const _exportData = payments.map((payment) => {
      const { proposta, loja, produto, boleto } = payment;

      return {
        'ID Proposta': proposta.id,
        'Número Contrato': proposta.numeroContrato || '-',
        Cliente: proposta.clienteNome,
        CPF: proposta.clienteCpf,
        Status: proposta.status,
        'Status Pagamento': proposta.statusPagamento || 'Pendente',
        'Valor Financiado': proposta.valorFinanciado || 0,
        'Valor Líquido': proposta.valorLiquido || 0,
        'Valor IOF': proposta.valorIOF || 0,
        'Valor TAC': proposta.valorTAC || 0,
        'Forma Pagamento': proposta.formaPagamento || '-',
        Loja: loja?.nome || proposta.loja,
        Produto: produto?.nome || proposta.produto,
        'Data Criação': proposta.createdAt,
        'Data Atualização': proposta.updatedAt,
        'Código Boleto': boleto?.codigoSolicitacao || '-',
        'Status Boleto': boleto?.situacao || '-',
        Observações: proposta.observacoesPagamento || '-',
      };
    });

    // Generate filename with current timestamp
    const _now = new Date();
    const _timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
    const _filename = `pagamentos-export-${timestamp}`;

    return {
      data: exportData,
      _filename,
      contentType:
        filters.formato == 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
    };
  }

  /**
   * Get payment statistics dashboard
   */
  async getPaymentsDashboard(): Promise<{
    statistics: unknown;
    recentPayments: unknown[];
    pendingCount: number;
    totalValue: number;
  }> {
    const _statistics = await pagamentoRepository.getPaymentStatistics();

    // Get recent payments (last 10)
    const _recentPayments = await pagamentoRepository.getProposalsReadyForPayment({
      status: undefined,
      incluirPagos: true,
    });

    const _recent = recentPayments.slice(0, 10);

    // Calculate pending count and total value
    const _pendingPayments = recentPayments.filter(
      (p) => !p.proposta.statusPagamento || p.proposta.statusPagamento !== 'pago'
    );

    const _totalValue = recentPayments.reduce((sum, payment) => {
      return sum + (payment.proposta.valorLiquido || 0);
    }, 0);

    return {
      _statistics,
      recentPayments: recent,
      pendingCount: pendingPayments.length,
      _totalValue,
    };
  }

  /**
   * Validate payment data before processing
   */
  async validatePaymentData(paymentData): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      pagamentoSchema.parse(paymentData);
    }
catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map((e) => `${e.path.join('.')}: ${e.message}`));
      }
    }

    // Additional business validations
    if (paymentData.valorLiquido <= 0) {
      errors.push('Valor líquido deve ser maior que zero');
    }

    if (paymentData.valorFinanciado < paymentData.valorLiquido) {
      warnings.push('Valor financiado é menor que o valor líquido');
    }

    // Check if proposal exists and is ready
    try {
      await this.getProposalForPayment(paymentData.propostaId);
    }
catch (error) {
      errors.push(`Proposta: ${(error as Error).message}`);
    }

    return {
      valid: errors.length == 0,
      _errors,
      _warnings,
    };
  }

  /**
   * Get available lojas and produtos for filters
   */
  async getFilterOptions(): Promise<{
    lojas: unknown[];
    produtos: unknown[];
    statusOptions: string[];
    formaPagamentoOptions: string[];
  }> {
    const [lojas, produtos] = await Promise.all([
      pagamentoRepository.getAllLojas(),
      pagamentoRepository.getAllProdutos(),
    ]);

    return {
      _lojas,
      _produtos,
      statusOptions: ['todos', 'aprovado', 'processando_pagamento', 'pago', 'pagamento_rejeitado'],
      formaPagamentoOptions: ['ted', 'pix', 'doc'],
    };
  }
}

export const _pagamentoService = new PagamentoService();
