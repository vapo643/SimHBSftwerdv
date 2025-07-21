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

// Database connection using Drizzle
const client = postgres(databaseUrl);
export const db = drizzle(client, { schema });
