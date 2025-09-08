/**
 * TESTE DE INTEGRAÇÃO - CONTRATO DA API DE PROPOSTAS
 * PAM V1.0 - BLINDAGEM AUTOMATIZADA DE REGRESSÃO
 * 
 * Este teste valida o contrato de dados do endpoint GET /api/propostas/:id
 * para prevenir regressões de "dados ausentes" entre backend e frontend.
 * 
 * Implementa validação rigorosa usando Zod schema e verificações específicas
 * de campos críticos para garantir integridade do payload da API.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { ProposalOutputSchema } from '../../schemas/proposalOutput.schema';
import { cleanTestDatabase, setupTestEnvironment } from '../../../tests/lib/db-helper';

// Express application instance
let app: Express;

describe('🛡️ PROPOSAL CONTRACT INTEGRATION TEST - PAM V1.0', () => {
  let testEnvironment: Awaited<ReturnType<typeof setupTestEnvironment>>;
  let testProposalId: string;

  beforeEach(async () => {
    console.log('🧹 [SETUP] Cleaning test database...');
    await cleanTestDatabase();
    
    console.log('🔧 [SETUP] Setting up test environment...');
    testEnvironment = await setupTestEnvironment();
    
    // Create the Express app exactly as in production
    app = await createApp();
    
    console.log('📝 [SETUP] Creating test proposal...');
    // Create a test proposal with complete data using the production endpoint
    const proposalData = {
      cliente: {
        nome: 'João Silva Test Contract',
        cpf: '12345678901',
        email: 'joao.test@exemplo.com',
        telefone: '11999999999',
        renda_mensal: 5000,
        ocupacao: 'Analista',
        data_nascimento: '1990-01-15',
        endereco: 'Rua Test, 123',
        cep: '01234567',
        cidade: 'São Paulo',
        estado: 'SP',
        nacionalidade: 'BRASILEIRO',
        estado_civil: 'solteiro',
        rg: '123456789',
        orgao_emissor: 'SSP-SP'
      },
      valor: 10000,
      prazo: 24,
      finalidade: 'Capital de Giro',
      garantia: 'Sem Garantia',
      produto_id: testEnvironment.testProductId,
      tabela_comercial_id: testEnvironment.testCommercialTableId,
      loja_id: testEnvironment.testStoreId
    };

    const createResponse = await request(app)
      .post('/api/propostas')
      .set('Authorization', `Bearer test-token-${testEnvironment.testUserId}`)
      .send(proposalData);

    if (createResponse.status !== 201) {
      console.error('❌ Failed to create test proposal:', createResponse.body);
      throw new Error(`Failed to create test proposal: ${createResponse.status}`);
    }

    testProposalId = createResponse.body.data.id;
    console.log(`✅ [SETUP] Test proposal created with ID: ${testProposalId}`);
  });

  afterEach(async () => {
    console.log('🧹 [CLEANUP] Cleaning test database...');
    await cleanTestDatabase();
  });

  it('🎯 should return valid proposal data that matches ProposalOutputSchema contract', async () => {
    console.log(`🔍 [TEST] Testing GET /api/propostas/${testProposalId}`);
    
    // Make request to the actual endpoint
    const response = await request(app)
      .get(`/api/propostas/${testProposalId}`)
      .set('Authorization', `Bearer test-token-${testEnvironment.testUserId}`)
      .expect(200);

    console.log('✅ [TEST] Response status is 200 OK');

    // Validate response structure using Zod schema
    const parsed = ProposalOutputSchema.safeParse(response.body);
    
    if (!parsed.success) {
      console.error('❌ [CONTRACT VIOLATION] Schema validation failed:');
      console.error('📋 Validation errors:', JSON.stringify(parsed.error.issues, null, 2));
      console.error('📋 Response body structure:', JSON.stringify(response.body, null, 2));
      
      // Log specific field issues for debugging
      for (const issue of parsed.error.issues) {
        console.error(`🔍 Field: ${issue.path.join('.')} - Error: ${issue.message}`);
      }
    }

    // CRITICAL: Schema validation must pass
    expect(parsed.success).toBe(true);
    console.log('✅ [CONTRACT] ProposalOutputSchema validation passed');

    const proposalData = response.body.data;

    // Verify critical fields are present and not empty/null/undefined
    expect(proposalData.id).toBeTruthy();
    expect(typeof proposalData.id).toBe('string');
    console.log('✅ [FIELD] id is present and valid');

    expect(proposalData.status).toBeTruthy();
    expect(typeof proposalData.status).toBe('string');
    console.log('✅ [FIELD] status is present and valid');

    // Verify client data is present (can be JSON string or object)
    expect(proposalData.cliente_data).toBeDefined();
    console.log('✅ [FIELD] cliente_data is present');

    // Verify financial data fields
    expect(proposalData.valor).toBeDefined();
    expect(proposalData.prazo).toBeDefined();
    console.log('✅ [FIELD] Financial data (valor, prazo) present');

    // Verify optional but critical fields when present
    if (proposalData.finalidade) {
      expect(proposalData.finalidade).not.toBe('N/A');
      expect(typeof proposalData.finalidade).toBe('string');
      console.log('✅ [FIELD] finalidade is valid (not N/A)');
    }

    if (proposalData.garantia) {
      expect(proposalData.garantia).not.toBe('N/A');
      expect(typeof proposalData.garantia).toBe('string');
      console.log('✅ [FIELD] garantia is valid (not N/A)');
    }

    // Verify relational data is properly populated
    if (proposalData.loja_id) {
      expect(typeof proposalData.loja_id).toBe('number');
      expect(proposalData.loja_id).toBeGreaterThan(0);
      console.log('✅ [FIELD] loja_id is valid');
    }

    if (proposalData.produto_id) {
      expect(typeof proposalData.produto_id).toBe('number');
      expect(proposalData.produto_id).toBeGreaterThan(0);
      console.log('✅ [FIELD] produto_id is valid');
    }

    // Verify timestamps are present and valid
    expect(proposalData.created_at || proposalData.createdAt).toBeDefined();
    console.log('✅ [FIELD] Timestamp fields present');

    // Log success summary
    console.log('🎉 [SUCCESS] All contract validations passed:');
    console.log(`   📋 Schema validation: ✅`);
    console.log(`   🔑 ID field: ✅ (${proposalData.id})`);
    console.log(`   📊 Status field: ✅ (${proposalData.status})`);
    console.log(`   👤 Client data: ✅`);
    console.log(`   💰 Financial data: ✅`);
    console.log(`   🏪 Relational data: ✅`);
    console.log(`   ⏰ Timestamps: ✅`);
  });

  it('🚨 should handle non-existent proposal ID gracefully', async () => {
    console.log('🔍 [TEST] Testing GET /api/propostas/non-existent-id');
    
    const response = await request(app)
      .get('/api/propostas/non-existent-id')
      .set('Authorization', `Bearer test-token-${testEnvironment.testUserId}`)
      .expect(404);

    console.log('✅ [TEST] Non-existent proposal returns 404 as expected');
    
    // Verify error response structure
    expect(response.body).toHaveProperty('success');
    expect(response.body.success).toBe(false);
    expect(response.body).toHaveProperty('error');
    console.log('✅ [ERROR HANDLING] Error response structure is valid');
  });

  it('🔐 should require authentication for proposal access', async () => {
    console.log('🔍 [TEST] Testing GET /api/propostas/:id without authorization');
    
    const response = await request(app)
      .get(`/api/propostas/${testProposalId}`)
      .expect(401);

    console.log('✅ [SECURITY] Unauthorized request returns 401 as expected');
    
    // Verify authentication error response
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBeTruthy();
    console.log('✅ [SECURITY] Authentication error message is present');
  });
});