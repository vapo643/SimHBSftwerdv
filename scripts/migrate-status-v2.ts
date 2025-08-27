/**
 * SCRIPT DE MIGRAÇÃO - SISTEMA DE STATUS V2.0
 *
 * Este script atualiza todas as propostas existentes para o novo sistema de status
 * baseado nas flags booleanas antigas.
 *
 * LÓGICA DE MAPEAMENTO:
 * 1. Se tem boletos no inter_collections → BOLETOS_EMITIDOS
 * 2. Se assinatura_eletronica_concluida = true → ASSINATURA_CONCLUIDA
 * 3. Se está no ClickSign (tem clicksignDocumentKey) → AGUARDANDO_ASSINATURA
 * 4. Se ccb_gerado = true → CCB_GERADA
 * 5. Se aprovado mas sem CCB → aprovado
 * 6. Outros casos → mantém status atual
 */

import { db } from '../server/lib/supabase';
import { sql } from 'drizzle-orm';
import { getBrasiliaTimestamp } from '../server/lib/timezone';

async function migrateStatusV2() {
  console.log('🚀 [MIGRAÇÃO V2.0] Iniciando migração de status...');
  console.log('📅 Timestamp:', _getBrasiliaTimestamp());

  try {
    // 1. Buscar estatísticas atuais
    console.log('\n📊 [MIGRAÇÃO V2.0] Analisando propostas existentes...');

    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN ccb_gerado = true THEN 1 END) as com_ccb,
        COUNT(CASE WHEN assinatura_eletronica_concluida = true THEN 1 END) as assinadas,
        COUNT(CASE WHEN clicksign_document_key IS NOT NULL THEN 1 END) as no_clicksign,
        COUNT(DISTINCT ic.proposta_id) as com_boletos
      FROM propostas p
      LEFT JOIN inter_collections ic ON p.id = ic.proposta_id
    `);

    console.log('📊 Estatísticas encontradas:', stats[0]);

    // 2. PRIORIDADE 1: Propostas com boletos emitidos
    console.log('\n🔄 [FASE 1] Atualizando propostas com BOLETOS_EMITIDOS...');

    const boletosResult = await db.execute(sql`
      UPDATE propostas 
      SET 
        status = 'BOLETOS_EMITIDOS'
      WHERE id IN (
        SELECT DISTINCT proposta_id 
        FROM inter_collections 
        WHERE proposta_id IS NOT NULL
      )
      AND status != 'BOLETOS_EMITIDOS'
      RETURNING id
    `);

    console.log(`✅ ${boletosResult.length} propostas atualizadas para BOLETOS_EMITIDOS`);

    // 3. PRIORIDADE 2: Propostas com assinatura concluída (mas sem boletos)
    console.log('\n🔄 [FASE 2] Atualizando propostas com ASSINATURA_CONCLUIDA...');

    const assinaturaResult = await db.execute(sql`
      UPDATE propostas 
      SET 
        status = 'ASSINATURA_CONCLUIDA'
      WHERE assinatura_eletronica_concluida = true
      AND status NOT IN ('BOLETOS_EMITIDOS', 'ASSINATURA_CONCLUIDA')
      AND id NOT IN (
        SELECT DISTINCT proposta_id 
        FROM inter_collections 
        WHERE proposta_id IS NOT NULL
      )
      RETURNING id
    `);

    console.log(`✅ ${assinaturaResult.length} propostas atualizadas para ASSINATURA_CONCLUIDA`);

    // 4. PRIORIDADE 3: Propostas aguardando assinatura no ClickSign
    console.log('\n🔄 [FASE 3] Atualizando propostas AGUARDANDO_ASSINATURA...');

    const aguardandoResult = await db.execute(sql`
      UPDATE propostas 
      SET 
        status = 'AGUARDANDO_ASSINATURA'
      WHERE clicksign_document_key IS NOT NULL
      AND clicksign_status IN ('pending', 'running')
      AND assinatura_eletronica_concluida = false
      AND status NOT IN ('BOLETOS_EMITIDOS', 'ASSINATURA_CONCLUIDA', 'AGUARDANDO_ASSINATURA')
      RETURNING id
    `);

    console.log(`✅ ${aguardandoResult.length} propostas atualizadas para AGUARDANDO_ASSINATURA`);

    // 5. PRIORIDADE 4: Propostas com CCB gerado
    console.log('\n🔄 [FASE 4] Atualizando propostas com CCB_GERADA...');

    const ccbResult = await db.execute(sql`
      UPDATE propostas 
      SET 
        status = 'CCB_GERADA'
      WHERE ccb_gerado = true
      AND clicksign_document_key IS NULL
      AND status NOT IN ('BOLETOS_EMITIDOS', 'ASSINATURA_CONCLUIDA', 'AGUARDANDO_ASSINATURA', 'CCB_GERADA')
      RETURNING id
    `);

    console.log(`✅ ${ccbResult.length} propostas atualizadas para CCB_GERADA`);

    // 6. Criar registros na tabela status_transitions para auditoria
    console.log('\n🔄 [FASE 5] Criando registros de auditoria...');

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
        'migrated',
        p.status,
        'system',
        jsonb_build_object(
          'migration_script', 'migrate-status-v2.ts',
          'migration_date', NOW(),
          'previous_flags', jsonb_build_object(
            'ccb_gerado', p.ccb_gerado,
            'assinatura_eletronica_concluida', p.assinatura_eletronica_concluida,
            'biometria_concluida', p.biometria_concluida
          )
        ),
        NOW()
      FROM propostas p
      WHERE p.status IN ('CCB_GERADA', 'AGUARDANDO_ASSINATURA', 'ASSINATURA_CONCLUIDA', 'BOLETOS_EMITIDOS')
      AND NOT EXISTS (
        SELECT 1 FROM status_transitions st 
        WHERE st.proposta_id = p.id 
        AND st.to_status = p.status
      )
      RETURNING proposta_id
    `);

    console.log(`✅ ${auditResult.length} registros de auditoria criados`);

    // 7. Relatório final
    console.log('\n📊 [MIGRAÇÃO V2.0] RELATÓRIO FINAL:');

    const finalStats = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) as total
      FROM propostas
      GROUP BY status
      ORDER BY 
        CASE status
          WHEN 'nova' THEN 1
          WHEN 'pendente' THEN 2
          WHEN 'aprovado' THEN 3
          WHEN 'CCB_GERADA' THEN 4
          WHEN 'AGUARDANDO_ASSINATURA' THEN 5
          WHEN 'ASSINATURA_CONCLUIDA' THEN 6
          WHEN 'BOLETOS_EMITIDOS' THEN 7
          ELSE 8
        END
    `);

    console.log('\n📊 Distribuição final de status:');
    finalStats.forEach((stat: any) => {
      console.log(`  ${stat.status}: ${stat.total} propostas`);
    });

    // 8. Verificar integridade
    console.log('\n🔍 [MIGRAÇÃO V2.0] Verificando integridade...');

    const integrity = await db.execute(sql`
      SELECT COUNT(*) as inconsistentes
      FROM propostas p
      WHERE 
        (p.ccb_gerado = true AND p.status NOT IN ('CCB_GERADA', 'AGUARDANDO_ASSINATURA', 'ASSINATURA_CONCLUIDA', 'BOLETOS_EMITIDOS'))
        OR (p.assinatura_eletronica_concluida = true AND p.status NOT IN ('ASSINATURA_CONCLUIDA', 'BOLETOS_EMITIDOS'))
        OR (p.id IN (SELECT DISTINCT proposta_id FROM inter_collections) AND p.status != 'BOLETOS_EMITIDOS')
    `);

    const integrityRow = integrity[0] as { inconsistentes: number };
    if (integrityRow.inconsistentes > 0) {
      console.warn(
        `⚠️ AVISO: ${integrityRow.inconsistentes} propostas com possível inconsistência detectada`
      );
    }
else {
      console.log('✅ Todas as propostas estão consistentes!');
    }

    console.log('\n✅ [MIGRAÇÃO V2.0] Migração concluída com sucesso!');
    console.log('📅 Finalizado em:', _getBrasiliaTimestamp());
  }
catch (error) {
    console.error('❌ [MIGRAÇÃO V2.0] Erro durante migração:', error);
    process.exit(1);
  }
}

// Executar migração
migrateStatusV2()
  .then(() => {
    console.log('\n🎉 Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
