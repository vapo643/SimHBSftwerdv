
// Sistema de Configuração Resiliente - Pilar 10
// Garante que a aplicação inicie mesmo com secrets ausentes

import { log } from "../vite";

// Tipagem para configurações centralizadas
export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: {
    url: string | null;
  };
  supabase: {
    url: string | null;
    anonKey: string | null;
  };
  security: {
    enableRateLimit: boolean;
    enableHelmet: boolean;
  };
}

// Lista de secrets críticos vs opcionais
const CRITICAL_SECRETS = ['DATABASE_URL'] as const;
const OPTIONAL_SECRETS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const;

// Validação não-bloqueante de secrets
function validateSecrets(): {
  isValid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Verificar secrets críticos
  CRITICAL_SECRETS.forEach(secret => {
    if (!process.env[secret]) {
      missing.push(secret);
    }
  });

  // Verificar secrets opcionais
  OPTIONAL_SECRETS.forEach(secret => {
    if (!process.env[secret]) {
      warnings.push(secret);
    }
  });

  return {
    isValid: missing.length === 0,
    missing,
    warnings
  };
}

// Configuração centralizada com fallbacks seguros
export function loadConfig(): AppConfig {
  try {
    const validation = validateSecrets();

    // Log de status de secrets (sem expor valores)
    if (validation.missing.length > 0) {
      log(`⚠️  Missing critical secrets: ${validation.missing.join(', ')}`);
      log(`ℹ️  App will run in degraded mode`);
    }

    if (validation.warnings.length > 0) {
      log(`⚠️  Missing optional secrets: ${validation.warnings.join(', ')}`);
    }

    if (validation.isValid && validation.warnings.length === 0) {
      log(`✅ All secrets loaded successfully`);
    }

    return {
      port: parseInt(process.env.PORT || "5000", 10),
      nodeEnv: process.env.NODE_ENV || "development",
      database: {
        url: process.env.DATABASE_URL || null,
      },
      supabase: {
        url: process.env.SUPABASE_URL || null,
        anonKey: process.env.SUPABASE_ANON_KEY || null,
      },
      security: {
        enableRateLimit: process.env.NODE_ENV === "production" || !!process.env.DATABASE_URL,
        // Helmet habilitado em todos os ambientes para máxima segurança
        enableHelmet: true, // Sempre ativo para proteção completa
      },
    };
  } catch (error) {
    log(`❌ Error loading config: ${error.message}`);
    // Fallback seguro em caso de erro
    return {
      port: 5000,
      nodeEnv: "development",
      database: { url: null },
      supabase: { url: null, anonKey: null },
      security: { enableRateLimit: false, enableHelmet: false },
    };
  }
}

// Configuração global (carregada uma única vez)
export const config = loadConfig();

// Helper para verificar se o app pode funcionar
export function isAppOperational(): boolean {
  return config.database.url !== null || config.nodeEnv === "development";
}

// Helper para logs de status
export function logConfigStatus(): void {
  log(`🔧 App Config Status:`);
  log(`  - Port: ${config.port}`);
  log(`  - Environment: ${config.nodeEnv}`);
  log(`  - Database: ${config.database.url ? '✅ Connected' : '❌ Not configured'}`);
  log(`  - Supabase: ${config.supabase.url ? '✅ Connected' : '❌ Not configured'}`);
  log(`  - Security: Rate Limit ${config.security.enableRateLimit ? '✅' : '❌'}, Helmet ${config.security.enableHelmet ? '✅' : '❌'}`);
}
