/**
 * Rotas para debug e ajuste de coordenadas CCB
 */

import { Router } from 'express';
import CCBCoordinateDebugger, { CoordinateTest } from '../utils/ccbCoordinateDebugger';

const router = Router();
const coordinateDebugger = new CCBCoordinateDebugger();

/**
 * Testa uma coordenada específica com diferentes interpretações
 */
router.post('/test-single-coordinate', async (req, res) => {
  try {
    const { x, y, testText = 'TESTE', page = 1 } = req.body;

    if (!x || !y) {
      return res.status(400).json({ error: 'Coordenadas X e Y são obrigatórias' });
    }

    console.log(`🧪 [COORD API] Testando coordenada única: (${x}, ${y})`);

    const pdfBuffer = await coordinateDebugger.testCoordinateInterpretations(
      Number(x), 
      Number(y), 
      String(testText), 
      Number(page)
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="coordinate-test-${x}-${y}.pdf"`
    });

    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ [COORD API] Erro no teste:', error);
    res.status(500).json({ error: 'Erro ao testar coordenada' });
  }
});

/**
 * Testa múltiplas coordenadas de uma vez
 */
router.post('/test-multiple-coordinates', async (req, res) => {
  try {
    const { coordinates } = req.body;

    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return res.status(400).json({ error: 'Array de coordenadas é obrigatório' });
    }

    console.log(`🧪 [COORD API] Testando múltiplas coordenadas: ${coordinates.length} campos`);

    const coordinateTests: CoordinateTest[] = coordinates.map((coord: any) => ({
      fieldName: coord.fieldName || 'campo',
      x: Number(coord.x),
      y: Number(coord.y),
      testText: coord.testText || coord.fieldName || 'TESTE',
      referenceType: coord.referenceType || 'left'
    }));

    const pdfBuffer = await coordinateDebugger.testMultipleCoordinates(coordinateTests);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="multiple-coordinates-test.pdf"`
    });

    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ [COORD API] Erro no teste múltiplo:', error);
    res.status(500).json({ error: 'Erro ao testar coordenadas' });
  }
});

/**
 * Converte coordenadas visuais para PDF
 */
router.post('/convert-coordinates', async (req, res) => {
  try {
    const { coordinates, fromVisual = true, pageHeight = 842.25 } = req.body;

    if (!Array.isArray(coordinates)) {
      return res.status(400).json({ error: 'Array de coordenadas é obrigatório' });
    }

    const converted = coordinates.map((coord: any) => {
      const newY = fromVisual 
        ? coordinateDebugger.convertVisualToPDF(coord.y, pageHeight)
        : coordinateDebugger.convertPDFToVisual(coord.y, pageHeight);

      return {
        ...coord,
        originalY: coord.y,
        convertedY: newY,
        conversion: fromVisual ? 'visual→pdf' : 'pdf→visual'
      };
    });

    res.json({
      success: true,
      pageHeight,
      conversions: converted
    });

  } catch (error) {
    console.error('❌ [COORD API] Erro na conversão:', error);
    res.status(500).json({ error: 'Erro ao converter coordenadas' });
  }
});

/**
 * Retorna guia de como usar as coordenadas
 */
router.get('/coordinate-guide', (req, res) => {
  res.json({
    title: 'Guia de Coordenadas CCB',
    systems: {
      visual: {
        description: 'Como você vê na tela (ferramenta de mapeamento)',
        origin: 'Canto superior esquerdo (0,0)',
        yDirection: 'Y cresce PARA BAIXO',
        example: 'Se você clicou 100px do topo, Y = 100'
      },
      pdf: {
        description: 'Sistema interno do PDF (pdf-lib)',
        origin: 'Canto inferior esquerdo (0,0)',
        yDirection: 'Y cresce PARA CIMA',
        example: 'Para Y=100 visual em página 842px, PDF Y = 742'
      }
    },
    referenceTypes: {
      left: 'Coordenada é onde o texto COMEÇA (padrão)',
      center: 'Coordenada é o CENTRO do campo',
      right: 'Coordenada é onde o texto TERMINA',
      'top-left': 'Coordenada é o canto superior esquerdo',
      'bottom-left': 'Coordenada é o canto inferior esquerdo'
    },
    recommendations: {
      measurement: 'Meça sempre do CENTRO do campo no template',
      testing: 'Use /test-single-coordinate para verificar posicionamento',
      adjustment: 'Ajuste X/Y em incrementos de 5-10 pixels',
      pageHeight: 'Altura padrão CCB: 842.25 points (A4)'
    }
  });
});

export default router;