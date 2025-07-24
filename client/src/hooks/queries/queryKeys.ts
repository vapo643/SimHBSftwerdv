/**
 * Query Keys Factory for Hierarchical and Isolated Cache Management
 * 
 * This factory provides a centralized way to create consistent, hierarchical
 * query keys that enable precise cache invalidation and isolation.
 */

export const queryKeys = {
  // Users Query Keys
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.users.lists(), { filters }] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.users.details(), id] as const,
  },

  // Partners Query Keys
  partners: {
    all: ['partners'] as const,
    lists: () => [...queryKeys.partners.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.partners.lists(), { filters }] as const,
    details: () => [...queryKeys.partners.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.partners.details(), id] as const,
  },

  // Stores Query Keys
  stores: {
    all: ['stores'] as const,
    lists: () => [...queryKeys.stores.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.stores.lists(), { filters }] as const,
    details: () => [...queryKeys.stores.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.stores.details(), id] as const,
    byPartner: (partnerId: number) => [...queryKeys.stores.all, 'byPartner', partnerId] as const,
  },

  // System Metadata Query Keys
  system: {
    all: ['system'] as const,
    metadata: () => [...queryKeys.system.all, 'metadata'] as const,
  },
} as const;

// Type helpers for type-safe query key usage
export type UserQueryKey = ReturnType<typeof queryKeys.users[keyof typeof queryKeys.users]>;
export type PartnerQueryKey = ReturnType<typeof queryKeys.partners[keyof typeof queryKeys.partners]>;
export type StoreQueryKey = ReturnType<typeof queryKeys.stores[keyof typeof queryKeys.stores]>;
export type SystemQueryKey = ReturnType<typeof queryKeys.system[keyof typeof queryKeys.system]>;