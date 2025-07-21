import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { validateAndLoadConfig, getConfig } from "./lib/config";
import { helmetConfig, generalApiLimiter, authApiLimiter } from "./lib/security-config";

// ====================================
// GERENCIAMENTO DE SECRETS CENTRALIZADO (Pilar 10)
// ====================================

console.log('🚀 Iniciando servidor Simpix Credit Management...');

// VALIDAÇÃO OBRIGATÓRIA DE CONFIGURAÇÕES - FAIL FAST
const config = validateAndLoadConfig();

const app = express();

// Configurar trust proxy para Replit
if (config.TRUST_PROXY === 'true' || config.TRUST_PROXY === '1') {
  app.set('trust proxy', true);
  console.log('✅ Trust proxy habilitado para Replit');
}

// ====================================
// BLINDAGEM DE SEGURANÇA DA API (Pilar 2)
// ====================================

// 1. HELMET - Headers de Segurança Essenciais
const helmetConfigFinal = process.env.NODE_ENV === "development" 
  ? { ...helmetConfig, contentSecurityPolicy: false }
  : helmetConfig;

app.use(helmet(helmetConfigFinal));

// 2. RATE LIMITING - Proteção contra Ataques de Força Bruta
app.use('/api/auth', authApiLimiter); // Rate limit restritivo para auth
app.use('/api', generalApiLimiter); // Rate limit geral para toda a API

// 3. MIDDLEWARES BÁSICOS
const maxFileSize = `${Math.floor(config.MAX_FILE_SIZE / 1024 / 1024)}mb`;
app.use(express.json({ limit: maxFileSize })); // Limite configurável de payload
app.use(express.urlencoded({ extended: false, limit: maxFileSize }));

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

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = config.PORT;
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      console.log('🎯 ====================================');
      console.log('✅ Servidor Simpix inicializado com sucesso!');
      console.log(`🌐 Servidor rodando na porta: ${port}`);
      console.log(`🔧 Ambiente: ${config.NODE_ENV}`);
      console.log('🛡️  Segurança: Headers de proteção ativados');
      console.log('⚡ Rate Limiting: Proteção anti-bruteforce ativa');
      console.log('🗄️  Database: Conexão validada');
      console.log('🎯 ====================================');
      log(`serving on port ${port}`);
    }
  );
})();
