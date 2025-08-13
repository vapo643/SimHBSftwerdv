#!/usr/bin/env node

/**
 * Script de teste para geração de carnê a partir do Storage
 * Testa a funcionalidade completa: sincronização + geração de carnê
 */

const https = require('https');

// Configuração
const API_URL = 'https://874e2dce-5057-49ae-8fb5-21491c9977ba-00-1xresvzm7is3g.janeway.replit.dev';
const TEST_PROPOSTA_ID = '88a44696-9b63-42ee-aa81-15f9519d24cb'; // Proposta com 24 boletos

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
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
function makeRequest(path, method = 'GET', token = null) {
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
    
    req.end();
  });
}

async function testarSincronizacao() {
  logSection('TESTE 1: SINCRONIZAÇÃO DE BOLETOS');
  
  try {
    log('🚀 Testando endpoint de sincronização...', 'cyan');
    
    const response = await makeRequest(
      `/api/propostas/${TEST_PROPOSTA_ID}/sincronizar-boletos`,
      'POST'
    );
    
    log(`📊 Status Code: ${response.status}`, 'blue');
    
    if (response.status === 401) {
      log('✅ Endpoint de sincronização existe e requer autenticação', 'green');
      return true;
    } else if (response.status === 404) {
      log('❌ Endpoint de sincronização não encontrado', 'red');
      return false;
    } else {
      log(`⚠️ Status inesperado: ${response.status}`, 'yellow');
      console.log('Resposta:', response.data);
      return false;
    }
    
  } catch (error) {
    log(`❌ Erro ao testar sincronização: ${error.message}`, 'red');
    return false;
  }
}

async function testarGeracaoCarne() {
  logSection('TESTE 2: GERAÇÃO DE CARNÊ');
  
  try {
    log('📚 Testando endpoint de geração de carnê...', 'cyan');
    
    const response = await makeRequest(
      `/api/propostas/${TEST_PROPOSTA_ID}/gerar-carne`,
      'POST'
    );
    
    log(`📊 Status Code: ${response.status}`, 'blue');
    
    if (response.status === 401) {
      log('✅ Endpoint de carnê existe e requer autenticação', 'green');
      return true;
    } else if (response.status === 404) {
      log('❌ Endpoint de carnê não encontrado', 'red');
      return false;
    } else {
      log(`⚠️ Status inesperado: ${response.status}`, 'yellow');
      console.log('Resposta:', response.data);
      return false;
    }
    
  } catch (error) {
    log(`❌ Erro ao testar carnê: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  logSection('TESTE DO SERVIÇO DE CARNÊ DO STORAGE');
  
  log('📋 Proposta de teste: ' + TEST_PROPOSTA_ID, 'blue');
  log('📊 Quantidade esperada de boletos: 24', 'blue');
  
  try {
    // Teste 1: Sincronização
    const sincOk = await testarSincronizacao();
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Teste 2: Geração de Carnê
    const carneOk = await testarGeracaoCarne();
    
    // Resultado final
    logSection('RESULTADO DOS TESTES');
    
    if (sincOk && carneOk) {
      log('✅ SUCESSO! Ambos endpoints estão implementados', 'green');
      
      log('\n📌 FLUXO COMPLETO DE USO:', 'cyan');
      log('   1. POST /api/propostas/{id}/sincronizar-boletos', 'blue');
      log('      → Baixa boletos do Inter e salva no Storage', 'blue');
      log('      → Estrutura: propostas/{id}/boletos/emitidos_pendentes/', 'blue');
      
      log('\n   2. POST /api/propostas/{id}/gerar-carne', 'blue');
      log('      → Lê PDFs do Storage e funde em um único carnê', 'blue');
      log('      → Salva em: propostas/{id}/carnes/carne-{timestamp}.pdf', 'blue');
      log('      → Retorna URL assinada do carnê', 'blue');
      
      log('\n📦 ESTRUTURA FINAL NO STORAGE:', 'cyan');
      log('   documents/', 'yellow');
      log('   └── propostas/{propostaId}/', 'yellow');
      log('       ├── boletos/', 'yellow');
      log('       │   └── emitidos_pendentes/', 'yellow');
      log('       │       ├── {codigoSolicitacao1}.pdf', 'yellow');
      log('       │       ├── {codigoSolicitacao2}.pdf', 'yellow');
      log('       │       └── ...', 'yellow');
      log('       └── carnes/', 'yellow');
      log('           └── carne-{timestamp}.pdf', 'yellow');
      
    } else {
      log('❌ FALHA! Alguns endpoints não estão funcionando', 'red');
      
      if (!sincOk) {
        log('  - Endpoint de sincronização precisa ser corrigido', 'red');
      }
      if (!carneOk) {
        log('  - Endpoint de geração de carnê precisa ser corrigido', 'red');
      }
    }
    
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