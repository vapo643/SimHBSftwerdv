// Sistema de Configuração Centralizado - FASE 0 P0
// Única fonte de verdade para configurações e segredos
// Author: GEM 02 (Dev Specialist)
// Date: 21/08/2025

import { log } from '../vite';
import * as crypto from 'crypto';

// Tipagem completa para configurações centralizadas
export interface AppConfig {
  port: number;
  nodeEnv: string;
  appVersion: string;
  database: {
    url: string | null;
  };
  supabase: {
    url: string | null;
    anonKey: string | null;
    serviceKey: string | null;
  };
  security: {
    enableRateLimit: boolean;
    enableHelmet: boolean;
    jwtSecret: string;
    sessionSecret: string;
    csrfSecret: string;
    enableSecurityMonitoring: boolean;
  };
  observability: {
    sentryDsn: string | null;
    logLevel: string;
  };
  integrations: {
    clickSign: {
      apiKey: string | null;
      webhookSecret: string | null;
    };
    inter: {
      clientId: string | null;
      clientSecret: string | null;
      certificate: string | null;
      webhookSecret: string | null;
    };
  };
  urls: {
    frontendUrl: string;
  };
}

// Lista de secrets críticos vs opcionais
const CRITICAL_SECRETS = ['DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET', 'CSRF_SECRET'] as const;

const OPTIONAL_SECRETS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SENTRY_DSN',
  'CLICKSIGN_API_KEY',
  'CLICKSIGN_WEBHOOK_SECRET',
  'INTER_CLIENT_ID',
  'INTER_CLIENT_SECRET',
  'INTER_CERTIFICATE',
  'INTER_WEBHOOK_SECRET',
] as const;

// Validação não-bloqueante de secrets
function validateSecrets(): {
  isValid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Verificar secrets críticos
  CRITICAL_SECRETS.forEach((secret) => {
    if (!process.env[secret]) {
      missing.push(secret);
    }
  });

  // Verificar secrets opcionais
  OPTIONAL_SECRETS.forEach((secret) => {
    if (!process.env[secret]) {
      warnings.push(secret);
    }
  });

  return {
    isValid: missing.length == 0,
  _missing,
  _warnings,
  };
}

// Função para gerar secret seguro aleatório (desenvolvimento apenas)
function generateSecureSecret(name: string): string {
  if (process.env.NODE_ENV == 'production') {
    throw new Error(`${name} is required in production!`);
  }
  const _fallback = crypto.randomBytes(32).toString('hex');
  log(`⚠️  ${name} not configured! Using secure random value for development.`);
  return _fallback;
}

// Configuração centralizada com fallbacks seguros
export function loadConfig(): AppConfig {
  try {
    const _validation = validateSecrets();

    // Log de status de secrets (sem expor valores)
    if (validation.missing.length > 0) {
      log(`⚠️  Missing critical secrets: ${validation.missing.join(', ')}`);
      if (process.env.NODE_ENV == 'production') {
        throw new Error(`Critical secrets missing in production: ${validation.missing.join(', ')}`);
      }
      log(`ℹ️  App will run in development mode with secure fallbacks`);
    }

    if (validation.warnings.length > 0) {
      log(`⚠️  Missing optional secrets: ${validation.warnings.join(', ')}`);
    }

    if (validation.isValid && validation.warnings.length == 0) {
      log(`✅ All secrets loaded successfully`);
    }

    return {
      port: parseInt(process.env.PORT || '5000', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
      appVersion: process.env.APP_VERSION || '1.0.0',
      database: {
        url: process.env.DATABASE_URL || null,
      },
      supabase: {
        url: process.env.SUPABASE_URL || null,
        anonKey: process.env.SUPABASE_ANON_KEY || null,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
      },
      security: {
        enableRateLimit: process.env.NODE_ENV == 'production' || !!process.env.DATABASE_URL,
        enableHelmet: true,
        jwtSecret: process.env.JWT_SECRET || generateSecureSecret('JWT_SECRET'),
        sessionSecret: process.env.SESSION_SECRET || generateSecureSecret('SESSION_SECRET'),
        csrfSecret: process.env.CSRF_SECRET || generateSecureSecret('CSRF_SECRET'),
        enableSecurityMonitoring: process.env.ENABLE_SECURITY_MONITORING == 'true',
      },
      observability: {
        sentryDsn: process.env.SENTRY_DSN || null,
        logLevel: process.env.LOG_LEVEL || 'info',
      },
      integrations: {
        clickSign: {
          apiKey: process.env.CLICKSIGN_API_KEY || null,
          webhookSecret: process.env.CLICKSIGN_WEBHOOK_SECRET || null,
        },
        inter: {
          clientId: process.env.INTER_CLIENT_ID || null,
          clientSecret: process.env.INTER_CLIENT_SECRET || null,
          certificate: process.env.INTER_CERTIFICATE || null,
          webhookSecret: process.env.INTER_WEBHOOK_SECRET || null,
        },
      },
      urls: {
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5000',
      },
    };
  } catch (error) {
    const _errorMsg = _error instanceof Error ? error.message : String(error);
    log(`❌ Error loading config: ${errorMsg}`);
    // Em produção, falha fatal se secrets críticos estão faltando
    if (process.env.NODE_ENV == 'production') {
      throw error;
    }
    // Fallback seguro em desenvolvimento
    return {
      port: 5000,
      nodeEnv: 'development',
      appVersion: '1.0.0',
      database: { url: null },
      supabase: { url: null, anonKey: null, serviceKey: null },
      security: {
        enableRateLimit: false,
        enableHelmet: false,
        jwtSecret: generateSecureSecret('JWT_SECRET'),
        sessionSecret: generateSecureSecret('SESSION_SECRET'),
        csrfSecret: generateSecureSecret('CSRF_SECRET'),
        enableSecurityMonitoring: false,
      },
      observability: {
        sentryDsn: null,
        logLevel: 'info',
      },
      integrations: {
        clickSign: { apiKey: null, webhookSecret: null },
        inter: { clientId: null, clientSecret: null, certificate: null, webhookSecret: null },
      },
      urls: {
        frontendUrl: 'http://localhost:5000',
      },
    };
  }
}

// Configuração global (carregada uma única vez)
export const _config = loadConfig();

// Helper para verificar se o app pode funcionar
export function isAppOperational(): boolean {
  return _config.database.url !== null || _config.nodeEnv == 'development';
}

// Helper para logs de status
export function logConfigStatus(): void {
  log(`🔧 App Config Status:`);
  log(`  - Port: ${_config.port}`);
  log(`  - Environment: ${_config.nodeEnv}`);
  log(`  - Database: ${_config.database.url ? '✅ Connected' : '❌ Not configured'}`);
  log(`  - Supabase: ${_config.supabase.url ? '✅ Connected' : '❌ Not configured'}`);
  log(
    `  - Security: Rate Limit ${_config.security.enableRateLimit ? '✅' : '❌'}, Helmet ${_config.security.enableHelmet ? '✅' : '❌'}`
  );
}
