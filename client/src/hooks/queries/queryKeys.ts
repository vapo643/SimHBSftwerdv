/**
 * Query Keys Factory - Hierarchical and Isolated Query Key Management
 *
 * This factory provides consistent, hierarchical query keys for TanStack Query
 * with proper invalidation patterns and cache isolation.
 */

export const queryKeys = {
  // Users query keys hierarchy
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.users.lists(), { filters }] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.users.details(), id] as const,
    withDetails: () => [...queryKeys.users.all, 'withDetails'] as const,
  },

  // Partners query keys hierarchy
  partners: {
    all: ['partners'] as const,
    lists: () => [...queryKeys.partners.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.partners.lists(), { filters }] as const,
    details: () => [...queryKeys.partners.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.partners.details(), id] as const,
  },

  // Stores query keys hierarchy
  stores: {
    all: ['stores'] as const,
    lists: () => [...queryKeys.stores.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.stores.lists(), { filters }] as const,
    details: () => [...queryKeys.stores.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.stores.details(), id] as const,
    byPartner: (partnerId: string | number) =>
      [...queryKeys.stores.all, 'byPartner', partnerId] as const,
  },

  // System metadata query keys
  system: {
    all: ['system'] as const,
    metadata: () => [...queryKeys.system.all, 'metadata'] as const,
    health: () => [...queryKeys.system.all, 'health'] as const,
  },

  // Products query keys
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.products.lists(), { filters }] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.products.details(), id] as const,
  },

  // Proposals query keys - Enhanced with all patterns used across the app
  propostas: {
    all: ['propostas'] as const,
    lists: () => [...queryKeys.propostas.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.propostas.lists(), { filters }] as const,
    byStatus: (status: string) => [...queryKeys.propostas.all, 'byStatus', status] as const,
    formalizacao: () => [...queryKeys.propostas.all, 'formalizacao'] as const,
    analise: () => [...queryKeys.propostas.all, 'analise'] as const,
    aguardandoAceite: () => [...queryKeys.propostas.all, 'aguardando-aceite'] as const,
  },

  // Individual proposal query keys
  proposta: {
    all: (id: string | number) => ['proposta', id] as const,
    historico: (id: string | number) => ['proposta', 'historico', id] as const,
    formalizacao: (id: string | number) => ['proposta', id, 'formalizacao'] as const,
    observacoes: (id: string | number) => ['proposta', id, 'observacoes'] as const,
    logs: (id: string | number) => ['proposta', 'logs', id] as const,
  },

  // External integrations
  inter: {
    all: ['inter'] as const,
    collections: (id: string | number) => ['inter', 'collections', id] as const,
  },

  clicksign: {
    all: ['clicksign'] as const,
    status: (id: string | number) => ['clicksign', 'status', id] as const,
  },

  // Financial operations
  pagamentos: {
    all: ['pagamentos'] as const,
    lists: () => [...queryKeys.pagamentos.all, 'list'] as const,
  },

  cobrancas: {
    all: ['cobrancas'] as const,
    lists: () => [...queryKeys.cobrancas.all, 'list'] as const,
    kpis: () => [...queryKeys.cobrancas.all, 'kpis'] as const,
    solicitacoes: () => [...queryKeys.cobrancas.all, 'solicitacoes'] as const,
    ficha: (id: string | number) => ['cobrancas', 'ficha', id] as const,
    interSumario: () => [...queryKeys.cobrancas.all, 'inter-sumario'] as const,
  },

  // Security and monitoring
  security: {
    all: ['security'] as const,
    metrics: () => [...queryKeys.security.all, 'metrics'] as const,
    vulnerabilities: () => [...queryKeys.security.all, 'vulnerabilities'] as const,
    anomalies: () => [...queryKeys.security.all, 'anomalies'] as const,
    dependencyScan: () => [...queryKeys.security.all, 'dependency-scan'] as const,
    semgrepFindings: () => [...queryKeys.security.all, 'semgrep-findings'] as const,
  },

  // Legacy support (for backwards compatibility)
  proposals: {
    all: ['proposals'] as const,
    lists: () => [...queryKeys.proposals.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.proposals.lists(), { filters }] as const,
    details: () => [...queryKeys.proposals.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.proposals.details(), id] as const,
    byStatus: (status: string) => [...queryKeys.proposals.all, 'byStatus', status] as const,
  },
} as const;

/**
 * Cache invalidation helpers
 *
 * These functions provide convenient ways to invalidate related caches
 * when mutations occur.
 */
export const invalidationPatterns = {
  // When a user is created/updated/deleted
  onUserChange: [
    queryKeys.users.all,
    queryKeys.partners.all, // Partners might have user associations
    queryKeys.stores.all, // Stores might have user associations
  ],

  // When a partner is created/updated/deleted
  onPartnerChange: [
    queryKeys.partners.all,
    queryKeys.stores.all, // Stores belong to partners
    queryKeys.users.all, // Users might be associated with partners
  ],

  // When a store is created/updated/deleted
  onStoreChange: [
    queryKeys.stores.all,
    queryKeys.users.all, // Users might be associated with stores
    queryKeys.partners.all, // Store changes might affect partner data
  ],

  // When system metadata changes
  onSystemChange: [queryKeys.system.all],

  // When a proposta is created/updated/deleted
  onPropostaChange: [
    queryKeys.propostas.all,
    queryKeys.pagamentos.all, // Propostas might affect payments
    queryKeys.cobrancas.all, // Propostas might affect collections
  ],

  // When proposta status changes
  onPropostaStatusChange: (id: string | number) => [
    queryKeys.proposta.all(id),
    queryKeys.proposta.historico(id),
    queryKeys.proposta.logs(id),
    queryKeys.propostas.all,
    queryKeys.propostas.formalizacao(),
    queryKeys.propostas.analise(),
  ],

  // When formalizacao process changes
  onFormalizacaoChange: (id: string | number) => [
    queryKeys.proposta.all(id),
    queryKeys.proposta.formalizacao(id),
    queryKeys.propostas.formalizacao(),
    queryKeys.clicksign.status(id),
    queryKeys.inter.collections(id),
  ],

  // When financial operations change
  onPaymentChange: [
    queryKeys.pagamentos.all,
    queryKeys.cobrancas.all,
    queryKeys.cobrancas.kpis(),
  ],
} as const;
