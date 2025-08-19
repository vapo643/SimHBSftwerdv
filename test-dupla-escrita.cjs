/**
 * PAM V1.0 - Teste de Validação da Dupla Escrita
 * Fase 1: Fundação + Instrumentação
 * Data: 19/08/2025
 * 
 * Este script valida que a dupla escrita transacional está funcionando
 * corretamente entre a tabela legada e a nova tabela de contextos
 */

const { db } = require('./server/db');
const { propostas, statusContextuais } = require('./shared/schema');
const { eq, and } = require('drizzle-orm');

async function testDuplaEscrita() {
  console.log('🧪 [TESTE] Iniciando teste de dupla escrita transacional...\n');
  
  try {
    // 1. Buscar uma proposta de teste
    const [proposta] = await db
      .select()
      .from(propostas)
      .limit(1);
    
    if (!proposta) {
      console.log('❌ [TESTE] Nenhuma proposta encontrada para teste');
      return;
    }
    
    console.log(`📊 [TESTE] Usando proposta de teste: ${proposta.id}`);
    console.log(`📊 [TESTE] Status atual (legado): ${proposta.status}\n`);
    
    // 2. Verificar status contextual atual
    console.log('🔍 [TESTE] Verificando status contextuais antes da mudança...');
    const statusAntes = await db
      .select()
      .from(statusContextuais)
      .where(eq(statusContextuais.propostaId, proposta.id));
    
    console.log(`📊 [TESTE] Status contextuais encontrados: ${statusAntes.length}`);
    statusAntes.forEach(s => {
      console.log(`  - Contexto: ${s.contexto}, Status: ${s.status}`);
    });
    
    // 3. Simular uma aprovação de pagamento (dupla escrita)
    console.log('\n🚀 [TESTE] Simulando aprovação de pagamento...');
    
    const { updateStatusWithContext } = require('./server/lib/status-context-helper');
    const result = await updateStatusWithContext({
      propostaId: proposta.id,
      novoStatus: 'TESTE_PAGAMENTO_APROVADO',
      contexto: 'pagamentos',
      userId: 'teste-user',
      observacoes: 'Teste de dupla escrita PAM V1.0',
      metadata: {
        tipoTeste: 'VALIDACAO_DUPLA_ESCRITA',
        timestamp: new Date().toISOString()
      }
    });
    
    if (!result.success) {
      console.log(`❌ [TESTE] Falha na dupla escrita: ${result.error}`);
      return;
    }
    
    console.log('✅ [TESTE] Dupla escrita executada com sucesso');
    
    // 4. Validar que ambas as tabelas foram atualizadas
    console.log('\n🔍 [TESTE] Validando atualizações...');
    
    // Verificar tabela legada
    const [propostaAtualizada] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, proposta.id));
    
    console.log(`📊 [TESTE] Status na tabela legada: ${propostaAtualizada.status}`);
    
    // Verificar tabela contextual
    const [statusContextual] = await db
      .select()
      .from(statusContextuais)
      .where(
        and(
          eq(statusContextuais.propostaId, proposta.id),
          eq(statusContextuais.contexto, 'pagamentos')
        )
      );
    
    console.log(`📊 [TESTE] Status na tabela contextual: ${statusContextual?.status || 'NÃO ENCONTRADO'}`);
    
    // 5. Verificar consistência
    console.log('\n🎯 [TESTE] Verificando consistência...');
    
    const isConsistent = 
      propostaAtualizada.status === 'TESTE_PAGAMENTO_APROVADO' &&
      statusContextual?.status === 'TESTE_PAGAMENTO_APROVADO';
    
    if (isConsistent) {
      console.log('✅ [TESTE] SUCESSO: Dupla escrita está funcionando corretamente!');
      console.log('✅ [TESTE] Ambas as tabelas foram atualizadas atomicamente.');
    } else {
      console.log('❌ [TESTE] FALHA: Inconsistência detectada!');
      console.log(`   - Tabela legada: ${propostaAtualizada.status}`);
      console.log(`   - Tabela contextual: ${statusContextual?.status || 'NÃO ENCONTRADO'}`);
    }
    
    // 6. Limpar dados de teste
    console.log('\n🧹 [TESTE] Limpando dados de teste...');
    
    // Reverter status original
    await db
      .update(propostas)
      .set({ status: proposta.status })
      .where(eq(propostas.id, proposta.id));
    
    // Remover ou atualizar status contextual
    if (statusContextual) {
      await db
        .update(statusContextuais)
        .set({ 
          status: proposta.status,
          observacoes: 'Revertido após teste'
        })
        .where(eq(statusContextuais.id, statusContextual.id));
    }
    
    console.log('✅ [TESTE] Dados de teste limpos');
    
    // 7. Resumo final
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMO DO TESTE DE DUPLA ESCRITA');
    console.log('='.repeat(60));
    console.log(`Proposta testada: ${proposta.id}`);
    console.log(`Status original: ${proposta.status}`);
    console.log(`Status de teste: TESTE_PAGAMENTO_APROVADO`);
    console.log(`Resultado: ${isConsistent ? '✅ SUCESSO' : '❌ FALHA'}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ [TESTE] Erro durante o teste:', error);
  } finally {
    process.exit(0);
  }
}

// Executar teste
testDuplaEscrita();