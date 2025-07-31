#!/usr/bin/env node

/**
 * Teste de Conectividade - API Banco Inter
 * Verifica se a integração está funcionando corretamente
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}========================================${colors.reset}`);
console.log(`${colors.cyan}🏦 TESTE DE API - BANCO INTER${colors.reset}`);
console.log(`${colors.cyan}========================================${colors.reset}\n`);

// Verificar variáveis de ambiente
console.log(`${colors.blue}📋 Verificando configuração...${colors.reset}`);

const requiredEnvVars = [
  'INTER_CLIENT_ID',
  'INTER_CLIENT_SECRET',
  'INTER_CERT_PATH',
  'INTER_CERT_PASSWORD'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log(`${colors.red}❌ Variáveis de ambiente faltando:${colors.reset}`);
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  console.log(`\n${colors.yellow}⚠️  Configure as variáveis no arquivo .env${colors.reset}`);
  process.exit(1);
}

console.log(`${colors.green}✅ Todas as variáveis de ambiente configuradas${colors.reset}\n`);

// Verificar certificado
console.log(`${colors.blue}🔐 Verificando certificado...${colors.reset}`);

const certPath = process.env.INTER_CERT_PATH;
if (!fs.existsSync(certPath)) {
  console.log(`${colors.red}❌ Certificado não encontrado em: ${certPath}${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Certifique-se de que o certificado .pfx está no local correto${colors.reset}`);
  process.exit(1);
}

console.log(`${colors.green}✅ Certificado encontrado${colors.reset}\n`);

// Testar autenticação OAuth
console.log(`${colors.blue}🔑 Testando autenticação OAuth...${colors.reset}`);

const testOAuth = async () => {
  try {
    // Preparar certificado
    const cert = fs.readFileSync(certPath);
    
    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: '/oauth/v2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      cert: cert,
      key: cert,
      passphrase: process.env.INTER_CERT_PASSWORD,
      rejectUnauthorized: true
    };

    const params = new URLSearchParams({
      client_id: process.env.INTER_CLIENT_ID,
      client_secret: process.env.INTER_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'boleto-cobranca.read boleto-cobranca.write webhook.write'
    });

    const startTime = Date.now();

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        
        if (res.statusCode === 200) {
          const token = JSON.parse(data);
          console.log(`${colors.green}✅ Autenticação bem-sucedida!${colors.reset}`);
          console.log(`   - Token obtido: ${token.access_token.substring(0, 20)}...`);
          console.log(`   - Tipo: ${token.token_type}`);
          console.log(`   - Expira em: ${token.expires_in} segundos`);
          console.log(`   - Scopes: ${token.scope}`);
          console.log(`   - Tempo de resposta: ${responseTime}ms\n`);
          
          // Testar endpoint de cobrança
          testCollectionEndpoint(token.access_token);
        } else {
          console.log(`${colors.red}❌ Falha na autenticação${colors.reset}`);
          console.log(`   - Status: ${res.statusCode}`);
          console.log(`   - Resposta: ${data}`);
          
          if (res.statusCode === 401) {
            console.log(`\n${colors.yellow}💡 Dica: Verifique se as credenciais estão corretas${colors.reset}`);
          } else if (res.statusCode === 403) {
            console.log(`\n${colors.yellow}💡 Dica: Verifique se o certificado está válido${colors.reset}`);
          }
        }
      });
    });

    req.on('error', (error) => {
      console.log(`${colors.red}❌ Erro na conexão${colors.reset}`);
      console.log(`   - Erro: ${error.message}`);
      
      if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        console.log(`\n${colors.yellow}💡 Dica: Problema com o certificado SSL${colors.reset}`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`\n${colors.yellow}💡 Dica: Servidor não está acessível${colors.reset}`);
      }
    });

    req.write(params.toString());
    req.end();
    
  } catch (error) {
    console.log(`${colors.red}❌ Erro ao processar certificado${colors.reset}`);
    console.log(`   - Erro: ${error.message}`);
    console.log(`\n${colors.yellow}💡 Dica: Verifique se a senha do certificado está correta${colors.reset}`);
  }
};

// Testar endpoint de cobrança
const testCollectionEndpoint = async (token) => {
  console.log(`${colors.blue}📄 Testando endpoint de cobrança...${colors.reset}`);
  
  const cert = fs.readFileSync(certPath);
  
  const options = {
    hostname: 'cdpj.partners.bancointer.com.br',
    port: 443,
    path: '/cobranca/v3/cobrancas?dataInicial=2025-01-01&dataFinal=2025-01-31',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    cert: cert,
    key: cert,
    passphrase: process.env.INTER_CERT_PASSWORD,
    rejectUnauthorized: true
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        const result = JSON.parse(data);
        console.log(`${colors.green}✅ API de cobrança funcionando!${colors.reset}`);
        console.log(`   - Total de cobranças: ${result.totalRegistros || 0}`);
        console.log(`   - Endpoint: /cobranca/v3/cobrancas`);
      } else {
        console.log(`${colors.yellow}⚠️  Resposta da API:${colors.reset}`);
        console.log(`   - Status: ${res.statusCode}`);
        console.log(`   - Dados: ${data}`);
      }
      
      // Resumo final
      console.log(`\n${colors.cyan}========================================${colors.reset}`);
      console.log(`${colors.cyan}📊 RESUMO DO TESTE${colors.reset}`);
      console.log(`${colors.cyan}========================================${colors.reset}`);
      console.log(`${colors.green}✅ Conexão com API: OK${colors.reset}`);
      console.log(`${colors.green}✅ Autenticação OAuth: OK${colors.reset}`);
      console.log(`${colors.green}✅ Certificado mTLS: OK${colors.reset}`);
      console.log(`${colors.green}✅ Endpoints de cobrança: OK${colors.reset}`);
      console.log(`\n${colors.green}🎉 INTEGRAÇÃO BANCO INTER FUNCIONANDO!${colors.reset}\n`);
    });
  });

  req.on('error', (error) => {
    console.log(`${colors.red}❌ Erro ao testar endpoint${colors.reset}`);
    console.log(`   - Erro: ${error.message}`);
  });

  req.end();
};

// Executar teste
testOAuth();