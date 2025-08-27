// Sistema de Logs de Segurança - OWASP A09: Security Logging and Monitoring
import { log } from '../vite';
import { getBrasiliaTimestamp } from './timezone';

export enum SecurityEventType {
  // Autenticação
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',

  // Autorização
  ACCESS_DENIED = 'ACCESS_DENIED',
  PRIVILEGE_ESCALATION_ATTEMPT = 'PRIVILEGE_ESCALATION_ATTEMPT',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  BRUTE_FORCE_DETECTED = 'BRUTE_FORCE_DETECTED',

  // Dados
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  BULK_DATA_EXPORT = 'BULK_DATA_EXPORT',

  // Vulnerabilidades
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  CSRF_ATTEMPT = 'CSRF_ATTEMPT',

  // Sistema
  CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE',
  CERTIFICATE_ERROR = 'CERTIFICATE_ERROR',
  API_ERROR = 'API_ERROR',

  // Token Management (ASVS 7.2.4)
  TOKEN_BLACKLISTED = 'TOKEN_BLACKLISTED',

  // Password Management (ASVS 6.2.3 & 6.3.1)
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_CHANGE_FAILED = 'PASSWORD_CHANGE_FAILED',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',

  // User Management (ASVS 8.3.7)
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  USER_REACTIVATED = 'USER_REACTIVATED',

  // Session Management (ASVS 7.4.3)
  SESSION_TERMINATED = 'SESSION_TERMINATED',

  // Email Management (ASVS 6.1.3)
  EMAIL_CHANGE_REQUESTED = 'EMAIL_CHANGE_REQUESTED',
  EMAIL_CHANGED = 'EMAIL_CHANGED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Security Alerts
  SECURITY_ALERT = 'SECURITY_ALERT',

  // User Events
  USER_CREATED = 'USER_CREATED',
  DATA_ACCESS = 'DATA_ACCESS',

  // Security Monitoring
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  AUTOMATED_ATTACK = 'AUTOMATED_ATTACK',
  FILE_INTEGRITY_VIOLATION = 'FILE_INTEGRITY_VIOLATION',
}

export interface SecurityEvent {
  timestamp: string;
  type: SecurityEventType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  details?: Record<string, any>;
  success: boolean;
}

class SecurityLogger {
  private events: SecurityEvent[] = [];
  private readonly MAX_EVENTS = 10000; // Manter últimos 10k eventos em memória

  logEvent(event: Omit<SecurityEvent, 'timestamp'>) {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: _getBrasiliaTimestamp(),
      // Sanitizar dados sensíveis
      details: this.sanitizeDetails(event.details),
    };

    // Adicionar à memória
    this.events.push(securityEvent);
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift(); // Remove o mais antigo
    }

    // Log formatado
    const logMessage = this.formatLogMessage(securityEvent);

    // Diferentes níveis de log baseado na severidade
    switch (event.severity) {
      case 'CRITICAL':
      case 'HIGH': {
        console.error(`🚨 [SECURITY] ${logMessage}`);
        break;
      }
      case 'MEDIUM': {
        console.warn(`⚠️ [SECURITY] ${logMessage}`);
        break;
      }
      default:
        console.log(`🔒 [SECURITY] ${logMessage}`);
    }

    // TODO: Enviar para sistema de monitoramento externo (Sentry, DataDog, etc)
    // this.sendToMonitoringService(securityEvent);
  }

  private formatLogMessage(event: SecurityEvent): string {
    const parts = [event.type, `severity=${event.severity}`, event.success ? 'SUCCESS' : 'FAILURE'];

    if (event.userEmail) parts.push(`user=${event.userEmail}`);
    if (event.ipAddress) parts.push(`ip=${event.ipAddress}`);
    if (event.endpoint) parts.push(`endpoint=${event.endpoint}`);

    return parts.join(' | ');
  }

  private sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
    if (!details) return undefined;

    const sanitized = { ...details };
    const sensitiveKeys = ['password', 'senha', 'token', 'secret', 'key', 'cpf', 'rg', 'card'];

    Object.keys(sanitized).forEach((key) => {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  // Análise de segurança
  getSecurityMetrics(hours: number = 24) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);
    const cutoffTimestamp = cutoff.toISOString();

    const recentEvents = this.events.filter((e) => e.timestamp > cutoffTimestamp);

    return {
      totalEvents: recentEvents.length,
      failedLogins: recentEvents.filter((e) => e.type == SecurityEventType.LOGIN_FAILURE).length,
      accessDenied: recentEvents.filter((e) => e.type == SecurityEventType.ACCESS_DENIED).length,
      rateLimitExceeded: recentEvents.filter(
        (e) => e.type == SecurityEventType.RATE_LIMIT_EXCEEDED
      ).length,
      criticalEvents: recentEvents.filter((e) => e.severity == 'CRITICAL').length,
      suspiciousIPs: this.getSuspiciousIPs(recentEvents),
    };
  }

  private getSuspiciousIPs(events: SecurityEvent[]): string[] {
    const ipCounts = new Map<string, number>();

    events
      .filter((e) => !e.success && e.ipAddress)
      .forEach((e) => {
        const count = ipCounts.get(e.ipAddress!) || 0;
        ipCounts.set(e.ipAddress!, count + 1);
      });

    // IPs com mais de 10 falhas
    return Array.from(ipCounts.entries())
      .filter(([_, count]) => count > 10)
      .map(([ip]) => ip);
  }

  // Detecção de anomalias
  detectAnomalies(): string[] {
    const anomalies: string[] = [];
    const metrics = this.getSecurityMetrics(1); // Última hora

    if (metrics.failedLogins > 50) {
      anomalies.push('Alto número de tentativas de login falhadas');
    }

    if (metrics.criticalEvents > 5) {
      anomalies.push('Múltiplos eventos críticos detectados');
    }

    if (metrics.suspiciousIPs.length > 0) {
      anomalies.push(`IPs suspeitos detectados: ${metrics.suspiciousIPs.join(', ')}`);
    }

    return anomalies;
  }
}

// Singleton
export const securityLogger = new SecurityLogger();

// Helper para extrair IP do request
export function getClientIP(req: any): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}
