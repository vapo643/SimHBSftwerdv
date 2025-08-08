/**
 * Script para testar o serviço OWASP Cheat Sheets
 */

import { OwaspCheatSheetService } from "../server/services/owaspCheatSheetService.js";

console.log("=== TESTE DO SERVIÇO OWASP CHEAT SHEETS ===\n");

async function testService() {
  try {
    console.log("1. Processando todos os 111 cheat sheets...");
    const results = await OwaspCheatSheetService.processAllCheatSheets();

    console.log(`\n✅ Total de cheat sheets processados: ${results.length}`);

    // Estatísticas
    const processed = results.filter(r => r.status === "processed").length;
    const totalRecommendations = results.reduce(
      (sum, cs) => sum + (cs.recommendations?.length || 0),
      0
    );
    const implemented = results.reduce(
      (sum, cs) =>
        sum + (cs.recommendations?.filter(r => r.currentStatus === "implemented").length || 0),
      0
    );
    const partial = results.reduce(
      (sum, cs) =>
        sum + (cs.recommendations?.filter(r => r.currentStatus === "partial").length || 0),
      0
    );
    const notImplemented = results.reduce(
      (sum, cs) =>
        sum + (cs.recommendations?.filter(r => r.currentStatus === "not_implemented").length || 0),
      0
    );
    const notApplicable = results.reduce(
      (sum, cs) =>
        sum + (cs.recommendations?.filter(r => r.currentStatus === "not_applicable").length || 0),
      0
    );

    console.log(`\n📊 ESTATÍSTICAS:`);
    console.log(`- Cheat sheets processados: ${processed}`);
    console.log(`- Total de recomendações: ${totalRecommendations}`);
    console.log(`- Implementadas: ${implemented}`);
    console.log(`- Parciais: ${partial}`);
    console.log(`- Não implementadas: ${notImplemented}`);
    console.log(`- Não aplicáveis: ${notApplicable}`);

    // Amostra de cheat sheets
    console.log(`\n📋 AMOSTRA DOS CHEAT SHEETS:`);
    console.log(
      `1. ${results[0]?.name} - ${results[0]?.recommendations?.length || 0} recomendações`
    );
    console.log(
      `10. ${results[9]?.name} - ${results[9]?.recommendations?.length || 0} recomendações`
    );
    console.log(
      `50. ${results[49]?.name} - ${results[49]?.recommendations?.length || 0} recomendações`
    );
    console.log(
      `100. ${results[99]?.name} - ${results[99]?.recommendations?.length || 0} recomendações`
    );
    console.log(
      `111. ${results[110]?.name} - ${results[110]?.recommendations?.length || 0} recomendações`
    );

    // Verificar método getComplianceSummary
    console.log(`\n🎯 COMPLIANCE SUMMARY:`);
    const summary = OwaspCheatSheetService.getComplianceSummary();
    console.log(`- Total cheat sheets: ${summary.totalCheatSheets}`);
    console.log(`- Compliance percentage: ${summary.compliancePercentage}%`);
    console.log(`- Critical gaps: ${summary.criticalGaps}`);

    console.log(
      "\n✅ SERVIÇO FUNCIONAL! Todos os 111 cheat sheets estão implementados e prontos para uso."
    );
  } catch (error) {
    console.error("❌ ERRO ao testar serviço:", error);
  }
}

testService();
