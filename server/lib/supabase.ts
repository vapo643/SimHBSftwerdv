import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const databaseUrl = process.env.DATABASE_URL || "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL environment variable");
}

// Server-side Supabase client - properly isolated from client-side singleton
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// NOVA FUNÇÃO para operações Admin:
export function createServerSupabaseAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY é obrigatória para operações administrativas');
  }
  
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

// FUNÇÃO ANTI-FRÁGIL para operações com RLS (autenticadas):
export function createServerSupabaseClient(accessToken?: string) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Se token fornecido, configurar para respeitar RLS
  if (accessToken) {
    // Configurar sessão manualmente para RLS
    client.auth.setSession({
      access_token: accessToken,
      refresh_token: ''
    });
  }

  return client;
}

// Database connection using Drizzle
// WARNING: DATABASE_URL is pointing to Neon instead of Supabase
// This needs to be fixed in Replit Secrets - see CORRIGIR_BANCO_URGENTE.md
if (databaseUrl.includes('neon')) {
  console.warn('⚠️  DATABASE_URL está apontando para Neon em vez do Supabase!');
  console.warn('⚠️  Por favor, corrija isso nos Secrets do Replit');
  console.warn('⚠️  Veja o arquivo CORRIGIR_BANCO_URGENTE.md para instruções');
}

// Use the DATABASE_URL as is for now to keep the app running
const client = postgres(databaseUrl);
export const db = drizzle(client, { schema });
