/**
 * Rotas de Formalização
 * Gerencia geração de CCB, assinatura eletrônica e boletos
 */

import express from 'express';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../lib/jwt-auth-middleware';
import { ccbGenerationService } from '../services/ccbGenerationService';
import { supabase } from '../lib/supabase';
import { db } from '../lib/supabase';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const _router = express.Router();

// Schema de validação
const _generateCCBSchema = z.object({
  proposalId: z.string().uuid(),
});

/**
 * GET /api/formalizacao/:proposalId/status
 * Retorna status completo da formalização
 */
router.get('/:proposalId/status', jwtAuthMiddleware, async (req, res) => {
  try {
    const { proposalId } = req.params;

    const _result = await db.execute(sql`
      SELECT 
  _id,
  _status,
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

    if (!result || result.length == 0) {
      return res.status(404).json({
        error: 'Proposta não encontrada',
      });
    }

    const _proposal = result[0];

    // Buscar timeline de eventos
    const _logsResult = await db.execute(sql`
      SELECT 
  _id,
  _acao,
  _detalhes,
        created_at
      FROM proposta_logs
      WHERE proposta_id = ${proposalId}
      AND acao IN ('CCB_GERADO', 'ASSINATURA_ENVIADA', 'ASSINATURA_CONCLUIDA', 'BOLETOS_GERADOS')
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      _proposal,
      timeline: logsResult || [],
    });
  } catch (error) {
    console.error('❌ [FORMALIZACAO] Erro ao buscar status:', error);
    res.status(500).json({
      error: 'Erro ao buscar status da formalização',
    });
  }
});

/**
 * POST /api/formalizacao/generate-ccb
 * Gera CCB usando template PDF
 */
router.post('/generate-ccb', jwtAuthMiddleware, async (req, res) => {
  try {
    const _validation = generateCCBSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validation.error.errors,
      });
    }

    const { proposalId } = validation.data;

    // Verificar se CCB já foi gerado
    const _alreadyGenerated = await ccbGenerationService.isCCBGenerated(proposalId);
    if (alreadyGenerated) {
      return res.status(400).json({
        error: 'CCB já foi gerado para esta proposta',
      });
    }

    // Gerar CCB
    const _result = await ccbGenerationService.generateCCB(proposalId);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Erro ao gerar CCB',
      });
    }

    // Obter URL pública para visualização
    const _publicUrl = await ccbGenerationService.getPublicUrl(result.pdfPath!);

    res.json({
      success: true,
      message: 'CCB gerado com sucesso',
      pdfPath: result.pdfPath,
      _publicUrl,
    });
  } catch (error) {
    console.error('❌ [FORMALIZACAO] Erro ao gerar CCB:', error);
    res.status(500).json({
      error: 'Erro interno ao gerar CCB',
    });
  }
});

/**
 * GET /api/formalizacao/:proposalId/ccb
 * Retorna URL do CCB ORIGINAL para visualização
 */
router.get('/:proposalId/ccb', jwtAuthMiddleware, async (req, res) => {
  try {
    const { proposalId } = req.params;

    const _result = await db.execute(sql`
      SELECT 
        ccb_gerado,
        caminho_ccb,
        ccb_gerado_em
      FROM propostas
      WHERE id = ${proposalId}
    `);

    if (!result || result.length == 0) {
      return res.status(404).json({
        error: 'Proposta não encontrada',
      });
    }

    const _proposal = result[0];

    if (!proposal.ccb_gerado || !proposal.caminho_ccb) {
      return res.status(200).json({
        ccb_gerado: false,
        message: 'CCB ainda não foi gerado para esta proposta',
        status: 'pendente',
      });
    }

    // ✅ CORREÇÃO: Usar admin client para gerar URLs assinadas (conforme error_docs/storage_errors.md)
    const { createServerSupabaseAdminClient } = await import('../lib/supabase');
    const _adminSupabase = createServerSupabaseAdminClient();

    const { data: signedUrl, error } = await adminSupabase.storage
      .from('documents')
      .createSignedUrl(proposal.caminho_ccb as string, 3600);

    if (error) {
      console.error('❌ [FORMALIZACAO] Erro ao gerar URL assinada:', error);

      // 🔄 FALLBACK: Se arquivo não existe, tentar regenerar CCB automaticamente
      if ((error as unknown)?.status == 400 || error.message?.includes('Object not found')) {
        console.log('🔄 [FORMALIZACAO] Arquivo não encontrado, tentando regenerar CCB...');
        try {
          const _newCcb = await ccbGenerationService.generateCCB(proposalId);
          if (newCcb.success) {
            return res.json({
              success: true,
              ccbPath: newCcb.pdfPath,
              signedUrl: await ccbGenerationService.getPublicUrl(newCcb.pdfPath!),
              generatedAt: new Date().toISOString(),
              regenerated: true,
            });
          }
        } catch (regenError) {
          console.error('❌ [FORMALIZACAO] Erro na regeneração:', regenError);
        }
      }

      return res.status(500).json({
        error: 'Erro ao gerar URL de acesso',
        details: error.message,
      });
    }

    res.json({
      success: true,
      ccbPath: proposal.caminho_ccb,
      signedUrl: signedUrl?.signedUrl,
      generatedAt: proposal.ccb_gerado_em,
    });
  } catch (error) {
    console.error('❌ [FORMALIZACAO] Erro ao buscar CCB:', error);
    res.status(500).json({
      error: 'Erro ao buscar CCB',
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
    const _result = await ccbGenerationService.generateCCB(proposalId);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Erro ao regenerar CCB',
      });
    }

    // Obter URL pública
    const _publicUrl = await ccbGenerationService.getPublicUrl(result.pdfPath!);

    res.json({
      success: true,
      message: 'CCB regenerado com sucesso',
      pdfPath: result.pdfPath,
      _publicUrl,
    });
  } catch (error) {
    console.error('❌ [FORMALIZACAO] Erro ao regenerar CCB:', error);
    res.status(500).json({
      error: 'Erro ao regenerar CCB',
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

    const _result = await db.execute(sql`
      SELECT 
  _id,
  _acao,
  _detalhes,
        usuario_id,
        created_at
      FROM proposta_logs
      WHERE proposta_id = ${proposalId}
      ORDER BY created_at DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      timeline: result || [],
    });
  } catch (error) {
    console.error('❌ [FORMALIZACAO] Erro ao buscar timeline:', error);
    res.status(500).json({
      error: 'Erro ao buscar timeline',
    });
  }
});

/**
 * GET /api/formalizacao/:proposalId/ccb-assinada
 * Retorna URL do CCB ASSINADO para visualização
 * PAM V1.0 - Todos os roles autorizados podem VISUALIZAR
 * Restrição de DOWNLOAD é feita no frontend
 */
router.get(
  '/:proposalId/ccb-assinada',
  _jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { proposalId } = req.params;

      // PAM V1.0 CORREÇÃO: Todos os roles autorizados podem VER CCB assinada
      // Roles permitidos: ATENDENTE, FINANCEIRO, GERENTE, DIRETOR, ADMINISTRADOR
      const _allowedRoles = ['ATENDENTE', 'FINANCEIRO', 'GERENTE', 'DIRETOR', 'ADMINISTRADOR'];

      if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Acesso negado',
          message: 'Você não tem permissão para visualizar este documento',
        });
      }

      const _result = await db.execute(sql`
      SELECT 
        caminho_ccb_assinado,
        data_assinatura,
        assinatura_eletronica_concluida
      FROM propostas
      WHERE id = ${proposalId}
    `);

      if (!result || result.length == 0) {
        return res.status(404).json({
          error: 'Proposta não encontrada',
        });
      }

      const _proposal = result[0];

      if (!proposal.caminho_ccb_assinado) {
        return res.status(200).json({
          ccb_assinado: false,
          message: 'CCB assinada ainda não está disponível para esta proposta',
          status: 'pendente',
        });
      }

      // Usar admin client para gerar URL assinada
      const { createServerSupabaseAdminClient } = await import('../lib/supabase');
      const _adminSupabase = createServerSupabaseAdminClient();

      const { data: signedUrl, error } = await adminSupabase.storage
        .from('documents')
        .createSignedUrl(proposal.caminho_ccb_assinado as string, 3600);

      if (error) {
        console.error('❌ [FORMALIZACAO] Erro ao gerar URL assinada para CCB assinada:', error);
        return res.status(500).json({
          error: 'Erro ao gerar URL de acesso para CCB assinada',
          details: error.message,
        });
      }

      console.log(
        `✅ [FORMALIZACAO] CCB assinada acessada por ${req.user?.role} para proposta ${proposalId}`
      );

      res.json({
        success: true,
        ccbAssinadoPath: proposal.caminho_ccb_assinado,
        publicUrl: signedUrl?.signedUrl,
        dataAssinatura: proposal.data_assinatura,
        status: 'assinado',
      });
    } catch (error) {
      console.error('❌ [FORMALIZACAO] Erro ao buscar CCB assinada:', error);
      res.status(500).json({
        error: 'Erro interno ao buscar CCB assinada',
      });
    }
  }
);

export default router;
