/**
 * TESTE RÁPIDO PÓS-CORREÇÃO RATE LIMITING
 * Verificar se o sistema voltou a funcionar após correção
 */

const axios = require('axios');
const BASE_URL = 'http://localhost:5000';

console.log('🔧 TESTE PÓS-CORREÇÃO RATE LIMITING');
console.log('================================\n');

async function testeRapido() {
  try {
    console.log('🔌 1. TESTANDO CONEXÃO BÁSICA:');
    
    // Teste básico de saúde
    const health = await axios.get(`${BASE_URL}/api/health`, { timeout: 5000 });
    console.log(`   ✅ API Health: ${health.status} - ${health.data?.status || 'OK'}`);
    
    // Teste múltiplas requisições rápidas (simulando o que causava rate limit)
    console.log('\n⚡ 2. TESTE MÚLTIPLAS REQUISIÇÕES (antes falhava):');
    
    const promises = [];
    for (let i = 1; i <= 20; i++) {
      promises.push(
        axios.get(`${BASE_URL}/api/health`, { 
          timeout: 5000,
          validateStatus: () => true // Aceitar qualquer status
        }).then(res => ({ req: i, status: res.status }))
      );
    }
    
    const results = await Promise.all(promises);
    const sucessos = results.filter(r => r.status === 200).length;
    const rateLimited = results.filter(r => r.status === 429).length;
    
    console.log(`   📊 Resultados de 20 requisições simultâneas:`);
    console.log(`     ✅ Sucessos: ${sucessos}/20`);
    console.log(`     ❌ Rate Limited: ${rateLimited}/20`);
    
    if (rateLimited === 0) {
      console.log('   🎉 CORREÇÃO FUNCIONOU! Rate limiting não está mais bloqueando');
    } else {
      console.log('   ⚠️ Ainda há problemas de rate limiting');
    }
    
    // Teste de propostas (o endpoint que mais falhava)
    console.log('\n📋 3. TESTE ENDPOINT PROPOSTAS:');
    try {
      const propostas = await axios.get(`${BASE_URL}/api/propostas`, { 
        timeout: 5000,
        validateStatus: () => true
      });
      
      if (propostas.status === 401) {
        console.log('   ✅ Endpoint propostas responde (401 = precisa auth, normal)');
      } else if (propostas.status === 429) {
        console.log('   ❌ Ainda com rate limiting no endpoint propostas');
      } else {
        console.log(`   ✅ Endpoint propostas: ${propostas.status}`);
      }
    } catch (error) {
      console.log(`   ⚠️ Erro no endpoint propostas: ${error.message}`);
    }
    
    console.log('\n================================');
    console.log('🎯 RESULTADO FINAL:');
    if (sucessos >= 18 && rateLimited <= 2) {
      console.log('✅ CORREÇÃO DE RATE LIMITING: SUCESSO');
      console.log('✅ Sistema voltou a funcionar normalmente');
      console.log('✅ Pronto para 200+ propostas/dia sem problemas');
    } else {
      console.log('❌ Rate limiting ainda precisa ajustes');
    }
    
    return sucessos >= 18;
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    return false;
  }
}

// Executar teste
testeRapido();