#!/usr/bin/env node

/**
 * Teste direto da URL da CCB sem autenticação
 * PAM V1.0 - Validação Urgente
 */

const { createClient } = require('@supabase/supabase-js');

async function testarUrlCcbDireto() {
  try {
    console.log('🔍 [TESTE CCB] Testando geração de URL da CCB assinada...\n');
    
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const proposalId = '902183dd-b5d1-4e20-8a72-79d3d3559d4d';
    const expectedPath = 'ccb/assinadas/902183dd-b5d1-4e20-8a72-79d3d3559d4d/ccb_assinada_teste.pdf';

    // 1. Buscar dados da proposta
    console.log('📋 [TESTE] Buscando dados da proposta...');
    const { data: proposta, error: propostaError } = await supabase
      .from('propostas')
      .select('id, cliente_nome, caminho_ccb_assinado, ccb_gerado, assinatura_eletronica_concluida')
      .eq('id', proposalId)
      .single();

    if (propostaError || !proposta) {
      console.error('❌ [TESTE] Erro ao buscar proposta:', propostaError?.message);
      return false;
    }

    console.log('✅ [TESTE] Proposta encontrada:');
    console.log(`   Nome: ${proposta.cliente_nome}`);
    console.log(`   Caminho CCB: ${proposta.caminho_ccb_assinado}`);
    console.log(`   CCB Gerado: ${proposta.ccb_gerado}`);
    console.log(`   Assinatura Concluída: ${proposta.assinatura_eletronica_concluida}`);

    // 2. Verificar se caminho existe
    if (!proposta.caminho_ccb_assinado) {
      console.error('❌ [TESTE] Campo caminho_ccb_assinado está vazio!');
      return false;
    }

    // 3. Gerar URL assinada usando o caminho salvo
    console.log('\n🔗 [TESTE] Gerando URL assinada...');
    const { data: urlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(proposta.caminho_ccb_assinado, 3600); // 1 hora

    if (urlError) {
      console.error('❌ [TESTE] Erro ao gerar URL:', urlError.message);
      return false;
    }

    if (!urlData?.signedUrl) {
      console.error('❌ [TESTE] URL não foi gerada');
      return false;
    }

    console.log('✅ [TESTE] URL assinada gerada com sucesso!');
    console.log(`   URL: ${urlData.signedUrl}`);

    // 4. Testar acesso à URL
    console.log('\n📄 [TESTE] Testando acesso ao arquivo...');
    try {
      const response = await fetch(urlData.signedUrl);
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        console.log('✅ [TESTE] Arquivo acessível!');
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Content-Length: ${contentLength} bytes`);
        console.log(`   Status: ${response.status}`);
      } else {
        console.error(`❌ [TESTE] Erro HTTP: ${response.status}`);
        return false;
      }
    } catch (fetchError) {
      console.error('❌ [TESTE] Erro ao acessar URL:', fetchError.message);
      return false;
    }

    // 5. Simular resposta da API
    const apiResponse = {
      url: urlData.signedUrl,
      nome: `CCB_${proposta.cliente_nome}_${proposalId}.pdf`,
      status: "assinado",
      fonte: "storage",
      caminho: proposta.caminho_ccb_assinado,
    };

    console.log('\n🎯 [TESTE] Resposta da API simulada:');
    console.log(JSON.stringify(apiResponse, null, 2));

    console.log('\n✅ [SUCCESS] Teste da URL da CCB completado com sucesso!');
    console.log('🚀 [READY] Sistema pode retornar URLs de visualização da CCB!');

    return true;

  } catch (error) {
    console.error('❌ [TESTE CCB] Erro crítico:', error);
    return false;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testarUrlCcbDireto().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testarUrlCcbDireto };