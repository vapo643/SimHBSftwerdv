// Teste básico das integrações ClickSign e Banco Inter
const https = require('https');
const http = require('http');

// Função auxiliar para fazer requisições
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.port === 443 ? https : http;
    const req = protocol.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testIntegrations() {
  console.log('🔧 Testando integrações para produção...\n');

  // 1. Fazer login primeiro
  console.log('1️⃣ Fazendo login...');
  try {
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'admin@simpix.com',
      password: 'admin123'
    });

    if (loginResponse.status !== 200) {
      console.log('❌ Login falhou:', loginResponse);
      return;
    }

    const token = loginResponse.data.token;
    console.log('✅ Login bem-sucedido');

    // 2. Testar ClickSign
    console.log('\n2️⃣ Testando ClickSign...');
    const clickSignTest = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/clicksign/test',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('ClickSign:', clickSignTest.status === 200 ? '✅' : '❌', clickSignTest.data);

    // 3. Testar Banco Inter
    console.log('\n3️⃣ Testando Banco Inter...');
    const interTest = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/inter/test',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('Banco Inter:', interTest.status === 200 ? '✅' : '❌', interTest.data);

    // 4. Verificar credenciais Inter
    console.log('\n4️⃣ Verificando credenciais Inter...');
    const interCredentials = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/inter/debug-credentials',
      method: 'GET'
    });

    console.log('Credenciais Inter:', interCredentials.data);

    console.log('\n🎯 Teste completo das integrações finalizado!');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

// Executar teste
testIntegrations();