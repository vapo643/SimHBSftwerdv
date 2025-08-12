#!/usr/bin/env node
/**
 * CRIAR BOLETOS USANDO LÓGICA DO SERVIÇO EXISTENTE
 * Usa a mesma formatação de certificados do InterBankService
 */

const https = require('https');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const INTER_CLIENT_ID = process.env.INTER_CLIENT_ID;
const INTER_CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const INTER_CERTIFICATE = process.env.INTER_CERTIFICATE;
const INTER_PRIVATE_KEY = process.env.INTER_PRIVATE_KEY;
const INTER_CONTA_CORRENTE = process.env.INTER_CONTA_CORRENTE || "346470536";

console.log('🚀 CRIAÇÃO DE BOLETOS COM FORMATAÇÃO CORRETA');
console.log('=============================================\n');

// Função para formatar certificado PEM (igual ao serviço existente)
function formatPemCertificate(cert) {
  console.log('[INTER] 🔄 Formatando certificado...');
  
  // Se já tem quebras de linha, retorna como está
  if (cert.includes('\n')) {
    console.log('[INTER] ✅ Certificado já formatado');
    return cert;
  }
  
  // Adicionar quebras de linha após headers e a cada 64 caracteres
  console.log('[INTER] 📋 Certificado em linha única, adicionando quebras...');
  
  const certMatch = cert.match(/-----BEGIN CERTIFICATE-----(.+)-----END CERTIFICATE-----/);
  if (certMatch) {
    const certBody = certMatch[1].trim();
    // Quebrar a cada 64 caracteres
    const formattedBody = certBody.match(/.{1,64}/g).join('\n');
    return `-----BEGIN CERTIFICATE-----\n${formattedBody}\n-----END CERTIFICATE-----`;
  }
  
  return cert;
}

// Função para formatar chave privada PEM
function formatPemPrivateKey(key) {
  console.log('[INTER] 🔄 Formatando chave privada...');
  
  // Se já tem quebras de linha, retorna como está
  if (key.includes('\n')) {
    console.log('[INTER] ✅ Chave já formatada');
    return key;
  }
  
  console.log('[INTER] 📋 Chave em linha única, adicionando quebras...');
  
  // Tentar formato PRIVATE KEY
  let keyMatch = key.match(/-----BEGIN PRIVATE KEY-----(.+)-----END PRIVATE KEY-----/);
  if (keyMatch) {
    const keyBody = keyMatch[1].trim();
    const formattedBody = keyBody.match(/.{1,64}/g).join('\n');
    return `-----BEGIN PRIVATE KEY-----\n${formattedBody}\n-----END PRIVATE KEY-----`;
  }
  
  // Tentar formato RSA PRIVATE KEY
  keyMatch = key.match(/-----BEGIN RSA PRIVATE KEY-----(.+)-----END RSA PRIVATE KEY-----/);
  if (keyMatch) {
    const keyBody = keyMatch[1].trim();
    const formattedBody = keyBody.match(/.{1,64}/g).join('\n');
    return `-----BEGIN RSA PRIVATE KEY-----\n${formattedBody}\n-----END RSA PRIVATE KEY-----`;
  }
  
  return key;
}

// Preparar certificados
const cert = formatPemCertificate(INTER_CERTIFICATE);
const key = formatPemPrivateKey(INTER_PRIVATE_KEY);

console.log('[INTER] ✅ Certificados formatados\n');

// Obter token OAuth
async function getAccessToken() {
  return new Promise((resolve, reject) => {
    console.log('[INTER] 🔑 Obtendo token de acesso...');
    
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
        console.log('[INTER] Response status:', res.statusCode);
        
        try {
          const result = JSON.parse(data);
          if (result.access_token) {
            console.log('[INTER] ✅ Token obtido com sucesso!\n');
            resolve(result.access_token);
          } else {
            console.log('[INTER] Resposta:', data);
            reject(new Error('Token não retornado'));
          }
        } catch (e) {
          console.log('[INTER] Erro ao processar:', data);
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('[INTER] Erro na requisição:', e.message);
      reject(e);
    });
    
    req.write(formBody);
    req.end();
  });
}

// Criar boleto
async function criarBoleto(token, dadosBoleto) {
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
            console.error('[INTER] Erro HTTP:', res.statusCode, data);
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
    // Obter token primeiro
    const token = await getAccessToken();
    
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
    
    let successCount = 0;
    const codigosGerados = [];
    
    // Processar cada boleto
    for (const boleto of result.rows) {
      try {
        console.log(`\n📝 Processando parcela ${boleto.numero_parcela}/${boleto.total_parcelas}...`);
        
        const hoje = new Date();
        const vencimento = new Date(hoje);
        vencimento.setDate(hoje.getDate() + (boleto.numero_parcela * 30));
        
        const dadosBoleto = {
          seuNumero: `SX${Date.now().toString().substring(8)}-${boleto.numero_parcela}`, // Max 15 chars
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
            linha1: `Parcela ${boleto.numero_parcela}/${boleto.total_parcelas}`,
            linha2: "SIMPIX FINANCEIRA",
            linha3: "",
            linha4: "",
            linha5: ""
          },

        };
        
        const response = await criarBoleto(token, dadosBoleto);
        
        if (response.codigoSolicitacao) {
          console.log(`✅ Boleto criado! Código: ${response.codigoSolicitacao}`);
          
          // Atualizar banco
          await client.query(
            `UPDATE inter_collections 
             SET codigo_solicitacao = $1, 
                 nosso_numero = $2, 
                 situacao = 'EMITIDO',
                 linha_digitavel = $3,
                 codigo_barras = $4,
                 updated_at = NOW()
             WHERE id = $5`,
            [
              response.codigoSolicitacao,
              response.nossoNumero || '',
              response.linhaDigitavel || '',
              response.codigoBarras || '',
              boleto.id
            ]
          );
          
          codigosGerados.push({
            parcela: boleto.numero_parcela,
            codigo: response.codigoSolicitacao
          });
          
          successCount++;
        }
        
        // Pausa entre requisições
        await new Promise(r => setTimeout(r, 500));
        
      } catch (error) {
        console.error(`❌ Erro parcela ${boleto.numero_parcela}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 PROCESSO CONCLUÍDO!');
    console.log('='.repeat(60));
    console.log(`\n✅ ${successCount} boletos criados com sucesso!`);
    
    if (successCount > 0) {
      console.log('\n📋 CÓDIGOS REAIS GERADOS (VÁLIDOS PARA DOWNLOAD DE PDF):');
      console.log('=' + '='.repeat(59));
      codigosGerados.forEach(item => {
        console.log(`   Parcela ${String(item.parcela).padStart(2, '0')}: ${item.codigo}`);
      });
      console.log('=' + '='.repeat(59));
      console.log('\n✅ Os PDFs agora podem ser baixados!');
      console.log('✅ Os códigos foram atualizados no banco de dados.');
      console.log('✅ A tela de formalização agora exibirá os boletos corretamente.');
    }
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await client.end();
    console.log('\n🔒 Conexão com banco fechada');
  }
}

// Executar
console.log('Iniciando com certificados formatados...\n');
criarTodosOsBoletos()
  .then(() => {
    console.log('\n✅ Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falhou:', error.message);
    process.exit(1);
  });