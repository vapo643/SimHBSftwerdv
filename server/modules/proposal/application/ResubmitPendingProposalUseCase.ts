/**
 * Resubmit Pending Proposal Use Case - P0.2 GREEN CORRECTION
 * Elimina violação DIP no controller.resubmitFromPending()
 *
 * Controller não deve resolver repository diretamente
 * Encapsula lógica de reenvio + persistência
 */

import { IProposalRepository } from '../domain/IProposalRepository';
import { Proposal } from '../domain/Proposal';

export interface ResubmitPendingProposalRequest {
  id: string;
  analistaId?: string;
}

export interface ResubmitPendingProposalResponse {
  success: boolean;
  message: string;
  proposalId: string;
}

export class ResubmitPendingProposalUseCase {
  constructor(private readonly proposalRepository: IProposalRepository) {}

  async execute(request: ResubmitPendingProposalRequest): Promise<ResubmitPendingProposalResponse> {
    const { id } = request;

    // Buscar proposta
    const proposal = await this.proposalRepository.findById(id);

    if (!proposal) {
      throw new Error(`Proposta ${id} não encontrada`);
    }

    // Validar se pode ser reenviada (status deve ser 'pendente')
    if (proposal.status?.toString() !== 'pendente') {
      throw new Error(`Proposta ${id} não está em status pendente`);
    }

    // Aplicar regra de negócio de reenvio
    proposal.resubmitFromPending();

    // Persistir alterações
    await this.proposalRepository.save(proposal);

    return {
      success: true,
      message: 'Proposta reenviada para análise com sucesso',
      proposalId: proposal.id,
    };
  }
}
