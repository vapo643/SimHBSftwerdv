#!/usr/bin/env node

/**
 * Verificação completa da implementação CCB de teste
 * PAM V1.0 - 7-CHECK EXPANDIDO
 */

const { createClient } = require('@supabase/supabase-js');

async function verificacaoCompleta() {
  try {
    console.log('🔍 [7-CHECK] Verificação completa da implementação...\n');
    
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const proposalId = '902183dd-b5d1-4e20-8a72-79d3d3559d4d';
    const expectedPath = 'ccb/assinadas/902183dd-b5d1-4e20-8a72-79d3d3559d4d/ccb_assinada_teste.pdf';

    // 1. Verificar se ficheiro existe no storage
    console.log('📁 [CHECK 1] Verificando ficheiro no Supabase Storage...');
    const { data: listData, error: listError } = await supabase.storage
      .from('documents')
      .list('ccb/assinadas/902183dd-b5d1-4e20-8a72-79d3d3559d4d');

    if (listError) {
      console.error('❌ [CHECK 1] Erro ao verificar storage:', listError.message);
      return false;
    }

    const testFile = listData?.find(f => f.name === 'ccb_assinada_teste.pdf');
    if (testFile) {
      console.log('✅ [CHECK 1] Ficheiro encontrado no storage');
      console.log(`   Nome: ${testFile.name}`);
      console.log(`   Tamanho: ${testFile.metadata?.size || 'N/A'} bytes`);
    } else {
      console.error('❌ [CHECK 1] Ficheiro não encontrado no storage');
      return false;
    }

    // 2. Verificar caminho no banco de dados
    console.log('\n🗃️ [CHECK 2] Verificando registro no banco de dados...');
    const { data: proposta, error: propostaError } = await supabase
      .from('propostas')
      .select('id, cliente_nome, caminho_ccb_assinado, status')
      .eq('id', proposalId)
      .single();

    if (propostaError || !proposta) {
      console.error('❌ [CHECK 2] Erro ao buscar proposta:', propostaError?.message);
      return false;
    }

    if (proposta.caminho_ccb_assinado === expectedPath) {
      console.log('✅ [CHECK 2] Caminho no banco correto');
      console.log(`   Cliente: ${proposta.cliente_nome}`);
      console.log(`   Status: ${proposta.status}`);
      console.log(`   Caminho: ${proposta.caminho_ccb_assinado}`);
    } else {
      console.error('❌ [CHECK 2] Caminho no banco incorreto');
      console.log(`   Esperado: ${expectedPath}`);
      console.log(`   Atual: ${proposta.caminho_ccb_assinado}`);
      return false;
    }

    // 3. Verificar URL assinada
    console.log('\n🔗 [CHECK 3] Verificando URL assinada...');
    const { data: signedData, error: signedError } = await supabase.storage
      .from('documents')
      .createSignedUrl(expectedPath, 60); // 1 minuto

    if (signedError) {
      console.error('❌ [CHECK 3] Erro ao gerar URL assinada:', signedError.message);
      return false;
    }

    if (signedData?.signedUrl) {
      console.log('✅ [CHECK 3] URL assinada gerada com sucesso');
      console.log(`   URL: ${signedData.signedUrl.substring(0, 100)}...`);
    } else {
      console.error('❌ [CHECK 3] Falha ao gerar URL assinada');
      return false;
    }

    // 4. Verificar acesso ao ficheiro
    console.log('\n📄 [CHECK 4] Verificando acesso ao ficheiro...');
    try {
      const response = await fetch(signedData.signedUrl);
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        console.log('✅ [CHECK 4] Ficheiro acessível via URL');
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Content-Length: ${contentLength} bytes`);
      } else {
        console.error('❌ [CHECK 4] Erro ao acessar ficheiro:', response.status);
        return false;
      }
    } catch (fetchError) {
      console.error('❌ [CHECK 4] Erro de rede ao acessar ficheiro:', fetchError.message);
      return false;
    }

    // 5. Verificar estrutura da pasta assinadas
    console.log('\n📂 [CHECK 5] Verificando estrutura da pasta assinadas...');
    const { data: assinadasList, error: assinadasError } = await supabase.storage
      .from('documents')
      .list('ccb/assinadas', { limit: 10 });

    if (assinadasError) {
      console.error('❌ [CHECK 5] Erro ao listar pasta assinadas:', assinadasError.message);
      return false;
    }

    console.log('✅ [CHECK 5] Pasta assinadas acessível');
    console.log(`   Total de itens: ${assinadasList?.length || 0}`);
    console.log(`   Contém proposta teste: ${assinadasList?.some(item => item.name === proposalId) ? 'Sim' : 'Não'}`);

    console.log('\n🎉 [SUCCESS] Todos os checks passaram!');
    console.log('\n📋 [RELATÓRIO FINAL]');
    console.log('   ✅ Ficheiro criado e carregado no storage');
    console.log('   ✅ Caminho atualizado no banco de dados');
    console.log('   ✅ URL assinada funcionando');
    console.log('   ✅ Ficheiro acessível via HTTP');
    console.log('   ✅ Estrutura de pastas correta');
    console.log('\n🚀 [READY] Sistema pronto para teste da Tela de Pagamentos!');

    return true;

  } catch (error) {
    console.error('❌ [7-CHECK] Erro crítico na verificação:', error);
    return false;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  verificacaoCompleta().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { verificacaoCompleta };