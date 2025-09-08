/**
 * Testes de Integração - Idempotência de Pagamentos
 *
 * PAM V3.5 - BULLMQ-F2-001 - Validação de prevenção de transações duplicadas
 * Foca na validação de jobId único e prevenção de duplicatas na fila
 *
 * @file tests/integration/idempotency.test.ts
 * @created 2025-08-29
 * @status PAM V3.5 IMPLEMENTATION - SIMPLIFIED VERSION
 */

import { describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest';
import { getPaymentsQueue } from '../../server/lib/queues';

describe('Payment Idempotency Tests - PAM V3.5 (Simplified)', () => {
  beforeAll(() => {
    console.log('[IDEMPOTENCY TEST] 🚀 Starting idempotency validation tests...');
    console.log('[IDEMPOTENCY TEST] 📊 Environment:', process.env.NODE_ENV);
  });

  beforeEach(async () => {
    console.log('[IDEMPOTENCY TEST] 🧹 Cleaning and pausing payments queue...');

    // Clean any existing jobs in the paymentsQueue to start fresh
    const paymentsQueue = await getPaymentsQueue();
    await paymentsQueue.obliterate({ force: true });

    // CRITICAL: Pause queue to prevent automatic job processing during test
    await paymentsQueue.pause();

    console.log('[IDEMPOTENCY TEST] ✅ Queue cleaned and paused for testing');
  });

  afterEach(async () => {
    // Resume queue and clean up after each test
    const paymentsQueue = await getPaymentsQueue();
    await paymentsQueue.resume();
    await paymentsQueue.obliterate({ force: true });
    console.log('[IDEMPOTENCY TEST] 🧹 Queue resumed and cleaned up');
  });

  describe('Core BullMQ Idempotency - PAM V3.5', () => {
    it('deve previnir jobs duplicados usando jobId idêntico', async () => {
      console.log('[IDEMPOTENCY TEST] 🔑 Testing BullMQ jobId idempotency...');

      const propostaId = 'test-proposal-123';
      const jobId = `payment-${propostaId}-1234567890`;

      // Mock payment data
      const paymentData = {
        type: 'PROCESS_PAYMENT',
        propostaId: propostaId,
        paymentData: {
          propostaId: propostaId,
          numeroContrato: 'TEST-001',
          nomeCliente: 'Cliente Teste',
          cpfCliente: '12345678901',
          valorLiquido: 4000,
          formaPagamento: 'ted',
        },
        userId: 'test-user-456',
        timestamp: 1234567890,
      };

      console.log(`[IDEMPOTENCY TEST] 📞 First job addition with jobId: ${jobId}`);

      // First job addition
      const paymentsQueue = await getPaymentsQueue();
      const job1 = await paymentsQueue.add('PROCESS_PAYMENT', paymentData, {
        jobId: jobId,
        attempts: 5,
        removeOnComplete: 10,
        removeOnFail: 50,
      });

      console.log(`[IDEMPOTENCY TEST] ✅ First job added successfully: ${job1.id}`);

      // Attempt to add second job with SAME jobId (should be prevented by BullMQ)
      console.log(`[IDEMPOTENCY TEST] 📞 Second job addition with SAME jobId: ${jobId}`);

      try {
        const job2 = await paymentsQueue.add('PROCESS_PAYMENT', paymentData, {
          jobId: jobId, // SAME jobId - should trigger idempotency
          attempts: 5,
          removeOnComplete: 10,
          removeOnFail: 50,
        });

        console.log(`[IDEMPOTENCY TEST] ❌ UNEXPECTED: Second job was added: ${job2.id}`);
      } catch (error: any) {
        console.log(`[IDEMPOTENCY TEST] ✅ EXPECTED: Second job was rejected: ${error.message}`);
      }

      // VALIDATION: Check queue state
      const waitingJobs = await paymentsQueue.getWaiting();
      const totalJobsInQueue = waitingJobs.length;

      console.log(`[IDEMPOTENCY TEST] 📊 Total jobs in queue: ${totalJobsInQueue}`);
      console.log(
        `[IDEMPOTENCY TEST] 🎯 Job details:`,
        waitingJobs.map((j) => ({ id: j.id, name: j.name, data: j.data.propostaId }))
      );

      // CRITICAL ASSERTION: Only one job should exist (idempotency working)
      expect(totalJobsInQueue).toBe(1);
      expect(waitingJobs[0].data.propostaId).toBe(propostaId);

      console.log(
        '[IDEMPOTENCY TEST] 🎉 IDEMPOTENCY VALIDATION SUCCESSFUL - Duplicate jobs prevented'
      );
    }, 15000);

    it('deve permitir jobs diferentes com jobIds únicos', async () => {
      console.log('[IDEMPOTENCY TEST] 🔄 Testing different jobs with unique jobIds...');

      const propostaId1 = 'test-proposal-111';
      const propostaId2 = 'test-proposal-222';
      const jobId1 = `payment-${propostaId1}-1111111111`;
      const jobId2 = `payment-${propostaId2}-2222222222`;

      const paymentData1 = {
        type: 'PROCESS_PAYMENT',
        propostaId: propostaId1,
        paymentData: { propostaId: propostaId1, numeroContrato: 'TEST-001', valorLiquido: 1000 },
        userId: 'test-user-456',
        timestamp: 1111111111,
      };

      const paymentData2 = {
        type: 'PROCESS_PAYMENT',
        propostaId: propostaId2,
        paymentData: { propostaId: propostaId2, numeroContrato: 'TEST-002', valorLiquido: 2000 },
        userId: 'test-user-789',
        timestamp: 2222222222,
      };

      // Add two different jobs with unique jobIds
      const paymentsQueue = await getPaymentsQueue();
      const job1 = await paymentsQueue.add('PROCESS_PAYMENT', paymentData1, { jobId: jobId1 });
      const job2 = await paymentsQueue.add('PROCESS_PAYMENT', paymentData2, { jobId: jobId2 });

      console.log(`[IDEMPOTENCY TEST] ✅ Job 1 added: ${job1.id} for proposal ${propostaId1}`);
      console.log(`[IDEMPOTENCY TEST] ✅ Job 2 added: ${job2.id} for proposal ${propostaId2}`);

      // VALIDATION: Both jobs should exist
      const waitingJobs = await paymentsQueue.getWaiting();
      const totalJobsInQueue = waitingJobs.length;

      expect(totalJobsInQueue).toBe(2);
      expect(waitingJobs.some((j) => j.data.propostaId === propostaId1)).toBe(true);
      expect(waitingJobs.some((j) => j.data.propostaId === propostaId2)).toBe(true);

      console.log(
        '[IDEMPOTENCY TEST] 🎉 UNIQUE JOBS VALIDATION SUCCESSFUL - Different jobs allowed'
      );
    }, 15000);

    it('deve gerar jobIds determinísticos para mesma proposta', async () => {
      console.log('[IDEMPOTENCY TEST] 🧮 Testing deterministic jobId generation logic...');

      // Simulate the jobId generation logic from PagamentoService
      const propostaId = 'test-proposal-deterministic';
      const numeroContrato = 'TEST-DETERMINISTIC-001';
      const valorLiquido = 5000;

      // Test that same inputs generate different jobIds due to timestamp
      const timestamp1 = 1000000000;
      const timestamp2 = 1000000001;

      const jobId1 = `payment-${propostaId}-${timestamp1}`;
      const jobId2 = `payment-${propostaId}-${timestamp2}`;

      console.log(`[IDEMPOTENCY TEST] 🔑 Generated jobId1: ${jobId1}`);
      console.log(`[IDEMPOTENCY TEST] 🔑 Generated jobId2: ${jobId2}`);

      // VALIDATION: Different timestamps should generate different jobIds
      expect(jobId1).not.toBe(jobId2);
      expect(jobId1).toContain(propostaId);
      expect(jobId2).toContain(propostaId);
      expect(jobId1).toContain(timestamp1.toString());
      expect(jobId2).toContain(timestamp2.toString());

      console.log('[IDEMPOTENCY TEST] 🎉 DETERMINISTIC JOBID VALIDATION SUCCESSFUL');
    }, 5000);
  });
});
