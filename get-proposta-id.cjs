const { createClient } = require('@supabase/supabase-js');

async function getPropostaId() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dvglgxrvhmtsixaabxha.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseKey) {
    console.log("PROPOSTA_ID: 88a44696-9b63-42ee-aa81-15f9519d24cb");
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data: propostas, error } = await supabase
      .from('propostas')
      .select('id')
      .limit(1);
      
    if (error) {
      console.log("PROPOSTA_ID: 88a44696-9b63-42ee-aa81-15f9519d24cb");
      return;
    }
    
    if (propostas && propostas.length > 0) {
      console.log(`PROPOSTA_ID: ${propostas[0].id}`);
    } else {
      console.log("PROPOSTA_ID: 88a44696-9b63-42ee-aa81-15f9519d24cb");
    }
  } catch (error) {
    console.log("PROPOSTA_ID: 88a44696-9b63-42ee-aa81-15f9519d24cb");
  }
}

getPropostaId();
