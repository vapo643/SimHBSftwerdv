#!/usr/bin/env node
/**
 * Teste simples para obter token do Banco Inter
 */

const https = require('https');

console.log('🏦 TESTE DE TOKEN - BANCO INTER');
console.log('================================\n');

// Verificar variáveis
console.log('📋 Verificando variáveis de ambiente:');
console.log('  INTER_CLIENT_ID:', process.env.INTER_CLIENT_ID ? '✅ Configurado' : '❌ Faltando');
console.log('  INTER_CLIENT_SECRET:', process.env.INTER_CLIENT_SECRET ? '✅ Configurado' : '❌ Faltando');
console.log('  INTER_CERTIFICATE:', process.env.INTER_CERTIFICATE ? `✅ ${process.env.INTER_CERTIFICATE.length} chars` : '❌ Faltando');
console.log('  INTER_PRIVATE_KEY:', process.env.INTER_PRIVATE_KEY ? `✅ ${process.env.INTER_PRIVATE_KEY.length} chars` : '❌ Faltando');
console.log('');

// Teste sem certificado primeiro
async function testeSemCertificado() {
  return new Promise((resolve) => {
    console.log('🔑 Teste 1: OAuth SEM certificado...');
    
    const postData = `client_id=${process.env.INTER_CLIENT_ID}&client_secret=${process.env.INTER_CLIENT_SECRET}&grant_type=client_credentials&scope=cob.read cob.write`;
    
    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: '/oauth/v2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      rejectUnauthorized: false
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('  Status:', res.statusCode);
        console.log('  Resposta:', data.substring(0, 200));
        
        try {
          const result = JSON.parse(data);
          if (result.access_token) {
            console.log('  ✅ TOKEN OBTIDO SEM CERTIFICADO!');
            console.log('  Token:', result.access_token.substring(0, 50) + '...');
            resolve(result.access_token);
          } else {
            console.log('  ❌ Falhou sem certificado');
            resolve(null);
          }
        } catch (e) {
          console.log('  ❌ Erro ao processar resposta');
          resolve(null);
        }
      });
    });
    
    req.on('error', (e) => {
      console.log('  ❌ Erro:', e.message);
      resolve(null);
    });
    
    req.write(postData);
    req.end();
  });
}

// Executar testes
async function executar() {
  const token = await testeSemCertificado();
  
  if (token) {
    console.log('\n🎉 SUCESSO! Token obtido sem certificado!');
    console.log('Agora posso criar boletos reais.\n');
    
    // Teste de criação de boleto
    console.log('📝 Testando criação de boleto...');
    
    const hoje = new Date();
    const vencimento = new Date(hoje);
    vencimento.setDate(hoje.getDate() + 30);
    
    const dadosBoleto = {
      seuNumero: `TESTE-${Date.now()}`,
      valorNominal: 100.00,
      dataVencimento: vencimento.toISOString().split('T')[0],
      numDiasAgenda: 30,
      pagador: {
        cpfCnpj: "20528464760",
        tipoPessoa: "FISICA",
        nome: "TESTE SIMPIX",
        endereco: "RUA TESTE",
        numero: "100",
        bairro: "CENTRO",
        cidade: "SERRA",
        uf: "ES",
        cep: "29165460"
      }
    };
    
    const postData = JSON.stringify(dadosBoleto);
    
    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: '/cobranca/v3/cobrancas',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-conta-corrente': process.env.INTER_CONTA_CORRENTE || "346470536"
      },
      rejectUnauthorized: false
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('  Status:', res.statusCode);
        console.log('  Resposta:', data);
        
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log('\n✅ BOLETO CRIADO COM SUCESSO!');
            console.log('  Código:', result.codigoSolicitacao);
            console.log('  Nosso Número:', result.nossoNumero);
            console.log('\n🎉 SISTEMA FUNCIONANDO! Agora posso criar os 24 boletos.');
          } else {
            console.log('  ❌ Erro ao criar boleto');
          }
        } catch (e) {
          console.log('  ❌ Erro ao processar resposta');
        }
      });
    });
    
    req.on('error', (e) => {
      console.log('  ❌ Erro:', e.message);
    });
    
    req.write(postData);
    req.end();
    
  } else {
    console.log('\n❌ Não foi possível obter token');
    console.log('\n💡 Possíveis causas:');
    console.log('1. Credenciais incorretas');
    console.log('2. Certificado necessário');
    console.log('3. Conta não autorizada');
  }
}

executar();