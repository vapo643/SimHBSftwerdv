#!/usr/bin/env node

/**
 * Teste direto do endpoint gerar-carne
 * Objetivo: Verificar se o endpoint está respondendo e capturar os logs
 */

console.log('🧪 TESTE DIRETO DO ENDPOINT /gerar-carne');
console.log('📍 URL: /api/propostas/88a44696-9b63-42ee-aa81-15f9519d24cb/gerar-carne');
console.log('📋 Método: POST');
console.log('');
console.log('🔍 AGUARDE - observe os logs do servidor no console ao lado');
console.log('');
console.log('⚠️  ESPERAMOS VER:');
console.log('   [CARNE STORAGE API] Geração de carnê do Storage solicitada...');
console.log('   [CARNE DEBUG] Iniciando geração de carnê para a proposta...');
console.log('   [CARNE DEBUG] Listando ficheiros em propostas/.../boletos/...');
console.log('   ... e assim por diante');
console.log('');
console.log('📌 PONTO DE FALHA: Se não vir [CARNE STORAGE API], o endpoint não está sendo chamado');
console.log('📌 PONTO DE FALHA: Se não vir [CARNE DEBUG], o serviço não está sendo executado');
console.log('');

// Fazer uma requisição inválida só para testar se o endpoint responde
const https = require('https');

const options = {
  hostname: '874e2dce-5057-49ae-8fb5-21491c9977ba-00-1xresvzm7is3g.janeway.replit.dev',
  path: '/api/propostas/88a44696-9b63-42ee-aa81-15f9519d24cb/gerar-carne',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer invalid_test_token'
  }
};

const req = https.request(options, (res) => {
  console.log(`✅ RESPOSTA DO SERVIDOR: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📄 RESPOSTA COMPLETA:', data);
    console.log('');
    console.log('🎯 CONCLUSÃO:');
    
    if (res.statusCode === 401) {
      console.log('   ✅ ENDPOINT FUNCIONANDO (erro de autenticação esperado)');
      console.log('   🔍 Verifique os logs do servidor para [CARNE STORAGE API]');
    } else if (res.statusCode === 404) {
      console.log('   ❌ ENDPOINT NÃO ENCONTRADO - problema na configuração da rota');
    } else {
      console.log('   🤔 RESPOSTA INESPERADA - verifique os logs');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ ERRO NA REQUISIÇÃO:', error.message);
});

req.end();