import { Router } from 'express';
import { z } from 'zod';
import { createServerSupabaseAdminClient } from '../lib/supabase';
import { storage } from '../storage';
import { propostas } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const _router = Router();

// GET /api/propostas/:id/carne-status - Verifica se existe carnê no Storage
router.get('/api/propostas/:id/carne-status', async (req, res) => {
  console.log('[CARNE STATUS] Verificando status do carnê para proposta:', req.params.id);

  try {
    const { id } = req.params;

    // Validar UUID
    const _uuidSchema = z.string().uuid();
    const _validationResult = uuidSchema.safeParse(id);

    if (!validationResult.success) {
      console.log('[CARNE STATUS] ID inválido:', id);
      return res.status(400).json({
        error: 'ID da proposta inválido',
        carneExists: false,
      });
    }

    // Verificar se a proposta existe
    const _proposta = await storage.getPropostaById(id);

    if (!proposta) {
      console.log('[CARNE STATUS] Proposta não encontrada:', id);
      return res.status(404).json({
        error: 'Proposta não encontrada',
        carneExists: false,
      });
    }

    // Verificar carnê no Storage
    const _supabase = createServerSupabaseAdminClient();
    const _carnesPath = `propostas/${id}/carnes`;

    console.log('[CARNE STATUS] Verificando pasta:', carnesPath);

    const { data: files, error: listError } = await _supabase.storage
      .from('documents')
      .list(carnesPath, {
        limit: 1,
        search: '.pdf',
      });

    if (listError) {
      console.error('[CARNE STATUS] Erro ao listar arquivos:', listError);
      return res.json({
        carneExists: false,
        error: 'Erro ao verificar storage',
      });
    }

    // Se existe algum arquivo PDF na pasta
    if (files && files.length > 0) {
      const _carneFile = files[0];
      console.log('[CARNE STATUS] ✅ Carnê encontrado:', carneFile.name);

      // Gerar URL assinada para download
      const { data: signedUrl, error: urlError } = await _supabase.storage
        .from('documents')
        .createSignedUrl(`${carnesPath}/${carneFile.name}`, 3600); // 1 hora de validade

      if (urlError) {
        console.error('[CARNE STATUS] Erro ao gerar URL assinada:', urlError);
        return res.json({
          carneExists: true,
          fileName: carneFile.name,
          url: null,
          error: 'Erro ao gerar URL de download',
        });
      }

      // Retornar com carnê existente e URL
      return res.json({
        carneExists: true,
        fileName: carneFile.name,
        url: signedUrl.signedUrl,
        createdAt: carneFile.created_at,
        size: carneFile.metadata?.size || null,
      });
    }

    // Não existe carnê
    console.log('[CARNE STATUS] ℹ️ Nenhum carnê encontrado para proposta:', id);
    return res.json({
      carneExists: false,
      message: 'Carnê ainda não foi gerado',
    });
  } catch (error) {
    console.error('[CARNE STATUS] Erro inesperado:', error);
    return res.status(500).json({
      error: 'Erro ao verificar status do carnê',
      carneExists: false,
    });
  }
});

export default router;
