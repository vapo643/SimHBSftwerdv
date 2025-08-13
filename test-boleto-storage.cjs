#!/usr/bin/env node

/**
 * Script de teste para o serviço de sincronização de boletos
 * Testa o download e armazenamento de PDFs no Supabase Storage
 */

const axios = require('axios');

// Configuração
const API_URL = 'https://874e2dce-5057-49ae-8fb5-21491c9977ba-00-1xresvzm7is3g.janeway.replit.dev';
const TEST_PROPOSTA_ID = '88a44696-9b63-42ee-aa81-15f9519d24cb'; // Proposta com 24 boletos

// Credenciais de teste
const TEST_USER = {
  email: 'gabriel@atendente.com',
  password: 'SenhaForte123!'
};

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
  console.log('\n' + '='.repeat(50));
  log(title, 'bright');
  console.log('='.repeat(50));
}

async function login() {
  try {
    log('🔐 Fazendo login...', 'cyan');
    
    const response = await axios.post(`${API_URL}/api/auth/login`, TEST_USER);
    
    if (response.data.token) {
      log('✅ Login realizado com sucesso', 'green');
      return response.data.token;
    }
    
    throw new Error('Token não recebido');
    
  } catch (error) {
    log(`❌ Erro no login: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

async function verificarProposta(token) {
  try {
    log(`\n🔍 Verificando proposta ${TEST_PROPOSTA_ID}...`, 'cyan');
    
    const response = await axios.get(
      `${API_URL}/api/inter/collections/${TEST_PROPOSTA_ID}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    const boletos = response.data.collections || [];
    
    if (boletos.length === 0) {
      log('⚠️ Nenhum boleto encontrado para esta proposta', 'yellow');
      return null;
    }
    
    log(`✅ Encontrados ${boletos.length} boletos`, 'green');
    
    // Listar códigos de solicitação
    log('\n📋 Códigos de solicitação encontrados:', 'blue');
    boletos.forEach((boleto, index) => {
      console.log(`  ${index + 1}. ${boleto.codigoSolicitacao} - Parcela ${boleto.numeroParcela}/${boleto.totalParcelas}`);
    });
    
    return boletos;
    
  } catch (error) {
    log(`❌ Erro ao verificar proposta: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

async function sincronizarBoletos(token) {
  try {
    logSection('SINCRONIZAÇÃO DE BOLETOS');
    
    log(`🚀 Iniciando sincronização para proposta ${TEST_PROPOSTA_ID}...`, 'cyan');
    
    const response = await axios.post(
      `${API_URL}/api/propostas/${TEST_PROPOSTA_ID}/sincronizar-boletos`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    log('✅ Sincronização iniciada com sucesso', 'green');
    console.log('📊 Resposta da API:', response.data);
    
    return response.data;
    
  } catch (error) {
    log(`❌ Erro na sincronização: ${error.response?.data?.message || error.message}`, 'red');
    
    if (error.response?.status === 404) {
      log('ℹ️ Proposta não encontrada. Verifique se o ID está correto.', 'yellow');
    }
    
    throw error;
  }
}

async function verificarStorage(token) {
  try {
    logSection('VERIFICAÇÃO DO STORAGE');
    
    log('⏳ Aguardando 10 segundos para processamento...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    log('📁 Verificando arquivos no Supabase Storage...', 'cyan');
    
    // Buscar boletos novamente para verificar se foram salvos
    const response = await axios.get(
      `${API_URL}/api/inter/collections/${TEST_PROPOSTA_ID}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    const boletos = response.data.collections || [];
    
    if (boletos.length > 0) {
      log(`✅ ${boletos.length} boletos processados`, 'green');
      
      // Testar download de um PDF para verificar se está acessível
      const primeiroBoleto = boletos[0];
      log(`\n🧪 Testando acesso ao primeiro PDF: ${primeiroBoleto.codigoSolicitacao}`, 'cyan');
      
      try {
        const pdfResponse = await axios.get(
          `${API_URL}/api/inter/collections/${primeiroBoleto.codigoSolicitacao}/pdf`,
          {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'arraybuffer'
          }
        );
        
        if (pdfResponse.data && pdfResponse.data.byteLength > 0) {
          log(`✅ PDF acessível (${pdfResponse.data.byteLength} bytes)`, 'green');
        } else {
          log('⚠️ PDF vazio ou inválido', 'yellow');
        }
        
      } catch (pdfError) {
        log(`⚠️ Não foi possível acessar o PDF: ${pdfError.message}`, 'yellow');
      }
    }
    
    return boletos.length;
    
  } catch (error) {
    log(`❌ Erro na verificação: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

async function main() {
  logSection('TESTE DO SERVIÇO DE SINCRONIZAÇÃO DE BOLETOS');
  
  let token;
  
  try {
    // 1. Login
    token = await login();
    
    // 2. Verificar proposta e boletos existentes
    const boletosExistentes = await verificarProposta(token);
    
    if (!boletosExistentes) {
      log('\n❌ Teste abortado: Proposta não possui boletos', 'red');
      process.exit(1);
    }
    
    // 3. Sincronizar boletos
    await sincronizarBoletos(token);
    
    // 4. Verificar se foram salvos no Storage
    const totalProcessados = await verificarStorage(token);
    
    // 5. Resultado final
    logSection('RESULTADO DO TESTE');
    
    if (totalProcessados > 0) {
      log(`✅ SUCESSO! ${totalProcessados} boletos sincronizados com o Storage`, 'green');
      log('\n📂 Estrutura de pastas esperada:', 'cyan');
      log(`   propostas/${TEST_PROPOSTA_ID}/boletos/emitidos_pendentes/`, 'blue');
      log('   └── {codigoSolicitacao}.pdf (para cada boleto)', 'blue');
    } else {
      log('⚠️ Nenhum boleto foi processado', 'yellow');
    }
    
  } catch (error) {
    logSection('ERRO NO TESTE');
    log(`❌ ${error.message}`, 'red');
    
    if (error.response?.data) {
      console.log('\nDetalhes do erro:', error.response.data);
    }
    
    process.exit(1);
  }
}

// Executar teste
main().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});