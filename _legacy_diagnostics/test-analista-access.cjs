/**
 * TESTE RÁPIDO - ACESSO DO ANALISTA
 * Para debuggar o problema do 403
 */

const axios = require('axios');

console.log('🧪 TESTE RÁPIDO - ACESSO DO ANALISTA');
console.log('=====================================\n');

async function testeAnalista() {
  try {
    // TESTE: Simular chamada como fazia antes (sem queue)
    console.log('1. Testando chamada ANALISTA sem parâmetro queue...');
    const response1 = await axios.get('http://localhost:5000/api/propostas', {
      validateStatus: () => true // Não jogar erro em 403
    });
    
    console.log(`   Status: ${response1.status}`);
    console.log(`   Resposta: ${JSON.stringify(response1.data, null, 2)}`);
    
    // TESTE: Chamada correta com queue=analysis
    console.log('\n2. Testando chamada ANALISTA com queue=analysis...');
    const response2 = await axios.get('http://localhost:5000/api/propostas?queue=analysis', {
      validateStatus: () => true
    });
    
    console.log(`   Status: ${response2.status}`);
    console.log(`   Resposta: ${JSON.stringify(response2.data, null, 2)}`);
    
    // TESTE: Verificar endpoint debug
    console.log('\n3. Testando endpoint debug...');
    const response3 = await axios.get('http://localhost:5000/api/debug/me', {
      validateStatus: () => true
    });
    
    console.log(`   Status: ${response3.status}`);
    console.log(`   Resposta: ${JSON.stringify(response3.data, null, 2)}`);

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

console.log('⚠️  ESTE TESTE NÃO PRECISA DE TOKEN - é para verificar o middleware');
console.log('   Se der 401, é normal (sem autenticação)');
console.log('   Se der 403, é problema de permissão\n');

testeAnalista();