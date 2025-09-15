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

// Lista de secrets críticos com alternativas para produção 
function getCriticalSecrets(env: string): string[] {
  if (env === 'production') {
    // Em produção, aceita PROD_* OR padrão
    return ['DATABASE_URL']; // JWT, SESSION, CSRF têm tratamento especial com fallbacks
  } else {
    // Em desenvolvimento, usa padrão com fallbacks automáticos
    return ['DATABASE_URL'];
  }
}

const OPTIONAL_SECRETS = [
  // Supabase environment variables - CANONICAL ONLY
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  // JWT secrets - environment specific
  'SUPABASE_JWT_SECRET', 'SUPABASE_DEV_JWT_SECRET',
  // External integrations
  'SENTRY_DSN',
  'CLICKSIGN_API_KEY',
  'CLICKSIGN_WEBHOOK_SECRET',
  'INTER_CLIENT_ID',
  'INTER_CLIENT_SECRET',
  'INTER_CERTIFICATE',
  'INTER_WEBHOOK_SECRET',
  // OPUS PROTOCOL: Legacy DEV_*/PROD_* variables REMOVED for contamination cleanup
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

// REMOVIDA: Função detectEnvironmentFromDomain - lógica de detecção eliminada

// OPERAÇÃO PHOENIX: Função JWT EXPLÍCITA e SEGURA
function getJwtSecret(): string {
  // A configuração DEVE vir explicitamente do ambiente. Sem fallbacks, sem magia.
  const secret = process.env.SUPABASE_JWT_SECRET;

  if (!secret) {
    console.error('🚨 FATAL ERROR (OPERAÇÃO PHOENIX): SUPABASE_JWT_SECRET não está configurado.');
    console.error('Configure em: Settings → Environment Variables → SUPABASE_JWT_SECRET');
    // Em produção, devemos falhar rápido se a configuração crítica estiver ausente.
    if (process.env.NODE_ENV === 'production') {
        console.error('🚨 Encerrando aplicação para prevenir falhas de segurança.');
        process.exit(1);
    }
    throw new Error('Segredo JWT obrigatório não configurado (SUPABASE_JWT_SECRET).');
  }

  // Validação de formato
  if (secret.length < 20) {
    console.error('🚨 FATAL: SUPABASE_JWT_SECRET inválido (muito curto)');
    process.exit(1);
  }

  // Log de confirmação seguro (apenas comprimento)
  console.log(`[CONFIG] ✅ Segredo JWT carregado com sucesso (Length: ${secret.length})`);
  return secret;
}

function getSessionSecret(): string {
  // OPUS PROTOCOL: Canonical variables only
  const secret = process.env.SESSION_SECRET;
  
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET é obrigatório em produção!');
    }
    return generateSecureSecret('SESSION_SECRET');
  }
  
  console.log('[CONFIG] ✅ Session secret carregado: SESSION_SECRET');
  return secret;
}

function getCsrfSecret(): string {
  // OPUS PROTOCOL: Canonical variables only
  const secret = process.env.CSRF_SECRET;
  
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CSRF_SECRET é obrigatório em produção!');
    }
    return generateSecureSecret('CSRF_SECRET');
  }
  
  console.log('[CONFIG] ✅ CSRF secret carregado: CSRF_SECRET');
  return secret;
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
        url: process.env.SUPABASE_URL || null,
        anonKey: process.env.SUPABASE_ANON_KEY || null,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
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
