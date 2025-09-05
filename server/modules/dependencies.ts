/**
 * ⚠️ DEPRECATED: Migrado para IoC Container P0.2 
 * Use Container + ServiceRegistry em vez de exports diretos
 * 
 * Mantido TEMPORARIAMENTE apenas para compatibilidade
 */

// 🏡 P0.2 - Nova arquitetura IoC
import { configureContainer } from './shared/infrastructure/ServiceRegistry';
import { Container, TOKENS } from './shared/infrastructure/Container';

// 🏡 P0.2 - Container será inicializado APENAS em server/index.ts
// Remover inicialização duplicada conforme advisor feedback
const container = Container.getInstance(); // Usar instância já configurada

// ========================================================================
// COMPATIBILIDADE TRANSITÓRIA - DEPRECATED 
// ========================================================================
// Exports legados mantidos para compatibilidade durante transição P0.2
// TODO: Remover após migração completa dos controllers para DI

export const createProposalUseCase = () => container.resolve(TOKENS.CREATE_PROPOSAL_USE_CASE);
export const getProposalByIdUseCase = () => container.resolve(TOKENS.GET_PROPOSAL_BY_ID_USE_CASE);
export const approveProposalUseCase = () => container.resolve(TOKENS.APPROVE_PROPOSAL_USE_CASE);
export const rejectProposalUseCase = () => container.resolve(TOKENS.REJECT_PROPOSAL_USE_CASE);
export const pendenciarPropostaUseCase = () => container.resolve(TOKENS.PENDENCIAR_PROPOSTA_USE_CASE);
export const submitForAnalysisUseCase = () => container.resolve(TOKENS.SUBMIT_FOR_ANALYSIS_USE_CASE);

// Repository para casos transitórios - DEPRECATED
export const proposalRepository = container.resolve(TOKENS.PROPOSAL_REPOSITORY);