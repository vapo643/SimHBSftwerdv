import { createClient, SupabaseClient } from '@supabase/supabase-js';

let clientSupabaseInstance: SupabaseClient | null = null;

// Função para criar o cliente Supabase para o lado do servidor (Express.js)
export const createServerSupabaseClient = () => {
  // OPUS PROTOCOL: Use canonical variables only
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase server credentials not configured. Server-side operations will be limited.');
    console.warn('ℹ️  Configure SUPABASE_URL and SUPABASE_ANON_KEY for full functionality');
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
    // OPUS PROTOCOL: Use canonical VITE variables only
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('⚠️ Supabase client credentials not configured. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY variables.');
      return null as any;
    }

    clientSupabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    return clientSupabaseInstance;
  }

  // For server-side, create a basic client that won't be used
  throw new Error('Client supabase should not be used on server side');
};

// Lazy export the singleton client instance for React components
export const getSupabase = () => createClientSupabaseClient();
