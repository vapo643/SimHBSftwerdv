/**
 * Dependencies Factory - IoC Container
 * Centralized dependency injection for Simpix modules
 * 
 * PAM P1.3 Implementation - Inversão de Dependência
 */

import { ProposalRepository } from './proposal/infrastructure/ProposalRepository';
import { CreditAnalysisService } from './credit/domain/services/CreditAnalysisService';
import { ProposalApplicationService } from './credit/application/ProposalApplicationService';

// ========================================================================
// REPOSITORIES (Singletons)
// ========================================================================

/**
 * Canonical Proposal Repository - Single instance for entire application
 */
export const proposalRepository = new ProposalRepository();

// ========================================================================
// DOMAIN SERVICES
// ========================================================================

/**
 * Credit Analysis Service
 */
export const creditAnalysisService = new CreditAnalysisService();

// ========================================================================
// APPLICATION SERVICES
// ========================================================================

/**
 * Proposal Application Service with injected dependencies
 */
export const proposalApplicationService = new ProposalApplicationService(
  proposalRepository,
  creditAnalysisService
);

// ========================================================================
// USE CASES (Lazy-loaded when needed)
// ========================================================================

import { CreateProposalUseCase } from './proposal/application/CreateProposalUseCase';
import { GetProposalByIdUseCase } from './proposal/application/GetProposalByIdUseCase';
import { ApproveProposalUseCase } from './proposal/application/ApproveProposalUseCase';
import { RejectProposalUseCase } from './proposal/application/RejectProposalUseCase';
import { PendenciarPropostaUseCase } from './proposal/application/PendenciarPropostaUseCase';
import { SubmitForAnalysisUseCase } from './proposal/application/SubmitForAnalysisUseCase';

/**
 * Factory functions for Use Cases with dependency injection
 */
export const createProposalUseCase = () => new CreateProposalUseCase(proposalRepository);
export const getProposalByIdUseCase = () => new GetProposalByIdUseCase(proposalRepository);
export const approveProposalUseCase = () => new ApproveProposalUseCase(proposalRepository);
export const rejectProposalUseCase = () => new RejectProposalUseCase(proposalRepository);
export const pendenciarPropostaUseCase = () => new PendenciarPropostaUseCase(proposalRepository);
export const submitForAnalysisUseCase = () => new SubmitForAnalysisUseCase(proposalRepository);