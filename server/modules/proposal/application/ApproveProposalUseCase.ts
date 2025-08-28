/**
 * Use Case: Aprovar Proposta
 *
 * Orquestra a aprovação de uma proposta por um analista
 * Refatorado para usar Unit of Work - Garantia de Atomicidade
 */

import { IProposalRepository } from '../domain/IProposalRepository';

export interface ApproveProposalDTO {
  proposalId: string;
  analistaId: string;
  observacoes?: string;
}

export class ApproveProposalUseCase {
  constructor(private repository: IProposalRepository) {}

  async execute(dto: ApproveProposalDTO): Promise<void> {
    // Buscar agregado usando repositório
    const proposal = await this.repository.findById(dto.proposalId);

    if (!proposal) {
      throw new Error(`Proposta ${dto.proposalId} não encontrada`);
    }

    // Executar comando de negócio no agregado
    proposal.approve(dto.analistaId, dto.observacoes);

    // Persistir mudanças
    await this.repository.save(proposal);
  }
}
