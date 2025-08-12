#!/usr/bin/env node
/**
 * SOLUÇÃO FINAL - CRIAR BOLETOS COM CERTIFICADO PROCESSADO
 */

const https = require('https');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const INTER_CLIENT_ID = process.env.INTER_CLIENT_ID;
const INTER_CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const INTER_CONTA_CORRENTE = process.env.INTER_CONTA_CORRENTE || "346470536";

// Processar certificado e chave
const CERT = process.env.INTER_CERTIFICATE;
const KEY = process.env.INTER_PRIVATE_KEY;

console.log('🚀 CRIAÇÃO FINAL DE BOLETOS - BANCO INTER');
console.log('=========================================\n');

// Função para criar agent HTTPS com certificado
function createHttpsAgent() {
  try {
    // Criar agent com certificado e chave
    return new https.Agent({
      cert: CERT,
      key: KEY,
      rejectUnauthorized: false
    });
  } catch (e) {
    console.error('Erro ao criar agent:', e.message);
    return null;
  }
}

// Obter token OAuth
async function getToken() {
  return new Promise((resolve, reject) => {
    console.log('🔑 Obtendo token OAuth com certificado...');
    
    const postData = `client_id=${INTER_CLIENT_ID}&client_secret=${INTER_CLIENT_SECRET}&grant_type=client_credentials&scope=cob.read cob.write`;
    
    const agent = createHttpsAgent();
    if (!agent) {
      reject(new Error('Não foi possível criar agent HTTPS'));
      return;
    }
    
    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: '/oauth/v2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      agent: agent
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('  Status:', res.statusCode);
        
        try {
          const result = JSON.parse(data);
          if (result.access_token) {
            console.log('  ✅ Token obtido com sucesso!\n');
            resolve(result.access_token);
          } else {
            console.log('  Resposta:', data);
            reject(new Error('Token não retornado'));
          }
        } catch (e) {
          console.log('  Erro:', data);
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Criar boleto
async function criarBoleto(token, dadosBoleto) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(dadosBoleto);
    
    const agent = createHttpsAgent();
    if (!agent) {
      reject(new Error('Não foi possível criar agent HTTPS'));
      return;
    }
    
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
      agent: agent
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
            console.error('Erro HTTP:', res.statusCode, data);
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
    // Conectar ao banco
    await client.connect();
    console.log('✅ Conectado ao banco de dados\n');
    
    // Buscar boletos
    const query = `
      SELECT id, numero_parcela, total_parcelas, valor_nominal, seu_numero
      FROM inter_collections 
      WHERE proposta_id = '88a44696-9b63-42ee-aa81-15f9519d24cb'
        AND is_active = true
      ORDER BY numero_parcela
      LIMIT 24
    `;
    
    const result = await client.query(query);
    console.log(`📋 ${result.rows.length} boletos para criar\n`);
    
    if (result.rows.length === 0) {
      console.log('⚠️ Nenhum boleto encontrado');
      return;
    }
    
    // Obter token
    const token = await getToken();
    
    let successCount = 0;
    const codigosGerados = [];
    
    console.log('📝 Criando boletos...\n');
    
    // Processar cada boleto
    for (const boleto of result.rows) {
      try {
        const hoje = new Date();
        const vencimento = new Date(hoje);
        vencimento.setDate(hoje.getDate() + (boleto.numero_parcela * 30));
        
        const dadosBoleto = {
          seuNumero: boleto.seu_numero || `SIMPIX-${Date.now()}-P${boleto.numero_parcela}`,
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
            linha1: `Parcela ${boleto.numero_parcela}/${boleto.total_parcelas}`,
            linha2: "SIMPIX FINANCEIRA"
          }
        };
        
        const response = await criarBoleto(token, dadosBoleto);
        
        if (response.codigoSolicitacao) {
          console.log(`✅ Parcela ${boleto.numero_parcela}: ${response.codigoSolicitacao}`);
          
          // Atualizar banco
          await client.query(
            `UPDATE inter_collections 
             SET codigo_solicitacao = $1, 
                 nosso_numero = $2, 
                 situacao = 'EMITIDO',
                 updated_at = NOW()
             WHERE id = $3`,
            [response.codigoSolicitacao, response.nossoNumero || '', boleto.id]
          );
          
          codigosGerados.push({
            parcela: boleto.numero_parcela,
            codigo: response.codigoSolicitacao
          });
          
          successCount++;
        }
        
        // Pausa entre requisições
        await new Promise(r => setTimeout(r, 300));
        
      } catch (error) {
        console.error(`❌ Erro parcela ${boleto.numero_parcela}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 PROCESSO CONCLUÍDO!');
    console.log('='.repeat(60));
    console.log(`\n✅ ${successCount} boletos criados com sucesso!`);
    
    if (successCount > 0) {
      console.log('\n📋 CÓDIGOS REAIS GERADOS:');
      codigosGerados.forEach(item => {
        console.log(`   Parcela ${item.parcela}: ${item.codigo}`);
      });
      console.log('\n✅ Os PDFs agora podem ser baixados!');
    }
    
  } catch (error) {
    console.error('\n❌ ERRO FATAL:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔒 Conexão com banco fechada');
  }
}

// Executar
console.log('Iniciando criação de boletos reais...\n');
criarTodosOsBoletos()
  .then(() => {
    console.log('\n✅ Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  });