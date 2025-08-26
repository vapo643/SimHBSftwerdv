/**
 * 🎯 ENDPOINTS PARA CALIBRAÇÃO DE COORDENADAS CCB
 * API completa para ajustes visuais e testes de posicionamento
 *
 * ROADMAP FORMALIZAÇÃO - API DE CALIBRAÇÃO
 * Data: 2025-08-08
 */

import express from "express";
import { jwtAuthMiddleware } from "../lib/jwt-auth-middleware";
import { ccbCoordinateCalibrator } from "../services/ccbCoordinateCalibrator";
import { CCB_COMPLETE_MAPPING } from "../services/ccbFieldMappingComplete";

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(jwtAuthMiddleware);

/**
 * 🔍 GET /api/ccb-calibration/diagnose
 * Diagnóstico completo do template CCB
 */
router.get("/diagnose", async (req, res) => {
  try {
    console.log("🔍 [CCB-CALIBRATION] Executando diagnóstico do template...");

    const diagnosis = await ccbCoordinateCalibrator.diagnoseTemplate();

    res.json({
      success: true,
      diagnosis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ [CCB-CALIBRATION] Erro no diagnóstico:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro no diagnóstico",
    });
  }
});

/**
 * 📐 POST /api/ccb-calibration/generate-grid
 * Gera grid visual de coordenadas sobre o template
 */
router.post("/generate-grid", async (req, res) => {
  try {
    console.log("📐 [CCB-CALIBRATION] Gerando grid de calibração...");

    const { gridSpacing = 50, showCoordinates = true, highlightFields = [] } = req.body;

    const gridPath = await ccbCoordinateCalibrator.generateCalibrationGrid(
      gridSpacing,
      showCoordinates,
      highlightFields
    );

    res.json({
      success: true,
      gridPath,
      gridSpacing,
      highlightedFields: highlightFields,
      message: "Grid de calibração gerado com sucesso",
    });
  } catch (error) {
    console.error("❌ [CCB-CALIBRATION] Erro ao gerar grid:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro na geração do grid",
    });
  }
});

/**
 * 🧪 POST /api/ccb-calibration/test-positions
 * Testa posicionamento de campos com dados reais
 */
router.post("/test-positions", async (req, res) => {
  try {
    console.log("🧪 [CCB-CALIBRATION] Testando posições dos campos...");

    const { testData } = req.body;

    if (!testData || typeof testData !== "object") {
      return res.status(400).json({
        success: false,
        error: "Dados de teste são obrigatórios",
      });
    }

    const testPath = await ccbCoordinateCalibrator.testFieldPositions(testData);

    res.json({
      success: true,
      testPath,
      testedFields: Object.keys(testData),
      message: "Teste de posições concluído",
    });
  } catch (error) {
    console.error("❌ [CCB-CALIBRATION] Erro no teste:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro no teste de posições",
    });
  }
});

/**
 * ⚡ POST /api/ccb-calibration/intelligent-calibration
 * Calibração automática inteligente
 */
router.post("/intelligent-calibration", async (req, res) => {
  try {
    console.log("⚡ [CCB-CALIBRATION] Executando calibração inteligente...");

    const { sampleData } = req.body;

    if (!sampleData) {
      return res.status(400).json({
        success: false,
        error: "Dados de amostra são obrigatórios",
      });
    }

    const result = await ccbCoordinateCalibrator.intelligentCalibration(sampleData);

    res.json({
      success: true,
      ...result,
      message: "Calibração inteligente concluída",
    });
  } catch (error) {
    console.error("❌ [CCB-CALIBRATION] Erro na calibração inteligente:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro na calibração inteligente",
    });
  }
});

/**
 * 📊 GET /api/ccb-calibration/report
 * Gera relatório completo de calibração
 */
router.get("/report", async (req, res) => {
  try {
    console.log("📊 [CCB-CALIBRATION] Gerando relatório completo...");

    const report = await ccbCoordinateCalibrator.generateCalibrationReport();

    res.json({
      success: true,
      report,
      timestamp: new Date().toISOString(),
      message: "Relatório de calibração gerado",
    });
  } catch (error) {
    console.error("❌ [CCB-CALIBRATION] Erro no relatório:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro no relatório",
    });
  }
});

/**
 * 📋 GET /api/ccb-calibration/field-mapping
 * Retorna mapeamento atual de todos os campos
 */
router.get("/field-mapping", async (req, res) => {
  try {
    console.log("📋 [CCB-CALIBRATION] Fornecendo mapeamento de campos...");

    const fieldCount = Object.keys(CCB_COMPLETE_MAPPING).length;
    const fieldNames = Object.keys(CCB_COMPLETE_MAPPING);

    res.json({
      success: true,
      mapping: CCB_COMPLETE_MAPPING,
      fieldCount,
      fieldNames,
      categories: {
        devedor: fieldNames.filter(name => name.startsWith("devedor")).length,
        credito: fieldNames.filter(
          name => name.includes("valor") || name.includes("juros") || name.includes("taxa")
        ).length,
        pagamento: fieldNames.filter(
          name => name.includes("pix") || name.includes("banco") || name.includes("conta")
        ).length,
        credor: fieldNames.filter(name => name.startsWith("credor")).length,
        assinatura: fieldNames.filter(
          name => name.includes("assinatura") || name.includes("testemunha")
        ).length,
      },
      message: "Mapeamento de campos fornecido",
    });
  } catch (error) {
    console.error("❌ [CCB-CALIBRATION] Erro no mapeamento:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro no mapeamento",
    });
  }
});

/**
 * 🎯 POST /api/ccb-calibration/quick-test
 * Teste rápido com dados padrão
 */
router.post("/quick-test", async (req, res) => {
  try {
    console.log("🎯 [CCB-CALIBRATION] Executando teste rápido...");

    // Dados de teste padrão
    const quickTestData = {
      devedorNome: "João Silva Santos",
      devedorCpf: "123.456.789-00",
      devedorRg: "12.345.678-9",
      valorPrincipal: "R$ 50.000,00",
      numeroParcelas: "24",
      valorParcela: "R$ 2.500,00",
      dataVencimento: "15/09/2025",
      credorNome: "SIMPIX CRÉDITO LTDA",
      credorCnpj: "12.345.678/0001-90",
      dataEmissao: "08/08/2025",
      localAssinatura: "São Paulo, SP",
    };

    const testPath = await ccbCoordinateCalibrator.testFieldPositions(quickTestData);

    res.json({
      success: true,
      testPath,
      testData: quickTestData,
      message: "Teste rápido executado com sucesso",
      instructions: [
        "📄 Abra o PDF gerado para visualizar o posicionamento",
        "📍 Pontos vermelhos indicam coordenadas exatas",
        "🔧 Ajuste coordenadas conforme necessário",
        "🔄 Execute novos testes após ajustes",
      ],
    });
  } catch (error) {
    console.error("❌ [CCB-CALIBRATION] Erro no teste rápido:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro no teste rápido",
    });
  }
});

export default router;
