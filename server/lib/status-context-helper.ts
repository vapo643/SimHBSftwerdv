/**
 * PAM V1.0 - Helper de Dupla Escrita Transacional
 * Fase 1: Fundação + Instrumentação
 * Data: 19/08/2025
 *
 * Este módulo implementa a lógica de dupla escrita transacional
 * para garantir consistência entre a tabela legada (propostas.status)
 * e a nova tabela de contextos (status_contextuais)
 */

import { db, SYSTEM_USER_ID } from './supabase';
import { propostas, statusContextuais, propostaLogs, observacoesCobranca } from '@shared/schema';
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
  const startTime = Date.now();
  const { propostaId, novoStatus, contexto, userId, observacoes, metadata } = params;

  console.log(`[DUPLA-ESCRITA] 🚀 Iniciando transação para proposta ${propostaId}`);
  console.log(`[DUPLA-ESCRITA] 📊 Contexto: ${contexto}, Novo Status: ${novoStatus}`);

  try {
    // Verificar se db está disponível
    if (!db) {
      return {
        success: false,
        statusLegado: '',
        statusContextual: '',
        contexto,
        timestamp: new Date(),
        error: 'Database connection not available',
      };
    }

    // Executar em transação atômica
    const result = await db.transaction(async (tx: any) => {
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

      const statusAnterior = propostaAtual.status;
      console.log(`[DUPLA-ESCRITA] 📍 Status anterior: ${statusAnterior}`);

      // 2. Atualizar tabela legada (propostas.status)
      console.log(`[DUPLA-ESCRITA] 📝 Atualizando tabela legada...`);
      await tx
        .update(propostas)
        .set({
          status: novoStatus,
          // Atualizar campos específicos baseado no contexto
          ...(contexto === 'pagamentos' && novoStatus === 'pago'
            ? {
                dataPagamento: new Date(),
              }
            : {}),
          ...(contexto === 'formalizacao' && novoStatus === 'CCB_GERADA'
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
            atualizadoPor: userId || SYSTEM_USER_ID,
            observacoes,
            metadata: metadata
              ? sql`${JSON.stringify(metadata)}::jsonb`
              : statusContextualExistente.metadata,
          })
          .where(eq(statusContextuais.id, statusContextualExistente.id));
      } else {
        console.log(`[DUPLA-ESCRITA] ➕ Criando novo status contextual...`);
        await tx.insert(statusContextuais).values({
          propostaId,
          contexto,
          status: novoStatus,
          statusAnterior,
          atualizadoPor: userId || SYSTEM_USER_ID,
          observacoes,
          metadata: metadata ? sql`${JSON.stringify(metadata)}::jsonb` : null,
        });
      }

      // 5. Registrar observação na tabela observacoes_cobranca (PAM V1.0 - CORREÇÃO CRÍTICA)
      if (observacoes && typeof observacoes === 'string' && observacoes.trim() !== '') {
        console.log(`[DUPLA-ESCRITA] 💬 Persistindo observação na tabela 'observacoes_cobranca' para a proposta ${propostaId}`);
        await tx.insert(observacoesCobranca).values({
          propostaId: propostaId,
          userId: userId || 'e647afc0-03fa-482d-8293-d824dcab0399', // Fallback para userId sistemico
          userName: 'Sistema', // Fallback para Sistema (poderia buscar do perfil do usuário)
          observacao: observacoes,
          tipoContato: 'INTERNO', // Define um tipo padrão para estas observações
          createdAt: new Date(),
        });
        console.log(`[DUPLA-ESCRITA] ✅ Observação salva em observacoes_cobranca`);
      }

      // 6. Registrar no log de auditoria
      console.log(`[DUPLA-ESCRITA] 📜 Registrando auditoria...`);
      await tx.insert(propostaLogs).values({
        propostaId,
        autorId: userId || SYSTEM_USER_ID,
        statusAnterior,
        statusNovo: novoStatus,
        observacao: `[${contexto.toUpperCase()}] ${observacoes || 'Status atualizado via dupla escrita'}`,
      });

      const duration = Date.now() - startTime;
      console.log(`[DUPLA-ESCRITA] ✅ Transação concluída em ${duration}ms`);

      return {
        success: true,
        statusLegado: novoStatus,
        statusContextual: novoStatus,
        contexto,
        timestamp: new Date(),
      };
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[DUPLA-ESCRITA] ❌ Erro na transação após ${duration}ms:`, error);

    return {
      success: false,
      statusLegado: '',
      statusContextual: '',
      contexto,
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
    // Verificar se db está disponível
    if (!db) {
      console.error(`[STATUS-CONTEXT] ❌ Database connection not available`);
      return null;
    }

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
  } catch (error) {
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
): Promise<{ isConsistent: boolean; details: any }> {
  try {
    // Verificar se db está disponível
    if (!db) {
      console.error(`[CONSISTÊNCIA] ❌ Database connection not available`);
      return { isConsistent: false, details: { error: 'Database unavailable' } };
    }

    const [proposta] = await db
      .select({ status: propostas.status })
      .from(propostas)
      .where(eq(propostas.id, propostaId))
      .limit(1);

    const contextosStatus = await db
      .select()
      .from(statusContextuais)
      .where(eq(statusContextuais.propostaId, propostaId));

    const inconsistencias = contextosStatus.filter((cs: any) => {
      // Regras de validação por contexto
      if (cs.contexto === 'pagamentos' && proposta?.status === 'pago') {
        return cs.status !== 'pago' && cs.status !== 'EMPRESTIMO_PAGO';
      }
      if (
        cs.contexto === 'cobrancas' &&
        ['QUITADO', 'INADIMPLENTE'].includes(proposta?.status || '')
      ) {
        return !['QUITADO', 'INADIMPLENTE', 'EM_DIA', 'VENCIDO'].includes(cs.status);
      }
      return false;
    });

    const isConsistent = inconsistencias.length === 0;

    if (!isConsistent) {
      console.warn(
        `[CONSISTÊNCIA] ⚠️ Inconsistências detectadas para proposta ${propostaId}:`,
        inconsistencias
      );
    }

    return {
      isConsistent,
      details: {
        propostaId,
        statusLegado: proposta?.status,
        statusContextuais: contextosStatus,
        inconsistencias,
      },
    };
  } catch (error) {
    console.error(`[CONSISTÊNCIA] ❌ Erro na validação:`, error);
    return {
      isConsistent: false,
      details: { error: error instanceof Error ? error.message : 'Erro desconhecido' },
    };
  }
}
