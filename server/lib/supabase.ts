import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

if (!supabaseServiceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
}

// Server-side Supabase client - properly isolated from client-side singleton
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Use Supabase database URL from environment
const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

// Database connection using Drizzle with Supabase
const client = postgres(databaseUrl);
export const db = drizzle(client, { schema });
