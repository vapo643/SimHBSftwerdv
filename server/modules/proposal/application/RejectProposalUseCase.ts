/**
 * Use Case: Rejeitar Proposta
 *
 * Orquestra a rejeição de uma proposta por um analista
 * Refatorado para usar Unit of Work - Garantia de Atomicidade
 */

import { IUnitOfWork } from '../../shared/domain/IUnitOfWork';

export interface RejectProposalDTO {
  proposalId: string;
  analistaId: string;
  motivo: string;
}

export class RejectProposalUseCase {
  constructor(private unitOfWork: IUnitOfWork) {}

  async execute(dto: RejectProposalDTO): Promise<void> {
    return await this.unitOfWork.executeInTransaction(async () => {
      // Buscar agregado usando repositório transacional
      const proposal = await this.unitOfWork.proposals.findById(dto.proposalId);

      if (!proposal) {
        throw new Error(`Proposta ${dto.proposalId} não encontrada`);
      }

      // Executar comando de negócio no agregado
      proposal.reject(dto.analistaId, dto.motivo);

      // Persistir mudanças dentro da transação
      await this.unitOfWork.proposals.save(proposal);
    });
  }
}
