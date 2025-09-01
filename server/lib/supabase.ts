import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const databaseUrl = process.env.DATABASE_URL || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL environment variable');
}

// Server-side Supabase client - properly isolated from client-side singleton
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// NOVA FUNÇÃO para operações Admin:
export function createServerSupabaseAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY é obrigatória para operações administrativas');
  }

  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// FUNÇÃO ANTI-FRÁGIL para operações com RLS (autenticadas):
export function createServerSupabaseClient(accessToken?: string) {
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

if (databaseUrl.includes('supabase.com')) {
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
    max: 20,                    // Increased from 5 to 20 for better concurrency handling
    idle_timeout: 30,          // Keep connections alive for 30s when idle
    connect_timeout: 10,       // 10s timeout for new connections
    prepare: false,            // Disable prepared statements for better Supabase compatibility
    onnotice: () => {},        // Suppress PostgreSQL notices in logs
    debug: process.env.NODE_ENV === 'development', // Enable debug in dev only
    transform: {
      undefined: null,         // Transform undefined to null for PostgreSQL
    },
  });
  console.log('✅ Database: Connection pool configured with 20 max connections (Mission 3 optimization)');
  console.log('📊 Pool Config: idle_timeout=30s, connect_timeout=10s, prepared_statements=disabled');
} else {
  // MISSION 3: Local/non-Supabase PostgreSQL with optimized pooling
  dbClient = postgres(databaseUrl, {
    max: 20,                    // Consistent pool size across environments
    idle_timeout: 30,          // 30s idle timeout
    connect_timeout: 10,       // 10s connection timeout
    prepare: false,            // Disable prepared statements for consistency
    onnotice: () => {},        // Suppress notices
    debug: process.env.NODE_ENV === 'development',
    transform: {
      undefined: null,
    },
  });
}

const client = dbClient;
export const db = drizzle(client, { 
  schema,
  logger: true  // PERF-FIX-001: Ativar logging SQL para auditoria N+1
});

// MISSION 3: Enhanced connection pool monitoring and testing
setTimeout(async () => {
  try {
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
