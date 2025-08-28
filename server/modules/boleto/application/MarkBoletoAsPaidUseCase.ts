/**
 * Use Case: Marcar Boleto como Pago
 * 
 * Orquestra a marcação de um boleto como pago por um webhook ou operação manual
 * Implementa auditoria completa para conformidade bancária
 * PAM V1.0 - Operação Muralha de Aço Fase 2
 */

import { IUnitOfWork } from '../../shared/domain/IUnitOfWork';
import { securityRepository } from '../../../repositories/security.repository';

export interface MarkBoletoAsPaidDTO {
  boletoId: string;
  userId?: string;
  formaPagamento?: 'boleto' | 'pix' | 'transferencia' | 'cartao';
  dataPagamento?: Date;
  valorPago?: number;
  nossoNumero?: string;
  pixTxid?: string;
  comprovantePagamentoUrl?: string;
  observacoes?: string;
  webhookEventId?: string;
}

export class MarkBoletoAsPaidUseCase {
  constructor(private unitOfWork: IUnitOfWork) {}

  async execute(dto: MarkBoletoAsPaidDTO): Promise<void> {
    return await this.unitOfWork.executeInTransaction(async () => {
      // Buscar boleto usando repositório transacional
      const boleto = await this.unitOfWork.boletos.findById(dto.boletoId);

      if (!boleto) {
        // Log failed attempt for audit trail
        await securityRepository.logSecurityEvent({
          eventType: 'BOLETO_PAYMENT_FAILED',
          severity: 'MEDIUM',
          userId: dto.userId,
          details: {
            description: 'Attempted to mark non-existent boleto as paid',
            boletoId: dto.boletoId,
            reason: 'boleto_not_found',
            webhookEventId: dto.webhookEventId
          }
        });
        
        throw new Error(`Boleto ${dto.boletoId} não encontrado`);
      }

      // Validar se boleto pode ser marcado como pago
      if (boleto.status === 'pago') {
        // Log duplicate payment attempt
        await securityRepository.logSecurityEvent({
          eventType: 'BOLETO_PAYMENT_DUPLICATE',
          severity: 'MEDIUM',
          userId: dto.userId,
          details: {
            description: 'Attempted to mark already paid boleto as paid',
            boletoId: dto.boletoId,
            numeroBoleto: boleto.numeroBoleto,
            propostaId: boleto.propostaId,
            currentStatus: boleto.status,
            originalPaymentDate: boleto.dataPagamento,
            webhookEventId: dto.webhookEventId
          }
        });
        
        throw new Error(`Boleto ${boleto.numeroBoleto} já está marcado como pago`);
      }

      if (boleto.status === 'cancelado') {
        // Log attempt to pay cancelled boleto
        await securityRepository.logSecurityEvent({
          eventType: 'BOLETO_PAYMENT_CANCELLED',
          severity: 'HIGH',
          userId: dto.userId,
          details: {
            description: 'Attempted to mark cancelled boleto as paid - potential fraud',
            boletoId: dto.boletoId,
            numeroBoleto: boleto.numeroBoleto,
            propostaId: boleto.propostaId,
            currentStatus: boleto.status,
            motivoCancelamento: boleto.motivoCancelamento,
            webhookEventId: dto.webhookEventId
          }
        });
        
        throw new Error(`Boleto ${boleto.numeroBoleto} está cancelado e não pode ser marcado como pago`);
      }

      // Atualizar dados do boleto
      const dataPagamento = dto.dataPagamento || new Date();
      const statusAnterior = boleto.status;
      
      boleto.status = 'pago';
      boleto.dataPagamento = dataPagamento;
      boleto.formaPagamento = dto.formaPagamento || boleto.formaPagamento || 'boleto';
      
      if (dto.valorPago) {
        boleto.valorTotal = dto.valorPago;
      }
      
      if (dto.nossoNumero) {
        boleto.nossoNumero = dto.nossoNumero;
      }
      
      if (dto.pixTxid) {
        boleto.pixTxid = dto.pixTxid;
      }
      
      if (dto.comprovantePagamentoUrl) {
        boleto.urlComprovantePagamento = dto.comprovantePagamentoUrl;
      }
      
      if (dto.observacoes) {
        boleto.observacoes = dto.observacoes;
      }

      boleto.updatedAt = new Date();

      // Persistir mudanças dentro da transação
      await this.unitOfWork.boletos.save(boleto);

      // Log successful payment marking for audit trail - CRITICAL REQUIREMENT
      await securityRepository.logSecurityEvent({
        eventType: 'BOLETO_PAYMENT_SUCCESS',
        severity: 'LOW',
        userId: dto.userId,
        details: {
          description: 'Boleto successfully marked as paid',
          boletoId: dto.boletoId,
          numeroBoleto: boleto.numeroBoleto,
          propostaId: boleto.propostaId,
          statusAnterior,
          statusNovo: 'pago',
          dataPagamento: dataPagamento.toISOString(),
          formaPagamento: boleto.formaPagamento,
          valorPago: boleto.valorTotal?.toString(),
          nossoNumero: boleto.nossoNumero,
          pixTxid: boleto.pixTxid,
          comprovantePagamentoUrl: boleto.urlComprovantePagamento,
          webhookEventId: dto.webhookEventId,
          auditTrail: {
            operation: 'mark_boleto_as_paid',
            timestamp: new Date().toISOString(),
            transactionContext: this.unitOfWork.transactionId
          }
        }
      });

      console.log(`[BOLETO PAYMENT] ✅ Boleto ${boleto.numeroBoleto} marcado como pago - Proposta ${boleto.propostaId}`);
    });
  }
}