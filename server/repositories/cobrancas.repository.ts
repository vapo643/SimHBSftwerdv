/**
 * Cobrancas Repository
 * Handles all database operations for billing and collection data
 * PAM V1.0 - Repository pattern implementation
 */

import { BaseRepository } from './base.repository.js';
import { db } from '../lib/supabase.js';
import {
  propostas,
  parcelas,
  observacoesCobranca,
  historicoObservacoesCobranca,
  interCollections,
  profiles,
  solicitacoesModificacao,
  propostaLogs,
  statusContextuais,
} from '@shared/schema';
import { eq, and, sql, desc, gte, lte, inArray, or, not, isNotNull, isNull } from 'drizzle-orm';

export class CobrancasRepository extends BaseRepository<typeof propostas> {
  constructor() {
    super(propostas as unknown);
  }

  /**
   * Get proposals with billing status
   */
  async getPropostasCobranca(filters: { status?: string; atraso?: string }): Promise<any[]> {
    try {
      const statusElegiveis = [
        'BOLETOS_EMITIDOS',
        'PAGAMENTO_PENDENTE',
        'PAGAMENTO_PARCIAL',
        'PAGAMENTO_CONFIRMADO',
        'pronto_pagamento', // Legacy
      ];

      let _whereConditions = and(
        isNull(propostas.deletedAt),
        inArray(propostas.status, statusElegiveis)
      );

      const result = await db
        .select()
        .from(propostas)
        .leftJoin(
          statusContextuais,
          and(
            eq(statusContextuais.propostaId, propostas.id),
            eq(statusContextuais.contexto, 'cobranca')
          )
        )
        .where(whereConditions);

      return _result;
    }
catch (error) {
      console.error('[COBRANCAS_REPO] Error fetching proposals:', error);
      return [];
    }
  }

  /**
   * Get installments for a proposal
   */
  async getParcelasProposta(propostaId: number): Promise<any[]> {
    try {
      return await db
        .select()
        .from(parcelas)
        .where(eq(parcelas.propostaId, String(propostaId)))
        .orderBy(parcelas.numeroParcela);
    }
catch (error) {
      console.error('[COBRANCAS_REPO] Error fetching installments:', error);
      return [];
    }
  }

  /**
   * Get Inter collections for a proposal
   */
  async getInterCollections(propostaId: number): Promise<any[]> {
    try {
      return await db
        .select()
        .from(interCollections)
        .where(eq(interCollections.propostaId, String(propostaId)))
        .orderBy(desc(interCollections.createdAt));
    }
catch (error) {
      console.error('[COBRANCAS_REPO] Error fetching Inter collections:', error);
      return [];
    }
  }

  /**
   * Get collection observations for a proposal
   */
  async getObservacoesCobranca(propostaId: number): Promise<any[]> {
    try {
      return await db
        .select({
          id: observacoesCobranca.id,
          proposta_id: observacoesCobranca.propostaId,
          observacao: observacoesCobranca.observacao,
          tipo: observacoesCobranca.observacao,
          created_at: observacoesCobranca.createdAt,
          created_by: observacoesCobranca.userId,
          userName: profiles.fullName,
          userEmail: observacoesCobranca.userName,
        })
        .from(observacoesCobranca)
        .leftJoin(profiles, eq(profiles.id, observacoesCobranca.userId))
        .where(eq(observacoesCobranca.propostaId, String(propostaId)))
        .orderBy(desc(observacoesCobranca.createdAt));
    }
catch (error) {
      console.error('[COBRANCAS_REPO] Error fetching observations:', error);
      return [];
    }
  }

  /**
   * Create collection observation
   */
  async createObservacao(data: {
    proposta_id: number;
    observacao: string;
    tipo: string;
    created_by: string;
  }): Promise<any | null> {
    try {
      const [observation] = await db
        .insert(observacoesCobranca)
        .values({
          propostaId: String(data.proposta_id),
          observacao: data.observacao,
          userId: data.createdby,
          userName: 'Sistema', // Default value since not provided in data
          createdAt: new Date(),
        })
        .returning();

      return observation;
    }
catch (error) {
      console.error('[COBRANCAS_REPO] Error creating observation:', error);
      return null;
    }
  }

  /**
   * Update installment status
   */
  async updateParcelaStatus(
    parcelaId: number,
    status: string,
    updateData?: unknown
  ): Promise<boolean> {
    try {
      const updates: unknown = {
        status: status,
        updatedAt: new Date(),
      };

      if (updateData) {
        Object.assign(updates, updateData);
      }

      const result = await db
        .update(parcelas)
        .set(updates)
        .where(eq(parcelas.id, parcelaId))
        .returning();

      return _result.length > 0;
    }
catch (error) {
      console.error('[COBRANCAS_REPO] Error updating installment:', error);
      return false;
    }
  }

  /**
   * Get modification requests for a proposal
   */
  async getSolicitacoesModificacao(propostaId: number): Promise<any[]> {
    try {
      return await db
        .select()
        .from(solicitacoesModificacao)
        .where(eq(solicitacoesModificacao.propostaId, String(propostaId)))
        .orderBy(desc(solicitacoesModificacao.createdAt));
    }
catch (error) {
      console.error('[COBRANCAS_REPO] Error fetching modification requests:', error);
      return [];
    }
  }

  /**
   * Create modification request
   */
  async createSolicitacaoModificacao(data: {
    proposta_id: number;
    tipo: string;
    motivo: string;
    detalhes?: unknown;
    solicitado_por: string;
  }): Promise<any | null> {
    try {
      const [request] = await db
        .insert(solicitacoesModificacao)
        .values({
          propostaId: String(data.proposta_id),
          tipoSolicitacao: data.tipo,
          dadosSolicitacao: { motivo: data.motivo, detalhes: data.detalhes },
          solicitadoPorId: data.solicitadopor,
          solicitadoPorNome: 'Sistema', // Default value
          solicitadoPorRole: 'system', // Default value
          status: 'pendente',
          createdAt: new Date(),
        })
        .returning();

      return request;
    }
catch (error) {
      console.error('[COBRANCAS_REPO] Error creating modification request:', error);
      return null;
    }
  }

  /**
   * Get proposal logs
   */
  async getPropostaLogs(propostaId: number): Promise<any[]> {
    try {
      return await db
        .select()
        .from(propostaLogs)
        .where(eq(propostaLogs.propostaId, String(propostaId)))
        .orderBy(desc(propostaLogs.createdAt))
        .limit(50); // Limit recent logs
    }
catch (error) {
      console.error('[COBRANCAS_REPO] Error fetching logs:', error);
      return [];
    }
  }

  /**
   * Get overdue proposals count
   */
  async getOverdueCount(): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(propostas)
        .innerJoin(parcelas, eq(parcelas.propostaId, propostas.id))
        .where(
          and(
            isNull(propostas.deletedAt),
            inArray(propostas.status, ['BOLETOS_EMITIDOS', 'PAGAMENTO_PENDENTE']),
            lte(parcelas.dataVencimento, new Date().toISOString().split('T')[0]),
            eq(parcelas.status, 'pendente')
          )
        );

      return _result[0]?.count || 0;
    }
catch (error) {
      console.error('[COBRANCAS_REPO] Error counting overdue:', error);
      return 0;
    }
  }

  /**
   * Update proposal status
   */
  async updatePropostaStatus(
    propostaId: number,
    status: string,
    additionalData?: unknown
  ): Promise<boolean> {
    try {
      const updates: unknown = {
        status,
        updatedAt: new Date(),
      };

      if (additionalData) {
        Object.assign(updates, additionalData);
      }

      const result = await db
        .update(propostas)
        .set(updates)
        .where(eq(propostas.id, String(propostaId)))
        .returning();

      return _result.length > 0;
    }
catch (error) {
      console.error('[COBRANCAS_REPO] Error updating proposal status:', error);
      return false;
    }
  }
}

export const cobrancasRepository = new CobrancasRepository();
