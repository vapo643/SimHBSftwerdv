
/**
 * Query Key Factory - Isolated Query Keys Pattern
 * 
 * This factory ensures deterministic, isolated query keys that prevent
 * cross-page cache dependencies and enable proper invalidation strategies.
 * 
 * @version 1.0.0 - Phase 1: Stabilization
 */

// Base query key structure for type safety
type QueryKeyBase = readonly string[];

// User query keys factory
export const USER_QUERIES = {
  all: () => ['users'] as const,
  lists: () => [...USER_QUERIES.all(), 'list'] as const,
  list: (filters?: { role?: string; status?: string }) => 
    [...USER_QUERIES.lists(), filters || {}] as const,
  details: () => [...USER_QUERIES.all(), 'detail'] as const,
  detail: (id: number | string) => [...USER_QUERIES.details(), id] as const,
  formDependencies: () => [...USER_QUERIES.all(), 'form-deps'] as const,
} as const;

// Parceiro query keys factory
export const PARCEIRO_QUERIES = {
  all: () => ['parceiros'] as const,
  lists: () => [...PARCEIRO_QUERIES.all(), 'list'] as const,
  list: (filters?: { status?: string }) => 
    [...PARCEIRO_QUERIES.lists(), filters || {}] as const,
  details: () => [...PARCEIRO_QUERIES.all(), 'detail'] as const,
  detail: (id: number | string) => [...PARCEIRO_QUERIES.details(), id] as const,
  listsForForm: () => [...PARCEIRO_QUERIES.all(), 'form-list'] as const,
} as const;

// Loja query keys factory
export const LOJA_QUERIES = {
  all: () => ['lojas'] as const,
  lists: () => [...LOJA_QUERIES.all(), 'list'] as const,
  list: (filters?: { parceiroId?: number; status?: string }) => 
    [...LOJA_QUERIES.lists(), filters || {}] as const,
  details: () => [...LOJA_QUERIES.all(), 'detail'] as const,
  detail: (id: number | string) => [...LOJA_QUERIES.details(), id] as const,
  listsForForm: () => [...LOJA_QUERIES.all(), 'form-list'] as const,
  byParceiro: (parceiroId: number) => 
    [...LOJA_QUERIES.all(), 'by-parceiro', parceiroId] as const,
} as const;

// Proposta query keys factory
export const PROPOSTA_QUERIES = {
  all: () => ['propostas'] as const,
  lists: () => [...PROPOSTA_QUERIES.all(), 'list'] as const,
  list: (filters?: { status?: string; lojaId?: number }) => 
    [...PROPOSTA_QUERIES.lists(), filters || {}] as const,
  details: () => [...PROPOSTA_QUERIES.all(), 'detail'] as const,
  detail: (id: number | string) => [...PROPOSTA_QUERIES.details(), id] as const,
  byStatus: (status: string) => 
    [...PROPOSTA_QUERIES.all(), 'by-status', status] as const,
} as const;

// Dashboard stats query keys factory
export const DASHBOARD_QUERIES = {
  all: () => ['dashboard'] as const,
  stats: () => [...DASHBOARD_QUERIES.all(), 'stats'] as const,
  metadata: () => [...DASHBOARD_QUERIES.all(), 'metadata'] as const,
} as const;

// System query keys factory
export const SYSTEM_QUERIES = {
  all: () => ['system'] as const,
  health: () => [...SYSTEM_QUERIES.all(), 'health'] as const,
  schemaHealth: () => [...SYSTEM_QUERIES.all(), 'schema-health'] as const,
  serverTime: () => [...SYSTEM_QUERIES.all(), 'server-time'] as const,
} as const;

// Query invalidation utilities
export const QueryInvalidations = {
  // Invalidate all user-related queries
  invalidateUsers: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: USER_QUERIES.all() });
  },
  
  // Invalidate all parceiro-related queries
  invalidateParceiros: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: PARCEIRO_QUERIES.all() });
  },
  
  // Invalidate all loja-related queries
  invalidateLojas: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: LOJA_QUERIES.all() });
  },
  
  // Invalidate specific loja queries by parceiro
  invalidateLojasByParceiro: (queryClient: any, parceiroId: number) => {
    queryClient.invalidateQueries({ 
      queryKey: LOJA_QUERIES.byParceiro(parceiroId) 
    });
  },
  
  // Invalidate all proposta-related queries
  invalidatePropostas: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: PROPOSTA_QUERIES.all() });
  },
  
  // Invalidate dashboard stats
  invalidateDashboard: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERIES.all() });
  },
} as const;

// Type exports for use in components
export type UserQueryKeys = typeof USER_QUERIES;
export type ParceiroQueryKeys = typeof PARCEIRO_QUERIES;
export type LojaQueryKeys = typeof LOJA_QUERIES;
export type PropostaQueryKeys = typeof PROPOSTA_QUERIES;
export type DashboardQueryKeys = typeof DASHBOARD_QUERIES;
export type SystemQueryKeys = typeof SYSTEM_QUERIES;
