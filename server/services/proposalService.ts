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
  async processProposal(operation: string, data: unknown): Promise<unknown> {
    try {
      console.log(`[PROPOSAL_SERVICE] Processing ${operation}`, data);

      return await this.executeOperation(operation, data);
    } catch (error: unknown) {
      console.error(`[PROPOSAL_SERVICE] Operation ${operation} failed:`, error);
      throw error;
    }
  }

  /**
   * Handle proposal lifecycle
   */
  async handleLifecycle(action: string, proposalData: unknown): Promise<unknown> {
    return await this.executeOperation(`lifecycle_${action}`, proposalData);
  }
}

export const proposalService = new ProposalService();
export const propostasCarneService = new GenericService('PROPOSTAS_CARNE');
export const propostasStatusService = new GenericService('PROPOSTAS_STATUS');
export const propostasStorageService = new GenericService('PROPOSTAS_STORAGE');
export const propostasSyncService = new GenericService('PROPOSTAS_SYNC');
