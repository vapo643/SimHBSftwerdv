/**
 * Teste simplificado e direto das credenciais Inter - Sandbox
 */

const https = require('https');

console.log('🏦 TESTE SIMPLIFICADO - BANCO INTER SANDBOX');
console.log('==========================================\n');

async function testInterSimplified() {
  // Verificar credenciais
  console.log('🔐 VERIFICANDO CREDENCIAIS:');
  console.log(`   CLIENT_ID: ${process.env.CLIENT_ID ? `✅ ${process.env.CLIENT_ID.substring(0, 8)}...` : '❌ Faltando'}`);
  console.log(`   CLIENT_SECRET: ${process.env.CLIENT_SECRET ? `✅ ${process.env.CLIENT_SECRET.substring(0, 8)}...` : '❌ Faltando'}`);
  console.log(`   CERTIFICATE: ${process.env.CERTIFICATE ? `✅ ${process.env.CERTIFICATE.length} chars` : '❌ Faltando'}`);
  console.log(`   PRIVATE_KEY: ${process.env.PRIVATE_KEY ? `✅ ${process.env.PRIVATE_KEY.length} chars` : '❌ Faltando'}`);

  if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
    console.log('\n❌ Credenciais básicas não configuradas');
    return false;
  }

  // Preparar dados
  const tokenUrl = 'https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token';
  const formData = new URLSearchParams({
    'client_id': process.env.CLIENT_ID,
    'client_secret': process.env.CLIENT_SECRET,
    'grant_type': 'client_credentials',
    'scope': 'boleto-cobranca.read boleto-cobranca.write'
  });

  console.log('\n🔑 TESTANDO OAUTH2 - MÉTODO DIRETO:');
  console.log(`   Endpoint: ${tokenUrl}`);
  console.log('   Grant Type: client_credentials');
  console.log('   Scope: boleto-cobranca.read boleto-cobranca.write');

  return new Promise((resolve) => {
    const url = new URL(tokenUrl);
    
    // Configuração HTTPS específica para sandbox
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
      // Configurações SSL permissivas para sandbox
      rejectUnauthorized: false,
      secureProtocol: 'TLS_method',
      checkServerIdentity: () => undefined
    };

    console.log('\n🚀 FAZENDO REQUISIÇÃO HTTPS DIRETA...');

    const req = https.request(options, (res) => {
      let data = '';
      
      console.log(`   📡 Status Code: ${res.statusCode}`);
      console.log(`   📋 Headers:`, Object.keys(res.headers).join(', '));
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`   📄 Response Body: ${data}`);
        
        try {
          const jsonData = JSON.parse(data);
          
          if (res.statusCode === 200 && jsonData.access_token) {
            console.log('\n✅ SUCESSO! Token obtido:');
            console.log(`   🔑 Access Token: ${jsonData.access_token.substring(0, 20)}...`);
            console.log(`   📝 Token Type: ${jsonData.token_type}`);
            console.log(`   ⏰ Expires In: ${jsonData.expires_in}s`);
            console.log(`   🎯 Scope: ${jsonData.scope || 'N/A'}`);
            
            console.log('\n🎉 INTEGRAÇÃO BANCO INTER FUNCIONANDO!');
            resolve(true);
          } else {
            console.log(`\n❌ ERRO ${res.statusCode}:`);
            if (jsonData.error) {
              console.log(`   Erro: ${jsonData.error}`);
              console.log(`   Descrição: ${jsonData.error_description || 'N/A'}`);
            }
            
            // Diagnóstico
            if (res.statusCode === 400) {
              console.log('\n🔍 POSSÍVEIS CAUSAS:');
              console.log('   - Client ID ou Client Secret inválidos');
              console.log('   - Grant type não suportado');
              console.log('   - Scope inválido para o ambiente');
            } else if (res.statusCode === 401) {
              console.log('\n🔍 POSSÍVEL CAUSA:');
              console.log('   - Credenciais rejeitadas pelo servidor');
            }
            
            resolve(false);
          }
        } catch (parseError) {
          console.log(`\n❌ ERRO AO FAZER PARSE JSON: ${parseError.message}`);
          console.log(`   Raw Response: ${data}`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`\n❌ ERRO DE CONEXÃO: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('   🔍 Servidor não acessível');
      } else if (error.code === 'ENOTFOUND') {
        console.log('   🔍 DNS não resolvido - verifique a URL');
      } else if (error.message.includes('certificate')) {
        console.log('   🔍 Problema com certificado SSL');
      }
      
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('\n❌ TIMEOUT - Requisição demorou mais que esperado');
      req.destroy();
      resolve(false);
    });

    // Definir timeout
    req.setTimeout(10000);

    // Enviar dados
    req.write(formData.toString());
    req.end();
  });
}

// Executar teste
testInterSimplified().then(success => {
  console.log('\n==========================================');
  if (success) {
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('🚀 Banco Inter está funcionando corretamente');
    console.log('✅ Sistema pronto para criar boletos');
  } else {
    console.log('❌ TESTE FALHOU');
    console.log('💡 Verifique as credenciais no painel do Banco Inter');
  }
  console.log('==========================================');
});