#!/usr/bin/env node
/**
 * SCRIPT DE CORREÇÃO EMERGENCIAL
 * Cria boletos REAIS no Banco Inter para substituir códigos inválidos
 */

const https = require('https');
const fs = require('fs');
const { Client } = require('pg');

// Configuração do banco de dados
const DATABASE_URL = process.env.DATABASE_URL;
const INTER_CLIENT_ID = process.env.INTER_CLIENT_ID;
const INTER_CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const INTER_CERTIFICATE = process.env.INTER_CERTIFICATE;
const INTER_PRIVATE_KEY = process.env.INTER_PRIVATE_KEY;
const INTER_CONTA_CORRENTE = process.env.INTER_CONTA_CORRENTE || "346470536";

console.log('🚀 SCRIPT DE CORREÇÃO DE BOLETOS INTER');
console.log('=====================================\n');

// Função para obter token OAuth do Inter
async function getInterToken() {
  return new Promise((resolve, reject) => {
    console.log('🔑 Obtendo token de acesso do Inter...');
    
    // Preparar certificado
    const cert = INTER_CERTIFICATE.replace(/\\n/g, '\n');
    const key = INTER_PRIVATE_KEY.replace(/\\n/g, '\n');
    
    const postData = 'client_id=' + INTER_CLIENT_ID +
                    '&client_secret=' + INTER_CLIENT_SECRET +
                    '&grant_type=client_credentials' +
                    '&scope=cob.read cob.write';
    
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
            console.log('✅ Token obtido com sucesso!\n');
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

// Função para criar boleto no Inter
async function criarBoletoInter(token, dadosBoleto) {
  return new Promise((resolve, reject) => {
    const cert = INTER_CERTIFICATE.replace(/\\n/g, '\n');
    const key = INTER_PRIVATE_KEY.replace(/\\n/g, '\n');
    
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
            resolve(result);
          } else {
            reject(new Error(`Erro ${res.statusCode}: ${data}`));
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
async function corrigirBoletos() {
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados\n');
    
    // Buscar boletos com códigos inválidos
    const query = `
      SELECT id, numero_parcela, total_parcelas, valor_nominal, codigo_solicitacao, seu_numero
      FROM inter_collections 
      WHERE proposta_id = '88a44696-9b63-42ee-aa81-15f9519d24cb'
        AND is_active = true
      ORDER BY numero_parcela
    `;
    
    const result = await client.query(query);
    console.log(`📋 Encontrados ${result.rows.length} boletos para corrigir\n`);
    
    // Obter token do Inter
    const token = await getInterToken();
    
    let successCount = 0;
    let failCount = 0;
    
    // Processar cada boleto
    for (const boleto of result.rows) {
      try {
        console.log(`\n🔄 Processando parcela ${boleto.numero_parcela}/${boleto.total_parcelas}`);
        console.log(`   Código antigo: ${boleto.codigo_solicitacao}`);
        
        // Calcular data de vencimento
        const hoje = new Date();
        const vencimento = new Date(hoje);
        vencimento.setDate(hoje.getDate() + (boleto.numero_parcela * 30));
        
        // Dados do boleto
        const dadosBoleto = {
          seuNumero: boleto.seu_numero || `PROP-${Date.now()}-${boleto.numero_parcela}`,
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
            cep: "29165460",
            email: "gabrieldjesus238@gmail.com",
            telefone: "27998538565"
          },
          mensagem: {
            linha1: `Parcela ${boleto.numero_parcela}/${boleto.total_parcelas}`
          },
          desconto1: {
            codigoDesconto: "NAOTEMDESCONTO",
            taxa: 0,
            valor: 0
          },
          multa: {
            codigoMulta: "PERCENTUAL",
            taxa: 2,
            valor: 0
          },
          mora: {
            codigoMora: "TAXAMENSAL",
            taxa: 1,
            valor: 0
          }
        };
        
        console.log('   Criando boleto no Inter...');
        const response = await criarBoletoInter(token, dadosBoleto);
        
        if (response.codigoSolicitacao) {
          console.log(`   ✅ Boleto criado! Código REAL: ${response.codigoSolicitacao}`);
          
          // Atualizar banco de dados
          const updateQuery = `
            UPDATE inter_collections 
            SET codigo_solicitacao = $1,
                nosso_numero = $2,
                situacao = 'EMITIDO',
                updated_at = NOW()
            WHERE id = $3
          `;
          
          await client.query(updateQuery, [
            response.codigoSolicitacao,
            response.nossoNumero || '',
            boleto.id
          ]);
          
          console.log('   ✅ Banco de dados atualizado');
          successCount++;
        } else {
          throw new Error('Código de solicitação não retornado');
        }
        
      } catch (error) {
        console.error(`   ❌ Erro: ${error.message}`);
        failCount++;
      }
    }
    
    console.log('\n✅ PROCESSO CONCLUÍDO!');
    console.log(`   Sucesso: ${successCount} boletos`);
    console.log(`   Falhas: ${failCount} boletos`);
    
  } catch (error) {
    console.error('❌ ERRO FATAL:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Executar
corrigirBoletos()
  .then(() => {
    console.log('\n🎉 Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falhou:', error);
    process.exit(1);
  });