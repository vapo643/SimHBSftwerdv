import { createServerSupabaseAdminClient } from '../server/lib/supabase';

async function testProfileQuery() {
  const supabase = createServerSupabaseAdminClient();
  
  // First, let's find an existing user profile
  const { data: profiles, error: listError } = await supabase
    .from('profiles')
    .select('*')
    .limit(5);
  
  console.log('Existing profiles:', profiles);
  
  if (profiles && profiles.length > 0) {
    const testProfileId = profiles[0].id;
    
    // Try the simple query first
    const { data: simpleData, error: simpleError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', testProfileId)
      .single();
    
    console.log('\nSimple profile query:', simpleData);
    console.log('Simple error:', simpleError);
    
    // Try with join
    const { data: joinData, error: joinError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        loja_id
      `)
      .eq('id', testProfileId)
      .single();
    
    console.log('\nProfile with basic select:', joinData);
    console.log('Join error:', joinError);
    
    // If there's a loja_id, try to fetch loja separately
    if (joinData?.loja_id) {
      const { data: lojaData, error: lojaError } = await supabase
        .from('lojas')
        .select(`
          id,
          nome_loja,
          parceiro_id,
          parceiros (
            id,
            razao_social,
            cnpj
          )
        `)
        .eq('id', joinData.loja_id)
        .single();
      
      console.log('\nLoja data:', lojaData);
      console.log('Loja error:', lojaError);
    }
  }
}

testProfileQuery().catch(console.error);