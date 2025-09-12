/**
 * Use Case: Marcar Assinatura como Concluída
 * 
 * PAM V1.0 - OPERAÇÃO RESTAURAÇÃO DO NÚCLEO
 * Orquestra a transição de status AGUARDANDO_ASSINATURA → ASSINATURA_CONCLUIDA
 * 
 * Responsabilidades:
 * - Validar se proposta está no status correto (AGUARDANDO_ASSINATURA)
 * - Executar transição via FSM
 * - Registrar auditoria
 */

import { IUnitOfWork } from '../../shared/domain/IUnitOfWork';
import { DomainException } from '../../shared/domain/DomainException';
import { transitionTo, InvalidTransitionError } from '../../../services/statusFsmService';
import { logInfo, logError } from '../../../lib/logger';

export interface MarcarAssinaturaConcluidaDTO {
  propostaId: string;
  userId: string;
}

export class MarcarAssinaturaConcluidaUseCase {
  constructor(private unitOfWork: IUnitOfWork) {}

  async execute(dto: MarcarAssinaturaConcluidaDTO): Promise<void> {
    return await this.unitOfWork.executeInTransaction(async () => {
      logInfo('[MARCAR ASSINATURA CONCLUIDA USE CASE] Iniciando transição de status', {
        propostaId: dto.propostaId,
        userId: dto.userId,
        useCase: 'MarcarAssinaturaConcluidaUseCase'
      });

      // 1. Buscar proposta atual
      const proposal = await this.unitOfWork.proposals.findById(dto.propostaId);

      if (!proposal) {
        const errorMessage = `Proposta ${dto.propostaId} não encontrada`;
        logError('[MARCAR ASSINATURA CONCLUIDA USE CASE] Proposta não encontrada', new Error(errorMessage), {
          propostaId: dto.propostaId,
          userId: dto.userId
        });
        throw new DomainException(errorMessage);
      }

      const currentStatus = proposal.status;
      logInfo('[MARCAR ASSINATURA CONCLUIDA USE CASE] Status atual validado', {
        propostaId: dto.propostaId,
        currentStatus: currentStatus
      });

      // 2. VALIDAÇÃO: Verificar se status atual é AGUARDANDO_ASSINATURA
      if (currentStatus !== 'AGUARDANDO_ASSINATURA') {
        const errorMessage = `A proposta não está aguardando assinatura. Status atual: ${currentStatus}`;
        logError('[MARCAR ASSINATURA CONCLUIDA USE CASE] Status inválido para transição', new Error(errorMessage), {
          propostaId: dto.propostaId,
          currentStatus: currentStatus,
          expectedStatus: 'AGUARDANDO_ASSINATURA'
        });
        throw new DomainException(errorMessage);
      }

      // 3. Executar transição via FSM Service
      try {
        await transitionTo({
          propostaId: dto.propostaId,
          novoStatus: 'ASSINATURA_CONCLUIDA',
          userId: dto.userId,
          contexto: 'manual_assinatura_concluida',
          observacoes: `Assinatura marcada como concluída manualmente pelo usuário ${dto.userId}`,
          metadata: {
            tipoAcao: 'MANUAL_SIGNATURE_COMPLETED',
            usuarioId: dto.userId,
            statusAnterior: currentStatus,
            useCase: 'MarcarAssinaturaConcluidaUseCase',
            timestamp: new Date().toISOString()
          }
        });

        // 4. Log de sucesso
        logInfo('[MARCAR ASSINATURA CONCLUIDA USE CASE] ✅ Transição executada com sucesso', {
          propostaId: dto.propostaId,
          fromStatus: currentStatus,
          toStatus: 'ASSINATURA_CONCLUIDA',
          userId: dto.userId,
          message: `Assinatura da proposta ${dto.propostaId} marcada como concluída pelo usuário ${dto.userId}`
        });

      } catch (error) {
        if (error instanceof InvalidTransitionError) {
          const domainError = `Transição de status inválida: ${error.message}`;
          logError('[MARCAR ASSINATURA CONCLUIDA USE CASE] Transição FSM inválida', error, {
            propostaId: dto.propostaId,
            fromStatus: error.fromStatus,
            toStatus: error.toStatus,
            userId: dto.userId
          });
          throw new DomainException(domainError);
        } else {
          logError('[MARCAR ASSINATURA CONCLUIDA USE CASE] Erro inesperado na transição', error as Error, {
            propostaId: dto.propostaId,
            userId: dto.userId
          });
          throw new DomainException(`Erro interno ao marcar assinatura como concluída: ${(error as Error).message}`);
        }
      }
    });
  }
}