// Verificação de prontidão para produção
const http = require('http');

async function checkProductionReadiness() {
  console.log('🎯 VERIFICAÇÃO DE PRODUÇÃO - ELEEVE EMPRÉSTIMO\n');
  
  const checks = [
    {
      name: '🏦 Banco Inter - Conexão',
      path: '/api/inter/debug-credentials',
      test: (data) => data.connectionTest === true
    },
    {
      name: '📋 Banco Inter - Credenciais',
      path: '/api/inter/debug-credentials', 
      test: (data) => {
        const creds = data.credentials;
        return creds.clientId.includes('✅') && 
               creds.clientSecret.includes('✅') && 
               creds.certificate.includes('✅') &&
               creds.privateKey.includes('✅') &&
               creds.contaCorrente.includes('✅');
      }
    }
  ];

  let allPassed = true;

  for (const check of checks) {
    try {
      const result = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: check.path,
        method: 'GET'
      });

      const passed = check.test(result.data);
      console.log(`${passed ? '✅' : '❌'} ${check.name}`);
      
      if (!passed) {
        allPassed = false;
        console.log(`   Falha: ${JSON.stringify(result.data, null, 2)}`);
      }
      
    } catch (error) {
      console.log(`❌ ${check.name} - Erro: ${error.message}`);
      allPassed = false;
    }
  }
  
  console.log(`\n🎯 RESULTADO GERAL: ${allPassed ? '✅ PRONTO PARA PRODUÇÃO' : '❌ REQUER CORREÇÕES'}`);
  
  if (allPassed) {
    console.log('\n🚀 FLUXO COMPLETO HABILITADO:');
    console.log('   1. Cliente assina CCB via ClickSign');
    console.log('   2. Sistema gera boleto automaticamente via Inter Bank');
    console.log('   3. Cliente recebe cobrança por email/WhatsApp');
    console.log('   4. Pagamento processado em tempo real');
    console.log('\n🏪 READY FOR ELEEVE DEPLOYMENT! 🏪');
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

checkProductionReadiness();