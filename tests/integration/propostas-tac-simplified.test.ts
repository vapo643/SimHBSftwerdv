/**
 * Testes de Integração Simplificados - Fluxo TAC
 *
 * Valida a integração entre TacCalculationService e base de dados
 * sem depender do framework HTTP (contorna problemas de esbuild)
 *
 * @file tests/integration/propostas-tac-simplified.test.ts
 * @created 2025-08-20
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { db } from '../../server/lib/supabase';
import { propostas, produtos } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { cleanTestDatabase, setupTestEnvironment } from '../lib/db-helper';
import { TacCalculationService } from '../../server/services/tacCalculationService';
import { v4 as uuidv4 } from 'uuid';

describe('Integração Simplificada: TacCalculationService + Database', () => {
  // CRITICAL SECURITY GUARD - Prevent tests from running against production database
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes('test')) {
      throw new Error(
        'FATAL: Tentativa de executar testes de integração num banco de dados que não é de teste (DATABASE_URL não contém "test"). Operação abortada.'
      );
    }
  });

  let testUserId: string;
  let testProductId: number;
  let testStoreId: number;
  let testCommercialTableId: number;

  beforeEach(async () => {
    console.log('[TEST SETUP] 🧹 Iniciando setup simplificado...');

    // Limpar e configurar ambiente
    await cleanTestDatabase();
    const testData = await setupTestEnvironment();

    testUserId = testData.testUserId;
    testProductId = testData.testProductId;
    testStoreId = testData.testStoreId;
    testCommercialTableId = testData.testCommercialTableId;

    console.log(`[TEST SETUP] ✅ Ambiente configurado - Produto ID: ${testProductId}`);
  });

  describe('Cenário 1: Cliente Novo - Integração Real', () => {
    it('deve calcular TAC fixa através do serviço com dados reais', async () => {
      // SETUP: Configurar produto com TAC de R$ 180,00
      await db
        .update(produtos)
        .set({
          tacValor: '180.00',
          tacTipo: 'fixo',
        })
        .where(eq(produtos.id, testProductId));

      const clienteCpf = '11122233344';
      const valorEmprestimo = 8000;

      console.log(`[TEST] 🧮 Calculando TAC para cliente novo ${clienteCpf}...`);

      // ACT: Chamar diretamente o serviço (integração real)
      const tacCalculada = await TacCalculationService.calculateTac(
        testProductId,
        valorEmprestimo,
        clienteCpf
      );

      console.log(`[TEST] 💰 TAC calculada: R$ ${tacCalculada.toFixed(2)}`);

      // VALIDAÇÃO: TAC deve ser R$ 180,00 (valor fixo)
      expect(tacCalculada).toBe(180.0);

      // VALIDAÇÃO EXTRA: Verificar produto no banco
      const [produtoConfig] = await db
        .select()
        .from(produtos)
        .where(eq(produtos.id, testProductId))
        .limit(1);

      expect(produtoConfig.tacValor).toBe('180.00');
      expect(produtoConfig.tacTipo).toBe('fixo');

      console.log('[TEST] ✅ Integração TAC Fixa SUCESSO');
    });

    it('deve calcular TAC percentual através do serviço com dados reais', async () => {
      // SETUP: TAC percentual de 2%
      await db
        .update(produtos)
        .set({
          tacValor: '2.0',
          tacTipo: 'percentual',
        })
        .where(eq(produtos.id, testProductId));

      const clienteCpf = '55566677788';
      const valorEmprestimo = 25000;

      console.log(`[TEST] 📊 TAC percentual: 2% de R$ ${valorEmprestimo.toLocaleString()}`);

      // ACT: Serviço real
      const tacCalculada = await TacCalculationService.calculateTac(
        testProductId,
        valorEmprestimo,
        clienteCpf
      );

      console.log(`[TEST] 💰 TAC calculada: R$ ${tacCalculada.toFixed(2)}`);

      // VALIDAÇÃO: 2% de R$ 25.000 = R$ 500,00
      expect(tacCalculada).toBe(500.0);

      console.log('[TEST] ✅ Integração TAC Percentual SUCESSO');
    });
  });

  describe('Cenário 2: Cliente Cadastrado - Integração Real', () => {
    it('deve aplicar isenção de TAC para cliente com histórico QUITADO', async () => {
      // SETUP: Produto com TAC alta para verificar isenção
      await db
        .update(produtos)
        .set({
          tacValor: '300.00',
          tacTipo: 'fixo',
        })
        .where(eq(produtos.id, testProductId));

      // SETUP CRÍTICO: Criar proposta histórica com status QUITADO
      const clienteCpfCadastrado = '99988877766';
      const propostaHistoricaId = uuidv4();

      // VERSÃO SIMPLIFICADA - apenas campos essenciais
      await db.insert(propostas).values({
        id: propostaHistoricaId,
        numeroProposta: 888888,
        status: 'QUITADO', // Cliente cadastrado
        valor: '12000.00',
        prazo: 18,
        taxaJuros: '2.1',
        clienteNome: 'Carlos Silva Histórico',
        clienteCpf: clienteCpfCadastrado,
        clienteTelefone: '11555444333',
        clienteEmail: 'carlos@teste.com',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        userId: testUserId,
        finalidade: 'Operação anterior',
        garantia: 'Nenhuma',
        valorTac: '300.00',
      });

      console.log(`[TEST] 🏦 Proposta histórica criada: ${propostaHistoricaId} (QUITADO)`);

      // ACT: Calcular TAC para o MESMO cliente (deve ser isento)
      const valorNovoEmprestimo = 20000;
      const tacCalculada = await TacCalculationService.calculateTac(
        testProductId,
        valorNovoEmprestimo,
        clienteCpfCadastrado
      );

      console.log(`[TEST] 💰 TAC para cliente cadastrado: R$ ${tacCalculada.toFixed(2)}`);

      // VALIDAÇÃO CRÍTICA: TAC deve ser 0 (isenção)
      expect(tacCalculada).toBe(0.0);

      // VALIDAÇÃO EXTRA: Confirmar que produto tem TAC configurada
      const [produtoConfig] = await db
        .select()
        .from(produtos)
        .where(eq(produtos.id, testProductId))
        .limit(1);

      expect(produtoConfig.tacValor).toBe('300.00'); // Produto tem TAC, mas cliente isento

      // VALIDAÇÃO EXTRA: Confirmar proposta histórica existe
      const [propostaHistorica] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaHistoricaId))
        .limit(1);

      expect(propostaHistorica.status).toBe('QUITADO');
      expect(propostaHistorica.clienteCpf).toBe(clienteCpfCadastrado);

      console.log('[TEST] ✅ Integração Isenção QUITADO SUCESSO');
    });

    it('deve aplicar isenção para cliente com histórico ASSINATURA_CONCLUIDA', async () => {
      // SETUP: TAC percentual alta
      await db
        .update(produtos)
        .set({
          tacValor: '5.0', // 5%
          tacTipo: 'percentual',
        })
        .where(eq(produtos.id, testProductId));

      // Cliente com proposta ASSINATURA_CONCLUIDA
      const clienteCpf = '12312312312';
      const propostaHistoricaId = uuidv4();

      // VERSÃO SIMPLIFICADA
      await db.insert(propostas).values({
        id: propostaHistoricaId,
        numeroProposta: 777777,
        status: 'ASSINATURA_CONCLUIDA',
        valor: '15000.00',
        prazo: 24,
        taxaJuros: '2.8',
        clienteNome: 'Ana Costa Assinada',
        clienteCpf: clienteCpf,
        clienteTelefone: '11444333222',
        clienteEmail: 'ana.costa@teste.com',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        userId: testUserId,
        finalidade: 'Contrato assinado',
        garantia: 'Nenhuma',
        valorTac: '750.00',
      });

      console.log(`[TEST] ✍️ Cliente com ASSINATURA_CONCLUIDA: ${clienteCpf}`);

      // Nova operação para mesmo cliente
      const tacCalculada = await TacCalculationService.calculateTac(
        testProductId,
        30000, // R$ 30.000 (5% seria R$ 1.500)
        clienteCpf
      );

      console.log(`[TEST] 💰 TAC calculada: R$ ${tacCalculada.toFixed(2)}`);

      // VALIDAÇÃO: Deve ser 0 mesmo com TAC percentual alta
      expect(tacCalculada).toBe(0.0);

      console.log('[TEST] ✅ Integração Isenção ASSINATURA_CONCLUIDA SUCESSO');
    });
  });

  describe('Cenário 3: Validação de Fluxo Completo', () => {
    it('deve validar toda a lógica isClienteCadastrado com dados reais', async () => {
      const clienteNovo = '00011122233';
      const clienteCadastrado = '33322211100';

      // Criar cliente cadastrado
      const propostaId = uuidv4();
      // VERSÃO SIMPLIFICADA
      await db.insert(propostas).values({
        id: propostaId,
        numeroProposta: 666666,
        status: 'aprovado',
        valor: '10000.00',
        prazo: 12,
        taxaJuros: '1.99',
        clienteNome: 'Cliente Aprovado',
        clienteCpf: clienteCadastrado,
        clienteTelefone: '11333222111',
        clienteEmail: 'aprovado@teste.com',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        userId: testUserId,
        finalidade: 'Proposta aprovada',
        garantia: 'Nenhuma',
      });

      // TESTE 1: Cliente novo
      const isNovoRegistered = await TacCalculationService.isClienteCadastrado(clienteNovo);
      expect(isNovoRegistered).toBe(false);

      // TESTE 2: Cliente cadastrado
      const isCadastradoRegistered =
        await TacCalculationService.isClienteCadastrado(clienteCadastrado);
      expect(isCadastradoRegistered).toBe(true);

      console.log(
        `[TEST] 👥 Cliente novo: ${isNovoRegistered}, Cliente cadastrado: ${isCadastradoRegistered}`
      );
      console.log('[TEST] ✅ Validação isClienteCadastrado SUCESSO');
    });

    it('deve integrar todo o fluxo TAC com cenário misto', async () => {
      // SETUP: Produto com TAC de R$ 250,00
      await db
        .update(produtos)
        .set({
          tacValor: '250.00',
          tacTipo: 'fixo',
        })
        .where(eq(produtos.id, testProductId));

      // Cenário: 2 clientes, 1 novo e 1 cadastrado
      const clienteNovo = '11111111111';
      const clienteCadastrado = '22222222222';

      // Cliente cadastrado tem proposta QUITADO
      // VERSÃO SIMPLIFICADA
      await db.insert(propostas).values({
        id: uuidv4(),
        numeroProposta: 555555,
        status: 'QUITADO',
        valor: '5000.00',
        prazo: 6,
        taxaJuros: '1.5',
        clienteNome: 'Cliente Quitado',
        clienteCpf: clienteCadastrado,
        clienteTelefone: '11222111000',
        clienteEmail: 'quitado@teste.com',
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,
        userId: testUserId,
        finalidade: 'Operação quitada',
        garantia: 'Nenhuma',
      });

      // TESTE INTEGRADO
      const tacClienteNovo = await TacCalculationService.calculateTac(
        testProductId,
        15000,
        clienteNovo
      );

      const tacClienteCadastrado = await TacCalculationService.calculateTac(
        testProductId,
        15000,
        clienteCadastrado
      );

      console.log(`[TEST] 🔄 TAC Cliente Novo: R$ ${tacClienteNovo.toFixed(2)}`);
      console.log(`[TEST] 🔄 TAC Cliente Cadastrado: R$ ${tacClienteCadastrado.toFixed(2)}`);

      // VALIDAÇÕES FINAIS
      expect(tacClienteNovo).toBe(250.0); // Paga TAC
      expect(tacClienteCadastrado).toBe(0.0); // Isento

      console.log('[TEST] ✅ Integração Fluxo Completo SUCESSO');
    });
  });
});
