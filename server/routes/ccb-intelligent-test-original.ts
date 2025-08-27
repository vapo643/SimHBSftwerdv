/**
 * Rota de Teste para Sistema Inteligente de Geração CCB V2
 */

import { Router } from 'express';
import { _jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { CCBGenerationServiceV2 } from '../services/ccbGenerationServiceV2';
import { db } from '../lib/supabase';
import { propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';

const _router = Router();

/**
 * POST /api/ccb-test-v2/generate/:propostaId
 * Testa geração de CCB com sistema inteligente
 */
router.post('/generate/:propostaId', _jwtAuthMiddleware, async (req, res) => {
  try {
    const { propostaId } = req.params;
    const { useTestData } = req.body;

    console.log(`🧪 Teste CCB V2: Iniciando para proposta ${propostaId}`);

    // Buscar dados da proposta ou usar dados de teste
    let propostaData;

    if (useTestData) {
      // Dados de teste completos
      propostaData = {
        id: propostaId,
        clienteNome: 'João da Silva Teste',
        clienteCpf: '123.456.789-00',
        clienteRg: '12.345.678-9',
        clienteEndereco: 'Rua Teste, 123 - Bairro Exemplo - São Paulo/SP',
        valor: 10000.0,
        prazo: 6,
        finalidade: 'Capital de Giro',
        taxaJuros: '2.5',
        dadosPagamentoBanco: 'Banco do Brasil',
        dadosPagamentoAgencia: '1234-5',
        dadosPagamentoConta: '56789-0',
        dadosPagamentoTipo: 'conta_corrente',
        dadosPagamentoNomeTitular: 'João da Silva Teste',
        dadosPagamentoCpfTitular: '123.456.789-00',
      };
    } else {
      // Buscar dados reais
      const [proposta] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      if (!proposta) {
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }

      propostaData = proposta;
    }

    // Gerar CCB com sistema inteligente
    const _service = new CCBGenerationServiceV2();
    const _result = await service.generateCCB(propostaData);

    if (!_result.success || !_result.pdfBytes) {
      return res.status(500).json({
        success: false,
        error: 'Falha na geração do CCB',
        logs: _result.logs,
      });
    }

    // Salvar no storage
    const _filePath = await service.saveCCBToStorage(_result.pdfBytes, propostaId);

    if (!filePath) {
      return res.status(500).json({
        success: false,
        error: 'Falha ao salvar CCB no storage',
        logs: _result.logs,
      });
    }

    // Gerar URL temporária
    const _publicUrl = await service.getCCBPublicUrl(filePath);

    console.log(`✅ Teste CCB V2: Sucesso para proposta ${propostaId}`);

    res.json({
      success: true,
      _filePath,
      _publicUrl,
      logs: _result.logs,
      stats: {
        totalLogs: _result.logs?.length || 0,
        successLogs: _result.logs?.filter((l) => l.includes('✓')).length || 0,
        warningLogs: _result.logs?.filter((l) => l.includes('⚠')).length || 0,
        errorLogs: _result.logs?.filter((l) => l.includes('✗') || l.includes('❌')).length || 0,
      },
    });
  } catch (error) {
    console.error('❌ Erro no teste CCB V2:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /api/ccb-test-v2/validate-coordinates
 * Valida se as coordenadas estão corretas
 */
router.get('/validate-coordinates', _jwtAuthMiddleware, async (req, res) => {
  try {
    const { CCB_FIELD_MAPPING_V2 } = await import('../services/ccbFieldMappingV2');

    const _validation = {
      totalFields: Object.keys(CCB_FIELD_MAPPING_V2).length,
      pages: {} as unknown,
      fields: [] as unknown[],
    };

    // Agrupar campos por página
    for (const [fieldName, coord] of Object.entries(CCB_FIELD_MAPPING_V2)) {
      const _pageNum = coord.page;

      if (!validation.pages[pageNum]) {
        validation.pages[pageNum] = {
          fields: [],
          count: 0,
        };
      }

      validation.pages[pageNum].fields.push(fieldName);
      validation.pages[pageNum].count++;

      validation.fields.push({
        name: fieldName,
        page: coord.page,
        x: coord.x,
        y: coord.y,
        size: coord.size,
        label: coord.label,
      });
    }

    res.json({
      success: true,
      _validation,
      summary: {
        totalFields: validation.totalFields,
        totalPages: Object.keys(validation.pages).length,
        fieldsPerPage: Object.entries(validation.pages).map(([page, data]: [string, any]) => ({
          page: parseInt(page),
          count: data.count,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao validar coordenadas',
    });
  }
});

/**
 * POST /api/ccb-test-v2/test-field-detection
 * Testa detecção de campo específico
 */
router.post('/test-field-detection', _jwtAuthMiddleware, async (req, res) => {
  try {
    const { fieldName, testValue, pageNumber } = req.body;

    if (!fieldName || !testValue) {
      return res.status(400).json({
        success: false,
        error: 'fieldName e testValue são obrigatórios',
      });
    }

    const { CCB_FIELD_MAPPING_V2, CoordinateAdjuster } = await import(
      '../services/ccbFieldMappingV2'
    );

    const _fieldCoord = CCB_FIELD_MAPPING_V2[fieldName];

    if (!fieldCoord) {
      return res.status(404).json({
        success: false,
        error: `Campo ${fieldName} não encontrado no mapeamento`,
      });
    }

    // Simular ajuste inteligente
    const _adjustedCoord = CoordinateAdjuster.smartAdjust(fieldName, fieldCoord);

    res.json({
      success: true,
      _fieldName,
      original: {
        x: fieldCoord.x,
        y: fieldCoord.y,
        page: fieldCoord.page,
        size: fieldCoord.size,
      },
      adjusted: {
        x: adjustedCoord.x,
        y: adjustedCoord.y,
        page: adjustedCoord.page,
        size: adjustedCoord.size,
      },
      adjustment: {
        deltaX: adjustedCoord.x - fieldCoord.x,
        deltaY: adjustedCoord.y - fieldCoord.y,
        sizeChanged: adjustedCoord.size !== fieldCoord.size,
      },
      _testValue,
      label: fieldCoord.label,
      maxWidth: fieldCoord.maxWidth,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao testar detecção',
    });
  }
});

/**
 * GET /api/ccb-test-v2/comparison
 * Compara sistema V1 vs V2
 */
router.get('/comparison', _jwtAuthMiddleware, async (req, res) => {
  try {
    const _comparison = {
      v1: {
        description: 'Sistema original com coordenadas fixas',
        pros: ['Simples e direto', 'Rápido para casos padrão'],
        cons: [
          'Não se adapta a variações',
          'Falha se template mudar',
          'Sem validação de preenchimento',
        ],
      },
      v2: {
        description: 'Sistema inteligente com detecção e fallback',
        pros: [
          'Detecção automática de campos',
          'Ajuste inteligente de coordenadas',
          'Sistema de fallback multinível',
          'Validação de preenchimento',
          'Logs detalhados',
          'À prova de falhas (como polling+webhook)',
        ],
        cons: ['Mais complexo', 'Pode ser ligeiramente mais lento'],
      },
      recommendation: 'Use V2 para produção devido à robustez e confiabilidade',
    };

    res.json({
      success: true,
      _comparison,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro na comparação',
    });
  }
});

export default router;
