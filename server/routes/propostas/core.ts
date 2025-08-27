/**
 * Propostas Routes - Refactored to use DDD Controller
 *
 * Esta é a camada mais fina possível - apenas define rotas
 * e delega toda a lógica para o ProposalController
 */

import { Router } from 'express';
import { ProposalController } from '../../contexts/proposal/presentation/proposalController.js';

// Middleware auth com RLS para propostas - PAM V1.0 RLS Fix FINAL
const auth = async (req: unknown, res: unknown, next: unknown) => {
  try {
    // Import dinâmico do middleware RLS - RETURN Promise não await
    const { rlsAuthMiddleware } = await import('../../lib/rls-setup.js');
    return rlsAuthMiddleware(req, res, next); // ← RETURN não AWAIT
  } catch (error) {
    console.error('[RLS WRAPPER] Error in auth middleware:', error);
    next(error);
  }
};

const router = Router();
const controller = new ProposalController();

// ===== ROTAS PRINCIPAIS =====

// GET /api/propostas - Listar propostas
router.get('/', auth, (req: unknown, res: unknown) => controller.list(req, res));

// GET /api/propostas/buscar-por-cpf/:cpf - Buscar por CPF (antes do /:id para evitar conflito)
router.get('/buscar-por-cpf/:cpf', auth, (req: unknown, res: unknown) =>
  controller.getByCpf(req, res)
);

// GET /api/propostas/:id - Buscar proposta por ID
router.get('/:id', auth, (req: unknown, res: unknown) => controller.getById(req, res));

// POST /api/propostas - Criar nova proposta
router.post('/', auth, (req: unknown, res: unknown) => controller.create(req, res));

// PUT /api/propostas/:id/submit - Submeter para análise
router.put('/:id/submit', auth, (req: unknown, res: unknown) =>
  controller.submitForAnalysis(req, res)
);

// PUT /api/propostas/:id/approve - Aprovar proposta
router.put('/:id/approve', auth, (req: unknown, res: unknown) => controller.approve(req, res));

// PUT /api/propostas/:id/reject - Rejeitar proposta
router.put('/:id/reject', auth, (req: unknown, res: unknown) => controller.reject(req, res));

// ===== ROTAS LEGACY (mantidas temporariamente para compatibilidade) =====

// GET /:id/observacoes - Logs de auditoria (manter original por enquanto)
router.get('/:id/observacoes', auth, async (req: unknown, res: unknown) => {
  try {
    const propostaId = req.params.id;
    const { createServerSupabaseAdminClient } = await import('../../lib/supabase.js');
    const supabase = createServerSupabaseAdminClient();

    const { data: logs, error } = await supabase
      .from('proposta_logs')
      .select(
        `
        id,
        observacao,
        status_anterior,
        status_novo,
        created_at,
        autor_id,
        profiles!proposta_logs_autor_id_fkey (
          full_name,
          role
        )
      `
      )
      .eq('proposta_id', propostaId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Erro ao buscar logs de auditoria:', error);
      return res.json({ logs: [] });
    }

    const transformedLogs =
      logs?.map((log) => ({
        id: log.id,
        acao:
          log.status_novo === 'aguardando_analise'
            ? 'reenvio_atendente'
            : `mudanca_status_${log.status_novo}`,
        detalhes: log.observacao,
        status_anterior: log.status_anterior,
        status_novo: log.status_novo,
        data_acao: log.created_at,
        autor_id: log.autor_id,
        profiles: log.profiles,
        observacao: log.observacao,
        created_at: log.created_at,
      })) || [];

    res.json({
      logs: transformedLogs,
      total: transformedLogs.length,
    });
  } catch (error) {
    console.error('Error fetching proposal audit logs:', error);
    res.json({ logs: [] });
  }
});

// PUT /:id/status - Legacy status change endpoint (manter por compatibilidade)
router.put('/:id/status', auth, async (req: unknown, res: unknown) => {
  const { status } = req.body;

  // Mapear para os novos endpoints baseado no status
  if (status === 'aprovado') {
    return controller.approve(req, res);
  } else if (status === 'rejeitado') {
    return controller.reject(req, res);
  } else if (status === 'aguardando_analise') {
    return controller.submitForAnalysis(req, res);
  }

  // Para outros status, retornar erro por enquanto
  return res.status(400).json({
    success: false,
    error: 'Status transition not yet implemented in DDD architecture',
  });
});

export default router;
