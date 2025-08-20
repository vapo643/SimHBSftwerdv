#!/usr/bin/env node

/**
 * Teste de diagnóstico para geração de carnê
 * Objetivo: Capturar logs detalhados do processo de fusão
 */

const https = require('https');

// Configuração
const API_URL = 'https://874e2dce-5057-49ae-8fb5-21491c9977ba-00-1xresvzm7is3g.janeway.replit.dev';
const TEST_PROPOSTA_ID = '88a44696-9b63-42ee-aa81-15f9519d24cb';

// Credenciais de teste - usar admin para garantir acesso
const TEST_USER = {
  email: 'admin@simpix.com.br',
  password: 'Admin@2025!'
};

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
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
 * Teste principal: Executar apenas a geração do carnê
 */
async function main() {
  logSection('TESTE DE DIAGNÓSTICO - GERAÇÃO DE CARNÊ');
  
  log('🎯 Objetivo: Capturar logs detalhados do processo de fusão', 'cyan');
  log('📊 Proposta de teste: ' + TEST_PROPOSTA_ID, 'blue');
  log('📁 PDFs já salvos no Storage pela sincronização anterior', 'yellow');
  
  try {
    // Login para obter token
    log('\n🔐 Autenticando com usuário admin...', 'cyan');
    
    const loginResponse = await makeRequest(
      '/api/auth/login',
      'POST',
      null,
      TEST_USER
    );
    
    if (loginResponse.status !== 200 || !loginResponse.data.token) {
      log(`❌ Falha na autenticação: ${JSON.stringify(loginResponse.data)}`, 'red');
      throw new Error('Falha na autenticação');
    }
    
    const token = loginResponse.data.token;
    log('✅ Autenticação bem-sucedida', 'green');
    log(`👤 Usuário: ${loginResponse.data.user.email}`, 'blue');
    log(`🔑 Role: ${loginResponse.data.user.role}`, 'blue');
    
    logSection('EXECUTANDO GERAÇÃO DO CARNÊ');
    
    log('\n🚀 Chamando POST /api/propostas/:id/gerar-carne', 'magenta');
    log('📋 Este endpoint deve:', 'cyan');
    log('   1. Listar PDFs em propostas/{id}/boletos/emitidos_pendentes/', 'yellow');
    log('   2. Baixar cada PDF do Storage', 'yellow');
    log('   3. Fundir todos em um único carnê', 'yellow');
    log('   4. Salvar carnê em propostas/{id}/carnes/', 'yellow');
    log('   5. Retornar URL assinada', 'yellow');
    
    log('\n⏳ Executando... (observe os logs do servidor)', 'cyan');
    
    const carneResponse = await makeRequest(
      `/api/propostas/${TEST_PROPOSTA_ID}/gerar-carne`,
      'POST',
      token
    );
    
    log(`\n📊 Status da resposta: ${carneResponse.status}`, 'cyan');
    
    if (carneResponse.status === 200) {
      if (carneResponse.data.success) {
        log('✅ SUCESSO! Carnê gerado com sucesso', 'green');
        log(`📄 Mensagem: ${carneResponse.data.message}`, 'blue');
        
        if (carneResponse.data.url) {
          log('\n🌟 URL DO CARNÊ:', 'green');
          log(carneResponse.data.url, 'yellow');
          log('\n📌 Copie esta URL para testar o download', 'cyan');
        }
      } else {
        log('❌ Resposta com success=false', 'red');
        log(`Erro: ${carneResponse.data.message || carneResponse.data.error}`, 'red');
      }
    } else {
      log('❌ Erro HTTP', 'red');
      log(`Resposta completa: ${JSON.stringify(carneResponse.data, null, 2)}`, 'red');
    }
    
    logSection('ANÁLISE DOS LOGS');
    
    log('📋 VERIFIQUE OS LOGS DO SERVIDOR PARA:', 'magenta');
    log('   • [CARNE DEBUG] Iniciando geração...', 'cyan');
    log('   • [CARNE DEBUG] Listando ficheiros...', 'cyan');
    log('   • [CARNE DEBUG] X ficheiros encontrados', 'cyan');
    log('   • [CARNE DEBUG] Baixando ficheiro: nome.pdf', 'cyan');
    log('   • [CARNE DEBUG] Download de todos os buffers concluído', 'cyan');
    log('   • [CARNE DEBUG] Fusão concluída com sucesso', 'cyan');
    log('   • [CARNE DEBUG] Upload do carnê concluído', 'cyan');
    log('   • [CARNE DEBUG] URL do carnê gerada', 'cyan');
    
    log('\n⚠️ SE HOUVE ERRO, O LOG MOSTRARÁ ONDE PAROU', 'yellow');
    
  } catch (error) {
    logSection('ERRO NO TESTE');
    log(`❌ ${error.message}`, 'red');
    log('\n📋 Verifique os logs do servidor para mais detalhes', 'yellow');
    process.exit(1);
  }
}

// Executar teste
main().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});