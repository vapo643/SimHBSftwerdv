/**
 * Load Test Script - Proposal Flow
 * OPERAÇÃO ESCUDO DE PRODUÇÃO - MISSÃO 3: VALIDAÇÃO DE CARGA
 * 
 * Simulates the critical path: Authentication → Create Proposal → Approve Proposal
 * Target: 50 proposals/day distributed over 8-hour workday
 * SLA: P95 < 500ms, Error Rate = 0%
 */

import { performance } from 'perf_hooks';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TARGET_ITERATIONS = parseInt(process.env.ITERATIONS) || 50;
const CONCURRENT_USERS = parseInt(process.env.VUS) || 2;
const TEST_DURATION_MS = parseInt(process.env.DURATION_MS) || 60000; // 1 minute for accelerated test

// Test credentials for load testing - real admin credentials
const TEST_USER = {
  email: 'adminsimpix@simpix.com.br',
  password: 'agentsimpixpass'
};

// Sample proposal data for creation
const SAMPLE_PROPOSAL = {
  nomeCompleto: 'João da Silva Test',
  cpf: '12345678901',
  email: 'joao.test@example.com',
  telefone: '11999887766',
  valorSolicitado: 10000,
  prazo: 12,
  produto_id: 1,
  parceiro_id: 1
};

// Metrics collection
class MetricsCollector {
  constructor() {
    this.metrics = {
      http_req_duration: [],
      http_req_failed: 0,
      iterations: 0,
      total_requests: 0,
      auth_requests: 0,
      create_requests: 0,
      approve_requests: 0,
      queue_metrics_requests: 0
    };
    this.errors = [];
  }

  recordRequest(endpoint, duration, success, statusCode) {
    this.metrics.total_requests++;
    this.metrics.http_req_duration.push(duration);
    
    if (endpoint.includes('/auth/login')) this.metrics.auth_requests++;
    if (endpoint.includes('/propostas') && endpoint.split('/').length === 3) this.metrics.create_requests++;
    if (endpoint.includes('/approve')) this.metrics.approve_requests++;
    if (endpoint.includes('/monitoring/queues')) this.metrics.queue_metrics_requests++;
    
    if (!success) {
      this.metrics.http_req_failed++;
      this.errors.push({
        endpoint,
        statusCode,
        timestamp: new Date().toISOString()
      });
    }
  }

  recordIteration() {
    this.metrics.iterations++;
  }

  getStats() {
    const durations = this.metrics.http_req_duration.sort((a, b) => a - b);
    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length || 0;
    const p95Index = Math.floor(durations.length * 0.95);
    const p95 = durations[p95Index] || 0;
    const errorRate = (this.metrics.http_req_failed / this.metrics.total_requests) * 100 || 0;

    return {
      http_req_duration: {
        avg: Math.round(avg),
        p95: Math.round(p95),
        min: durations[0] || 0,
        max: durations[durations.length - 1] || 0
      },
      http_req_failed: this.metrics.http_req_failed,
      error_rate: parseFloat(errorRate.toFixed(2)),
      iterations: this.metrics.iterations,
      total_requests: this.metrics.total_requests,
      breakdown: {
        auth_requests: this.metrics.auth_requests,
        create_requests: this.metrics.create_requests,
        approve_requests: this.metrics.approve_requests,
        queue_metrics_requests: this.metrics.queue_metrics_requests
      },
      errors: this.errors
    };
  }
}

// HTTP Request wrapper with metrics
async function makeRequest(url, options = {}, metricsCollector) {
  const startTime = performance.now();
  let success = false;
  let statusCode = 0;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    statusCode = response.status;
    success = response.ok;
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    metricsCollector.recordRequest(url, duration, success, statusCode);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`❌ Request failed: ${response.status} ${response.statusText} - ${errorText}`);
      return { success: false, status: response.status, data: null };
    }
    
    const data = await response.json();
    return { success: true, status: response.status, data };
    
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    metricsCollector.recordRequest(url, duration, false, 0);
    console.error(`❌ Network error: ${error.message}`);
    return { success: false, status: 0, data: null, error: error.message };
  }
}

// Individual test scenario
async function runProposalFlow(userIndex, metricsCollector) {
  try {
    console.log(`🚀 [User ${userIndex}] Starting proposal flow...`);
    
    // Step 1: Authenticate
    const authResponse = await makeRequest(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify(TEST_USER)
    }, metricsCollector);
    
    if (!authResponse.success) {
      console.error(`❌ [User ${userIndex}] Authentication failed`);
      return false;
    }
    
    const token = authResponse.data?.session?.access_token;
    if (!token) {
      console.error(`❌ [User ${userIndex}] No token received`);
      console.log(`🔍 [DEBUG] Auth response:`, authResponse.data);
      return false;
    }
    
    console.log(`✅ [User ${userIndex}] Authenticated successfully`);
    console.log(`🔍 [DEBUG] Token length: ${token.length}, Token prefix: ${token.substring(0, 50)}...`);
    
    // Step 2: Create proposal
    const proposalData = {
      ...SAMPLE_PROPOSAL,
      cpf: `${Math.random().toString().substr(2, 11)}`, // Generate unique CPF
      email: `test${userIndex}-${Date.now()}@example.com`
    };
    
    const createResponse = await makeRequest(`${BASE_URL}/api/propostas`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(proposalData)
    }, metricsCollector);
    
    if (!createResponse.success) {
      console.error(`❌ [User ${userIndex}] Proposal creation failed - Status: ${createResponse.status}`);
      return false;
    }
    
    const proposalId = createResponse.data?.data?.id;
    if (!proposalId) {
      console.error(`❌ [User ${userIndex}] No proposal ID received`);
      console.log(`🔍 [DEBUG] Full create response:`, JSON.stringify(createResponse.data, null, 2));
      return false;
    }
    
    console.log(`✅ [User ${userIndex}] Proposal created with ID: ${proposalId}`);
    
    // Step 3: Approve proposal
    const approveResponse = await makeRequest(`${BASE_URL}/api/propostas/${proposalId}/approve`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        observacao: `Load test approval - User ${userIndex}`
      })
    }, metricsCollector);
    
    if (!approveResponse.success) {
      console.error(`❌ [User ${userIndex}] Proposal approval failed`);
      return false;
    }
    
    console.log(`✅ [User ${userIndex}] Proposal ${proposalId} approved successfully`);
    
    // Step 4: Check queue metrics (optional monitoring)
    await makeRequest(`${BASE_URL}/api/monitoring/queues/metrics`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, metricsCollector);
    
    metricsCollector.recordIteration();
    console.log(`🎯 [User ${userIndex}] Complete proposal flow finished successfully`);
    return true;
    
  } catch (error) {
    console.error(`❌ [User ${userIndex}] Flow error:`, error.message);
    return false;
  }
}

// Main load test execution
async function runLoadTest() {
  console.log(`🎯 OPERAÇÃO ESCUDO DE PRODUÇÃO - MISSÃO 3: VALIDAÇÃO DE CARGA`);
  console.log(`📊 Configuration:`);
  console.log(`   Target Iterations: ${TARGET_ITERATIONS}`);
  console.log(`   Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`   Test Duration: ${TEST_DURATION_MS}ms`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   SLA Targets: P95 < 500ms, Error Rate = 0%`);
  console.log(`\n🚀 Starting load test...\n`);
  
  const metricsCollector = new MetricsCollector();
  const startTime = Date.now();
  const workers = [];
  let completedIterations = 0;
  
  // Create worker pool
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    workers.push(async () => {
      let userIterations = 0;
      const maxIterationsPerUser = Math.ceil(TARGET_ITERATIONS / CONCURRENT_USERS);
      
      while (
        completedIterations < TARGET_ITERATIONS &&
        userIterations < maxIterationsPerUser &&
        (Date.now() - startTime) < TEST_DURATION_MS
      ) {
        const success = await runProposalFlow(i + 1, metricsCollector);
        if (success) {
          completedIterations++;
          userIterations++;
        }
        
        // Small delay between iterations to simulate real usage
        if (completedIterations < TARGET_ITERATIONS) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    });
  }
  
  // Execute all workers concurrently
  await Promise.all(workers.map(worker => worker()));
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  console.log(`\n🏁 Load test completed in ${totalDuration}ms\n`);
  
  return { metricsCollector, totalDuration };
}

// Report generation
function generateReport(metricsCollector, totalDuration) {
  const stats = metricsCollector.getStats();
  
  console.log(`📊 PROTOCOLO DE DIVULGAÇÃO TOTAL (PDT) V1.0 - RELATÓRIO FINAL`);
  console.log(`=================================================================`);
  console.log(`\n🎯 SLA COMPLIANCE CHECK:`);
  console.log(`   P95 Latency: ${stats.http_req_duration.p95}ms (Target: < 500ms) - ${stats.http_req_duration.p95 < 500 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Error Rate: ${stats.error_rate}% (Target: 0%) - ${stats.error_rate === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Iterations: ${stats.iterations}/${TARGET_ITERATIONS} - ${stats.iterations >= TARGET_ITERATIONS ? '✅ COMPLETE' : '⚠️ PARTIAL'}`);
  
  console.log(`\n📈 PERFORMANCE METRICS:`);
  console.log(`   http_req_duration:`);
  console.log(`     avg: ${stats.http_req_duration.avg}ms`);
  console.log(`     p(95): ${stats.http_req_duration.p95}ms`);
  console.log(`     min: ${stats.http_req_duration.min}ms`);
  console.log(`     max: ${stats.http_req_duration.max}ms`);
  console.log(`   http_req_failed: ${stats.http_req_failed}`);
  console.log(`   total_requests: ${stats.total_requests}`);
  console.log(`   test_duration: ${totalDuration}ms`);
  
  console.log(`\n🔍 REQUEST BREAKDOWN:`);
  console.log(`   Auth requests: ${stats.breakdown.auth_requests}`);
  console.log(`   Create requests: ${stats.breakdown.create_requests}`);
  console.log(`   Approve requests: ${stats.breakdown.approve_requests}`);
  console.log(`   Monitoring requests: ${stats.breakdown.queue_metrics_requests}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n❌ ERRORS DETECTED (${stats.errors.length}):`);
    stats.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.endpoint} - Status: ${error.statusCode} - Time: ${error.timestamp}`);
    });
  }
  
  // Final verdict
  const slaCompliant = stats.http_req_duration.p95 < 500 && stats.error_rate === 0;
  const testComplete = stats.iterations >= TARGET_ITERATIONS;
  
  console.log(`\n🏆 VEREDITO FINAL:`);
  if (slaCompliant && testComplete) {
    console.log(`✅ SISTEMA APROVADO para carga de 50 propostas/dia`);
    console.log(`✅ SLA de performance atendido`);
    console.log(`✅ Zero falhas registradas`);
    console.log(`✅ PRONTIDÃO PARA PRODUÇÃO: CERTIFICADA`);
  } else {
    console.log(`❌ SISTEMA REQUER OTIMIZAÇÃO`);
    if (!slaCompliant) {
      console.log(`❌ SLA de performance não atendido`);
    }
    if (stats.error_rate > 0) {
      console.log(`❌ Taxa de erro acima do aceitável`);
    }
    if (!testComplete) {
      console.log(`⚠️ Teste não completou todas as iterações`);
    }
  }
  
  console.log(`\n=================================================================`);
  
  return slaCompliant && testComplete;
}

// Script execution
async function main() {
  try {
    const { metricsCollector, totalDuration } = await runLoadTest();
    const success = generateReport(metricsCollector, totalDuration);
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error(`💥 Load test failed with error:`, error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runLoadTest, generateReport };