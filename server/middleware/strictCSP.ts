/**
 * Strict Content Security Policy Implementation
 * 
 * Implements OWASP Content Security Policy Cheat Sheet recommendations:
 * - Strict CSP with nonces for inline scripts
 * - Defense against XSS, clickjacking, and code injection
 * - CSP Level 3 features with broad browser support
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface CSPRequest extends Request {
  nonce?: string;
}

export class StrictCSP {
  /**
   * Generate cryptographically secure nonce
   */
  static generateNonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }
  
  /**
   * Middleware to generate CSP nonce and set strict policy
   */
  static middleware() {
    return (req: CSPRequest, res: Response, next: NextFunction) => {
      // Generate unique nonce for this request
      const nonce = StrictCSP.generateNonce();
      req.nonce = nonce;
      
      // Make nonce available to templates
      res.locals.nonce = nonce;
      
      // Build CSP policy based on environment
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      const cspPolicy = [
        // Default source - only self and data URIs for images
        "default-src 'self'",
        
        // Script source - different policies for dev vs prod
        isDevelopment 
          ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline' localhost:* 127.0.0.1:* ws: wss:`
          : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        
        // Object source - block all objects (Flash, Java, etc.)
        "object-src 'none'",
        
        // Base URI - prevent injection of base tag
        "base-uri 'self'",
        
        // Form action - restrict form submissions
        "form-action 'self'",
        
        // Frame ancestors - prevent clickjacking (replaces X-Frame-Options)
        "frame-ancestors 'none'",
        
        // Style source - allow inline styles but restrict external
        `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
        
        // Font source - self and data URIs
        "font-src 'self' data:",
        
        // Image source - self, data URIs, and blob for dynamic content
        "img-src 'self' data: blob:",
        
        // Media source - self only
        "media-src 'self'",
        
        // Connect source - API calls and WebSocket connections
        isDevelopment
          ? "connect-src 'self' ws: wss: localhost:* 127.0.0.1:* https:"
          : "connect-src 'self' ws: wss:",
        
        // Worker source - web workers and service workers
        "worker-src 'self' blob:",
        
        // Child source - frames and workers
        "child-src 'self' blob:",
        
        // Manifest source - web app manifests
        "manifest-src 'self'",
        
        // Upgrade insecure requests in production
        ...(process.env.NODE_ENV === 'production' ? ["upgrade-insecure-requests"] : []),
        
        // Block mixed content in production
        ...(process.env.NODE_ENV === 'production' ? ["block-all-mixed-content"] : [])
      ].join('; ');
      
      // Set Content Security Policy header
      res.setHeader('Content-Security-Policy', cspPolicy);
      
      // Also set report-only for testing (optional)
      if (process.env.NODE_ENV === 'development') {
        const reportOnlyPolicy = cspPolicy.replace(
          `'nonce-${nonce}'`, 
          `'nonce-${nonce}' 'unsafe-eval'`
        );
        res.setHeader('Content-Security-Policy-Report-Only', reportOnlyPolicy);
      }
      
      // Additional security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Permissions Policy (Feature Policy successor)
      res.setHeader('Permissions-Policy', [
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(),',
        'accelerometer=(), gyroscope=(), magnetometer=(), speaker=(),',
        'notifications=(), push=(), vibrate=()'
      ].join(' '));
      
      console.log(`[CSP] ✅ ${isDevelopment ? 'Development' : 'Production'} CSP applied:`, {
        nonce: nonce.substring(0, 8) + '...',
        path: req.path,
        mode: isDevelopment ? 'dev' : 'prod',
        userAgent: req.headers['user-agent']?.substring(0, 50)
      });
      
      next();
    };
  }
  
  /**
   * Get CSP violation report endpoint
   */
  static violationReportEndpoint() {
    return (req: Request, res: Response) => {
      const report = req.body;
      
      console.warn('[CSP] 🚨 CSP Violation Report:', {
        documentURI: report['document-uri'],
        violatedDirective: report['violated-directive'],
        blockedURI: report['blocked-uri'],
        lineNumber: report['line-number'],
        columnNumber: report['column-number'],
        sourceFile: report['source-file'],
        statusCode: report['status-code'],
        userAgent: req.headers['user-agent']
      });
      
      // Log to security monitoring system
      // This could integrate with your existing security logger
      
      res.status(204).end();
    };
  }
  
  /**
   * Validate that inline scripts use nonce
   */
  static validateInlineScript(scriptContent: string, nonce: string): boolean {
    // Check if script tag includes the correct nonce
    const noncePattern = new RegExp(`nonce=["']${nonce}["']`);
    return noncePattern.test(scriptContent);
  }
  
  /**
   * Generate safe inline script with nonce
   */
  static generateInlineScript(scriptContent: string, nonce: string): string {
    return `<script nonce="${nonce}">${scriptContent}</script>`;
  }
  
  /**
   * Generate safe inline style with nonce
   */
  static generateInlineStyle(styleContent: string, nonce: string): string {
    return `<style nonce="${nonce}">${styleContent}</style>`;
  }
}

/**
 * Export middleware for easy use
 */
export const strictCSP = StrictCSP.middleware();

/**
 * CSP violation report handler
 */
export const cspViolationReport = StrictCSP.violationReportEndpoint();

export default StrictCSP;