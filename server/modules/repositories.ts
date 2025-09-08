/**
 * Módulo de Repositórios - Banking-Grade Repository Pattern
 * Sprint 2 S2-002 - PAM V1.0
 *
 * Centralizador de exports para todos os repositórios implementados
 * com padrão Repository Pattern e paginação baseada em cursor.
 */

// ========================================================================
// INTERFACES (DOMAIN LAYER)
// ========================================================================
export type {
  IProposalRepository,
  ProposalRepository,
} from './proposal/domain/IProposalRepository';
export type { ICcbRepository, CcbRepository } from './ccb/domain/ICcbRepository';
export type { IBoletoRepository, BoletoRepository } from './boleto/domain/IBoletoRepository';

// ========================================================================
// IMPLEMENTAÇÕES CONCRETAS (INFRASTRUCTURE LAYER)
// ========================================================================
export { ProposalRepository as ProposalRepositoryImpl } from './proposal/infrastructure/ProposalRepository';
export { CcbRepository as CcbRepositoryImpl } from './ccb/infrastructure/CcbRepository';
export { BoletoRepository as BoletoRepositoryImpl } from './boleto/infrastructure/BoletoRepository';

// ========================================================================
// TIPOS COMPARTILHADOS
// ========================================================================
export type {
  PaginatedResult,
  CursorPaginationOptions,
  RepositoryFilters,
} from '@shared/types/pagination';

export { CursorUtils } from '@shared/types/pagination';

// ========================================================================
// STATUS TYPES
// ========================================================================
export type { CcbStatus } from './ccb/domain/ICcbRepository';
export type { BoletoStatus, FormaPagamento } from './boleto/domain/IBoletoRepository';
