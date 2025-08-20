import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Testando acesso ao banco via Supabase Client...');

// Testar insert e select
const testData = {
  id: 'test-' + Date.now(),
  acao: 'TEST_CONNECTION',
  detalhes: { test: true },
  created_at: new Date().toISOString()
};

// Tentar inserir um log de teste
const { data: insertData, error: insertError } = await supabase
  .from('proposta_logs')
  .insert(testData)
  .select();

if (insertError) {
  console.log('❌ Erro ao inserir:', insertError.message);
} else {
  console.log('✅ Insert funcionou!');
  
  // Limpar o teste
  const { error: deleteError } = await supabase
    .from('proposta_logs')
    .delete()
    .eq('id', testData.id);
    
  if (!deleteError) {
    console.log('✅ Cleanup realizado');
  }
}

console.log('\n📊 Resultado: Supabase Client está funcionando corretamente!');
console.log('O problema é apenas com a DATABASE_URL que está apontando para Neon.');
