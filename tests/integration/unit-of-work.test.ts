/**
 * Unit of Work Pattern - Integration Tests
 * 
 * AUDITORIA FORENSE - PAM V1.2
 * Testa atomicidade de transações e rollback em cenários de falha
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { unitOfWork } from '../../server/lib/unit-of-work';
import { db } from '../../server/lib/supabase';
import { propostas, propostaLogs } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

describe('Unit of Work - Auditoria Forense', () => {
  const testPropostaId = uuidv4();
  
  beforeEach(async () => {
    // Limpar dados de teste existentes
    await db.delete(propostaLogs).where(eq(propostaLogs.propostaId, testPropostaId));
    await db.delete(propostas).where(eq(propostas.id, testPropostaId));
  });

  afterEach(async () => {
    // Limpeza após teste
    await db.delete(propostaLogs).where(eq(propostaLogs.propostaId, testPropostaId));
    await db.delete(propostas).where(eq(propostas.id, testPropostaId));
  });

  test('PROVA UoW #1: Deve fazer COMMIT quando todas as operações são bem-sucedidas', async () => {
    const mockProposta = {
      id: testPropostaId,
      numeroProposta: 123456,
      status: 'RASCUNHO',
      clienteData: { nome: 'Cliente Teste', cpf: '12345678901' },
      condicoesData: { valor: 10000, prazo: 12 },
      produtoId: 1,
      lojaId: 1,
      parceiroId: 1,
      gerenteId: 1,
    };

    const mockLog = {
      propostaId: testPropostaId,
      autorId: 'test-user',
      statusNovo: 'RASCUNHO',
      observacao: 'Proposta criada via teste de integração',
    };

    // Executar operação transacional
    const result = await unitOfWork.withTransaction(async (tx) => {
      const createdProposta = await tx.insert(propostas).values(mockProposta).returning();
      await tx.insert(propostaLogs).values({
        ...mockLog,
        propostaId: createdProposta[0].id,
      });
      return createdProposta[0];
    });

    // VERIFICAR: Proposta foi criada
    const savedProposta = await db.select().from(propostas).where(eq(propostas.id, testPropostaId));
    expect(savedProposta).toHaveLength(1);
    expect(savedProposta[0].status).toBe('RASCUNHO');

    // VERIFICAR: Log foi criado
    const savedLogs = await db.select().from(propostaLogs).where(eq(propostaLogs.propostaId, testPropostaId));
    expect(savedLogs).toHaveLength(1);
    expect(savedLogs[0].statusNovo).toBe('RASCUNHO');

    console.log('✅ UoW COMMIT Test: Dados persistidos com sucesso');
  });

  test('PROVA UoW #2: Deve fazer ROLLBACK quando operação falha', async () => {
    const mockProposta = {
      id: testPropostaId,
      status: 'RASCUNHO',
      clienteData: { nome: 'Cliente Teste', cpf: '12345678901' },
      condicoesData: { valor: 10000, prazo: 12 },
      produtoId: 1,
      lojaId: 1,
    };

    const mockProposta = {
      id: testPropostaId,
      numeroProposta: 123457,
      status: 'RASCUNHO',
      clienteData: { nome: 'Cliente Teste', cpf: '12345678901' },
      condicoesData: { valor: 10000, prazo: 12 },
      produtoId: 1,
      lojaId: 1,
      parceiroId: 1,
      gerenteId: 1,
    };

    // CENÁRIO DE FALHA: Tentar inserir log com autorId null
    try {
      await unitOfWork.withTransaction(async (tx) => {
        // 1. Criar proposta (sucesso)
        await tx.insert(propostas).values(mockProposta);
        
        // 2. Forçar erro: tentar criar log com autorId null (violação NOT NULL)
        await tx.insert(propostaLogs).values({
          propostaId: testPropostaId,
          autorId: null as any, // Forçar erro
          statusNovo: 'RASCUNHO',
        });
      });
      
      // Se chegou aqui, o teste falhou
      expect.fail('Transação deveria ter falhado');
    } catch (error) {
      console.log('🔥 Erro esperado capturado:', error);
    }

    // VERIFICAR: Nenhuma proposta foi salva (ROLLBACK funcionou)
    const savedPropostas = await db.select().from(propostas).where(eq(propostas.id, testPropostaId));
    expect(savedPropostas).toHaveLength(0);

    // VERIFICAR: Nenhum log foi salvo (ROLLBACK funcionou)
    const savedLogs = await db.select().from(propostaLogs).where(eq(propostaLogs.propostaId, testPropostaId));
    expect(savedLogs).toHaveLength(0);

    console.log('✅ UoW ROLLBACK Test: Transação revertida com sucesso - ZERO DADOS PERSISTIDOS');
  });

  test('PROVA UoW #3: Business Operation Pattern', async () => {
    const result = await unitOfWork.withBusinessOperation(async (repositories) => {
      const mockProposta = {
        id: testPropostaId,
        numeroProposta: 123458,
        status: 'RASCUNHO',
        clienteData: { nome: 'Cliente Business', cpf: '98765432100' },
        condicoesData: { valor: 15000, prazo: 24 },
        produtoId: 1,
        lojaId: 1,
        parceiroId: 1,
        gerenteId: 1,
      };

      const mockLog = {
        autorId: 'business-user',
        statusNovo: 'RASCUNHO',
        observacao: 'Operação de negócio complexa',
      };

      return await repositories.propostas.createWithLogs(mockProposta, mockLog);
    });

    // VERIFICAR: Operação complexa executada com sucesso
    const savedProposta = await db.select().from(propostas).where(eq(propostas.id, result.id));
    expect(savedProposta).toHaveLength(1);

    const savedLogs = await db.select().from(propostaLogs).where(eq(propostaLogs.propostaId, result.id));
    expect(savedLogs).toHaveLength(1);

    console.log('✅ Business Operation Test: Repositórios transacionais funcionando');
  });
});