#!/usr/bin/env node

/**
 * Teste completo do fluxo de carnê com autenticação
 * Simula o processo real: login -> sincronizar boletos -> gerar carnê
 */

const https = require('https');

// Configuração
const API_URL = 'https://874e2dce-5057-49ae-8fb5-21491c9977ba-00-1xresvzm7is3g.janeway.replit.dev';
const TEST_PROPOSTA_ID = '88a44696-9b63-42ee-aa81-15f9519d24cb';

// Credenciais de teste
const TEST_USER = {
  email: 'jose.silva@simpix.com.br',
  password: 'SimpleCredit2025*',
  role: 'ATENDENTE'
};

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

/**
 * Faz requisição HTTP
 */
function makeRequest(path, method = 'GET', token = null, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_URL.replace('https://', ''),
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ status: res.statusCode, data: response });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

/**
 * Faz login e obtém token JWT
 */
async function login() {
  logSection('PASSO 1: AUTENTICAÇÃO');
  
  try {
    log('🔐 Fazendo login...', 'cyan');
    
    const response = await makeRequest(
      '/api/auth/login',
      'POST',
      null,
      TEST_USER
    );
    
    if (response.status === 200 && response.data.token) {
      log('✅ Login realizado com sucesso', 'green');
      log(`👤 Usuário: ${response.data.user.email}`, 'blue');
      log(`📋 Role: ${response.data.user.role}`, 'blue');
      return response.data.token;
    } else {
      log(`❌ Falha no login: ${JSON.stringify(response.data)}`, 'red');
      return null;
    }
    
  } catch (error) {
    log(`❌ Erro no login: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Sincroniza boletos para o Storage
 */
async function sincronizarBoletos(token) {
  logSection('PASSO 2: SINCRONIZAÇÃO DE BOLETOS');
  
  try {
    log('🔄 Iniciando sincronização de boletos...', 'cyan');
    log(`📊 Proposta: ${TEST_PROPOSTA_ID}`, 'blue');
    
    const response = await makeRequest(
      `/api/propostas/${TEST_PROPOSTA_ID}/sincronizar-boletos`,
      'POST',
      token
    );
    
    if (response.status === 200) {
      log('✅ Sincronização iniciada com sucesso', 'green');
      log(`📋 Status: ${response.data.status}`, 'blue');
      log(`💬 Mensagem: ${response.data.message}`, 'blue');
      
      // Aguardar processamento em background
      log('\n⏳ Aguardando 10 segundos para processamento...', 'yellow');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      return true;
    } else {
      log(`❌ Falha na sincronização: ${JSON.stringify(response.data)}`, 'red');
      return false;
    }
    
  } catch (error) {
    log(`❌ Erro na sincronização: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Gera carnê a partir dos boletos no Storage
 */
async function gerarCarne(token) {
  logSection('PASSO 3: GERAÇÃO DO CARNÊ');
  
  try {
    log('📚 Gerando carnê consolidado...', 'cyan');
    
    const response = await makeRequest(
      `/api/propostas/${TEST_PROPOSTA_ID}/gerar-carne`,
      'POST',
      token
    );
    
    if (response.status === 200 && response.data.success) {
      log('✅ Carnê gerado com sucesso!', 'green');
      log(`📋 Proposta ID: ${response.data.propostaId}`, 'blue');
      log(`💬 Mensagem: ${response.data.message}`, 'blue');
      
      if (response.data.url) {
        log('\n🎉 URL DO CARNÊ DISPONÍVEL:', 'cyan');
        log(response.data.url, 'yellow');
        log('\n📌 Copie e cole esta URL no navegador para baixar o carnê', 'green');
      }
      
      return true;
    } else {
      log(`❌ Falha na geração do carnê: ${JSON.stringify(response.data)}`, 'red');
      return false;
    }
    
  } catch (error) {
    log(`❌ Erro na geração: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Fluxo principal
 */
async function main() {
  logSection('TESTE COMPLETO DO SISTEMA DE CARNÊ');
  
  log('📋 Sistema de Geração de Carnê de Boletos', 'cyan');
  log('🎯 Objetivo: Sincronizar boletos e gerar PDF consolidado', 'cyan');
  
  try {
    // Passo 1: Login
    const token = await login();
    if (!token) {
      log('\n❌ Teste falhou na autenticação', 'red');
      process.exit(1);
    }
    
    // Passo 2: Sincronizar boletos
    const sincOk = await sincronizarBoletos(token);
    if (!sincOk) {
      log('\n❌ Teste falhou na sincronização', 'red');
      process.exit(1);
    }
    
    // Passo 3: Gerar carnê
    const carneOk = await gerarCarne(token);
    if (!carneOk) {
      log('\n❌ Teste falhou na geração do carnê', 'red');
      process.exit(1);
    }
    
    // Resultado final
    logSection('RESULTADO FINAL');
    
    log('✅ TESTE COMPLETO REALIZADO COM SUCESSO!', 'green');
    log('\n📦 ARQUITETURA IMPLEMENTADA:', 'cyan');
    log('   1️⃣ Sincronização assíncrona de boletos', 'blue');
    log('   2️⃣ Armazenamento organizado no Storage', 'blue');
    log('   3️⃣ Geração de carnê a partir dos PDFs salvos', 'blue');
    log('   4️⃣ URL assinada para download do carnê', 'blue');
    
    log('\n🏗️ ESTRUTURA NO STORAGE:', 'cyan');
    log('   documents/', 'yellow');
    log('   └── propostas/' + TEST_PROPOSTA_ID + '/', 'yellow');
    log('       ├── boletos/emitidos_pendentes/ (PDFs individuais)', 'yellow');
    log('       └── carnes/ (carnês consolidados)', 'yellow');
    
  } catch (error) {
    logSection('ERRO NO TESTE');
    log(`❌ ${error.message}`, 'red');
    process.exit(1);
  }
}

// Executar teste
main().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});