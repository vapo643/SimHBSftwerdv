/**
 * Monitoring Repository
 * Handles database monitoring operations
 * PAM V1.0 - Repository pattern implementation
 */

import { db } from '../lib/supabase.js';
import { sql } from 'drizzle-orm';

export class MonitoringRepository {
  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT 
          pg_database_size(current_database()) as database_size,
          (SELECT count(*) FROM pg_stat_activity) as active_connections,
          (SELECT count(*) FROM pg_stat_user_tables) as table_count,
          (SELECT sum(n_live_tup) FROM pg_stat_user_tables) as total_rows
      `);
      return result[0];
    } catch (error) {
      console.error('[MONITORING_REPO] Error fetching database stats:', error);
      throw error;
    }
  }

  /**
   * Get table statistics
   */
  async getTableStats(): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          n_live_tup as row_count,
          n_dead_tup as dead_rows,
          last_vacuum,
          last_autovacuum,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `);
      return result;
    } catch (error) {
      console.error('[MONITORING_REPO] Error fetching table stats:', error);
      throw error;
    }
  }

  /**
   * Get index usage statistics
   */
  async getIndexUsage(): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as index_scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched,
          pg_size_pretty(pg_relation_size(indexrelid)) as index_size
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
      `);
      return result;
    } catch (error) {
      console.error('[MONITORING_REPO] Error fetching index usage:', error);
      throw error;
    }
  }

  /**
   * Get active database connections
   */
  async getActiveConnections(): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          pid,
          usename,
          application_name,
          client_addr,
          backend_start,
          state,
          state_change,
          query
        FROM pg_stat_activity
        WHERE state != 'idle'
        ORDER BY backend_start DESC
      `);
      return result;
    } catch (error) {
      console.error('[MONITORING_REPO] Error fetching connections:', error);
      throw error;
    }
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth(): Promise<{
    isHealthy: boolean;
    checks: any;
  }> {
    try {
      const checks: any = {
        connection: false,
        tableAccess: false,
        writePermission: false,
      };

      // Check connection
      await db.execute(sql`SELECT 1`);
      checks.connection = true;

      // Check table access
      await db.execute(sql`SELECT count(*) FROM propostas`);
      checks.tableAccess = true;

      // Check write permission (rollback transaction)
      await db.execute(sql`
        BEGIN;
        INSERT INTO propostaLogs (proposta_id, acao, descricao) 
        VALUES (0, 'health_check', 'test');
        ROLLBACK;
      `);
      checks.writePermission = true;

      const isHealthy = Object.values(checks).every((check) => check === true);

      return { isHealthy, checks };
    } catch (error) {
      console.error('[MONITORING_REPO] Database health check failed:', error);
      return {
        isHealthy: false,
        checks: { error: error.message },
      };
    }
  }

  /**
   * Generate monitoring report
   */
  async generateReport(): Promise<any> {
    try {
      const [stats, tables, indexes, connections, health] = await Promise.all([
        this.getDatabaseStats(),
        this.getTableStats(),
        this.getIndexUsage(),
        this.getActiveConnections(),
        this.checkDatabaseHealth(),
      ]);

      return {
        timestamp: new Date().toISOString(),
        database: stats,
        tables: tables.slice(0, 10), // Top 10 tables
        indexes: indexes.slice(0, 10), // Top 10 indexes
        activeConnections: connections.length,
        health,
      };
    } catch (error) {
      console.error('[MONITORING_REPO] Error generating report:', error);
      throw error;
    }
  }
}

export const monitoringRepository = new MonitoringRepository();
