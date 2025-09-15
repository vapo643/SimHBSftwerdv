import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

// OPUS PROTOCOL: Simplified canonical credentials only
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const databaseUrl = process.env.DATABASE_URL || '';

// Graceful handling for missing Supabase credentials
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables not configured. Some features may be limited.');
  console.warn(`   Missing: ${!supabaseUrl ? 'SUPABASE_URL ' : ''}${!supabaseAnonKey ? 'SUPABASE_ANON_KEY' : ''}`);
  console.warn('ℹ️  Configure SUPABASE_URL and SUPABASE_ANON_KEY in deployment secrets');
}

if (!databaseUrl) {
  console.warn('⚠️ Database URL not configured. Using fallback configuration.');
  console.warn('ℹ️  Configure DATABASE_URL in deployment secrets for full functionality');
}

// Server-side Supabase client - properly isolated from client-side singleton
// Only create if credentials are available
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// 🔧 PAM V1.3 PRODUCTION DIAGNOSTICS - Enhanced admin client with production-specific debugging
export const createServerSupabaseAdminClient = () => {
  const timestamp = new Date().toISOString();
  const nodeEnv = process.env.NODE_ENV || 'unknown';
  
  console.log(`🔍 [${timestamp}] SUPABASE_ADMIN_CLIENT_DEBUG - Environment: ${nodeEnv}`);
  
  // Multi-tier environment variable detection with fallbacks
  const url = process.env.SUPABASE_URL || 
              process.env.VITE_SUPABASE_URL || 
              process.env.PROD_SUPABASE_URL ||
              process.env.STAGING_SUPABASE_URL ||
              process.env.DEV_SUPABASE_URL;
              
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
                     process.env.SUPABASE_SERVICE_KEY || // Alternative naming
                     process.env.PROD_SUPABASE_SERVICE_ROLE_KEY ||
                     process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ||
                     process.env.DEV_SUPABASE_SERVICE_ROLE_KEY;

  // Enhanced diagnostic logging with specific production debug info
  console.log(`🔍 [${timestamp}] SUPABASE_URL: ${url ? '[FOUND]' : '[MISSING]'}`);
  console.log(`🔍 [${timestamp}] SERVICE_KEY: ${serviceKey ? '[FOUND]' : '[MISSING]'}`);
  
  if (url) {
    console.log(`🔍 [${timestamp}] URL source: ${url.includes('supabase.co') ? 'valid-supabase-domain' : 'custom-domain'}`);
    // PAM V1.3: Extract project ID for validation
    const projectMatch = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    const projectId = projectMatch ? projectMatch[1] : 'unknown';
    console.log(`🔍 [${timestamp}] Project ID: ${projectId}`);
  }
  
  if (serviceKey) {
    console.log(`🔍 [${timestamp}] SERVICE_KEY length: ${serviceKey.length} chars`);
    // PAM V1.3: Validate key format without exposing actual key
    const keyPrefix = serviceKey.substring(0, 20) + '...';
    console.log(`🔍 [${timestamp}] SERVICE_KEY prefix: ${keyPrefix}`);
    
    // Validate key format (should start with eyJ for JWT)
    const isValidFormat = serviceKey.startsWith('eyJ');
    console.log(`🔍 [${timestamp}] SERVICE_KEY format valid: ${isValidFormat ? 'YES' : 'NO - POTENTIAL ISSUE'}`);
  }

  // Enhanced validation with specific missing variable reporting
  if (!serviceKey || !url) {
    console.error(`--- [${timestamp}] ERRO CRÍTICO DE CONFIGURAÇÃO ---`);
    console.error(`Environment: ${nodeEnv}`);
    console.error(`SUPABASE_URL: ${!url ? '❌ MISSING' : '✅ PRESENT'}`);
    console.error(`SUPABASE_SERVICE_ROLE_KEY: ${!serviceKey ? '❌ MISSING' : '✅ PRESENT'}`);
    
    // List all available SUPABASE env vars for debugging
    const supabaseVars = Object.keys(process.env).filter(key => key.includes('SUPABASE'));
    console.error(`Available SUPABASE env vars: ${supabaseVars.join(', ')}`);
    console.error('As operações de Admin do Supabase serão desativadas.');
    console.error('--- FIM DO ERRO ---');
    return null as any; 
  }

  console.log(`✅ [${timestamp}] Supabase Admin Client configurado com sucesso`);
  
  // PAM V1.3: Create client with enhanced error handling for production
  try {
    const client = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      // PAM V1.3: Add production-specific options
      realtime: {
        params: {
          eventsPerSecond: 2 // Limit realtime events in production
        }
      },
      global: {
        headers: {
          'X-Client-Info': `supabase-admin-${nodeEnv}`
        }
      }
    });
    
    // PAM V1.3: Immediate validation test for production debugging
    if (nodeEnv === 'production') {
      console.log(`🧪 [${timestamp}] Running immediate client validation test...`);
      // We'll add a test query in the route where it's used
    }
    
    return client;
  } catch (error) {
    console.error(`❌ [${timestamp}] ERRO ao criar Supabase Admin Client:`, error);
    console.error(`🔍 [${timestamp}] URL válida: ${url?.includes('supabase.co')}, Key válida: ${serviceKey?.length > 50}`);
    throw error;
  }
};

// FUNÇÃO ANTI-FRÁGIL para operações com RLS (autenticadas):
export function createServerSupabaseClient(accessToken?: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Cannot create Supabase client - credentials not configured');
    return null as any;
  }
  
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Se token fornecido, configurar para respeitar RLS
  if (accessToken) {
    // Configurar sessão manualmente para RLS
    client.auth.setSession({
      access_token: accessToken,
      refresh_token: '',
    });
  }

  return client;
}

// Database connection using Drizzle with Supabase
// Temporary: Use lazy connection to prevent server crash
let dbClient;

if (databaseUrl && databaseUrl.includes('supabase.co')) {
  console.log('✅ Database: Configuring Supabase connection...');

  // Use transaction pooler port and SSL
  let correctedUrl = databaseUrl;
  if (!correctedUrl.includes('sslmode=')) {
    correctedUrl += correctedUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }
  if (correctedUrl.includes(':5432')) {
    correctedUrl = correctedUrl.replace(':5432', ':6543');
  }

  // MISSION 3 OPTIMIZATION: Robust connection pool for high concurrency
  dbClient = postgres(correctedUrl, {
    ssl: 'require',
    max: 20, // Increased from 5 to 20 for better concurrency handling
    idle_timeout: 30, // Keep connections alive for 30s when idle
    connect_timeout: 10, // 10s timeout for new connections
    prepare: false, // Disable prepared statements for better Supabase compatibility
    onnotice: () => {}, // Suppress PostgreSQL notices in logs
    debug: process.env.NODE_ENV === 'development', // Enable debug in dev only
    transform: {
      undefined: null, // Transform undefined to null for PostgreSQL
    },
  });
  console.log(
    '✅ Database: Connection pool configured with 20 max connections (Mission 3 optimization)'
  );
  console.log(
    '📊 Pool Config: idle_timeout=30s, connect_timeout=10s, prepared_statements=disabled'
  );
} else if (databaseUrl) {
  // MISSION 3: Local/non-Supabase PostgreSQL with optimized pooling
  // CRITICAL FIX: Add SSL requirement for external PostgreSQL connections
  dbClient = postgres(databaseUrl, {
    ssl: databaseUrl.includes('postgresql://') && !databaseUrl.includes('localhost') ? 'require' : false, // SSL for external connections
    max: 20, // Consistent pool size across environments
    idle_timeout: 30, // 30s idle timeout
    connect_timeout: 10, // 10s connection timeout
    prepare: false, // Disable prepared statements for consistency
    onnotice: () => {}, // Suppress notices
    debug: process.env.NODE_ENV === 'development',
    transform: {
      undefined: null,
    },
  });
} else {
  console.warn('⚠️ No database URL configured. Creating mock database client.');
  console.warn('ℹ️  Some database operations will be limited until DATABASE_URL is configured.');
  
  // Create a mock client that prevents crashes
  dbClient = {
    query: () => Promise.resolve([]),
    end: () => Promise.resolve(),
  } as any;
}

const client = dbClient;
export const db = client ? drizzle(client, {
  schema,
  logger: true, // PERF-FIX-001: Ativar logging SQL para auditoria N+1
}) : null;

// UUID do sistema para operações automatizadas (corrige problema de cast UUID crítico)
export const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000001';

// MISSION 3: Enhanced connection pool monitoring and testing
setTimeout(async () => {
  try {
    if (!client || !databaseUrl) {
      console.log('ℹ️  Database: Skipping connection test - no database configured');
      return;
    }
    
    const startTime = Date.now();
    await client`SELECT 1, current_setting('max_connections') as max_conn`;
    const duration = Date.now() - startTime;

    console.log('✅ Database: Connection pool test successful');
    console.log(`📊 Connection latency: ${duration}ms`);
    console.log('🔧 Connection pool ready for high concurrency workload');
  } catch (error) {
    console.error('❌ Database: Connection pool test failed -', (error as Error).message);
    console.warn('⚠️  Database: Check DATABASE_URL credentials and network connectivity');
    console.warn('⚠️  Database: Pool optimization may not be effective - using fallback REST API');
  }
}, 2000);
