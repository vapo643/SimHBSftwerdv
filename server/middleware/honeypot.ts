/**
 * Honeypot Middleware - OWASP ASVS V11.1.7
 *
 * Creates fake endpoints to detect and track attackers.
 * These endpoints should never be accessed by legitimate users.
 */

import { Request, Response, NextFunction } from 'express';
import { securityLogger, SecurityEventType, getClientIP } from '../lib/security-logger';
import { createHash } from 'crypto';

// Track suspicious IPs (use Redis in production)
const suspiciousIPs = new Map<
  string,
  {
    count: number;
    firstSeen: Date;
    lastSeen: Date;
    endpoints: Set<string>;
  }
>();

// Honeypot endpoints that should never be accessed
const HONEYPOT_ENDPOINTS = [
  '/api/admin/debug',
  '/api/v1/admin',
  '/api/test/backdoor',
  '/api/config',
  '/api/.env',
  '/api/wp-admin',
  '/api/phpmyadmin',
  '/api/shell',
  '/api/cmd',
  '/api/exec',
  '/api/system',
  '/api/eval',
  '/api/console',
  '/api/terminal',
  '/api/ssh',
  '/api/ftp',
  '/api/database/dump',
  '/api/backup',
  '/api/db.sql',
  '/api/users/all',
  '/api/export/users',
];

// Hidden form fields that should never be filled
const HONEYPOT_FIELDS = [
  'email_confirm',
  'username_verify',
  'hidden_field',
  'trap_field',
  'bot_check',
  'security_check',
];

/**
 * Get or create suspicious IP record
 */
function getSuspiciousIP(ip: string) {
  if (!suspiciousIPs.has(ip)) {
    suspiciousIPs.set(ip, {
      count: 0,
      firstSeen: new Date(),
      lastSeen: new Date(),
      endpoints: new Set(),
    });
  }
  return suspiciousIPs.get(ip)!;
}

/**
 * Honeypot endpoint handler
 */
export function honeypotHandler(req: Request, res: Response) {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  const endpoint = req.originalUrl;

  // Track suspicious activity
  const suspiciousRecord = getSuspiciousIP(ip);
  suspiciousRecord.count++;
  suspiciousRecord.lastSeen = new Date();
  suspiciousRecord.endpoints.add(endpoint);

  // Log security event
  securityLogger.logEvent({
    type: SecurityEventType.SUSPICIOUS_ACTIVITY,
    severity: 'HIGH',
    ipAddress: ip,
    userAgent,
    endpoint,
    success: false,
    details: {
      honeypot: true,
      method: req.method,
      body: req.body ? Object.keys(req.body) : [],
      query: req.query,
      accessCount: suspiciousRecord.count,
      endpointsAccessed: Array.from(suspiciousRecord.endpoints),
    },
  });

  // Respond with realistic but fake error
  const fakeResponses = [
    { status: 404, message: 'Endpoint não encontrado' },
    { status: 403, message: 'Acesso negado' },
    { status: 401, message: 'Não autorizado' },
    { status: 500, message: 'Erro interno do servidor' },
  ];

  const response = fakeResponses[Math.floor(Math.random() * fakeResponses.length)];

  // Add random delay to simulate processing
  setTimeout(
    () => {
      res.status(response.status).json({ error: response.message });
    },
    Math.random() * 2000 + 500
  );
}

/**
 * Form honeypot middleware
 */
export function formHoneypotMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip if not a form submission
  if (!req.body || Object.keys(req.body).length === 0) {
    return next();
  }

  // Check for honeypot fields
  const filledHoneypotFields = HONEYPOT_FIELDS.filter(
    (field) => req.body[field] && req.body[field].toString().trim().length > 0
  );

  if (filledHoneypotFields.length > 0) {
    const ip = getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Track suspicious activity
    const suspiciousRecord = getSuspiciousIP(ip);
    suspiciousRecord.count++;
    suspiciousRecord.lastSeen = new Date();

    // Log security event
    securityLogger.logEvent({
      type: SecurityEventType.AUTOMATED_ATTACK,
      severity: 'HIGH',
      ipAddress: ip,
      userAgent,
      endpoint: req.originalUrl,
      success: false,
      details: {
        honeypotFields: filledHoneypotFields,
        method: 'form_honeypot',
        accessCount: suspiciousRecord.count,
      },
    });

    // Respond as if successful to waste attacker's time
    return res.json({
      success: true,
      message: 'Operação realizada com sucesso',
    });
  }

  next();
}

/**
 * Register honeypot endpoints
 */
export function registerHoneypots(app: unknown) {
  // Register all honeypot endpoints
  HONEYPOT_ENDPOINTS.forEach((endpoint) => {
    app.all(endpoint, honeypotHandler);
  });

  // Log registration
  console.log(`[HONEYPOT] Registered ${HONEYPOT_ENDPOINTS.length} honeypot endpoints`);
}

/**
 * Check if IP is suspicious
 */
export function isSuspiciousIP(ip: string): boolean {
  const record = suspiciousIPs.get(ip);
  if (!record) return false;

  // Suspicious if accessed honeypots multiple times
  return record.count >= 3;
}

/**
 * Get suspicious IP report
 */
export function getSuspiciousIPReport() {
  const report = [];
  const now = Date.now();

  for (const [ip, record] of suspiciousIPs.entries()) {
    // Only include IPs seen in last 24 hours
    if (now - record.lastSeen.getTime() < 86400000) {
      report.push({
        ip,
        count: record.count,
        firstSeen: record.firstSeen,
        lastSeen: record.lastSeen,
        endpoints: Array.from(record.endpoints),
        riskLevel: record.count >= 10 ? 'CRITICAL' : record.count >= 5 ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  return report.sort((a, b) => b.count - a.count);
}

/**
 * Clean up old records periodically
 */
setInterval(() => {
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  for (const [ip, record] of suspiciousIPs.entries()) {
    if (record.lastSeen.getTime() < oneWeekAgo) {
      suspiciousIPs.delete(ip);
    }
  }
}, 86400000); // Clean up daily
