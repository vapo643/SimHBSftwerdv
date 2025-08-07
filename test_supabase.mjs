import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Testando conexão com Supabase...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

try {
  const { data, error } = await supabase
    .from('propostas')
    .select('id')
    .limit(1);
  
  if (error) {
    console.log('❌ Erro:', error.message);
  } else {
    console.log('✅ Supabase conectado com sucesso!');
    console.log('Propostas no banco:', data ? data.length : 0);
  }
} catch (err) {
  console.log('❌ Erro geral:', err);
}
