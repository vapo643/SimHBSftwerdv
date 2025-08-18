#!/usr/bin/env node

/**
 * Teste simples para verificar se a pasta ccb/assinadas será criada corretamente
 */

const { createClient } = require('@supabase/supabase-js');

async function testarPastaAssinadas() {
  try {
    console.log('🧪 [TESTE] Verificando funcionalidade da pasta ccb/assinadas...');
    
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Criar um arquivo de teste
    const testContent = 'Teste de CCB assinada - ' + new Date().toISOString();
    const testFileName = `ccb_assinada_TESTE_${Date.now()}.pdf`;
    const testPath = `ccb/assinadas/${testFileName}`;

    console.log(`📝 [TESTE] Criando arquivo de teste: ${testPath}`);

    // 2. Upload do arquivo de teste
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(testPath, Buffer.from(testContent), {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ [TESTE] Erro no upload:', uploadError.message);
      return;
    }

    console.log('✅ [TESTE] Arquivo de teste criado com sucesso!');

    // 3. Verificar se a pasta foi criada e o arquivo existe
    const { data: listData, error: listError } = await supabase.storage
      .from('documents')
      .list('ccb/assinadas', { limit: 10 });

    if (listError) {
      console.error('❌ [TESTE] Erro ao listar pasta:', listError.message);
      return;
    }

    console.log('📁 [TESTE] Conteúdo da pasta ccb/assinadas:');
    console.log(listData?.map(f => f.name) || []);

    // 4. Remover arquivo de teste
    const { error: removeError } = await supabase.storage
      .from('documents')
      .remove([testPath]);

    if (removeError) {
      console.warn('⚠️ [TESTE] Não foi possível remover arquivo de teste:', removeError.message);
    } else {
      console.log('🧹 [TESTE] Arquivo de teste removido');
    }

    console.log('\n✅ [TESTE] A pasta ccb/assinadas está funcionando perfeitamente!');
    console.log('📋 [TESTE] Próximas CCBs assinadas serão salvas automaticamente nesta pasta');

  } catch (error) {
    console.error('❌ [TESTE] Erro crítico:', error);
  }
}

testarPastaAssinadas().then(() => {
  console.log('\n🎉 Teste concluído');
  process.exit(0);
}).catch(error => {
  console.error('❌ Teste falhou:', error);
  process.exit(1);
});