import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithToken } from '@/lib/apiClient';

interface SystemMetadata {
  totalLojas: number;
}

interface Loja {
  id: number;
  parceiroId: number;
  nomeLoja: string;
  isActive: boolean;
}

interface UseLojaFilteringResult {
  filteredLojas: Loja[];
  isLoading: boolean;
  error: Error | null;
  filteringMode: 'client-side' | 'server-side';
}

const LOJA_THRESHOLD = 1000; // Threshold for switching between client-side and server-side filtering

export function useLojaFiltering(selectedParceiroId?: string | number): UseLojaFilteringResult {
  const [filteringMode, setFilteringMode] = useState<'client-side' | 'server-side'>('client-side');
  
  // Convert selectedParceiroId to number for consistency
  const parceiroId = typeof selectedParceiroId === 'string' 
    ? parseInt(selectedParceiroId) 
    : selectedParceiroId;

  // Query system metadata to determine filtering strategy
  const { data: metadata, isLoading: metadataLoading, error: metadataError } = useQuery<SystemMetadata>({
    queryKey: ['/api/admin/system/metadata'],
    queryFn: async () => {
      const response = await fetchWithToken('/api/admin/system/metadata');
      if (!response.ok) throw new Error('Failed to fetch metadata');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Determine filtering mode based on total lojas count
  useEffect(() => {
    if (metadata) {
      const mode = metadata.totalLojas <= LOJA_THRESHOLD ? 'client-side' : 'server-side';
      setFilteringMode(mode);
    }
  }, [metadata]);

  // Client-side filtering: fetch all lojas and filter in memory
  const { 
    data: allLojas, 
    isLoading: allLojasLoading, 
    error: allLojasError 
  } = useQuery<Loja[]>({
    queryKey: ['/api/lojas'],
    queryFn: async () => {
      const response = await fetchWithToken('/api/lojas');
      if (!response.ok) throw new Error('Failed to fetch lojas');
      return response.json();
    },
    enabled: filteringMode === 'client-side',
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  // Server-side filtering: fetch lojas by parceiro ID
  const { 
    data: parceiroLojas, 
    isLoading: parceiroLojasLoading, 
    error: parceiroLojasError 
  } = useQuery<Loja[]>({
    queryKey: ['/api/admin/parceiros', parceiroId, 'lojas'],
    queryFn: async () => {
      const response = await fetchWithToken(`/api/admin/parceiros/${parceiroId}/lojas`);
      if (!response.ok) throw new Error('Failed to fetch parceiro lojas');
      return response.json();
    },
    enabled: filteringMode === 'server-side' && !!parceiroId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Filter lojas based on the selected strategy
  const filteredLojas = useMemo(() => {
    if (filteringMode === 'client-side') {
      if (!allLojas) return [];
      
      // If no parceiro is selected, return all lojas
      if (!parceiroId) return allLojas;
      
      // Filter lojas by parceiro ID in memory
      return allLojas.filter(loja => loja.parceiroId === parceiroId);
    } else {
      // Server-side mode: return data from API or empty array
      return parceiroLojas || [];
    }
  }, [filteringMode, allLojas, parceiroLojas, parceiroId]);

  // Determine loading state based on current mode
  const isLoading = useMemo(() => {
    if (metadataLoading) return true;
    
    if (filteringMode === 'client-side') {
      return allLojasLoading;
    } else {
      return parceiroId ? parceiroLojasLoading : false;
    }
  }, [metadataLoading, filteringMode, allLojasLoading, parceiroLojasLoading, parceiroId]);

  // Determine error state
  const error = metadataError || allLojasError || parceiroLojasError || null;

  return {
    filteredLojas,
    isLoading,
    error,
    filteringMode,
  };
}