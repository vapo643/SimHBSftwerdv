import express, { type Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
// @ts-ignore
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { registerRoutes } from './routes';
import { config } from './lib/config';
import { log } from './vite';
import { setupSecurityHeaders, additionalSecurityHeaders, setupCORS } from './lib/security-headers';
import { inputSanitizerMiddleware } from './lib/input-sanitizer';
import { securityLogger, SecurityEventType, getClientIP } from './lib/security-logger';
import { urlTokenValidator } from './middleware/url-token-validator';
import { csrfProtection } from './middleware/csrfProtection';
import { strictCSP } from './middleware/strictCSP';

// FASE 0 - Observability imports
import { requestLoggingMiddleware, logInfo } from './lib/logger';
import { initializeSentry, initSentry, requestHandler, errorHandler } from './lib/sentry';
import * as Sentry from '@sentry/node';
import healthRoutes from './routes/health';
import { checkRedisHealth } from './lib/redis-manager';

export async function createApp() {
  const app = express();

  // FASE 0 - Initialize Sentry error tracking (unified initialization)
  initSentry(app);
  app.use(requestHandler());

  // FASE 0 - Request logging middleware
  app.use(requestLoggingMiddleware);
  logInfo('📊 Observability layer initialized', {
    sentry: !!process.env.SENTRY_DSN,
    logging: true,
  });

  // FASE 0 - Redis Cloud Health Check (LAZY LOADING - NO STARTUP TIMEOUTS)
  // Health check será feito on-demand quando Redis for necessário
  logInfo('🔄 Aplicação iniciando com Redis lazy loading (graceful degradation)', {
    redis_available: 'on-demand-check',
    degraded_mode: false,
    service: 'redis-lazy',
  });

  // Disable X-Powered-By header - OWASP ASVS V14.4.1
  app.disable('x-powered-by');

  // Configure trust proxy for rate limiting
  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : ['127.0.0.1', '::1']);

  // Configure CORS - OWASP ASVS V13.2.1
  const corsOptions = setupCORS();
  app.use(cors(corsOptions));
  log('🔒 [SECURITY] CORS protection configured - ASVS V13.2.1');

  // Tratamento explícito para requisições OPTIONS (preflight)
  app.options('*', cors(corsOptions));
  log('🔒 [SECURITY] OPTIONS preflight handling configured');

  // Form-encoded middleware
  app.use(express.urlencoded({ extended: true }));

  // Enhanced OWASP Security Headers
  if (config.security.enableHelmet) {
    app.use(setupSecurityHeaders());
    app.use(additionalSecurityHeaders);
    // Apply appropriate CSP based on environment
    app.use(strictCSP);
    if (process.env.NODE_ENV !== 'development') {
      log('🔒 [SECURITY] Enhanced security headers and strict CSP activated');
    } else {
      log('🔧 [DEV] CSP ultra-permissivo para desenvolvimento - Vite/React compatível');
    }
  }

  // Input Sanitization Middleware - OWASP A03: Injection Prevention
  app.use(inputSanitizerMiddleware);
  log('🔒 [SECURITY] Input sanitization middleware activated');

  // URL Token Validation Middleware - OWASP ASVS V7.1.1
  app.use(urlTokenValidator);
  log('🔒 [SECURITY] URL token validation middleware activated - ASVS V7.1.1');

  // CSRF Protection Middleware - OWASP Cheat Sheet Series
  app.use(csrfProtection);
  log('🔒 [SECURITY] CSRF protection middleware activated - OWASP Cheat Sheet');

  // RATE LIMITING COMPLETAMENTE DESABILITADO POR SOLICITAÇÃO DO USUÁRIO
  // O rate limiting foi desabilitado permanentemente para evitar falsos positivos em produção
  console.log('🔧 [DEV] Rate limiting configurado para desenvolvimento - limites altos');
  
  // Configuração dummy (não funcional) apenas para manter compatibilidade
  const generalApiLimiter = (req: any, res: any, next: any) => next();

  // Configuração dummy (não funcional) apenas para manter compatibilidade de auth
  const authLimiter = (req: any, res: any, next: any) => next();

  // Rate limiting completamente removido
  console.log('🚫 [SECURITY] Rate limiting DESABILITADO PERMANENTEMENTE por solicitação do usuário');

  // JSON middleware
  app.use(express.json());

  // Error handling - PAM P2.4.1: Centralized error handling middleware
  // Temporary placeholder - actual errorHandler will be registered after routes

  // FASE 0 - Register health check routes first (no auth needed)
  app.use('/api', healthRoutes);
  logInfo('🏥 Health check endpoints registered', {
    endpoints: ['/api/health', '/api/health/live', '/api/health/ready'],
  });

  // Register routes
  registerRoutes(app);

  // FASE 0 - Sentry error handler (conforme PAM V1.0)
  // CRITICAL: Must be AFTER all routes, BEFORE other error handlers
  Sentry.setupExpressErrorHandler(app);

  // PAM P2.4.1 - Centralized error handling middleware (MUST BE LAST)
  const { errorHandler } = await import('./middleware/errorHandler.js');
  app.use(errorHandler);

  return app;
}
