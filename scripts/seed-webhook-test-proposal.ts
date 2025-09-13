#!/usr/bin/env tsx

/**
 * PAM V1.0 - OPERAÇÃO BANDEIRA FALSA
 * Script de Seed para Criação de Proposta de Teste
 * 
 * OBJETIVO: Inserir uma proposta no banco com status AGUARDANDO_ASSINATURA
 * para validar o sistema de webhooks ClickSign
 */

import { db } from '../server/lib/supabase';
import { propostas, lojas, produtos, parceiros, type InsertProposta } from '../shared/schema';
import { v4 as uuidv4 } from 'uuid';

interface TestPropostaData {
  id: string;
  clicksignDocumentKey: string;
  nomeCliente: string;
  cpfCliente: string;
}

async function seedTestProposta(): Promise<TestPropostaData> {
  console.log('🧪 [OPERAÇÃO BANDEIRA FALSA] Iniciando seed de proposta de teste...');

  // Passo 1: Garantir que existe parceiro, loja e produto
  try {
    // Criar parceiro de teste se não existir
    await db.insert(parceiros).values({
      id: 1,
      razaoSocial: 'PARCEIRO TESTE WEBHOOK',
      cnpj: '12345678000123',
      responsavelNome: 'Responsável Teste',
      responsavelEmail: 'teste@webhook.com'
    }).onConflictDoNothing();

    // Criar loja de teste se não existir
    await db.insert(lojas).values({
      id: 1,
      nomeLoja: 'LOJA TESTE WEBHOOK',
      parceiroId: 1,
      cnpj: '12345678000123',
      responsavelNome: 'Responsável Loja',
      responsavelEmail: 'loja@webhook.com'
    }).onConflictDoNothing();

    // Criar produto de teste se não existir
    await db.insert(produtos).values({
      id: 1,
      nome: 'PRODUTO TESTE WEBHOOK',
      categoria: 'TESTE',
      ativo: true
    }).onConflictDoNothing();

    console.log('✅ [SEED] Entidades auxiliares criadas/verificadas');

  } catch (error) {
    console.warn('⚠️ [SEED] Erro ao criar entidades auxiliares (podem já existir):', error);
  }
  const testPropostaId = uuidv4();
  const clicksignDocumentKey = uuidv4(); // Simula document key da ClickSign

  // Gerar número de proposta único para teste
  const numeroProposta = 999999; // Número alto para evitar conflitos

  // Dados MÍNIMOS da proposta de teste - apenas campos obrigatórios
  const testProposta: InsertProposta = {
    id: testPropostaId,
    numeroProposta: numeroProposta,
    lojaId: 1,
    produtoId: 1, // Assumindo produto ID 1 existe
    status: 'AGUARDANDO_ASSINATURA',
    finalidade: 'TESTE_WEBHOOK_SIMULACAO',
    garantia: 'SEM_GARANTIA',
    clicksignDocumentKey: clicksignDocumentKey,
    contratoGerado: true,
    observacoesFormalizacao: 'PROPOSTA CRIADA PARA TESTE DE WEBHOOK - PAM V1.0',
    // Campos obrigatórios mínimos
    clienteData: JSON.stringify({
      nome: 'CLIENTE TESTE WEBHOOK',
      cpf: '12345678901',
      email: 'cliente.teste@simpix.com.br',
      telefone: '11999999999',
      dataNascimento: '1990-01-01',
      renda: 5000
    }),
    condicoesData: JSON.stringify({
      valor: 25000,
      prazo: 12,
      finalidade: 'TESTE_WEBHOOK_SIMULACAO',
      garantia: 'SEM_GARANTIA'
    })
  };

  try {
    // Inserir proposta de teste
    await db.insert(propostas).values(testProposta);

    console.log('✅ [SEED] Proposta de teste criada com sucesso!');
    console.log('📋 [DADOS DO TESTE]');
    console.log(`   - ID da Proposta: ${testPropostaId}`);
    console.log(`   - ClickSign Document Key: ${clicksignDocumentKey}`);
    console.log(`   - Nome Cliente: ${testProposta.nomeCliente}`);
    console.log(`   - Status: ${testProposta.status}`);
    console.log('');
    console.log('🎯 [PRÓXIMO PASSO] Use estes dados no script de simulação do webhook');

    return {
      id: testPropostaId,
      clicksignDocumentKey: clicksignDocumentKey,
      nomeCliente: testProposta.nomeCliente!,
      cpfCliente: testProposta.cpfCliente!
    };

  } catch (error) {
    console.error('❌ [ERRO] Falha ao criar proposta de teste:', error);
    throw error;
  }
}

// Executar se chamado diretamente (ES modules)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedTestProposta()
    .then((data) => {
      console.log('🚀 [CONCLUÍDO] Seed executado com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 [FALHA] Erro durante execução do seed:', error);
      process.exit(1);
    });
}

export { seedTestProposta };
export type { TestPropostaData };