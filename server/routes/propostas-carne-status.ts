import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { jwtAuthMiddleware as jwtMiddleware } from '../lib/jwt-auth-middleware.js';

const router = Router();

/**
 * GET /api/propostas/:id/carne-status
 * Verifica se existe um carnê gerado para a proposta
 */
router.get('/propostas/:id/carne-status', jwtMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`[CARNE STATUS] 🔍 Verificando status do carnê para proposta: ${id}`);
    
    // Buscar arquivos de carnê no Storage
    const { data: files, error: listError } = await supabase
      .storage
      .from('documents')
      .list(`propostas/${id}/carnes`, {
        limit: 1,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    
    if (listError) {
      console.error('[CARNE STATUS] ❌ Erro ao listar arquivos:', listError);
      return res.json({
        success: true,
        hasCarnet: false,
        message: 'Nenhum carnê encontrado'
      });
    }
    
    if (!files || files.length === 0) {
      console.log('[CARNE STATUS] ℹ️ Nenhum carnê encontrado');
      return res.json({
        success: true,
        hasCarnet: false,
        message: 'Nenhum carnê encontrado'
      });
    }
    
    // Carnê existe - gerar URL assinada
    const fileName = files[0].name;
    const filePath = `propostas/${id}/carnes/${fileName}`;
    
    console.log(`[CARNE STATUS] ✅ Carnê encontrado: ${fileName}`);
    
    // Gerar URL assinada válida por 1 hora
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('documents')
      .createSignedUrl(filePath, 3600);
    
    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('[CARNE STATUS] ❌ Erro ao gerar URL assinada:', signedUrlError);
      return res.json({
        success: true,
        hasCarnet: true,
        fileName: fileName,
        url: null,
        message: 'Carnê encontrado mas erro ao gerar URL'
      });
    }
    
    // Extrair informações do arquivo (número de boletos do nome do arquivo se disponível)
    const boletoMatch = fileName.match(/(\d+)_boletos/);
    const totalBoletos = boletoMatch ? parseInt(boletoMatch[1]) : null;
    
    console.log(`[CARNE STATUS] ✅ URL assinada gerada com sucesso`);
    
    return res.json({
      success: true,
      hasCarnet: true,
      fileName: fileName,
      url: signedUrlData.signedUrl,
      totalBoletos: totalBoletos,
      createdAt: files[0].created_at,
      message: 'Carnê disponível para download'
    });
    
  } catch (error) {
    console.error('[CARNE STATUS] ❌ Erro:', error);
    return res.status(500).json({
      success: false,
      hasCarnet: false,
      error: 'Erro ao verificar status do carnê'
    });
  }
});

export default router;