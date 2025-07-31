/**
 * Teste para verificar se as credenciais são de produção
 * e qual o problema real da autenticação
 */

console.log('========================================');
console.log('🏦 TESTE DE PRODUÇÃO - BANCO INTER');
console.log('Verificando se credenciais são de produção');
console.log('========================================\n');

// Tentar ambos os ambientes
const environments = [
  {
    name: 'PRODUÇÃO',
    url: 'https://cdpj.partners.bancointer.com.br/oauth/v2/token'
  },
  {
    name: 'SANDBOX',  
    url: 'https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token'
  }
];

const clientId = process.env.INTER_CLIENT_ID;
const clientSecret = process.env.INTER_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.log('❌ Credenciais não encontradas nas variáveis de ambiente');
  process.exit(1);
}

console.log('📋 Credenciais encontradas:');
console.log(`   - Client ID: ${clientId.substring(0, 8)}...`);
console.log(`   - Client Secret: ${clientSecret.substring(0, 8)}...`);
console.log('');

async function testEnvironment(env) {
  console.log(`🔄 Testando ${env.name}:`);
  console.log(`   - URL: ${env.url}`);
  
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'boleto-cobranca.read boleto-cobranca.write webhook.write webhook.read'
  });

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch(env.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'Simpix/1.0'
      },
      body: params.toString()
    });

    console.log(`   - Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ SUCESSO! Token obtido: ${data.access_token?.substring(0, 20)}...`);
      console.log(`   - Tipo: ${data.token_type}`);
      console.log(`   - Expira em: ${data.expires_in} segundos`);
      console.log(`   - Scopes: ${data.scope}`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`   ❌ FALHA: ${errorText || 'Sem resposta'}`);
      
      // Analisar tipo de erro
      if (response.status === 400) {
        console.log(`   💡 Erro 400: Credenciais inválidas ou expiradas`);
      } else if (response.status === 401) {
        console.log(`   💡 Erro 401: Credenciais incorretas`);
      } else if (response.status === 403) {
        console.log(`   💡 Erro 403: Sem permissão para este ambiente`);
      }
      
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ERRO DE CONEXÃO: ${error.message}`);
    return false;
  }
}

async function main() {
  let prodSuccess = false;
  let sandboxSuccess = false;
  
  for (const env of environments) {
    const success = await testEnvironment(env);
    if (env.name === 'PRODUÇÃO') prodSuccess = success;
    if (env.name === 'SANDBOX') sandboxSuccess = success;
    console.log('');
  }
  
  console.log('========================================');
  console.log('📊 RELATÓRIO FINAL');
  console.log('========================================');
  
  if (prodSuccess) {
    console.log('🎉 SUAS CREDENCIAIS SÃO DE PRODUÇÃO!');
    console.log('✅ O problema não são as credenciais');
    console.log('💡 Pode ser configuração de ambiente no código');
  } else if (sandboxSuccess) {
    console.log('⚠️  Suas credenciais são de SANDBOX');
    console.log('📞 Contate seu gerente do Inter para produção');
  } else {
    console.log('❌ Credenciais não funcionam em nenhum ambiente');
    console.log('🔑 Verificar se Client ID/Secret estão corretos');
  }
  
  console.log('\n🎯 Próximos passos:');
  if (prodSuccess) {
    console.log('1. Verificar variável NODE_ENV no código');
    console.log('2. Confirmar URL de produção no serviço');
    console.log('3. Testar certificado mTLS');
  } else {
    console.log('1. Verificar credenciais no portal do Inter');
    console.log('2. Contatar gerente para ambiente de produção');
    console.log('3. Renovar certificado se necessário');
  }
}

main().catch(console.error);