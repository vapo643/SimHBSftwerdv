import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { config } from "./lib/config";
import { log } from "./vite";
import { setupSecurityHeaders, additionalSecurityHeaders, setupCORS } from "./lib/security-headers";
import { inputSanitizerMiddleware } from "./lib/input-sanitizer";
import { securityLogger, SecurityEventType, getClientIP } from "./lib/security-logger";
import { urlTokenValidator } from "./middleware/url-token-validator";
import { csrfProtection } from "./middleware/csrfProtection";
import { strictCSP } from "./middleware/strictCSP";

export async function createApp() {
  const app = express();

  // Disable X-Powered-By header - OWASP ASVS V14.4.1
  app.disable('x-powered-by');

  // Configure trust proxy for rate limiting
  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : ['127.0.0.1', '::1']);

  // Configure CORS - OWASP ASVS V13.2.1
  const corsOptions = setupCORS();
  app.use(cors(corsOptions));
  log("🔒 [SECURITY] CORS protection configured - ASVS V13.2.1");

  // Form-encoded middleware
  app.use(express.urlencoded({ extended: true }));

  // Enhanced OWASP Security Headers
  if (config.security.enableHelmet) {
    app.use(setupSecurityHeaders());
    app.use(additionalSecurityHeaders);
    // Temporarily disable CSP in development to fix blank screen issue
    if (process.env.NODE_ENV !== 'development') {
      app.use(strictCSP);
      log("🔒 [SECURITY] Enhanced security headers and strict CSP activated");
    } else {
      log("🔧 [DEV] CSP disabled in development mode for debugging");
    }
  }
  
  // Input Sanitization Middleware - OWASP A03: Injection Prevention
  app.use(inputSanitizerMiddleware);
  log("🔒 [SECURITY] Input sanitization middleware activated");

  // URL Token Validation Middleware - OWASP ASVS V7.1.1
  app.use(urlTokenValidator);
  log("🔒 [SECURITY] URL token validation middleware activated - ASVS V7.1.1");

  // CSRF Protection Middleware - OWASP Cheat Sheet Series
  app.use(csrfProtection);
  log("🔒 [SECURITY] CSRF protection middleware activated - OWASP Cheat Sheet");

  // Rate Limiting - Configuração por ambiente
  if (process.env.NODE_ENV !== 'test') {
    // Configurações diferentes por ambiente
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const generalApiLimiter = rateLimit({
      windowMs: isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1min dev, 15min prod
      max: isDevelopment ? 10000 : 1000, // 10k dev, 1k prod (muito mais permissivo)
      message: {
        error: isDevelopment 
          ? "Rate limit atingido (modo desenvolvimento - limites altos)" 
          : "Muitas requisições da API. Tente novamente em 15 minutos.",
        retryAfter: isDevelopment ? "1 minuto" : "15 minutos"
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        securityLogger.logEvent({
          type: SecurityEventType.RATE_LIMIT_EXCEEDED,
          severity: isDevelopment ? "LOW" : "MEDIUM",
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
          endpoint: req.originalUrl,
          success: false,
          details: { 
            type: 'general_api',
            environment: process.env.NODE_ENV,
            limit: isDevelopment ? 10000 : 1000
          }
        });
        res.status(429).json({
          error: isDevelopment 
            ? "Rate limit atingido (modo desenvolvimento - limites altos)" 
            : "Muitas requisições da API. Tente novamente em 15 minutos.",
          retryAfter: isDevelopment ? "1 minuto" : "15 minutos"
        });
      }
    });

    const authLimiter = rateLimit({
      windowMs: isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1min dev, 15min prod
      max: isDevelopment ? 1000 : 20, // 1000 dev, 20 prod (muito mais permissivo)
      skipSuccessfulRequests: true,
      message: {
        error: isDevelopment
          ? "Rate limit auth atingido (modo desenvolvimento)"
          : "Muitas tentativas de autenticação. Tente novamente em 15 minutos.",
        retryAfter: isDevelopment ? "1 minuto" : "15 minutos"
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        securityLogger.logEvent({
          type: SecurityEventType.BRUTE_FORCE_DETECTED,
          severity: isDevelopment ? "LOW" : "HIGH",
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
          endpoint: req.originalUrl,
          success: false,
          details: { 
            type: 'authentication_brute_force',
            environment: process.env.NODE_ENV,
            limit: isDevelopment ? 1000 : 20
          }
        });
        res.status(429).json({
          error: isDevelopment
            ? "Rate limit auth atingido (modo desenvolvimento)"
            : "Muitas tentativas de autenticação. Tente novamente em 15 minutos.",
          retryAfter: isDevelopment ? "1 minuto" : "15 minutos"
        });
      }
    });

    app.use("/api/", generalApiLimiter);
    app.use("/api/auth/", authLimiter);
    
    if (isDevelopment) {
      log("🔧 [DEV] Rate limiting configurado para desenvolvimento - limites altos");
    } else {
      log("🔒 [PROD] Rate limiting configurado para produção - limites seguros");
    }
  }

  // JSON middleware
  app.use(express.json());

  // Error handling
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (status === 500) {
      console.error(`[express] Error:`, err);
    }

    res.status(status).json({ message });
  });

  // Register routes
  registerRoutes(app);

  return app;
}