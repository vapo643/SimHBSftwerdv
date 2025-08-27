#!/usr/bin/env tsx
/**
 * Script de Migração - TAC em Produtos Legados
 *
 * Define valores padrão de TAC para produtos antigos que não possuem configuração.
 * Valores padrão: tacValor = R$ 50,00 | tacTipo = 'fixo'
 *
 * @created 2025-01-20
 * @module scripts/migrate-legacy-products-tac
 */

import { db } from '../server/lib/supabase.js';
import { produtos } from '../shared/schema.js';
import { isNull } from 'drizzle-orm';

async function migrateLegacyProductsTac() {
  console.log('🚀 [MIGRAÇÃO TAC] Iniciando migração de produtos legados...');
  console.log('📋 [MIGRAÇÃO TAC] Configuração padrão: TAC = R$ 50,00 (fixo)');

  try {
    // Buscar produtos sem configuração de TAC
    console.log('🔍 [MIGRAÇÃO TAC] Buscando produtos com tacValor NULL...');

    const productsToUpdate = await db
      .select({
        id: produtos.id,
        nomeProduto: produtos.nomeProduto,
        tacValor: produtos.tacValor,
        tacTipo: produtos.tacTipo,
      })
      .from(produtos)
      .where(isNull(produtos.tacValor));

    console.log(
      `📊 [MIGRAÇÃO TAC] Encontrados ${productsToUpdate.length} produtos sem configuração de TAC`
    );

    if (productsToUpdate.length == 0) {
      console.log('✅ [MIGRAÇÃO TAC] Nenhum produto precisa de atualização!');
      return;
    }

    // Listar produtos que serão atualizados
    console.log('📝 [MIGRAÇÃO TAC] Produtos que serão atualizados:');
    productsToUpdate.forEach((produto) => {
      console.log(`   - ID: ${produto.id} | Nome: ${produto.nomeProduto}`);
    });

    // Executar UPDATE em massa
    console.log('⚙️ [MIGRAÇÃO TAC] Executando UPDATE...');

    const updatedProducts = await db
      .update(produtos)
      .set({
        tacValor: '50.00',
        tacTipo: 'fixo',
      })
      .where(isNull(produtos.tacValor))
      .returning({
        id: produtos.id,
        nomeProduto: produtos.nomeProduto,
        tacValor: produtos.tacValor,
        tacTipo: produtos.tacTipo,
      });

    // Reportar sucesso
    console.log(
      `✅ [MIGRAÇÃO TAC] Migração concluída. ${updatedProducts.length} produtos legados foram atualizados com a TAC padrão.`
    );

    // Mostrar valores atualizados
    console.log('📊 [MIGRAÇÃO TAC] Valores finais:');
    updatedProducts.forEach((produto) => {
      console.log(
        `   - ID: ${produto.id} | Nome: ${produto.nomeProduto} | TAC: R$ ${produto.tacValor} (${produto.tacTipo})`
      );
    });

    // Estatísticas finais
    console.log('\n📈 [MIGRAÇÃO TAC] Resumo da migração:');
    console.log(`   Total de produtos atualizados: ${updatedProducts.length}`);
    console.log(`   Valor TAC aplicado: R$ 50,00`);
    console.log(`   Tipo TAC aplicado: fixo`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
  }
catch (error) {
    console.error('❌ [MIGRAÇÃO TAC] Erro durante a migração:', error);
    process.exit(1);
  }

  // Encerrar conexão
  process.exit(0);
}

// Executar migração
console.log('═══════════════════════════════════════════════');
console.log('   MIGRAÇÃO DE DADOS - TAC PRODUTOS LEGADOS   ');
console.log('═══════════════════════════════════════════════');
console.log('');

migrateLegacyProductsTac().catch ((error) => {
  console.error('❌ [MIGRAÇÃO TAC] Erro fatal:', error);
  process.exit(1);
});
