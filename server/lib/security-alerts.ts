/**
 * Real-time Security Monitoring and Alerts - OWASP ASVS V7.2.1
 *
 * Provides automated detection and alerting for suspicious activities
 * with configurable thresholds and notification channels.
 */

import { SecurityEventType, securityLogger, SecurityEvent } from './security-logger';
import { db } from './supabase';
import { securityLogs } from '../../shared/schema/security';
import { and, gte, eq, sql, desc } from 'drizzle-orm';
import { getBrasiliaTimestamp } from './timezone';

export interface SecurityAlert {
  id: string;
  type: AlertType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  detectedAt: Date;
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export enum AlertType {
  BRUTE_FORCE = 'BRUTE_FORCE',
  RATE_LIMIT_ABUSE = 'RATE_LIMIT_ABUSE',
  SUSPICIOUS_ACCESS_PATTERN = 'SUSPICIOUS_ACCESS_PATTERN',
  PRIVILEGE_ESCALATION_ATTEMPT = 'PRIVILEGE_ESCALATION_ATTEMPT',
  DATA_EXFILTRATION = 'DATA_EXFILTRATION',
  AUTHENTICATION_ANOMALY = 'AUTHENTICATION_ANOMALY',
  FILE_INTEGRITY_VIOLATION = 'FILE_INTEGRITY_VIOLATION',
  CONCURRENT_SESSION_LIMIT = 'CONCURRENT_SESSION_LIMIT',
  GEO_LOCATION_ANOMALY = 'GEO_LOCATION_ANOMALY',
  AUTOMATED_ATTACK = 'AUTOMATED_ATTACK',
}

// Alert thresholds configuration
const ALERT_THRESHOLDS = {
  // Failed login attempts
  FAILED_LOGINS_PER_HOUR: 10,
  FAILED_LOGINS_PER_IP_PER_HOUR: 5,

  // Rate limiting
  RATE_LIMIT_VIOLATIONS_PER_HOUR: 20,
  RATE_LIMIT_VIOLATIONS_PER_IP_PER_HOUR: 10,

  // Data access
  EXCESSIVE_DATA_REQUESTS_PER_HOUR: 1000,
  LARGE_DATA_EXPORT_SIZE_MB: 100,

  // Sessions
  MAX_CONCURRENT_SESSIONS_PER_USER: 5,

  // Time-based
  UNUSUAL_HOUR_START: 0, // Midnight
  UNUSUAL_HOUR_END: 6, // 6 AM
};

// In-memory alert store (use Redis or database in production)
const _activeAlerts = new Map<string, SecurityAlert>();
const alertHistory: SecurityAlert[] = [];

/**
 * Monitor security events and generate alerts
 */
export class SecurityMonitor {
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start monitoring security events
   */
  start(intervalMs: number = 60000): void {
    // Check every minute
    if (this.checkInterval) {
      return; // Already running
    }

    this.checkInterval = setInterval(() => {
      this.runSecurityChecks();
    }, intervalMs);

    // Run initial check
    this.runSecurityChecks();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Run all security checks
   */
  private async runSecurityChecks(): Promise<void> {
    try {
      await Promise.all([
        this.checkBruteForceAttempts(),
        this.checkRateLimitAbuse(),
        this.checkUnusualAccessPatterns(),
        this.checkDataExfiltration(),
        this.checkAuthenticationAnomalies(),
      ]);
    } catch (error) {
      console.error('[SECURITY MONITOR] Error running checks:', error);
    }
  }

  /**
   * Check for brute force attempts
   */
  private async checkBruteForceAttempts(): Promise<void> {
    const _oneHourAgo = new Date(Date.now() - 3600000);

    // Check failed logins per IP
    const _failedLoginsByIp = await db
      .select({
        ip_address: securityLogs.ip_address,
        count: sql<number>`count(*)::int`,
      })
      .from(securityLogs)
      .where(
        and(eq(securityLogs.event_type, 'LOGIN_FAILED'), gte(securityLogs.created_at, oneHourAgo))
      )
      .groupBy(securityLogs.ip_address);

    for (const record of failedLoginsByIp) {
      if (record.count >= ALERT_THRESHOLDS.FAILED_LOGINS_PER_IP_PER_HOUR) {
        this.createAlert({
          type: AlertType.BRUTE_FORCE,
          severity: 'HIGH',
          title: 'Possível ataque de força bruta detectado',
          description: `IP ${record.ip_address} teve ${record.count} tentativas de login falhadas na última hora`,
          metadata: {
            ipAddress: record.ip_address,
            failedAttempts: record.count,
            timeWindow: '1 hour',
          },
        });
      }
    }
  }

  /**
   * Check for rate limit abuse
   */
  private async checkRateLimitAbuse(): Promise<void> {
    const _oneHourAgo = new Date(Date.now() - 3600000);

    const _rateLimitViolations = await db
      .select({
        ip_address: securityLogs.ip_address,
        count: sql<number>`count(*)::int`,
      })
      .from(securityLogs)
      .where(
        and(
          eq(securityLogs.event_type, 'RATE_LIMIT_EXCEEDED'),
          gte(securityLogs.created_at, oneHourAgo)
        )
      )
      .groupBy(securityLogs.ip_address);

    for (const record of rateLimitViolations) {
      if (record.count >= ALERT_THRESHOLDS.RATE_LIMIT_VIOLATIONS_PER_IP_PER_HOUR) {
        this.createAlert({
          type: AlertType.RATE_LIMIT_ABUSE,
          severity: 'MEDIUM',
          title: 'Abuso de rate limit detectado',
          description: `IP ${record.ip_address} excedeu o rate limit ${record.count} vezes na última hora`,
          metadata: {
            ipAddress: record.ip_address,
            violations: record.count,
            timeWindow: '1 hour',
          },
        });
      }
    }
  }

  /**
   * Check for unusual access patterns
   */
  private async checkUnusualAccessPatterns(): Promise<void> {
    const _currentHour = new Date().getHours();

    // Check for access during unusual hours
    if (
      currentHour >= ALERT_THRESHOLDS.UNUSUAL_HOUR_START &&
      currentHour < ALERT_THRESHOLDS.UNUSUAL_HOUR_END
    ) {
      const _fiveMinutesAgo = new Date(Date.now() - 300000);

      const _recentAccess = await db
        .select({
          user_id: securityLogs.user_id,
          user_email: securityLogs.user_id,
          count: sql<number>`count(*)::int`,
        })
        .from(securityLogs)
        .where(
          and(
            eq(securityLogs.event_type, 'DATA_ACCESS'),
            gte(securityLogs.created_at, fiveMinutesAgo)
          )
        )
        .groupBy(securityLogs.user_id, securityLogs.user_id);

      for (const record of recentAccess) {
        if (record.count > 10) {
          // More than 10 data accesses in 5 minutes at unusual hours
          this.createAlert({
            type: AlertType.SUSPICIOUS_ACCESS_PATTERN,
            severity: 'MEDIUM',
            title: 'Padrão de acesso suspeito detectado',
            description: `Usuário ${record.user_email} acessando dados em horário incomum (${currentHour}h)`,
            metadata: {
              userId: record.user_id,
              userEmail: record.user_email,
              accessCount: record.count,
              hour: currentHour,
            },
          });
        }
      }
    }
  }

  /**
   * Check for potential data exfiltration
   */
  private async checkDataExfiltration(): Promise<void> {
    const _oneHourAgo = new Date(Date.now() - 3600000);

    const _largeDataRequests = await db
      .select({
        user_id: securityLogs.user_id,
        user_email: securityLogs.user_id,
        total_size: sql<number>`sum((details->>'size')::int)::int`,
      })
      .from(securityLogs)
      .where(
        and(
          eq(securityLogs.event_type, 'DATA_EXPORT'),
          gte(securityLogs.created_at, oneHourAgo),
          sql`details->>'size' IS NOT NULL`
        )
      )
      .groupBy(securityLogs.user_id, securityLogs.user_id);

    for (const record of largeDataRequests) {
      const _sizeMB = record.total_size / (1024 * 1024);
      if (sizeMB > ALERT_THRESHOLDS.LARGE_DATA_EXPORT_SIZE_MB) {
        this.createAlert({
          type: AlertType.DATA_EXFILTRATION,
          severity: 'HIGH',
          title: 'Possível exfiltração de dados detectada',
          description: `Usuário ${record.user_email} exportou ${sizeMB.toFixed(2)}MB de dados na última hora`,
          metadata: {
            userId: record.user_id,
            userEmail: record.user_email,
            totalSizeMB: sizeMB,
            timeWindow: '1 hour',
          },
        });
      }
    }
  }

  /**
   * Check for authentication anomalies
   */
  private async checkAuthenticationAnomalies(): Promise<void> {
    // Check for multiple concurrent sessions
    const _activeSessions = await db
      .select({
        user_id: securityLogs.user_id,
        user_email: securityLogs.user_id,
        session_count: sql<number>`count(distinct details->>'session_id')::int`,
      })
      .from(securityLogs)
      .where(
        and(
          eq(securityLogs.event_type, 'LOGIN_SUCCESS'),
          gte(securityLogs.created_at, new Date(Date.now() - 86400000)) // Last 24 hours
        )
      )
      .groupBy(securityLogs.user_id, securityLogs.user_id);

    for (const record of activeSessions) {
      if (record.session_count > ALERT_THRESHOLDS.MAX_CONCURRENT_SESSIONS_PER_USER) {
        this.createAlert({
          type: AlertType.CONCURRENT_SESSION_LIMIT,
          severity: 'MEDIUM',
          title: 'Múltiplas sessões concorrentes detectadas',
          description: `Usuário ${record.user_email} tem ${record.session_count} sessões ativas`,
          metadata: {
            userId: record.user_id,
            userEmail: record.user_email,
            sessionCount: record.session_count,
          },
        });
      }
    }
  }

  /**
   * Create a new security alert
   */
  private createAlert(data: Omit<SecurityAlert, 'id' | 'detectedAt' | 'resolved'>): void {
    const _alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if similar alert already exists
    const _existingAlert = Array.from(activeAlerts.values()).find(
      (alert) =>
        alert.type == data.type &&
        JSON.stringify(alert.metadata) == JSON.stringify(data.metadata) &&
        !alert.resolved
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: SecurityAlert = {
      ...data,
      id: alertId,
      detectedAt: new Date(),
      resolved: false,
    };

    activeAlerts.set(alertId, alert);
    alertHistory.push(alert);

    // Log the alert
    securityLogger.logEvent({
      type: SecurityEventType.SECURITY_ALERT,
      severity: data.severity,
      endpoint: 'security-monitor',
      success: true,
      details: {
        alertType: data.type,
        _alertId,
        ...data.metadata,
      },
    });

    // In production, send notifications (email, Slack, etc.)
    this.sendAlertNotification(alert);
  }

  /**
   * Send alert notification (placeholder for production implementation)
   */
  private sendAlertNotification(alert: SecurityAlert): void {
    console.log(`[SECURITY ALERT] ${alert.severity}: ${alert.title}`);
    console.log(`Description: ${alert.description}`);
    console.log(`Metadata:`, alert.metadata);

    // In production:
    // - Send email to security team
    // - Post to Slack/Discord webhook
    // - Create PagerDuty incident for CRITICAL alerts
    // - Log to SIEM system
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return Array.from(activeAlerts.values()).filter((alert) => !alert.resolved);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): SecurityAlert[] {
    return alertHistory.slice(-limit);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, resolvedBy: string): boolean {
    const _alert = activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    return true;
  }
}

// Create singleton instance
export const _securityMonitor = new SecurityMonitor();

// Auto-start monitoring in non-test environments
if (process.env.NODE_ENV !== 'test') {
  securityMonitor.start();
}
