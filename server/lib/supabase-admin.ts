import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client - OPUS PROTOCOL canonical variables only
function getSupabaseAdminCredentials() {
  // OPUS PROTOCOL: Canonical variables only
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return { supabaseUrl, supabaseServiceKey };
}

const { supabaseUrl, supabaseServiceKey } = getSupabaseAdminCredentials();

// Validação explícita com mensagem de erro informativa.
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('--- ERRO CRÍTICO DE CONFIGURAÇÃO ---');
  console.error('As variáveis canônicas (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) não estão configuradas.');
  console.error('As operações de Admin do Supabase serão desativadas.');
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
