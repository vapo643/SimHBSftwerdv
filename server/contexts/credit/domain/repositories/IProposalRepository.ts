/**
 * Proposal Repository Interface
 * Abstraction for data persistence
 */

import { Proposal } from '../aggregates/Proposal';

export interface IProposalRepository {
  // Query methods
  findById(id: string): Promise<Proposal | null>;
  findByCpf(cpf: string): Promise<Proposal[]>;
  findByStoreId(storeId: string): Promise<Proposal[]>;
  findAll(): Promise<Proposal[]>;
  
  // Command methods
  save(proposal: Proposal): Promise<void>;
  update(proposal: Proposal): Promise<void>;
  delete(id: string): Promise<void>;
  
  // Business specific queries
  findPendingAnalysis(): Promise<Proposal[]>;
  findByStatusAndDateRange(
    status: string,
    startDate: Date,
    endDate: Date
  ): Promise<Proposal[]>;
  
  // Aggregate queries
  countByStatus(status: string): Promise<number>;
  getTotalAmountByStatus(status: string): Promise<number>;
}