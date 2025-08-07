/**
 * Utilitários de Monitoramento do Banco de Dados
 * Queries para análise de performance e saúde do sistema
 */

import { db } from '../lib/supabase';
import { sql } from 'drizzle-orm';

/**
 * Retorna estatísticas gerais do banco
 */
export async function getDatabaseStats() {
  try {
    const stats = await db.execute(sql`
      SELECT 
        current_database() as database_name,
        pg_database_size(current_database()) as database_size,
        pg_size_pretty(pg_database_size(current_database())) as database_size_pretty,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity) as total_connections,
        (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables,
        current_timestamp as checked_at
    `);
    
    return stats[0];
  } catch (error) {
    console.error('Erro ao buscar estatísticas do banco:', error);
    throw error;
  }
}

/**
 * Retorna as queries mais lentas
 */
export async function getSlowQueries(limit = 10) {
  try {
    const queries = await db.execute(sql`
      SELECT 
        calls,
        total_exec_time,
        mean_exec_time,
        max_exec_time,
        min_exec_time,
        stddev_exec_time,
        LEFT(query, 100) as query_preview
      FROM pg_stat_statements
      WHERE query NOT LIKE '%pg_%'
        AND query NOT LIKE '%information_schema%'
      ORDER BY mean_exec_time DESC
      LIMIT ${limit}
    `);
    
    return queries;
  } catch (error) {
    // pg_stat_statements pode não estar habilitado
    console.warn('pg_stat_statements não disponível');
    return [];
  }
}

/**
 * Retorna estatísticas das tabelas principais
 */
export async function getTableStats() {
  try {
    const stats = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows,
        n_mod_since_analyze as modifications_since_analyze,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);
    
    return stats;
  } catch (error) {
    console.error('Erro ao buscar estatísticas das tabelas:', error);
    throw error;
  }
}

/**
 * Retorna uso de índices
 */
export async function getIndexUsage() {
  try {
    const usage = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan as index_scans,
        idx_tup_read as tuples_read_via_index,
        idx_tup_fetch as tuples_fetched_via_index,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC
    `);
    
    return usage;
  } catch (error) {
    console.error('Erro ao buscar uso de índices:', error);
    throw error;
  }
}

/**
 * Retorna conexões ativas
 */
export async function getActiveConnections() {
  try {
    const connections = await db.execute(sql`
      SELECT 
        pid,
        usename,
        application_name,
        client_addr,
        state,
        query_start,
        state_change,
        wait_event_type,
        wait_event,
        CASE 
          WHEN state = 'active' THEN 
            EXTRACT(EPOCH FROM (now() - query_start))::integer
          ELSE NULL 
        END as query_duration_seconds,
        LEFT(query, 200) as current_query
      FROM pg_stat_activity
      WHERE state != 'idle'
        AND pid != pg_backend_pid()
      ORDER BY query_start DESC
    `);
    
    return connections;
  } catch (error) {
    console.error('Erro ao buscar conexões ativas:', error);
    throw error;
  }
}

/**
 * Verifica saúde geral do banco
 */
export async function checkDatabaseHealth() {
  try {
    const health = {
      status: 'healthy',
      issues: [] as string[],
      metrics: {} as any
    };
    
    // Verificar conexões
    const connStats = await db.execute(sql`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity) as total,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_allowed
    `);
    
    const conn = connStats[0] as any;
    health.metrics.connections = conn;
    
    if (conn.total > conn.max_allowed * 0.8) {
      health.issues.push(`Alto número de conexões: ${conn.total}/${conn.max_allowed}`);
      health.status = 'warning';
    }
    
    // Verificar bloat das tabelas
    const bloat = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        n_dead_tup,
        n_live_tup,
        ROUND(n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100, 2) as dead_ratio
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND n_dead_tup > 1000
        AND n_live_tup > 0
      ORDER BY dead_ratio DESC
    `);
    
    health.metrics.table_bloat = bloat;
    
    for (const table of bloat as any[]) {
      if (table.dead_ratio > 20) {
        health.issues.push(`Tabela ${table.tablename} com ${table.dead_ratio}% de linhas mortas`);
        if (table.dead_ratio > 50) {
          health.status = 'critical';
        } else if (health.status !== 'critical') {
          health.status = 'warning';
        }
      }
    }
    
    // Verificar queries longas
    const longQueries = await db.execute(sql`
      SELECT count(*) as count
      FROM pg_stat_activity
      WHERE state = 'active'
        AND query_start < now() - interval '5 minutes'
    `);
    
    const longCount = (longQueries[0] as any).count;
    if (longCount > 0) {
      health.issues.push(`${longCount} queries rodando há mais de 5 minutos`);
      health.status = 'warning';
    }
    
    return health;
  } catch (error) {
    console.error('Erro ao verificar saúde do banco:', error);
    return {
      status: 'error',
      issues: ['Erro ao verificar saúde do banco'],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Gera relatório completo de monitoramento
 */
export async function generateMonitoringReport() {
  try {
    const [
      dbStats,
      tableStats,
      indexUsage,
      activeConnections,
      health
    ] = await Promise.all([
      getDatabaseStats(),
      getTableStats(),
      getIndexUsage(),
      getActiveConnections(),
      checkDatabaseHealth()
    ]);
    
    return {
      timestamp: new Date().toISOString(),
      database: dbStats,
      tables: tableStats,
      indexes: indexUsage,
      connections: activeConnections,
      health: health
    };
  } catch (error) {
    console.error('Erro ao gerar relatório de monitoramento:', error);
    throw error;
  }
}