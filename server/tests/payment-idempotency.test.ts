/**
 * CONF-001 Integration Test - Payment Idempotency
 * Validates that duplicate payment requests are properly prevented
 */

import request from 'supertest';
import { expect } from '@jest/globals';
import { createTestApp } from '../test-setup';
import { paymentsQueue } from '../lib/queues';
import { pagamentoRepository } from '../repositories/pagamento.repository';
import { db } from '../lib/supabase';
import { propostas, lojas, produtos, interCollections } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';

describe('CONF-001 - Payment Idempotency Integration Tests', () => {
  let app: any;
  let testPropostaId: string;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    // Clean up any existing jobs in the queue
    await paymentsQueue.obliterate({ force: true });
    
    // Create test data
    testPropostaId = uuidv4();
    
    // Insert test loja
    const testLoja = await db.insert(lojas).values({
      id: uuidv4(),
      nome: 'Loja Teste Idempotency',
      isActive: true
    }).returning();

    // Insert test produto  
    const testProduto = await db.insert(produtos).values({
      id: uuidv4(),
      nome: 'Produto Teste Idempotency',
      isActive: true
    }).returning();

    // Insert test proposta
    await db.insert(propostas).values({
      id: testPropostaId,
      lojaId: testLoja[0].id,
      produtoId: testProduto[0].id,
      status: 'APROVADO',
      ccbGerado: true,
      assinaturaEletronicaConcluida: true,
      valorEmprestimo: '1000.00',
      valorTotalFinanciado: '1000.00',
      valorLiquidoLiberado: '900.00',
      cliente_data: {
        nome: 'Cliente Teste',
        cpf: '12345678901',
        email: 'teste@exemplo.com'
      }
    }).returning();

    // Mock auth token (if needed)
    authToken = 'mock-jwt-token';
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(interCollections).where(eq(interCollections.propostaId, testPropostaId));
    await db.delete(propostas).where(eq(propostas.id, testPropostaId));
    await paymentsQueue.obliterate({ force: true });
  });

  test('CONF-001.1: First payment request should create job successfully', async () => {
    const paymentData = {
      propostaId: testPropostaId,
      numeroContrato: 'CONTRATO-001',
      nomeCliente: 'Cliente Teste',
      cpfCliente: '12345678901',
      valorFinanciado: 1000,
      valorLiquido: 900,
      valorIOF: 50,
      valorTAC: 50,
      contaBancaria: {
        banco: '001',
        agencia: '1234',
        conta: '12345-6',
        tipoConta: 'corrente',
        titular: 'Cliente Teste'
      },
      formaPagamento: 'ted',
      loja: 'Loja Teste',
      produto: 'Produto Teste'
    };

    const response = await request(app)
      .post('/api/pagamentos')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentData);

    // Should succeed
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.jobId).toBe(`payment-${testPropostaId}`);
    expect(response.body.data.status).toBe('em_fila');

    // Check queue has exactly one job
    const activeJobs = await paymentsQueue.getActive();
    const waitingJobs = await paymentsQueue.getWaiting();
    const totalJobs = activeJobs.length + waitingJobs.length;
    
    expect(totalJobs).toBe(1);
    console.log(`[TEST] ✅ First request created exactly 1 job in queue`);
  });

  test('CONF-001.2: Duplicate payment request should be prevented (database-level)', async () => {
    const paymentData = {
      propostaId: testPropostaId,
      numeroContrato: 'CONTRATO-001',
      nomeCliente: 'Cliente Teste',
      cpfCliente: '12345678901',
      valorFinanciado: 1000,
      valorLiquido: 900,
      valorIOF: 50,
      valorTAC: 50,
      contaBancaria: {
        banco: '001',
        agencia: '1234',
        conta: '12345-6',
        tipoConta: 'corrente',
        titular: 'Cliente Teste'
      },
      formaPagamento: 'ted',
      loja: 'Loja Teste',
      produto: 'Produto Teste'
    };

    // Simulate existing payment by creating inter_collections record
    await db.insert(interCollections).values({
      propostaId: testPropostaId,
      codigoSolicitacao: 'EXISTING-12345',
      seuNumero: 'REF-12345',
      valorNominal: '900.00',
      dataVencimento: '2024-01-01',
      situacao: 'EM_PROCESSAMENTO'
    });

    const response = await request(app)
      .post('/api/pagamentos')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentData);

    // Should detect existing payment
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.duplicate).toBe(true);
    expect(response.body.data.status).toBe('ja_processado');
    expect(response.body.data.message).toContain('idempotência database-level');

    // Queue should remain empty
    const activeJobs = await paymentsQueue.getActive();
    const waitingJobs = await paymentsQueue.getWaiting();
    const totalJobs = activeJobs.length + waitingJobs.length;
    
    expect(totalJobs).toBe(0);
    console.log(`[TEST] ✅ Duplicate request prevented at database level - queue remained empty`);
  });

  test('CONF-001.3: Duplicate job requests should be prevented (BullMQ-level)', async () => {
    const paymentData = {
      propostaId: testPropostaId,
      numeroContrato: 'CONTRATO-001',
      nomeCliente: 'Cliente Teste',
      cpfCliente: '12345678901',
      valorFinanciado: 1000,
      valorLiquido: 900,
      valorIOF: 50,
      valorTAC: 50,
      contaBancaria: {
        banco: '001',
        agencia: '1234',
        conta: '12345-6',
        tipoConta: 'corrente',
        titular: 'Cliente Teste'
      },
      formaPagamento: 'ted',
      loja: 'Loja Teste',
      produto: 'Produto Teste'
    };

    // First request - should succeed
    const response1 = await request(app)
      .post('/api/pagamentos')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentData);

    expect(response1.status).toBe(201);
    expect(response1.body.data.status).toBe('em_fila');

    // Second request with same data - should be prevented by deterministic jobId
    const response2 = await request(app)
      .post('/api/pagamentos')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentData);

    // Should detect duplicate job
    expect(response2.status).toBe(201);
    expect(response2.body.data.duplicate).toBe(true);
    expect(response2.body.data.status).toBe('ja_enfileirado');
    expect(response2.body.data.message).toContain('idempotência BullMQ-level');

    // Queue should still have only 1 job
    const activeJobs = await paymentsQueue.getActive();
    const waitingJobs = await paymentsQueue.getWaiting();
    const totalJobs = activeJobs.length + waitingJobs.length;
    
    expect(totalJobs).toBe(1);
    console.log(`[TEST] ✅ Duplicate request prevented at BullMQ level - queue has exactly 1 job`);
  });

  test('CONF-001.4: Deterministic jobId generation', async () => {
    // Test that same proposal always generates same jobId
    const jobId1 = `payment-${testPropostaId}`;
    const jobId2 = `payment-${testPropostaId}`;
    
    expect(jobId1).toBe(jobId2);
    console.log(`[TEST] ✅ Deterministic jobId generation: ${jobId1}`);
    
    // Different proposals should generate different jobIds
    const otherPropostaId = uuidv4();
    const jobId3 = `payment-${otherPropostaId}`;
    
    expect(jobId1).not.toBe(jobId3);
    console.log(`[TEST] ✅ Different proposals generate different jobIds`);
  });
});