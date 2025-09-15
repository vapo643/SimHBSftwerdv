import { createClient, SupabaseClient } from '@supabase/supabase-js';

let clientSupabaseInstance: SupabaseClient | null = null;

// Função para criar o cliente Supabase para o lado do servidor (Express.js)
export const createServerSupabaseClient = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const supabaseUrl = isProd
    ? (process.env.PROD_SUPABASE_URL || process.env.SUPABASE_URL || '')
    : (process.env.SUPABASE_URL || '');
  const supabaseAnonKey = isProd
    ? (process.env.PROD_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '')
    : (process.env.SUPABASE_ANON_KEY || '');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase server credentials not configured. Server-side operations will be limited.');
    if (isProd) {
      console.warn('ℹ️  Configure PROD_SUPABASE_URL and PROD_SUPABASE_ANON_KEY for full functionality');
    }
    return null as any;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

// Função para criar ou retornar a instância única do cliente para o lado do cliente (React)
export const createClientSupabaseClient = () => {
  if (clientSupabaseInstance) {
    return clientSupabaseInstance;
  }

  // Check if we're in a browser environment before accessing import.meta.env
  if (typeof window !== 'undefined') {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('⚠️ Supabase client credentials not configured. Some features may be limited.');
      return null as any;
    }

    clientSupabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    return clientSupabaseInstance;
  }

  // For server-side, create a basic client that won't be used
  throw new Error('Client supabase should not be used on server side');
};

// Lazy export the singleton client instance for React components
export const getSupabase = () => {
  console.log('[DIAGNOSTICO SUPABASE FE] Inicializando cliente com:', {
    URL: import.meta.env.VITE_SUPABASE_URL,
    ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY
  });
  return createClientSupabaseClient();
};
