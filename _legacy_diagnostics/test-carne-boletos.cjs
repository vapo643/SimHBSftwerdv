/**
 * Script de teste para validar a funcionalidade de geração de carnê de boletos
 * Protocolo 5-CHECK - Item 4: Script de teste isolado
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuração
const API_BASE_URL = 'http://localhost:5000';
const TEST_PROPOSTA_ID = '88a44696-9b63-42ee-aa81-15f9519d24cb'; // Proposta com boletos já gerados

// Token JWT (você precisa estar logado primeiro)
let authToken = '';

// Função para fazer login e obter token
async function login() {
  try {
    console.log('🔐 Fazendo login...');
    
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: 'test@simpix.com.br', // Substitua com credenciais válidas
      password: 'Test@123456'
    });
    
    authToken = response.data.token;
    console.log('✅ Login realizado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro no login:', error.response?.data || error.message);
    return false;
  }
}

// Função para testar geração de carnê
async function testarGeracaoCarne(propostaId) {
  try {
    console.log(`\n📚 Testando geração de carnê para proposta: ${propostaId}`);
    console.log('⏳ Aguarde, isso pode levar alguns segundos...\n');
    
    const startTime = Date.now();
    
    const response = await axios.get(
      `${API_BASE_URL}/api/propostas/${propostaId}/carne-pdf`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Carnê gerado com sucesso em ${elapsed}s!`);
    console.log('\n📊 Detalhes da resposta:');
    console.log('  - Status:', response.status);
    console.log('  - Proposta ID:', response.data.data?.propostaId);
    console.log('  - Número Proposta:', response.data.data?.numeroProposta);
    console.log('  - Tamanho do PDF:', response.data.data?.size, 'bytes');
    console.log('  - URL de Download:', response.data.data?.downloadUrl ? '✅ Gerada' : '❌ Não gerada');
    console.log('  - Expira em:', response.data.data?.expiresIn);
    
    if (response.data.data?.downloadUrl) {
      console.log('\n🔗 URL para download:');
      console.log(response.data.data.downloadUrl);
      
      // Opcional: fazer download do arquivo
      await baixarCarne(response.data.data.downloadUrl, propostaId);
    }
    
    return true;
  } catch (error) {
    console.error('\n❌ Erro ao gerar carnê:');
    console.error('  - Status:', error.response?.status);
    console.error('  - Mensagem:', error.response?.data?.message || error.message);
    console.error('  - Detalhes:', error.response?.data?.error);
    return false;
  }
}

// Função para baixar o carnê gerado
async function baixarCarne(url, propostaId) {
  try {
    console.log('\n📥 Baixando carnê...');
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer'
    });
    
    const fileName = `carne-teste-${propostaId}-${Date.now()}.pdf`;
    const filePath = path.join(__dirname, fileName);
    
    fs.writeFileSync(filePath, response.data);
    
    console.log(`✅ Carnê salvo em: ${filePath}`);
    console.log(`   Tamanho: ${response.data.length} bytes`);
    
    // Validar se é um PDF válido
    const pdfHeader = response.data.slice(0, 5).toString();
    if (pdfHeader.startsWith('%PDF')) {
      console.log('✅ PDF válido confirmado!');
    } else {
      console.log('⚠️ Arquivo pode não ser um PDF válido');
    }
    
  } catch (error) {
    console.error('❌ Erro ao baixar carnê:', error.message);
  }
}

// Função para testar download direto (sem Storage)
async function testarDownloadDireto(propostaId) {
  try {
    console.log(`\n📥 Testando download direto para proposta: ${propostaId}`);
    
    const startTime = Date.now();
    
    const response = await axios.get(
      `${API_BASE_URL}/api/propostas/${propostaId}/carne-pdf/download`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        responseType: 'arraybuffer'
      }
    );
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Download direto realizado em ${elapsed}s!`);
    console.log('  - Tamanho:', response.data.length, 'bytes');
    console.log('  - Content-Type:', response.headers['content-type']);
    
    // Salvar arquivo
    const fileName = `carne-direto-${propostaId}-${Date.now()}.pdf`;
    const filePath = path.join(__dirname, fileName);
    
    fs.writeFileSync(filePath, response.data);
    console.log(`✅ Arquivo salvo em: ${filePath}`);
    
    // Validar PDF
    const pdfHeader = response.data.slice(0, 5).toString();
    if (pdfHeader.startsWith('%PDF')) {
      console.log('✅ PDF válido confirmado!');
      return true;
    } else {
      console.log('⚠️ Arquivo pode não ser um PDF válido');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Erro no download direto:');
    console.error('  - Status:', error.response?.status);
    console.error('  - Mensagem:', error.response?.data?.message || error.message);
    return false;
  }
}

// Executar testes
async function executarTestes() {
  console.log('========================================');
  console.log('  TESTE DE GERAÇÃO DE CARNÊ DE BOLETOS');
  console.log('========================================\n');
  
  // 1. Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error('❌ Não foi possível fazer login. Verifique as credenciais.');
    process.exit(1);
  }
  
  // 2. Testar geração de carnê com Storage
  console.log('\n--- TESTE 1: Geração com Storage ---');
  const teste1 = await testarGeracaoCarne(TEST_PROPOSTA_ID);
  
  // 3. Testar download direto
  console.log('\n--- TESTE 2: Download Direto ---');
  const teste2 = await testarDownloadDireto(TEST_PROPOSTA_ID);
  
  // Resumo
  console.log('\n========================================');
  console.log('           RESUMO DOS TESTES');
  console.log('========================================');
  console.log(`  Teste 1 (Storage):  ${teste1 ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`  Teste 2 (Direto):   ${teste2 ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log('========================================\n');
  
  if (teste1 && teste2) {
    console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
    process.exit(0);
  } else {
    console.log('⚠️ Alguns testes falharam. Verifique os logs acima.');
    process.exit(1);
  }
}

// Iniciar testes
executarTestes().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});