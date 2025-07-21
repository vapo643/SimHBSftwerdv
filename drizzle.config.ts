
import { defineConfig } from "drizzle-kit";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is required");
}

if (!supabaseServiceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for database operations");
}

// Extract project ID from Supabase URL
const projectId = supabaseUrl.split('//')[1].split('.')[0];

// Supabase connection string for Drizzle migrations
const connectionString = process.env.SUPABASE_DATABASE_URL || 
  `postgresql://postgres.${projectId}:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
