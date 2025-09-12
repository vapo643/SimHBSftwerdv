/**
 * Use Case: Marcar como Aguardando Assinatura
 * 
 * PAM V1.0 - OPERAÇÃO RESTAURAÇÃO DO NÚCLEO
 * Orquestra a transição de status CCB_GERADA → AGUARDANDO_ASSINATURA
 * 
 * Este UseCase será usado quando refatorarmos a geração da CCB.
 * Por enquanto é um "placeholder" para manter consistência arquitetural.
 * 
 * Responsabilidades:
 * - Validar se proposta está no status correto (CCB_GERADA)
 * - Executar transição via FSM
 * - Registrar auditoria
 */

import { IUnitOfWork } from '../../shared/domain/IUnitOfWork';
import { DomainException } from '../../shared/domain/DomainException';
import { transitionTo, InvalidTransitionError } from '../../../services/statusFsmService';
import { logInfo, logError } from '../../../lib/logger';

export interface MarcarAguardandoAssinaturaDTO {
  propostaId: string;
  userId: string;
}

export class MarcarAguardandoAssinaturaUseCase {
  constructor(private unitOfWork: IUnitOfWork) {}

  async execute(dto: MarcarAguardandoAssinaturaDTO): Promise<void> {
    return await this.unitOfWork.executeInTransaction(async () => {
      logInfo('[MARCAR AGUARDANDO ASSINATURA USE CASE] Iniciando transição de status', {
        propostaId: dto.propostaId,
        userId: dto.userId,
        useCase: 'MarcarAguardandoAssinaturaUseCase'
      });

      // 1. Buscar proposta atual
      const proposal = await this.unitOfWork.proposals.findById(dto.propostaId);

      if (!proposal) {
        const errorMessage = `Proposta ${dto.propostaId} não encontrada`;
        logError('[MARCAR AGUARDANDO ASSINATURA USE CASE] Proposta não encontrada', new Error(errorMessage), {
          propostaId: dto.propostaId,
          userId: dto.userId
        });
        throw new DomainException(errorMessage);
      }

      const currentStatus = proposal.status;
      logInfo('[MARCAR AGUARDANDO ASSINATURA USE CASE] Status atual validado', {
        propostaId: dto.propostaId,
        currentStatus: currentStatus
      });

      // 2. VALIDAÇÃO: Verificar se status atual é CCB_GERADA
      if (currentStatus !== 'CCB_GERADA') {
        const errorMessage = `A proposta deve ter CCB gerada para aguardar assinatura. Status atual: ${currentStatus}`;
        logError('[MARCAR AGUARDANDO ASSINATURA USE CASE] Status inválido para transição', new Error(errorMessage), {
          propostaId: dto.propostaId,
          currentStatus: currentStatus,
          expectedStatus: 'CCB_GERADA'
        });
        throw new DomainException(errorMessage);
      }

      // 3. Executar transição via FSM Service
      try {
        await transitionTo({
          propostaId: dto.propostaId,
          novoStatus: 'AGUARDANDO_ASSINATURA',
          userId: dto.userId,
          contexto: 'transicao_aguardando_assinatura',
          observacoes: `CCB enviada para assinatura. Aguardando conclusão do processo de assinatura digital`,
          metadata: {
            tipoAcao: 'CCB_TO_SIGNATURE_PENDING',
            usuarioId: dto.userId,
            statusAnterior: currentStatus,
            useCase: 'MarcarAguardandoAssinaturaUseCase',
            timestamp: new Date().toISOString()
          }
        });

        // 4. Log de sucesso
        logInfo('[MARCAR AGUARDANDO ASSINATURA USE CASE] ✅ Transição executada com sucesso', {
          propostaId: dto.propostaId,
          fromStatus: currentStatus,
          toStatus: 'AGUARDANDO_ASSINATURA',
          userId: dto.userId,
          message: `Proposta ${dto.propostaId} agora aguarda assinatura digital`
        });

      } catch (error) {
        if (error instanceof InvalidTransitionError) {
          const domainError = `Transição de status inválida: ${error.message}`;
          logError('[MARCAR AGUARDANDO ASSINATURA USE CASE] Transição FSM inválida', error, {
            propostaId: dto.propostaId,
            fromStatus: error.fromStatus,
            toStatus: error.toStatus,
            userId: dto.userId
          });
          throw new DomainException(domainError);
        } else {
          logError('[MARCAR AGUARDANDO ASSINATURA USE CASE] Erro inesperado na transição', error as Error, {
            propostaId: dto.propostaId,
            userId: dto.userId
          });
          throw new DomainException(`Erro interno ao marcar como aguardando assinatura: ${(error as Error).message}`);
        }
      }
    });
  }
}