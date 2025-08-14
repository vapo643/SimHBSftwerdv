/**
 * SCRIPT DE MIGRAÇÃO COMPLEMENTAR - SISTEMA DE STATUS V2.0
 * 
 * Este script completa a migração das 10 propostas restantes com status legados
 * identificadas pela auditoria forense.
 * 
 * MAPEAMENTO DE STATUS LEGADOS:
 * - contratos_assinados → ASSINATURA_CONCLUIDA
 * - pronto_pagamento → BOLETOS_EMITIDOS  
 * - contratos_preparados → CCB_GERADA
 * - documentos_enviados → em_analise
 * - rascunho → rascunho (já está no enum V2.0)
 * - suspensa → suspensa (já está no enum V2.0)
 */

import { db } from '../server/lib/supabase';
import { sql } from 'drizzle-orm';
import { getBrasiliaTimestamp } from '../server/lib/timezone';

async function migrateLegacyStatuses() {
  console.log('🚀 [MIGRAÇÃO COMPLEMENTAR V2.0] Iniciando migração de status legados...');
  console.log('📅 Timestamp:', getBrasiliaTimestamp());
  
  try {
    // 1. Verificar situação atual
    console.log('\n📊 [MIGRAÇÃO COMPLEMENTAR] Analisando propostas com status legados...');
    
    const currentStats = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) as total
      FROM propostas
      WHERE status NOT IN (
        'rascunho', 'aguardando_analise', 'em_analise', 'pendente', 'aprovado', 'rejeitado',
        'CCB_GERADA', 'AGUARDANDO_ASSINATURA', 'ASSINATURA_CONCLUIDA', 'BOLETOS_EMITIDOS',
        'cancelado', 'suspensa'
      )
      GROUP BY status
      ORDER BY COUNT(*) DESC
    `);
    
    console.log('📊 Status legados encontrados:');
    currentStats.forEach((stat: any) => {
      console.log(`  ${stat.status}: ${stat.total} propostas`);
    });
    
    // 2. MIGRAÇÃO 1: contratos_assinados → ASSINATURA_CONCLUIDA
    console.log('\n🔄 [FASE 1] Migrando contratos_assinados → ASSINATURA_CONCLUIDA...');
    
    const contratosAssinadosResult = await db.execute(sql`
      UPDATE propostas 
      SET 
        status = 'ASSINATURA_CONCLUIDA'
      WHERE status = 'contratos_assinados'
      RETURNING id, status
    `);
    
    console.log(`✅ ${contratosAssinadosResult.length} propostas atualizadas para ASSINATURA_CONCLUIDA`);
    
    // 3. MIGRAÇÃO 2: pronto_pagamento → BOLETOS_EMITIDOS
    console.log('\n🔄 [FASE 2] Migrando pronto_pagamento → BOLETOS_EMITIDOS...');
    
    const prontoPagamentoResult = await db.execute(sql`
      UPDATE propostas 
      SET 
        status = 'BOLETOS_EMITIDOS'
      WHERE status = 'pronto_pagamento'
      RETURNING id, status
    `);
    
    console.log(`✅ ${prontoPagamentoResult.length} propostas atualizadas para BOLETOS_EMITIDOS`);
    
    // 4. MIGRAÇÃO 3: contratos_preparados → CCB_GERADA
    console.log('\n🔄 [FASE 3] Migrando contratos_preparados → CCB_GERADA...');
    
    const contratosPreparadosResult = await db.execute(sql`
      UPDATE propostas 
      SET 
        status = 'CCB_GERADA'
      WHERE status = 'contratos_preparados'
      RETURNING id, status
    `);
    
    console.log(`✅ ${contratosPreparadosResult.length} propostas atualizadas para CCB_GERADA`);
    
    // 5. MIGRAÇÃO 4: documentos_enviados → em_analise
    console.log('\n🔄 [FASE 4] Migrando documentos_enviados → em_analise...');
    
    const documentosEnviadosResult = await db.execute(sql`
      UPDATE propostas 
      SET 
        status = 'em_analise'
      WHERE status = 'documentos_enviados'
      RETURNING id, status
    `);
    
    console.log(`✅ ${documentosEnviadosResult.length} propostas atualizadas para em_analise`);
    
    // 6. VERIFICAÇÃO: rascunho e suspensa já estão no enum V2.0 (nenhuma ação necessária)
    console.log('\n🔄 [FASE 5] Verificando status rascunho e suspensa (já conformes ao V2.0)...');
    
    const conformeStats = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) as total
      FROM propostas
      WHERE status IN ('rascunho', 'suspensa')
      GROUP BY status
    `);
    
    console.log('📊 Status já conformes ao V2.0:');
    conformeStats.forEach((stat: any) => {
      console.log(`  ${stat.status}: ${stat.total} propostas (✅ nenhuma ação necessária)`);
    });
    
    // 7. Criar registros na tabela status_transitions para auditoria
    console.log('\n🔄 [FASE 6] Criando registros de auditoria para migração complementar...');
    
    const auditResult = await db.execute(sql`
      INSERT INTO status_transitions (
        id,
        proposta_id,
        from_status,
        to_status,
        triggered_by,
        metadata,
        created_at
      )
      SELECT 
        gen_random_uuid(),
        p.id,
        'legacy_migration',
        p.status,
        'system',
        jsonb_build_object(
          'migration_script', 'migrate-legacy-statuses.ts',
          'migration_type', 'complementary',
          'migration_date', NOW(),
          'description', 'Migração complementar de status legados para STATUS V2.0'
        ),
        NOW()
      FROM propostas p
      WHERE p.status IN ('ASSINATURA_CONCLUIDA', 'BOLETOS_EMITIDOS', 'CCB_GERADA', 'em_analise')
      AND NOT EXISTS (
        SELECT 1 FROM status_transitions st 
        WHERE st.proposta_id = p.id 
        AND st.metadata->>'migration_script' = 'migrate-legacy-statuses.ts'
      )
      RETURNING proposta_id
    `);
    
    console.log(`✅ ${auditResult.length} registros de auditoria criados`);
    
    // 8. Relatório final de validação
    console.log('\n📊 [MIGRAÇÃO COMPLEMENTAR] RELATÓRIO FINAL:');
    
    const finalValidation = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) as total
      FROM propostas
      GROUP BY status
      ORDER BY 
        CASE status
          WHEN 'rascunho' THEN 1
          WHEN 'aguardando_analise' THEN 2
          WHEN 'em_analise' THEN 3
          WHEN 'pendente' THEN 4
          WHEN 'aprovado' THEN 5
          WHEN 'CCB_GERADA' THEN 6
          WHEN 'AGUARDANDO_ASSINATURA' THEN 7
          WHEN 'ASSINATURA_CONCLUIDA' THEN 8
          WHEN 'BOLETOS_EMITIDOS' THEN 9
          WHEN 'rejeitado' THEN 10
          WHEN 'cancelado' THEN 11
          WHEN 'suspensa' THEN 12
          ELSE 99
        END
    `);
    
    console.log('\n📊 Distribuição final de status após migração complementar:');
    finalValidation.forEach((stat: any) => {
      console.log(`  ${stat.status}: ${stat.total} propostas`);
    });
    
    // 9. Verificação final de integridade - devem ser ZERO status legados
    console.log('\n🔍 [VALIDAÇÃO CRÍTICA] Verificando se ainda existem status legados...');
    
    const legacyCheck = await db.execute(sql`
      SELECT 
        COUNT(*) as total_legados
      FROM propostas
      WHERE status NOT IN (
        'rascunho', 'aguardando_analise', 'em_analise', 'pendente', 'aprovado', 'rejeitado',
        'CCB_GERADA', 'AGUARDANDO_ASSINATURA', 'ASSINATURA_CONCLUIDA', 'BOLETOS_EMITIDOS',
        'cancelado', 'suspensa'
      )
    `);
    
    const legacyRow = legacyCheck[0] as { total_legados: number };
    if (legacyRow.total_legados > 0) {
      console.error(`❌ FALHA: ${legacyRow.total_legados} propostas ainda possuem status legados!`);
      process.exit(1);
    } else {
      console.log('✅ SUCESSO: Nenhum status legado restante - migração 100% completa!');
    }
    
    console.log('\n✅ [MIGRAÇÃO COMPLEMENTAR V2.0] Migração concluída com sucesso!');
    console.log('📅 Finalizado em:', getBrasiliaTimestamp());
    
  } catch (error) {
    console.error('❌ [MIGRAÇÃO COMPLEMENTAR V2.0] Erro durante migração:', error);
    process.exit(1);
  }
}

// Executar migração diretamente
migrateLegacyStatuses()
  .then(() => {
    console.log('🎉 Migração complementar concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro na migração complementar:', error);
    process.exit(1);
  });

export { migrateLegacyStatuses };