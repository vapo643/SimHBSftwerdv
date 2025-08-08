// Headers de Segurança Avançados - OWASP A05: Security Misconfiguration
import helmet from "helmet";
import { Request, Response, NextFunction } from "express";

// Configuração aprimorada do Helmet seguindo OWASP
export function setupSecurityHeaders() {
  // Build CSP directives conditionally
  const cspDirectives: any = {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'", // Necessário para React em dev
      "'unsafe-eval'", // Necessário para Vite em dev
      "https://cdnjs.cloudflare.com", // Para bibliotecas externas
      "https://unpkg.com",
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Necessário para styled components
      "https://fonts.googleapis.com",
    ],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:", "blob:"],
    connectSrc: [
      "'self'",
      "https://*.supabase.co", // Supabase
      "https://cdn.inter.co", // Banco Inter
      "https://api.clicksign.com", // ClickSign
      "wss://*.supabase.co", // WebSocket Supabase
      process.env.NODE_ENV === "development" ? "ws://localhost:*" : "",
    ].filter(Boolean),
    mediaSrc: ["'none'"],
    objectSrc: ["'none'"],
    frameSrc: ["'self'"], // Para PDFs e iframes
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"], // Previne clickjacking
  };

  // Only add upgradeInsecureRequests in production
  if (process.env.NODE_ENV === "production") {
    cspDirectives.upgradeInsecureRequests = [];
  }

  return helmet({
    // Content Security Policy - Previne XSS
    contentSecurityPolicy: {
      directives: cspDirectives,
    },

    // X-DNS-Prefetch-Control
    dnsPrefetchControl: { allow: false },

    // X-Frame-Options - Previne clickjacking
    frameguard: { action: "deny" },

    // Strict-Transport-Security - Força HTTPS
    hsts: {
      maxAge: 31536000, // 1 ano
      includeSubDomains: true,
      preload: true,
    },

    // X-Content-Type-Options - Previne MIME sniffing
    noSniff: true,

    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: { permittedPolicies: "none" },

    // Referrer-Policy - Controla informações do referrer
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },

    // X-XSS-Protection - Proteção XSS legada (para browsers antigos)
    xssFilter: true,

    // Remove X-Powered-By header
    hidePoweredBy: true,

    // Cross-Origin-Embedder-Policy
    crossOriginEmbedderPolicy: process.env.NODE_ENV === "production",

    // Cross-Origin-Opener-Policy
    crossOriginOpenerPolicy: { policy: "same-origin" },

    // Cross-Origin-Resource-Policy
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
}

// Headers adicionais de segurança customizados
export function additionalSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Permissions Policy (antiga Feature Policy)
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  );

  // Cache Control para dados sensíveis
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  // X-Request-ID para rastreamento
  const requestId = req.headers["x-request-id"] || generateRequestId();
  res.setHeader("X-Request-ID", requestId);

  // Previne informações de timing
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");

  // Clear Site Data em logout
  if (req.path === "/api/auth/logout") {
    res.setHeader("Clear-Site-Data", '"cache", "cookies", "storage"');
  }

  next();
}

// Gera ID único para rastreamento de requisições
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Configuração CORS segura
export function setupCORS() {
  // In development, allow Replit preview URLs and localhost
  const allowedOrigins =
    process.env.NODE_ENV === "production"
      ? [process.env.FRONTEND_URL || "https://simpix.com.br"]
      : ["http://localhost:5000", "http://localhost:3000", "http://127.0.0.1:5000"];

  // Allow any Replit URL in development
  const isReplitUrl = (origin: string) => {
    return origin.includes(".replit.dev") || origin.includes(".repl.co");
  };

  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Permite requisições sem origin (ex: Postman, apps mobile)
      if (!origin) {
        return callback(null, true);
      }

      // Allow configured origins or any Replit URL in development
      if (
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV !== "production" && isReplitUrl(origin))
      ) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked origin: ${origin}`);
        callback(new Error("CORS não permitido para esta origem"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposedHeaders: ["X-Request-ID"],
    maxAge: 86400, // 24 horas
  };
}
