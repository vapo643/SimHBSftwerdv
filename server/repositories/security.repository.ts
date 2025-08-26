/**
 * Security Repository
 * Handles all database operations for security-related data
 * PAM V1.0 - Repository pattern implementation
 */

import { BaseRepository } from "./base.repository.js";
import { db } from "../lib/supabase.js";
import { security_logs } from "@shared/schema";
import { sql, eq, and, desc, gte } from "drizzle-orm";
import { getBrasiliaTimestamp } from "../lib/timezone.js";

export class SecurityRepository extends BaseRepository<any> {
  constructor() {
    super(security_logs as any);
  }

  /**
   * Get security metrics for dashboard
   */
  async getSecurityMetrics(timeRange: string): Promise<any> {
    const startDate = this.getTimeRangeDate(timeRange);
    
    try {
      const [totalRequests] = await db
        .select({ count: sql<number>`count(*)` })
        .from(security_logs)
        .where(gte(security_logs.createdAt, startDate.toISOString()));

      const [suspiciousRequests] = await db
        .select({ count: sql<number>`count(*)` })
        .from(security_logs)
        .where(
          and(
            gte(security_logs.createdAt, startDate.toISOString()),
            sql`${security_logs.severity} IN ('HIGH', 'CRITICAL')`
          )
        );

      const [blockedRequests] = await db
        .select({ count: sql<number>`count(*)` })
        .from(security_logs)
        .where(
          and(
            gte(security_logs.createdAt, startDate.toISOString()),
            eq(security_logs.action, "BLOCKED")
          )
        );

      return {
        totalRequests: totalRequests?.count || 0,
        suspiciousRequests: suspiciousRequests?.count || 0,
        blockedRequests: blockedRequests?.count || 0,
        timeRange,
      };
    } catch (error) {
      console.error("[SECURITY_REPO] Error getting metrics:", error);
      // Return fallback metrics if database query fails
      return {
        totalRequests: 0,
        suspiciousRequests: 0,
        blockedRequests: 0,
        timeRange,
      };
    }
  }

  /**
   * Get active security alerts
   */
  async getActiveAlerts(limit: number = 50): Promise<any[]> {
    try {
      const alerts = await db
        .select()
        .from(security_logs)
        .where(
          sql`
          severity IN ('HIGH', 'CRITICAL') 
          AND created_at > NOW() - INTERVAL '24 hours'
          AND NOT EXISTS (
            SELECT 1 FROM security_alerts_resolved 
            WHERE security_alerts_resolved.log_id = security_logs.id
          )
        `
        )
        .orderBy(desc(security_logs.createdAt))
        .limit(limit);

      return alerts;
    } catch (error) {
      console.error("[SECURITY_REPO] Error getting active alerts:", error);
      return [];
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event: {
    eventType: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    ipAddress?: string;
    userId?: string;
    userAgent?: string;
    endpoint?: string;
    statusCode?: number;
    success?: boolean;
    details?: any;
  }): Promise<any | undefined> {
    try {
      const result = await db
        .insert(security_logs)
        .values({
          eventType: event.eventType,
          severity: event.severity,
          ipAddress: event.ipAddress,
          userId: event.userId,
          userAgent: event.userAgent,
          endpoint: event.endpoint,
          statusCode: event.statusCode,
          success: event.success ?? true,
          details: event.details,
        })
        .returning();

      return result[0];
    } catch (error) {
      console.error("[SECURITY_REPO] Error logging security event:", error);
      return undefined;
    }
  }

  /**
   * Get security logs with filters
   */
  async getSecurityLogs(filters: {
    startDate?: Date;
    endDate?: Date;
    severity?: string[];
    eventType?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      let query = db.select().from(security_logs);
      
      const conditions = [];

      if (filters.startDate) {
        conditions.push(gte(security_logs.createdAt, filters.startDate.toISOString()));
      }

      if (filters.endDate) {
        conditions.push(sql`${security_logs.createdAt} <= ${filters.endDate.toISOString()}`);
      }

      if (filters.severity && filters.severity.length > 0) {
        conditions.push(sql`${security_logs.severity} IN (${sql.raw(
          filters.severity.map(s => `'${s}'`).join(',')
        )})`);
      }

      if (filters.eventType) {
        conditions.push(eq(security_logs.eventType, filters.eventType));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      query = query.orderBy(desc(security_logs.createdAt));

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.offset(filters.offset);
      }

      return await query;
    } catch (error) {
      console.error("[SECURITY_REPO] Error getting security logs:", error);
      return [];
    }
  }

  /**
   * Resolve security alert
   */
  async resolveAlert(alertId: string, resolvedBy: string, reason?: string): Promise<boolean> {
    try {
      // For now, we'll mark it by updating the security log
      // In a full implementation, you might use a separate security_alerts_resolved table
      const result = await db
        .update(security_logs)
        .set({
          details: sql`COALESCE(${security_logs.details}, '{}')::jsonb || ${JSON.stringify({
            resolved: true,
            resolvedBy,
            resolvedAt: getBrasiliaTimestamp(),
            reason,
          })}::jsonb`,
        })
        .where(eq(security_logs.id, alertId))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error("[SECURITY_REPO] Error resolving alert:", error);
      return false;
    }
  }

  /**
   * Get security statistics for dashboard
   */
  async getSecurityStatistics(timeRange: string): Promise<{
    totalEvents: number;
    eventsBySeverity: Record<string, number>;
    eventsByType: Record<string, number>;
    trendData: any[];
  }> {
    const startDate = this.getTimeRangeDate(timeRange);

    try {
      // Get total events
      const [totalEvents] = await db
        .select({ count: sql<number>`count(*)` })
        .from(security_logs)
        .where(gte(security_logs.createdAt, startDate.toISOString()));

      // Get events by severity
      const severityResults = await db
        .select({
          severity: security_logs.severity,
          count: sql<number>`count(*)`
        })
        .from(security_logs)
        .where(gte(security_logs.createdAt, startDate.toISOString()))
        .groupBy(security_logs.severity);

      const eventsBySeverity = severityResults.reduce((acc, row) => {
        acc[row.severity] = row.count;
        return acc;
      }, {} as Record<string, number>);

      // Get events by type
      const typeResults = await db
        .select({
          eventType: security_logs.eventType,
          count: sql<number>`count(*)`
        })
        .from(security_logs)
        .where(gte(security_logs.createdAt, startDate.toISOString()))
        .groupBy(security_logs.eventType);

      const eventsByType = typeResults.reduce((acc, row) => {
        acc[row.eventType] = row.count;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalEvents: totalEvents?.count || 0,
        eventsBySeverity,
        eventsByType,
        trendData: [], // Will be generated by service layer
      };
    } catch (error) {
      console.error("[SECURITY_REPO] Error getting security statistics:", error);
      return {
        totalEvents: 0,
        eventsBySeverity: {},
        eventsByType: {},
        trendData: [],
      };
    }
  }

  /**
   * Get recent security events
   */
  async getRecentEvents(limit: number = 10): Promise<any[]> {
    try {
      return await db
        .select()
        .from(security_logs)
        .orderBy(desc(security_logs.createdAt))
        .limit(limit);
    } catch (error) {
      console.error("[SECURITY_REPO] Error getting recent events:", error);
      return [];
    }
  }

  /**
   * Helper method to convert time range to date
   */
  private getTimeRangeDate(timeRange: string): Date {
    const now = new Date();
    switch (timeRange) {
      case "1h":
        return new Date(now.getTime() - 60 * 60 * 1000);
      case "24h":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case "7d":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 60 * 60 * 1000);
    }
  }

  /**
   * Clean old security logs (retention policy)
   */
  async cleanOldLogs(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await db
        .delete(security_logs)
        .where(sql`${security_logs.createdAt} < ${cutoffDate.toISOString()}`)
        .returning({ id: security_logs.id });

      return result.length;
    } catch (error) {
      console.error("[SECURITY_REPO] Error cleaning old logs:", error);
      return 0;
    }
  }
}

export const securityRepository = new SecurityRepository();