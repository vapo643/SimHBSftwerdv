/**
 * Service Registry - CONFIGURAÇÃO P0.2 PLANO SOBERANIA
 * Registra todas as dependências no IoC Container
 * 
 * Substitui exports diretos por injeção de dependência apropriada
 */

import { Container, TOKENS } from './Container';

// Import repositories
import { ProposalRepository } from '../../proposal/infrastructure/ProposalRepository';

// Import use cases
import { CreateProposalUseCase } from '../../proposal/application/CreateProposalUseCase';
import { GetProposalByIdUseCase } from '../../proposal/application/GetProposalByIdUseCase';
import { ApproveProposalUseCase } from '../../proposal/application/ApproveProposalUseCase';
import { RejectProposalUseCase } from '../../proposal/application/RejectProposalUseCase';
import { PendenciarPropostaUseCase } from '../../proposal/application/PendenciarPropostaUseCase';
import { SubmitForAnalysisUseCase } from '../../proposal/application/SubmitForAnalysisUseCase';

/**
 * Configura o container de dependências
 * Chamado uma vez na inicialização do servidor
 */
export function configureContainer(): Container {
  const container = Container.getInstance();

  // ========================================================================
  // REPOSITORIES (Singletons)
  // ========================================================================
  
  const proposalRepository = new ProposalRepository();
  container.register(TOKENS.PROPOSAL_REPOSITORY, proposalRepository);

  // ========================================================================
  // USE CASES (Factories with DI)
  // ========================================================================
  
  // Factory functions que recebem dependências injetadas
  container.registerFactory(TOKENS.CREATE_PROPOSAL_USE_CASE, () => 
    new CreateProposalUseCase(container.resolve(TOKENS.PROPOSAL_REPOSITORY))
  );

  container.registerFactory(TOKENS.GET_PROPOSAL_BY_ID_USE_CASE, () => 
    new GetProposalByIdUseCase(container.resolve(TOKENS.PROPOSAL_REPOSITORY))
  );

  container.registerFactory(TOKENS.APPROVE_PROPOSAL_USE_CASE, () => 
    new ApproveProposalUseCase(container.resolve(TOKENS.PROPOSAL_REPOSITORY))
  );

  container.registerFactory(TOKENS.REJECT_PROPOSAL_USE_CASE, () => 
    new RejectProposalUseCase(container.resolve(TOKENS.PROPOSAL_REPOSITORY))
  );

  container.registerFactory(TOKENS.PENDENCIAR_PROPOSTA_USE_CASE, () => 
    new PendenciarPropostaUseCase(container.resolve(TOKENS.PROPOSAL_REPOSITORY))
  );

  container.registerFactory(TOKENS.SUBMIT_FOR_ANALYSIS_USE_CASE, () => 
    new SubmitForAnalysisUseCase(container.resolve(TOKENS.PROPOSAL_REPOSITORY))
  );

  return container;
}