#!/usr/bin/env node

/**
 * Script para verificar estrutura do Storage Supabase
 * Listar arquivos de CCB assinadas
 */

const { createClient } = require('@supabase/supabase-js');

async function checkStorageStructure() {
  try {
    console.log('🔍 [STORAGE CHECK] Verificando estrutura do storage...');
    
    // Usar admin client para acesso completo
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Listar estrutura principal do bucket documents
    console.log('\n📁 [STORAGE] Estrutura principal do bucket documents:');
    const { data: rootFiles, error: rootError } = await supabase.storage
      .from('documents')
      .list('', { limit: 100 });

    if (rootError) {
      console.error('❌ Erro ao listar root:', rootError);
      return;
    }

    console.log('Root folders/files:', rootFiles?.map(f => f.name) || []);

    // 2. Listar pasta ccb/
    console.log('\n📁 [STORAGE] Conteúdo da pasta ccb/:');
    const { data: ccbFiles, error: ccbError } = await supabase.storage
      .from('documents')
      .list('ccb', { limit: 100 });

    if (ccbError) {
      console.error('❌ Erro ao listar ccb/:', ccbError);
    } else {
      console.log('CCB folders:', ccbFiles?.map(f => f.name) || []);
    }

    // 3. Listar pasta ccb/assinadas/
    console.log('\n📁 [STORAGE] Conteúdo da pasta ccb/assinadas/:');
    const { data: assinadasFiles, error: assinadasError } = await supabase.storage
      .from('documents')
      .list('ccb/assinadas', { limit: 100 });

    if (assinadasError) {
      console.error('❌ Erro ao listar ccb/assinadas/:', assinadasError);
    } else {
      console.log('Arquivos CCB assinadas:', assinadasFiles?.map(f => ({
        name: f.name,
        size: f.metadata?.size || 'N/A',
        created: f.created_at
      })) || []);
      
      console.log(`\n📊 [ESTATÍSTICAS] Total de CCBs assinadas organizadas: ${assinadasFiles?.length || 0}`);
    }

    // 5. Verificar se há propostas com CCB assinada no banco
    console.log('\n🗃️ [DATABASE] Propostas com CCB assinada:');
    
    // Simular uma query (precisa do database)
    console.log('Para verificar o banco, execute:');
    console.log('SELECT id, cliente_nome, caminho_ccb_assinado FROM propostas WHERE caminho_ccb_assinado IS NOT NULL;');

  } catch (error) {
    console.error('❌ [STORAGE CHECK] Erro geral:', error);
  }
}

checkStorageStructure().then(() => {
  console.log('\n✅ [STORAGE CHECK] Verificação concluída');
  process.exit(0);
}).catch(error => {
  console.error('❌ [STORAGE CHECK] Falha crítica:', error);
  process.exit(1);
});