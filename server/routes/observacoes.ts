/**
 * Observacoes Controller - REFATORADO
 * Exemplo de controller seguindo arquitetura limpa
 * Controllers chamam Services, nunca acessam DB diretamente
 * Este é um exemplo do padrão correto para eliminar violações arquiteturais
 */

import { Router } from 'express';
import { z } from 'zod';
import { observacoesService } from '../services/observacoesService';
import { _jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { getClientIP } from '../lib/security-logger';

const _router = Router();

// Schema para validação do corpo da requisição
const _createObservacaoSchema = z.object({
  observacao: z.string().min(1, 'Observação é obrigatória').max(1000, 'Observação muito longa'),
  tipo_acao: z
    .enum([
      'Contato Realizado',
      'Negociação em Andamento',
      'Acordo Fechado',
      'Monitoramento',
      'Outros',
    ])
    .optional(),
});

const _updateObservacaoSchema = z.object({
  observacao: z.string().min(1, 'Observação é obrigatória').max(1000, 'Observação muito longa'),
});

/**
 * GET /api/propostas/:propostaId/observacoes
 * Buscar histórico de observações de uma proposta
 *
 * PADRÃO ARQUITETURAL: Controller -> Service -> Repository -> DB
 */
router.get('/propostas/:propostaId/observacoes', _jwtAuthMiddleware, async (req, res) => {
  try {
    const { propostaId } = req.params;
    const { role } = req.user!;

    // Verificar permissões (isto poderia estar em um middleware)
    if (role !== 'ADMINISTRADOR' && role !== 'COBRANCA' && role !== 'SUPERVISOR_COBRANCA') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Permissão insuficiente.',
      });
    }

    // PADRÃO CORRETO: Controller chama Service, não acessa DB
    const _observacoes = await observacoesService.getObservacoesByProposta(Number(propostaId));

    res.json({
      success: true,
      _observacoes,
      total: observacoes.length,
    });
  }
catch (error) {
    console.error('❌ [Controller/Observações] Erro ao buscar histórico:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao buscar observações',
    });
  }
});

/**
 * POST /api/propostas/:propostaId/observacoes
 * Criar nova observação
 *
 * PADRÃO ARQUITETURAL: Validação no Controller, lógica no Service
 */
router.post('/propostas/:propostaId/observacoes', _jwtAuthMiddleware, async (req, res) => {
  try {
    const { propostaId } = req.params;
    const { id: userId, email, role } = req.user!;

    // Verificar permissões
    if (role !== 'ADMINISTRADOR' && role !== 'COBRANCA' && role !== 'SUPERVISOR_COBRANCA') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Permissão insuficiente.',
      });
    }

    // Validar dados de entrada
    const __validatedData = createObservacaoSchema.parse(req.body);
    const _clientIp = getClientIP(req);

    // PADRÃO CORRETO: Controller chama Service com dados validados
    const _novaObservacao = await observacoesService.createObservacao(
      Number(propostaId),
      _validatedData.observacao,
      _userId,
      clientIp
    );

    res.status(201).json({
      success: true,
      observacao: novaObservacao,
      message: 'Observação criada com sucesso',
    });
  }
catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors,
      });
    }

    console.error('❌ [Controller/Observações] Erro ao criar observação:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao criar observação',
    });
  }
});

/**
 * PUT /api/observacoes/:observacaoId
 * Atualizar observação existente
 *
 * PADRÃO ARQUITETURAL: Permissões e validação no Controller, lógica no Service
 */
router.put('/observacoes/:observacaoId', _jwtAuthMiddleware, async (req, res) => {
  try {
    const { observacaoId } = req.params;
    const { id: userId, role } = req.user!;

    // Validar dados
    const __validatedData = updateObservacaoSchema.parse(req.body);
    const _clientIp = getClientIP(req);

    // PADRÃO CORRETO: Service cuida da lógica de negócio e validações
    const _observacaoAtualizada = await observacoesService.updateObservacao(
      Number(observacaoId),
      _validatedData.observacao,
      _userId,
      clientIp
    );

    res.json({
      success: true,
      observacao: observacaoAtualizada,
      message: 'Observação atualizada com sucesso',
    });
  }
catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors,
      });
    }

    console.error('❌ [Controller/Observações] Erro ao atualizar observação:', error);

    const _statusCode = error instanceof Error && error.message.includes('permissão') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao atualizar observação',
    });
  }
});

/**
 * DELETE /api/observacoes/:observacaoId
 * Deletar observação (soft delete)
 *
 * PADRÃO ARQUITETURAL: Autenticação/autorização no Controller, lógica no Service
 */
router.delete('/observacoes/:observacaoId', _jwtAuthMiddleware, async (req, res) => {
  try {
    const { observacaoId } = req.params;
    const { id: userId } = req.user!;
    const _clientIp = getClientIP(req);

    // PADRÃO CORRETO: Service gerencia permissões específicas e lógica
    await observacoesService.deleteObservacao(Number(observacaoId), userId, clientIp);

    res.json({
      success: true,
      message: 'Observação deletada com sucesso',
    });
  }
catch (error) {
    console.error('❌ [Controller/Observações] Erro ao deletar observação:', error);

    const _statusCode = error instanceof Error && error.message.includes('permissão') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao deletar observação',
    });
  }
});

/**
 * GET /api/observacoes
 * Listar observações com paginação
 *
 * PADRÃO ARQUITETURAL: Query params no Controller, processamento no Service
 */
router.get('/observacoes', _jwtAuthMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, proposta_id, usuario_id } = req.query;
    const { role } = req.user!;

    // Verificar permissões
    if (role !== 'ADMINISTRADOR' && role !== 'COBRANCA' && role !== 'SUPERVISOR_COBRANCA') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Permissão insuficiente.',
      });
    }

    // Montar filtros
    const filters: Record<string, any> = {};
    if (proposta_id) filters.proposta_id = Number(proposta_id);
    if (usuario_id) filters.usuario_id = usuario_id;

    // PADRÃO CORRETO: Service processa a lógica de paginação
    const _result = await observacoesService.getObservacoesPaginated(
      Number(page),
      Number(limit),
      filters
    );

    res.json({
      success: true,
      ...result,
    });
  }
catch (error) {
    console.error('❌ [Controller/Observações] Erro ao listar observações:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao listar observações',
    });
  }
});

export default router;

/**
 * DOCUMENTAÇÃO DO PADRÃO ARQUITETURAL
 * =========================
 *
 * ANTES (Violação):
 * Controller -> Database (direto via import { db })
 *
 * DEPOIS (Correto):
 * Controller -> Service -> Repository -> Database
 *
 * BENEFÍCIOS:
 * 1. Separação de responsabilidades clara
 * 2. Lógica de negócio isolada no Service
 * 3. Acesso a dados encapsulado no Repository
 * 4. Controller focado apenas em HTTP/validação
 * 5. Testabilidade melhorada
 * 6. Manutenibilidade aumentada
 *
 * COMO APLICAR EM OUTROS CONTROLLERS:
 * 1. Criar Repository específico ou usar BaseRepository
 * 2. Criar Service com lógica de negócio
 * 3. Refatorar Controller para chamar Service
 * 4. Remover imports diretos de db/supabase
 * 5. Executar validação arquitetural para confirmar
 */
