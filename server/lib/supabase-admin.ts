import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client for server-side operations
const _supabaseUrl = process.env.VITE_SUPABASE_URL!;
const _supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

export const _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
