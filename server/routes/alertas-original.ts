/**
 * PAM V1.0 - Rotas do Sistema de Alertas Proativos
 * Data: 15/08/2025
 */

import { Router } from 'express';
import { alertasProativosService } from '../services/alertasProativosService';
import { db } from '../lib/supabase';
import { notificacoes, regrasAlertas, historicoExecucoesAlertas, users } from '@shared/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { _jwtAuthMiddleware } from '../lib/jwt-auth-middleware';

const _router = Router();

/**
 * GET /api/alertas/teste
 * Endpoint de teste para verificar funcionamento do serviço
 */
router.get('/teste', async (req, res) => {
  try {
    const _resultado = await alertasProativosService.testarServico();
    res.json(resultado);
  } catch (error) {
    console.error('[ALERTAS TESTE] Erro:', error);
    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao testar serviço de alertas',
    });
  }
});

/**
 * POST /api/alertas/executar
 * Endpoint para executar verificação manual (apenas ADMINISTRADOR)
 */
router.post('/executar', _jwtAuthMiddleware, async (req, res) => {
  try {
    const _userRole = req.user?.role;

    // Apenas ADMINISTRADOR pode executar manualmente
    if (userRole !== 'ADMINISTRADOR') {
      return res.status(403).json({
        error: 'Acesso negado',
        message: 'Apenas administradores podem executar verificação manual',
      });
    }

    console.log(`[ALERTAS] Execução manual solicitada por: ${req.user?.email}`);

    // Executar verificação em background
    alertasProativosService.executarVerificacaoDiaria().catch((error) => {
      console.error('[ALERTAS] Erro na execução manual:', error);
    });

    res.json({
      success: true,
      message: 'Verificação de alertas iniciada em background',
    });
  } catch (error) {
    console.error('[ALERTAS EXECUTAR] Erro:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao iniciar verificação de alertas',
    });
  }
});

/**
 * GET /api/alertas/notificacoes
 * Listar notificações do usuário
 */
router.get('/notificacoes', _jwtAuthMiddleware, async (req, res) => {
  try {
    const _userEmail = req.user?.email;
    const { status, limite = 50 } = req.query;

    if (!userEmail) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        message: 'Email do usuário não encontrado',
      });
    }

    // CORREÇÃO CRÍTICA: Buscar o ID do usuário local pela tabela users
    const [localUser] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);

    if (!localUser) {
      console.log(`[ALERTAS] Usuário local não encontrado para email: ${userEmail}`);
      // Retornar array vazio ao invés de erro 404
      return res.json({
        notificacoes: [],
        totalNaoLidas: 0,
      });
    }

    const _localUserId = localUser.id.toString();
    console.log(`[ALERTAS] Mapeamento: ${userEmail} -> Local ID: ${localUserId}`);

    let whereConditions: unknown = eq(notificacoes.userId, localUserId);

    if (status) {
      whereConditions = and(whereConditions, eq(notificacoes.status, status));
    }

    const _listaNotificacoes = await db
      .select()
      .from(notificacoes)
      .where(whereConditions)
      .orderBy(desc(notificacoes.createdAt))
      .limit(parseInt(limite as string));

    // Contar não lidas
    const [{ count: naoLidas }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notificacoes)
      .where(and(eq(notificacoes.userId, localUserId), eq(notificacoes.status, 'nao_lida')));

    console.log(
      `[ALERTAS] Encontradas ${listaNotificacoes.length} notificações, ${naoLidas || 0} não lidas`
    );

    res.json({
      notificacoes: listaNotificacoes,
      totalNaoLidas: naoLidas || 0,
    });
  } catch (error) {
    console.error('[ALERTAS NOTIFICACOES] Erro:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar notificações',
    });
  }
});

/**
 * POST /api/alertas/notificacoes/:id/marcar-lida
 * Marcar notificação como lida
 */
router.post('/notificacoes/:id/marcar-lida', _jwtAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const _userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        message: 'Email do usuário não encontrado',
      });
    }

    // CORREÇÃO CRÍTICA: Buscar o ID do usuário local
    const [localUser] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);

    if (!localUser) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        message: 'Usuário não existe na tabela local',
      });
    }

    const _localUserId = localUser.id.toString();

    await db
      .update(notificacoes)
      .set({
        status: 'lida',
        dataLeitura: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(notificacoes.id, parseInt(id)), eq(notificacoes.userId, localUserId)));

    console.log(`[ALERTAS] Notificação ${id} marcada como lida para usuário ${userEmail}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[ALERTAS MARCAR LIDA] Erro:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao marcar notificação como lida',
    });
  }
});

/**
 * POST /api/alertas/notificacoes/marcar-todas-lidas
 * Marcar todas as notificações como lidas
 */
router.post('/notificacoes/marcar-todas-lidas', _jwtAuthMiddleware, async (req, res) => {
  try {
    const _userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        message: 'Email do usuário não encontrado',
      });
    }

    // CORREÇÃO CRÍTICA: Buscar o ID do usuário local
    const [localUser] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);

    if (!localUser) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        message: 'Usuário não existe na tabela local',
      });
    }

    const _localUserId = localUser.id.toString();

    const _resultado = await db
      .update(notificacoes)
      .set({
        status: 'lida',
        dataLeitura: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(notificacoes.userId, localUserId), eq(notificacoes.status, 'nao_lida')))
      .returning({ id: notificacoes.id });

    console.log(
      `[ALERTAS] ${resultado.length} notificações marcadas como lidas para usuário ${userEmail}`
    );
    res.json({
      success: true,
      count: resultado.length,
    });
  } catch (error) {
    console.error('[ALERTAS MARCAR TODAS] Erro:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao marcar todas as notificações como lidas',
    });
  }
});

/**
 * DELETE /api/alertas/notificacoes/all
 * Limpar histórico de notificações (arquivar todas)
 */
router.delete('/notificacoes/all', _jwtAuthMiddleware, async (req, res) => {
  try {
    const _userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        message: 'Email do usuário não encontrado',
      });
    }

    // Buscar o ID do usuário local
    const [localUser] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);

    if (!localUser) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        message: 'Usuário não existe na tabela local',
      });
    }

    const _localUserId = localUser.id.toString();

    // Marcar todas as notificações como arquivadas
    const _resultado = await db
      .update(notificacoes)
      .set({
        status: 'arquivada',
        dataLeitura: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(notificacoes.userId, localUserId))
      .returning({ id: notificacoes.id });

    console.log(
      `[ALERTAS] Histórico limpo - ${resultado.length} notificações arquivadas para usuário ${userEmail}`
    );
    res.json({
      success: true,
      message: 'Histórico de notificações limpo com sucesso',
      notificacoesArquivadas: resultado.length,
    });
  } catch (error) {
    console.error('[ALERTAS LIMPAR HISTÓRICO] Erro:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao limpar histórico de notificações',
    });
  }
});

/**
 * GET /api/alertas/regras
 * Listar regras de alertas (apenas ADMINISTRADOR)
 */
router.get('/regras', _jwtAuthMiddleware, async (req, res) => {
  try {
    const _userRole = req.user?.role;

    if (userRole !== 'ADMINISTRADOR') {
      return res.status(403).json({
        error: 'Acesso negado',
        message: 'Apenas administradores podem visualizar regras',
      });
    }

    const _regras = await db.select().from(regrasAlertas).orderBy(regrasAlertas.nome);

    res.json(regras);
  } catch (error) {
    console.error('[ALERTAS REGRAS] Erro:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar regras de alertas',
    });
  }
});

/**
 * GET /api/alertas/historico
 * Visualizar histórico de execuções (apenas ADMINISTRADOR)
 */
router.get('/historico', _jwtAuthMiddleware, async (req, res) => {
  try {
    const _userRole = req.user?.role;

    if (userRole !== 'ADMINISTRADOR') {
      return res.status(403).json({
        error: 'Acesso negado',
        message: 'Apenas administradores podem visualizar histórico',
      });
    }

    const _historico = await db
      .select({
        id: historicoExecucoesAlertas.id,
        regraId: historicoExecucoesAlertas.regraId,
        dataExecucao: historicoExecucoesAlertas.dataExecucao,
        duracao: historicoExecucoesAlertas.duracao,
        status: historicoExecucoesAlertas.status,
        registrosProcessados: historicoExecucoesAlertas.registrosProcessados,
        notificacoesCriadas: historicoExecucoesAlertas.notificacoesCriadas,
        erroDetalhes: historicoExecucoesAlertas.erroDetalhes,
        triggerOrigem: historicoExecucoesAlertas.triggerOrigem,
      })
      .from(historicoExecucoesAlertas)
      .orderBy(desc(historicoExecucoesAlertas.dataExecucao))
      .limit(100);

    res.json(historico);
  } catch (error) {
    console.error('[ALERTAS HISTORICO] Erro:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar histórico de execuções',
    });
  }
});

export default router;
