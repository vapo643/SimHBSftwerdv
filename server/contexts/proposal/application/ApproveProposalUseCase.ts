/**
 * Use Case: Aprovar Proposta
 *
 * Orquestra a aprovação de uma proposta por um analista
 */

import { IProposalRepository } from '../domain/IProposalRepository';

export interface ApproveProposalDTO {
  proposalId: string;
  analistaId: string;
  observacoes?: string;
}

export class ApproveProposalUseCase {
  constructor(private proposalRepository: IProposalRepository) {}

  async execute(dto: ApproveProposalDTO): Promise<void> {
    // Buscar agregado
    const proposal = await this.proposalRepository.findById(dto.proposalId);

    if (!proposal) {
      throw new Error(`Proposta ${dto.proposalId} não encontrada`);
    }

    // Executar comando de negócio no agregado
    proposal.approve(dto.analistaId, dto.observacoes);

    // Persistir mudanças
    await this.proposalRepository.save(proposal);
  }
}
