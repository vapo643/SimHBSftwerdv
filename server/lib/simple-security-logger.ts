// Simple Security Logger - Fallback implementation
// This ensures the server can start even if the main security logger fails

export enum SecurityEventType {
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILURE = "LOGIN_FAILURE",
  LOGOUT = "LOGOUT",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_INVALID = "TOKEN_INVALID",
  ACCESS_DENIED = "ACCESS_DENIED",
  PRIVILEGE_ESCALATION_ATTEMPT = "PRIVILEGE_ESCALATION_ATTEMPT",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  BRUTE_FORCE_DETECTED = "BRUTE_FORCE_DETECTED",
  SENSITIVE_DATA_ACCESS = "SENSITIVE_DATA_ACCESS",
  DATA_MODIFICATION = "DATA_MODIFICATION",
  BULK_DATA_EXPORT = "BULK_DATA_EXPORT",
  SQL_INJECTION_ATTEMPT = "SQL_INJECTION_ATTEMPT",
  XSS_ATTEMPT = "XSS_ATTEMPT",
  CSRF_ATTEMPT = "CSRF_ATTEMPT",
  CONFIGURATION_CHANGE = "CONFIGURATION_CHANGE",
  CERTIFICATE_ERROR = "CERTIFICATE_ERROR",
  API_ERROR = "API_ERROR",
  TOKEN_BLACKLISTED = "TOKEN_BLACKLISTED",
  PASSWORD_CHANGED = "PASSWORD_CHANGED",
  PASSWORD_CHANGE_FAILED = "PASSWORD_CHANGE_FAILED",
  PASSWORD_RESET_REQUEST = "PASSWORD_RESET_REQUEST",
  USER_DEACTIVATED = "USER_DEACTIVATED",
  USER_REACTIVATED = "USER_REACTIVATED",
  SESSION_TERMINATED = "SESSION_TERMINATED",
  EMAIL_CHANGE_REQUESTED = "EMAIL_CHANGE_REQUESTED",
  EMAIL_CHANGED = "EMAIL_CHANGED",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
}

export interface SecurityEvent {
  type: SecurityEventType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  details?: Record<string, any>;
  success: boolean;
}

class SimpleSecurityLogger {
  private static instance: SimpleSecurityLogger;
  private events: Array<SecurityEvent & { timestamp: Date }> = [];

  private constructor() {}

  public static getInstance(): SimpleSecurityLogger {
    if (!SimpleSecurityLogger.instance) {
      SimpleSecurityLogger.instance = new SimpleSecurityLogger();
    }
    return SimpleSecurityLogger.instance;
  }

  logEvent(event: SecurityEvent): void {
    // Store in memory
    this.events.push({
      ...event,
      timestamp: new Date()
    });

    // Keep only last 1000 events to prevent memory issues
    if (this.events.length > 1000) {
      this.events.shift();
    }

    // Always log to console
    const logLevel = event.severity === 'HIGH' || event.severity === 'CRITICAL' ? 'error' : 
                     event.severity === 'MEDIUM' ? 'warn' : 'log';
    
    console[logLevel](`🔐 [SECURITY ${event.severity}] ${event.type}:`, {
      success: event.success,
      endpoint: event.endpoint,
      userId: event.userId,
      ipAddress: event.ipAddress
    });

    // Try to save to database if possible (non-blocking)
    this.tryDatabaseLog(event).catch(() => {
      // Silently ignore database errors - don't break the application
    });
  }

  private async tryDatabaseLog(event: SecurityEvent): Promise<void> {
    try {
      const { db } = await import("./supabase");
      
      await db.from('security_logs').insert([{
        event_type: event.type,
        severity: event.severity,
        user_id: event.userId || null,
        user_email: event.userEmail || null,
        ip_address: event.ipAddress || null,
        user_agent: event.userAgent || null,
        endpoint: event.endpoint || null,
        success: event.success,
        details: event.details || null
      }]);
    } catch (error) {
      // Ignore database errors
    }
  }

  getEvents(): Array<SecurityEvent & { timestamp: Date }> {
    return [...this.events];
  }
}

// Export singleton instance
export const securityLogger = SimpleSecurityLogger.getInstance();
export default securityLogger;