import { BaseDomainEvent } from '../../../shared/domain/events/DomainEvent';

export class ProposalApprovedEvent extends BaseDomainEvent {
  constructor(proposalId: string, analistaId?: string, observacoes?: string) {
    super(proposalId, 'ProposalApproved', {
      analistaId,
      observacoes,
      approvedAt: new Date().toISOString(),
    });
  }
}
