/**
 * Query Keys Factory - Hierarchical and Isolated Query Key Management
 *
 * This factory provides consistent, hierarchical query keys for TanStack Query
 * with proper invalidation patterns and cache isolation.
 */

export const _queryKeys = {
  // Users query keys hierarchy
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.users.lists(), { filters }] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id) => [...queryKeys.users.details(), id] as const,
    withDetails: () => [...queryKeys.users.all, 'withDetails'] as const,
  },

  // Partners query keys hierarchy
  partners: {
    all: ['partners'] as const,
    lists: () => [...queryKeys.partners.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.partners.lists(), { filters }] as const,
    details: () => [...queryKeys.partners.all, 'detail'] as const,
    detail: (id) => [...queryKeys.partners.details(), id] as const,
  },

  // Stores query keys hierarchy
  stores: {
    all: ['stores'] as const,
    lists: () => [...queryKeys.stores.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.stores.lists(), { filters }] as const,
    details: () => [...queryKeys.stores.all, 'detail'] as const,
    detail: (id) => [...queryKeys.stores.details(), id] as const,
    byPartner: (partnerId) => [...queryKeys.stores.all, 'byPartner', partnerId] as const,
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
    detail: (id) => [...queryKeys.products.details(), id] as const,
  },

  // Proposals query keys
  proposals: {
    all: ['proposals'] as const,
    lists: () => [...queryKeys.proposals.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.proposals.lists(), { filters }] as const,
    details: () => [...queryKeys.proposals.all, 'detail'] as const,
    detail: (id) => [...queryKeys.proposals.details(), id] as const,
    byStatus: (status: string) => [...queryKeys.proposals.all, 'byStatus', status] as const,
  },
} as const;

/**
 * Cache invalidation helpers
 *
 * These functions provide convenient ways to invalidate related caches
 * when mutations occur.
 */
export const _invalidationPatterns = {
  // When a user is created/updated/deleted
  onUserChange: [
    queryKeys.users.all,
    queryKeys.partners.all, // Partners might have user _associations
    queryKeys.stores.all, // Stores might have user _associations
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
} as const;
