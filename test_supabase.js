const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    const { data, error } = await supabase.from('propostas').select('count').limit(1);

    if (error) {
      console.log('Erro ao conectar:', error);
    } else {
      console.log('✅ Conexão com Supabase funcionando!');
      console.log('Banco de dados Supabase está acessível');
    }
  } catch (err) {
    console.log('Erro:', err);
  }
}

testConnection();
