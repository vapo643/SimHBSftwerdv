/**
 * Monitoring Service
 * Business logic for database monitoring
 * PAM V1.0 - Service layer implementation
 */

import { monitoringRepository } from "../repositories/monitoring.repository.js";

export class MonitoringService {
  /**
   * Get database statistics with formatting
   */
  async getDatabaseStats(): Promise<any> {
    try {
      const stats = await monitoringRepository.getDatabaseStats();
      
      return {
        databaseSize: this.formatBytes(stats.database_size),
        activeConnections: parseInt(stats.active_connections),
        tableCount: parseInt(stats.table_count),
        totalRows: parseInt(stats.total_rows),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("[MONITORING_SERVICE] Error fetching database stats:", error);
      throw new Error("Failed to fetch database statistics");
    }
  }

  /**
   * Get table statistics with analysis
   */
  async getTableStats(): Promise<any[]> {
    try {
      const tables = await monitoringRepository.getTableStats();
      
      return tables.map(table => ({
        schema: table.schemaname,
        table: table.tablename,
        rowCount: parseInt(table.row_count || 0),
        deadRows: parseInt(table.dead_rows || 0),
        lastVacuum: table.last_vacuum,
        lastAutoVacuum: table.last_autovacuum,
        totalSize: table.total_size,
        needsVacuum: parseInt(table.dead_rows || 0) > parseInt(table.row_count || 0) * 0.1,
      }));
    } catch (error: any) {
      console.error("[MONITORING_SERVICE] Error fetching table stats:", error);
      throw new Error("Failed to fetch table statistics");
    }
  }

  /**
   * Get index usage analysis
   */
  async getIndexUsage(): Promise<any[]> {
    try {
      const indexes = await monitoringRepository.getIndexUsage();
      
      return indexes.map(index => ({
        schema: index.schemaname,
        table: index.tablename,
        index: index.indexname,
        scans: parseInt(index.index_scans || 0),
        tuplesRead: parseInt(index.tuples_read || 0),
        tuplesFetched: parseInt(index.tuples_fetched || 0),
        size: index.index_size,
        efficiency: this.calculateIndexEfficiency(index),
      }));
    } catch (error: any) {
      console.error("[MONITORING_SERVICE] Error fetching index usage:", error);
      throw new Error("Failed to fetch index usage");
    }
  }

  /**
   * Get active connections with categorization
   */
  async getActiveConnections(): Promise<{
    total: number;
    connections: any[];
    byState: any;
    byApplication: any;
  }> {
    try {
      const connections = await monitoringRepository.getActiveConnections();
      
      // Categorize by state
      const byState = connections.reduce((acc, conn) => {
        acc[conn.state] = (acc[conn.state] || 0) + 1;
        return acc;
      }, {} as any);

      // Categorize by application
      const byApplication = connections.reduce((acc, conn) => {
        const app = conn.application_name || "unknown";
        acc[app] = (acc[app] || 0) + 1;
        return acc;
      }, {} as any);

      return {
        total: connections.length,
        connections: connections.map(conn => ({
          pid: conn.pid,
          user: conn.usename,
          application: conn.application_name,
          clientAddress: conn.client_addr,
          startTime: conn.backend_start,
          state: conn.state,
          stateChangeTime: conn.state_change,
          currentQuery: conn.query?.substring(0, 100), // Truncate for safety
        })),
        byState,
        byApplication,
      };
    } catch (error: any) {
      console.error("[MONITORING_SERVICE] Error fetching connections:", error);
      throw new Error("Failed to fetch active connections");
    }
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    checks: any;
    recommendations: string[];
  }> {
    try {
      const health = await monitoringRepository.checkDatabaseHealth();
      const stats = await monitoringRepository.getDatabaseStats();
      
      const recommendations: string[] = [];
      let status: "healthy" | "degraded" | "unhealthy" = "healthy";

      // Check connection count
      if (parseInt(stats.active_connections) > 50) {
        status = "degraded";
        recommendations.push("High number of active connections detected");
      }

      // Check database size (warn if > 1GB)
      if (parseInt(stats.database_size) > 1073741824) {
        recommendations.push("Database size exceeds 1GB, consider cleanup");
      }

      if (!health.isHealthy) {
        status = "unhealthy";
        recommendations.push("Database health check failed");
      }

      return {
        status,
        checks: health.checks,
        recommendations,
      };
    } catch (error: any) {
      console.error("[MONITORING_SERVICE] Health check failed:", error);
      return {
        status: "unhealthy",
        checks: { error: error.message },
        recommendations: ["Database connection failed"],
      };
    }
  }

  /**
   * Generate comprehensive monitoring report
   */
  async generateReport(): Promise<any> {
    try {
      const report = await monitoringRepository.generateReport();
      
      // Add analysis and recommendations
      const analysis = {
        databaseSize: this.formatBytes(report.database.database_size),
        performance: this.analyzePerformance(report),
        recommendations: this.generateRecommendations(report),
      };

      return {
        ...report,
        analysis,
      };
    } catch (error: any) {
      console.error("[MONITORING_SERVICE] Error generating report:", error);
      throw new Error("Failed to generate monitoring report");
    }
  }

  /**
   * Helper: Format bytes to human readable
   */
  private formatBytes(bytes: string | number): string {
    const size = typeof bytes === "string" ? parseInt(bytes) : bytes;
    const units = ["B", "KB", "MB", "GB", "TB"];
    let index = 0;
    let value = size;

    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index++;
    }

    return `${value.toFixed(2)} ${units[index]}`;
  }

  /**
   * Helper: Calculate index efficiency
   */
  private calculateIndexEfficiency(index: any): string {
    const scans = parseInt(index.index_scans || 0);
    const reads = parseInt(index.tuples_read || 0);
    
    if (scans === 0) return "unused";
    if (reads === 0) return "efficient";
    
    const ratio = reads / scans;
    if (ratio < 10) return "very efficient";
    if (ratio < 100) return "efficient";
    if (ratio < 1000) return "moderate";
    return "inefficient";
  }

  /**
   * Helper: Analyze performance metrics
   */
  private analyzePerformance(report: any): string {
    const connections = report.activeConnections;
    
    if (connections > 50) return "high load";
    if (connections > 20) return "moderate load";
    return "normal";
  }

  /**
   * Helper: Generate recommendations
   */
  private generateRecommendations(report: any): string[] {
    const recommendations: string[] = [];
    
    // Check for unused indexes
    const unusedIndexes = report.indexes.filter((idx: any) => 
      parseInt(idx.index_scans || 0) === 0
    );
    
    if (unusedIndexes.length > 0) {
      recommendations.push(`${unusedIndexes.length} unused indexes detected`);
    }

    // Check for tables needing vacuum
    const needsVacuum = report.tables.filter((table: any) => {
      const dead = parseInt(table.dead_rows || 0);
      const live = parseInt(table.row_count || 0);
      return dead > live * 0.1;
    });

    if (needsVacuum.length > 0) {
      recommendations.push(`${needsVacuum.length} tables need vacuum`);
    }

    return recommendations;
  }
}

export const monitoringService = new MonitoringService();