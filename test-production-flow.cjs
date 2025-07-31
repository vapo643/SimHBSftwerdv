// Teste direto das integrações para produção
const http = require('http');

async function testProductionAPIs() {
  console.log('🚀 Teste de produção - ClickSign + Banco Inter\n');

  // Teste direto de endpoints sem autenticação
  const tests = [
    {
      name: 'ClickSign Debug',
      path: '/api/clicksign/test',
      skipAuth: true
    },
    {
      name: 'Inter Credentials Check',
      path: '/api/inter/debug-credentials',
      skipAuth: true
    }
  ];

  for (const test of tests) {
    try {
      console.log(`🔍 Testando: ${test.name}`);
      
      const result = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: test.path,
        method: 'GET'
      });

      console.log(`   Status: ${result.status}`);
      console.log(`   Response:`, JSON.stringify(result.data, null, 2));
      console.log('   ✅ Teste concluído\n');
      
    } catch (error) {
      console.log(`   ❌ Erro:`, error.message);
    }
  }
}

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

testProductionAPIs();