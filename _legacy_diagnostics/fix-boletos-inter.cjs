#!/usr/bin/env node
/**
 * SCRIPT PARA ATUALIZAR DADOS COMPLETOS DOS BOLETOS
 * Busca linha digitável, código de barras e PIX para todos os boletos
 */

const https = require('https');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const INTER_CLIENT_ID = process.env.INTER_CLIENT_ID;
const INTER_CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const INTER_CERTIFICATE = process.env.INTER_CERTIFICATE;
const INTER_PRIVATE_KEY = process.env.INTER_PRIVATE_KEY;

console.log('🔧 ATUALIZAÇÃO DE DADOS DOS BOLETOS');
console.log('=====================================\n');

// Função para formatar certificado PEM
function formatPemCertificate(cert) {
  if (cert.includes('\n')) return cert;
  
  const certMatch = cert.match(/-----BEGIN CERTIFICATE-----(.+)-----END CERTIFICATE-----/);
  if (certMatch) {
    const certBody = certMatch[1].trim();
    const formattedBody = certBody.match(/.{1,64}/g).join('\n');
    return `-----BEGIN CERTIFICATE-----\n${formattedBody}\n-----END CERTIFICATE-----`;
  }
  return cert;
}

// Função para formatar chave privada PEM
function formatPemPrivateKey(key) {
  if (key.includes('\n')) return key;
  
  let keyMatch = key.match(/-----BEGIN PRIVATE KEY-----(.+)-----END PRIVATE KEY-----/);
  if (keyMatch) {
    const keyBody = keyMatch[1].trim();
    const formattedBody = keyBody.match(/.{1,64}/g).join('\n');
    return `-----BEGIN PRIVATE KEY-----\n${formattedBody}\n-----END PRIVATE KEY-----`;
  }
  
  keyMatch = key.match(/-----BEGIN RSA PRIVATE KEY-----(.+)-----END RSA PRIVATE KEY-----/);
  if (keyMatch) {
    const keyBody = keyMatch[1].trim();
    const formattedBody = keyBody.match(/.{1,64}/g).join('\n');
    return `-----BEGIN RSA PRIVATE KEY-----\n${formattedBody}\n-----END RSA PRIVATE KEY-----`;
  }
  
  return key;
}

const cert = formatPemCertificate(INTER_CERTIFICATE);
const key = formatPemPrivateKey(INTER_PRIVATE_KEY);

// Obter token OAuth
async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const formBody = `client_id=${INTER_CLIENT_ID}&client_secret=${INTER_CLIENT_SECRET}&grant_type=client_credentials&scope=boleto-cobranca.read boleto-cobranca.write`;
    
    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: '/oauth/v2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formBody)
      },
      cert: cert,
      key: key,
      rejectUnauthorized: false
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.access_token) {
            resolve(result.access_token);
          } else {
            reject(new Error('Token não retornado'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(formBody);
    req.end();
  });
}

// Buscar detalhes do boleto
async function buscarDetalhesBoleto(token, codigoSolicitacao) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: `/cobranca/v3/cobrancas/${codigoSolicitacao}`,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      cert: cert,
      key: key,
      rejectUnauthorized: false
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(result);
          } else {
            console.error(`Erro ao buscar boleto ${codigoSolicitacao}:`, result);
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    
    req.on('error', () => resolve(null));
    req.end();
  });
}

// Função principal
async function atualizarTodosBoletos() {
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔑 Obtendo token de acesso...');
    const token = await getAccessToken();
    console.log('✅ Token obtido\n');
    
    await client.connect();
    console.log('✅ Conectado ao banco de dados\n');
    
    // Buscar todos os boletos
    const query = `
      SELECT id, numero_parcela, codigo_solicitacao
      FROM inter_collections 
      WHERE proposta_id = '88a44696-9b63-42ee-aa81-15f9519d24cb'
        AND is_active = true
        AND codigo_solicitacao IS NOT NULL
      ORDER BY numero_parcela
    `;
    
    const result = await client.query(query);
    console.log(`📋 ${result.rows.length} boletos para atualizar\n`);
    
    let atualizados = 0;
    
    for (const boleto of result.rows) {
      console.log(`\n📝 Parcela ${boleto.numero_parcela}: ${boleto.codigo_solicitacao}`);
      
      const detalhes = await buscarDetalhesBoleto(token, boleto.codigo_solicitacao);
      
      if (detalhes) {
        // Extrair dados importantes
        const linhaDigitavel = detalhes.boleto?.linhaDigitavel || '';
        const codigoBarras = detalhes.boleto?.codigoBarras || '';
        const nossoNumero = detalhes.boleto?.nossoNumero || '';
        const pixCopiaECola = detalhes.pix?.pixCopiaECola || '';
        const txid = detalhes.pix?.txid || '';
        
        console.log(`  ✓ Linha digitável: ${linhaDigitavel ? 'SIM' : 'NÃO'}`);
        console.log(`  ✓ Código de barras: ${codigoBarras ? 'SIM' : 'NÃO'}`);
        console.log(`  ✓ PIX: ${pixCopiaECola ? 'SIM' : 'NÃO'}`);
        
        // Atualizar banco
        await client.query(
          `UPDATE inter_collections 
           SET linha_digitavel = $1, 
               codigo_barras = $2, 
               nosso_numero = $3,
               pix_copia_e_cola = $4,
               pix_txid = $5,
               updated_at = NOW()
           WHERE id = $6`,
          [linhaDigitavel, codigoBarras, nossoNumero, pixCopiaECola, txid, boleto.id]
        );
        
        atualizados++;
        console.log(`  ✅ Boleto atualizado`);
      } else {
        console.log(`  ❌ Não foi possível buscar detalhes`);
      }
      
      // Pausa entre requisições
      await new Promise(r => setTimeout(r, 300));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`✅ PROCESSO CONCLUÍDO!`);
    console.log(`${atualizados}/${result.rows.length} boletos atualizados com sucesso`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  } finally {
    await client.end();
    console.log('\n🔒 Conexão fechada');
  }
}

// Executar
console.log('Iniciando atualização de dados dos boletos...\n');
atualizarTodosBoletos()
  .then(() => {
    console.log('\n✅ Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  });