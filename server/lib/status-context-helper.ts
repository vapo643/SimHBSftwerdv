/**
 * PAM V1.0 - Helper de Dupla Escrita Transacional
 * Fase 1: Fundação + Instrumentação
 * Data: 19/08/2025
 *
 * Este módulo implementa a lógica de dupla escrita transacional
 * para garantir consistência entre a tabela legada (propostas.status)
 * e a nova tabela de contextos (status_contextuais)
 */

import { db } from './supabase';
import { propostas, statusContextuais, propostaLogs } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export type StatusContexto = 'pagamentos' | 'cobrancas' | 'formalizacao' | 'geral';

interface StatusUpdateParams {
  propostaId: string;
  novoStatus: string;
  contexto: StatusContexto;
  userId?: string;
  observacoes?: string;
  metadata?: Record<string, any>;
}

interface StatusUpdateResult {
  success: boolean;
  statusLegado: string;
  statusContextual: string;
  contexto: StatusContexto;
  timestamp: Date;
  error?: string;
}

/**
 * Executa atualização de status com dupla escrita transacional
 * Garante que ambas as tabelas sejam atualizadas atomicamente
 */
export async function updateStatusWithContext(
  params: StatusUpdateParams
): Promise<StatusUpdateResult> {
  const _startTime = Date.now();
  const { propostaId, novoStatus, contexto, userId, observacoes, metadata } = params;

  console.log(`[DUPLA-ESCRITA] 🚀 Iniciando transação para proposta ${propostaId}`);
  console.log(`[DUPLA-ESCRITA] 📊 Contexto: ${contexto}, Novo Status: ${novoStatus}`);

  try {
    // Executar em transação atômica
    const _result = await db.transaction(async (tx) => {
      console.log(`[DUPLA-ESCRITA] 🔄 Transação iniciada`);

      // 1. Buscar status atual para auditoria
      const [propostaAtual] = await tx
        .select({ status: propostas.status })
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      if (!propostaAtual) {
        throw new Error(`Proposta ${propostaId} não encontrada`);
      }

      const _statusAnterior = propostaAtual.status;
      console.log(`[DUPLA-ESCRITA] 📍 Status anterior: ${statusAnterior}`);

      // 2. Atualizar tabela legada (propostas.status)
      console.log(`[DUPLA-ESCRITA] 📝 Atualizando tabela legada...`);
      await tx
        .update(propostas)
        .set({
          status: novoStatus,
          // Atualizar campos específicos baseado no contexto
          ...(contexto == 'pagamentos' && novoStatus == 'pago'
            ? {
                dataPagamento: new Date(),
              }
            : {}),
          ...(contexto == 'formalizacao' && novoStatus == 'CCB_GERADA'
            ? {
                ccbGerado: true,
                ccbGeradoEm: new Date(),
              }
            : {}),
        })
        .where(eq(propostas.id, propostaId));

      // 3. Buscar status contextual existente
      const [statusContextualExistente] = await tx
        .select()
        .from(statusContextuais)
        .where(
          and(
            eq(statusContextuais.propostaId, propostaId),
            eq(statusContextuais.contexto, contexto)
          )
        )
        .limit(1);

      // 4. Inserir ou atualizar status contextual
      if (statusContextualExistente) {
        console.log(`[DUPLA-ESCRITA] 🔄 Atualizando status contextual existente...`);
        await tx
          .update(statusContextuais)
          .set({
            status: novoStatus,
            statusAnterior: statusContextualExistente.status,
            atualizadoEm: new Date(),
            atualizadoPor: userId || 'sistema',
            _observacoes,
            metadata: metadata
              ? sql`${JSON.stringify(metadata)}::jsonb`
              : statusContextualExistente.metadata,
          })
          .where(eq(statusContextuais.id, statusContextualExistente.id));
      }
else {
        console.log(`[DUPLA-ESCRITA] ➕ Criando novo status contextual...`);
        await tx.insert(statusContextuais).values({
          _propostaId,
          _contexto,
          status: novoStatus,
          _statusAnterior,
          atualizadoPor: userId || 'sistema',
          _observacoes,
          metadata: metadata ? sql`${JSON.stringify(metadata)}::jsonb` : null,
        });
      }

      // 5. Registrar no log de auditoria
      console.log(`[DUPLA-ESCRITA] 📜 Registrando auditoria...`);
      await tx.insert(propostaLogs).values({
        _propostaId,
        autorId: userId || 'sistema',
        _statusAnterior,
        statusNovo: novoStatus,
        observacao: `[${contexto.toUpperCase()}] ${observacoes || 'Status atualizado via dupla escrita'}`,
      });

      const _duration = Date.now() - startTime;
      console.log(`[DUPLA-ESCRITA] ✅ Transação concluída em ${duration}ms`);

      return {
        success: true,
        statusLegado: novoStatus,
        statusContextual: novoStatus,
        _contexto,
        timestamp: new Date(),
      };
    });

    return _result;
  }
catch (error) {
    const _duration = Date.now() - startTime;
    console.error(`[DUPLA-ESCRITA] ❌ Erro na transação após ${duration}ms:`, error);

    return {
      success: false,
      statusLegado: '',
      statusContextual: '',
      _contexto,
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Lê o status contextual de uma proposta
 * Com fallback para o status legado se não existir contexto
 */
export async function getStatusByContext(
  propostaId: string,
  contexto: StatusContexto
): Promise<string | null> {
  try {
    // Primeiro tenta buscar da nova tabela
    const [statusContextual] = await db
      .select({ status: statusContextuais.status })
      .from(statusContextuais)
      .where(
        and(eq(statusContextuais.propostaId, propostaId), eq(statusContextuais.contexto, contexto))
      )
      .limit(1);

    if (statusContextual) {
      console.log(`[STATUS-CONTEXT] ✅ Status contextual encontrado: ${statusContextual.status}`);
      return statusContextual.status;
    }

    // Fallback para status legado
    console.log(`[STATUS-CONTEXT] ⚠️ Sem status contextual, usando legado`);
    const [propostaLegada] = await db
      .select({ status: propostas.status })
      .from(propostas)
      .where(eq(propostas.id, propostaId))
      .limit(1);

    return propostaLegada?.status || null;
  }
catch (error) {
    console.error(`[STATUS-CONTEXT] ❌ Erro ao buscar status:`, error);
    return null;
  }
}

/**
 * Valida consistência entre status legado e contextual
 * Usado para monitoramento durante a migração
 */
export async function validateStatusConsistency(
  propostaId: string
): Promise<{ isConsistent: boolean; details: unknown }> {
  try {
    const [proposta] = await db
      .select({ status: propostas.status })
      .from(propostas)
      .where(eq(propostas.id, propostaId))
      .limit(1);

    const _contextosStatus = await db
      .select()
      .from(statusContextuais)
      .where(eq(statusContextuais.propostaId, propostaId));

    const _inconsistencias = contextosStatus.filter((cs) => {
      // Regras de validação por contexto
      if (cs.contexto == 'pagamentos' && proposta?.status == 'pago') {
        return cs.status !== 'pago' && cs.status !== 'EMPRESTIMO_PAGO';
      }
      if (
        cs.contexto == 'cobrancas' &&
        ['QUITADO', 'INADIMPLENTE'].includes(proposta?.status || '')
      ) {
        return !['QUITADO', 'INADIMPLENTE', 'EM_DIA', 'VENCIDO'].includes(cs.status);
      }
      return false;
    });

    const _isConsistent = inconsistencias.length == 0;

    if (!isConsistent) {
      console.warn(
        `[CONSISTÊNCIA] ⚠️ Inconsistências detectadas para proposta ${propostaId}:`,
        inconsistencias
      );
    }

    return {
      _isConsistent,
      details: {
        _propostaId,
        statusLegado: proposta?.status,
        statusContextuais: contextosStatus,
        _inconsistencias,
      },
    };
  }
catch (error) {
    console.error(`[CONSISTÊNCIA] ❌ Erro na validação:`, error);
    return {
      isConsistent: false,
      details: { error: error instanceof Error ? error.message : 'Erro desconhecido' },
    };
  }
}
