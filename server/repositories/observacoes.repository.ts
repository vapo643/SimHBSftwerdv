/**
 * Observacoes Repository
 * Encapsulates all database operations for observacoes
 * Following architectural boundary rules - controllers must not access DB directly
 */

import { BaseRepository } from './base.repository';
import { db } from '../lib/supabase';
import { observacoesCobranca, profiles } from '../../shared/schema';
import { eq, isNull, desc } from 'drizzle-orm';

export interface Observacao {
  id: number;
  proposta_id: number;
  observacao: string;
  usuario_id: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export class ObservacoesRepository extends BaseRepository<Observacao> {
  constructor() {
    super('observacoes');
  }

  /**
   * Find all observacoes for a specific proposta
   */
  async findByPropostaId(propostaId: number): Promise<Observacao[]> {
    try {
      const data = await db
        .select({
          id: observacoesCobranca.id,
          proposta_id: observacoesCobranca.propostaId,
          observacao: observacoesCobranca.observacao,
          usuario_id: observacoesCobranca.userId,
          created_at: observacoesCobranca.createdAt,
        })
        .from(observacoesCobranca)
        .leftJoin(profiles, eq(profiles.id, observacoesCobranca.userId))
        .where(eq(observacoesCobranca.propostaId, String(propostaId)))
        .orderBy(desc(observacoesCobranca.createdAt));

      return data as any[];
    } catch (error) {
      throw new Error(`Failed to fetch observacoes for proposta ${propostaId}: ${error}`);
    }
  }

  /**
   * Create a new observacao with user association
   */
  async createWithUser(
    propostaId: number,
    observacao: string,
    usuarioId: string
  ): Promise<Observacao> {
    try {
      const [data] = await db
        .insert(observacoesCobranca)
        .values({
          propostaId: String(propostaId),
          observacao,
          userId: usuarioId,
          userName: 'Sistema',
          createdAt: new Date(),
        })
        .returning();

      if (!data) {
        throw new Error(`Failed to create observacao: No data returned`);
      }

      return data as unknown as Observacao;
    } catch (error) {
      throw new Error(`Failed to create observacao: ${error}`);
    }
  }

  /**
   * Get observacoes with pagination
   */
  async findPaginated(page: number = 1, limit: number = 10, filters?: Record<string, any>) {
    const offset = (page - 1) * limit;

    const result = await db
      .select()
      .from(observacoesCobranca)
      .where(isNull(observacoesCobranca.dataPromessaPagamento))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(observacoesCobranca.createdAt));

    // Aplicar filtros se fornecidos
    // TODO: Implementar filtros usando Drizzle syntax se necessário

    return {
      data: result as unknown as Observacao[],
      total: result.length,
      page,
      limit,
      totalPages: Math.ceil(result.length / limit),
    };
  }

  /**
   * Soft delete an observacao
   */
  async softDelete(id: number, usuarioId: string): Promise<void> {
    await db
      .update(observacoesCobranca)
      .set({
        statusPromessa: 'CANCELADO',
      })
      .where(eq(observacoesCobranca.id, id));
  }
}

// Export singleton instance
export const observacoesRepository = new ObservacoesRepository();
