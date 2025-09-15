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

// Lista de secrets críticos vs opcionais - ajustado para diferentes ambientes
function getCriticalSecrets(env: string): string[] {
  switch (env) {
    case 'production':
      return ['PROD_DATABASE_URL', 'PROD_JWT_SECRET', 'PROD_SESSION_SECRET', 'PROD_CSRF_SECRET'];
    case 'staging':
      return ['STAGING_DATABASE_URL', 'STAGING_JWT_SECRET', 'STAGING_SESSION_SECRET', 'STAGING_CSRF_SECRET'];
    default:
      return ['DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET', 'CSRF_SECRET'];
  }
}

const OPTIONAL_SECRETS = [
  // Environment-specific JWT secrets (SEGURANÇA: isolamento por ambiente)
  'DEV_JTW_SECRET', 'PROD_JWT_SECRET',
  // Session and CSRF secrets
  'SESSION_DEV', 'CSRF_DEV',
  'PROD_SUPABASE_URL', 'SUPABASE_URL',
  'PROD_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 
  'PROD_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'DEV_SUPABASE_URL', 'DEV_SUPABASE_ANON_KEY', 'DEV_SUPABASE_SERVICE_ROLE_KEY',
  'SENTRY_DSN',
  'CLICKSIGN_API_KEY',
  'CLICKSIGN_WEBHOOK_SECRET',
  'INTER_CLIENT_ID',
  'INTER_CLIENT_SECRET',
  'INTER_CERTIFICATE',
  'INTER_WEBHOOK_SECRET',
] as const;

// Validação não-bloqueante de secrets adaptada por ambiente
function validateSecrets(): {
  isValid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  const env = process.env.NODE_ENV || 'development';
  const criticalSecrets = getCriticalSecrets(env);

  // Verificar secrets críticos baseado no ambiente
  criticalSecrets.forEach((secret) => {
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
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

// Função para gerar secret seguro aleatório (desenvolvimento apenas)
function generateSecureSecret(name: string): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} is required in production!`);
  }
  const fallback = crypto.randomBytes(32).toString('hex');
  log(`⚠️  ${name} not configured! Using secure random value for development.`);
  return fallback;
}

// Função para detectar ambiente baseado no domínio/URL
function detectEnvironmentFromDomain(): 'dev' | 'prod' {
  // Se temos variáveis específicas, usamos elas para detectar
  const host = process.env.HOST || process.env.REPL_SLUG || 'localhost';
  const isDevelopment = 
    host.includes('localhost') ||
    host.includes('127.0.0.1') ||
    host.includes('.replit.dev') ||
    host.includes('replit-') ||
    process.env.REPLIT_DEV_DOMAIN;
    
  return isDevelopment ? 'dev' : 'prod';
}

// Função para leitura do segredo JWT com isolamento de ambiente (SEGURANÇA)
function getJwtSecret(): string {
  console.log('[DIAGNOSTICO JWT] Tentando obter segredo. Valores atuais:', {
    NODE_ENV: process.env.NODE_ENV,
    DOMAIN: process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.replit.dev` : 'localhost',
    DEV_JTW_SECRET_EXISTS: !!process.env.DEV_JTW_SECRET,
    PROD_JWT_SECRET_EXISTS: !!process.env.PROD_JWT_SECRET,
    SUPABASE_JWT_SECRET_EXISTS: !!process.env.SUPABASE_JWT_SECRET
  });
  
  const environmentType = detectEnvironmentFromDomain();
  
  if (environmentType === 'dev' && process.env.DEV_JTW_SECRET) {
    console.log('[CONFIG] 🔧 DEV Environment detected - Using DEV_JTW_SECRET for JWT validation');
    return process.env.DEV_JTW_SECRET;
  }
  
  if (environmentType === 'prod' && process.env.PROD_JWT_SECRET) {
    console.log('[CONFIG] 🏭 PROD Environment detected - Using PROD_JWT_SECRET for JWT validation');
    return process.env.PROD_JWT_SECRET;
  }
  
  // Fallback seguro com erro claro
  throw new Error(`🚨 JWT Secret não configurado para ambiente: ${environmentType}. Configure DEV_JTW_SECRET ou PROD_JWT_SECRET.`);
}

function getSessionSecret(): string {
  const environmentType = detectEnvironmentFromDomain();
  
  if (environmentType === 'dev' && process.env.SESSION_DEV) {
    console.log('[CONFIG] 🔧 DEV Environment - Using SESSION_DEV');
    return process.env.SESSION_DEV;
  }
  
  if (environmentType === 'prod' && process.env.PROD_SESSION_SECRET) {
    console.log('[CONFIG] 🏭 PROD Environment - Using PROD_SESSION_SECRET');
    return process.env.PROD_SESSION_SECRET;
  }
  
  // Fallback para a lógica anterior
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return process.env.PROD_SESSION_SECRET || (() => {
        throw new Error('PROD_SESSION_SECRET is required in production environment!');
      })();
    case 'staging':
      return process.env.STAGING_SESSION_SECRET || generateSecureSecret('STAGING_SESSION_SECRET');
    default:
      return process.env.SESSION_SECRET || generateSecureSecret('SESSION_SECRET');
  }
}

function getCsrfSecret(): string {
  const environmentType = detectEnvironmentFromDomain();
  
  if (environmentType === 'dev' && process.env.CSRF_DEV) {
    console.log('[CONFIG] 🔧 DEV Environment - Using CSRF_DEV');
    return process.env.CSRF_DEV;
  }
  
  if (environmentType === 'prod' && process.env.PROD_CSRF_SECRET) {
    console.log('[CONFIG] 🏭 PROD Environment - Using PROD_CSRF_SECRET');
    return process.env.PROD_CSRF_SECRET;
  }
  
  // Fallback para a lógica anterior
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return process.env.PROD_CSRF_SECRET || (() => {
        throw new Error('PROD_CSRF_SECRET is required in production environment!');
      })();
    case 'staging':
      return process.env.STAGING_CSRF_SECRET || generateSecureSecret('STAGING_CSRF_SECRET');
    default:
      return process.env.CSRF_SECRET || generateSecureSecret('CSRF_SECRET');
  }
}


// Configuração centralizada com fallbacks seguros
export function loadConfig(): AppConfig {
  try {
    const validation = validateSecrets();

    // Log de status de secrets (sem expor valores)
    if (validation.missing.length > 0) {
      log(`⚠️  Missing critical secrets: ${validation.missing.join(', ')}`);
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Critical secrets missing in production: ${validation.missing.join(', ')}`);
      }
      log(`ℹ️  App will run in development mode with secure fallbacks`);
    }

    if (validation.warnings.length > 0) {
      log(`⚠️  Missing optional secrets: ${validation.warnings.join(', ')}`);
    }

    if (validation.isValid && validation.warnings.length === 0) {
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
        url: process.env.NODE_ENV === 'production' 
          ? (process.env.PROD_SUPABASE_URL || process.env.SUPABASE_URL || null)
          : (process.env.SUPABASE_URL || null),
        anonKey: process.env.NODE_ENV === 'production'
          ? (process.env.PROD_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || null)
          : (process.env.SUPABASE_ANON_KEY || null),
        serviceKey: process.env.NODE_ENV === 'production'
          ? (process.env.PROD_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || null)
          : (process.env.SUPABASE_SERVICE_ROLE_KEY || null),
      },
      security: {
        enableRateLimit: process.env.NODE_ENV === 'production' || !!process.env.DATABASE_URL,
        enableHelmet: true,
        jwtSecret: getJwtSecret(),
        sessionSecret: getSessionSecret(),
        csrfSecret: getCsrfSecret(),
        enableSecurityMonitoring: process.env.ENABLE_SECURITY_MONITORING === 'true',
      },
      observability: {
        sentryDsn: process.env.SENTRY_DSN || null,
        logLevel: process.env.LOG_LEVEL || 'info',
      },
      integrations: {
        clickSign: {
          apiKey: process.env.CLICKSIGN_API_KEY || process.env.CLICKSIGN_API_TOKEN || null,
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
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`❌ Error loading config: ${errorMsg}`);
    // Em produção, falha fatal se secrets críticos estão faltando
    if (process.env.NODE_ENV === 'production') {
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
export const config = loadConfig();

// Helper para verificar se o app pode funcionar
export function isAppOperational(): boolean {
  return config.database.url !== null || config.nodeEnv === 'development';
}

// Export das funções para uso externo
export { getJwtSecret, getSessionSecret, getCsrfSecret };

// Helper para logs de status
export function logConfigStatus(): void {
  log(`🔧 App Config Status:`);
  log(`  - Port: ${config.port}`);
  log(`  - Environment: ${config.nodeEnv}`);
  log(`  - Database: ${config.database.url ? '✅ Connected' : '❌ Not configured'}`);
  log(`  - Supabase: ${config.supabase.url ? '✅ Connected' : '❌ Not configured'}`);
  log(
    `  - Security: Rate Limit ${config.security.enableRateLimit ? '✅' : '❌'}, Helmet ${config.security.enableHelmet ? '✅' : '❌'}`
  );
}
