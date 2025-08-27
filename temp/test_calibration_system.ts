/**
 * 🧪 TESTE RÁPIDO DO SISTEMA DE CALIBRAÇÃO CCB
 * Demonstração das funcionalidades implementadas
 */

import { ccbCoordinateCalibrator } from "../server/services/ccbCoordinateCalibrator";
import { CCB_COMPLETE_MAPPING } from "../server/services/ccbFieldMappingComplete";

async function testCalibrationSystem() {
  console.log("🎯 SISTEMA DE CALIBRAÇÃO CCB - TESTE COMPLETO");
  console.log("=" .repeat(60));
  
  try {
    // 1. DIAGNÓSTICO DO TEMPLATE
    console.log("🔍 FASE 1: Diagnóstico do Template");
    const diagnosis = await ccbCoordinateCalibrator.diagnoseTemplate();
    console.log(`   - AcroForms detectados: ${diagnosis.hasAcroForms ? 'SIM' : 'NÃO'}`);
    console.log(`   - Campos de formulário: ${diagnosis.fields.length}`);
    console.log(`   - Dimensões: ${diagnosis.pageSize.width}x${diagnosis.pageSize.height}`);
    console.log(`   - Recomendações: ${diagnosis.recommendations.length}`);
    
    // 2. MAPEAMENTO DE CAMPOS
    console.log("\n📋 FASE 2: Mapeamento de Campos");
    const fieldCount = Object.keys(CCB_COMPLETE_MAPPING).length;
    console.log(`   - Total de campos mapeados: ${fieldCount}`);
    console.log(`   - Campos do devedor: ${Object.keys(CCB_COMPLETE_MAPPING).filter(k => k.startsWith('devedor')).length}`);
    console.log(`   - Campos de crédito: ${Object.keys(CCB_COMPLETE_MAPPING).filter(k => k.includes('valor') || k.includes('juros')).length}`);
    console.log(`   - Campos de pagamento: ${Object.keys(CCB_COMPLETE_MAPPING).filter(k => k.includes('pix') || k.includes('banco')).length}`);
    
    // 3. GERAÇÃO DE GRID
    console.log("\n📐 FASE 3: Grid de Calibração");
    const gridPath = await ccbCoordinateCalibrator.generateCalibrationGrid(50, true, ['devedorNome', 'valorPrincipal']);
    console.log(`   - Grid gerado: ${gridPath}`);
    
    // 4. TESTE COM DADOS
    console.log("\n🧪 FASE 4: Teste com Dados de Exemplo");
    const testData = {
      devedorNome: "João Silva Santos",
      devedorCpf: "123.456.789-00",
      valorPrincipal: "R$ 50.000,00",
      numeroParcelas: "24",
      dataEmissao: "08/08/2025"
    };
    const testPath = await ccbCoordinateCalibrator.testFieldPositions(testData);
    console.log(`   - Teste gerado: ${testPath}`);
    
    console.log("\n✅ SISTEMA DE CALIBRAÇÃO IMPLEMENTADO COM SUCESSO!");
    console.log("🎯 APIs Disponíveis:");
    console.log("   - GET  /api/ccb-calibration/diagnose");
    console.log("   - POST /api/ccb-calibration/generate-grid");
    console.log("   - POST /api/ccb-calibration/test-positions");
    console.log("   - POST /api/ccb-calibration/intelligent-calibration");
    console.log("   - GET  /api/ccb-calibration/report");
    console.log("   - POST /api/ccb-calibration/quick-test");
    
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

// Executar teste se chamado diretamente
if (require.main == module) {
  testCalibrationSystem();
}

export { testCalibrationSystem };