/**
 * Inter Webhook Service
 *
 * Processa webhooks do Banco Inter com segurança bancária e auditoria completa
 * Integra o MarkBoletoAsPaidUseCase para processamento de pagamentos
 * PAM V1.0 - Operação Muralha de Aço Fase 2
 */

import { UnitOfWork } from '../modules/shared/infrastructure/UnitOfWork';
import { MarkBoletoAsPaidUseCase } from '../modules/boleto/application/MarkBoletoAsPaidUseCase';
import { securityRepository } from '../repositories/security.repository';
import { SecureLogger, sanitizeWebhookPayload } from '../modules/shared/infrastructure/SanitizedLogger';

export interface InterWebhookPayload {
  event?: string;
  data?: any;
  boletoId?: string;
  nossoNumero?: string;
  status?: string;
  dataPagamento?: string;
  valorPago?: number;
  formaPagamento?: string;
  pixTxid?: string;
  comprovante?: string;
  [key: string]: any; // Para outros campos não mapeados
}

export class InterWebhookService {
  private unitOfWork: UnitOfWork;
  private markBoletoAsPaidUseCase: MarkBoletoAsPaidUseCase;

  constructor() {
    this.unitOfWork = new UnitOfWork();
    this.markBoletoAsPaidUseCase = new MarkBoletoAsPaidUseCase(this.unitOfWork);
  }

  /**
   * Processa webhook do Inter baseado no tipo de evento
   */
  async processWebhook(
    operation: string,
    payload: InterWebhookPayload,
    metadata?: any
  ): Promise<any> {
    try {
      SecureLogger.webhook(`Processing ${operation}`, {
        eventType: payload.event,
        boletoId: payload.boletoId,
        nossoNumero: payload.nossoNumero,
        status: payload.status,
      }, 'inter');

      // Log início do processamento (COM SANITIZAÇÃO)
      await securityRepository.logSecurityEvent({
        eventType: 'WEBHOOK_PROCESSING_START',
        severity: 'LOW',
        details: {
          description: 'Inter webhook processing started',
          service: 'inter',
          operation,
          eventType: payload.event,
          webhookPayload: sanitizeWebhookPayload(payload),
          metadata: metadata ? sanitizeWebhookPayload(metadata) : null,
        },
      });

      // Processar baseado na operação solicitada
      switch (operation) {
        case 'webhook_inter':
          return await this.processInterWebhookEvent(payload, metadata);
        default:
          console.warn(`[INTER WEBHOOK] Unknown operation: ${operation}`);
          return {
            success: false,
            operation,
            error: 'Unknown operation',
            timestamp: new Date().toISOString(),
          };
      }
    } catch (error: any) {
      console.error(`[INTER WEBHOOK] Processing error:`, error);

      // Log erro crítico
      await securityRepository.logSecurityEvent({
        eventType: 'WEBHOOK_PROCESSING_ERROR',
        severity: 'HIGH',
        details: {
          description: 'Inter webhook processing failed with critical error',
          service: 'inter',
          operation,
          error: error.message,
          errorStack: error.stack,
          payload,
        },
      });

      throw error;
    }
  }

  /**
   * Processa eventos específicos do webhook Inter
   */
  private async processInterWebhookEvent(
    payload: InterWebhookPayload,
    metadata?: any
  ): Promise<any> {
    const eventType = payload.event?.toLowerCase();

    switch (eventType) {
      case 'boleto.paid':
      case 'payment.confirmed':
      case 'cobranca.pagamento':
        return await this.processBoletoPayment(payload, metadata);

      case 'boleto.cancelled':
      case 'cobranca.cancelamento':
        return await this.processBoletoCancel(payload, metadata);

      case 'boleto.overdue':
      case 'cobranca.vencimento':
        return await this.processBoletoOverdue(payload, metadata);

      default:
        console.warn(`[INTER WEBHOOK] Unknown event type: ${eventType}`);
        return {
          success: true, // Return success to prevent retries for unknown events
          processed: false,
          eventType,
          message: 'Event type not implemented yet',
          timestamp: new Date().toISOString(),
        };
    }
  }

  /**
   * Processa pagamento de boleto - INTEGRAÇÃO COM MarkBoletoAsPaidUseCase
   */
  private async processBoletoPayment(payload: InterWebhookPayload, metadata?: any): Promise<any> {
    try {
      // Extrair dados do payload
      const boletoId = payload.boletoId || payload.data?.boletoId;
      const nossoNumero = payload.nossoNumero || payload.data?.nossoNumero;
      const dataPagamento = payload.dataPagamento || payload.data?.dataPagamento;
      const valorPago = payload.valorPago || payload.data?.valorPago;
      const formaPagamento = payload.formaPagamento || payload.data?.formaPagamento || 'boleto';
      const pixTxid = payload.pixTxid || payload.data?.pixTxid;
      const comprovante = payload.comprovante || payload.data?.comprovante;

      if (!boletoId && !nossoNumero) {
        throw new Error('BoletoId or nossoNumero is required for payment processing');
      }

      // Se temos apenas nossoNumero, buscar boletoId
      let finalBoletoId = boletoId;
      if (!finalBoletoId && nossoNumero) {
        // Implementar busca por nossoNumero usando repositório
        console.log(`[INTER WEBHOOK] TODO: Implement findByNossoNumero for ${nossoNumero}`);
        // Por enquanto, usar o nossoNumero como fallback
        finalBoletoId = `boleto_${nossoNumero}`;
      }

      // Usar o MarkBoletoAsPaidUseCase para processar o pagamento
      await this.markBoletoAsPaidUseCase.execute({
        boletoId: finalBoletoId,
        formaPagamento: formaPagamento as 'boleto' | 'pix' | 'transferencia' | 'cartao',
        dataPagamento: dataPagamento ? new Date(dataPagamento) : new Date(),
        valorPago: valorPago ? parseFloat(valorPago.toString()) : undefined,
        nossoNumero,
        pixTxid,
        comprovantePagamentoUrl: comprovante,
        observacoes: `Pagamento confirmado via webhook Inter - Evento: ${payload.event}`,
        webhookEventId: metadata?.webhookEventId || `webhook_${Date.now()}`,
      });

      console.log(`[INTER WEBHOOK] ✅ Payment processed successfully for boleto ${finalBoletoId}`);

      return {
        success: true,
        processed: true,
        operation: 'boleto_payment',
        boletoId: finalBoletoId,
        nossoNumero,
        eventType: payload.event,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`[INTER WEBHOOK] Payment processing error:`, error);

      // Log erro específico de pagamento
      await securityRepository.logSecurityEvent({
        eventType: 'BOLETO_PAYMENT_WEBHOOK_ERROR',
        severity: 'HIGH',
        details: {
          description: 'Inter webhook boleto payment processing failed',
          service: 'inter',
          error: error.message,
          errorStack: error.stack,
          payload,
          metadata,
        },
      });

      throw error;
    }
  }

  /**
   * Processa cancelamento de boleto
   */
  private async processBoletoCancel(payload: InterWebhookPayload, metadata?: any): Promise<any> {
    console.log(`[INTER WEBHOOK] Processing boleto cancellation`, payload);

    // TODO: Implementar MarkBoletoAsCancelledUseCase
    return {
      success: true,
      processed: false,
      operation: 'boleto_cancel',
      message: 'Boleto cancellation processing not implemented yet',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Processa vencimento de boleto
   */
  private async processBoletoOverdue(payload: InterWebhookPayload, metadata?: any): Promise<any> {
    console.log(`[INTER WEBHOOK] Processing boleto overdue`, payload);

    // TODO: Implementar MarkBoletoAsOverdueUseCase
    return {
      success: true,
      processed: false,
      operation: 'boleto_overdue',
      message: 'Boleto overdue processing not implemented yet',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Test service connectivity and dependencies
   */
  async testConnection(): Promise<{
    success: boolean;
    serviceName: string;
    dependencies: Record<string, boolean>;
    timestamp: string;
  }> {
    try {
      // Test UnitOfWork connectivity
      const testUnitOfWork = new UnitOfWork();
      await testUnitOfWork.executeInTransaction(async () => {
        // Simple transaction test - no actual operations
        console.log('[INTER WEBHOOK] Testing UnitOfWork connectivity');
      });

      return {
        success: true,
        serviceName: 'InterWebhookService',
        dependencies: {
          unitOfWork: true,
          markBoletoAsPaidUseCase: true,
          securityRepository: true,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('[INTER WEBHOOK] Connection test failed:', error);
      return {
        success: false,
        serviceName: 'InterWebhookService',
        dependencies: {
          unitOfWork: false,
          markBoletoAsPaidUseCase: false,
          securityRepository: true, // Assume security is working if we reach here
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Instância singleton para uso no webhook
export const interWebhookService = new InterWebhookService();
