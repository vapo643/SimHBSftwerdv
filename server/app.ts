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

  // Rate Limiting (only in production/staging)
  if (process.env.NODE_ENV !== 'test') {
    const generalApiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: {
        error: "Muitas requisições da API. Tente novamente em 15 minutos.",
        retryAfter: "15 minutos"
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        securityLogger.logEvent({
          type: SecurityEventType.RATE_LIMIT_EXCEEDED,
          severity: "MEDIUM",
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
          endpoint: req.originalUrl,
          success: false,
          details: { type: 'general_api' }
        });
        res.status(429).json({
          error: "Muitas requisições da API. Tente novamente em 15 minutos.",
          retryAfter: "15 minutos"
        });
      }
    });

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      skipSuccessfulRequests: true,
      message: {
        error: "Muitas tentativas de autenticação. Tente novamente em 15 minutos.",
        retryAfter: "15 minutos"
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        securityLogger.logEvent({
          type: SecurityEventType.BRUTE_FORCE_DETECTED,
          severity: "HIGH",
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
          endpoint: req.originalUrl,
          success: false,
          details: { type: 'authentication_brute_force' }
        });
        res.status(429).json({
          error: "Muitas tentativas de autenticação. Tente novamente em 15 minutos.",
          retryAfter: "15 minutos"
        });
      }
    });

    app.use("/api/", generalApiLimiter);
    app.use("/api/auth/", authLimiter);
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