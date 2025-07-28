import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { config } from "./lib/config";
import { log } from "./vite";

export async function createApp() {
  const app = express();

  // Configure trust proxy for rate limiting
  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : ['127.0.0.1', '::1']);

  // Form-encoded middleware
  app.use(express.urlencoded({ extended: true }));

  // Helmet Security Headers (Conditional)
  if (config.security.enableHelmet) {
    app.use(helmet({
      contentSecurityPolicy: process.env.NODE_ENV === "development" ? false : {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
          scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
          fontSrc: ["'self'", "https:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      frameguard: { action: 'deny' },
      noSniff: true,
      referrerPolicy: { policy: "same-origin" },
      xssFilter: true,
    }));
  }

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
    });

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      skipSuccessfulRequests: true,
      message: {
        error: "Muitas tentativas de autenticação. Tente novamente em 15 minutos.",
        retryAfter: "15 minutos"
      },
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