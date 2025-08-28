/**
 * Use Case: Rejeitar Proposta
 *
 * Orquestra a rejeição de uma proposta por um analista
 * Refatorado para usar Unit of Work - Garantia de Atomicidade
 */

import { IProposalRepository } from '../domain/IProposalRepository';

export interface RejectProposalDTO {
  proposalId: string;
  analistaId: string;
  motivo: string;
}

export class RejectProposalUseCase {
  constructor(private repository: IProposalRepository) {}

  async execute(dto: RejectProposalDTO): Promise<void> {
    // Buscar agregado usando repositório
    const proposal = await this.repository.findById(dto.proposalId);

    if (!proposal) {
      throw new Error(`Proposta ${dto.proposalId} não encontrada`);
    }

    // Executar comando de negócio no agregado
    proposal.reject(dto.analistaId, dto.motivo);

    // Persistir mudanças
    await this.repository.save(proposal);
  }
}
