/**
 * Unit of Work Pattern - Integration Tests
 * 
 * AUDITORIA FORENSE - PAM V1.2
 * Testa atomicidade de transações e rollback em cenários de falha
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { unitOfWork } from '../../server/lib/unit-of-work';
import { db } from '../../server/lib/supabase';
import { propostas, propostaLogs, users, gerenteLojas } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

describe('Unit of Work - Auditoria Forense', () => {
  const testPropostaId = uuidv4();
  const testUserId = '3fff3936-3cee-4e02-ab27-4e4b452e3efe'; // Usuário real do Supabase Auth
  
  beforeEach(async () => {
    // Criar dados de teste válidos - executar separadamente devido à limitação do PostgreSQL
    await db.execute(sql`
      INSERT INTO parceiros (id, razao_social, cnpj, comissao_padrao) 
      VALUES (999, 'Parceiro Teste LTDA', '12345678000199', 5.00)
      ON CONFLICT (id) DO NOTHING
    `);
    
    await db.execute(sql`
      INSERT INTO lojas (id, parceiro_id, nome_loja, endereco, is_active)
      VALUES (999, 999, 'Loja Teste Integração', 'Rua Teste, 123', true)
      ON CONFLICT (id) DO NOTHING
    `);
    
    await db.execute(sql`
      INSERT INTO produtos (id, nome_produto)
      VALUES (999, 'Produto Teste Integração')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Criar profile para usuário real do Supabase - ESSENTIAL para business rule validation
    await db.execute(sql`
      INSERT INTO profiles (id, full_name, role, loja_id)
      VALUES (${testUserId}, 'Usuário Teste Integração', 'ADMINISTRADOR', 999)
      ON CONFLICT (id) DO UPDATE SET 
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        loja_id = EXCLUDED.loja_id
    `);
    
    // CRITICAL: Criar associação gerente-loja para satisfazer validate_proposta_integrity()
    // gerente_id é UUID que referencia profiles.id, não users.id
    await db.execute(sql`
      INSERT INTO gerente_lojas (gerente_id, loja_id)
      VALUES (${testUserId}, 999)
      ON CONFLICT (gerente_id, loja_id) DO NOTHING
    `);
    
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
      clienteNome: 'Cliente Teste',
      clienteCpf: '12345678901',
      produtoId: 999,
      lojaId: 999,
      userId: testUserId, // CRITICAL: Field required by enforce_proposta_integrity trigger
    };

    const mockLog = {
      propostaId: testPropostaId,
      autorId: testUserId,
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
    const mockPropostaFalha = {
      id: testPropostaId,
      numeroProposta: 123457,
      status: 'RASCUNHO',
      clienteNome: 'Cliente Teste 2',
      clienteCpf: '12345678901',
      produtoId: 999,
      lojaId: 999,
      userId: testUserId, // CRITICAL: Field required by enforce_proposta_integrity trigger
    };

    // CENÁRIO DE FALHA: Tentar inserir log com autorId null
    try {
      await unitOfWork.withTransaction(async (tx) => {
        // 1. Criar proposta (sucesso)
        await tx.insert(propostas).values(mockPropostaFalha);
        
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
      // Create proper Domain Object with correct schema fields
      const mockProposta = {
        id: testPropostaId,
        numeroProposta: 123458,
        status: 'RASCUNHO',
        clienteNome: 'Cliente Business',
        clienteCpf: '98765432100',
        clienteEmail: 'teste@example.com',
        produtoId: 999,
        lojaId: 999,
        userId: testUserId, // CRITICAL: Field required by enforce_proposta_integrity trigger
        // Add missing required fields for schema compatibility
        valor: 5000.00,
        prazo: 12,
        taxaJuros: 2.5,
      };

      const mockLog = {
        autorId: testUserId,
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