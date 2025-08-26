/**
 * Testes de Integração para API de Propostas DDD
 * PAM V1.0 - Suíte de testes para validar a nova arquitetura DDD da API de Propostas
 *
 * Executa testes de ponta a ponta validando os endpoints principais da nova API
 * que agora opera sob arquitetura Domain-Driven Design com Controller + Use Cases.
 *
 * @file tests/integration/proposal-api.test.ts
 * @created 2025-08-21 - PAM V1.0 Testes de Integração API Refatorada
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../server/app';
import { db } from '../../server/lib/supabase';
import { propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { cleanTestDatabase, setupTestEnvironment } from '../lib/db-helper';
import { loginTestUser, deleteTestUser, type TestUser } from '../helpers/auth-helper';
import request from 'supertest';

describe('Proposal API Integration Tests - DDD Architecture', () => {
  // TRIPLA PROTEÇÃO CONTRA EXECUÇÃO EM PRODUÇÃO - PAM V1.0 FORENSE
  beforeAll(() => {
    // Proteção 1: NODE_ENV deve ser 'test'
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        `FATAL: NODE_ENV='${process.env.NODE_ENV}' deve ser 'test'. Testes bloqueados para proteger dados.`
      );
    }

    // Proteção 2: TEST_DATABASE_URL deve estar configurado
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error('FATAL: TEST_DATABASE_URL não configurado. Use um banco de teste dedicado.');
    }

    // Proteção 3: Rejeitar padrões de produção
    const prodPatterns = ['prod', 'production', 'azure', 'live'];
    const dbUrl = process.env.DATABASE_URL?.toLowerCase() || '';
    if (prodPatterns.some((p) => dbUrl.includes(p))) {
      throw new Error(`FATAL: DATABASE_URL parece ser de produção. Operação abortada.`);
    }
  });

  let app: Express;
  let accessToken: string;
  let testUserId: string;
  let testEmail: string;
  let testPassword: string;
  let testStoreId: number;
  let testProductId: number;
  let testCommercialTableId: number;

  beforeEach(async () => {
    console.log('[PROPOSAL API] 🧹 Setting up test environment...');

    // Initialize Express app
    app = await createApp();

    // Setup database test environment
    await cleanTestDatabase();
    const testData = await setupTestEnvironment();

    testUserId = testData.testUserId;
    testEmail = testData.testEmail;
    testPassword = testData.testPassword;
    testStoreId = testData.testStoreId;
    testProductId = testData.testProductId;
    testCommercialTableId = testData.testCommercialTableId;

    // Use the ACTUAL test user created in setupTestEnvironment for authentication
    const existingTestUser: TestUser = {
      id: testUserId,
      email: testEmail, // CORRECTED: Use actual email from setup
      password: testPassword, // CORRECTED: Use actual password from setup
      name: 'Integration Test User',
      role: 'ATENDENTE',
    };

    console.log(`[PROPOSAL API] 🔗 Using test user: ${existingTestUser.email} (ID: ${testUserId})`);

    // Login and get access token
    accessToken = await loginTestUser(app, existingTestUser);

    console.log(`[PROPOSAL API] ✅ Test environment ready`);
  });

  afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId);
    }
    console.log('[PROPOSAL API] 🧹 Test cleanup completed');
  });

  describe('Cenário 1: Criação de Proposta - Sucesso', () => {
    it('deve criar uma proposta válida e retornar 201 Created', async () => {
      // ARRANGE: Preparar payload válido
      const validProposal = {
        // Dados pessoais obrigatórios
        clienteNome: 'João Silva Santos',
        clienteCpf: '111.444.777-35', // CPF válido para testes
        clienteRg: '12345678',
        clienteDataNascimento: '1985-05-15',
        clienteTelefone: '(11) 99999-9999',
        clienteEmail: 'joao.silva@email.com',

        // Endereço
        clienteCep: '01234-567',
        clienteEndereco: 'Rua das Flores, 123',
        clienteBairro: 'Centro',
        clienteCidade: 'São Paulo',
        clienteUf: 'SP',

        // Dados do empréstimo
        valor: '5000.00',
        prazo: 12,
        finalidade: 'Capital de giro',
        garantia: 'Sem garantia',

        // Status inicial
        status: 'pendente',

        // Relacionamentos
        lojaId: testStoreId,
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
      };

      console.log('[PROPOSAL API] 📝 Enviando proposta válida...');

      // ACT: Fazer requisição POST para criar proposta
      const response = await request(app)
        .post('/api/propostas')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validProposal)
        .expect(201);

      console.log(`[PROPOSAL API] ✅ Resposta recebida:`, response.body);

      // ASSERT: Verificar resposta da API
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');

      // ASSERT: Verificar persistência no banco de dados
      const createdProposalId = response.body.data.id;

      console.log(`[PROPOSAL API] 🔍 Validando persistência no banco - ID: ${createdProposalId}`);

      const [databaseRecord] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, createdProposalId));

      expect(databaseRecord).toBeDefined();
      expect(databaseRecord.clienteNome).toBe(validProposal.clienteNome);
      expect(databaseRecord.clienteCpf).toBe(validProposal.clienteCpf);
      expect(String(databaseRecord.valor)).toBe(validProposal.valor);
      expect(databaseRecord.prazo).toBe(validProposal.prazo);
      expect(databaseRecord.status).toBe('rascunho');

      console.log('[PROPOSAL API] ✅ Proposta criada e persistida com sucesso!');
    });
  });

  describe('Cenário 2: Criação de Proposta - Falha de Validação', () => {
    it('deve rejeitar proposta inválida e retornar 400 Bad Request', async () => {
      // ARRANGE: Preparar payload inválido
      const invalidProposal = {
        clienteNome: 'João Silva', // Nome válido
        clienteCpf: '123.456.789-00', // CPF válido
        valor: '-1000.00', // ❌ VALOR NEGATIVO - deve causar erro
        prazo: -5, // ❌ PRAZO NEGATIVO - deve causar erro
        status: 'pendente',
      };

      console.log('[PROPOSAL API] ⚠️ Enviando proposta inválida...');

      // ACT: Fazer requisição POST com dados inválidos
      const response = await request(app)
        .post('/api/propostas')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidProposal);

      console.log(`[PROPOSAL API] 📋 Resposta de validação:`, {
        status: response.status,
        body: response.body,
      });

      // ASSERT: Verificar resposta de erro
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      // Verificar que a mensagem de erro menciona os problemas de validação
      const errorMessage = response.body.error || response.body.message || '';
      const errorLowerCase = errorMessage.toLowerCase();

      // Deve mencionar problemas com valor ou prazo
      const hasValidationError =
        errorLowerCase.includes('valor') ||
        errorLowerCase.includes('prazo') ||
        errorLowerCase.includes('invalid') ||
        errorLowerCase.includes('validation');

      expect(hasValidationError).toBe(true);

      console.log('[PROPOSAL API] ✅ Validação rejeitou proposta inválida corretamente!');
    });
  });

  describe('Cenário 3: Busca de Proposta', () => {
    it('deve buscar proposta existente por ID e retornar 200 OK', async () => {
      // ARRANGE: Primeiro criar uma proposta
      const testProposal = {
        clienteNome: 'Maria Santos Silva',
        clienteCpf: '987.654.321-00',
        clienteRg: '87654321',
        clienteDataNascimento: '1990-03-20',
        clienteTelefone: '(11) 88888-8888',
        clienteEmail: 'maria.santos@email.com',
        clienteCep: '04567-890',
        clienteEndereco: 'Av. Principal, 456',
        clienteBairro: 'Jardim São Paulo',
        clienteCidade: 'São Paulo',
        clienteUf: 'SP',
        valor: '3000.00',
        prazo: 18,
        finalidade: 'Reforma residencial',
        garantia: 'Sem garantia',
        status: 'pendente',
        lojaId: testStoreId,
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
      };

      console.log('[PROPOSAL API] 📝 Criando proposta para teste de busca...');

      const createResponse = await request(app)
        .post('/api/propostas')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(testProposal)
        .expect(201);

      const createdProposalId = createResponse.body.id;
      console.log(`[PROPOSAL API] ✅ Proposta criada com ID: ${createdProposalId}`);

      // ACT: Buscar a proposta criada por ID
      console.log(`[PROPOSAL API] 🔍 Buscando proposta por ID: ${createdProposalId}`);

      const getResponse = await request(app)
        .get(`/api/propostas/${createdProposalId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      console.log('[PROPOSAL API] 📋 Proposta encontrada:', getResponse.body);

      // ASSERT: Verificar dados retornados
      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toHaveProperty('id', createdProposalId);
      expect(getResponse.body.clienteNome).toBe(testProposal.clienteNome);
      expect(getResponse.body.clienteCpf).toBe(testProposal.clienteCpf);
      expect(getResponse.body.valor).toBe(testProposal.valor);
      expect(getResponse.body.prazo).toBe(testProposal.prazo);
      expect(getResponse.body.status).toBe('pendente');

      console.log('[PROPOSAL API] ✅ Busca por ID funcionou corretamente!');
    });

    it('deve retornar 404 para proposta inexistente', async () => {
      // ARRANGE: ID inexistente
      const nonExistentId = '999999-nonexistent-id';

      console.log(`[PROPOSAL API] 🔍 Buscando proposta inexistente: ${nonExistentId}`);

      // ACT: Tentar buscar proposta inexistente
      const response = await request(app)
        .get(`/api/propostas/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      console.log(`[PROPOSAL API] 📋 Resposta para ID inexistente:`, {
        status: response.status,
        body: response.body,
      });

      // ASSERT: Deve retornar 404 Not Found
      expect(response.status).toBe(404);

      console.log('[PROPOSAL API] ✅ Retornou 404 para proposta inexistente!');
    });
  });
});
