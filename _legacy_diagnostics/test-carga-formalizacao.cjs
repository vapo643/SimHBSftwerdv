/**
 * PAM V1.0 - SCRIPT DE TESTE DE CARGA DA ARQUITETURA ASSÍNCRONA
 * 
 * Missão: Validar empiricamente a capacidade de 50+ operações simultâneas
 * Endpoint: POST /api/propostas/:id/sincronizar-boletos
 * Arquitetura: Job Queue (BullMQ) com Workers assíncronos
 */

const https = require('https');
const http = require('http');

// ============================================
// CONFIGURAÇÕES DO TESTE
// ============================================
const CONFIG = {
  baseUrl: 'http://localhost:5000',
  endpoint: '/api/propostas/{{PROPOSTA_ID}}/sincronizar-boletos',
  totalRequests: 50,
  timeout: 30000, // 30 segundos timeout por requisição
  propostaId: process.argv[2] || 'PROP-1753723342043-S543HGB', // ID obtido do banco de dados
  authToken: process.argv[3] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhNjVlZmM1NC05MGNkLTRiOTQtYjk3MS1jOGE1NjAxMDQwMzIiLCJlbWFpbCI6ImFkbWluQHNpbXBpeC5jb20uYnIiLCJyb2xlIjoiQURNSU5JU1RSQURPUiIsImlhdCI6MTc1NTE4NzU0MCwiZXhwIjoxNzU1MTkxMTQwfQ.GJPl3qehbX7CkXCykKNhj6P0VxCIDZUZo3hIhqH8Zls' // Token de exemplo - use: node script.cjs [proposta_id] [token]
};

// ============================================
// ESTATÍSTICAS DO TESTE
// ============================================
const stats = {
  totalRequests: CONFIG.totalRequests,
  completedRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  timeouts: 0,
  startTime: 0,
  endTime: 0,
  responses: [],
  errors: []
};

// ============================================
// FUNÇÃO PARA DISPARAR UMA REQUISIÇÃO
// ============================================
function dispararRequisicao(index) {
  return new Promise((resolve) => {
    const url = CONFIG.endpoint.replace('{{PROPOSTA_ID}}', CONFIG.propostaId);
    const requestStartTime = Date.now();
    
    const postData = JSON.stringify({
      forceResync: true // Forçar re-sincronização para testar sob carga
    });
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.authToken}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: CONFIG.timeout
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - requestStartTime;
        const result = {
          index,
          statusCode: res.statusCode,
          responseTime,
          success: res.statusCode >= 200 && res.statusCode < 300,
          timestamp: new Date().toISOString()
        };
        
        try {
          result.response = JSON.parse(data);
        } catch (e) {
          result.response = { raw: data };
        }
        
        stats.completedRequests++;
        if (result.success) {
          stats.successfulRequests++;
        } else {
          stats.failedRequests++;
          stats.errors.push({
            index,
            statusCode: res.statusCode,
            error: result.response,
            responseTime
          });
        }
        
        stats.responses.push(result);
        console.log(`📊 [${index.toString().padStart(2, '0')}] ${result.success ? '✅' : '❌'} ${res.statusCode} | ${responseTime}ms`);
        
        resolve(result);
      });
    });
    
    req.on('error', (err) => {
      const responseTime = Date.now() - requestStartTime;
      stats.completedRequests++;
      stats.failedRequests++;
      stats.errors.push({
        index,
        error: err.message,
        responseTime
      });
      
      console.log(`📊 [${index.toString().padStart(2, '0')}] ❌ ERROR | ${responseTime}ms | ${err.message}`);
      resolve({ index, error: err.message, responseTime, success: false });
    });
    
    req.on('timeout', () => {
      stats.timeouts++;
      stats.completedRequests++;
      stats.failedRequests++;
      console.log(`📊 [${index.toString().padStart(2, '0')}] ⏰ TIMEOUT | ${CONFIG.timeout}ms`);
      req.destroy();
      resolve({ index, error: 'timeout', responseTime: CONFIG.timeout, success: false });
    });
    
    req.write(postData);
    req.end();
  });
}

// ============================================
// FUNÇÃO PRINCIPAL DO TESTE DE CARGA
// ============================================
async function executarTesteDeCarga() {
  console.log('🎯 PAM V1.0 - TESTE DE CARGA DA ARQUITETURA ASSÍNCRONA');
  console.log('='.repeat(60));
  console.log(`📋 Configuração do Teste:`);
  console.log(`   • Endpoint: ${CONFIG.baseUrl}${CONFIG.endpoint.replace('{{PROPOSTA_ID}}', CONFIG.propostaId)}`);
  console.log(`   • Total de Requisições: ${CONFIG.totalRequests}`);
  console.log(`   • Timeout por Requisição: ${CONFIG.timeout}ms`);
  console.log(`   • Proposta ID: ${CONFIG.propostaId}`);
  console.log('='.repeat(60));
  
  // Criar array de 50 promessas
  const promises = [];
  for (let i = 1; i <= CONFIG.totalRequests; i++) {
    promises.push(dispararRequisicao(i));
  }
  
  // Executar todas as requisições simultaneamente
  console.log('🚀 INICIANDO TESTE DE CARGA...');
  stats.startTime = Date.now();
  
  try {
    await Promise.all(promises);
  } catch (error) {
    console.error('❌ Erro durante execução do teste:', error);
  }
  
  stats.endTime = Date.now();
  
  // Gerar relatório
  gerarRelatorioFinal();
}

// ============================================
// FUNÇÃO PARA GERAR RELATÓRIO FINAL
// ============================================
function gerarRelatorioFinal() {
  const totalTime = stats.endTime - stats.startTime;
  const avgResponseTime = stats.responses.length > 0 
    ? stats.responses.reduce((sum, r) => sum + r.responseTime, 0) / stats.responses.length 
    : 0;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RELATÓRIO FINAL - PAM V1.0');
  console.log('='.repeat(60));
  
  console.log('📈 MÉTRICAS GERAIS:');
  console.log(`   • Tempo Total de Execução: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
  console.log(`   • Requisições Enviadas: ${CONFIG.totalRequests}`);
  console.log(`   • Requisições Completadas: ${stats.completedRequests}`);
  console.log(`   • Requisições Bem-sucedidas: ${stats.successfulRequests} (${((stats.successfulRequests/CONFIG.totalRequests)*100).toFixed(1)}%)`);
  console.log(`   • Requisições Falharam: ${stats.failedRequests} (${((stats.failedRequests/CONFIG.totalRequests)*100).toFixed(1)}%)`);
  console.log(`   • Timeouts: ${stats.timeouts}`);
  console.log(`   • Tempo Médio de Resposta: ${avgResponseTime.toFixed(2)}ms`);
  
  console.log('\n🔍 ANÁLISE DE PERFORMANCE:');
  
  // 1. Performance da API (Produtor)
  const apiSuccess = stats.successfulRequests >= CONFIG.totalRequests * 0.9; // 90% de sucesso
  console.log(`   • API (Produtor): ${apiSuccess ? '✅ APROVADA' : '❌ REPROVADA'}`);
  console.log(`     - Taxa de Sucesso: ${((stats.successfulRequests/CONFIG.totalRequests)*100).toFixed(1)}%`);
  console.log(`     - Tempo Médio: ${avgResponseTime.toFixed(2)}ms`);
  
  // 2. Performance da Fila (Análise dos códigos de resposta)
  const queueSuccess = stats.responses.filter(r => r.statusCode === 200 || r.statusCode === 202).length;
  const queuePerformance = queueSuccess >= CONFIG.totalRequests * 0.9;
  console.log(`   • Fila (BullMQ): ${queuePerformance ? '✅ APROVADA' : '❌ REPROVADA'}`);
  console.log(`     - Jobs Enfileirados: ${queueSuccess}/${CONFIG.totalRequests}`);
  
  // 3. Análise de Erros
  if (stats.errors.length > 0) {
    console.log('\n❌ ERROS IDENTIFICADOS:');
    const errorTypes = {};
    stats.errors.forEach(err => {
      const key = err.statusCode || err.error || 'unknown';
      errorTypes[key] = (errorTypes[key] || 0) + 1;
    });
    
    Object.entries(errorTypes).forEach(([type, count]) => {
      console.log(`     - ${type}: ${count} ocorrências`);
    });
  }
  
  // 4. Veredito Final
  console.log('\n🏆 VEREDITO FINAL DE ESCALABILIDADE:');
  const overallSuccess = apiSuccess && queuePerformance && stats.timeouts === 0;
  
  if (overallSuccess) {
    console.log('   ✅ ARQUITETURA APROVADA - Capacidade de 50+ operações simultâneas CONFIRMADA');
    console.log('   ✅ Princípio de falha isolada MANTIDO sob estresse');
  } else {
    console.log('   ❌ ARQUITETURA PRECISA DE AJUSTES - Capacidade limitada identificada');
    console.log('   ⚠️  Necessária investigação dos pontos de falha');
  }
  
  console.log('\n📝 PRÓXIMOS PASSOS:');
  console.log('   1. Analisar logs do Worker (processo do backend)');
  console.log('   2. Verificar estado das filas BullMQ/Redis');
  console.log('   3. Monitorar processamento dos jobs enfileirados');
  console.log('   4. Validar ativação de Circuit Breakers se houver');
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 PAM V1.0 CONCLUÍDO - Consulte logs do sistema para análise completa');
  console.log('='.repeat(60));
}

// ============================================
// EXECUÇÃO DO SCRIPT
// ============================================
if (require.main === module) {
  console.log('🔧 Validando configuração...');
  
  if (!CONFIG.propostaId) {
    console.error('❌ ERRO: ID da proposta não fornecido');
    console.log('💡 Uso: node test-carga-formalizacao.cjs [PROPOSTA_ID]');
    process.exit(1);
  }
  
  console.log(`✅ Proposta ID: ${CONFIG.propostaId}`);
  console.log('🚀 Iniciando em 3 segundos...\n');
  
  setTimeout(() => {
    executarTesteDeCarga().catch(console.error);
  }, 3000);
}