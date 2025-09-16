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

// Utility functions for PROJECT_ID extraction and validation
function extractProjectIdFromUrl(url: string): string | null {
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
}

function extractProjectIdFromServiceKey(serviceKey: string): string | null {
  try {
    if (!serviceKey.startsWith('eyJ')) return null;
    
    // Decode JWT header to get project info
    const headerB64 = serviceKey.split('.')[0];
    const headerJson = JSON.parse(Buffer.from(headerB64, 'base64').toString('utf8'));
    
    // Decode JWT payload to get project info
    const payloadB64 = serviceKey.split('.')[1];
    const payloadJson = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
    
    // Extract project reference from iss (issuer) field
    const issuer = payloadJson.iss;
    if (issuer?.includes('supabase.co')) {
      const projectMatch = issuer.match(/https:\/\/([^.]+)\.supabase\.co/);
      return projectMatch ? projectMatch[1] : null;
    }
    
    return null;
  } catch (error) {
    console.warn(`Warning: Failed to decode SERVICE_KEY JWT:`, error);
    return null;
  }
}

async function runPreflightValidation(client: any, timestamp: string): Promise<boolean> {
  try {
    console.log(`🧪 [${timestamp}] PREFLIGHT: Testing Supabase Admin API connection...`);
    
    const startTime = Date.now();
    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
    const duration = Date.now() - startTime;
    
    if (error) {
      console.error(`❌ [${timestamp}] PREFLIGHT FAILED: ${error.message}`);
      console.error(`🔍 [${timestamp}] Error code: ${error.status}`);
      
      if (error.message?.includes('Invalid API key') || error.status === 401) {
        console.error(`🚨 [${timestamp}] CRITICAL: URL/SERVICE_KEY MISMATCH DETECTED`);
        console.error(`💡 [${timestamp}] SOLUTION: Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are from the SAME Supabase project`);
      }
      
      return false;
    }
    
    console.log(`✅ [${timestamp}] PREFLIGHT SUCCESS: Admin API validated (${duration}ms)`);
    console.log(`📊 [${timestamp}] Users accessible: ${Array.isArray(data) ? data.length : 'unknown'}`);
    return true;
    
  } catch (error) {
    console.error(`❌ [${timestamp}] PREFLIGHT EXCEPTION:`, error);
    return false;
  }
}

// 🚨 PAM V2.0 STARTUP VALIDATION - Validates Supabase configuration during startup
export const validateSupabaseAdminConfiguration = async (): Promise<boolean> => {
  const timestamp = new Date().toISOString();
  const nodeEnv = process.env.NODE_ENV || 'unknown';
  
  console.log(`🚨 [${timestamp}] STARTUP VALIDATION: PROJECT MISMATCH DETECTION ENABLED`);
  
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Check if credentials are available
  if (!url || !serviceKey) {
    console.warn(`⚠️ [${timestamp}] STARTUP: Missing Supabase credentials - skipping validation`);
    console.warn(`   SUPABASE_URL: ${url ? '✅' : '❌'}`);
    console.warn(`   SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? '✅' : '❌'}`);
    return false; // Non-fatal for development
  }

  let urlProjectId: string | null = null;
  let keyProjectId: string | null = null;
  
  // Extract project IDs
  if (url) {
    urlProjectId = extractProjectIdFromUrl(url);
    console.log(`🔍 [${timestamp}] URL Project ID: ${urlProjectId || 'unknown'}`);
  }
  
  if (serviceKey) {
    keyProjectId = extractProjectIdFromServiceKey(serviceKey);
    console.log(`🔍 [${timestamp}] KEY Project ID: ${keyProjectId || 'unknown/failed-decode'}`);
  }

  // CRITICAL MISMATCH DETECTION
  if (urlProjectId && keyProjectId && urlProjectId !== keyProjectId) {
    console.error(`🚨🚨🚨 [${timestamp}] SUPABASE PROJECT MISMATCH DETECTED! 🚨🚨🚨`);
    console.error(`Environment: ${nodeEnv}`);
    console.error(`SUPABASE_URL Project:           ${urlProjectId}`);
    console.error(`SUPABASE_SERVICE_ROLE_KEY Project: ${keyProjectId}`);
    console.error(`🔥 CRITICAL: URL and SERVICE_KEY are from DIFFERENT Supabase projects!`);
    console.error(`💡 SOLUTION: Update deployment secrets to use the SAME project for both variables`);
    console.error(`🔧 Test command: node -e "console.log('URL proj:', '${urlProjectId}'); console.log('KEY proj:', '${keyProjectId}')"`);
    console.error(`--- STARTUP ABORTED DUE TO PROJECT MISMATCH ---`);
    
    // FAIL FAST - Prevent server startup with mismatch
    throw new Error(`SUPABASE PROJECT MISMATCH: URL project '${urlProjectId}' != SERVICE_KEY project '${keyProjectId}'`);
  }

  if (urlProjectId && keyProjectId) {
    console.log(`✅ [${timestamp}] PROJECT VALIDATION: Both credentials belong to project '${urlProjectId}'`);
  }

  // Create client for preflight test
  try {
    const client = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    });
    
    // MANDATORY PREFLIGHT VALIDATION
    console.log(`🧪 [${timestamp}] Running preflight API validation...`);
    const preflightPassed = await runPreflightValidation(client, timestamp);
    
    if (!preflightPassed) {
      console.error(`🚨 [${timestamp}] PREFLIGHT VALIDATION FAILED!`);
      console.error(`💡 [${timestamp}] Most likely cause: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from different projects`);
      console.error(`🔧 [${timestamp}] Verify both secrets are from the same Supabase project`);
      throw new Error('Supabase Admin Client preflight validation failed');
    }
    
    console.log(`✅ [${timestamp}] Supabase Admin configuration FULLY VALIDATED`);
    return true;
    
  } catch (error) {
    console.error(`❌ [${timestamp}] Supabase validation error:`, error);
    
    if (urlProjectId && keyProjectId) {
      console.error(`🔍 [${timestamp}] Debug info - URL: ${urlProjectId}, KEY: ${keyProjectId}`);
    }
    
    throw error;
  }
};

// 🔧 PAM V2.0 PRODUCTION DIAGNOSTICS - Enhanced admin client with MISMATCH DETECTION
export const createServerSupabaseAdminClient = () => {
  const timestamp = new Date().toISOString();
  const nodeEnv = process.env.NODE_ENV || 'unknown';
  
  // DEEPTHINK FASE 3: Use ONLY canonical environment variables (no fallbacks)
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  // Quick project ID validation (non-blocking)
  const urlProjectId = extractProjectIdFromUrl(url);
  const keyProjectId = extractProjectIdFromServiceKey(serviceKey);
  
  if (urlProjectId && keyProjectId && urlProjectId !== keyProjectId) {
    console.warn(`⚠️ [${timestamp}] WARNING: Detected project mismatch (URL: ${urlProjectId}, KEY: ${keyProjectId})`);
    console.warn(`⚠️ [${timestamp}] This will cause authentication failures. Check deployment secrets.`);
  }
  
  // PAM V2.0: Create client with enhanced error handling for production
  try {
    const client = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      // PAM V2.0: Add production-specific options
      realtime: {
        params: {
          eventsPerSecond: 2 // Limit realtime events in production
        }
      },
      global: {
        headers: {
          'X-Client-Info': `supabase-admin-${nodeEnv}`,
          'X-Project-Validation': urlProjectId || 'unknown'
        }
      }
    });
    
    return client;
    
  } catch (error) {
    console.error(`❌ [${timestamp}] ERRO ao criar Supabase Admin Client:`, error);
    console.error(`🔍 [${timestamp}] URL válida: ${url?.includes('supabase.co')}, Key válida: ${serviceKey?.length > 50}`);
    
    if (urlProjectId && keyProjectId) {
      console.error(`🔍 [${timestamp}] Project IDs - URL: ${urlProjectId}, KEY: ${keyProjectId}`);
    }
    
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
