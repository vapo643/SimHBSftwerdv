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

      return data as Observacao;
    } catch (error) {
      throw new Error(`Failed to create observacao: ${error}`);
    }
  }

  /**
   * Get observacoes with pagination
   */
  async findPaginated(page: number = 1, limit: number = 10, filters?: Record<string, any>) {
    const offset = (page - 1) * limit;

    let query = db
      .from(this.tableName)
      .select('*, users(full_name, email), propostas(numero_proposta)', { count: 'exact' })
      .is('deleted_at', null);

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch paginated observacoes: ${error.message}`);
    }

    return {
      data: data as Observacao[],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  /**
   * Soft delete an observacao
   */
  async softDelete(id: number, usuarioId: string): Promise<void> {
    const { error } = await db
      .from(this.tableName)
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: usuarioId,
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete observacao ${id}: ${error.message}`);
    }
  }
}

// Export singleton instance
export const observacoesRepository = new ObservacoesRepository();
