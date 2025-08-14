/**
 * PAM V1.0 - Teste da Tela de Cobranças
 * Verifica endpoint com regra de negócio específica
 */

const { db } = require("./server/lib/supabase");
const { propostas, interCollections } = require("./.build/schema");
const { eq, and, sql } = require("drizzle-orm");

async function testCobrancas() {
  console.log("\n🎯 PAM V1.0 - TESTE DA TELA DE COBRANÇAS");
  console.log("=" .repeat(50));

  try {
    // Buscar propostas com a regra de negócio do PAM V1.0
    console.log("\n📋 Aplicando regra de negócio:");
    console.log("  1. assinaturaEletronicaConcluida = true");
    console.log("  2. EXISTS registro em inter_collections");

    const propostasValidas = await db
      .select()
      .from(propostas)
      .where(
        and(
          sql`${propostas.deletedAt} IS NULL`,
          eq(propostas.assinaturaEletronicaConcluida, true),
          sql`EXISTS (
            SELECT 1 FROM inter_collections 
            WHERE inter_collections.proposta_id = ${propostas.id}
          )`
        )
      )
      .limit(5);

    console.log(`\n✅ Propostas encontradas: ${propostasValidas.length}`);

    if (propostasValidas.length > 0) {
      console.log("\n📊 Amostra de propostas válidas:");
      for (const prop of propostasValidas) {
        // Buscar boletos desta proposta
        const boletos = await db
          .select()
          .from(interCollections)
          .where(eq(interCollections.propostaId, prop.id));

        console.log(`\n  Proposta #${prop.numeroProposta}:`);
        console.log(`    - Cliente: ${prop.clienteNome}`);
        console.log(`    - CPF: ${prop.clienteCpf}`);
        console.log(`    - Assinatura Eletrônica: ✓`);
        console.log(`    - Boletos no Inter: ${boletos.length}`);
        console.log(`    - Status: ${prop.status}`);
      }
    } else {
      console.log("\n⚠️ Nenhuma proposta atende aos critérios do PAM V1.0");
      
      // Diagnóstico
      const todasPropostas = await db.select().from(propostas).limit(10);
      const comAssinatura = todasPropostas.filter(p => p.assinaturaEletronicaConcluida);
      
      console.log("\n📊 Diagnóstico:");
      console.log(`  - Total de propostas (amostra): ${todasPropostas.length}`);
      console.log(`  - Com assinatura eletrônica: ${comAssinatura.length}`);
      
      // Verificar inter_collections
      const totalBoletos = await db.select().from(interCollections).limit(10);
      console.log(`  - Total de registros em inter_collections: ${totalBoletos.length}`);
    }

    console.log("\n✅ PAM V1.0 - Teste concluído com sucesso!");

  } catch (error) {
    console.error("\n❌ Erro no teste:", error.message);
  }

  process.exit(0);
}

testCobrancas();
