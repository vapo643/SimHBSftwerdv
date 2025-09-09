import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client for server-side operations with graceful handling
function getSupabaseAdminCredentials() {
  const isProd = process.env.NODE_ENV === 'production';
  
  const supabaseUrl = isProd
    ? (process.env.PROD_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    : (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '');
    
  const supabaseServiceKey = isProd
    ? (process.env.PROD_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    : (process.env.SUPABASE_SERVICE_ROLE_KEY || '');

  return { supabaseUrl, supabaseServiceKey };
}

const { supabaseUrl, supabaseServiceKey } = getSupabaseAdminCredentials();

// Graceful handling for missing Supabase admin credentials
if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase admin environment variables not configured. Admin operations will be limited.');
  if (process.env.NODE_ENV === 'production') {
    console.warn('ℹ️  Configure PROD_SUPABASE_URL and PROD_SUPABASE_SERVICE_ROLE_KEY in deployment secrets');
  }
}

export const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
