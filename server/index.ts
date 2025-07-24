import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { config, logConfigStatus, isAppOperational } from "./lib/config";

const app = express();

// Configure trust proxy for rate limiting with X-Forwarded-For headers
// Use specific configuration to avoid rate limiting warnings
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : ['127.0.0.1', '::1']);

// ====================================
// PILAR 12 - PROGRESSIVE ENHANCEMENT
// ====================================

// Form-encoded middleware for traditional form submissions
app.use(express.urlencoded({ extended: true }));

// ====================================
// BLINDAGEM DE SEGURANÇA DA API (Pilar 2)
// ====================================

// 1. HELMET - Headers de Segurança Essenciais (Condicional)
if (config.security.enableHelmet) {
  app.use(helmet({
  // Content Security Policy - Configuração compatível com Vite
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
  // Cross-Origin-Resource-Policy
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // X-Frame-Options - Previne clickjacking
  frameguard: { action: 'deny' },
  // X-Content-Type-Options - Previne MIME sniffing
  noSniff: true,
  // Referrer-Policy - Controla informações de referência
  referrerPolicy: { policy: "same-origin" },
  // X-XSS-Protection - Ativa proteção XSS do navegador
  xssFilter: true,
  }));
  log("🛡️  Helmet security headers enabled");
} else {
  log("⚠️  Helmet disabled (development mode)");
}

// 2. RATE LIMITING - Proteção contra Ataques de Força Bruta

// Rate Limit Geral para toda a API: 100 requisições por 15 minutos
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo 100 requisições por janela de tempo
  message: {
    error: "Muitas requisições da API. Tente novamente em 15 minutos.",
    retryAfter: "15 minutos"
  },
  standardHeaders: true, // Retorna rate limit info nos headers `RateLimit-*`
  legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
  // Handler customizado para quando o limite é excedido
  handler: (req, res) => {
    log(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      error: "Muitas requisições da API. Tente novamente em 15 minutos.",
      retryAfter: "15 minutos"
    });
  },
});

// Rate Limit Restritivo para Rotas de Autenticação: 5 requisições por 15 minutos
const authApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 tentativas de login por janela de tempo
  message: {
    error: "Muitas tentativas de login. Tente novamente em 15 minutos.",
    retryAfter: "15 minutos"
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const email = req.body?.email;
    log(`Auth rate limit exceeded for IP: ${req.ip}${email ? `, email: ${email}` : ''}`);
    res.status(429).json({
      error: "Muitas tentativas de login. Tente novamente em 15 minutos.",
      retryAfter: "15 minutos"
    });
  },
  // Skip para rotas que não são de autenticação crítica
  skip: (req) => {
    const path = req.path;
    return !(path.includes('/login') || path.includes('/register') || path.includes('/reset-password'));
  }
});

// Aplicar rate limiters condicionalmente
if (config.security.enableRateLimit) {
  app.use('/api/auth', authApiLimiter); // Rate limit restritivo para auth
  app.use('/api', generalApiLimiter); // Rate limit geral para toda a API
  log("🛡️  Rate limiting enabled");
} else {
  log("⚠️  Rate limiting disabled (development mode)");
}

// 3. MIDDLEWARES BÁSICOS
app.use(express.json({ limit: '10mb' })); // Limite de payload para prevenir ataques de DoS
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
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Log status da configuração antes de iniciar
  logConfigStatus();

  // Verificar se a aplicação pode operar (modo gracioso)
  if (!isAppOperational()) {
    log("⚠️  App starting in degraded mode: Some features may be limited");
    log("ℹ️  Configure DATABASE_URL in Secrets to enable full functionality");
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  server.listen(
    {
      port: config.port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`🚀 Server running on port ${config.port}`);
      log(`🌍 Environment: ${config.nodeEnv}`);
    }
  );
})();
