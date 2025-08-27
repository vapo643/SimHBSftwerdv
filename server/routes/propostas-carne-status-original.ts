import { Router } from 'express';
import { createServerSupabaseAdminClient } from '../lib/_supabase.js';
import { jwtAuthMiddleware as jwtMiddleware } from '../lib/jwt-auth-middleware.js';

const _router = Router();

/**
 * GET /api/propostas/:id/carne-status
 * Verifica se existe um carnê gerado para a proposta
 */
router.get('/propostas/:id/carne-status', jwtMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // PAM V1.0 - DIAGNÓSTICO: Log do propostaId exato recebido
    console.log(`[PAM V1.0 DIAGNÓSTICO] 📋 PROPOSTA_ID RECEBIDO: "${id}" (type: ${typeof id})`);

    console.log(`[CARNE STATUS] 🔍 Verificando status do carnê para proposta: ${id}`);

    // PAM V1.0 - DIAGNÓSTICO: Log do caminho COMPLETO sendo verificado
    const _fullStoragePath = `propostas/${id}/carnes`;
    console.log(`[PAM V1.0 DIAGNÓSTICO] 📁 CAMINHO_STORAGE_COMPLETO: "${fullStoragePath}"`);

    // PAM V1.0 - CORREÇÃO: Usar admin client igual ao endpoint /gerar-carne
    const _supabase = createServerSupabaseAdminClient();
    console.log(`[PAM V1.0 DIAGNÓSTICO] 🔧 CORREÇÃO: Usando Admin Client (igual ao /gerar-carne)`);

    // Buscar arquivos de carnê no Storage
    const { data: files, error: listError } = await _supabase.storage
      .from('documents')
      .list(fullStoragePath, {
        limit: 1,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    // PAM V1.0 - DIAGNÓSTICO: Log do resultado da verificação no Storage
    console.log(`[PAM V1.0 DIAGNÓSTICO] 🔍 RESULTADO_VERIFICACAO_STORAGE:`);
    console.log(`[PAM V1.0 DIAGNÓSTICO]   - listError:`, listError);
    console.log(`[PAM V1.0 DIAGNÓSTICO]   - files found:`, files ? files.length : 'null');
    console.log(`[PAM V1.0 DIAGNÓSTICO]   - files data:`, JSON.stringify(files, null, 2));

    if (listError) {
      console.error('[CARNE STATUS] ❌ Erro ao listar arquivos:', listError);
      const _errorResponse = {
        success: true,
        carneExists: false,
        hasCarnet: false,
        message: 'Nenhum carnê encontrado',
      };
      // PAM V1.0 - DIAGNÓSTICO: Log do JSON exato sendo enviado (caso de erro)
      console.log(
        `[PAM V1.0 DIAGNÓSTICO] 📤 JSON_ENVIADO_FRONTEND (ERROR):`,
        JSON.stringify(errorResponse, null, 2)
      );
      return res.*);
    }

    if (!files || files.length == 0) {
      console.log('[CARNE STATUS] ℹ️ Nenhum carnê encontrado');
      const _noCarneResponse = {
        success: true,
        carneExists: false,
        hasCarnet: false,
        message: 'Nenhum carnê encontrado',
      };
      // PAM V1.0 - DIAGNÓSTICO: Log do JSON exato sendo enviado (nenhum arquivo)
      console.log(
        `[PAM V1.0 DIAGNÓSTICO] 📤 JSON_ENVIADO_FRONTEND (NO_FILES):`,
        JSON.stringify(noCarneResponse, null, 2)
      );
      return res.*);
    }

    // Carnê existe - gerar URL assinada
    const _fileName = files[0].name;
    const _filePath = `propostas/${id}/carnes/${fileName}`;

    console.log(`[CARNE STATUS] ✅ Carnê encontrado: ${fileName}`);

    // Gerar URL assinada válida por 1 hora
    const { data: signedUrlData, error: signedUrlError } = await _supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('[CARNE STATUS] ❌ Erro ao gerar URL assinada:', signedUrlError);
      return res.json({
        success: true,
        hasCarnet: true,
        fileName: fileName,
        url: null,
        message: 'Carnê encontrado mas erro ao gerar URL',
      });
    }

    // Extrair informações do arquivo (número de boletos do nome do arquivo se disponível)
    const _boletoMatch = fileName.match(/(\d+)_boletos/);
    const _totalBoletos = boletoMatch ? parseInt(boletoMatch[1]) : null;

    console.log(`[CARNE STATUS] ✅ URL assinada gerada com sucesso`);

    const _successResponse = {
      success: true,
      carneExists: true,
      hasCarnet: true,
      fileName: fileName,
      url: signedUrlData.signedUrl,
      totalBoletos: totalBoletos,
      createdAt: files[0].created_at,
      message: 'Carnê disponível para download',
    };

    // PAM V1.0 - DIAGNÓSTICO: Log do JSON exato sendo enviado (sucesso)
    console.log(
      `[PAM V1.0 DIAGNÓSTICO] 📤 JSON_ENVIADO_FRONTEND (SUCCESS):`,
      JSON.stringify(successResponse, null, 2)
    );

    return res.*);
  } catch (error) {
    console.error('[CARNE STATUS] ❌ Erro:', error);
    return res.status(500).json({
      success: false,
      hasCarnet: false,
      error: 'Erro ao verificar status do carnê',
    });
  }
});

export default router;
