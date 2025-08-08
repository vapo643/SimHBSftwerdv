/**
 * ROTA DE TESTE PARA VALIDAR COORDENADAS DO USUÁRIO
 */

import { Router } from "express";
import { CCBGenerationService } from "../services/ccbGenerationService";
import { USER_CCB_COORDINATES } from "../services/ccbUserCoordinates";

const router = Router();

/**
 * GET /api/test-ccb-coordinates/validate
 * Retorna as coordenadas atuais em uso
 */
router.get("/validate", async (req, res) => {
  try {
    const coordinatesInUse = {
      system: "USER_CCB_COORDINATES",
      totalFields: Object.keys(USER_CCB_COORDINATES).length,
      samples: {
        nomeCliente: USER_CCB_COORDINATES.nomeCliente,
        cpfCliente: USER_CCB_COORDINATES.cpfCliente,
        valorPrincipal: USER_CCB_COORDINATES.valorPrincipal,
        prazoAmortizacao: USER_CCB_COORDINATES.prazoAmortizacao,
      },
      comparison: {
        old: {
          nomeCliente: { x: 120, y: 680 }, // Antigas
          cpfCliente: { x: 120, y: 655 },
          valorPrincipal: { x: 200, y: 580 },
        },
        new: {
          nomeCliente: USER_CCB_COORDINATES.nomeCliente, // Suas novas
          cpfCliente: USER_CCB_COORDINATES.cpfCliente,
          valorPrincipal: USER_CCB_COORDINATES.valorPrincipal,
        },
      },
      status: "✅ USANDO SUAS COORDENADAS MANUAIS",
    };

    res.json(coordinatesInUse);
  } catch (error) {
    res.status(500).json({
      error: "Erro ao validar coordenadas",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

/**
 * POST /api/test-ccb-coordinates/generate-test
 * Gera CCB de teste com as novas coordenadas
 */
router.post("/generate-test", async (req, res) => {
  try {
    const { proposalId } = req.body;
    
    if (!proposalId) {
      return res.status(400).json({ error: "proposalId é obrigatório" });
    }

    console.log("🧪 [TEST] Iniciando teste de geração com coordenadas do usuário");
    console.log("🧪 [TEST] Proposta:", proposalId);
    console.log("🧪 [TEST] Sistema usando:", "USER_CCB_COORDINATES");
    console.log("🧪 [TEST] Total de campos mapeados:", Object.keys(USER_CCB_COORDINATES).length);
    
    const ccbService = new CCBGenerationService();
    const result = await ccbService.generateCCB(proposalId);
    
    if (result.success) {
      res.json({
        success: true,
        message: "CCB gerado com suas coordenadas manuais!",
        pdfPath: result.pdfPath,
        coordinatesUsed: "USER_CCB_COORDINATES",
        samplesUsed: {
          nomeCliente: USER_CCB_COORDINATES.nomeCliente,
          cpfCliente: USER_CCB_COORDINATES.cpfCliente,
          valorPrincipal: USER_CCB_COORDINATES.valorPrincipal,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("❌ [TEST] Erro:", error);
    res.status(500).json({
      error: "Erro ao gerar CCB de teste",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

export default router;