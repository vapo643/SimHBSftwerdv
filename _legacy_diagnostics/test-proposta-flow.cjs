/**
 * Teste completo do fluxo de propostas
 * Verifica todas as etapas desde criação até cobrança
 */

const { Pool } = require('pg');

console.log('🔍 AUDITORIA COMPLETA DO FLUXO DE PROPOSTAS');
console.log('============================================\n');

// Conectar ao banco
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkProposalFlow() {
  try {
    // 1. Verificar propostas por status
    console.log('📊 1. PROPOSTAS POR STATUS:');
    const statusQuery = `
      SELECT status, COUNT(*) as total 
      FROM propostas 
      WHERE deleted_at IS NULL 
      GROUP BY status 
      ORDER BY total DESC
    `;
    const statusResult = await pool.query(statusQuery);
    
    if (statusResult.rows.length === 0) {
      console.log('   ❌ Nenhuma proposta encontrada no sistema!');
    } else {
      statusResult.rows.forEach(row => {
        console.log(`   ${row.status}: ${row.total} propostas`);
      });
    }
    
    // 2. Verificar fluxo de criação
    console.log('\n📝 2. FLUXO DE CRIAÇÃO:');
    const recentProposals = await pool.query(`
      SELECT id, status, created_at, loja_id, user_id, produto_id, tabela_comercial_id
      FROM propostas 
      WHERE deleted_at IS NULL 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`   Últimas propostas criadas: ${recentProposals.rows.length}`);
    recentProposals.rows.forEach(p => {
      console.log(`   - ID: ${p.id.substring(0, 8)}... Status: ${p.status}`);
      console.log(`     Loja: ${p.loja_id || 'N/A'}, Produto: ${p.produto_id || 'N/A'}`);
    });
    
    // 3. Verificar fila de análise
    console.log('\n📋 3. FILA DE ANÁLISE:');
    const analiseQueue = await pool.query(`
      SELECT COUNT(*) as total 
      FROM propostas 
      WHERE status IN ('aguardando_analise', 'em_analise') 
      AND deleted_at IS NULL
    `);
    console.log(`   Propostas aguardando análise: ${analiseQueue.rows[0].total}`);
    
    // 4. Verificar ações do analista
    console.log('\n👨‍💼 4. AÇÕES DO ANALISTA:');
    const analystActions = await pool.query(`
      SELECT 
        COUNT(CASE WHEN status = 'aprovado' THEN 1 END) as aprovadas,
        COUNT(CASE WHEN status = 'rejeitado' THEN 1 END) as rejeitadas,
        COUNT(CASE WHEN status = 'pendente' THEN 1 END) as pendentes
      FROM propostas 
      WHERE deleted_at IS NULL
    `);
    const actions = analystActions.rows[0];
    console.log(`   ✅ Aprovadas: ${actions.aprovadas}`);
    console.log(`   ❌ Rejeitadas: ${actions.rejeitadas}`);
    console.log(`   ⏸️  Pendentes: ${actions.pendentes}`);
    
    // 5. Verificar fluxo de pendência
    console.log('\n⏸️  5. FLUXO DE PENDÊNCIA:');
    const pendencyFlow = await pool.query(`
      SELECT p.id, p.created_at, p.updated_at,
             (SELECT COUNT(*) FROM proposta_logs WHERE proposta_id = p.id) as log_count,
             (SELECT COUNT(*) FROM comunicacao_logs WHERE proposta_id = p.id) as comm_count
      FROM propostas p
      WHERE p.status = 'pendente' 
      AND p.deleted_at IS NULL
      LIMIT 5
    `);
    console.log(`   Propostas pendentes: ${pendencyFlow.rows.length}`);
    pendencyFlow.rows.forEach(p => {
      console.log(`   - ID: ${p.id.substring(0, 8)}... Logs: ${p.log_count}, Comunicações: ${p.comm_count}`);
    });
    
    // 6. Verificar geração de CCB
    console.log('\n📄 6. GERAÇÃO DE CCB:');
    const ccbStatus = await pool.query(`
      SELECT 
        COUNT(CASE WHEN ccb_gerado = true THEN 1 END) as com_ccb,
        COUNT(CASE WHEN ccb_gerado = false OR ccb_gerado IS NULL THEN 1 END) as sem_ccb,
        COUNT(CASE WHEN status = 'aprovado' AND (ccb_gerado = false OR ccb_gerado IS NULL) THEN 1 END) as aprovadas_sem_ccb
      FROM propostas 
      WHERE deleted_at IS NULL
    `);
    const ccb = ccbStatus.rows[0];
    console.log(`   ✅ Com CCB gerado: ${ccb.com_ccb}`);
    console.log(`   ❌ Sem CCB: ${ccb.sem_ccb}`);
    console.log(`   ⚠️  Aprovadas sem CCB: ${ccb.aprovadas_sem_ccb}`);
    
    // 7. Verificar integração ClickSign
    console.log('\n✍️  7. INTEGRAÇÃO CLICKSIGN:');
    const clickSignStatus = await pool.query(`
      SELECT 
        COUNT(CASE WHEN clicksign_document_key IS NOT NULL THEN 1 END) as enviados,
        COUNT(CASE WHEN assinatura_eletronica_concluida = true THEN 1 END) as assinados,
        COUNT(CASE WHEN clicksign_status = 'pending' THEN 1 END) as pendentes,
        COUNT(CASE WHEN ccb_gerado = true AND clicksign_document_key IS NULL THEN 1 END) as ccb_nao_enviado
      FROM propostas 
      WHERE deleted_at IS NULL
    `);
    const cs = clickSignStatus.rows[0];
    console.log(`   📤 Enviados: ${cs.enviados}`);
    console.log(`   ✅ Assinados: ${cs.assinados}`);
    console.log(`   ⏳ Pendentes: ${cs.pendentes}`);
    console.log(`   ⚠️  CCB não enviado: ${cs.ccb_nao_enviado}`);
    
    // 8. Verificar fluxo de pagamento
    console.log('\n💰 8. FLUXO DE PAGAMENTO:');
    const paymentStatus = await pool.query(`
      SELECT 
        COUNT(CASE WHEN status = 'pronto_pagamento' THEN 1 END) as prontos,
        COUNT(CASE WHEN status = 'pago' THEN 1 END) as pagos,
        COUNT(CASE WHEN assinatura_eletronica_concluida = true AND status != 'pago' THEN 1 END) as assinados_nao_pagos
      FROM propostas 
      WHERE deleted_at IS NULL
    `);
    const pay = paymentStatus.rows[0];
    console.log(`   📋 Prontos para pagamento: ${pay.prontos}`);
    console.log(`   ✅ Pagos: ${pay.pagos}`);
    console.log(`   ⚠️  Assinados não pagos: ${pay.assinados_nao_pagos}`);
    
    // 9. Verificar integração Banco Inter
    console.log('\n🏦 9. INTEGRAÇÃO BANCO INTER:');
    const interStatus = await pool.query(`
      SELECT 
        COUNT(*) as total_collections,
        COUNT(CASE WHEN status = 'A_RECEBER' THEN 1 END) as a_receber,
        COUNT(CASE WHEN status = 'RECEBIDO' THEN 1 END) as recebidos,
        COUNT(CASE WHEN status = 'CANCELADO' THEN 1 END) as cancelados
      FROM inter_collections
    `);
    
    if (interStatus.rows[0].total_collections === '0') {
      console.log('   ❌ Nenhum boleto gerado ainda');
    } else {
      const inter = interStatus.rows[0];
      console.log(`   📄 Total de boletos: ${inter.total_collections}`);
      console.log(`   ⏳ A receber: ${inter.a_receber}`);
      console.log(`   ✅ Recebidos: ${inter.recebidos}`);
      console.log(`   ❌ Cancelados: ${inter.cancelados}`);
    }
    
    // 10. Verificar logs e auditoria
    console.log('\n📊 10. LOGS E AUDITORIA:');
    const logsStatus = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM proposta_logs) as proposta_logs,
        (SELECT COUNT(*) FROM comunicacao_logs) as comunicacao_logs,
        (SELECT COUNT(*) FROM audit_delete_log) as delete_logs
    `);
    const logs = logsStatus.rows[0];
    console.log(`   📝 Logs de proposta: ${logs.proposta_logs}`);
    console.log(`   💬 Logs de comunicação: ${logs.comunicacao_logs}`);
    console.log(`   🗑️  Logs de exclusão: ${logs.delete_logs}`);
    
    // RESUMO FINAL
    console.log('\n============================================');
    console.log('📊 RESUMO DA AUDITORIA');
    console.log('============================================');
    
    // Identificar problemas
    const problems = [];
    if (ccb.aprovadas_sem_ccb > 0) problems.push(`${ccb.aprovadas_sem_ccb} propostas aprovadas sem CCB`);
    if (cs.ccb_nao_enviado > 0) problems.push(`${cs.ccb_nao_enviado} CCBs não enviados para ClickSign`);
    if (pay.assinados_nao_pagos > 0) problems.push(`${pay.assinados_nao_pagos} contratos assinados não pagos`);
    if (interStatus.rows[0].total_collections === '0') problems.push('Nenhum boleto gerado no Banco Inter');
    
    if (problems.length === 0) {
      console.log('\n✅ FLUXO FUNCIONANDO PERFEITAMENTE!');
    } else {
      console.log('\n⚠️  PROBLEMAS ENCONTRADOS:');
      problems.forEach(p => console.log(`   - ${p}`));
    }
    
    // Recomendações
    console.log('\n💡 RECOMENDAÇÕES:');
    if (ccb.aprovadas_sem_ccb > 0) {
      console.log('   1. Verificar geração automática de CCB após aprovação');
    }
    if (cs.ccb_nao_enviado > 0) {
      console.log('   2. Verificar envio automático para ClickSign após gerar CCB');
    }
    if (pay.assinados_nao_pagos > 0) {
      console.log('   3. Verificar fluxo de pagamento após assinatura');
    }
    if (interStatus.rows[0].total_collections === '0') {
      console.log('   4. Testar integração com Banco Inter para gerar boletos');
    }
    
  } catch (error) {
    console.error('❌ Erro durante auditoria:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Executar auditoria
checkProposalFlow();