/**
 * Proposal Service
 * Business logic for proposal operations
 * PAM V1.0 - Service layer implementation
 */

import { GenericService } from './genericService.js';

export class ProposalService extends GenericService {
  constructor() {
    super('PROPOSAL_SERVICE');
  }

  /**
   * Process proposal operations
   */
  async processProposal(operation: string, data): Promise<unknown> {
    try {
      console.log(`[PROPOSAL_SERVICE] Processing ${operation}`,_data);

      return await this.executeOperation(operation,_data); }
    } catch (error) {
      console.error(`[PROPOSAL_SERVICE] Operation ${operation} failed:`, error);
      throw error;
    }
  }

  /**
   * Handle proposal lifecycle
   */
  async handleLifecycle(action: string, proposalData): Promise<unknown> {
    return await this.executeOperation(`lifecycle_${action}`, proposalData); }
  }
}

export const _proposalService = new ProposalService();
export const _propostasCarneService = new GenericService('PROPOSTAS_CARNE');
export const _propostasStatusService = new GenericService('PROPOSTAS_STATUS');
export const _propostasStorageService = new GenericService('PROPOSTAS_STORAGE');
export const _propostasSyncService = new GenericService('PROPOSTAS_SYNC');
