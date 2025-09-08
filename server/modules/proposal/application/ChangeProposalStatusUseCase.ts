/**
 * Use Case: Alterar Status da Proposta
 *
 * Orquestra mudanças de status com auditoria completa
 * PAM V1.0 - Remediação de Segurança Crítica
 * Implementa trilha de auditoria mandatória
 */

import { IUnitOfWork } from '../../shared/domain/IUnitOfWork';
import { auditService, type TriggeredBy } from '../../../services/auditService';

export interface ChangeProposalStatusDTO {
  proposalId: string;
  newStatus: string;
  triggeredBy: TriggeredBy;
  userId?: string;
  reason?: string;
  webhookEventId?: string;
  metadata?: Record<string, any>;
}

export class ChangeProposalStatusUseCase {
  constructor(private unitOfWork: IUnitOfWork) {}

  async execute(dto: ChangeProposalStatusDTO): Promise<void> {
    return await this.unitOfWork.executeInTransaction(async () => {
      console.log(
        `[CHANGE STATUS USE CASE] Iniciando mudança de status para proposta ${dto.proposalId}`
      );
      console.log(`[CHANGE STATUS USE CASE] Novo status: ${dto.newStatus}`);

      // 1. Buscar proposta atual
      const proposal = await this.unitOfWork.proposals.findById(dto.proposalId);

      if (!proposal) {
        throw new Error(`Proposta ${dto.proposalId} não encontrada`);
      }

      const currentStatus = proposal.status;
      console.log(`[CHANGE STATUS USE CASE] Status atual: ${currentStatus}`);

      // 2. Validar se a mudança é válida
      if (currentStatus === dto.newStatus) {
        console.warn(`[CHANGE STATUS USE CASE] Status já é ${dto.newStatus}, ignorando`);
        return;
      }

      // 3. Executar mudança de status no agregado
      // Usando setter direto para mudanças de status genéricas (interno ao domínio)
      (proposal as any)._status = dto.newStatus;
      (proposal as any)._updatedAt = new Date();

      // 4. Persistir mudanças
      await this.unitOfWork.proposals.save(proposal);

      // 5. AUDITORIA MANDATÓRIA - Registrar transição
      try {
        await auditService.logStatusTransition({
          propostaId: dto.proposalId,
          fromStatus: currentStatus,
          toStatus: dto.newStatus,
          triggeredBy: dto.triggeredBy,
          userId: dto.userId,
          webhookEventId: dto.webhookEventId,
          metadata: {
            ...dto.metadata,
            reason: dto.reason,
            useCase: 'ChangeProposalStatusUseCase',
            timestamp: new Date().toISOString(),
          },
        });

        console.log(`[CHANGE STATUS USE CASE] ✅ Auditoria registrada com sucesso`);
      } catch (auditError: any) {
        console.error(`[CHANGE STATUS USE CASE] ❌ Falha na auditoria:`, auditError);
        // Falha na auditoria deve quebrar a transação (segurança crítica)
        throw new Error(
          `Falha crítica na auditoria: ${auditError?.message || 'Erro desconhecido'}`
        );
      }

      console.log(`[CHANGE STATUS USE CASE] ✅ Mudança de status concluída com sucesso`);
    });
  }
}
