/**
 * Use Case: Aprovar Proposta
 *
 * Orquestra a aprovação de uma proposta por um analista
 * Refatorado para usar Unit of Work - Garantia de Atomicidade
 */

import { IUnitOfWork } from '../../shared/domain/IUnitOfWork';

export interface ApproveProposalDTO {
  proposalId: string;
  analistaId: string;
  observacoes?: string;
}

export class ApproveProposalUseCase {
  constructor(private unitOfWork: IUnitOfWork) {}

  async execute(dto: ApproveProposalDTO): Promise<void> {
    return await this.unitOfWork.executeInTransaction(async () => {
      // Buscar agregado usando repositório transacional
      const proposal = await this.unitOfWork.proposals.findById(dto.proposalId);

      if (!proposal) {
        throw new Error(`Proposta ${dto.proposalId} não encontrada`);
      }

      // Executar comando de negócio no agregado
      proposal.approve(dto.analistaId, dto.observacoes);

      // Persistir mudanças dentro da transação
      await this.unitOfWork.proposals.save(proposal);
    });
  }
}
