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
    // Lógica sensível ao ambiente para carregar as credenciais corretas.
    // Vite expõe `import.meta.env.PROD` como `true` no build de produção.
    // As secrets do Replit (PROD_) estão disponíveis via `import.meta.env.VITE_`.
    const supabaseUrl = import.meta.env.PROD
      ? import.meta.env.VITE_PROD_SUPABASE_URL
      : import.meta.env.VITE_SUPABASE_URL;

    const supabaseAnonKey = import.meta.env.PROD
      ? import.meta.env.VITE_PROD_SUPABASE_ANON_KEY
      : import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Validação explícita para falhar rapidamente se as secrets não forem carregadas.
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('--- ERRO CRÍTICO DE CONFIGURAÇÃO FRONTEND ---');
      console.error('Variáveis de ambiente Supabase (URL ou Anon Key) não estão configuradas para o ambiente atual.');
      console.error('Ambiente detectado:', import.meta.env.PROD ? 'PRODUÇÃO' : 'DESENVOLVIMENTO');
      console.error('URL configurada:', !!supabaseUrl);
      console.error('Key configurada:', !!supabaseAnonKey);
      // Lança um erro para impedir a inicialização da aplicação com configuração inválida.
      throw new Error('Configuração do Supabase em falta. A aplicação não pode iniciar.');
    }

    clientSupabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    return clientSupabaseInstance;
  }

  // For server-side, create a basic client that won't be used
  throw new Error('Client supabase should not be used on server side');
};

// Lazy export the singleton client instance for React components
export const getSupabase = () => createClientSupabaseClient();
