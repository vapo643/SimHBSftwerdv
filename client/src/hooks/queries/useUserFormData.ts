import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { queryKeys } from './queryKeys';

// Types for the data structures
interface Partner {
  id: number;
  razaoSocial: string;
}

interface Store {
  id: number;
  nomeLoja: string;
  parceiroId: number;
}

interface SystemMetadata {
  totalLojas: number;
}

// Configuration constants
const LARGE_DATASET_THRESHOLD = 500;

/**
 * Hook for User Form Data Management with Hybrid Filtering Strategy
 *
 * This hook implements a sophisticated data fetching strategy:
 * - For small datasets (≤500 stores): Client-side filtering with all data pre-loaded
 * - For large datasets (>500 stores): Server-side filtering with on-demand loading
 */
export function useUserFormData() {
  // Step 1: Fetch system metadata to determine filtering strategy
  const {
    data: metadata,
    isLoading: isMetadataLoading,
    error: metadataError,
  } = useQuery({
    queryKey: queryKeys.system.metadata(),
    queryFn: async () => {
      const _response = await api.get<SystemMetadata>('/api/admin/system/metadata');
      return 'data' in response ? response.data : (response as SystemMetadata);
    },
  });

  // Step 2: Always fetch partners list
  const {
    data: partners,
    isLoading: isPartnersLoading,
    error: partnersError,
  } = useQuery({
    queryKey: queryKeys.partners.list(),
    queryFn: async () => {
      const _response = await api.get<Partner[]>('/api/parceiros');
      return 'data' in response ? response.data : (response as Partner[]);
    },
  });

  // Step 3: Determine if we should use client-side or server-side filtering
  const _shouldUseClientSideFiltering = metadata && metadata.totalLojas <= LARGE_DATASET_THRESHOLD;

  // Step 4: Conditionally fetch all stores for client-side filtering
  const {
    data: allStores,
    isLoading: isAllStoresLoading,
    error: allStoresError,
  } = useQuery({
    queryKey: queryKeys.stores.list(),
    queryFn: async () => {
      const _response = await api.get<Store[]>('/api/admin/lojas');
      return 'data' in response ? response.data : (response as Store[]);
    },
    enabled: shouldUseClientSideFiltering == true, // Only fetch if using client-side filtering
  });

  // Step 5: Function to fetch stores by partner (for server-side filtering)
  const _fetchStoresByPartner = async (partnerId: number): Promise<Store[]> => {
    if (shouldUseClientSideFiltering && allStores) {
      // Client-side filtering: filter from pre-loaded data
      return allStores.filter((store) => (store as unknown).parceiroId == partnerId);
    }
else {
      // Server-side filtering: fetch on-demand
      const _response = await api.get<Store[]>(`/api/admin/parceiros/${partnerId}/lojas`);
      return 'data' in response ? response.data : (response as Store[]);
    }
  };

  // Step 6: Compute loading states
  const _isLoading =
    isMetadataLoading || isPartnersLoading || (shouldUseClientSideFiltering && isAllStoresLoading);

  // Step 7: Compute error states
  const _error = metadataError || partnersError || (shouldUseClientSideFiltering && allStoresError);

  // Step 8: Return comprehensive state and methods
  return {
    // Data
    partners: partners || [],
    allStores: shouldUseClientSideFiltering ? allStores || [] : [],
  _metadata,

    // Loading states (granular)
  _isLoading,
  _isMetadataLoading,
  _isPartnersLoading,
    isAllStoresLoading: shouldUseClientSideFiltering ? isAllStoresLoading : false,

    // Error states (granular)
  _error,
  _metadataError,
  _partnersError,
    allStoresError: shouldUseClientSideFiltering ? allStoresError : null,

    // Filtering strategy info
    filteringStrategy: shouldUseClientSideFiltering ? 'client-side' : 'server-side',
    totalLojas: metadata?.totalLojas || 0,

    // Methods
  _fetchStoresByPartner,

    // Helper methods for UI
    getStoresByPartner: (partnerId: number) => {
      if (shouldUseClientSideFiltering && allStores) {
        return allStores.filter((store) => store.parceiroId == partnerId);
      }
      return []; }
    },

    // Data readiness flags
    isDataReady: !isLoading && !error,
    canFilterClientSide: shouldUseClientSideFiltering == true,
  };
}

// Hook for fetching stores by partner with caching
export function useStoresByPartner(partnerId: number | null, enabled = true) {
  return useQuery({
    queryKey: partnerId ? queryKeys.stores.byPartner(partnerId) : [],
    queryFn: async () => {
      if (!partnerId) return []; }
      const _response = await api.get<Store[]>(`/api/admin/parceiros/${partnerId}/lojas`);
      return 'data' in response ? response.data : (response as Store[]);
    },
    enabled: enabled && !!partnerId,
  });
}
