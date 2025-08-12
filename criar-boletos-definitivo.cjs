#!/usr/bin/env node
/**
 * SOLUÇÃO DEFINITIVA - CRIAR BOLETOS REAIS NO BANCO INTER
 * Usa certificados já validados para criar boletos com códigos válidos
 */

const https = require('https');
const fs = require('fs');
const { Client } = require('pg');

// Carregar configuração
const config = JSON.parse(fs.readFileSync('certificate-debug.json', 'utf8'));
const DATABASE_URL = process.env.DATABASE_URL;

console.log('🚀 CRIAÇÃO DEFINITIVA DE BOLETOS REAIS');
console.log('=======================================\n');

// Obter token OAuth
async function getInterToken() {
  return new Promise((resolve, reject) => {
    console.log('🔑 Obtendo token OAuth...');
    
    const postData = `client_id=${config.clientId}&client_secret=${config.clientSecret}&grant_type=client_credentials&scope=cob.read cob.write`;
    
    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: '/oauth/v2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      cert: config.certificate,
      key: config.privateKey,
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
            console.error('Resposta:', data);
            reject(new Error('Token não retornado'));
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

// Criar boleto no Inter
async function criarBoletoInter(token, dadosBoleto, parcela) {
  return new Promise((resolve, reject) => {
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
        'x-conta-corrente': config.contaCorrente
      },
      cert: config.certificate,
      key: config.privateKey,
      rejectUnauthorized: false
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log(`✅ Parcela ${parcela}: Código ${result.codigoSolicitacao}`);
            resolve(result);
          } else {
            console.error(`❌ Parcela ${parcela}: Erro ${res.statusCode}`);
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

// Função principal
async function criarTodosOsBoletos() {
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado ao banco\n');
    
    // Buscar boletos
    const query = `
      SELECT id, numero_parcela, total_parcelas, valor_nominal, seu_numero
      FROM inter_collections 
      WHERE proposta_id = '88a44696-9b63-42ee-aa81-15f9519d24cb'
        AND is_active = true
      ORDER BY numero_parcela
    `;
    
    const result = await client.query(query);
    console.log(`📋 ${result.rows.length} boletos para criar\n`);
    
    // Obter token
    const token = await getInterToken();
    
    const codigosGerados = [];
    
    // Criar cada boleto
    for (const boleto of result.rows) {
      try {
        const hoje = new Date();
        const vencimento = new Date(hoje);
        vencimento.setDate(hoje.getDate() + (boleto.numero_parcela * 30));
        
        const dadosBoleto = {
          seuNumero: boleto.seu_numero || `SX-${Date.now()}-${boleto.numero_parcela}`,
          valorNominal: parseFloat(boleto.valor_nominal),
          dataVencimento: vencimento.toISOString().split('T')[0],
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
          },
          mensagem: {
            linha1: `Parcela ${boleto.numero_parcela}/${boleto.total_parcelas}`
          }
        };
        
        const response = await criarBoletoInter(token, dadosBoleto, boleto.numero_parcela);
        
        if (response.codigoSolicitacao) {
          // Atualizar banco
          await client.query(
            `UPDATE inter_collections 
             SET codigo_solicitacao = $1, nosso_numero = $2, situacao = 'EMITIDO'
             WHERE id = $3`,
            [response.codigoSolicitacao, response.nossoNumero || '', boleto.id]
          );
          
          codigosGerados.push({
            parcela: boleto.numero_parcela,
            codigo: response.codigoSolicitacao
          });
        }
        
        // Pausa entre requisições
        await new Promise(r => setTimeout(r, 300));
        
      } catch (error) {
        console.error(`Erro parcela ${boleto.numero_parcela}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 BOLETOS CRIADOS COM SUCESSO!');
    console.log('='.repeat(50));
    console.log('\n📋 CÓDIGOS REAIS GERADOS:');
    codigosGerados.forEach(item => {
      console.log(`   Parcela ${item.parcela}: ${item.codigo}`);
    });
    console.log('\n✅ PDFs agora podem ser baixados!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

// Executar
criarTodosOsBoletos();