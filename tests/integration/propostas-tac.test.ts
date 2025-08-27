/**
 * Testes de Integração - Fluxo de Cálculo e Isenção de TAC
 *
 * Valida de ponta a ponta a nova lógica de Taxa de Abertura de Crédito
 * através de chamadas reais à API e validação no banco de dados.
 *
 * @file tests/integration/propostas-tac.test.ts
 * @created 2025-08-20
 * @coverage Cenário 1 (Cliente Novo Paga) + Cenário 2 (Cliente Cadastrado Isento)
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../server/app';
import { db } from '../../server/lib/supabase';
import { propostas, produtos } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { cleanTestDatabase, setupTestEnvironment } from '../lib/db-helper';
import { v4 as uuidv4 } from 'uuid';

describe('Integração: Fluxo de TAC nas Propostas', () => {
  // CRITICAL SECURITY GUARD - Prevent tests from running against production database
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes('test')) {
      throw new Error(
        'FATAL: Tentativa de executar testes de integração num banco de dados que não é de teste (DATABASE_URL não contém "test"). Operação abortada.'
      );
    }
  });

  let app: Express;
  let testUserId: string;
  let testPartnerId: number;
  let testStoreId: number;
  let testProductId: number;
  let testCommercialTableId: number;
  let authToken: string;

  /**
   * Setup: Limpa banco, cria ambiente de teste e configura produto com TAC
   */
  beforeEach(async () => {
    console.log('[TEST SETUP] 🧹 Iniciando setup do teste de TAC...');

    // Criar instância da aplicação Express
    app = await createApp();

    // Limpar banco primeiro
    await cleanTestDatabase();

    try {
      // Usar helper para criar dados de teste completos
      const testData = await setupTestEnvironment();

      // Atribuir valores para uso nos testes
      testUserId = testData.testUserId;
      testPartnerId = testData.testPartnerId;
      testStoreId = testData.testStoreId;
      testProductId = testData.testProductId;
      testCommercialTableId = testData.testCommercialTableId;

      // Generate mock JWT token para autenticação nos testes
      authToken = 'Bearer mock-jwt-token-for-testing';

      console.log(`[TEST SETUP] ✅ Ambiente de teste configurado:`);
      console.log(`  - User ID: ${testUserId}`);
      console.log(`  - Product ID: ${testProductId}`);
      console.log(`  - Store ID: ${testStoreId}`);
    } catch (error) {
      console.error('[TEST SETUP] ❌ Erro ao criar ambiente de teste:', error);
      throw error;
    }
  });

  afterEach(async () => {
    // Opcional: cleanup adicional se necessário
    console.log('[TEST CLEANUP] 🧹 Teste finalizado');
  });

  describe('Cenário 1: Cliente Novo Paga TAC', () => {
    it('deve calcular e aplicar TAC fixa para novo cliente', async () => {
      // SETUP: Configurar produto com TAC de R$ 150,00 fixo
      console.log('[TEST] 🔧 Configurando produto com TAC de R$ 150,00 fixo...');

      await db
        .update(produtos)
        .set({
          tacValor: '150.00',
          tacTipo: 'fixo',
        })
        .where(eq(produtos.id, testProductId));

      console.log('[TEST] ✅ Produto configurado com TAC fixo');

      // ARRANGE: Dados da proposta para cliente novo
      const clienteNovoCpf = '12345678901'; // CPF que não existe no banco
      const proposalData = {
        valor: 10000,
        prazo: 24,
        taxaJuros: 2.5,
        clienteNome: 'João da Silva Novo',
        clienteCpf: clienteNovoCpf,
        clienteTelefone: '11999887766',
        clienteEmail: 'joao.novo@teste.com',
        clienteRenda: '8000.00',
        clienteDividasExistentes: '1000.00',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        finalidade: 'Reforma da casa',
        garantia: 'Nenhuma',
      };

      console.log('[TEST] 📋 Dados da proposta:');
      console.log(`  - Cliente: ${proposalData.clienteNome}`);
      console.log(`  - CPF: ${proposalData.clienteCpf}`);
      console.log(`  - Valor: R$ ${proposalData.valor.toLocaleString()}`);
      console.log(`  - Produto ID: ${testProductId} (TAC: R$ 150,00)`);

      // ACT: Executar chamada à API de criação de proposta
      const response = await request(app)
        .post('/api/propostas')
        .set('Authorization', authToken)
        .send(proposalData)
        .expect(201);

      // VALIDAÇÃO 1: Resposta da API deve conter ID da proposta
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');

      const propostaId = response.body.data.id;
      console.log(`[TEST] ✅ Proposta criada via API com ID: ${propostaId}`);

      // VALIDAÇÃO 2: Consultar diretamente o banco de dados para verificar valor_tac
      const [propostaCriada] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      console.log('[TEST] 🔍 Proposta consultada no banco:');
      console.log(`  - ID: ${propostaCriada.id}`);
      console.log(`  - Cliente CPF: ${propostaCriada.clienteCpf}`);
      console.log(`  - Valor TAC: R$ ${propostaCriada.valorTac || '0'}`);
      console.log(`  - Status: ${propostaCriada.status}`);

      // ASSERÇÕES CRÍTICAS: Validar cálculo de TAC para cliente novo
      expect(propostaCriada).toBeDefined();
      expect(propostaCriada.clienteCpf).toBe(clienteNovoCpf);
      expect(propostaCriada.valorTac).toBe('150.00'); // TAC fixa aplicada
      expect(parseFloat(propostaCriada.valorTac || '0')).toBe(150.0);

      console.log('[TEST] ✅ Cenário 1 SUCESSO: Cliente novo pagou TAC de R$ 150,00');
    });

    it('deve calcular e aplicar TAC percentual para novo cliente', async () => {
      // SETUP: Configurar produto com TAC de 1.5% (percentual)
      console.log('[TEST] 🔧 Configurando produto com TAC de 1.5% percentual...');

      await db
        .update(produtos)
        .set({
          tacValor: '1.5',
          tacTipo: 'percentual',
        })
        .where(eq(produtos.id, testProductId));

      // ARRANGE: Proposta para cliente novo com valor R$ 20.000
      const clienteNovoCpf = '98765432100';
      const valorEmprestimo = 20000;
      const proposalData = {
        valor: valorEmprestimo,
        prazo: 36,
        taxaJuros: 2.2,
        clienteNome: 'Maria Silva Nova',
        clienteCpf: clienteNovoCpf,
        clienteTelefone: '11888776655',
        clienteEmail: 'maria.nova@teste.com',
        clienteRenda: '15000.00',
        clienteDividasExistentes: '2000.00',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        finalidade: 'Capital de giro',
        garantia: 'Nenhuma',
      };

      console.log('[TEST] 📋 TAC Percentual - Dados:');
      console.log(`  - Cliente: ${proposalData.clienteNome}`);
      console.log(`  - Valor: R$ ${valorEmprestimo.toLocaleString()}`);
      console.log(`  - TAC Esperada: 1.5% de R$ 20.000 = R$ 300,00`);

      // ACT: Chamada à API
      const response = await request(app)
        .post('/api/propostas')
        .set('Authorization', authToken)
        .send(proposalData)
        .expect(201);

      const propostaId = response.body.data.id;

      // VALIDAÇÃO: Consultar banco e verificar cálculo percentual
      const [propostaCriada] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      console.log('[TEST] 🔍 TAC Percentual - Resultado:');
      console.log(`  - Valor TAC: R$ ${propostaCriada.valorTac}`);

      // ASSERÇÕES: TAC percentual = 1.5% de R$ 20.000 = R$ 300,00
      expect(propostaCriada.valorTac).toBe('300.00');
      expect(parseFloat(propostaCriada.valorTac || '0')).toBe(300.0);

      console.log('[TEST] ✅ TAC Percentual SUCESSO: 1.5% aplicado corretamente');
    });
  });

  describe('Cenário 2: Cliente Cadastrado Isento de TAC', () => {
    it('deve isentar TAC para cliente com proposta anterior QUITADO', async () => {
      // SETUP: Configurar produto com TAC de R$ 200,00 fixo
      console.log('[TEST] 🔧 Configurando produto com TAC de R$ 200,00 fixo...');

      await db
        .update(produtos)
        .set({
          tacValor: '200.00',
          tacTipo: 'fixo',
        })
        .where(eq(produtos.id, testProductId));

      // SETUP CRÍTICO: Criar proposta anterior para o mesmo CPF com status QUITADO
      const clienteCpfCadastrado = '11122233344';
      const propostaAntigaId = uuidv4();

      console.log(
        '[TEST] 🏦 Criando proposta histórica QUITADO para simular cliente cadastrado...'
      );

      await db.insert(propostas).values({
        id: propostaAntigaId,
        numeroProposta: 999998, // Número único
        status: 'QUITADO', // Status que indica cliente cadastrado
        valor: '5000.00',
        prazo: 12,
        taxaJuros: '1.99',
        clienteNome: 'José dos Santos Cadastrado',
        clienteCpf: clienteCpfCadastrado, // Mesmo CPF da nova proposta
        clienteTelefone: '11777666555',
        clienteEmail: 'jose.cadastrado@teste.com',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        userId: testUserId,
        finalidade: 'Empréstimo anterior',
        garantia: 'Nenhuma',
        valorTac: '200.00', // Proposta antiga pagou TAC
      });

      console.log(`[TEST] ✅ Proposta histórica criada: ${propostaAntigaId} (Status: QUITADO)`);

      // ARRANGE: Nova proposta para o MESMO cliente (CPF cadastrado)
      const novaProposalData = {
        valor: 15000,
        prazo: 24,
        taxaJuros: 2.8,
        clienteNome: 'José dos Santos Cadastrado',
        clienteCpf: clienteCpfCadastrado, // MESMO CPF da proposta histórica
        clienteTelefone: '11777666555',
        clienteEmail: 'jose.cadastrado@teste.com',
        clienteRenda: '10000.00',
        clienteDividasExistentes: '1500.00',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        finalidade: 'Novo investimento',
        garantia: 'Nenhuma',
      };

      console.log('[TEST] 📋 Nova proposta para cliente cadastrado:');
      console.log(`  - Cliente: ${novaProposalData.clienteNome}`);
      console.log(`  - CPF: ${novaProposalData.clienteCpf} (JÁ CADASTRADO)`);
      console.log(`  - Valor: R$ ${novaProposalData.valor.toLocaleString()}`);
      console.log(`  - TAC Esperada: R$ 0,00 (ISENÇÃO)`);

      // ACT: Executar chamada à API para criar nova proposta
      const response = await request(app)
        .post('/api/propostas')
        .set('Authorization', authToken)
        .send(novaProposalData)
        .expect(201);

      const novaPropostaId = response.body.data.id;
      console.log(`[TEST] ✅ Nova proposta criada via API: ${novaPropostaId}`);

      // VALIDAÇÃO 1: Consultar banco para verificar isenção de TAC
      const [novaPropostaCriada] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, novaPropostaId))
        .limit(1);

      console.log('[TEST] 🔍 Nova proposta consultada no banco:');
      console.log(`  - ID: ${novaPropostaCriada.id}`);
      console.log(`  - Cliente CPF: ${novaPropostaCriada.clienteCpf}`);
      console.log(`  - Valor TAC: R$ ${novaPropostaCriada.valorTac || '0'}`);
      console.log(`  - Status: ${novaPropostaCriada.status}`);

      // ASSERÇÕES CRÍTICAS: Validar isenção de TAC para cliente cadastrado
      expect(novaPropostaCriada).toBeDefined();
      expect(novaPropostaCriada.clienteCpf).toBe(clienteCpfCadastrado);
      expect(novaPropostaCriada.valorTac).toBe('0.00'); // TAC isenta para cliente cadastrado
      expect(parseFloat(novaPropostaCriada.valorTac || '0')).toBe(0.0);

      // VALIDAÇÃO 2: Confirmar que a proposta histórica ainda existe
      const [propostaHistorica] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaAntigaId))
        .limit(1);

      expect(propostaHistorica).toBeDefined();
      expect(propostaHistorica.status).toBe('QUITADO');

      console.log('[TEST] ✅ Cenário 2 SUCESSO: Cliente cadastrado isento de TAC (R$ 0,00)');
    });

    it('deve isentar TAC para cliente com proposta anterior ASSINATURA_CONCLUIDA', async () => {
      // SETUP: Produto com TAC alta para garantir que isenção está funcionando
      await db
        .update(produtos)
        .set({
          tacValor: '500.00',
          tacTipo: 'fixo',
        })
        .where(eq(produtos.id, testProductId));

      // SETUP: Cliente com proposta anterior ASSINATURA_CONCLUIDA
      const clienteCpf = '44455566677';
      const propostaAntigaId = uuidv4();

      await db.insert(propostas).values({
        id: propostaAntigaId,
        numeroProposta: 999997,
        status: 'ASSINATURA_CONCLUIDA', // Outro status válido para cliente cadastrado
        valor: '8000.00',
        prazo: 18,
        taxaJuros: '2.1',
        clienteNome: 'Ana Paula Assinada',
        clienteCpf: clienteCpf,
        clienteTelefone: '11666555444',
        clienteEmail: 'ana.assinada@teste.com',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        userId: testUserId,
        finalidade: 'Empréstimo assinado',
        garantia: 'Nenhuma',
        valorTac: '500.00',
      });

      // Nova proposta para o mesmo cliente
      const novaProposalData = {
        valor: 12000,
        prazo: 30,
        taxaJuros: 2.5,
        clienteNome: 'Ana Paula Assinada',
        clienteCpf: clienteCpf,
        clienteTelefone: '11666555444',
        clienteEmail: 'ana.assinada@teste.com',
        clienteRenda: '12000.00',
        clienteDividasExistentes: '800.00',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        finalidade: 'Segunda operação',
        garantia: 'Nenhuma',
      };

      console.log('[TEST] 📋 Cliente com histórico ASSINATURA_CONCLUIDA:');
      console.log(`  - CPF: ${clienteCpf}`);
      console.log(`  - TAC Produto: R$ 500,00 (deveria ser isenta)`);

      // ACT: Criar nova proposta
      const response = await request(app)
        .post('/api/propostas')
        .set('Authorization', authToken)
        .send(novaProposalData)
        .expect(201);

      const novaPropostaId = response.body.data.id;

      // VALIDAÇÃO: Verificar isenção
      const [novaPropostaCriada] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, novaPropostaId))
        .limit(1);

      console.log(`[TEST] 🔍 Resultado TAC: R$ ${novaPropostaCriada.valorTac}`);

      // ASSERÇÕES: TAC deve ser 0 mesmo com produto configurado para R$ 500
      expect(novaPropostaCriada.valorTac).toBe('0.00');
      expect(parseFloat(novaPropostaCriada.valorTac || '0')).toBe(0.0);

      console.log('[TEST] ✅ ASSINATURA_CONCLUIDA também garante isenção de TAC');
    });
  });
});
