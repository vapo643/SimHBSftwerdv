/**
 * Endpoint para testar e refinar coordenadas da CCB
 * Permite ajustes iterativos até obter posicionamento perfeito
 */

import express from 'express';
import { ccbGenerationService } from '../services/ccbGenerationService';
import { applyCoordinateAdjustments, COORDINATE_PRESETS, generatePositionReport, validateCoordinates } from '../services/ccbCoordinateMapper';

const router = express.Router();

// Endpoint para gerar CCB com coordenadas personalizadas
router.post('/test-coordinates/:proposalId', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { adjustments, preset } = req.body;

    console.log('📍 [CCB-TEST] Testando coordenadas para proposta:', proposalId);
    
    // Aplicar preset ou ajustes personalizados
    let coordinateAdjustments = [];
    if (preset && COORDINATE_PRESETS[preset as keyof typeof COORDINATE_PRESETS]) {
      coordinateAdjustments = COORDINATE_PRESETS[preset as keyof typeof COORDINATE_PRESETS];
      console.log(`📍 [CCB-TEST] Aplicando preset: ${preset}`);
    } else if (adjustments) {
      coordinateAdjustments = adjustments;
      console.log('📍 [CCB-TEST] Aplicando ajustes personalizados:', adjustments);
    }

    // Gerar CCB com ajustes
    const result = await ccbGenerationService.generateCCBWithAdjustments(proposalId, coordinateAdjustments);
    
    if (!result.success) {
      throw new Error(result.error || 'Erro na geração da CCB');
    }

    res.json({
      success: true,
      ccbPath: result.pdfPath,
      appliedAdjustments: coordinateAdjustments,
      message: 'CCB gerada com coordenadas de teste'
    });

  } catch (error) {
    console.error('❌ [CCB-TEST] Erro ao testar coordenadas:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Endpoint para obter relatório de posições atuais
router.get('/position-report/:proposalId', async (req, res) => {
  try {
    const { proposalId } = req.params;
    
    // Simular geração para obter dimensões da página
    const tempResult = await ccbGenerationService.generateCCB(proposalId);
    
    // Gerar relatório (assumindo dimensões padrão A4)
    const report = generatePositionReport(842); // Altura padrão A4 em pontos
    const validation = validateCoordinates(595, 842); // Largura e altura A4

    res.json({
      success: true,
      report,
      validationIssues: validation,
      pageInfo: {
        width: 595,
        height: 842,
        format: 'A4'
      }
    });

  } catch (error) {
    console.error('❌ [CCB-TEST] Erro ao gerar relatório:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Endpoint para listar presets disponíveis
router.get('/presets', (req, res) => {
  res.json({
    success: true,
    presets: Object.keys(COORDINATE_PRESETS),
    descriptions: {
      moveRight10: 'Move todos os campos 10px para a direita',
      moveDown20: 'Move todos os campos 20px para baixo',
      increaseFontSize: 'Aumenta o tamanho da fonte de todos os campos'
    }
  });
});

export default router;