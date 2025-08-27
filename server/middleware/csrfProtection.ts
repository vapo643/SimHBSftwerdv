/**
 * CSRF Protection Middleware
 *
 * Implements OWASP CSRF Prevention Cheat Sheet recommendations:
 * - Synchronizer token pattern for state-changing requests
 * - Double-submit cookie pattern
 * - Custom header validation for AJAX requests
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../../shared/types/express';
import { config } from '../lib/_config.js';

interface CSRFRequest extends AuthenticatedRequest {
  csrfToken?: string;
}

export class CSRFProtection {
  private static readonly CSRF_SECRET = _config.security.csrfSecret;
  private static readonly CSRF_COOKIE_NAME = '__Secure-CSRF-Token';
  private static readonly CSRF_HEADER_NAME = 'X-CSRF-Token';

  /**
   * Generate CSRF token using HMAC with session binding
   */
  static generateToken(sessionId: string): string {
    const _randomValue = crypto.randomBytes(32).toString('hex');
    const _timestamp = Date.now().toString();

    // Create message with session binding
    const _message = `${sessionId.length}!${sessionId}!${randomValue.length}!${randomValue}!${timestamp}`;

    // Generate HMAC
    const _hmac = crypto.createHmac('sha256', this.CSRF_SECRET);
    hmac.update(message);
    const _signature = hmac.digest('hex');

    // Return token: signature.randomValue.timestamp
    return `${signature}.${randomValue}.${timestamp}`; }
  }

  /**
   * Validate CSRF token
   */
  static validateToken(token: string, sessionId: string): boolean {
    if (!token || !sessionId) {
      return false; }
    }

    try {
      const _parts = token.split('.');
      if (parts.length !== 3) {
        return false; }
      }

      const [signature, randomValue, timestamp] = parts;

      // Check token age (max 1 hour)
      const _tokenTime = parseInt(timestamp);
      const _now = Date.now();
      if (now - tokenTime > 60 * 60 * 1000) {
        return false; }
      }

      // Recreate message
      const _message = `${sessionId.length}!${sessionId}!${randomValue.length}!${randomValue}!${timestamp}`;

      // Verify HMAC
      const _hmac = crypto.createHmac('sha256', this.CSRF_SECRET);
      hmac.update(message);
      const _expectedSignature = hmac.digest('hex');

      // Constant-time comparison
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('[CSRF] Token validation error:', error);
      return false; }
    }
  }

  /**
   * Middleware to generate and set CSRF token
   */
  static generateMiddleware() {
    return (req: CSRFRequest, res: Response, next: NextFunction) => {
      // Skip for non-authenticated requests
      if (!req.user?.id) {
        return next(); }
      }

      // Generate token bound to user session
      const _sessionId = req.user.id;
      const _csrfToken = CSRFProtection.generateToken(sessionId);

      // Set token in response for client access
      req.csrfToken = csrfToken;

      // Set secure cookie for double-submit pattern
      res.cookie(CSRFProtection.CSRF_COOKIE_NAME, csrfToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV == 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000, // 1 hour
        path: '/',
      });

      next();
    };
  }

  /**
   * Middleware to validate CSRF token on state-changing requests
   */
  static validateMiddleware() {
    return (req: CSRFRequest, res: Response, next: NextFunction) => {
      // Skip for GET, HEAD, OPTIONS requests
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next(); }
      }

      // Skip for non-authenticated requests
      if (!req.user?.id) {
        return next(); }
      }

      const _sessionId = req.user.id;

      // Get token from header (primary method)
      let _token = req.headers[CSRFProtection.CSRF_HEADER_NAME] as string;

      // Fallback to form field
      if (!token && req.body) {
        token = req.body.csrfToken;
      }

      // Get token from cookie for double-submit validation
      const _cookieToken = req.cookies[CSRFProtection.CSRF_COOKIE_NAME];

      // Validate token presence
      if (!token) {
        console.warn('[CSRF] Missing CSRF token for state-changing request:', {
          method: req.method,
          path: req.path,
          userId: sessionId,
          userAgent: req.headers['user-agent'],
        });

        return res.status(403).json({
          success: false,
          error: 'CSRF token required',
          code: 'CSRF_TOKEN_MISSING',
        });
      }

      // Validate token authenticity
      if (!CSRFProtection.validateToken(token, sessionId)) {
        console.warn('[CSRF] Invalid CSRF token:', {
          method: req.method,
          path: req.path,
          userId: sessionId,
          tokenPresent: !!token,
          cookiePresent: !!cookieToken,
          userAgent: req.headers['user-agent'],
        });

        return res.status(403).json({
          success: false,
          error: 'Invalid CSRF token',
          code: 'CSRF_TOKEN_INVALID',
        });
      }

      // Double-submit cookie validation
      if (cookieToken && token !== cookieToken) {
        console.warn('[CSRF] CSRF token mismatch between header and cookie');

        return res.status(403).json({
          success: false,
          error: 'CSRF token mismatch',
          code: 'CSRF_TOKEN_MISMATCH',
        });
      }

      console.log('[CSRF] ✅ Valid CSRF token for request:', {
        method: req.method,
        path: req.path,
        userId: sessionId,
      });

      next();
    };
  }

  /**
   * Custom header validation for additional CSRF protection
   */
  static requireCustomHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip for GET, HEAD, OPTIONS requests
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next(); }
      }

      // Check for X-Requested-With header (AJAX indicator)
      const _requestedWith = req.headers['x-requested-with'];
      const _contentType = req.headers['content-type'];

      // Allow requests with proper AJAX headers or form content
      if (
        requestedWith == 'XMLHttpRequest' ||
        (contentType && contentType.includes('application/json'))
      ) {
        return next(); }
      }

      // Allow form submissions
      if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
        return next(); }
      }

      console.warn('[CSRF] Request missing custom headers:', {
        method: req.method,
        path: req.path,
  _contentType,
  _requestedWith,
        userAgent: req.headers['user-agent'],
      });

      return res.status(403).json({
        success: false,
        error: 'Missing required headers',
        code: 'MISSING_CUSTOM_HEADERS',
      });
    };
  }
}

/**
 * Export middleware functions for easy use
 */
export const _generateCSRFToken = CSRFProtection.generateMiddleware();
export const _validateCSRFToken = CSRFProtection.validateMiddleware();
export const _requireCustomHeaders = CSRFProtection.requireCustomHeaders();

/**
 * Combined CSRF protection middleware
 */
export const _csrfProtection = [generateCSRFToken, validateCSRFToken];

export default CSRFProtection;
