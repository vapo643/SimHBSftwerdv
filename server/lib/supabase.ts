import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

const _supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const _supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const _databaseUrl = process.env.DATABASE_URL || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL environment variable');
}

// Server-side Supabase client - properly isolated from client-side singleton
export const _supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  const _client = createClient(supabaseUrl, supabaseAnonKey, {
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

if (databaseUrl.includes('_supabase.com')) {
  console.log('✅ Database: Configuring Supabase connection...');

  // Use transaction pooler port and SSL
  let _correctedUrl = databaseUrl;
  if (!correctedUrl.includes('sslmode=')) {
    correctedUrl += correctedUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }
  if (correctedUrl.includes(':5432')) {
    correctedUrl = correctedUrl.replace(':5432', ':6543');
  }

  // Create connection with proper configuration
  dbClient = postgres(correctedUrl, {
    ssl: 'require',
    max: 5,
    idle_timeout: 30,
    connect_timeout: 10,
  });
  console.log('✅ Database: Connection configured (lazy)');
} else {
  dbClient = postgres(databaseUrl);
}

const _client = dbClient;
export const _db = drizzle(client, { schema });

// Test database connection asynchronously
setTimeout(async () => {
  try {
    await client`SELECT 1`;
    console.log('✅ Database: Connection test successful');
  } catch (error) {
    console.warn('⚠️  Database: Connection test failed -', (error as Error).message);
    console.warn('⚠️  Database: Check DATABASE_URL credentials in Secrets');
    console.warn('⚠️  Database: App will continue using Supabase REST API only');
  }
}, 2000);
