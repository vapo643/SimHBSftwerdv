/**
 * Script de Auditoria de Status de Propostas
 *
 * Objetivo: Auditar o uso de cada status na tabela propostas para identificar
 * quais dos 25+ status são legados e podem ser eliminados com segurança.
 *
 * Uso: tsx server/scripts/audit-status.ts
 */

import { db } from '../lib/supabase';
import { propostas, statusEnum } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('\n🔍 ====== AUDITORIA DE STATUS DE PROPOSTAS ======\n');
    console.log('📊 Coletando dados de uso por status...\n');

    // 1. Executar query para contar propostas por status
    const statusUsageResults = await db
      .select({
        status: propostas.status,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(propostas)
      .groupBy(propostas.status);

    // 2. Criar mapa para fácil acesso (status -> count)
    const statusCountMap = new Map<string, number>();
    statusUsageResults.forEach((result) => {
      statusCountMap.set(result.status, Number(result.count));
    });

    // 3. Extrair todos os valores do statusEnum
    const allStatusValues = statusEnum.enumValues;

    console.log('📋 RELATÓRIO DE USO DE STATUS:\n');
    console.log('Status'.padEnd(35) + '| Contagem | Situação');
    console.log('-'.repeat(60));

    let totalPropostas = 0;
    let statusLegados = 0;
    let statusAtivos = 0;

    // 4. Iterar sobre todos os valores do enum para garantir cobertura completa
    allStatusValues.forEach((status) => {
      const count = statusCountMap.get(status) || 0;
      totalPropostas += count;

      const statusFormatted = status.padEnd(35);
      const countFormatted = count.toString().padStart(8);

      if (count === 0) {
        console.log(`${statusFormatted}| ${countFormatted} | [LEGACY] ⚠️`);
        statusLegados++;
      } else {
        console.log(`${statusFormatted}| ${countFormatted} | Ativo ✅`);
        statusAtivos++;
      }
    });

    console.log('-'.repeat(60));
    console.log(`\n📊 RESUMO DA AUDITORIA:`);
    console.log(`   Total de status definidos: ${allStatusValues.length}`);
    console.log(`   Status ativos (com uso):    ${statusAtivos}`);
    console.log(`   Status legados (sem uso):   ${statusLegados}`);
    console.log(`   Total de propostas:         ${totalPropostas}`);

    // 5. Identificar status em uso que não estão no enum (problemas de integridade)
    console.log(`\n🔍 VERIFICAÇÃO DE INTEGRIDADE:`);
    const statusInUseNotInEnum = statusUsageResults.filter(
      (result) => !allStatusValues.includes(result.status as any)
    );

    if (statusInUseNotInEnum.length > 0) {
      console.log(`\n⚠️  PROBLEMAS DETECTADOS:`);
      console.log(`   Status em uso que NÃO estão no enum:`);
      statusInUseNotInEnum.forEach((result) => {
        console.log(`   - "${result.status}" (${result.count} propostas) ❌`);
      });
    } else {
      console.log(`   ✅ Todos os status em uso estão definidos no enum`);
    }

    // 6. Recomendações
    console.log(`\n💡 RECOMENDAÇÕES:`);
    if (statusLegados > 0) {
      console.log(`   - Avaliar remoção de ${statusLegados} status legados`);
      console.log(`   - Verificar se remoção não quebra código existente`);
    }
    if (statusInUseNotInEnum.length > 0) {
      console.log(`   - CRÍTICO: Corrigir status órfãos no banco de dados`);
      console.log(`   - Atualizar enum ou corrigir dados inconsistentes`);
    }
    if (statusLegados === 0 && statusInUseNotInEnum.length === 0) {
      console.log(`   - ✅ Schema de status está consistente e otimizado`);
    }

    console.log(`\n🏁 ====== AUDITORIA CONCLUÍDA ======\n`);
  } catch (error) {
    console.error('❌ Erro durante a auditoria:', error);
    process.exit(1);
  }
}

// Executar função principal e capturar erros
main().catch((error) => {
  console.error('💥 Falha crítica na auditoria:', error);
  process.exit(1);
});
