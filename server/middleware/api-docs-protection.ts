/**
 * API Documentation Protection - OWASP ASVS V14.3.3
 * 
 * Prevents public access to API documentation in production
 * while allowing it in development for easier testing.
 */

import { Request, Response, NextFunction } from 'express';
import { getEnvironmentConfig } from '../config/environment';
import { securityLogger, SecurityEventType, getClientIP } from '../lib/security-logger';

// Endpoints that expose API structure
const API_DOC_ENDPOINTS = [
  '/api/docs',
  '/api/swagger',
  '/api/openapi',
  '/api/schema',
  '/api/routes',
  '/api/endpoints',
  '/api-docs',
  '/swagger-ui',
  '/redoc',
  '/graphql',
  '/graphiql',
  '/__debug__',
  '/debug',
  '/test'
];

/**
 * Middleware to protect API documentation endpoints
 */
export function apiDocsProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  const config = getEnvironmentConfig();
  
  // Allow in development
  if (config.enableApiDocs) {
    return next();
  }
  
  // Check if requesting a documentation endpoint
  const isDocEndpoint = API_DOC_ENDPOINTS.some(endpoint => 
    req.path.toLowerCase().startsWith(endpoint)
  );
  
  if (isDocEndpoint) {
    // Log attempted access
    securityLogger.logEvent({
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: 'MEDIUM',
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      endpoint: req.originalUrl,
      success: false,
      details: {
        reason: 'API documentation access attempt',
        environment: config.name
      }
    });
    
    // Return 404 to hide existence
    return res.status(404).json({
      error: 'Endpoint não encontrado'
    });
  }
  
  next();
}

/**
 * Middleware to prevent API enumeration
 */
export function apiEnumerationProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  const config = getEnvironmentConfig();
  
  // Only apply in production/staging
  if (config.name === 'development') {
    return next();
  }
  
  // Detect potential enumeration attempts
  const suspiciousPatterns = [
    /\/api\/v\d+\/\*/, // Wildcard attempts
    /\/api\/.*\?.*test.*=/i, // Test parameters
    /\/api\/.*\?.*debug.*=/i, // Debug parameters
    /\/api\/.*\.\.\// // Directory traversal
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.originalUrl)
  );
  
  if (isSuspicious) {
    // Log enumeration attempt
    securityLogger.logEvent({
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: 'HIGH',
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      endpoint: req.originalUrl,
      success: false,
      details: {
        reason: 'API enumeration attempt',
        method: req.method,
        query: req.query
      }
    });
    
    // Return generic error
    return res.status(400).json({
      error: 'Requisição inválida'
    });
  }
  
  next();
}

/**
 * Generate fake API documentation for honeypot
 */
export function generateFakeApiDocs(req: Request, res: Response) {
  // Log access attempt
  securityLogger.logEvent({
    type: SecurityEventType.SUSPICIOUS_ACTIVITY,
    severity: 'HIGH',
    userId: (req as any).user?.id,
    userEmail: (req as any).user?.email,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'],
    endpoint: req.originalUrl,
    success: false,
    details: {
      honeypot: true,
      reason: 'Fake API documentation accessed'
    }
  });
  
  // Return realistic but fake documentation
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'Internal API',
      version: '1.0.0',
      description: 'Internal use only'
    },
    servers: [
      { url: '/api/v1' }
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          responses: {
            '200': {
              description: 'Service healthy'
            }
          }
        }
      }
    }
  });
}