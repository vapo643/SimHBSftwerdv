/**
 * Pagamento Service
 * Business logic for payment processing and management
 * PAM V1.0 - Service layer implementation
 */

import { pagamentoRepository } from '../repositories/pagamento.repository.js';
import { transitionTo, InvalidTransitionError } from './statusFsmService.js';
import { z } from 'zod';
// PAM V3.5 - Import paymentsQueue for idempotent processing
import { getPaymentsQueue } from '../lib/queues.js';
// SECURITY V2.0 - Import secure logger
import { SecureLogger } from '../modules/shared/infrastructure/SanitizedLogger';

// Validation schema
const pagamentoSchema = z.object({
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
    const stats = await pagamentoRepository.getPaymentStatistics();

    SecureLogger.debug('Payment statistics retrieved', stats);

    // Get proposals with filters
    const proposals = await pagamentoRepository.getProposalsReadyForPayment({
      status: filters.status,
      periodo: filters.periodo,
      incluirPagos: filters.incluir_pagos === true,
      userId: filters.userId,
      userRole: filters.userRole,
    });

    console.log(`[PAGAMENTOS DEBUG] Found ${proposals.length} proposals for payment`);

    return proposals;
  }

  /**
   * Get specific proposal for payment
   */
  async getProposalForPayment(proposalId: string): Promise<any> {
    const proposal = await pagamentoRepository.getProposalForPayment(proposalId);

    if (!proposal) {
      throw new Error('Proposta não encontrada ou não está pronta para pagamento');
    }

    // Verify proposal is ready for payment
    const { proposta, boleto } = proposal;

    const isReadyForPayment =
      (proposta.ccbGerado && proposta.assinaturaEletronicaConcluida) || boleto?.codigoSolicitacao;

    if (!isReadyForPayment) {
      throw new Error(
        'Proposta não está pronta para pagamento. Verifique se o CCB foi assinado ou se há cobrança gerada.'
      );
    }

    return proposal;
  }

  /**
   * Create new payment - CONF-001 IDEMPOTENT PROCESSING FIX
   */
  async createPayment(paymentData: any, userId: string): Promise<any> {
    // Validate payment data
    const validated = pagamentoSchema.parse(paymentData);

    // Check if proposal exists and is ready for payment
    const proposal = await this.getProposalForPayment(validated.propostaId);

    // Check if payment already exists
    if (proposal.proposta.statusPagamento === 'pago') {
      throw new Error('Esta proposta já possui pagamento confirmado');
    }

    // CONF-001 CRITICAL FIX: Check database for existing payment before creating job
    // This prevents duplicate jobs at the application level
    const existingCollection = await pagamentoRepository.checkExistingPayment(validated.propostaId);

    if (existingCollection) {
      console.log(
        `[PAYMENT IDEMPOTENCY] 🛡️ Payment already exists for proposal ${validated.propostaId}:`,
        {
          codigoSolicitacao: existingCollection.codigoSolicitacao,
          seuNumero: existingCollection.seuNumero,
          situacao: existingCollection.situacao,
          createdAt: existingCollection.createdAt,
        }
      );

      return {
        message: 'Pagamento já foi processado anteriormente (idempotência database-level)',
        propostaId: validated.propostaId,
        existingPayment: {
          codigoSolicitacao: existingCollection.codigoSolicitacao,
          seuNumero: existingCollection.seuNumero,
          situacao: existingCollection.situacao,
          valorNominal: existingCollection.valorNominal,
        },
        status: 'ja_processado',
        duplicate: true,
        timestamp: new Date().toISOString(),
      };
    }

    // CONF-001 FIX: Generate DETERMINISTIC jobId without timestamp
    // This ensures the same proposal always gets the same jobId
    const jobId = `payment-${validated.propostaId}`;

    console.log(
      `[PAYMENT IDEMPOTENCY] 🔑 Generated deterministic jobId: ${jobId} for proposal ${validated.propostaId}`
    );

    try {
      // CONF-001 - Add job to paymentsQueue with deterministic jobId
      const paymentsQueue = await getPaymentsQueue();
      const job = await paymentsQueue.add(
        'PROCESS_PAYMENT',
        {
          type: 'PROCESS_PAYMENT',
          propostaId: validated.propostaId,
          paymentData: validated,
          userId,
          timestamp: Date.now(),
          // Include all necessary data for processing
          numeroContrato: validated.numeroContrato,
          valorLiquido: validated.valorLiquido,
          formaPagamento: validated.formaPagamento,
        },
        {
          // CONF-001 - CRITICAL: Deterministic jobId ensures true idempotency
          jobId: jobId,
          // Additional job options
          attempts: 5, // Will be overridden by queue defaults
          removeOnComplete: 10,
          removeOnFail: 50,
        }
      );

      console.log(
        `[PAYMENT IDEMPOTENCY] ✅ Job ${jobId} added to paymentsQueue (Job ID: ${job.id})`
      );

      // Return job information instead of direct processing result
      return {
        message: 'Pagamento enfileirado para processamento idempotente',
        jobId: jobId,
        internalJobId: job.id,
        propostaId: validated.propostaId,
        status: 'em_fila',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      // If job addition fails, check if it's due to duplicate jobId (idempotency working)
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log(
          `[PAYMENT IDEMPOTENCY] 🛡️ Duplicate job prevented: ${jobId} already exists in queue`
        );

        return {
          message: 'Pagamento já foi enfileirado anteriormente (idempotência BullMQ-level)',
          jobId: jobId,
          propostaId: validated.propostaId,
          status: 'ja_enfileirado',
          duplicate: true,
          timestamp: new Date().toISOString(),
        };
      }

      console.error(`[PAYMENT IDEMPOTENCY] ❌ Failed to add job ${jobId}:`, error as Error);
      throw new Error(`Erro ao enfileirar pagamento: ${(error as Error).message}`);
    }
  }

  /**
   * Process payment - MOVED FROM DIRECT PROCESSING TO QUEUE WORKER
   * This method is now called by the BullMQ worker in server/worker.ts
   */
  async processPaymentFromQueue(paymentData: any, userId: string): Promise<any> {
    // Original processing logic moved here for queue worker consumption
    const validated = paymentData;

    // Get proposal data for status management
    const proposal = await this.getProposalForPayment(validated.propostaId);

    // Create payment record
    const updatedProposal = await pagamentoRepository.createPayment({
      ...validated,
      userId,
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
      await transitionTo({
        propostaId: validated.propostaId,
        novoStatus: 'processando_pagamento',
        userId,
        observacoes: 'Pagamento criado e enviado para processamento',
      });
    } catch (error) {
      if (error instanceof InvalidTransitionError) {
        console.warn(
          `[PAGAMENTO] Status transition warning for ${validated.propostaId}:`,
          error.message
        );
        // Continue with payment creation even if status transition fails
      } else {
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
  ): Promise<any> {
    // Get current proposal
    const proposal = await pagamentoRepository.getProposalForPayment(proposalId);
    if (!proposal) {
      throw new Error('Proposta não encontrada');
    }

    const statusAnterior = proposal.proposta.statusPagamento || 'pendente';

    // Update payment status
    const updatedProposal = await pagamentoRepository.updatePaymentStatus(
      proposalId,
      status,
      userId
    );

    if (!updatedProposal) {
      throw new Error('Erro ao atualizar status do pagamento');
    }

    // Audit status change
    await pagamentoRepository.auditPaymentAction(
      proposalId,
      userId,
      `PAGAMENTO_STATUS_${status.toUpperCase()}`,
      {
        statusAnterior,
        statusNovo: status,
        observacoes,
      }
    );

    // Create status contextual record
    await pagamentoRepository.createStatusContextual({
      propostaId: proposalId,
      statusAnterior,
      statusNovo: status,
      contexto: `Status de pagamento alterado: ${statusAnterior} → ${status}`,
      metadata: {
        observacoes,
        timestamp: new Date().toISOString(),
      },
      usuarioId: userId,
    });

    // Handle status transitions
    if (status === 'pago') {
      try {
        await transitionTo({
          propostaId: proposalId,
          novoStatus: 'pago',
          userId,
          observacoes: 'Pagamento confirmado e processado com sucesso',
        });
      } catch (error) {
        if (error instanceof InvalidTransitionError) {
          console.warn(`[PAGAMENTO] Status transition warning for ${proposalId}:`, error.message);
        } else {
          throw error;
        }
      }
    } else if (status === 'rejeitado') {
      try {
        await transitionTo({
          propostaId: proposalId,
          novoStatus: 'pagamento_rejeitado',
          userId,
          observacoes: observacoes || 'Pagamento rejeitado',
        });
      } catch (error) {
        if (error instanceof InvalidTransitionError) {
          console.warn(`[PAGAMENTO] Status transition warning for ${proposalId}:`, error.message);
        } else {
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
    data: any[];
    filename: string;
    contentType: string;
  }> {
    // Get filtered payments
    const payments = await pagamentoRepository.getPaymentsForExport(filters);

    // Transform data for export
    const exportData = payments.map((payment) => {
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
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `pagamentos-export-${timestamp}`;

    return {
      data: exportData,
      filename,
      contentType:
        filters.formato === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
    };
  }

  /**
   * Get payment statistics dashboard
   */
  async getPaymentsDashboard(): Promise<{
    statistics: any;
    recentPayments: any[];
    pendingCount: number;
    totalValue: number;
  }> {
    const statistics = await pagamentoRepository.getPaymentStatistics();

    // Get recent payments (last 10)
    const recentPayments = await pagamentoRepository.getProposalsReadyForPayment({
      status: undefined,
      incluirPagos: true,
    });

    const recent = recentPayments.slice(0, 10);

    // Calculate pending count and total value
    const pendingPayments = recentPayments.filter(
      (p) => !p.proposta.statusPagamento || p.proposta.statusPagamento !== 'pago'
    );

    const totalValue = recentPayments.reduce((sum, payment) => {
      return sum + (payment.proposta.valorLiquido || 0);
    }, 0);

    return {
      statistics,
      recentPayments: recent,
      pendingCount: pendingPayments.length,
      totalValue,
    };
  }

  /**
   * Validate payment data before processing
   */
  async validatePaymentData(paymentData: any): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      pagamentoSchema.parse(paymentData);
    } catch (error) {
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
    } catch (error) {
      errors.push(`Proposta: ${(error as Error).message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get available lojas and produtos for filters
   */
  async getFilterOptions(): Promise<{
    lojas: any[];
    produtos: any[];
    statusOptions: string[];
    formaPagamentoOptions: string[];
  }> {
    const [lojas, produtos] = await Promise.all([
      pagamentoRepository.getAllLojas(),
      pagamentoRepository.getAllProdutos(),
    ]);

    return {
      lojas,
      produtos,
      statusOptions: ['todos', 'aprovado', 'processando_pagamento', 'pago', 'pagamento_rejeitado'],
      formaPagamentoOptions: ['ted', 'pix', 'doc'],
    };
  }
}

export const pagamentoService = new PagamentoService();
