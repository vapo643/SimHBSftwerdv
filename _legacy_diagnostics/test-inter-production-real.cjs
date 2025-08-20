/**
 * Teste com ambiente de PRODUÇÃO do Banco Inter
 * As credenciais fornecidas podem ser para produção, não sandbox
 */

const https = require('https');

console.log('🏦 TESTE BANCO INTER - AMBIENTE PRODUÇÃO');
console.log('======================================\n');

async function testInterProduction() {
  // Verificar credenciais
  console.log('🔐 VERIFICANDO CREDENCIAIS PARA PRODUÇÃO:');
  console.log(`   CLIENT_ID: ${process.env.CLIENT_ID ? `✅ ${process.env.CLIENT_ID.substring(0, 8)}...` : '❌ Faltando'}`);
  console.log(`   CLIENT_SECRET: ${process.env.CLIENT_SECRET ? `✅ ${process.env.CLIENT_SECRET.substring(0, 8)}...` : '❌ Faltando'}`);

  if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
    console.log('\n❌ Credenciais básicas não configuradas');
    return false;
  }

  // TESTE 1: Ambiente PRODUÇÃO (credenciais podem ser para produção)
  console.log('\n🔑 TESTE 1 - AMBIENTE PRODUÇÃO:');
  await testWithEnvironment('production');

  // TESTE 2: Ambiente SANDBOX (caso não funcione em produção)
  console.log('\n🔑 TESTE 2 - AMBIENTE SANDBOX:');
  await testWithEnvironment('sandbox');
}

async function testWithEnvironment(env) {
  const tokenUrl = env === 'production' 
    ? 'https://cdpj.partners.bancointer.com.br/oauth/v2/token'
    : 'https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token';

  console.log(`   🌐 Endpoint: ${tokenUrl}`);
  console.log(`   🏗️  Ambiente: ${env.toUpperCase()}`);

  // Testar diferentes escopos
  const scopes = [
    'boleto-cobranca.read boleto-cobranca.write',
    'cobv.read cobv.write', 
    'cob.read cob.write',
    'cobranca.read cobranca.write'
  ];

  for (let i = 0; i < scopes.length; i++) {
    const scope = scopes[i];
    console.log(`\n   📋 Testando scope ${i + 1}: ${scope}`);
    
    const formData = new URLSearchParams({
      'client_id': process.env.CLIENT_ID,
      'client_secret': process.env.CLIENT_SECRET,
      'grant_type': 'client_credentials',
      'scope': scope
    });

    const success = await makeRequest(tokenUrl, formData);
    if (success) {
      console.log(`   ✅ SUCESSO com ambiente ${env.toUpperCase()} e scope: ${scope}`);
      return true;
    }
  }

  console.log(`   ❌ Todos os testes falharam para ambiente ${env.toUpperCase()}`);
  return false;
}

function makeRequest(tokenUrl, formData) {
  return new Promise((resolve) => {
    const url = new URL(tokenUrl);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'Inter-Bank-Client/1.0',
        'Content-Length': Buffer.byteLength(formData.toString())
      },
      rejectUnauthorized: true, // Mais rigoroso para produção
      secureProtocol: 'TLS_method'
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`      📡 Status: ${res.statusCode}`);
        
        if (data) {
          try {
            const jsonData = JSON.parse(data);
            
            if (res.statusCode === 200 && jsonData.access_token) {
              console.log(`      ✅ Token obtido com sucesso!`);
              console.log(`      🔑 Token: ${jsonData.access_token.substring(0, 15)}...`);
              console.log(`      ⏰ Expira em: ${jsonData.expires_in}s`);
              resolve(true);
            } else {
              console.log(`      ❌ Erro ${res.statusCode}: ${jsonData.error || 'Desconhecido'}`);
              if (jsonData.error_description) {
                console.log(`      📝 Descrição: ${jsonData.error_description}`);
              }
              resolve(false);
            }
          } catch (parseError) {
            console.log(`      ❌ Erro JSON: ${data}`);
            resolve(false);
          }
        } else {
          console.log(`      ❌ Resposta vazia para status ${res.statusCode}`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`      ❌ Erro de conexão: ${error.message}`);
      resolve(false);
    });

    req.setTimeout(10000);
    req.write(formData.toString());
    req.end();
  });
}

// Executar teste
testInterProduction().then(() => {
  console.log('\n======================================');
  console.log('📊 DIAGNÓSTICO COMPLETO:');
  console.log('======================================');
  console.log('');
  console.log('💡 PRÓXIMOS PASSOS:');
  console.log('1. Verifique no painel do Banco Inter se as credenciais são para:');
  console.log('   - Ambiente de PRODUÇÃO ou SANDBOX');
  console.log('   - Quais escopos estão habilitados');
  console.log('2. Confirme se o CLIENT_ID e CLIENT_SECRET estão corretos');
  console.log('3. Verifique se a conta está ativa e autorizada');
  console.log('');
  console.log('🔗 Painel do desenvolvedor:');
  console.log('   https://developers.inter.co/');
  console.log('======================================');
});