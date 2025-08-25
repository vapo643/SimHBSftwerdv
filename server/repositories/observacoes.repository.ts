/**
 * Observacoes Repository
 * Encapsulates all database operations for observacoes
 * Following architectural boundary rules - controllers must not access DB directly
 */

import { BaseRepository } from "./base.repository";
import { db } from "../lib/supabase";

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
    super("observacoes");
  }

  /**
   * Find all observacoes for a specific proposta
   */
  async findByPropostaId(propostaId: number): Promise<Observacao[]> {
    const { data, error } = await db
      .from(this.tableName)
      .select("*, users(full_name, email)")
      .eq("proposta_id", propostaId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch observacoes for proposta ${propostaId}: ${error.message}`);
    }

    return data as Observacao[];
  }

  /**
   * Create a new observacao with user association
   */
  async createWithUser(propostaId: number, observacao: string, usuarioId: string): Promise<Observacao> {
    const { data, error } = await db
      .from(this.tableName)
      .insert({
        proposta_id: propostaId,
        observacao,
        usuario_id: usuarioId,
        created_at: new Date().toISOString()
      })
      .select("*, users(full_name, email)")
      .single();

    if (error) {
      throw new Error(`Failed to create observacao: ${error.message}`);
    }

    return data as Observacao;
  }

  /**
   * Get observacoes with pagination
   */
  async findPaginated(page: number = 1, limit: number = 10, filters?: Record<string, any>) {
    const offset = (page - 1) * limit;
    
    let query = db
      .from(this.tableName)
      .select("*, users(full_name, email), propostas(numero_proposta)", { count: "exact" })
      .is("deleted_at", null);

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch paginated observacoes: ${error.message}`);
    }

    return {
      data: data as Observacao[],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
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
        updated_by: usuarioId
      })
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete observacao ${id}: ${error.message}`);
    }
  }
}

// Export singleton instance
export const observacoesRepository = new ObservacoesRepository();