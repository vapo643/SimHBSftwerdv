/**
 * Rotas de Formalização
 * Gerencia geração de CCB, assinatura eletrônica e boletos
 */

import express from 'express';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { ccbGenerationService } from '../services/ccbGenerationService';
import { supabase } from '../lib/supabase';
import { db } from '../lib/supabase';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const router = express.Router();

// Schema de validação
const generateCCBSchema = z.object({
  proposalId: z.string().uuid()
});

/**
 * GET /api/formalizacao/:proposalId/status
 * Retorna status completo da formalização
 */
router.get('/:proposalId/status', jwtAuthMiddleware, async (req, res) => {
  try {
    const { proposalId } = req.params;

    const result = await db.execute(sql`
      SELECT 
        id,
        status,
        ccb_gerado,
        caminho_ccb,
        ccb_gerado_em,
        assinatura_eletronica_enviada,
        assinatura_eletronica_concluida,
        clicksign_document_id,
        clicksign_envelope_id,
        boletos_gerados,
        quantidade_boletos_gerados,
        todos_boletos_enviados
      FROM propostas
      WHERE id = ${proposalId}
    `);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Proposta não encontrada' 
      });
    }

    const proposal = result.rows[0];

    // Buscar timeline de eventos
    const logsResult = await db.execute(sql`
      SELECT 
        id,
        acao,
        detalhes,
        created_at
      FROM proposta_logs
      WHERE proposta_id = ${proposalId}
      AND acao IN ('CCB_GERADO', 'ASSINATURA_ENVIADA', 'ASSINATURA_CONCLUIDA', 'BOLETOS_GERADOS')
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      proposal,
      timeline: logsResult.rows || []
    });

  } catch (error) {
    console.error('❌ [FORMALIZACAO] Erro ao buscar status:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar status da formalização' 
    });
  }
});

/**
 * POST /api/formalizacao/generate-ccb
 * Gera CCB usando template PDF
 */
router.post('/generate-ccb', jwtAuthMiddleware, async (req, res) => {
  try {
    const validation = generateCCBSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: validation.error.errors 
      });
    }

    const { proposalId } = validation.data;

    // Verificar se CCB já foi gerado
    const alreadyGenerated = await ccbGenerationService.isCCBGenerated(proposalId);
    if (alreadyGenerated) {
      return res.status(400).json({ 
        error: 'CCB já foi gerado para esta proposta' 
      });
    }

    // Gerar CCB
    const result = await ccbGenerationService.generateCCB(proposalId);

    if (!result.success) {
      return res.status(500).json({ 
        error: result.error || 'Erro ao gerar CCB' 
      });
    }

    // Obter URL pública para visualização
    const publicUrl = await ccbGenerationService.getPublicUrl(result.pdfPath!);

    res.json({
      success: true,
      message: 'CCB gerado com sucesso',
      pdfPath: result.pdfPath,
      publicUrl
    });

  } catch (error) {
    console.error('❌ [FORMALIZACAO] Erro ao gerar CCB:', error);
    res.status(500).json({ 
      error: 'Erro interno ao gerar CCB' 
    });
  }
});

/**
 * GET /api/formalizacao/:proposalId/ccb
 * Retorna URL do CCB para visualização
 */
router.get('/:proposalId/ccb', jwtAuthMiddleware, async (req, res) => {
  try {
    const { proposalId } = req.params;

    const result = await db.execute(sql`
      SELECT 
        ccb_gerado,
        caminho_ccb,
        ccb_gerado_em
      FROM propostas
      WHERE id = ${proposalId}
    `);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Proposta não encontrada' 
      });
    }

    const proposal = result.rows[0];

    if (!proposal.ccb_gerado || !proposal.caminho_ccb) {
      return res.status(404).json({ 
        error: 'CCB ainda não foi gerado' 
      });
    }

    // Gerar URL assinada para download direto (válida por 1 hora)
    const { data: signedUrl, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(proposal.caminho_ccb, 3600);

    if (error) {
      console.error('❌ [FORMALIZACAO] Erro ao gerar URL assinada:', error);
      return res.status(500).json({ 
        error: 'Erro ao gerar URL de acesso' 
      });
    }

    res.json({
      success: true,
      ccbPath: proposal.caminho_ccb,
      signedUrl: signedUrl?.signedUrl,
      generatedAt: proposal.ccb_gerado_em
    });

  } catch (error) {
    console.error('❌ [FORMALIZACAO] Erro ao buscar CCB:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar CCB' 
    });
  }
});

/**
 * POST /api/formalizacao/:proposalId/regenerate-ccb
 * Regenera CCB (substitui o anterior)
 */
router.post('/:proposalId/regenerate-ccb', jwtAuthMiddleware, async (req, res) => {
  try {
    const { proposalId } = req.params;

    // Limpar flag de CCB gerado para permitir regeneração
    await db.execute(sql`
      UPDATE propostas
      SET 
        ccb_gerado = false,
        caminho_ccb = NULL,
        ccb_gerado_em = NULL
      WHERE id = ${proposalId}
    `);

    // Gerar novo CCB
    const result = await ccbGenerationService.generateCCB(proposalId);

    if (!result.success) {
      return res.status(500).json({ 
        error: result.error || 'Erro ao regenerar CCB' 
      });
    }

    // Obter URL pública
    const publicUrl = await ccbGenerationService.getPublicUrl(result.pdfPath!);

    res.json({
      success: true,
      message: 'CCB regenerado com sucesso',
      pdfPath: result.pdfPath,
      publicUrl
    });

  } catch (error) {
    console.error('❌ [FORMALIZACAO] Erro ao regenerar CCB:', error);
    res.status(500).json({ 
      error: 'Erro ao regenerar CCB' 
    });
  }
});

/**
 * GET /api/formalizacao/:proposalId/timeline
 * Retorna timeline de eventos da formalização
 */
router.get('/:proposalId/timeline', jwtAuthMiddleware, async (req, res) => {
  try {
    const { proposalId } = req.params;

    const result = await db.execute(sql`
      SELECT 
        id,
        acao,
        detalhes,
        usuario_id,
        created_at
      FROM proposta_logs
      WHERE proposta_id = ${proposalId}
      ORDER BY created_at DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      timeline: result.rows || []
    });

  } catch (error) {
    console.error('❌ [FORMALIZACAO] Erro ao buscar timeline:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar timeline' 
    });
  }
});

export default router;