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

// Database connection using Drizzle
const client = postgres(databaseUrl);
export const db = drizzle(client, { schema });
