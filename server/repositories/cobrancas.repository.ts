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
    super(propostas);
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

      let whereConditions = and(
        isNull(propostas.deletedAt),
        inArray(propostas.status, statusElegiveis)
      );

      const result = await db
        .select()
        .from(propostas)
        .leftJoin(
          statusContextuais,
          and(
            eq(statusContextuais.proposta_id, propostas.id),
            eq(statusContextuais.contexto, 'cobranca')
          )
        )
        .where(whereConditions);

      return result;
    } catch (error) {
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
        .where(eq(parcelas.proposta_id, propostaId))
        .orderBy(parcelas.numero_parcela);
    } catch (error) {
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
        .where(eq(interCollections.proposta_id, propostaId))
        .orderBy(desc(interCollections.created_at));
    } catch (error) {
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
          proposta_id: observacoesCobranca.proposta_id,
          observacao: observacoesCobranca.observacao,
          tipo: observacoesCobranca.tipo,
          created_at: observacoesCobranca.created_at,
          created_by: observacoesCobranca.created_by,
          userName: profiles.full_name,
          userEmail: profiles.email,
        })
        .from(observacoesCobranca)
        .leftJoin(profiles, eq(profiles.id, observacoesCobranca.created_by))
        .where(eq(observacoesCobranca.proposta_id, propostaId))
        .orderBy(desc(observacoesCobranca.created_at));
    } catch (error) {
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
          proposta_id: data.proposta_id,
          observacao: data.observacao,
          tipo: data.tipo,
          created_by: data.created_by,
          created_at: new Date().toISOString(),
        })
        .returning();

      return observation;
    } catch (error) {
      console.error('[COBRANCAS_REPO] Error creating observation:', error);
      return null;
    }
  }

  /**
   * Update installment status
   */
  async updateParcelaStatus(parcelaId: number, status: string, updateData?: any): Promise<boolean> {
    try {
      const updates: any = {
        status_pagamento: status,
        updated_at: new Date().toISOString(),
      };

      if (updateData) {
        Object.assign(updates, updateData);
      }

      const result = await db
        .update(parcelas)
        .set(updates)
        .where(eq(parcelas.id, parcelaId))
        .returning();

      return result.length > 0;
    } catch (error) {
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
        .where(eq(solicitacoesModificacao.proposta_id, propostaId))
        .orderBy(desc(solicitacoesModificacao.created_at));
    } catch (error) {
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
    detalhes?: any;
    solicitado_por: string;
  }): Promise<any | null> {
    try {
      const [request] = await db
        .insert(solicitacoesModificacao)
        .values({
          proposta_id: data.proposta_id,
          tipo: data.tipo,
          motivo: data.motivo,
          detalhes: data.detalhes,
          solicitado_por: data.solicitado_por,
          status: 'pendente',
          created_at: new Date().toISOString(),
        })
        .returning();

      return request;
    } catch (error) {
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
        .where(eq(propostaLogs.proposta_id, propostaId))
        .orderBy(desc(propostaLogs.created_at))
        .limit(50); // Limit recent logs
    } catch (error) {
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
        .innerJoin(parcelas, eq(parcelas.proposta_id, propostas.id))
        .where(
          and(
            isNull(propostas.deletedAt),
            inArray(propostas.status, ['BOLETOS_EMITIDOS', 'PAGAMENTO_PENDENTE']),
            lte(parcelas.data_vencimento, new Date().toISOString()),
            eq(parcelas.status_pagamento, 'pendente')
          )
        );

      return result[0]?.count || 0;
    } catch (error) {
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
    additionalData?: any
  ): Promise<boolean> {
    try {
      const updates: any = {
        status,
        updatedAt: new Date().toISOString(),
      };

      if (additionalData) {
        Object.assign(updates, additionalData);
      }

      const result = await db
        .update(propostas)
        .set(updates)
        .where(eq(propostas.id, propostaId))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error('[COBRANCAS_REPO] Error updating proposal status:', error);
      return false;
    }
  }
}

export const cobrancasRepository = new CobrancasRepository();
