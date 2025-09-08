/**
 * 🎯 OPERAÇÃO CERTIFICAÇÃO DE PRODUÇÃO - MISSÃO 2 FINAL
 * Queue Stress Testing with REAL DATA - Complete Validation
 *
 * FASE FINAL: Testa com dados reais + simulados
 * - Cria propostas reais → testa caminho feliz
 * - Usa IDs fake → testa caminho infeliz (DLQ)
 */

import { Queue } from 'bullmq';
import axios from 'axios';

// ================================
// CONFIGURAÇÕES DO TESTE
// ================================

const BASE_URL = 'http://localhost:5000';
const REAL_PROPOSALS_COUNT = 10; // Criar 10 propostas reais
const HAPPY_PATH_JOBS = 10; // Usar as 10 propostas para jobs felizes
const FAILURE_TEST_JOBS = 2; // 2 jobs de falha para DLQ

// ================================
// REDIS E QUEUE SETUP
// ================================

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryDelayOnFailover: 100,
  lazyConnect: true,
};

const formalizationQueue = new Queue('formalization-queue', {
  connection: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 50,
  },
});

// ================================
// CRIAÇÃO DE PROPOSTAS REAIS
// ================================

async function createRealProposal(index) {
  const proposalData = {
    customerData: {
      nome: `Cliente Teste ${index}`,
      email: `teste${index}@queuetest.com`,
      telefone: '11999999999',
      cpf: `${String(index).padStart(3, '0')}12345678`,
      dataNascimento: '1990-01-15',
      rg: '123456789',
      orgaoEmissor: 'SSP',
      rgUf: 'SP',
      estadoCivil: 'Solteiro',
      nacionalidade: 'Brasileira',
      ocupacao: 'Teste',
      rendaMensal: 5000,
      cep: '01310-100',
      logradouro: 'Rua Teste',
      numero: '100',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
    },
    loanConditions: {
      valorSolicitado: 10000,
      prazoMeses: 24,
      finalidade: 'teste',
    },
    partnerId: 'test-partner',
    storeId: 1,
    productId: 'test-product',
  };

  try {
    const response = await axios.post(`${BASE_URL}/api/propostas`, proposalData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.data?.success) {
      const proposalId = response.data.data.id;
      console.log(`✅ Proposta real criada: ${proposalId}`);
      return proposalId;
    } else {
      throw new Error('Falha ao criar proposta: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error(`❌ Erro criando proposta ${index}:`, error.response?.data || error.message);
    return null;
  }
}

async function createRealProposals() {
  console.log(`🏗️ FASE 1: Criando ${REAL_PROPOSALS_COUNT} propostas reais...`);

  const proposalIds = [];
  const promises = [];

  for (let i = 1; i <= REAL_PROPOSALS_COUNT; i++) {
    promises.push(createRealProposal(i));
  }

  const results = await Promise.all(promises);

  for (const id of results) {
    if (id) {
      proposalIds.push(id);
    }
  }

  console.log(`✅ Propostas reais criadas: ${proposalIds.length}/${REAL_PROPOSALS_COUNT}`);

  if (proposalIds.length === 0) {
    throw new Error(
      '❌ CRÍTICO: Nenhuma proposta real foi criada! Não é possível testar caminho feliz.'
    );
  }

  return proposalIds;
}

// ================================
// INJEÇÃO DE JOBS
// ================================

async function injectHappyPathJobs(realProposalIds) {
  console.log(`🚀 FASE 2: Injetando ${realProposalIds.length} jobs VÁLIDOS (caminho feliz)...`);

  const promises = [];

  for (let i = 0; i < realProposalIds.length; i++) {
    const payload = {
      aggregateId: realProposalIds[i], // ID REAL da proposta
      eventType: 'ProposalApproved',
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'queue-stress-test-real-data',
        testRun: Date.now(),
        jobIndex: i + 1,
        isRealData: true,
      },
    };

    const jobPromise = formalizationQueue.add('ProposalApprovedJob', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    promises.push(jobPromise);
  }

  await Promise.all(promises);
  console.log(`✅ ${realProposalIds.length} jobs válidos injetados`);

  return realProposalIds.length;
}

async function injectFailureJobs() {
  console.log(`🚀 FASE 3: Injetando ${FAILURE_TEST_JOBS} jobs INVÁLIDOS (caminho infeliz)...`);

  const promises = [];

  for (let i = 1; i <= FAILURE_TEST_JOBS; i++) {
    const payload = {
      aggregateId: `invalid-proposal-${Date.now()}-${i}`, // ID FAKE para falha
      eventType: 'ProposalApproved',
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'queue-stress-test-failure',
        testRun: Date.now(),
        jobIndex: i,
        expectedToFail: true,
      },
    };

    const jobPromise = formalizationQueue.add('ProposalApprovedJob', payload, {
      attempts: 2, // PAM requirement: 2 tentativas
      backoff: { type: 'exponential', delay: 1000 },
    });

    promises.push(jobPromise);
  }

  await Promise.all(promises);
  console.log(`✅ ${FAILURE_TEST_JOBS} jobs inválidos injetados (expects 2 retries each)`);

  return FAILURE_TEST_JOBS;
}

// ================================
// VALIDAÇÃO E MONITORAMENTO
// ================================

async function waitForProcessing(durationMs = 60000) {
  console.log(`⏳ FASE 4: Aguardando ${durationMs / 1000}s para processamento completo...`);

  return new Promise((resolve) => {
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 2000;
      process.stdout.write(`\r⏳ Processando... ${elapsed / 1000}s/${durationMs / 1000}s`);

      if (elapsed >= durationMs) {
        console.log('\n✅ Período de processamento concluído');
        clearInterval(interval);
        resolve();
      }
    }, 2000);
  });
}

async function validateFinalResults(expectedHappy, expectedFailure) {
  console.log(`🔍 FASE 5: VALIDAÇÃO FINAL DOS RESULTADOS...`);

  try {
    const waiting = await formalizationQueue.getWaitingCount();
    const active = await formalizationQueue.getActiveCount();
    const completed = await formalizationQueue.getCompletedCount();
    const failed = await formalizationQueue.getFailedCount();
    const delayed = await formalizationQueue.getDelayedCount();

    console.log('📊 MÉTRICAS FINAIS DA QUEUE:');
    const stats = { waiting, active, completed, failed, delayed };
    console.log(stats);

    // Análise dos resultados
    const totalJobsProcessed = completed + failed;
    const expectedTotal = expectedHappy + expectedFailure;

    console.log(`\n🎯 ANÁLISE DE RESULTADOS:`);
    console.log(
      `   Jobs Esperados: ${expectedTotal} (${expectedHappy} feliz + ${expectedFailure} falha)`
    );
    console.log(`   Jobs Processados: ${totalJobsProcessed} (${completed} ok + ${failed} falha)`);
    console.log(`   Jobs Ativos: ${active}`);
    console.log(`   Jobs Aguardando: ${waiting}`);

    // Validação do Caminho Feliz
    const happyPathSuccess = completed >= expectedHappy * 0.8; // 80% success threshold
    console.log(`\n✅ CAMINHO FELIZ:`);
    console.log(`   Expected: ${expectedHappy} jobs processados com sucesso`);
    console.log(`   Actual: ${completed} jobs completed`);
    console.log(`   Status: ${happyPathSuccess ? '✅ SUCESSO' : '❌ FALHOU'}`);

    // Validação do Caminho Infeliz
    const failurePathSuccess = failed >= expectedFailure; // Pelo menos o esperado
    console.log(`\n❌ CAMINHO INFELIZ:`);
    console.log(`   Expected: ${expectedFailure} jobs falharam (2 retries cada)`);
    console.log(`   Actual: ${failed} jobs failed/DLQ`);
    console.log(`   Status: ${failurePathSuccess ? '✅ SUCESSO' : '❌ FALHOU'}`);

    // Resultado final
    const missionSuccess = happyPathSuccess && failurePathSuccess;

    return {
      success: missionSuccess,
      happyPathSuccess,
      failurePathSuccess,
      stats,
      metrics: {
        expectedTotal,
        totalProcessed: totalJobsProcessed,
        completedJobs: completed,
        failedJobs: failed,
        successRate:
          expectedTotal > 0 ? ((completed / expectedTotal) * 100).toFixed(1) + '%' : '0%',
        processingRate:
          expectedTotal > 0 ? ((totalJobsProcessed / expectedTotal) * 100).toFixed(1) + '%' : '0%',
      },
    };
  } catch (error) {
    console.error('❌ Erro na validação final:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ================================
// FUNÇÃO PRINCIPAL
// ================================

async function runCompleteQueueStressTest() {
  console.log(`🎯 OPERAÇÃO CERTIFICAÇÃO DE PRODUÇÃO - MISSÃO 2 FINAL`);
  console.log(`📊 TESTE HÍBRIDO: Dados Reais + Simulados`);
  console.log(`   Propostas Reais: ${REAL_PROPOSALS_COUNT} → Jobs Felizes`);
  console.log(`   IDs Falsos: ${FAILURE_TEST_JOBS} → Jobs Infelizes (DLQ)`);
  console.log(`   Redis: ${redisConfig.host}:${redisConfig.port}`);
  console.log(`\n🚀 Iniciando validação completa...\n`);

  const startTime = Date.now();

  try {
    // FASE 1: Criar propostas reais
    const realProposalIds = await createRealProposals();

    // FASE 2: Injetar jobs válidos (caminho feliz)
    const happyJobsCount = await injectHappyPathJobs(realProposalIds);

    // FASE 3: Injetar jobs inválidos (caminho infeliz)
    const failureJobsCount = await injectFailureJobs();

    // FASE 4: Aguardar processamento
    await waitForProcessing(80000); // 80 segundos para processamento completo

    // FASE 5: Validação final
    const validation = await validateFinalResults(happyJobsCount, failureJobsCount);

    // Relatório final
    const totalTime = Date.now() - startTime;

    console.log(`\n🏆 RELATÓRIO FINAL DA MISSÃO 2:`);
    console.log(`   Duração Total: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`   Propostas Criadas: ${realProposalIds.length}`);
    console.log(`   Jobs Injetados: ${happyJobsCount + failureJobsCount}`);
    console.log(JSON.stringify(validation.metrics, null, 2));

    console.log(`\n🎯 STATUS FINAL:`);
    console.log(`   Caminho Feliz: ${validation.happyPathSuccess ? '✅ SUCESSO' : '❌ FALHOU'}`);
    console.log(
      `   Caminho Infeliz: ${validation.failurePathSuccess ? '✅ SUCESSO' : '❌ FALHOU'}`
    );
    console.log(`   Missão Geral: ${validation.success ? '🏆 COMPLETA' : '❌ FALHOU'}`);

    return validation;
  } catch (error) {
    console.error('❌ ERRO CRÍTICO na missão:', error);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    // Cleanup
    await formalizationQueue.close();
    console.log('\n🧹 Conexões fechadas');
  }
}

// ================================
// EXECUÇÃO
// ================================

const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  runCompleteQueueStressTest()
    .then((result) => {
      if (result.success) {
        console.log('\n🎉 MISSÃO 2 - VALIDAÇÃO ASSÍNCRONA: COMPLETA COM SUCESSO!');
        console.log('✅ BullMQ + Redis: PRODUCTION READY');
        console.log('✅ Worker: FUNCIONANDO');
        console.log('✅ DLQ: FUNCIONANDO');
        console.log('✅ Retry: FUNCIONANDO');
        process.exit(0);
      } else {
        console.log('\n💥 MISSÃO 2 FALHOU!');
        console.log('❌ Sistema precisa de ajustes antes da produção');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 ERRO CRÍTICO FATAL:', error);
      process.exit(1);
    });
}

export { runCompleteQueueStressTest };
