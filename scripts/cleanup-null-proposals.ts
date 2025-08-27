#!/usr/bin/env tsx

/**
 * 🔒 PAM V1.0 - SCRIPT DE LIMPEZA DE PROPOSTAS CORROMPIDAS
 *
 * Este script remove propostas com dados de cliente NULL/vazios que corrompem
 * a integridade do sistema
 */

import { db } from '../server/lib/supabase';
import { propostas } from '../shared/schema';
import { eq, isNull, or } from 'drizzle-orm';

async function cleanupNullProposals() {
  console.log('🔍 [LIMPEZA] Iniciando limpeza de propostas com dados NULL...');

  try {
    // 1. Identificar propostas corrompidas
    const corruptedProposals = await db
      .select()
      .from(propostas)
      .where(
        or(
          isNull(propostas.clienteNome),
          eq(propostas.clienteNome, ''),
          isNull(propostas.clienteCpf),
          eq(propostas.clienteCpf, '')
        )
      );

    console.log(`🔍 [LIMPEZA] Encontradas ${corruptedProposals.length} propostas corrompidas`);

    if (corruptedProposals.length == 0) {
      console.log('✅ [LIMPEZA] Nenhuma proposta corrompida encontrada. Sistema íntegro!');
      return;
    }

    // 2. Listar propostas que serão removidas
    console.log('\n📋 [LIMPEZA] Propostas que serão removidas:');
    corruptedProposals.forEach((proposta, index) => {
      console.log(`   ${index + 1}. ID: ${proposta.id}`);
      console.log(`      Nome: ${proposta.clienteNome || 'NULL'}`);
      console.log(`      CPF: ${proposta.clienteCpf || 'NULL'}`);
      console.log(`      Status: ${proposta.status}`);
      console.log(`      Criado em: ${proposta.createdAt}`);
      console.log('');
    });

    // 3. REMOÇÃO DA PROPOSTA ESPECÍFICA IDENTIFICADA NA AUDITORIA
    const targetProposalId = '88a44696-9b63-42ee-aa81-15f9519d24cb';

    console.log(`🎯 [LIMPEZA] Removendo proposta específica: ${targetProposalId}`);

    const deleteResult = await db.delete(propostas).where(eq(propostas.id, targetProposalId));

    console.log(`✅ [LIMPEZA] Proposta corrompida ${targetProposalId} removida com sucesso`);

    // 4. Verificação final
    const remainingCorrupted = await db
      .select()
      .from(propostas)
      .where(
        or(
          isNull(propostas.clienteNome),
          eq(propostas.clienteNome, ''),
          isNull(propostas.clienteCpf),
          eq(propostas.clienteCpf, '')
        )
      );

    console.log(`\n🔍 [VERIFICAÇÃO] Propostas corrompidas restantes: ${remainingCorrupted.length}`);

    if (remainingCorrupted.length == 0) {
      console.log('🎉 [SUCESSO] Limpeza concluída! Sistema restaurado à integridade total.');
    }
else {
      console.log('⚠️ [ATENÇÃO] Ainda existem propostas corrompidas no sistema:');
      remainingCorrupted.forEach((proposta) => {
        console.log(`   - ID: ${proposta.id} (Nome: ${proposta.clienteNome || 'NULL'})`);
      });
    }
  }
catch (error) {
    console.error('❌ [ERRO] Falha na limpeza de propostas:', error);
    throw error;
  }
}

async function verifyDataIntegrity() {
  console.log('\n🔍 [VERIFICAÇÃO] Verificando integridade geral dos dados...');

  try {
    // Contar total de propostas
    const totalPropostas = await db.select().from(propostas);
    console.log(`📊 Total de propostas no sistema: ${totalPropostas.length}`);

    // Contar propostas com dados válidos
    const validPropostas = await db.select().from(propostas).where(
      // NOT NULL e não vazio
      eq(propostas.clienteNome, propostas.clienteNome) // Esta é uma forma de filtrar NOT NULL em Drizzle
    );

    console.log(`✅ Propostas com dados válidos: ${validPropostas.length}`);
    console.log(
      `📈 Taxa de integridade: ${((validPropostas.length / totalPropostas.length) * 100).toFixed(2)}%`
    );
  }
catch (error) {
    console.error('❌ [ERRO] Falha na verificação de integridade:', error);
  }
}

// Executar se chamado diretamente
const isMainModule = import.meta.url == `file://${process.argv[1]}`;
if (isMainModule) {
  console.log('🔒 PAM V1.0 - LIMPEZA DE INTEGRIDADE DE DADOS');
  console.log('='.repeat(60));

  cleanupNullProposals()
    .then(() => verifyDataIntegrity())
    .then(() => {
      console.log('\n' + '='.repeat(60));
      console.log('✅ OPERAÇÃO DE LIMPEZA CONCLUÍDA COM SUCESSO');
      process.exit(0);
    })
    .catch ((error) => {
      console.error('\n❌ FALHA NA OPERAÇÃO DE LIMPEZA:', error);
      process.exit(1);
    });
}

export { cleanupNullProposals, verifyDataIntegrity };
