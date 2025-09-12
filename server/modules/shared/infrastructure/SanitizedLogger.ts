/**
 * Enhanced Sanitized Logger - V2.0 SECURITY UPGRADE
 * Advanced PII sanitization with Winston integration
 * 
 * FEATURES:
 * - Comprehensive PII field detection
 * - Smart masking algorithms
 * - Winston logger integration
 * - Webhook payload sanitization
 * - Error object sanitization
 */

import logger from '../../../lib/logger.js';

const PII_FIELDS = [
  // CPF variations
  'cpf', 'cliente_cpf', 'clienteCpf', 'cpfCliente', 'cpf_cliente',
  
  // Email variations
  'email', 'cliente_email', 'clienteEmail', 'emailCliente', 'email_cliente',
  
  // Phone variations
  'telefone', 'cliente_telefone', 'clienteTelefone', 'telefoneCliente', 'phone', 'cellphone',
  
  // Name variations
  'nome', 'cliente_nome', 'clienteNome', 'nomeCliente', 'nomeCompleto', 'name', 'fullname',
  
  // Document variations
  'rg', 'cnpj', 'documento', 'document',
  
  // Address variations
  'endereco', 'logradouro', 'rua', 'avenida', 'address', 'street',
  'complemento', 'bairro', 'cidade', 'city', 'neighborhood',
  'cep', 'zipcode', 'postalcode',
  
  // Authentication/Security
  'password', 'senha', 'token', 'authorization', 'auth', 'bearer',
  'secret', 'key', 'private', 'credential',
  
  // Banking
  'conta', 'account', 'agencia', 'branch', 'bank_account',
  
  // Webhook specific
  'webhookData', 'payload', 'payer', 'payee',
  
  // Generic fields that commonly contain PII
  'message', 'description', 'details', 'observacoes', 'text', 'content',
  'metadata', 'info', 'data'
];

/**
 * Deep sanitization that handles Error objects at any nesting level
 */
function deepSanitizeError(obj: any, depth: number = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[DEEP_OBJECT]';
  }

  if (!obj) {
    return obj;
  }

  // Handle Error objects specially to control stack trace exposure
  if (obj instanceof Error) {
    const sanitizedError: any = {
      name: obj.name,
      message: sanitizeString(obj.message),
    };
    
    // In production, completely redact stack traces
    if (process.env.NODE_ENV === 'production') {
      sanitizedError.stack = '[REDACTED_IN_PROD]';
    } else {
      sanitizedError.stack = obj.stack;
    }
    
    // Include other enumerable properties, but sanitize them
    for (const [key, value] of Object.entries(obj)) {
      if (!['name', 'message', 'stack'].includes(key)) {
        sanitizedError[key] = deepSanitizeError(value, depth + 1);
      }
    }
    
    return sanitizedError;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitizeError(item, depth + 1));
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isPIIField = PII_FIELDS.some(field => 
      lowerKey.includes(field.toLowerCase()) || 
      field.toLowerCase().includes(lowerKey)
    );

    if (isPIIField) {
      sanitized[key] = maskSensitiveValue(key, value);
    } else if (typeof value === 'string') {
      // CRITICAL FIX: Apply sanitizeString to ALL string values regardless of key
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = deepSanitizeError(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Advanced PII sanitization with smart field detection
 */
export function redactPII(obj: any, depth: number = 0): any {
  return deepSanitizeError(obj, depth);
}

/**
 * Smart masking based on field type and value
 */
function maskSensitiveValue(fieldName: string, value: any): string {
  if (!value || typeof value !== 'string') {
    return '[REDACTED]';
  }

  const lowerField = fieldName.toLowerCase();
  const cleanValue = String(value).trim();

  if (cleanValue.length === 0) {
    return '[EMPTY]';
  }

  // CPF specific masking
  if (lowerField.includes('cpf') && cleanValue.length >= 11) {
    const digits = cleanValue.replace(/\D/g, '');
    return `***.***.***-${digits.slice(-2)}`;
  }

  // Email specific masking
  if (lowerField.includes('email') && cleanValue.includes('@')) {
    const [local, domain] = cleanValue.split('@');
    return `${local.charAt(0)}***@${domain}`;
  }

  // Phone specific masking
  if (lowerField.includes('telefone') || lowerField.includes('phone')) {
    const digits = cleanValue.replace(/\D/g, '');
    if (digits.length >= 8) {
      return `****-${digits.slice(-4)}`;
    }
  }

  // Name specific masking
  if (lowerField.includes('nome') || lowerField.includes('name')) {
    if (cleanValue.length <= 2) {
      return '[NAME]';
    }
    return `${cleanValue.charAt(0)}***${cleanValue.charAt(cleanValue.length - 1)}`;
  }

  // Generic masking for other sensitive fields
  if (cleanValue.length <= 3) {
    return '[REDACTED]';
  }
  
  return `${cleanValue.substring(0, 2)}***${cleanValue.substring(cleanValue.length - 2)}`;
}

/**
 * Sanitize plain strings that might contain sensitive data
 */
function sanitizeString(str: string): string {
  // CPF pattern: 000.000.000-00 or 00000000000
  str = str.replace(/(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})/g, '***.***.***-**');
  
  // Email pattern
  str = str.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***');
  
  // Phone pattern
  str = str.replace(/(\(?\d{2}\)?\s?\d{4,5}-?\d{4})/g, '(**) ****-****');
  
  return str;
}

/**
 * Sanitize webhook payloads specifically
 */
export function sanitizeWebhookPayload(payload: any): any {
  const commonWebhookPIIFields = [
    'payer', 'payee', 'customer', 'cliente', 'pagador', 'beneficiario',
    'transaction', 'transacao', 'payment', 'pagamento'
  ];
  
  return redactPII(payload);
}

// Legacy compatibility
export const sanitizeForLog = redactPII;

/**
 * Enhanced Safe Logger with Winston integration
 */
export class SecureLogger {
  private static isDevelopment = process.env.NODE_ENV === 'development';

  static info(message: string, data?: any, skipSanitization: boolean = false) {
    const sanitizedData = skipSanitization || !data ? data : redactPII(data);
    logger.info(`🛡️ ${message}`, sanitizedData);
  }

  static debug(message: string, data?: any, skipSanitization: boolean = false) {
    const sanitizedData = skipSanitization || !data ? data : redactPII(data);
    logger.debug(`🛡️ ${message}`, sanitizedData);
  }

  static warn(message: string, data?: any, skipSanitization: boolean = false) {
    const sanitizedData = skipSanitization || !data ? data : redactPII(data);
    logger.warn(`🛡️ ${message}`, sanitizedData);
  }

  static error(message: string, error?: any, skipSanitization: boolean = false) {
    let sanitizedError = error;
    
    if (!skipSanitization && error) {
      // Use deepSanitizeError (via redactPII) to handle Error objects at any depth
      sanitizedError = redactPII(error);
    }
    
    logger.error(`🛡️ ${message}`, sanitizedError);
  }

  static security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', data?: any) {
    const sanitizedData = data ? redactPII(data) : {};
    logger.warn(`🔒 Security Event: ${event}`, {
      severity,
      event,
      timestamp: new Date().toISOString(),
      ...sanitizedData,
    });
  }

  static audit(action: string, userId: string | null, resource: string, data?: any) {
    const sanitizedData = data ? redactPII(data) : {};
    logger.info(`📝 Secure Audit Log`, {
      action,
      userId,
      resource,
      timestamp: new Date().toISOString(),
      ...sanitizedData,
    });
  }

  static webhook(event: string, payload: any, source?: string) {
    const sanitizedPayload = sanitizeWebhookPayload(payload);
    logger.info(`🔗 Webhook Event: ${event}`, {
      event,
      source: source || 'unknown',
      payload: sanitizedPayload,
      timestamp: new Date().toISOString(),
    });
  }
}

// Legacy compatibility
export const SafeLogger = SecureLogger;

// Helper functions for direct usage
export const secureLog = {
  info: SecureLogger.info,
  debug: SecureLogger.debug,
  warn: SecureLogger.warn,
  error: SecureLogger.error,
  security: SecureLogger.security,
  audit: SecureLogger.audit,
  webhook: SecureLogger.webhook,
};

// Default export for convenience
export default SecureLogger;
