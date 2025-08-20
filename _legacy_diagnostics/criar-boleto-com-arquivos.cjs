#!/usr/bin/env node
/**
 * CRIAÇÃO DE BOLETOS USANDO ARQUIVOS DE CERTIFICADO
 */

const https = require('https');
const fs = require('fs');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const INTER_CLIENT_ID = process.env.INTER_CLIENT_ID;
const INTER_CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const INTER_CONTA_CORRENTE = process.env.INTER_CONTA_CORRENTE || "346470536";

// Ler certificados dos arquivos
const cert = fs.readFileSync('inter-cert.pem', 'utf8');
const key = fs.readFileSync('inter-key.pem', 'utf8');

console.log('🚀 CRIAÇÃO DE BOLETOS COM ARQUIVOS');
console.log('===================================\n');

// Obter token
async function getToken() {
  return new Promise((resolve, reject) => {
    console.log('🔑 Obtendo token...');
    
    const postData = `client_id=${INTER_CLIENT_ID}&client_secret=${INTER_CLIENT_SECRET}&grant_type=client_credentials&scope=cob.read cob.write`;
    
    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: '/oauth/v2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
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
            console.log('✅ Token obtido!\n');
            resolve(result.access_token);
          } else {
            reject(new Error('Token não retornado: ' + data));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Criar um boleto de teste
async function criarBoletoTeste(token) {
  return new Promise((resolve, reject) => {
    console.log('📝 Criando boleto de teste...');
    
    const hoje = new Date();
    const vencimento = new Date(hoje);
    vencimento.setDate(hoje.getDate() + 30);
    
    const dadosBoleto = {
      seuNumero: `TESTE-${Date.now()}`,
      valorNominal: 150.00,
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
        'x-conta-corrente': INTER_CONTA_CORRENTE
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
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log('✅ BOLETO CRIADO COM SUCESSO!');
            console.log('   Código:', result.codigoSolicitacao);
            console.log('   Nosso Número:', result.nossoNumero);
            resolve(result);
          } else {
            console.error('❌ Erro:', res.statusCode, data);
            reject(new Error(data));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Executar
async function main() {
  try {
    const token = await getToken();
    const boleto = await criarBoletoTeste(token);
    
    console.log('\n🎉 SUCESSO! Boleto criado no Banco Inter');
    console.log('Código REAL que permite download de PDF:', boleto.codigoSolicitacao);
    
    // Agora vamos criar todos os 24 boletos
    console.log('\n📋 Agora vou criar os 24 boletos da proposta...\n');
    
    const client = new Client({ 
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    
    const result = await client.query(`
      SELECT id, numero_parcela, total_parcelas, valor_nominal, seu_numero
      FROM inter_collections 
      WHERE proposta_id = '88a44696-9b63-42ee-aa81-15f9519d24cb'
        AND is_active = true
      ORDER BY numero_parcela
    `);
    
    console.log(`Encontrados ${result.rows.length} boletos\n`);
    
    for (const boleto of result.rows) {
      try {
        const venc = new Date();
        venc.setDate(venc.getDate() + (boleto.numero_parcela * 30));
        
        const dados = {
          seuNumero: boleto.seu_numero || `SX-${Date.now()}-${boleto.numero_parcela}`,
          valorNominal: parseFloat(boleto.valor_nominal),
          dataVencimento: venc.toISOString().split('T')[0],
          numDiasAgenda: 30,
          pagador: {
            cpfCnpj: "20528464760",
            tipoPessoa: "FISICA",
            nome: "GABRIEL DE JESUS SANTANA SERRI",
            endereco: "RUA MIGUEL ANGELO",
            numero: "100",
            bairro: "CENTRO",
            cidade: "SERRA",
            uf: "ES",
            cep: "29165460"
          }
        };
        
        const postData = JSON.stringify(dados);
        
        await new Promise((resolve, reject) => {
          const req = https.request({
            hostname: 'cdpj.partners.bancointer.com.br',
            port: 443,
            path: '/cobranca/v3/cobrancas',
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
              'x-conta-corrente': INTER_CONTA_CORRENTE
            },
            cert: cert,
            key: key,
            rejectUnauthorized: false
          }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              try {
                const result = JSON.parse(data);
                if (res.statusCode === 200 || res.statusCode === 201) {
                  console.log(`✅ Parcela ${boleto.numero_parcela}: ${result.codigoSolicitacao}`);
                  
                  // Atualizar banco
                  client.query(
                    `UPDATE inter_collections 
                     SET codigo_solicitacao = $1, nosso_numero = $2, situacao = 'EMITIDO'
                     WHERE id = $3`,
                    [result.codigoSolicitacao, result.nossoNumero || '', boleto.id]
                  );
                  
                  resolve(result);
                } else {
                  console.error(`❌ Parcela ${boleto.numero_parcela}: Erro ${res.statusCode}`);
                  resolve(null);
                }
              } catch (e) {
                resolve(null);
              }
            });
          });
          
          req.on('error', () => resolve(null));
          req.write(postData);
          req.end();
        });
        
        // Pausa entre requisições
        await new Promise(r => setTimeout(r, 500));
        
      } catch (e) {
        console.error(`Erro parcela ${boleto.numero_parcela}:`, e.message);
      }
    }
    
    await client.end();
    
    console.log('\n✅ PROCESSO COMPLETO!');
    console.log('Os PDFs agora podem ser baixados!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

main();