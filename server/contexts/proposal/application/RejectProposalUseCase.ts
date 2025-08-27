/**
 * Use Case: Rejeitar Proposta
 *
 * Orquestra a rejeição de uma proposta por um analista
 */

import { IProposalRepository } from '../domain/Proposal';

export interface RejectProposalDTO {
  proposalId: string;
  analistaId: string;
  motivo: string;
}

export class RejectProposalUseCase {
  constructor(private proposalRepository: IProposalRepository) {}

  async execute(dto: RejectProposalDTO): Promise<void> {
    // Buscar agregado
    const proposal = await this.proposalRepository.findById(dto.proposalId);

    if (!proposal) {
      throw new Error(`Proposta ${dto.proposalId} não encontrada`);
    }

    // Executar comando de negócio no agregado
    proposal.reject(dto.analistaId, dto.motivo);

    // Persistir mudanças
    await this.proposalRepository.save(proposal);
  }
}
