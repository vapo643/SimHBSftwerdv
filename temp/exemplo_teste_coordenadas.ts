/**
 * 🧪 EXEMPLO PRÁTICO: Como testar suas coordenadas existentes
 */

import { ccbCoordinateCalibrator } from "../server/services/ccbCoordinateCalibrator";
import { SIMPIX_CCB_MAPPING } from "../server/services/ccbFieldMapping";

async function exemploTestePratico() {
  console.log("🎯 EXEMPLO PRÁTICO: Testando suas coordenadas existentes");
  console.log("=" .repeat(60));

  try {
    // 1. SUAS COORDENADAS ATUAIS
    console.log("📋 Suas coordenadas atuais:");
    console.log(`   nomeCliente: x=${SIMPIX_CCB_MAPPING.nomeCliente.x}, y=${SIMPIX_CCB_MAPPING.nomeCliente.y}`);
    console.log(`   valorEmprestimo: x=${SIMPIX_CCB_MAPPING.valorEmprestimo.x}, y=${SIMPIX_CCB_MAPPING.valorEmprestimo.y}`);
    console.log(`   cpfCliente: x=${SIMPIX_CCB_MAPPING.cpfCliente.x}, y=${SIMPIX_CCB_MAPPING.cpfCliente.y}`);

    // 2. DADOS DE TESTE REAIS
    const dadosReais = {
      nomeCliente: "Maria Santos de Oliveira Silva", // Nome longo para testar
      cpfCliente: "123.456.789-00",
      valorEmprestimo: "R$ 85.750,00", // Valor com muitos dígitos
      numeroParcelas: "48",
      dataEmissao: "08 de agosto de 2025"
    };

    console.log("\n🧪 Testando com dados reais:");
    Object.entries(dadosReais).forEach(([campo, valor]) => {
      console.log(`   ${campo}: "${valor}"`);
    });

    // 3. GERAR TESTE VISUAL
    console.log("\n📐 Gerando teste visual...");
    const testPath = await ccbCoordinateCalibrator.testFieldPositions(dadosReais);
    console.log(`   ✅ PDF gerado: ${testPath}`);

    // 4. GERAR GRID PARA ANÁLISE  
    console.log("\n📏 Gerando grid de calibração...");
    const gridPath = await ccbCoordinateCalibrator.generateCalibrationGrid(
      50, // Espaçamento de 50px
      true, // Mostrar coordenadas  
      ['nomeCliente', 'valorEmprestimo', 'cpfCliente'] // Destacar esses campos
    );
    console.log(`   ✅ Grid gerado: ${gridPath}`);

    // 5. INSTRUÇÕES PRÁTICAS
    console.log("\n🎯 PRÓXIMOS PASSOS:");
    console.log("   1. Abra os PDFs gerados na pasta temp/ccb_calibration/");
    console.log("   2. Verifique se os textos estão bem posicionados");
    console.log("   3. Use o grid para identificar coordenadas corretas");
    console.log("   4. Ajuste as coordenadas no ccbFieldMapping.ts");
    console.log("   5. Execute este teste novamente para validar");

    console.log("\n🔧 EXEMPLOS DE AJUSTE:");
    console.log("   // Se nome está muito à esquerda:");
    console.log("   nomeCliente: { x: 140, y: 680, size: 11 } // aumentou X");
    console.log("   ");
    console.log("   // Se valor está muito baixo:");  
    console.log("   valorEmprestimo: { x: 200, y: 590, size: 12 } // aumentou Y");

  }
catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

// Para executar: npx tsx temp/exemplo_teste_coordenadas.ts
if (require.main == module) {
  exemploTestePratico();
}

export { exemploTestePratico };