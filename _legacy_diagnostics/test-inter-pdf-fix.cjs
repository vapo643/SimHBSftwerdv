/**
 * Script de teste para verificar se o endpoint PDF do Inter funciona
 * com Accept: application/json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const INTER_CLIENT_ID = process.env.INTER_CLIENT_ID;
const INTER_CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const INTER_CERTIFICATE = process.env.INTER_CERTIFICATE;
const INTER_PRIVATE_KEY = process.env.INTER_PRIVATE_KEY;

// Código de solicitação válido de um boleto existente
const CODIGO_SOLICITACAO = '585bcc53-e077-49c7-a4cd-b000698a5bfe';

async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const credentials = Buffer.from(`${INTER_CLIENT_ID}:${INTER_CLIENT_SECRET}`).toString('base64');
    
    // Formatar certificados
    let cert = INTER_CERTIFICATE;
    let key = INTER_PRIVATE_KEY;
    
    // Fix certificate format
    if (cert.includes("-----BEGIN CERTIFICATE-----") && !cert.includes("\n")) {
      const certMatch = cert.match(/-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----/);
      if (certMatch && certMatch[1]) {
        const base64Content = certMatch[1].trim();
        const formattedContent = base64Content.match(/.{1,64}/g)?.join("\n") || base64Content;
        cert = `-----BEGIN CERTIFICATE-----\n${formattedContent}\n-----END CERTIFICATE-----`;
      }
    }
    
    // Fix key format
    if (key.includes("-----BEGIN") && key.includes("KEY-----") && !key.includes("\n")) {
      const keyMatch = key.match(/-----BEGIN (.+?)-----(.*?)-----END (.+?)-----/);
      if (keyMatch && keyMatch[2]) {
        const keyType = keyMatch[1];
        const base64Content = keyMatch[2].trim();
        const formattedContent = base64Content.match(/.{1,64}/g)?.join("\n") || base64Content;
        key = `-----BEGIN ${keyType}-----\n${formattedContent}\n-----END ${keyType}-----`;
      }
    }
    
    const postData = 'grant_type=client_credentials&scope=boleto-cobranca.read boleto-cobranca.write';
    
    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: '/oauth/v2/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      cert: cert,
      key: key,
      rejectUnauthorized: true
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const tokenData = JSON.parse(data);
          resolve(tokenData.access_token);
        } else {
          reject(new Error(`Token error: ${res.statusCode} - ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testPdfDownload(token) {
  return new Promise((resolve, reject) => {
    // Formatar certificados
    let cert = INTER_CERTIFICATE;
    let key = INTER_PRIVATE_KEY;
    
    // Fix certificate format (mesma lógica do token)
    if (cert.includes("-----BEGIN CERTIFICATE-----") && !cert.includes("\n")) {
      const certMatch = cert.match(/-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----/);
      if (certMatch && certMatch[1]) {
        const base64Content = certMatch[1].trim();
        const formattedContent = base64Content.match(/.{1,64}/g)?.join("\n") || base64Content;
        cert = `-----BEGIN CERTIFICATE-----\n${formattedContent}\n-----END CERTIFICATE-----`;
      }
    }
    
    if (key.includes("-----BEGIN") && key.includes("KEY-----") && !key.includes("\n")) {
      const keyMatch = key.match(/-----BEGIN (.+?)-----(.*?)-----END (.+?)-----/);
      if (keyMatch && keyMatch[2]) {
        const keyType = keyMatch[1];
        const base64Content = keyMatch[2].trim();
        const formattedContent = base64Content.match(/.{1,64}/g)?.join("\n") || base64Content;
        key = `-----BEGIN ${keyType}-----\n${formattedContent}\n-----END ${keyType}-----`;
      }
    }
    
    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: `/cobranca/v3/cobrancas/${CODIGO_SOLICITACAO}/pdf`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json', // TESTE: Usando application/json ao invés de application/pdf
        'Content-Type': 'application/json'
      },
      cert: cert,
      key: key,
      rejectUnauthorized: true
    };
    
    console.log('🔍 Testando download de PDF com headers:');
    console.log('   Accept: application/json');
    console.log('   Content-Type: application/json');
    console.log(`   Endpoint: /cobranca/v3/cobrancas/${CODIGO_SOLICITACAO}/pdf`);
    
    const req = https.request(options, (res) => {
      const chunks = [];
      
      console.log(`📊 Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`📋 Content-Type recebido: ${res.headers['content-type']}`);
      console.log(`📋 Content-Length: ${res.headers['content-length']}`);
      
      res.on('data', (chunk) => chunks.push(chunk));
      
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        if (res.statusCode >= 400) {
          console.error('❌ Erro na resposta:');
          console.error(buffer.toString());
          reject(new Error(`HTTP ${res.statusCode}: ${buffer.toString()}`));
          return;
        }
        
        // Verificar se é um PDF
        const pdfMagic = buffer.slice(0, 5).toString('utf8');
        if (pdfMagic.startsWith('%PDF')) {
          console.log(`✅ PDF válido recebido! (${buffer.length} bytes)`);
          console.log(`✅ Magic bytes: ${pdfMagic}`);
          
          // Salvar PDF para teste
          const outputPath = path.join(__dirname, 'test-boleto-inter.pdf');
          fs.writeFileSync(outputPath, buffer);
          console.log(`✅ PDF salvo em: ${outputPath}`);
          
          resolve(buffer);
        } else {
          console.log('⚠️ Resposta não é um PDF:');
          console.log('Primeiros 100 chars:', buffer.toString().substring(0, 100));
          
          // Tentar parse JSON
          try {
            const json = JSON.parse(buffer.toString());
            console.log('📋 Resposta JSON:', JSON.stringify(json, null, 2));
          } catch (e) {
            console.log('📋 Resposta (não é JSON):', buffer.toString());
          }
          
          reject(new Error('Resposta não é um PDF'));
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('❌ Erro na requisição:', e);
      reject(e);
    });
    
    req.end();
  });
}

async function main() {
  try {
    console.log('🚀 Iniciando teste de download de PDF do Banco Inter...');
    console.log('================================================');
    
    console.log('1️⃣ Obtendo token de acesso...');
    const token = await getAccessToken();
    console.log(`✅ Token obtido: ${token.substring(0, 20)}...`);
    
    console.log('\n2️⃣ Testando download de PDF com Accept: application/json...');
    await testPdfDownload(token);
    
    console.log('\n✅ SUCESSO! O PDF pode ser baixado com Accept: application/json');
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    process.exit(1);
  }
}

main();