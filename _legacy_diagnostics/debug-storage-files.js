import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rgcxdrvkfepqvqobuzix.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY não encontrada!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listarArquivosProposta() {
  const propostaId = '88a44696-9b63-42ee-aa81-15f9519d24cb';
  const storagePath = `propostas/${propostaId}/boletos/emitidos_pendentes`;
  
  console.log(`\n📁 Listando arquivos em: ${storagePath}`);
  
  try {
    const { data: files, error } = await supabase.storage
      .from('documents')
      .list(storagePath, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('❌ Erro ao listar:', error);
      return;
    }

    if (!files || files.length === 0) {
      console.log('📂 Nenhum arquivo encontrado no storage');
      return;
    }

    console.log(`✅ Encontrados ${files.length} arquivos:`);
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.name}`);
      console.log(`   Tamanho: ${file.metadata?.size || 'unknown'} bytes`);
      console.log(`   Criado em: ${file.created_at}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

listarArquivosProposta();