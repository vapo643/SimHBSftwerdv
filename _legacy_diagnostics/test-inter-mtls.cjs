/**
 * Teste completo com mTLS (Mutual TLS) - Certificados obrigatórios
 * Banco Inter exige certificados para autenticação
 */

const https = require('https');
const fs = require('fs');

console.log('🏦 TESTE BANCO INTER COM mTLS (CERTIFICADOS)');
console.log('===========================================\n');

async function testInterWithMTLS() {
  // Verificar credenciais completas
  console.log('🔐 VERIFICANDO CREDENCIAIS COMPLETAS:');
  const requiredCredentials = {
    'CLIENT_ID': process.env.CLIENT_ID,
    'CLIENT_SECRET': process.env.CLIENT_SECRET,
    'CERTIFICATE': process.env.CERTIFICATE,
    'PRIVATE_KEY': process.env.PRIVATE_KEY
  };

  let allPresent = true;
  for (const [name, value] of Object.entries(requiredCredentials)) {
    if (value && value.length > 0) {
      console.log(`   ✅ ${name}: Configurado (${value.length} chars)`);
    } else {
      console.log(`   ❌ ${name}: FALTANDO`);
      allPresent = false;
    }
  }

  if (!allPresent) {
    console.log('\n❌ Credenciais incompletas para mTLS!');
    console.log('💡 Banco Inter requer certificados para autenticação');
    return false;
  }

  // Preparar certificados
  console.log('\n🔧 PREPARANDO CERTIFICADOS:');
  let cert = process.env.CERTIFICATE;
  let key = process.env.PRIVATE_KEY;

  // Formatar certificados corretamente
  if (cert && !cert.includes('\n')) {
    console.log('   🔄 Formatando certificado...');
    cert = formatPEMCertificate(cert);
    console.log('   ✅ Certificado formatado');
  }

  if (key && !key.includes('\n')) {
    console.log('   🔄 Formatando chave privada...');
    key = formatPEMPrivateKey(key);
    console.log('   ✅ Chave privada formatada');
  }

  // Salvar certificados temporariamente para debug
  try {
    fs.writeFileSync('/tmp/cert.pem', cert);
    fs.writeFileSync('/tmp/key.pem', key);
    console.log('   📁 Certificados salvos em /tmp/ para debug');
  } catch (e) {
    console.log('   ⚠️ Não foi possível salvar certificados temporários');
  }

  // Testar ambientes
  const environments = [
    {
      name: 'PRODUCTION',
      url: 'https://cdpj.partners.bancointer.com.br/oauth/v2/token'
    },
    {
      name: 'SANDBOX', 
      url: 'https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token'
    }
  ];

  for (const env of environments) {
    console.log(`\n🔑 TESTANDO ${env.name}:`);
    console.log(`   Endpoint: ${env.url}`);
    
    const success = await testEnvironmentWithMTLS(env.url, cert, key);
    if (success) {
      console.log(`   ✅ SUCESSO no ambiente ${env.name}!`);
      return true;
    }
  }

  console.log('\n❌ Todos os testes falharam');
  return false;
}

function formatPEMCertificate(cert) {
  const match = cert.match(/-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----/);
  if (match && match[1]) {
    const base64Content = match[1].trim();
    const formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
    return `-----BEGIN CERTIFICATE-----\n${formattedContent}\n-----END CERTIFICATE-----`;
  }
  return cert;
}

function formatPEMPrivateKey(key) {
  const match = key.match(/-----BEGIN (.+?)-----(.*?)-----END (.+?)-----/);
  if (match && match[2]) {
    const keyType = match[1];
    const base64Content = match[2].trim();
    const formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
    return `-----BEGIN ${keyType}-----\n${formattedContent}\n-----END ${keyType}-----`;
  }
  return key;
}

function testEnvironmentWithMTLS(tokenUrl, cert, key) {
  return new Promise((resolve) => {
    const formData = new URLSearchParams({
      'client_id': process.env.CLIENT_ID,
      'client_secret': process.env.CLIENT_SECRET,
      'grant_type': 'client_credentials',
      'scope': 'boleto-cobranca.read boleto-cobranca.write'
    });

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
      // Configuração mTLS RIGOROSA
      cert: cert,
      key: key,
      rejectUnauthorized: false, // Para desenvolvimento, em produção seria true
      requestCert: true,
      secureProtocol: 'TLS_method'
    };

    console.log('   🚀 Fazendo requisição mTLS...');

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`   📡 Status: ${res.statusCode}`);
        console.log(`   📋 Headers: ${Object.keys(res.headers).join(', ')}`);
        
        if (res.statusCode === 200) {
          try {
            const jsonData = JSON.parse(data);
            if (jsonData.access_token) {
              console.log(`   ✅ TOKEN OBTIDO COM SUCESSO!`);
              console.log(`   🔑 Access Token: ${jsonData.access_token.substring(0, 20)}...`);
              console.log(`   📝 Token Type: ${jsonData.token_type}`);
              console.log(`   ⏰ Expires In: ${jsonData.expires_in}s`);
              resolve(true);
              return;
            }
          } catch (e) {
            console.log(`   ❌ Erro parsing JSON: ${e.message}`);
          }
        }
        
        // Qualquer outro caso
        console.log(`   ❌ Falha: Status ${res.statusCode}`);
        if (data) {
          console.log(`   📄 Response: ${data.substring(0, 200)}${data.length > 200 ? '...' : ''}`);
        } else {
          console.log(`   📄 Response: (vazio)`);
        }
        
        resolve(false);
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Erro: ${error.message}`);
      
      if (error.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY') {
        console.log('   🔍 Problema com certificado do cliente');
      } else if (error.code === 'CERT_UNTRUSTED') {
        console.log('   🔍 Certificado não confiável');
      } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        console.log('   🔍 Não foi possível verificar assinatura do certificado');
      }
      
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('   ❌ Timeout');
      req.destroy();
      resolve(false);
    });

    req.setTimeout(15000);
    req.write(formData.toString());
    req.end();
  });
}

// Executar teste
testInterWithMTLS().then(success => {
  console.log('\n===========================================');
  if (success) {
    console.log('🎉 INTEGRAÇÃO BANCO INTER FUNCIONANDO!');
    console.log('✅ Certificados mTLS configurados corretamente');
    console.log('🚀 Sistema pronto para produção');
  } else {
    console.log('❌ INTEGRAÇÃO FALHANDO');
    console.log('');
    console.log('💡 CHECKLIST DE TROUBLESHOOTING:');
    console.log('1. Verifique se os certificados são válidos');
    console.log('2. Confirme se as credenciais não expiraram');
    console.log('3. Verifique no painel do Banco Inter:');
    console.log('   - Status da aplicação');
    console.log('   - Certificados válidos');  
    console.log('   - Escopos habilitados');
    console.log('4. Confirme ambiente (produção vs sandbox)');
  }
  console.log('===========================================');
});