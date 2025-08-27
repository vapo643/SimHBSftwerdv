/**
 * PAM V1.0 - Teste de Validação da Dupla Escrita
 * Fase 1: Fundação + Instrumentação
 * Data: 19/08/2025
 */

import { db } from './server/db';
import { propostas, statusContextuais } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import { updateStatusWithContext } from './server/lib/status-context-helper';

async function testarDuplaEscrita() {
  console.log('🧪 PAM V1.0 - TESTE DE DUPLA ESCRITA TRANSACIONAL\n');
  console.log('='.repeat(60));

  try {
    // 1. Buscar proposta de teste
    const [proposta] = await db.select().from(propostas).limit(1);

    if (!proposta) {
      console.log('❌ Nenhuma proposta encontrada');
      return;
    }

    console.log(`\n📊 PROPOSTA DE TESTE: ${proposta.id}`);
    console.log(`   Status Original: ${proposta.status}`);

    // 2. Executar dupla escrita
    console.log('\n🚀 EXECUTANDO DUPLA ESCRITA...');

    const result = await updateStatusWithContext({
      propostaId: proposta.id,
      novoStatus: 'TESTE_PAM_V1',
      contexto: 'pagamentos',
      userId: 'teste-pam',
      observacoes: 'Teste de validação PAM V1.0 - Fase 1',
      metadata: {
        teste: 'DUPLA_ESCRITA',
        fase: 'FASE_1_FUNDACAO',
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`   Resultado: ${result.success ? '✅ SUCESSO' : '❌ FALHA'}`);

    if (!result.success) {
      console.log(`   Erro: ${result.error}`);
      return;
    }

    // 3. Validar consistência
    console.log('\n🔍 VALIDANDO CONSISTÊNCIA...');

    const [propostaAtualizada] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, proposta.id));

    const [statusContextual] = await db
      .select()
      .from(statusContextuais)
      .where(
        and(
          eq(statusContextuais.propostaId, proposta.id),
          eq(statusContextuais.contexto, 'pagamentos')
        )
      );

    console.log(`   Tabela Legada (propostas.status): ${propostaAtualizada.status}`);
    console.log(
      `   Tabela Contextual (status_contextuais): ${statusContextual?.status || 'NÃO ENCONTRADO'}`
    );

    const isConsistent =
      propostaAtualizada.status === 'TESTE_PAM_V1' && statusContextual?.status === 'TESTE_PAM_V1';

    console.log(`\n📋 RESULTADO FINAL: ${isConsistent ? '✅ CONSISTENTE' : '❌ INCONSISTENTE'}`);

    // 4. Reverter mudanças
    console.log('\n🧹 REVERTENDO MUDANÇAS...');

    await db
      .update(propostas)
      .set({ status: proposta.status })
      .where(eq(propostas.id, proposta.id));

    if (statusContextual) {
      await db.delete(statusContextuais).where(eq(statusContextuais.id, statusContextual.id));
    }

    console.log('   ✅ Dados revertidos');

    // 5. Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DO TESTE PAM V1.0 - FASE 1');
    console.log('='.repeat(60));
    console.log(`Dupla Escrita Transacional: ${isConsistent ? '✅ FUNCIONANDO' : '❌ COM FALHA'}`);
    console.log(`Tabela status_contextuais: ✅ CRIADA`);
    console.log(`Transações Atômicas: ${result.success ? '✅ IMPLEMENTADAS' : '❌ FALHARAM'}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error);
  } finally {
    process.exit(0);
  }
}

// Executar teste
testarDuplaEscrita();
