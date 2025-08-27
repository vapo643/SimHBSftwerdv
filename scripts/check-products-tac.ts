#!/usr/bin/env tsx
/**
 * Script de Verificação - Estado Atual TAC em Produtos
 *
 * @created 2025-01-20
 * @module scripts/check-products-tac
 */

import { db } from '../server/lib/_supabase.js';
import { produtos } from '../shared/schema.js';

async function checkProductsTac() {
  try {
    const allProducts = await db
      .select({
        id: produtos.id,
        nomeProduto: produtos.nomeProduto,
        tacValor: produtos.tacValor,
        tacTipo: produtos.tacTipo,
        isActive: produtos.isActive,
      })
      .from(produtos);

    console.log('═══════════════════════════════════════════════');
    console.log('   VERIFICAÇÃO DE TAC EM PRODUTOS');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log(`📊 Total de produtos no banco: ${allProducts.length}`);

    if (allProducts.length > 0) {
      console.log('\n📋 Detalhes dos produtos:');
      allProducts.forEach((p) => {
        const tacDisplay = p.tacValor ? `R$ ${p.tacValor}` : 'NULL';
        const tipoDisplay = p.tacTipo || 'NULL';
        const statusDisplay = p.isActive ? '✅ Ativo' : '❌ Inativo';
        console.log(
          `   ID: ${p.id.toString().padEnd(3)} | ${p.nomeProduto.padEnd(30)} | TAC: ${tacDisplay.padEnd(10)} | Tipo: ${tipoDisplay.padEnd(10)} | ${statusDisplay}`
        );
      });

      const nullTacProducts = allProducts.filter((p) => !p.tacValor);
      const withTacProducts = allProducts.filter((p) => p.tacValor);

      console.log('\n📈 Estatísticas:');
      console.log(`   Produtos com TAC configurada: ${withTacProducts.length}`);
      console.log(`   Produtos sem TAC (NULL): ${nullTacProducts.length}`);

      if (nullTacProducts.length > 0) {
        console.log('\n⚠️ Produtos que precisam de TAC:');
        nullTacProducts.forEach((p) => {
          console.log(`   - ID: ${p.id} | Nome: ${p.nomeProduto}`);
        });
      }
else {
        console.log('\n✅ Todos os produtos já possuem configuração de TAC!');
      }
    }
else {
      console.log('\n⚠️ Nenhum produto encontrado no banco de dados.');
    }
  }
catch (error) {
    console.error('❌ Erro ao verificar produtos:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Executar verificação
checkProductsTac().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
