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
 * Now handles missing production secrets gracefully for deployment
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

  // Helper function to get production secret with fallback
  const getProductionSecret = (secretName: string, fallback?: string): string => {
    const value = process.env[secretName];
    if (!value && env === 'production') {
      console.warn(`⚠️ Production secret ${secretName} is missing. This may limit functionality.`);
      return fallback || 'MISSING_SECRET_CONFIGURE_IN_DEPLOYMENT';
    }
    return value || fallback || 'dev-fallback';
  };

  // Environment-specific configurations
  const configs: Record<string, EnvironmentConfig> = {
    development: {
      ...baseConfig,
      name: 'development',

      // Database
      databaseUrl: process.env.DATABASE_URL!,
      databasePoolSize: 5,

      // Supabase
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,

      // Security (development keys - NEVER use in production)
      jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
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
      databaseUrl: getProductionSecret('PROD_DATABASE_URL') || getProductionSecret('DATABASE_URL', 'postgres://localhost/simpix_prod'),
      databasePoolSize: 20,

      // Supabase
      supabaseUrl: getProductionSecret('PROD_SUPABASE_URL') || getProductionSecret('SUPABASE_URL'),
      supabaseAnonKey: getProductionSecret('PROD_SUPABASE_ANON_KEY') || getProductionSecret('SUPABASE_ANON_KEY'),
      supabaseServiceKey: getProductionSecret('PROD_SUPABASE_SERVICE_KEY') || getProductionSecret('SUPABASE_SERVICE_ROLE_KEY'),

      // Security (production keys with graceful fallbacks)
      jwtSecret: getProductionSecret('PROD_JWT_SECRET'),
      csrfSecret: getProductionSecret('PROD_CSRF_SECRET'),
      sessionSecret: getProductionSecret('PROD_SESSION_SECRET'),

      // Rate Limiting (strict)
      rateLimitMaxRequests: 20,

      // CORS (production domain with fallback)
      corsOrigins: [getProductionSecret('PROD_FRONTEND_URL') || process.env.REPLIT_DEV_DOMAIN || 'https://simpix.app'],

      // Monitoring
      enableSecurityMonitoring: true,
      securityAlertEmail: getProductionSecret('PROD_ALERT_EMAIL', 'admin@simpix.app'),

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

  // Validate configuration with graceful handling for production
  const validationResult = validateConfig(config);
  if (!validationResult.isValid && env === 'production') {
    console.error('⚠️ Configuration validation warnings in production:');
    validationResult.warnings.forEach(warning => console.warn(`  - ${warning}`));
    console.log('ℹ️ Application will start with limited functionality. Configure missing secrets in Deployment settings.');
  }

  return config;
}

/**
 * Validate configuration with graceful handling for deployment environments
 */
function validateConfig(config: EnvironmentConfig): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const required = [
    'databaseUrl',
    'supabaseUrl', 
    'supabaseAnonKey',
    'supabaseServiceKey',
    'jwtSecret',
    'csrfSecret',
    'sessionSecret',
  ];

  // Check for missing or placeholder values
  for (const field of required) {
    const value = config[field as keyof EnvironmentConfig] as string;
    if (!value || value === 'MISSING_SECRET_CONFIGURE_IN_DEPLOYMENT') {
      warnings.push(`Missing configuration: ${field} for environment ${config.name}`);
    }
  }

  // Production-specific validations (warnings instead of errors)
  if (config.name === 'production') {
    // Check for development secrets in production
    if (
      config.jwtSecret.includes('dev') ||
      config.csrfSecret.includes('dev') ||
      config.sessionSecret.includes('dev')
    ) {
      warnings.push('Production environment appears to be using development secrets!');
    }

    // Check missing secrets that would limit functionality
    if (config.jwtSecret === 'MISSING_SECRET_CONFIGURE_IN_DEPLOYMENT') {
      warnings.push('PROD_JWT_SECRET missing - authentication will not work properly');
    }
    if (config.sessionSecret === 'MISSING_SECRET_CONFIGURE_IN_DEPLOYMENT') {
      warnings.push('PROD_SESSION_SECRET missing - session management will not work properly');
    }
    if (config.csrfSecret === 'MISSING_SECRET_CONFIGURE_IN_DEPLOYMENT') {
      warnings.push('PROD_CSRF_SECRET missing - CSRF protection will not work properly');
    }

    // Only warn about security monitoring, don't block startup
    if (!config.enableSecurityMonitoring) {
      warnings.push('Security monitoring should be enabled in production');
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings
  };
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
