
interface EnvironmentConfig {
  // Database
  DATABASE_URL?: string;
  SUPABASE_DATABASE_URL?: string;
  
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  
  // Server
  PORT: string;
  NODE_ENV: string;
  
  // Frontend (optional in production)
  FRONTEND_URL?: string;
  
  // Vite (development only)
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

interface ValidatedConfig {
  database: {
    url: string;
    supabaseUrl: string;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  server: {
    port: number;
    nodeEnv: string;
    frontendUrl?: string;
  };
}

function validateEnvironmentVariables(): ValidatedConfig {
  const env = process.env as EnvironmentConfig;
  const errors: string[] = [];
  
  // Required variables
  const requiredVars = {
    SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    PORT: env.PORT,
    NODE_ENV: env.NODE_ENV,
  };
  
  // Check for missing required variables
  Object.entries(requiredVars).forEach(([key, value]) => {
    if (!value || value.trim() === '') {
      errors.push(`Missing required environment variable: ${key}`);
    }
  });
  
  // Validate database URL (either direct or constructed from Supabase)
  const databaseUrl = env.DATABASE_URL || env.SUPABASE_DATABASE_URL;
  if (!databaseUrl && !requiredVars.SUPABASE_URL) {
    errors.push('Missing database configuration: DATABASE_URL or SUPABASE_DATABASE_URL required');
  }
  
  // Validate port is a number
  const port = parseInt(requiredVars.PORT || '5000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push('PORT must be a valid number between 1 and 65535');
  }
  
  // Validate NODE_ENV
  const validEnvironments = ['development', 'production', 'test'];
  if (!validEnvironments.includes(requiredVars.NODE_ENV || '')) {
    errors.push(`NODE_ENV must be one of: ${validEnvironments.join(', ')}`);
  }
  
  // If there are errors, throw them
  if (errors.length > 0) {
    const errorMessage = [
      '❌ Environment Configuration Error:',
      '',
      ...errors.map(error => `  • ${error}`),
      '',
      '🔧 Please check your environment variables and try again.',
      '',
      'Required variables:',
      '  • SUPABASE_URL (or VITE_SUPABASE_URL)',
      '  • SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)',
      '  • SUPABASE_SERVICE_ROLE_KEY',
      '  • PORT (default: 5000)',
      '  • NODE_ENV (development, production, or test)',
      '',
      'Optional variables:',
      '  • DATABASE_URL or SUPABASE_DATABASE_URL',
      '  • FRONTEND_URL (for production CORS)',
    ].join('\n');
    
    throw new Error(errorMessage);
  }
  
  // Return validated configuration
  return {
    database: {
      url: databaseUrl || constructDatabaseUrl(requiredVars.SUPABASE_URL!),
      supabaseUrl: requiredVars.SUPABASE_URL!,
    },
    supabase: {
      url: requiredVars.SUPABASE_URL!,
      anonKey: requiredVars.SUPABASE_ANON_KEY!,
      serviceRoleKey: requiredVars.SUPABASE_SERVICE_ROLE_KEY!,
    },
    server: {
      port,
      nodeEnv: requiredVars.NODE_ENV!,
      frontendUrl: env.FRONTEND_URL,
    },
  };
}

function constructDatabaseUrl(supabaseUrl: string): string {
  try {
    const projectId = supabaseUrl.split('//')[1].split('.')[0];
    return `postgresql://postgres.${projectId}:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;
  } catch (error) {
    throw new Error('Invalid SUPABASE_URL format. Cannot construct database URL.');
  }
}

// Export the validated configuration
export const config = validateEnvironmentVariables();

// Export validation function for testing
export { validateEnvironmentVariables };
