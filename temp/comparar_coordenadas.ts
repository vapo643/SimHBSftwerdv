/**
 * 📊 COMPARAÇÃO: Suas coordenadas vs Sistema completo
 */

import { SIMPIX_CCB_MAPPING } from "../server/services/ccbFieldMapping";
import { CCB_COMPLETE_MAPPING } from "../server/services/ccbFieldMappingComplete";

function compararSistemas() {
  console.log("📊 COMPARAÇÃO DE SISTEMAS DE COORDENADAS");
  console.log("=" .repeat(60));

  // Mapear nomes de campos entre sistemas
  const mapeamentoCampos = {
    'nomeCliente': 'devedorNome',
    'cpfCliente': 'devedorCpf', 
    'valorEmprestimo': 'valorPrincipal',
    'numeroParcelas': 'numeroParcelas',
    'dataEmissao': 'dataEmissao'
  };

  console.log("🔧 SUAS COORDENADAS ATUAIS vs SISTEMA COMPLETO:\n");

  Object.entries(mapeamentoCampos).forEach(([seuCampo, campoCompleto]) => {
    const sua = SIMPIX_CCB_MAPPING[seuCampo as keyof typeof SIMPIX_CCB_MAPPING];
    const completa = CCB_COMPLETE_MAPPING[campoCompleto as keyof typeof CCB_COMPLETE_MAPPING];
    
    if (sua && completa) {
      console.log(`📋 ${seuCampo}:`);
      console.log(`   Sua:      x=${sua.x.toString().padEnd(3)} y=${sua.y.toString().padEnd(3)} size=${sua.size}`);
      console.log(`   Completa: x=${completa.x.toString().padEnd(3)} y=${completa.y.toString().padEnd(3)} size=${completa.fontSize}`);
      
      // Mostrar diferenças significativas
      const diffX = Math.abs(sua.x - completa.x);
      const diffY = Math.abs(sua.y - completa.y);
      
      if (diffX > 20 || diffY > 20) {
        console.log(`   ⚠️  Diferença significativa: ΔX=${diffX}, ΔY=${diffY}`);
      }
      console.log("");
    }
  });

  console.log("🎯 CAMPOS EXTRAS NO SISTEMA COMPLETO:");
  const camposExtras = Object.keys(CCB_COMPLETE_MAPPING).filter(campo => 
    !Object.values(mapeamentoCampos).includes(campo)
  );
  
  camposExtras.slice(0, 10).forEach(campo => { // Mostrar apenas 10 primeiros
    const coord = CCB_COMPLETE_MAPPING[campo as keyof typeof CCB_COMPLETE_MAPPING];
    console.log(`   ${campo}: x=${coord.x}, y=${coord.y}, size=${coord.fontSize}`);
  });
  
  if (camposExtras.length > 10) {
    console.log(`   ... e mais ${camposExtras.length - 10} campos`);
  }

  console.log(`\n📈 ESTATÍSTICAS:`);
  console.log(`   Seus campos mapeados: ${Object.keys(SIMPIX_CCB_MAPPING).length}`);
  console.log(`   Sistema completo: ${Object.keys(CCB_COMPLETE_MAPPING).length}`);
  console.log(`   Diferença: +${Object.keys(CCB_COMPLETE_MAPPING).length - Object.keys(SIMPIX_CCB_MAPPING).length} campos adicionais`);

  console.log(`\n💡 RECOMENDAÇÃO:`);
  console.log(`   1. Teste suas coordenadas atuais primeiro`);
  console.log(`   2. Ajuste conforme necessário`);
  console.log(`   3. Migre gradualmente para sistema completo se precisar de mais campos`);
}

// Para executar: npx tsx temp/comparar_coordenadas.ts
if (require.main === module) {
  compararSistemas();
}

export { compararSistemas };