/**
 * Hook for field positioner functionality
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface FieldPosition {
  id: string;
  name: string;
  x: number;
  y: number;
  fontSize: number;
  bold: boolean;
  align: 'left' | 'center' | 'right';
  page: number;
  sampleText: string;
  maxWidth?: number;
}

export function useFieldPositioner() {
  const queryClient = useQueryClient();

  // Load existing positions
  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['/api/field-positioner/load-positions'],
    select: (data: any) => data.positions || []
  });

  // Save positions mutation
  const savePositionsMutation = useMutation({
    mutationFn: async (positions: FieldPosition[]) => {
      const response = await fetch('/api/field-positioner/save-positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ positions }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save positions');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/field-positioner/load-positions']
      });
    }
  });

  return {
    positions,
    isLoading,
    savePositions: savePositionsMutation.mutateAsync,
    isSaving: savePositionsMutation.isPending,
    saveError: savePositionsMutation.error
  };
}