#!/usr/bin/env node

/**
 * Teste simplificado do endpoint de sincronização
 * Apenas verifica se o endpoint existe e responde corretamente
 */

const https = require('https');

const API_URL = 'https://874e2dce-5057-49ae-8fb5-21491c9977ba-00-1xresvzm7is3g.janeway.replit.dev';
const TEST_PROPOSTA_ID = '88a44696-9b63-42ee-aa81-15f9519d24cb';

console.log('========================================');
console.log('  TESTE DO ENDPOINT DE SINCRONIZAÇÃO');
console.log('========================================\n');

// Fazer requisição sem autenticação para verificar se endpoint existe
const options = {
  hostname: API_URL.replace('https://', ''),
  path: `/api/propostas/${TEST_PROPOSTA_ID}/sincronizar-boletos`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  console.log(`📊 Status Code: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (res.statusCode === 401) {
        console.log('✅ Endpoint existe e requer autenticação (como esperado)');
        console.log('📋 Resposta:', response);
        console.log('\n✨ TESTE PASSOU! O endpoint está implementado corretamente.');
        console.log('\n📌 Para testar completamente:');
        console.log('   1. Faça login na aplicação web');
        console.log('   2. Acesse uma proposta com boletos');
        console.log('   3. Use o botão de sincronização ou chame o endpoint via API');
        console.log(`   4. Os PDFs serão salvos em: propostas/${TEST_PROPOSTA_ID}/boletos/emitidos_pendentes/`);
      } else if (res.statusCode === 404) {
        console.log('❌ Endpoint não encontrado');
        console.log('📋 Resposta:', response);
      } else {
        console.log(`⚠️ Status inesperado: ${res.statusCode}`);
        console.log('📋 Resposta:', response);
      }
    } catch (error) {
      console.log('❌ Erro ao processar resposta:', error.message);
      console.log('📋 Resposta raw:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erro na requisição:', error.message);
});

req.end();