import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client - HARDENED para produção
function getSupabaseAdminCredentials() {
  // Carrega exclusivamente as variáveis de ambiente de PRODUÇÃO.
  const supabaseUrl = process.env.PROD_SUPABASE_URL;
  const supabaseServiceKey = process.env.PROD_SUPABASE_SERVICE_KEY;

  return { supabaseUrl, supabaseServiceKey };
}

const { supabaseUrl, supabaseServiceKey } = getSupabaseAdminCredentials();

// Validação explícita com mensagem de erro informativa.
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('--- ERRO CRÍTICO DE CONFIGURAÇÃO ADMIN CLIENT ---');
  console.error('As variáveis de ambiente de produção (PROD_SUPABASE_URL, PROD_SUPABASE_SERVICE_KEY) não estão configuradas.');
  console.error('O cliente Admin do Supabase será desativado.');
  console.error('--- FIM DO ERRO ---');
}

export const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
