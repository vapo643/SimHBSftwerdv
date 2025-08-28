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
import { CryptoService, type CryptoConfig } from './cryptoService.js';

// Validation schemas following OWASP guidelines
const CPFSchema = z.string().regex(/^\d{11}$/, 'CPF must be 11 digits without formatting');
const EmailSchema = z.string().email().max(255);
const NameSchema = z
  .string()
  .min(3)
  .max(255)
  .transform((val) => xss(val));
const PhoneSchema = z.string().regex(/^\d{10,11}$/, 'Phone must be 10-11 digits');

const ClientDataSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  cpf: CPFSchema,
  phone: PhoneSchema.optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const PDFValidationSchema = z.object({
  size: z.number().max(20 * 1024 * 1024, 'PDF size must be under 20MB'),
  type: z.literal('application/pdf'),
  content: z.instanceof(Buffer),
});

// Webhook validation schemas (v1/v2 format)
const WebhookEventSchema = z.object({
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
  private cryptoService: CryptoService;

  constructor() {
    const encryptionKey = process.env.CLICKSIGN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    
    this.config = {
      encryptionKey,
      allowedIPs: (process.env.CLICKSIGN_ALLOWED_IPS || '').split(',').filter(Boolean),
      maxPDFSize: 20 * 1024 * 1024, // 20MB
      webhookRateLimit: 100, // per minute per IP
      sensitiveFields: ['cpf', 'documentation', 'birthday', 'phone'],
    };

    // Initialize crypto service with dependency injection
    this.cryptoService = new CryptoService({ encryptionKey });
  }

  /**
   * Validate and sanitize client data
   */
  validateClientData(data: any): z.infer<typeof ClientDataSchema> {
    try {
      // Remove formatting from CPF
      if (data.cpf) {
        data.cpf = data.cpf.replace(/\D/g, '');
      }

      // Remove formatting from phone
      if (data.phone) {
        data.phone = data.phone.replace(/\D/g, '');
      }

      return ClientDataSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Invalid client data: ${issues}`);
      }
      throw error;
    }
  }

  /**
   * Validate PDF document
   */
  validatePDF(buffer: Buffer, filename: string): void {
    const validation = PDFValidationSchema.safeParse({
      size: buffer.length,
      type: 'application/pdf',
      content: buffer,
    });

    if (!validation.success) {
      throw new Error(`Invalid PDF: ${validation.error.errors[0].message}`);
    }

    // Check PDF magic number
    const pdfHeader = buffer.slice(0, 5).toString();
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
    if (this.config.allowedIPs.length === 0) {
      // No IP restriction configured
      return true;
    }

    const normalizedIP = ip.replace(/^::ffff:/, ''); // Remove IPv6 prefix
    return this.config.allowedIPs.includes(normalizedIP);
  }

  /**
   * Check webhook rate limit
   */
  checkWebhookRateLimit(ip: string): boolean {
    const now = Date.now();
    const minute = 60 * 1000;
    const attempts = this.webhookAttempts.get(ip) || [];

    // Remove old attempts
    const recentAttempts = attempts.filter((time) => now - time < minute);

    if (recentAttempts.length >= this.config.webhookRateLimit) {
      return false;
    }

    recentAttempts.push(now);
    this.webhookAttempts.set(ip, recentAttempts);

    // Clean up old IPs
    if (this.webhookAttempts.size > 1000) {
      const oldestIP = Array.from(this.webhookAttempts.entries()).sort(
        (a, b) => Math.max(...a[1]) - Math.max(...b[1])
      )[0][0];
      this.webhookAttempts.delete(oldestIP);
    }

    return true;
  }

  /**
   * Validate webhook event structure
   */
  validateWebhookEvent(event: any): z.infer<typeof WebhookEventSchema> {
    return WebhookEventSchema.parse(event);
  }

  /**
   * Encrypt sensitive data for storage
   * Delegates to centralized CryptoService
   */
  encryptSensitiveData(data: string): string {
    return this.cryptoService.encryptSensitiveData(data);
  }

  /**
   * Decrypt sensitive data
   * Delegates to centralized CryptoService
   */
  decryptSensitiveData(encryptedData: string): string {
    return this.cryptoService.decryptSensitiveData(encryptedData);
  }

  /**
   * Sanitize data for secure logging
   */
  sanitizeForLogging(data: any): any {
    if (!data) return data;

    const sanitized = JSON.parse(JSON.stringify(data));

    const sanitizeObject = (obj: any) => {
      for (const key in obj) {
        if (this.config.sensitiveFields.includes(key.toLowerCase())) {
          obj[key] = this.maskSensitiveValue(obj[key]);
        } else if (typeof obj[key] === 'object') {
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
  private maskSensitiveValue(value: any): string {
    if (!value) return '[EMPTY]';

    const str = String(value);
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
  validateResponse(response: any): void {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid ClickSign response format');
    }

    // Check for error responses
    if (response.errors && Array.isArray(response.errors)) {
      const errors = response.errors.map((e: any) => e.message || e.error).join(', ');
      throw new Error(`ClickSign API errors: ${errors}`);
    }
  }

  /**
   * Create security audit log entry
   */
  createAuditLog(action: string, data: any, userId?: string): any {
    return {
      timestamp: new Date().toISOString(),
      action,
      userId: userId || 'system',
      requestId: this.generateRequestId(),
      environment: process.env.NODE_ENV,
      data: this.sanitizeForLogging(data),
    };
  }
}

// Export singleton instance
export const clickSignSecurityService = new ClickSignSecurityService();
