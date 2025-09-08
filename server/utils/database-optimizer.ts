/**
 * Database Query Optimizer - PAM V4.0
 * Optimized queries for critical endpoints performance
 *
 * Replaces in-memory operations with efficient SQL aggregations
 */

import { createServerSupabaseAdminClient } from '../lib/supabase';
import { CachedQueries } from '../lib/cache-manager';

interface DashboardStats {
  totalPropostas: number;
  aguardandoAnalise: number;
  aprovadas: number;
  valorTotal: number;
}

interface ProposalListQuery {
  status?: string;
  lojaId?: number;
  userId?: number;
  limit?: number;
  offset?: number;
}

/**
 * Optimized dashboard stats query - uses SQL aggregation + Redis caching
 */
export async function getDashboardStatsOptimized(): Promise<DashboardStats> {
  // Use cache-aside pattern with 5-minute TTL
  return await CachedQueries.getDashboardStats(async () => {
    const supabase = createServerSupabaseAdminClient();

    try {
      // Single query with aggregations - much more efficient than loading all data
      const { data, error } = await supabase.rpc('get_dashboard_stats_optimized');

      if (error) {
        console.error('[DATABASE_OPTIMIZER] Dashboard stats error:', error);
        // Fallback to basic query if RPC not available
        return await getDashboardStatsFallback();
      }

      return data[0] as DashboardStats;
    } catch (error) {
      console.error('[DATABASE_OPTIMIZER] Dashboard stats failed, using fallback:', error);
      return await getDashboardStatsFallback();
    }
  });
}

/**
 * Fallback dashboard stats using individual queries with COUNT
 */
async function getDashboardStatsFallback(): Promise<DashboardStats> {
  const supabase = createServerSupabaseAdminClient();

  // Execute all queries in parallel for better performance
  const [totalResult, aguardandoResult, aprovadasResult, valorResult] = await Promise.all([
    // Total proposals count
    supabase.from('propostas').select('*', { count: 'exact', head: true }),

    // Waiting for analysis count
    supabase
      .from('propostas')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'aguardando_analise'),

    // Approved count
    supabase.from('propostas').select('*', { count: 'exact', head: true }).eq('status', 'aprovado'),

    // Total value sum
    supabase.from('propostas').select('valor.sum()').single(),
  ]);

  // Handle potential errors
  if (totalResult.error) throw totalResult.error;
  if (aguardandoResult.error) throw aguardandoResult.error;
  if (aprovadasResult.error) throw aprovadasResult.error;
  if (valorResult.error) throw valorResult.error;

  return {
    totalPropostas: totalResult.count || 0,
    aguardandoAnalise: aguardandoResult.count || 0,
    aprovadas: aprovadasResult.count || 0,
    valorTotal: valorResult.data?.sum || 0,
  };
}

/**
 * Optimized proposals list with pagination and filtering
 */
export async function getPropostasOptimized(query: ProposalListQuery = {}): Promise<{
  data: any[];
  count: number;
  hasMore: boolean;
}> {
  const supabase = createServerSupabaseAdminClient();
  const { status, lojaId, userId, limit = 50, offset = 0 } = query;

  let queryBuilder = supabase
    .from('propostas')
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  // Apply filters efficiently
  if (status) {
    queryBuilder = queryBuilder.eq('status', status);
  }

  if (lojaId) {
    queryBuilder = queryBuilder.eq('loja_id', lojaId);
  }

  if (userId) {
    queryBuilder = queryBuilder.eq('user_id', userId);
  }

  const { data, error, count } = await queryBuilder;

  if (error) {
    throw new Error(`Failed to fetch proposals: ${error.message}`);
  }

  return {
    data: data || [],
    count: count || 0,
    hasMore: offset + limit < (count || 0),
  };
}

/**
 * Get proposal by ID with minimal data fetch
 */
export async function getProposalByIdOptimized(id: string | number): Promise<any> {
  const supabase = createServerSupabaseAdminClient();

  const { data, error } = await supabase.from('propostas').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Proposal not found');
    }
    throw new Error(`Failed to fetch proposal: ${error.message}`);
  }

  return data;
}

/**
 * SQL function for dashboard stats (to be created in database)
 * This would be implemented as a PostgreSQL function for maximum performance
 */
export const DASHBOARD_STATS_SQL_FUNCTION = `
CREATE OR REPLACE FUNCTION get_dashboard_stats_optimized()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalPropostas', (SELECT COUNT(*) FROM propostas),
        'aguardandoAnalise', (SELECT COUNT(*) FROM propostas WHERE status = 'aguardando_analise'),
        'aprovadas', (SELECT COUNT(*) FROM propostas WHERE status = 'aprovado'),
        'valorTotal', COALESCE((SELECT SUM(valor::numeric) FROM propostas), 0)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;
`;

/**
 * Performance monitoring for database queries
 */
export async function executeWithPerformanceMonitoring<T>(
  queryName: string,
  queryFunction: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await queryFunction();
    const duration = performance.now() - startTime;

    if (duration > 100) {
      // Log slow queries (>100ms)
      console.log(`[DATABASE_OPTIMIZER] Slow query detected: ${queryName}`, {
        duration: Math.round(duration),
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[DATABASE_OPTIMIZER] Query failed: ${queryName}`, {
      duration: Math.round(duration),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
