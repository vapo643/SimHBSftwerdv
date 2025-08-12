#!/usr/bin/env node
/**
 * SOLUÇÃO DEFINITIVA PARA CRIAR BOLETOS REAIS NO BANCO INTER
 * Este script cria boletos com códigos VÁLIDOS que permitem download de PDF
 */

const https = require('https');
const { Client } = require('pg');

// Configuração
const DATABASE_URL = process.env.DATABASE_URL;
const INTER_CLIENT_ID = process.env.INTER_CLIENT_ID;
const INTER_CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const INTER_CERTIFICATE = process.env.INTER_CERTIFICATE;
const INTER_PRIVATE_KEY = process.env.INTER_PRIVATE_KEY;
const INTER_CONTA_CORRENTE = process.env.INTER_CONTA_CORRENTE || "346470536";

console.log('🚀 CRIAÇÃO DE BOLETOS REAIS - BANCO INTER');
console.log('==========================================\n');

// Função para processar certificado Base64
function processaCertificado(certBase64) {
  try {
    // Se já tem BEGIN/END, retorna como está
    if (certBase64.includes('BEGIN CERTIFICATE')) {
      return certBase64;
    }
    
    // Decodifica de Base64
    const decoded = Buffer.from(certBase64, 'base64').toString('utf-8');
    
    // Se o decodificado já tem BEGIN/END, usa ele
    if (decoded.includes('BEGIN CERTIFICATE')) {
      return decoded;
    }
    
    // Se não tem, adiciona os headers
    const lines = certBase64.match(/.{1,64}/g) || [];
    return '-----BEGIN CERTIFICATE-----\n' + lines.join('\n') + '\n-----END CERTIFICATE-----';
  } catch (e) {
    console.error('Erro ao processar certificado:', e.message);
    // Tenta retornar algo útil
    return certBase64;
  }
}

// Função para processar chave privada
function processaChavePrivada(keyBase64) {
  try {
    // Se já tem BEGIN/END, retorna como está
    if (keyBase64.includes('BEGIN') && keyBase64.includes('KEY')) {
      return keyBase64;
    }
    
    // Decodifica de Base64
    const decoded = Buffer.from(keyBase64, 'base64').toString('utf-8');
    
    // Se o decodificado já tem BEGIN/END, usa ele
    if (decoded.includes('BEGIN') && decoded.includes('KEY')) {
      return decoded;
    }
    
    // Se não tem, adiciona os headers (tenta RSA primeiro)
    const lines = keyBase64.match(/.{1,64}/g) || [];
    return '-----BEGIN RSA PRIVATE KEY-----\n' + lines.join('\n') + '\n-----END RSA PRIVATE KEY-----';
  } catch (e) {
    console.error('Erro ao processar chave:', e.message);
    return keyBase64;
  }
}

// Obter token OAuth
async function getInterToken() {
  return new Promise((resolve, reject) => {
    console.log('🔑 Obtendo token OAuth do Banco Inter...');
    
    const cert = processaCertificado(INTER_CERTIFICATE);
    const key = processaChavePrivada(INTER_PRIVATE_KEY);
    
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
            console.log('✅ Token obtido! Expira em:', result.expires_in, 'segundos\n');
            resolve(result.access_token);
          } else {
            console.error('Resposta do Inter:', data);
            reject(new Error('Token não retornado'));
          }
        } catch (e) {
          console.error('Erro ao processar resposta:', data);
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('Erro na requisição:', e.message);
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
}

// Criar boleto no Inter
async function criarBoletoInter(token, dadosBoleto) {
  return new Promise((resolve, reject) => {
    const cert = processaCertificado(INTER_CERTIFICATE);
    const key = processaChavePrivada(INTER_PRIVATE_KEY);
    
    const postData = JSON.stringify(dadosBoleto);
    
    console.log(`📝 Criando boleto para parcela ${dadosBoleto.mensagem.linha1}...`);
    
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
            console.log(`✅ Boleto criado! Código: ${result.codigoSolicitacao}`);
            resolve(result);
          } else {
            console.error(`❌ Erro ${res.statusCode}:`, data);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          console.error('Erro ao processar resposta:', data);
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('Erro na requisição:', e.message);
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
}

// Função principal
async function criarBoletosReais() {
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados\n');
    
    // Buscar boletos que precisam de códigos reais
    const query = `
      SELECT 
        id, 
        proposta_id,
        numero_parcela, 
        total_parcelas, 
        valor_nominal, 
        codigo_solicitacao,
        seu_numero
      FROM inter_collections 
      WHERE proposta_id = '88a44696-9b63-42ee-aa81-15f9519d24cb'
        AND is_active = true
      ORDER BY numero_parcela
      LIMIT 24
    `;
    
    const result = await client.query(query);
    console.log(`📋 ${result.rows.length} boletos para processar\n`);
    
    if (result.rows.length === 0) {
      console.log('⚠️ Nenhum boleto encontrado para processar');
      return;
    }
    
    // Obter token
    const token = await getInterToken();
    
    let successCount = 0;
    let failCount = 0;
    const novosCodigoS = [];
    
    // Processar cada boleto
    for (const boleto of result.rows) {
      try {
        // Calcular data de vencimento (30 dias entre parcelas)
        const hoje = new Date();
        const vencimento = new Date(hoje);
        vencimento.setDate(hoje.getDate() + (boleto.numero_parcela * 30));
        
        // Montar dados do boleto
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
            complemento: "",
            bairro: "CENTRO",
            cidade: "SERRA",
            uf: "ES",
            cep: "29165460",
            email: "gabrieldjesus238@gmail.com",
            telefone: "27998538565"
          },
          mensagem: {
            linha1: `Parcela ${boleto.numero_parcela}/${boleto.total_parcelas}`,
            linha2: `Proposta: ${boleto.proposta_id.substring(0, 8)}`,
            linha3: "SIMPIX FINANCEIRA",
            linha4: "Não receber após vencimento",
            linha5: ""
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
        
        // Criar boleto no Inter
        const response = await criarBoletoInter(token, dadosBoleto);
        
        if (response.codigoSolicitacao) {
          // Atualizar banco de dados com código REAL
          const updateQuery = `
            UPDATE inter_collections 
            SET 
              codigo_solicitacao = $1,
              nosso_numero = $2,
              situacao = 'EMITIDO',
              linha_digitavel = $3,
              codigo_barras = $4,
              updated_at = NOW()
            WHERE id = $5
          `;
          
          await client.query(updateQuery, [
            response.codigoSolicitacao,
            response.nossoNumero || '',
            response.linhaDigitavel || '',
            response.codigoBarras || '',
            boleto.id
          ]);
          
          novosCodigoS.push({
            parcela: boleto.numero_parcela,
            codigo: response.codigoSolicitacao
          });
          
          successCount++;
        }
        
      } catch (error) {
        console.error(`❌ Erro na parcela ${boleto.numero_parcela}:`, error.message);
        failCount++;
      }
      
      // Pequena pausa entre requisições
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 PROCESSO CONCLUÍDO!');
    console.log('='.repeat(50));
    console.log(`✅ Sucesso: ${successCount} boletos criados`);
    console.log(`❌ Falhas: ${failCount} boletos`);
    
    if (successCount > 0) {
      console.log('\n📋 NOVOS CÓDIGOS DE SOLICITAÇÃO (REAIS):');
      novosCodigoS.forEach(item => {
        console.log(`   Parcela ${item.parcela}: ${item.codigo}`);
      });
      console.log('\n✅ Agora você pode baixar os PDFs dos boletos!');
    }
    
  } catch (error) {
    console.error('\n❌ ERRO FATAL:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔒 Conexão com banco fechada');
  }
}

// Executar
console.log('Iniciando processo de criação de boletos reais...\n');
criarBoletosReais()
  .then(() => {
    console.log('\n✅ Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falhou:', error.message);
    process.exit(1);
  });