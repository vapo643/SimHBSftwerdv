/**
 * Query Keys Factory - Hierarchical and Isolated Cache Keys
 * 
 * This factory provides standardized, hierarchical query keys to prevent
 * cache contamination between different data sources and enable precise
 * cache invalidation.
 */

export const queryKeys = {
  // Users queries
  users: {
    all: () => ['users'] as const,
    lists: () => [...queryKeys.users.all(), 'list'] as const,
    list: (filters?: Record<string, any>) => 
      [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all(), 'detail'] as const,
    detail: (id: number) => [...queryKeys.users.details(), id] as const,
    mutations: () => [...queryKeys.users.all(), 'mutations'] as const,
  },

  // Partners queries
  partners: {
    all: () => ['partners'] as const,
    lists: () => [...queryKeys.partners.all(), 'list'] as const,
    list: (filters?: Record<string, any>) => 
      [...queryKeys.partners.lists(), filters] as const,
    details: () => [...queryKeys.partners.all(), 'detail'] as const,
    detail: (id: number) => [...queryKeys.partners.details(), id] as const,
    mutations: () => [...queryKeys.partners.all(), 'mutations'] as const,
  },

  // Stores queries
  stores: {
    all: () => ['stores'] as const,
    lists: () => [...queryKeys.stores.all(), 'list'] as const,
    list: (filters?: Record<string, any>) => 
      [...queryKeys.stores.lists(), filters] as const,
    details: () => [...queryKeys.stores.all(), 'detail'] as const,
    detail: (id: number) => [...queryKeys.stores.details(), id] as const,
    mutations: () => [...queryKeys.stores.all(), 'mutations'] as const,
    // Relationship queries
    byPartner: (partnerId: number) => 
      [...queryKeys.stores.lists(), 'byPartner', partnerId] as const,
  },

  // System queries
  system: {
    all: () => ['system'] as const,
    metadata: () => [...queryKeys.system.all(), 'metadata'] as const,
    health: () => [...queryKeys.system.all(), 'health'] as const,
  },

  // Products queries
  products: {
    all: () => ['products'] as const,
    lists: () => [...queryKeys.products.all(), 'list'] as const,
    list: (filters?: Record<string, any>) => 
      [...queryKeys.products.lists(), filters] as const,
    details: () => [...queryKeys.products.all(), 'detail'] as const,
    detail: (id: number) => [...queryKeys.products.details(), id] as const,
    mutations: () => [...queryKeys.products.all(), 'mutations'] as const,
  },
} as const;

/**
 * Cache Invalidation Helpers
 * 
 * These utilities help with precise cache invalidation patterns
 */
export const cacheInvalidation = {
  // Invalidate all user-related queries
  invalidateAllUsers: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
  },

  // Invalidate all partner-related queries
  invalidateAllPartners: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.partners.all() });
  },

  // Invalidate all store-related queries
  invalidateAllStores: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.stores.all() });
  },

  // Invalidate stores by specific partner
  invalidateStoresByPartner: (queryClient: any, partnerId: number) => {
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.stores.byPartner(partnerId) 
    });
  },

  // Invalidate system metadata
  invalidateSystemMetadata: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.system.metadata() });
  },
} as const;