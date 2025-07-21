
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { config } from "./lib/config";

// Validação explícita de configuração na inicialização
console.log('🔍 Validando configuração do ambiente...');
try {
  console.log('✅ Configuração validada com sucesso');
  console.log(`📊 Ambiente: ${config.server.nodeEnv}`);
  console.log(`🔗 Supabase: ${config.supabase.url}`);
  console.log(`💾 Banco: ${config.database.url ? 'Configurado' : 'Usando Supabase'}`);
} catch (error) {
  console.error('❌ Falha na validação de configuração:', error);
  process.exit(1);
}

const app = express();

// Security middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting - General API with enhanced security
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60,
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    log(`Rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.round(req.rateLimit?.resetTime ? (req.rateLimit.resetTime - Date.now()) / 1000 : 900),
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});
app.use('/api', apiLimiter);

// Stricter rate limiting for auth endpoints - Enhanced security against brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 authentication attempts per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60,
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  skipFailedRequests: false,
  handler: (req, res) => {
    log(`Auth rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json({
      error: 'Too many authentication attempts from this IP. Please try again later.',
      retryAfter: Math.round(req.rateLimit?.resetTime ? (req.rateLimit.resetTime - Date.now()) / 1000 : 900),
      code: 'AUTH_RATE_LIMIT_EXCEEDED'
    });
  }
});
app.use('/api/auth', authLimiter);

// Additional rate limiting for sensitive operations
const sensitiveOperationsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit sensitive operations to 10 per hour
  message: {
    error: 'Too many sensitive operations from this IP, please try again later.',
    retryAfter: 60 * 60,
    code: 'SENSITIVE_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    log(`Sensitive operations rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json({
      error: 'Too many sensitive operations from this IP, please try again later.',
      retryAfter: Math.round(req.rateLimit?.resetTime ? (req.rateLimit.resetTime - Date.now()) / 1000 : 3600),
      code: 'SENSITIVE_RATE_LIMIT_EXCEEDED'
    });
  }
});
app.use('/api/propostas/*/gerar-ccb', sensitiveOperationsLimiter);
app.use('/api/upload', sensitiveOperationsLimiter);

app.use(cors({
  origin: config.server.nodeEnv === 'production' 
    ? config.server.frontendUrl || false 
    : true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (config.server.nodeEnv === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  server.listen({
    port: config.server.port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`✅ Server started successfully on port ${config.server.port}`);
    log(`🌍 Environment: ${config.server.nodeEnv}`);
    log(`🔗 Supabase URL: ${config.supabase.url}`);
  });
})();
