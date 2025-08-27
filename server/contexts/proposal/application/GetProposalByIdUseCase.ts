/**
 * Use Case: Buscar Proposta por ID
 *
 * Query para buscar uma proposta específica
 */

import { IProposalRepository } from '../domain/Proposal';
import { Proposal } from '../domain/Proposal';

export class GetProposalByIdUseCase {
  constructor(private proposalRepository: IProposalRepository) {}

  async execute(id: string): Promise<Proposal | null> {
    return await this.proposalRepository.findById(id);
  }
}
