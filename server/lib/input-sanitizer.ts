// Sanitização de Inputs - OWASP A03: Injection
import { Request, Response, NextFunction } from 'express';
import xss from 'xss';
import { securityLogger, SecurityEventType, getClientIP } from './security-logger';

// Padrões suspeitos de SQL Injection
const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
  /(--|\/\*|\*\/|xp_|sp_)/i,
  /(\bor\b|\band\b)\s*\d+\s*=\s*\d+/i,
  /['";].*(\bor\b|\band\b).*['";]/i,
];

// Padrões suspeitos de XSS
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
];

// Padrões de Path Traversal
const PATH_TRAVERSAL_PATTERNS = [/\.\.\//g, /\.\.\\/, /%2e%2e/gi, /\x00/g];

// Campos que nunca devem ser sanitizados (ex: senhas, tokens)
const EXCLUDE_FIELDS = ['password', 'senha', 'token', 'jwt', 'authorization'];

// Campos de alto risco que precisam validação extra
const HIGH_RISK_FIELDS = ['cpf', 'cnpj', 'email', 'telefone', 'rg'];

/**
 * Middleware para sanitizar inputs e prevenir injection attacks
 */
export function inputSanitizerMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Sanitizar query params
    if (req.query) {
      req.query = sanitizeObject(req.query, req);
    }

    // Sanitizar body params
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, req);
    }

    // Sanitizar route params
    if (req.params) {
      req.params = sanitizeObject(req.params, req);
    }

    // Validar headers suspeitos
    validateHeaders(req);

    next();
  } catch (error: any) {
    securityLogger.logEvent({
      type: SecurityEventType.XSS_ATTEMPT,
      severity: 'HIGH',
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      endpoint: req.originalUrl,
      success: false,
      details: { error: error.message },
    });

    res.status(400).json({
      message: 'Entrada inválida detectada',
      code: 'INVALID_INPUT',
    });
  }
}

/**
 * Sanitiza um objeto recursivamente
 */
function sanitizeObject(obj: any, req: Request): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj, '', req);
  }

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // Pular campos excluídos
      if (EXCLUDE_FIELDS.includes(key.toLowerCase())) {
        sanitized[key] = obj[key];
        continue;
      }

      // Validação extra para campos de alto risco
      if (HIGH_RISK_FIELDS.includes(key.toLowerCase())) {
        sanitized[key] = validateHighRiskField(key, obj[key], req);
      } else {
        sanitized[key] = sanitizeValue(obj[key], key, req);
      }
    }
  }

  return sanitized;
}

/**
 * Sanitiza um valor individual
 */
function sanitizeValue(value: any, fieldName: string, req: Request): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'object') {
    return sanitizeObject(value, req);
  }

  if (typeof value !== 'string') {
    return value;
  }

  let sanitized = value;

  // Detectar SQL Injection
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      securityLogger.logEvent({
        type: SecurityEventType.SQL_INJECTION_ATTEMPT,
        severity: 'CRITICAL',
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { field: fieldName, pattern: pattern.toString(), value: value.substring(0, 100) },
      });
      throw new Error('SQL Injection detectado');
    }
  }

  // Detectar XSS
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(value)) {
      securityLogger.logEvent({
        type: SecurityEventType.XSS_ATTEMPT,
        severity: 'HIGH',
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { field: fieldName, pattern: pattern.toString() },
      });
      // Não lançar erro, apenas sanitizar
      sanitized = xss(sanitized);
      break;
    }
  }

  // Detectar Path Traversal
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(value)) {
      securityLogger.logEvent({
        type: SecurityEventType.XSS_ATTEMPT,
        severity: 'HIGH',
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { field: fieldName, type: 'path_traversal' },
      });
      sanitized = sanitized.replace(pattern, '');
    }
  }

  // Remover caracteres nulos
  sanitized = sanitized.replace(/\0/g, '');

  // Limitar tamanho de strings
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000);
  }

  return sanitized.trim();
}

/**
 * Validação especial para campos de alto risco
 */
function validateHighRiskField(fieldName: string, value: any, req: Request): any {
  if (typeof value !== 'string') return value;

  const validators: Record<string, RegExp> = {
    cpf: /^\d{11}$/,
    cnpj: /^\d{14}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    telefone: /^\d{10,11}$/,
    rg: /^[0-9A-Za-z.-]+$/,
  };

  const validator = validators[fieldName.toLowerCase()];
  if (validator) {
    // Remove caracteres especiais para validação
    const cleanValue = value.replace(/\D/g, '');

    if (!validator.test(fieldName === 'email' ? value : cleanValue)) {
      securityLogger.logEvent({
        type: SecurityEventType.XSS_ATTEMPT,
        severity: 'MEDIUM',
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
        success: false,
        details: { field: fieldName, reason: 'invalid_format' },
      });
      throw new Error(`Formato inválido para ${fieldName}`);
    }
  }

  return value;
}

/**
 * Valida headers HTTP suspeitos
 */
function validateHeaders(req: Request) {
  const suspiciousHeaders = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];

  for (const header of suspiciousHeaders) {
    if (req.headers[header]) {
      const value = req.headers[header] as string;
      // Validar se o header contém valores suspeitos
      if (value.includes('..') || value.includes('://')) {
        securityLogger.logEvent({
          type: SecurityEventType.XSS_ATTEMPT,
          severity: 'HIGH',
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
          endpoint: req.originalUrl,
          success: false,
          details: { header, value },
        });
        delete req.headers[header];
      }
    }
  }
}

// Exportar função para sanitizar strings individualmente
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') return input;

  // Aplicar XSS filtering
  let sanitized = xss(input, {
    whiteList: {}, // Não permitir nenhuma tag HTML
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script'],
  });

  // Remover caracteres perigosos adicionais
  sanitized = sanitized
    .replace(/[<>'"]/g, '') // Remove caracteres HTML básicos
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers

  return sanitized.trim();
}
