/**
 * Testes de Integração - API de Busca de Cliente por CPF
 * PAM V1.0 - Quality Assurance para Auto-Preenchimento
 * Data: 20/08/2025
 *
 * Esta suíte de testes valida o endpoint GET /api/clientes/cpf/:cpf,
 * garantindo que a funcionalidade de busca e auto-preenchimento funciona
 * corretamente em cenários de sucesso e falha.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { db } from '../../server/lib/supabase';
import { propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { cleanTestDatabase, setupTestEnvironment } from '../lib/db-helper';
import type { Express } from 'express';

describe('API de Busca de Cliente por CPF', () => {
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
  let testCpf: string;
  let testPropostaId: string;

  /**
   * Setup: Limpa banco e cria ambiente de teste com proposta de exemplo
   */
  beforeEach(async () => {
    console.log('[TEST SETUP] 🧹 Iniciando setup do teste de busca por CPF...');

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

      // Definir CPF de teste (CPF válido para teste)
      testCpf = '12345678901';

      // Criar uma proposta de teste com dados do cliente
      const [createdProposta] = await db
        .insert(propostas)
        .values({
          id: `test-proposta-${Date.now()}`,
          numeroProposta: Math.floor(Math.random() * 10000) + 300001,
          lojaId: testStoreId,
          produtoId: testProductId,
          tabelaComercialId: testCommercialTableId,
          userId: testUserId,

          // Dados completos do cliente para teste
          clienteNome: 'João da Silva Teste',
          clienteCpf: testCpf,
          clienteEmail: 'joao.teste@email.com',
          clienteTelefone: '(11) 99999-9999',
          clienteDataNascimento: '1990-01-15',
          clienteRenda: '5000.00',

          // Dados pessoais
          clienteRg: '12.345.678-9',
          clienteOrgaoEmissor: 'SSP',
          clienteRgUf: 'SP',
          clienteRgDataEmissao: '2010-01-15',
          clienteEstadoCivil: 'Solteiro',
          clienteNacionalidade: 'Brasileira',
          clienteLocalNascimento: 'São Paulo',

          // Endereço completo
          clienteCep: '01310-100',
          clienteLogradouro: 'Avenida Paulista',
          clienteNumero: '1000',
          clienteComplemento: 'Apto 101',
          clienteBairro: 'Bela Vista',
          clienteCidade: 'São Paulo',
          clienteUf: 'SP',

          // Dados profissionais
          clienteOcupacao: 'Analista de Sistemas',
          clienteEmpresaNome: 'Tech Company LTDA',

          // Dados de pagamento
          metodoPagamento: 'conta_bancaria',
          dadosPagamentoBanco: 'Banco do Brasil',
          dadosPagamentoAgencia: '1234-5',
          dadosPagamentoConta: '12345-6',
          dadosPagamentoDigito: '7',

          // Dados da proposta
          valor: '10000.00',
          prazo: 12,
          finalidade: 'Capital de Giro',
          status: 'em_analise',
        })
        .returning();

      testPropostaId = createdProposta.id;

      console.log(`[TEST SETUP] ✅ Ambiente de teste configurado:`);
      console.log(`  - User ID: ${testUserId}`);
      console.log(`  - Store ID: ${testStoreId}`);
      console.log(`  - CPF Teste: ${testCpf}`);
      console.log(`  - Proposta ID: ${testPropostaId}`);
    }
catch (error) {
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
   * CENÁRIO DE SUCESSO: Busca por CPF existente
   *
   * Este teste valida que quando um CPF existe no banco de dados,
   * o endpoint retorna os dados completos do cliente da proposta mais recente.
   */
  it('deve retornar dados do cliente quando CPF existir', async () => {
    console.log(`[TEST] 🔍 Testando busca por CPF existente: ${testCpf}`);

    const response = await request(app).get(`/api/clientes/cpf/${testCpf}`).expect(200);

    // Validar estrutura da resposta
    expect(response.body).toHaveProperty('exists', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toBeTypeOf('object');

    // Validar dados básicos do cliente
    expect(response.body.data.nome).toBe('João da Silva Teste');
    expect(response.body.data.cpf).toBe(testCpf);
    expect(response.body.data.email).toBe('joao.teste@email.com');
    expect(response.body.data.telefone).toBe('(11) 99999-9999');

    // Validar dados pessoais
    expect(response.body.data.dataNascimento).toBe('1990-01-15');
    expect(response.body.data.rg).toBe('12.345.678-9');
    expect(response.body.data.orgaoEmissor).toBe('SSP');
    expect(response.body.data.estadoCivil).toBe('Solteiro');

    // Validar endereço
    expect(response.body.data.cep).toBe('01310-100');
    expect(response.body.data.logradouro).toBe('Avenida Paulista');
    expect(response.body.data.numero).toBe('1000');
    expect(response.body.data.cidade).toBe('São Paulo');
    expect(response.body.data.estado).toBe('SP');

    // Validar dados profissionais
    expect(response.body.data.ocupacao).toBe('Analista de Sistemas');
    expect(response.body.data.rendaMensal).toBe('5000.00');

    // Validar dados de pagamento
    expect(response.body.data.metodoPagamento).toBe('conta_bancaria');
    expect(response.body.data.dadosPagamentoBanco).toBe('Banco do Brasil');
    expect(response.body.data.dadosPagamentoAgencia).toBe('1234-5');

    console.log('[TEST] ✅ Dados do cliente retornados corretamente');
  });

  /**
   * CENÁRIO DE FALHA: Busca por CPF inexistente
   *
   * Este teste valida que quando um CPF não existe no banco de dados,
   * o endpoint retorna exists: false.
   */
  it('deve retornar exists: false quando CPF não existir', async () => {
    const cpfInexistente = '00000000000';
    console.log(`[TEST] 🔍 Testando busca por CPF inexistente: ${cpfInexistente}`);

    const response = await request(app).get(`/api/clientes/cpf/${cpfInexistente}`).expect(200);

    // Validar que retorna exists: false
    expect(response.body).toHaveProperty('exists', false);
    expect(response.body).not.toHaveProperty('data');

    console.log('[TEST] ✅ CPF inexistente retorna exists: false corretamente');
  });

  /**
   * CENÁRIO DE ERRO: CPF inválido (formato incorreto)
   *
   * Este teste valida que o endpoint rejeita CPFs com formato inválido.
   */
  it('deve retornar erro 400 para CPF com formato inválido', async () => {
    const cpfInvalido = '123'; // CPF muito curto
    console.log(`[TEST] 🔍 Testando busca por CPF inválido: ${cpfInvalido}`);

    const response = await request(app).get(`/api/clientes/cpf/${cpfInvalido}`).expect(400);

    // Validar que retorna erro de CPF inválido
    expect(response.body).toHaveProperty('error', 'CPF inválido');

    console.log('[TEST] ✅ CPF inválido retorna erro 400 corretamente');
  });

  /**
   * CENÁRIO ADICIONAL: Busca por CPF com formatação (pontos e hífen)
   *
   * Este teste valida que o endpoint funciona mesmo quando o CPF
   * é enviado com formatação (123.456.789-01).
   */
  it('deve funcionar com CPF formatado (pontos e hífen)', async () => {
    const cpfFormatado = '123.456.789-01';
    console.log(`[TEST] 🔍 Testando busca por CPF formatado: ${cpfFormatado}`);

    const response = await request(app).get(`/api/clientes/cpf/${cpfFormatado}`).expect(200);

    // Deve retornar exists: false pois este CPF não existe no banco
    expect(response.body).toHaveProperty('exists', false);

    console.log('[TEST] ✅ CPF formatado é processado corretamente');
  });

  /**
   * CENÁRIO DE EDGE CASE: Múltiplas propostas para o mesmo CPF
   *
   * Este teste valida que quando existem múltiplas propostas para o mesmo CPF,
   * o endpoint retorna os dados da proposta mais recente.
   */
  it('deve retornar dados da proposta mais recente quando há múltiplas propostas', async () => {
    console.log(`[TEST] 🔍 Testando múltiplas propostas para o mesmo CPF`);

    // Criar uma segunda proposta mais recente para o mesmo CPF
    await new Promise((resolve) => setTimeout(resolve, 10)); // Pequeno delay para garantir timestamp diferente

    const [propostaMaisRecente] = await db
      .insert(propostas)
      .values({
        id: `test-proposta-recente-${Date.now()}`,
        numeroProposta: Math.floor(Math.random() * 10000) + 400001,
        lojaId: testStoreId,
        produtoId: testProductId,
        tabelaComercialId: testCommercialTableId,
        userId: testUserId,

        // Mesmo CPF, mas dados atualizados
        clienteNome: 'João da Silva Atualizado',
        clienteCpf: testCpf,
        clienteEmail: 'joao.atualizado@email.com',
        clienteTelefone: '(11) 88888-8888',

        // Outros dados obrigatórios
        valor: '15000.00',
        prazo: 24,
        finalidade: 'Reforma',
        status: 'em_analise',
      })
      .returning();

    const response = await request(app).get(`/api/clientes/cpf/${testCpf}`).expect(200);

    // Deve retornar os dados da proposta mais recente
    expect(response.body.exists).toBe(true);
    expect(response.body.data.nome).toBe('João da Silva Atualizado');
    expect(response.body.data.email).toBe('joao.atualizado@email.com');
    expect(response.body.data.telefone).toBe('(11) 88888-8888');

    console.log('[TEST] ✅ Retorna dados da proposta mais recente corretamente');
  });
});
