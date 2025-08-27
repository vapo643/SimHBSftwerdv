/**
 * ClickSign Security Service
 * Enhanced security layer for ClickSign integration
 *
 * Implements OWASP security principles:
 * - Input validation
 * - Output encoding
 * - Secure logging
 * - Data encryption
 * - Rate limiting
 * - IP whitelisting
 */

import crypto from 'crypto';
import { z } from 'zod';
import xss from 'xss';

// Validation schemas following OWASP guidelines
const _CPFSchema = z.string().regex(/^\d{11}$/, 'CPF must be 11 digits without formatting');
const _EmailSchema = z.string().email().max(255);
const _NameSchema = z
  .string()
  .min(3)
  .max(255)
  .transform((val) => xss(val));
const _PhoneSchema = z.string().regex(/^\d{10,11}$/, 'Phone must be 10-11 digits');

const _ClientDataSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  cpf: CPFSchema,
  phone: PhoneSchema.optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const _PDFValidationSchema = z.object({
  size: z.number().max(20 * 1024 * 1024, 'PDF size must be under 20MB'),
  type: z.literal('application/pdf'),
  content: z.instanceof(Buffer),
});

// Webhook validation schemas (v1/v2 format)
const _WebhookEventSchema = z.object({
  event: z.string(),
  data: z.object({
    document: z
      .object({
        key: z.string(),
        filename: z.string().optional(),
        status: z.string().optional(),
      })
      .optional(),
    signer: z
      .object({
        email: z.string().email(),
        name: z.string().optional(),
      })
      .optional(),
    list: z
      .object({
        key: z.string(),
        status: z.string().optional(),
      })
      .optional(),
  }),
  occurred_at: z.string().optional(),
  hmac: z.string().optional(),
});

// Security configuration
interface SecurityConfig {
  encryptionKey: string;
  allowedIPs: string[];
  maxPDFSize: number;
  webhookRateLimit: number;
  sensitiveFields: string[];
}

class ClickSignSecurityService {
  private config: SecurityConfig;
  private webhookAttempts: Map<string, number[]> = new Map();

  constructor() {
    this.config = {
      encryptionKey: process.env.CLICKSIGN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
      allowedIPs: (process.env.CLICKSIGN_ALLOWED_IPS || '').split(',').filter(Boolean),
      maxPDFSize: 20 * 1024 * 1024, // 20MB
      webhookRateLimit: 100, // per minute per IP
      sensitiveFields: ['cpf', 'documentation', 'birthday', 'phone'],
    };
  }

  /**
   * Validate and sanitize client data
   */
  validateClientData(data): z.infer<typeof ClientDataSchema> {
    try {
      // Remove formatting from CPF
      if (data.cpf) {
        data.cpf = data.cpf.replace(/\D/g, '');
      }

      // Remove formatting from phone
      if (data.phone) {
        data.phone = data.phone.replace(/\D/g, '');
      }

      return ClientDataSchema.parse(_data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const _issues = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Invalid client data: ${issues}`);
      }
      throw error;
    }
  }

  /**
   * Validate PDF document
   */
  validatePDF(buffer: Buffer, filename: string): void {
    const _validation = PDFValidationSchema.safeParse({
      size: buffer.length,
      type: 'application/pdf',
      content: buffer,
    });

    if (!validation.success) {
      throw new Error(`Invalid PDF: ${validation.error.errors[0].message}`);
    }

    // Check PDF magic number
    const _pdfHeader = buffer.slice(0, 5).toString();
    if (!pdfHeader.startsWith('%PDF-')) {
      throw new Error('Invalid PDF file format');
    }

    // Validate filename
    if (!filename.match(/^[\w\-\.]+\.pdf$/i)) {
      throw new Error('Invalid filename format');
    }
  }

  /**
   * Validate webhook IP origin
   */
  validateWebhookIP(ip: string): boolean {
    if (this._config.allowedIPs.length == 0) {
      // No IP restriction configured
      return true;
    }

    const _normalizedIP = ip.replace(/^::ffff:/, ''); // Remove IPv6 prefix
    return this._config.allowedIPs.includes(normalizedIP);
  }

  /**
   * Check webhook rate limit
   */
  checkWebhookRateLimit(ip: string): boolean {
    const _now = Date.now();
    const _minute = 60 * 1000;
    const _attempts = this.webhookAttempts.get(ip) || [];

    // Remove old attempts
    const _recentAttempts = attempts.filter((time) => now - time < minute);

    if (recentAttempts.length >= this._config.webhookRateLimit) {
      return false;
    }

    recentAttempts.push(now);
    this.webhookAttempts.set(ip, recentAttempts);

    // Clean up old IPs
    if (this.webhookAttempts.size > 1000) {
      const _oldestIP = Array.from(this.webhookAttempts.entries()).sort(
        (a, b) => Math.max(...a[1]) - Math.max(...b[1])
      )[0][0];
      this.webhookAttempts.delete(oldestIP);
    }

    return true;
  }

  /**
   * Validate webhook event structure
   */
  validateWebhookEvent(event): z.infer<typeof WebhookEventSchema> {
    return WebhookEventSchema.parse(event);
  }

  /**
   * Encrypt sensitive data for storage
   */
  encryptSensitiveData(data: string): string {
    const _iv = crypto.randomBytes(16);
    const _cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(this._config.encryptionKey, 'hex'),
      iv
    );

    let _encrypted = cipher.update(_data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const _authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  decryptSensitiveData(encryptedData: string): string {
    const _parts = encryptedData.split(':');
    const _iv = Buffer.from(parts[0], 'hex');
    const _authTag = Buffer.from(parts[1], 'hex');
    const _encrypted = parts[2];

    const _decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(this._config.encryptionKey, 'hex'),
      iv
    );

    decipher.setAuthTag(authTag);

    let _decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Sanitize data for secure logging
   */
  sanitizeForLogging(data): unknown {
    if (!data) return data;

    const _sanitized = JSON.parse(JSON.stringify(_data));

    const _sanitizeObject = (obj) => {
      for (const key in obj) {
        if (this._config.sensitiveFields.includes(key.toLowerCase())) {
          obj[key] = this.maskSensitiveValue(obj[key]);
        } else if (typeof obj[key] == 'object') {
          sanitizeObject(obj[key]);
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * Mask sensitive values
   */
  private maskSensitiveValue(value): string {
    if (!value) return '[EMPTY]';

    const _str = String(value);
    if (str.length <= 4) return '[REDACTED]';

    return str.slice(0, 2) + '*'.repeat(str.length - 4) + str.slice(-2);
  }

  /**
   * Generate secure request ID for tracking
   */
  generateRequestId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validate ClickSign response
   */
  validateResponse(response): void {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid ClickSign response format');
    }

    // Check for error responses
    if (response.errors && Array.isArray(response.errors)) {
      const _errors = response.errors.map((e) => e.message || e.error).join(', ');
      throw new Error(`ClickSign API errors: ${errors}`);
    }
  }

  /**
   * Create security audit log entry
   */
  createAuditLog(action: string, data: unknown, userId?: string): unknown {
    return {
      timestamp: new Date().toISOString(),
      _action,
      userId: userId || 'system',
      requestId: this.generateRequestId(),
      environment: process.env.NODE_ENV,
      data: this.sanitizeForLogging(_data),
    };
  }
}

// Export singleton instance
export const _clickSignSecurityService = new ClickSignSecurityService();
