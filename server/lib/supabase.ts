import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

// Helper function to get environment-specific Supabase credentials
function getSupabaseCredentials() {
  const isProd = process.env.NODE_ENV === 'production';
  
  const supabaseUrl = isProd 
    ? (process.env.PROD_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    : (process.env.DEV_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '');
    
  const supabaseAnonKey = isProd
    ? (process.env.PROD_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '')
    : (process.env.DEV_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '');
    
  const databaseUrl = isProd
    ? (process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || '')
    : (process.env.DATABASE_URL || '');

  return { supabaseUrl, supabaseAnonKey, databaseUrl };
}

const { supabaseUrl, supabaseAnonKey, databaseUrl } = getSupabaseCredentials();

// Graceful handling for missing Supabase credentials
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables not configured. Some features may be limited.');
  console.warn(`   Missing: ${!supabaseUrl ? 'SUPABASE_URL ' : ''}${!supabaseAnonKey ? 'SUPABASE_ANON_KEY' : ''}`);
  if (process.env.NODE_ENV === 'production') {
    console.warn('ℹ️  Configure PROD_SUPABASE_URL and PROD_SUPABASE_ANON_KEY in deployment secrets');
  }
}

if (!databaseUrl) {
  console.warn('⚠️ Database URL not configured. Using fallback configuration.');
  if (process.env.NODE_ENV === 'production') {
    console.warn('ℹ️  Configure PROD_DATABASE_URL in deployment secrets for full functionality');
  }
}

// Server-side Supabase client - properly isolated from client-side singleton
// Only create if credentials are available
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// NOVA FUNÇÃO para operações Admin com graceful handling:
export function createServerSupabaseAdminClient() {
  const isProd = process.env.NODE_ENV === 'production';
  const serviceKey = isProd 
    ? (process.env.PROD_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
    : (process.env.DEV_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const url = isProd
    ? (process.env.PROD_SUPABASE_URL || process.env.SUPABASE_URL)
    : (process.env.DEV_SUPABASE_URL || process.env.SUPABASE_URL);

  if (!serviceKey || !url) {
    console.warn('⚠️ Supabase admin credentials not configured. Admin operations will be limited.');
    if (isProd) {
      console.warn('ℹ️  Configure PROD_SUPABASE_SERVICE_KEY and PROD_SUPABASE_URL for admin operations');
    }
    // Return a mock client that will fail gracefully
    return null as any;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

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

if (databaseUrl && databaseUrl.includes('supabase.com')) {
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
  dbClient = postgres(databaseUrl, {
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
