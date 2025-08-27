/**
 * Testes de Integração - Regra de Negócio de Negação Automática por Comprometimento de Renda
 * PAM V1.0 - Quality Assurance para Pré-Aprovação
 * Data: 21/08/2025
 *
 * Esta suíte de testes valida a regra crítica de negócio que rejeita automaticamente
 * propostas com comprometimento de renda superior a 25%, garantindo que futuras
 * alterações no código não quebrem esta lógica de proteção financeira.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { db } from '../../server/lib/supabase';
import { propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { cleanTestDatabase, setupTestEnvironment } from '../lib/db-helper';
import type { Express } from 'express';

describe('Pré-Aprovação - Negação Automática por Comprometimento de Renda', () => {
  // CRITICAL SECURITY GUARD - Prevent tests from running against production database
  beforeAll(() => {
    // TRIPLA PROTEÇÃO - PAM V1.0 FORENSE
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        `FATAL: NODE_ENV='${process.env.NODE_ENV}' deve ser 'test'. Testes bloqueados.`
      );
    }
    if (!process.env.DATABASE_URL?.includes('test')) {
      throw new Error('FATAL: DATABASE_URL não contém "test". Use banco de teste dedicado.');
    }
    const prodPatterns = ['prod', 'production', 'azure', 'live'];
    if (prodPatterns.some((p) => process.env.DATABASE_URL?.toLowerCase()?.includes(p))) {
      throw new Error('FATAL: DATABASE_URL parece ser de produção. Abortado.');
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
   * Setup: Limpa banco e cria ambiente de teste com dados pré-requisito
   */
  beforeEach(async () => {
    console.log('[TEST SETUP] 🧹 Iniciando setup do teste de pré-aprovação...');

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
      // Em ambiente de teste, usar token mock que será aceito pelo middleware
      authToken = 'Bearer mock-jwt-token-for-testing';

      console.log(`[TEST SETUP] ✅ Ambiente de teste configurado com dados:`);
      console.log(`  - User ID: ${testUserId}`);
      console.log(`  - Store ID: ${testStoreId}`);
      console.log(`  - Product ID: ${testProductId}`);
      console.log(`  - Commercial Table ID: ${testCommercialTableId}`);
    } catch (error) {
      console.error('[TEST SETUP] ❌ Erro ao configurar ambiente de teste:', error);
      throw error;
    }
  });

  /**
   * Teardown: Limpa banco após cada teste
   */
  afterEach(async () => {
    console.log('[TEST TEARDOWN] 🧹 Limpando banco após teste...');
    await cleanTestDatabase();
    console.log('[TEST TEARDOWN] ✅ Banco limpo');
  });

  /**
   * CENÁRIO CRÍTICO: Negação Automática por Comprometimento Excessivo
   *
   * Este teste valida que o sistema rejeita automaticamente propostas onde
   * o comprometimento de renda (dívidas existentes + nova parcela) excede 25%.
   *
   * Dados do teste:
   * - Renda: R$ 10.000,00
   * - Dívidas existentes: R$ 2.000,00
   * - Valor solicitado: R$ 18.000,00 em 36x (≈ R$ 600/mês)
   * - Comprometimento total: (2.000 + 600) / 10.000 = 26% > 25%
   * - Resultado esperado: Status "rejeitado"
   */
  describe('Cenário 1: Negação Automática por Comprometimento > 25%', () => {
    it('deve rejeitar automaticamente proposta com comprometimento de renda de 26%', async () => {
      console.log('[TEST] 🎯 Testando negação automática por comprometimento excessivo...');

      // Preparar dados da proposta que força rejeição automática
      const proposalData = {
        // Dados do cliente
        clienteNome: 'João da Silva Teste',
        clienteCpf: '12345678901',
        clienteEmail: 'joao.teste@email.com',
        clienteTelefone: '11999999999',
        clienteDataNascimento: '1985-05-15',
        clienteEstadoCivil: 'solteiro',
        clienteEnderecoCompleto: 'Rua Teste, 123 - São Paulo/SP',

        // DADOS FINANCEIROS CRÍTICOS PARA O TESTE
        clienteRenda: '10000.00', // R$ 10.000 de renda
        clienteDividasExistentes: '2000.00', // R$ 2.000 em dívidas existentes

        // Dados da proposta que resultarão em parcela de ~R$ 600
        valor: 18000, // R$ 18.000 solicitados
        prazo: 36, // 36 parcelas
        taxaJuros: 2.5, // 2.5% ao mês
        finalidade: 'Teste de rejeição automática',
        garantia: 'Nenhuma',

        // IDs de relacionamento
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,

        // Dados de pagamento (obrigatórios para validação)
        dados_pagamento_conta: {
          banco: '001',
          agencia: '1234',
          conta: '567890',
          tipo_conta: 'corrente',
          titular: 'João da Silva Teste',
        },
      };

      console.log('[TEST] 📊 Dados de teste configurados:');
      console.log(`  - Renda: R$ ${proposalData.clienteRenda}`);
      console.log(`  - Dívidas existentes: R$ ${proposalData.clienteDividasExistentes}`);
      console.log(`  - Valor solicitado: R$ ${proposalData.valor.toLocaleString()}`);
      console.log(`  - Prazo: ${proposalData.prazo} parcelas`);
      console.log(`  - Taxa: ${proposalData.taxaJuros}% a.m.`);

      // Executar chamada à API de criação de proposta
      const response = await request(app)
        .post('/api/propostas')
        .set('Authorization', authToken)
        .send(proposalData)
        .expect(200); // API deve retornar sucesso mesmo com rejeição automática

      console.log('[TEST] 📝 Resposta da API recebida');
      console.log(`  - Status HTTP: ${response.status}`);
      console.log(`  - Proposta ID: ${response.body.data?.id}`);

      // Verificar que a API retornou sucesso com a proposta criada
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBeDefined();

      const propostaId = response.body.data.id;

      // VALIDAÇÃO CRÍTICA: Consultar diretamente o banco de dados
      // para verificar se o status foi corretamente definido como "rejeitado"
      const [propostaCriada] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      console.log('[TEST] 🔍 Proposta consultada no banco:');
      console.log(`  - ID: ${propostaCriada.id}`);
      console.log(`  - Status: ${propostaCriada.status}`);
      console.log(`  - Observações: ${propostaCriada.observacoes || 'N/A'}`);

      // ASSERÇÕES CRÍTICAS: Validar regra de negócio
      expect(propostaCriada).toBeDefined();
      expect(propostaCriada.status).toBe('rejeitado');
      expect(propostaCriada.observacoes).toContain('Comprometimento de renda');
      expect(propostaCriada.observacoes).toContain('25%');

      // Validações adicionais dos dados financeiros
      expect(propostaCriada.clienteRenda).toBe('10000.00');
      expect(propostaCriada.clienteDividasExistentes).toBe('2000.00');
      expect(propostaCriada.valor).toBe('18000.00');
      expect(propostaCriada.prazo).toBe(36);

      console.log('[TEST] ✅ Teste concluído com sucesso!');
      console.log('  - Proposta foi corretamente rejeitada pelo comprometimento de renda');
      console.log('  - Regra de negócio de 25% está funcionando adequadamente');
      console.log('  - Sistema de pré-aprovação está protegendo contra propostas arriscadas');
    });
  });

  /**
   * CENÁRIO COMPLEMENTAR: Aprovação Automática com Comprometimento Baixo
   *
   * Este teste complementar valida que propostas com comprometimento DENTRO
   * do limite de 25% são aprovadas e passam para análise humana.
   *
   * Dados do teste:
   * - Renda: R$ 10.000,00
   * - Dívidas existentes: R$ 1.000,00
   * - Valor solicitado: R$ 5.000,00 em 12x (≈ R$ 480/mês)
   * - Comprometimento total: (1.000 + 480) / 10.000 = 14.8% < 25%
   * - Resultado esperado: Status "aguardando_analise"
   */
  describe('Cenário 2: Aprovação Automática com Comprometimento < 25%', () => {
    it('deve aprovar automaticamente proposta com comprometimento de renda de 14.8%', async () => {
      console.log('[TEST] 🎯 Testando aprovação automática por comprometimento baixo...');

      // Preparar dados da proposta que força aprovação automática
      const proposalData = {
        // Dados do cliente
        clienteNome: 'Maria Santos Aprovada',
        clienteCpf: '98765432109',
        clienteEmail: 'maria.aprovada@email.com',
        clienteTelefone: '11888888888',
        clienteDataNascimento: '1990-03-20',
        clienteEstadoCivil: 'casada',
        clienteEnderecoCompleto: 'Av. Sucesso, 456 - São Paulo/SP',

        // DADOS FINANCEIROS PARA APROVAÇÃO
        clienteRenda: '10000.00', // R$ 10.000 de renda
        clienteDividasExistentes: '1000.00', // R$ 1.000 em dívidas existentes

        // Dados da proposta que resultarão em comprometimento baixo
        valor: 5000, // R$ 5.000 solicitados
        prazo: 12, // 12 parcelas
        taxaJuros: 2.5, // 2.5% ao mês
        finalidade: 'Teste de aprovação automática',
        garantia: 'Nenhuma',

        // IDs de relacionamento
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        lojaId: testStoreId,

        // Dados de pagamento
        dados_pagamento_conta: {
          banco: '341',
          agencia: '5678',
          conta: '123456',
          tipo_conta: 'corrente',
          titular: 'Maria Santos Aprovada',
        },
      };

      console.log('[TEST] 📊 Dados de teste configurados:');
      console.log(`  - Renda: R$ ${proposalData.clienteRenda}`);
      console.log(`  - Dívidas existentes: R$ ${proposalData.clienteDividasExistentes}`);
      console.log(`  - Valor solicitado: R$ ${proposalData.valor.toLocaleString()}`);
      console.log(`  - Prazo: ${proposalData.prazo} parcelas`);

      // Executar chamada à API
      const response = await request(app)
        .post('/api/propostas')
        .set('Authorization', authToken)
        .send(proposalData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();

      const propostaId = response.body.data.id;

      // Validar no banco de dados
      const [propostaCriada] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      console.log('[TEST] 🔍 Proposta consultada no banco:');
      console.log(`  - ID: ${propostaCriada.id}`);
      console.log(`  - Status: ${propostaCriada.status}`);
      console.log(`  - Observações: ${propostaCriada.observacoes || 'N/A'}`);

      // ASSERÇÕES: Deve ser aprovada na pré-análise
      expect(propostaCriada).toBeDefined();
      expect(propostaCriada.status).toBe('aguardando_analise');
      expect(propostaCriada.observacoes).toContain('Pré-aprovado');
      expect(propostaCriada.observacoes).toContain('dentro do limite');

      console.log('[TEST] ✅ Teste de aprovação concluído com sucesso!');
      console.log('  - Proposta foi corretamente pré-aprovada');
      console.log('  - Comprometimento baixo permitiu continuidade do fluxo');
    });
  });
});
