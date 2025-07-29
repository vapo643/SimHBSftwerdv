import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../server/app';
import { createServerSupabaseAdminClient } from '../server/lib/supabase';
import { propostas } from '@shared/schema';

let app: Express;
let adminClient: any;
let testUserId: string;
let testLojaId: number;
let testToken: string;

// Helper para criar token de teste
async function createTestUser(role: string = 'ATENDENTE') {
  const adminClient = createServerSupabaseAdminClient();
  
  // Criar usuário de teste
  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: `test-${Date.now()}@example.com`,
    password: 'Test123456!',
    email_confirm: true
  });

  if (authError || !authUser.user) throw new Error('Failed to create test user');

  // Criar profile no banco
  const { data: profile } = await adminClient
    .from('profiles')
    .insert({
      id: authUser.user.id,
      email: authUser.user.email,
      full_name: 'Test User',
      role,
      loja_id: testLojaId
    })
    .select()
    .single();

  // Fazer login para obter token
  const { data: session } = await adminClient.auth.signInWithPassword({
    email: authUser.user.email!,
    password: 'Test123456!'
  });

  return {
    userId: authUser.user.id,
    token: session?.session?.access_token || '',
    profile
  };
}

// Helper para limpar dados de teste
async function cleanupTestData() {
  const adminClient = createServerSupabaseAdminClient();
  
  // Limpar propostas de teste
  await adminClient
    .from('propostas')
    .delete()
    .ilike('id', 'PROP-TEST-%');
    
  // Limpar logs de teste
  await adminClient
    .from('proposta_logs')
    .delete()
    .ilike('proposta_id', 'PROP-TEST-%');
}

describe('Propostas API', () => {
  beforeAll(async () => {
    app = await createApp();
    adminClient = createServerSupabaseAdminClient();
    
    // Criar loja de teste
    const { data: loja } = await adminClient
      .from('lojas')
      .insert({
        parceiro_id: 1, // Assumindo que existe um parceiro ID 1
        nome_loja: 'Loja de Teste',
        endereco: 'Endereço de Teste'
      })
      .select()
      .single();
      
    testLojaId = loja.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    
    // Limpar loja de teste
    if (testLojaId) {
      await adminClient
        .from('lojas')
        .delete()
        .eq('id', testLojaId);
    }
  });

  beforeEach(async () => {
    // Criar usuário de teste fresco para cada teste
    const testUser = await createTestUser();
    testUserId = testUser.userId;
    testToken = testUser.token;
  });

  describe('POST /api/propostas - Criação de Proposta', () => {
    it('deve criar uma proposta com dados completos do cliente e do empréstimo', async () => {
      const proposalData = {
        clienteData: {
          nome: 'João Silva',
          cpf: '12345678901',
          email: 'joao@example.com',
          telefone: '11999999999',
          rg: '123456789',
          orgaoEmissor: 'SSP',
          estadoCivil: 'Solteiro',
          nacionalidade: 'Brasileira',
          cep: '01310100',
          endereco: 'Av Paulista, 1000',
          ocupacao: 'Desenvolvedor'
        },
        condicoesData: {
          valor: 50000,
          prazo: 24,
          finalidade: 'Capital de Giro',
          garantia: 'Fiança'
        },
        produtoId: 1,
        tabelaComercialId: 1,
        lojaId: testLojaId
      };
      
      const response = await request(app)
        .post('/api/propostas')
        .set('Authorization', `Bearer ${testToken}`)
        .send(proposalData);
      
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.stringMatching(/^\d+$/),
        status: 'rascunho',
        clienteData: expect.objectContaining({
          nome: 'João Silva',
          cpf: '12345678901'
        }),
        condicoesData: expect.objectContaining({
          valor: 50000,
          prazo: 24
        })
      });
    });

    it('deve retornar erro 400 para dados inválidos', async () => {
      const invalidData = {
        clienteData: {
          // Faltando campos obrigatórios
          nome: 'João'
        },
        condicoesData: {
          valor: -1000 // Valor inválido
        }
      };
      
      const response = await request(app)
        .post('/api/propostas')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('deve retornar erro 401 sem autenticação', async () => {
      const response = await request(app)
        .post('/api/propostas')
        .send({});
      
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/propostas/:id/status - Workflow de Análise', () => {
    let testProposalId: string;

    beforeEach(async () => {
      // Criar proposta de teste
      const { data: proposta } = await adminClient
        .from('propostas')
        .insert({
          id: `PROP-TEST-${Date.now()}`,
          loja_id: testLojaId,
          user_id: testUserId,
          status: 'aguardando_analise',
          cliente_data: { nome: 'Cliente Teste' },
          condicoes_data: { valor: 10000, prazo: 12 }
        })
        .select()
        .single();
        
      testProposalId = proposta.id;
    });

    it('deve aplicar controle de acesso baseado em role (RBAC)', async () => {
      // ATENDENTE tentando aprovar (deve falhar)
      const atendenteToken = testToken; // Já é ATENDENTE por padrão
      
      const response = await request(app)
        .put(`/api/propostas/${testProposalId}/status`)
        .set('Authorization', `Bearer ${atendenteToken}`)
        .send({
          status: 'aprovado',
          observacao: 'Tentativa inválida'
        });
      
      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Atendentes só podem reenviar');
    });

    it('deve permitir ATENDENTE reenviar proposta pendenciada', async () => {
      // Primeiro, colocar proposta como pendenciada
      await adminClient
        .from('propostas')
        .update({ status: 'pendenciado' })
        .eq('id', testProposalId);
      
      const response = await request(app)
        .put(`/api/propostas/${testProposalId}/status`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          status: 'aguardando_analise',
          observacao: 'Correções realizadas'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('aguardando_analise');
    });

    it('deve criar log de auditoria para mudanças de status', async () => {
      // Criar usuário ANALISTA
      const analista = await createTestUser('ANALISTA');
      
      const response = await request(app)
        .put(`/api/propostas/${testProposalId}/status`)
        .set('Authorization', `Bearer ${analista.token}`)
        .send({
          status: 'aprovado',
          observacao: 'Proposta aprovada',
          valorAprovado: 10000
        });
      
      expect(response.status).toBe(200);
      
      // Verificar se log foi criado
      const { data: logs } = await adminClient
        .from('proposta_logs')
        .select()
        .eq('proposta_id', testProposalId);
      
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        status_anterior: 'aguardando_analise',
        status_novo: 'aprovado',
        observacao: 'Proposta aprovada'
      });
    });
  });

  describe('GET /api/propostas - Listagem com Filtros', () => {
    beforeEach(async () => {
      // Criar várias propostas de teste com diferentes status
      const statuses = ['aguardando_analise', 'em_analise', 'aprovado', 'rejeitado'];
      
      for (const status of statuses) {
        await adminClient
          .from('propostas')
          .insert({
            id: `PROP-TEST-${status}-${Date.now()}`,
            loja_id: testLojaId,
            user_id: testUserId,
            status,
            cliente_data: { nome: `Cliente ${status}` },
            condicoes_data: { valor: 10000, prazo: 12 }
          });
      }
    });

    it('deve aplicar filtro de fila de análise corretamente', async () => {
      const response = await request(app)
        .get('/api/propostas')
        .query({ queue: 'analysis' })
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      
      // Verificar se todos os resultados têm status correto
      response.body.forEach((proposta: any) => {
        expect(['aguardando_analise', 'em_analise']).toContain(proposta.status);
      });
    });

    it('deve aplicar múltiplos filtros simultaneamente', async () => {
      const response = await request(app)
        .get('/api/propostas')
        .query({
          status: 'aguardando_analise',
          atendenteId: testUserId
        })
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      
      response.body.forEach((proposta: any) => {
        expect(proposta.status).toBe('aguardando_analise');
        expect(proposta.userId).toBe(testUserId);
      });
    });

    it('deve ter performance adequada para grandes volumes', async () => {
      // Criar 100 propostas de teste
      const bulkData = Array(100).fill(null).map((_, i) => ({
        id: `PROP-TEST-PERF-${Date.now()}-${i}`,
        loja_id: testLojaId,
        user_id: testUserId,
        status: 'aguardando_analise',
        cliente_data: { nome: `Cliente ${i}` },
        condicoes_data: { valor: 10000 + i, prazo: 12 }
      }));
      
      await adminClient.from('propostas').insert(bulkData);
      
      const start = Date.now();
      const response = await request(app)
        .get('/api/propostas')
        .set('Authorization', `Bearer ${testToken}`);
      const duration = Date.now() - start;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500); // Deve responder em menos de 500ms
    });
  });
});