
/**
 * Form Dependencies Hook - Isolated Data Fetching
 * 
 * This hook provides form-specific data fetching with proper isolation
 * and caching strategies, preventing cross-page dependencies.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { PARCEIRO_QUERIES, LOJA_QUERIES } from "./queryKeys";

export interface FormDependencies {
  parceiros: {
    data: any[] | undefined;
    isLoading: boolean;
    error: any;
  };
  lojas: {
    data: any[] | undefined;
    isLoading: boolean;
    error: any;
  };
  isReady: boolean;
}

/**
 * Hook for UserForm dependencies
 */
export function useUserFormDependencies(): FormDependencies {
  const parceiros = useQuery({
    queryKey: PARCEIRO_QUERIES.listsForForm(),
    queryFn: () => api.get('/api/parceiros'),
    staleTime: 10 * 60 * 1000, // 10 minutes cache for reference data
    retry: 2,
  });
  
  const lojas = useQuery({
    queryKey: LOJA_QUERIES.listsForForm(),
    queryFn: () => api.get('/api/admin/lojas'),
    staleTime: 10 * 60 * 1000, // 10 minutes cache for reference data
    enabled: !!parceiros.data, // Only load after parceiros are ready
    retry: 2,
  });

  return {
    parceiros: {
      data: parceiros.data?.data,
      isLoading: parceiros.isLoading,
      error: parceiros.error,
    },
    lojas: {
      data: lojas.data?.data,
      isLoading: lojas.isLoading,
      error: lojas.error,
    },
    isReady: !parceiros.isLoading && !lojas.isLoading && !parceiros.error && !lojas.error,
  };
}

/**
 * Hook for PropostaForm dependencies  
 */
export function usePropostaFormDependencies(): FormDependencies {
  const parceiros = useQuery({
    queryKey: PARCEIRO_QUERIES.listsForForm(),
    queryFn: () => api.get('/api/parceiros'),
    staleTime: 10 * 60 * 1000,
  });
  
  const lojas = useQuery({
    queryKey: LOJA_QUERIES.listsForForm(),
    queryFn: () => api.get('/api/admin/lojas'),
    staleTime: 10 * 60 * 1000,
  });

  return {
    parceiros: {
      data: parceiros.data?.data,
      isLoading: parceiros.isLoading,
      error: parceiros.error,
    },
    lojas: {
      data: lojas.data?.data,
      isLoading: lojas.isLoading,
      error: lojas.error,
    },
    isReady: !parceiros.isLoading && !lojas.isLoading,
  };
}
