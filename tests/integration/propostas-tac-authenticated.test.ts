/**
 * Testes de Integração TAC - Autenticados e Funcionais
 * PAM V1.1 - Suite completa de testes autenticados para fluxo TAC
 *
 * Executa testes de ponta a ponta da lógica de TAC com autenticação real,
 * validando tanto via API quanto consulta direta ao banco de dados.
 *
 * @file tests/integration/propostas-tac-authenticated.test.ts
 * @created 2025-08-20 - PAM V1.1 após correção de infraestrutura
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../server/app';
import { db } from '../../server/lib/supabase';
import { produtos, propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { cleanTestDatabase, setupTestEnvironment } from '../lib/db-helper';
import {
  createAuthenticatedTestClient,
  loginTestUser,
  deleteTestUser,
  type AuthenticatedTestClient,
  type TestUser,
} from '../helpers/auth-helper';
import request from 'supertest';

describe('TAC Integration Tests - Authenticated & Validated', () => {
  // TRIPLA PROTEÇÃO CONTRA EXECUÇÃO EM PRODUÇÃO - PAM V1.0 FORENSE
  beforeAll(() => {
    // Proteção 1: NODE_ENV deve ser 'test'
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        `FATAL: NODE_ENV='${process.env.NODE_ENV}' deve ser 'test'. Testes bloqueados para proteger dados.`
      );
    }

    // Proteção 2: DATABASE_URL deve conter 'test'
    if (!process.env.DATABASE_URL?.includes('test')) {
      throw new Error('FATAL: DATABASE_URL não contém "test". Use um banco de teste dedicado.');
    }

    // Proteção 3: Rejeitar padrões de produção
    const prodPatterns = ['prod', 'production', 'azure', 'live'];
    const dbUrl = process.env.DATABASE_URL?.toLowerCase() || '';
    if (prodPatterns.some((p) => dbUrl.includes(p))) {
      throw new Error(`FATAL: DATABASE_URL parece ser de produção. Operação abortada.`);
    }
  });

  let app: Express;
  let authenticatedClient: AuthenticatedTestClient;
  let testProductId: number;
  let testUserId: string;
  let testStoreId: number;
  let testCommercialTableId: number;

  beforeEach(async () => {
    console.log('[TAC AUTH] 🧹 Setting up authenticated test environment...');

    // Initialize Express app
    app = await createApp();

    // Setup database test environment
    await cleanTestDatabase();
    const testData = await setupTestEnvironment();

    testProductId = testData.testProductId;
    testUserId = testData.testUserId;
    testStoreId = testData.testStoreId;
    testCommercialTableId = testData.testCommercialTableId;

    // Use the existing test user from setupTestEnvironment for authentication
    // This avoids creating duplicate users and ensures JWT middleware can find the profile
    const existingTestUser: TestUser = {
      id: testUserId,
      email: 'test@simpix.com', // Same as setupTestEnvironment
      password: 'TestPassword123!',
      name: 'Integration Test User',
      role: 'ATENDENTE',
    };

    console.log(
      `[TAC AUTH] 🔗 Using existing test user: ${existingTestUser.email} (ID: ${testUserId})`
    );

    // Login with the existing user and create authenticated client
    const accessToken = await loginTestUser(app, existingTestUser);

    // Create authenticated client using the helper pattern
    const createAuthenticatedRequest = (method: string) => (url: string) => {
      return (request(app) as any)[method](url).set('Authorization', `Bearer ${accessToken}`);
    };

    authenticatedClient = {
      request,
      app,
      user: existingTestUser,
      accessToken,
      get: createAuthenticatedRequest('get'),
      post: createAuthenticatedRequest('post'),
      put: createAuthenticatedRequest('put'),
      patch: createAuthenticatedRequest('patch'),
      delete: createAuthenticatedRequest('delete'),
    };

    console.log(`[TAC AUTH] ✅ Authenticated environment ready - Product ID: ${testProductId}`);
  });

  afterEach(async () => {
    if (authenticatedClient?.user?.id) {
      await deleteTestUser(authenticatedClient.user.id);
    }
    console.log('[TAC AUTH] 🧹 Test cleanup completed');
  });

  describe('Cenário 1: Cliente Novo Paga TAC (Autenticado)', () => {
    it('deve calcular TAC fixa R$ 180,00 para cliente novo via API autenticada', async () => {
      // SETUP: Configurar produto com TAC fixa de R$ 180,00
      await db
        .update(produtos)
        .set({
          tacValor: '180.00',
          tacTipo: 'fixo',
        })
        .where(eq(produtos.id, testProductId));

      console.log('[TAC AUTH] 🔧 Produto configurado: TAC R$ 180,00 fixa');

      // ARRANGE: Dados da proposta para cliente novo
      const clienteCpfNovo = '12345678901'; // Cliente novo
      const proposalData = {
        valor: 15000,
        prazo: 24,
        taxaJuros: 2.2,
        clienteNome: 'João Silva Auth',
        clienteCpf: clienteCpfNovo,
        clienteTelefone: '11999887766',
        clienteEmail: 'joao.auth@teste.com',
        clienteRenda: '12000.00',
        clienteDividasExistentes: '2000.00',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        finalidade: 'Reforma residencial',
        garantia: 'Nenhuma',
      };

      console.log('[TAC AUTH] 📋 Dados da proposta:');
      console.log(`  - Cliente: ${proposalData.clienteNome}`);
      console.log(`  - CPF: ${proposalData.clienteCpf} (novo cliente)`);
      console.log(`  - Valor: R$ ${proposalData.valor.toLocaleString()}`);
      console.log(`  - User autenticado: ${authenticatedClient.user.email}`);

      // ACT: Executar POST HTTP autenticado
      const response = await authenticatedClient
        .post('/api/propostas')
        .send(proposalData)
        .expect(201);

      console.log('[TAC AUTH] 🚀 POST /api/propostas executado com autenticação');

      // VALIDAÇÃO 1: Resposta HTTP deve conter proposta criada
      console.log('[TAC AUTH] 📋 Response body:', JSON.stringify(response.body, null, 2));

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('valor_tac');

      const propostaId = response.body.id;
      console.log(`[TAC AUTH] 📄 Proposta criada: ID ${propostaId}`);

      // VALIDAÇÃO 2: Consulta direta ao banco de dados (CRÍTICA)
      const propostaNoBanco = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      expect(propostaNoBanco.length).toBe(1);

      const proposta = propostaNoBanco[0];
      const valorTacBanco = parseFloat(proposta.valorTac || '0');

      console.log(`[TAC AUTH] 💰 TAC no banco: R$ ${valorTacBanco.toFixed(2)}`);

      // VALIDAÇÃO CRÍTICA: TAC fixa de R$ 180,00 deve estar no banco
      expect(valorTacBanco).toBe(180.0);
      expect(proposta.clienteCpf).toBe(clienteCpfNovo);
      expect(proposta.valor).toBe('15000.00');

      console.log('[TAC AUTH] ✅ CENÁRIO 1 SUCESSO - Cliente novo paga TAC R$ 180,00');
    });

    it('deve calcular TAC percentual 2.5% para cliente novo via API autenticada', async () => {
      // SETUP: TAC percentual de 2.5%
      await db
        .update(produtos)
        .set({
          tacValor: '2.5',
          tacTipo: 'percentual',
        })
        .where(eq(produtos.id, testProductId));

      console.log('[TAC AUTH] 📊 TAC percentual: 2.5%');

      const valorEmprestimo = 20000; // 2.5% de R$ 20.000 = R$ 500,00
      const clienteCpfNovo = '98765432100';

      const proposalData = {
        valor: valorEmprestimo,
        prazo: 36,
        taxaJuros: 1.9,
        clienteNome: 'Maria Santos Auth',
        clienteCpf: clienteCpfNovo,
        clienteTelefone: '11888776655',
        clienteEmail: 'maria.auth@teste.com',
        clienteRenda: '18000.00',
        clienteDividasExistentes: '3000.00',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        finalidade: 'Capital de giro',
        garantia: 'Nenhuma',
      };

      console.log(`[TAC AUTH] 🧮 Valor: R$ ${valorEmprestimo.toLocaleString()}`);
      console.log('  TAC esperada: 2.5% = R$ 500,00');

      // ACT: POST HTTP autenticado
      const response = await authenticatedClient
        .post('/api/propostas')
        .send(proposalData)
        .expect(201);

      const propostaId = response.body.id;

      // VALIDAÇÃO: Consulta direta ao banco
      const propostaNoBanco = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      const proposta = propostaNoBanco[0];
      const valorTacBanco = parseFloat(proposta.valorTac || '0');

      console.log(`[TAC AUTH] 💰 TAC percentual calculada: R$ ${valorTacBanco.toFixed(2)}`);

      // VALIDAÇÃO CRÍTICA: 2.5% de R$ 20.000 = R$ 500,00
      expect(valorTacBanco).toBe(500.0);

      console.log('[TAC AUTH] ✅ CENÁRIO 1 PERCENTUAL SUCESSO - TAC R$ 500,00');
    });
  });

  describe('Cenário 2: Cliente Cadastrado Isento de TAC (Autenticado)', () => {
    it('deve isentar TAC para cliente com proposta anterior quitada', async () => {
      // SETUP: Produto com TAC alta
      await db
        .update(produtos)
        .set({
          tacValor: '350.00',
          tacTipo: 'fixo',
        })
        .where(eq(produtos.id, testProductId));

      console.log('[TAC AUTH] 🏦 Produto com TAC alta: R$ 350,00');

      const clienteCpfCadastrado = '11122233344';

      // PASSO 1: Criar primeira proposta (cliente paga TAC)
      const primeiraPropostaData = {
        valor: 8000,
        prazo: 12,
        taxaJuros: 1.8,
        clienteNome: 'Carlos Cadastrado Auth',
        clienteCpf: clienteCpfCadastrado,
        clienteTelefone: '11777666555',
        clienteEmail: 'carlos.cadastrado@teste.com',
        clienteRenda: '10000.00',
        clienteDividasExistentes: '1500.00',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        finalidade: 'Primeira operação',
        garantia: 'Nenhuma',
      };

      console.log('[TAC AUTH] 🔄 Criando primeira proposta para cadastrar cliente...');

      // Primeira proposta - cliente deve pagar TAC
      const primeiraResponse = await authenticatedClient
        .post('/api/propostas')
        .send(primeiraPropostaData)
        .expect(201);

      const primeiroPropostaId = primeiraResponse.body.id;

      // Validar primeira proposta no banco
      const primeiraProposta = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, primeiroPropostaId))
        .limit(1);

      const primeiroTac = parseFloat(primeiraProposta[0].valorTac || '0');
      console.log(`[TAC AUTH] 💰 Primeira operação - TAC pago: R$ ${primeiroTac.toFixed(2)}`);

      // Cliente deve pagar TAC na primeira vez
      expect(primeiroTac).toBe(350.0);

      // PASSO 2: Simular que primeira proposta foi quitada (status QUITADO)
      await db
        .update(propostas)
        .set({
          status: 'QUITADO' as any, // Status que confere isenção
        })
        .where(eq(propostas.id, primeiroPropostaId));

      console.log(
        '[TAC AUTH] ⏳ Primeira proposta marcada como QUITADA (cliente agora cadastrado)'
      );

      // PASSO 3: Segunda proposta para o MESMO cliente - deve ser isenta
      const segundaPropostaData = {
        valor: 15000, // Valor maior
        prazo: 30,
        taxaJuros: 2.1,
        clienteNome: 'Carlos Cadastrado Auth',
        clienteCpf: clienteCpfCadastrado, // MESMO CPF
        clienteTelefone: '11777666555',
        clienteEmail: 'carlos.cadastrado@teste.com',
        clienteRenda: '10000.00',
        clienteDividasExistentes: '1500.00',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        finalidade: 'Segunda operação - maior valor',
        garantia: 'Nenhuma',
      };

      console.log('[TAC AUTH] 🔄 Criando segunda proposta (cliente cadastrado)...');

      const segundaResponse = await authenticatedClient
        .post('/api/propostas')
        .send(segundaPropostaData)
        .expect(201);

      const segundoPropostaId = segundaResponse.body.id;

      // VALIDAÇÃO CRÍTICA: Consulta banco para segunda proposta
      const segundaProposta = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, segundoPropostaId))
        .limit(1);

      const segundoTac = parseFloat(segundaProposta[0].valorTac || '0');

      console.log(`[TAC AUTH] 💰 Segunda operação - TAC: R$ ${segundoTac.toFixed(2)}`);

      // VALIDAÇÃO CRÍTICA: Segunda operação deve ser ISENTA
      expect(segundoTac).toBe(0.0);

      // Validações adicionais
      expect(segundaProposta[0].clienteCpf).toBe(clienteCpfCadastrado);
      expect(segundaProposta[0].valor).toBe('15000.00');

      console.log('[TAC AUTH] ✅ CENÁRIO 2 SUCESSO - Cliente cadastrado isento de TAC');
    });
  });

  describe('Cenário 3: Validação de Integridade do Sistema', () => {
    it('deve manter consistência entre API response e banco de dados', async () => {
      // SETUP: TAC fixa
      await db
        .update(produtos)
        .set({
          tacValor: '250.00',
          tacTipo: 'fixo',
        })
        .where(eq(produtos.id, testProductId));

      const proposalData = {
        valor: 10000,
        prazo: 18,
        taxaJuros: 2.0,
        clienteNome: 'Teste Consistência',
        clienteCpf: '55566677788',
        clienteTelefone: '11555666777',
        clienteEmail: 'consistencia@teste.com',
        clienteRenda: '8000.00',
        clienteDividasExistentes: '1000.00',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        finalidade: 'Teste de consistência',
        garantia: 'Nenhuma',
      };

      console.log('[TAC AUTH] 🔍 Validando consistência API <-> Banco...');

      // ACT
      const response = await authenticatedClient
        .post('/api/propostas')
        .send(proposalData)
        .expect(201);

      const propostaId = response.body.id;

      // VALIDAÇÃO 1: Response deve conter valor_tac
      expect(response.body).toHaveProperty('valor_tac');
      const tacResponse = parseFloat(response.body.valor_tac || '0');

      // VALIDAÇÃO 2: Banco deve ter o mesmo valor
      const propostaBanco = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      const tacBanco = parseFloat(propostaBanco[0].valorTac || '0');

      console.log(`[TAC AUTH] 📊 TAC Response: R$ ${tacResponse.toFixed(2)}`);
      console.log(`[TAC AUTH] 💾 TAC Banco: R$ ${tacBanco.toFixed(2)}`);

      // VALIDAÇÃO CRÍTICA: Consistência total
      expect(tacResponse).toBe(tacBanco);
      expect(tacResponse).toBe(250.0);

      console.log('[TAC AUTH] ✅ CONSISTÊNCIA VALIDADA - API e Banco sincronizados');
    });

    it('deve processar múltiplas propostas sequenciais sem conflito', async () => {
      // SETUP: TAC percentual
      await db
        .update(produtos)
        .set({
          tacValor: '3.0',
          tacTipo: 'percentual',
        })
        .where(eq(produtos.id, testProductId));

      console.log('[TAC AUTH] 🔄 Testando múltiplas propostas sequenciais...');

      const baseProposal = {
        prazo: 24,
        taxaJuros: 1.9,
        clienteTelefone: '11999888777',
        clienteRenda: '15000.00',
        clienteDividasExistentes: '2000.00',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        finalidade: 'Teste sequencial',
        garantia: 'Nenhuma',
      };

      const propostasData = [
        {
          ...baseProposal,
          valor: 10000,
          clienteNome: 'Cliente 1',
          clienteCpf: '11111111111',
          clienteEmail: 'cliente1@teste.com',
        },
        {
          ...baseProposal,
          valor: 15000,
          clienteNome: 'Cliente 2',
          clienteCpf: '22222222222',
          clienteEmail: 'cliente2@teste.com',
        },
        {
          ...baseProposal,
          valor: 20000,
          clienteNome: 'Cliente 3',
          clienteCpf: '33333333333',
          clienteEmail: 'cliente3@teste.com',
        },
      ];

      const tacesEsperadas = [300.0, 450.0, 600.0]; // 3% de cada valor

      for (let i = 0; i < propostasData.length; i++) {
        const response = await authenticatedClient
          .post('/api/propostas')
          .send(propostasData[i])
          .expect(201);

        const propostaId = response.body.id;

        // Validar no banco
        const propostaNoBanco = await db
          .select()
          .from(propostas)
          .where(eq(propostas.id, propostaId))
          .limit(1);

        const tacBanco = parseFloat(propostaNoBanco[0].valorTac || '0');

        console.log(`[TAC AUTH] ${i + 1}/3 - TAC: R$ ${tacBanco.toFixed(2)}`);
        expect(tacBanco).toBe(tacesEsperadas[i]);
      }

      console.log('[TAC AUTH] ✅ MÚLTIPLAS PROPOSTAS PROCESSADAS CORRETAMENTE');
    });
  });
});
