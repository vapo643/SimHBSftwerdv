import { Request, Response, NextFunction } from 'express';

/**
 * OWASP ASVS V7.1.1 - URL Token Security Middleware
 * Ensures that JWT tokens are never passed in URL parameters
 */

// List of parameter names that might contain tokens
const TOKEN_PARAM_NAMES = [
  'token',
  'jwt',
  'auth',
  'access_token',
  'session',
  'authorization',
  'bearer',
  'api_key',
  'session_id',
];

// Pattern to detect JWT-like strings
const JWT_PATTERN = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;

export function urlTokenValidator(req: Request, res: Response, next: NextFunction) {
  // 🚀 EXCEÇÃO PARA SSE: EventSource não suporta headers customizados
  // Permitir tokens via query parameter APENAS para /api/events
  if (req.path === '/api/events') {
    console.log('[SSE SECURITY] ✅ Token permitido via URL para SSE endpoint');
    return next();
  }

  // Check query parameters
  const queryKeys = Object.keys(req.query);

  for (const key of queryKeys) {
    // Check if parameter name suggests it might contain a token
    const lowerKey = key.toLowerCase();
    if (TOKEN_PARAM_NAMES.some((tokenParam) => lowerKey.includes(tokenParam))) {
      return res.status(400).json({
        error: 'Por motivos de segurança, tokens não podem ser passados em parâmetros de URL',
        code: 'URL_TOKEN_FORBIDDEN',
      });
    }

    // Check if value looks like a JWT token
    const value = req.query[key];
    if (typeof value === 'string' && JWT_PATTERN.test(value)) {
      return res.status(400).json({
        error: 'Detectado possível token em parâmetro de URL. Use o header Authorization.',
        code: 'URL_TOKEN_DETECTED',
      });
    }
  }

  // Check URL path for token-like segments (skip file extensions)
  const pathSegments = req.path.split('/');
  for (const segment of pathSegments) {
    // Skip file extensions and development files
    if (segment.includes('.')) {
      const parts = segment.split('.');
      const extension = parts[parts.length - 1].toLowerCase();
      // Skip common file extensions
      if (['ts', 'tsx', 'js', 'jsx', 'css', 'scss', 'html', 'json', 'md', 'txt', 'map'].includes(extension)) {
        continue;
      }
    }
    
    if (JWT_PATTERN.test(segment)) {
      return res.status(400).json({
        error: 'Tokens não devem ser incluídos no caminho da URL',
        code: 'PATH_TOKEN_DETECTED',
      });
    }
  }

  // Security logging for monitoring
  if (req.query.token || req.query.jwt || req.query.auth) {
    console.warn(`[SECURITY] Token in URL attempt from IP: ${req.ip}, Path: ${req.path}`);
  }

  next();
}

/**
 * Strips sensitive parameters from URLs in responses
 */
export function sanitizeResponseUrls(data: any): any {
  if (typeof data === 'string') {
    // Remove token parameters from URLs
    return data.replace(/([?&])(token|jwt|auth|access_token|session)=[^&]*/gi, '$1');
  }

  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map((item) => sanitizeResponseUrls(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeResponseUrls(value);
    }
    return sanitized;
  }

  return data;
}
