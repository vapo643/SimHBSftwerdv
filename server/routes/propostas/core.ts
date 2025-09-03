/**
 * Propostas Routes - Refactored to use DDD Controller
 *
 * Esta é a camada mais fina possível - apenas define rotas
 * e delega toda a lógica para o ProposalController
 */

import { Router } from 'express';
import { ProposalController } from '../../modules/proposal/presentation/proposalController.js';

// Middleware auth TEMPORÁRIO - usando JWT padrão (RLS causando timeout)
const auth = async (req: any, res: any, next: any) => {
  try {
    // EMERGÊNCIA: Import JWT padrão para corrigir timeout
    const { jwtAuthMiddleware } = await import('../../lib/jwt-auth-middleware.js');
    return jwtAuthMiddleware(req, res, next);
  } catch (error) {
    console.error('[JWT WRAPPER] Error in auth middleware:', error);
    next(error);
  }
};

const router = Router();
const controller = new ProposalController();

// ===== ROTAS PRINCIPAIS =====

// GET /api/propostas - Listar propostas
router.get('/', auth, (req: any, res: any) => controller.list(req, res));

// GET /api/propostas/buscar-por-cpf/:cpf - Buscar por CPF (antes do /:id para evitar conflito)
router.get('/buscar-por-cpf/:cpf', auth, (req: any, res: any) => controller.getByCpf(req, res));

// 🔧 CRÍTICO: Rota específica /formalizacao ANTES da genérica /:id
router.get('/formalizacao', auth, async (req: any, res: any) => {
  console.log('🔍 [DEBUG] FORMALIZATION ROUTE HIT IN CORE ROUTER!');
  console.log('🔍 [DEBUG] URL:', req.url);
  console.log('🔍 [DEBUG] Path:', req.path);
  
  try {
    const { createServerSupabaseAdminClient } = await import('../../lib/supabase.js');
    const supabase = createServerSupabaseAdminClient();

    // Formalization statuses - TODOS exceto BOLETOS_EMITIDOS
    const formalizationStatuses = [
      'aprovado',
      'aceito_atendente',
      'documentos_enviados',
      'CCB_GERADA',
      'AGUARDANDO_ASSINATURA',
      'ASSINATURA_PENDENTE',
      'ASSINATURA_CONCLUIDA',
      'PAGAMENTO_PENDENTE',
      'PAGAMENTO_PARCIAL',
      'contratos_preparados',
      'contratos_assinados',
    ];

    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userLojaId = req.user?.loja_id;

    console.log(`🔐 [FORMALIZATION] Querying for user ${userId} with role ${userRole} from loja ${userLojaId}`);

    // Build query based on user role
    let query = supabase.from('propostas').select('*').in('status', formalizationStatuses);

    // Apply role-based filtering
    if (userRole === 'ATENDENTE') {
      query = query.eq('user_id', userId);
      console.log(`🔐 [FORMALIZATION] ATENDENTE filter: user_id = ${userId}`);
    } else if (userRole === 'GERENTE') {
      query = query.eq('loja_id', userLojaId);
      console.log(`🔐 [FORMALIZATION] GERENTE filter: loja_id = ${userLojaId}`);
    }

    const { data: rawPropostas, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('🚨 [FORMALIZATION] Supabase error:', error);
      return res.status(500).json({ message: 'Erro ao consultar propostas de formalização' });
    }

    if (!rawPropostas || rawPropostas.length === 0) {
      console.log(`🔐 [FORMALIZATION] No proposals found for user ${userId} with role ${userRole}`);
      return res.json([]);
    }

    // CORREÇÃO CRÍTICA: Parse JSONB fields e mapear snake_case para frontend
    const formalizacaoPropostas = rawPropostas.map((proposta) => {
      let clienteData = null;
      let condicoesData = null;

      try {
        if (typeof proposta.cliente_data === 'string') {
          clienteData = JSON.parse(proposta.cliente_data);
        } else {
          clienteData = proposta.cliente_data;
        }
      } catch (error) {
        console.warn(`Failed to parse cliente_data for proposta ${proposta.id}:`, error);
      }

      try {
        if (typeof proposta.condicoes_data === 'string') {
          condicoesData = JSON.parse(proposta.condicoes_data);
        } else {
          condicoesData = proposta.condicoes_data;
        }
      } catch (error) {
        console.warn(`Failed to parse condicoes_data for proposta ${proposta.id}:`, error);
      }

      return {
        ...proposta,
        clienteData,
        condicoesData,
        // Convert snake_case to camelCase for frontend compatibility
        createdAt: proposta.created_at,
        numeroProposta: proposta.numero_proposta,
        lojaId: proposta.loja_id,
        produtoId: proposta.produto_id,
        tabelaComercialId: proposta.tabela_comercial_id,
        userId: proposta.user_id,
        analistaId: proposta.analista_id,
        dataAnalise: proposta.data_analise,
        motivoPendencia: proposta.motivo_pendencia,
        dataAprovacao: proposta.data_aprovacao,
        documentosAdicionais: proposta.documentos_adicionais,
        contratoGerado: proposta.contrato_gerado,
        contratoAssinado: proposta.contrato_assinado,
        dataAssinatura: proposta.data_assinatura,
        dataPagamento: proposta.data_pagamento,
        observacoesFormalização: proposta.observacoes_formalizacao,
      };
    });

    console.log(`✅ [FORMALIZATION] Found ${formalizacaoPropostas.length} propostas for formalization`);
    res.json(formalizacaoPropostas);
  } catch (error) {
    console.error('❌ [FORMALIZATION] Error:', error);
    res.status(500).json({ message: 'Erro interno ao buscar propostas de formalização' });
  }
});

// GET /api/propostas/:id - Buscar proposta por ID
router.get('/:id', auth, (req: any, res: any) => controller.getById(req, res));

// POST /api/propostas - Criar nova proposta
router.post('/', auth, (req: any, res: any) => controller.create(req, res));

// PUT /api/propostas/:id/submit - Submeter para análise
router.put('/:id/submit', auth, (req: any, res: any) => controller.submitForAnalysis(req, res));

// PUT /api/propostas/:id/approve - Aprovar proposta
router.put('/:id/approve', auth, (req: any, res: any) => controller.approve(req, res));

// PUT /api/propostas/:id/reject - Rejeitar proposta
router.put('/:id/reject', auth, (req: any, res: any) => controller.reject(req, res));

// ===== ROTAS LEGACY (mantidas temporariamente para compatibilidade) =====

// GET /:id/observacoes - Logs de auditoria (manter original por enquanto)
router.get('/:id/observacoes', auth, async (req: any, res: any) => {
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
router.put('/:id/status', auth, async (req: any, res: any) => {
  // ADICIONAR: Validação defensiva do req.body
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Request body is required'
    });
  }
  
  const { status } = req.body;

  // Mapear para os novos endpoints baseado no status
  if (status === 'aprovado') {
    return controller.approve(req, res);
  } else if (status === 'rejeitado') {
    return controller.reject(req, res);
  } else if (status === 'aguardando_analise') {
    return controller.submitForAnalysis(req, res);
  } else if (status === 'pendente' || status === 'pendenciado') {
    // OPERAÇÃO VISÃO CLARA V1.0: Implementar transição para pendente
    try {
      // Aceitar tanto camelCase (frontend) quanto snake_case (backend)
      const motivo_pendencia = req.body.motivo_pendencia || req.body.motivoPendencia || req.body.observacao;
      
      if (!motivo_pendencia) {
        return res.status(400).json({
          success: false,
          error: 'Motivo da pendência é obrigatório',
        });
      }
      
      // Garantir que o motivo seja passado corretamente para o controller
      req.body.motivo_pendencia = motivo_pendencia;
      
      // OPERAÇÃO VISÃO CLARA V1.0: Implementado endpoint de pendência
      return controller.pendenciar(req, res);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar pendência',
      });
    }
  }

  // Para outros status, retornar erro por enquanto
  return res.status(400).json({
    success: false,
    error: 'Status transition not yet implemented in DDD architecture',
  });
});

export default router;
