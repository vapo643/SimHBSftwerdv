/**
 * Environment Configuration - OWASP ASVS V14.1.1
 *
 * Segregates configuration between development, staging, and production
 * environments to prevent cross-environment security issues.
 */

export interface EnvironmentConfig {
  name: 'development' | 'staging' | 'production';

  // Database
  databaseUrl: string;
  databasePoolSize: number;

  // Supabase
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;

  // Security
  jwtSecret: string;
  csrfSecret: string;
  sessionSecret: string;
  bcryptRounds: number;

  // Rate Limiting
  rateLimitWindow: number;
  rateLimitMaxRequests: number;

  // CORS
  corsOrigins: string[];

  // File Upload
  maxFileSize: number;
  allowedFileTypes: string[];

  // Monitoring
  enableSecurityMonitoring: boolean;
  securityAlertEmail?: string;

  // Feature Flags
  enableHoneypots: boolean;
  enableObfuscation: boolean;
  enableApiDocs: boolean;

  // External Services
  clickSignEnabled: boolean;
  interBankEnabled: boolean;
}

/**
 * Get configuration for current environment
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const env = process.env.NODE_ENV || 'development';

  // Base configuration (shared across environments)
  const baseConfig: Partial<EnvironmentConfig> = {
    bcryptRounds: 12,
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
  };

  // 🛡️ PROTEÇÃO ANTI-NEON: Verificar e corrigir DATABASE_URL automaticamente
  let databaseUrl = process.env.DATABASE_URL;
  
  // Se DATABASE_URL for do Neon, usar Supabase como fallback
  if (databaseUrl?.includes('neon.tech')) {
    console.warn('🚨 [ANTI-NEON] DATABASE_URL do Neon detectado, redirecionando para Supabase...');
    databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
    
    if (databaseUrl?.includes('neon.tech')) {
      throw new Error('🛑 [ANTI-NEON] Configuração Neon detectada. Configure SUPABASE_DATABASE_URL nos Replit Secrets');
    }
    console.log('✅ [ANTI-NEON] Redirecionamento para Supabase concluído');
  }

  // Environment-specific configurations
  const configs: Record<string, EnvironmentConfig> = {
    development: {
      ...baseConfig,
      name: 'development',

      // Database (com proteção anti-Neon)
      databaseUrl: databaseUrl!,
      databasePoolSize: 5,

      // Supabase (usando secrets específicos de desenvolvimento)
      supabaseUrl: process.env.DEV_SUPABASE_URL!,
      supabaseAnonKey: process.env.DEV_SUPABASE_ANON_KEY!,
      supabaseServiceKey: process.env.DEV_SUPABASE_SERVICE_ROLE_KEY!,

      // Security (usando secrets específicos de desenvolvimento)
      jwtSecret: process.env.DEV_JTW_SECRET || 'dev-jwt-secret-change-in-production',
      csrfSecret: process.env.CSRF_SECRET || 'dev-csrf-secret-change-in-production',
      sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-change-in-production',

      // Rate Limiting (relaxed for development)
      rateLimitMaxRequests: 100,

      // CORS (allow local development)
      corsOrigins: ['http://localhost:3000', 'http://localhost:5000'],

      // Monitoring
      enableSecurityMonitoring: false,

      // Feature Flags
      enableHoneypots: false,
      enableObfuscation: false,
      enableApiDocs: true,

      // External Services
      clickSignEnabled: false,
      interBankEnabled: false,
    } as EnvironmentConfig,

    staging: {
      ...baseConfig,
      name: 'staging',

      // Database
      databaseUrl: process.env.STAGING_DATABASE_URL!,
      databasePoolSize: 10,

      // Supabase
      supabaseUrl: process.env.STAGING_SUPABASE_URL!,
      supabaseAnonKey: process.env.STAGING_SUPABASE_ANON_KEY!,
      supabaseServiceKey: process.env.STAGING_SUPABASE_SERVICE_KEY!,

      // Security (staging keys)
      jwtSecret: process.env.STAGING_JWT_SECRET!,
      csrfSecret: process.env.STAGING_CSRF_SECRET!,
      sessionSecret: process.env.STAGING_SESSION_SECRET!,

      // Rate Limiting
      rateLimitMaxRequests: 50,

      // CORS
      corsOrigins: [process.env.STAGING_FRONTEND_URL!],

      // Monitoring
      enableSecurityMonitoring: true,
      securityAlertEmail: process.env.STAGING_ALERT_EMAIL,

      // Feature Flags
      enableHoneypots: true,
      enableObfuscation: true,
      enableApiDocs: false,

      // External Services
      clickSignEnabled: true,
      interBankEnabled: true,
    } as EnvironmentConfig,

    production: {
      ...baseConfig,
      name: 'production',

      // Database
      databaseUrl: process.env.PROD_DATABASE_URL!,
      databasePoolSize: 20,

      // Supabase
      supabaseUrl: process.env.PROD_SUPABASE_URL!,
      supabaseAnonKey: process.env.PROD_SUPABASE_ANON_KEY!,
      supabaseServiceKey: process.env.PROD_SUPABASE_SERVICE_KEY!,

      // Security (production keys - MUST be strong)
      jwtSecret: process.env.PROD_JWT_SECRET!,
      csrfSecret: process.env.PROD_CSRF_SECRET!,
      sessionSecret: process.env.PROD_SESSION_SECRET!,

      // Rate Limiting (strict)
      rateLimitMaxRequests: 20,

      // CORS (only production domain)
      corsOrigins: [process.env.PROD_FRONTEND_URL!],

      // Monitoring
      enableSecurityMonitoring: true,
      securityAlertEmail: process.env.PROD_ALERT_EMAIL!,

      // Feature Flags
      enableHoneypots: true,
      enableObfuscation: true,
      enableApiDocs: false,

      // External Services
      clickSignEnabled: true,
      interBankEnabled: true,
    } as EnvironmentConfig,
  };

  const config = configs[env];

  if (!config) {
    throw new Error(`Invalid environment: ${env}`);
  }

  // Validate required configuration
  validateConfig(config);

  return config;
}

/**
 * Validate configuration
 */
function validateConfig(config: EnvironmentConfig): void {
  const required = [
    'databaseUrl',
    'supabaseUrl',
    'supabaseAnonKey',
    'supabaseServiceKey',
    'jwtSecret',
    'csrfSecret',
    'sessionSecret',
  ];

  for (const field of required) {
    if (!config[field as keyof EnvironmentConfig]) {
      throw new Error(`Missing required configuration: ${field} for environment ${config.name}`);
    }
  }

  // Production-specific validations
  if (config.name === 'production') {
    // Ensure production doesn't use development secrets
    if (
      config.jwtSecret.includes('dev') ||
      config.csrfSecret.includes('dev') ||
      config.sessionSecret.includes('dev')
    ) {
      throw new Error('Production environment using development secrets!');
    }

    // Ensure security features are enabled
    if (!config.enableSecurityMonitoring) {
      throw new Error('Security monitoring must be enabled in production!');
    }

    if (!config.securityAlertEmail) {
      throw new Error('Security alert email must be configured in production!');
    }
  }
}

/**
 * Log environment configuration (sanitized)
 */
export function logEnvironmentConfig(config: EnvironmentConfig): void {
  console.log('🔧 Environment Configuration:');
  console.log(`  - Environment: ${config.name}`);
  console.log(`  - Security Monitoring: ${config.enableSecurityMonitoring ? '✅' : '❌'}`);
  console.log(`  - Honeypots: ${config.enableHoneypots ? '✅' : '❌'}`);
  console.log(`  - Code Obfuscation: ${config.enableObfuscation ? '✅' : '❌'}`);
  console.log(`  - API Documentation: ${config.enableApiDocs ? '✅' : '❌'}`);
  console.log(
    `  - Rate Limit: ${config.rateLimitMaxRequests} requests per ${config.rateLimitWindow / 60000} minutes`
  );
  console.log(`  - CORS Origins: ${config.corsOrigins.join(', ')}`);

  // Never log sensitive values
  console.log(
    `  - Secrets Configured: ✅ (${Object.keys(config).filter((k) => k.includes('Secret')).length} secrets)`
  );
}
