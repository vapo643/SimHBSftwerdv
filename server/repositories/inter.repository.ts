/**
 * Inter Bank Repository
 * Handles all database operations for Inter Bank collections
 * PAM V1.0 - Repository pattern implementation
 */

import { BaseRepository } from './base.repository.js';
import { db } from '../lib/supabase.js';
import { supabaseAdmin } from '../lib/supabase-admin.js';
import {
  interCollections,
  propostas,
  historicoObservacoesCobranca,
  statusContextuais,
  type InterCollection,
  type Proposta,
} from '@shared/schema';
import { eq, and, gte, lte, or, inArray, desc, asc } from 'drizzle-orm';
import { getBrasiliaTimestamp } from '../lib/timezone.js';

export class InterRepository extends BaseRepository<typeof interCollections> {
  constructor() {
    super(interCollections);
  }

  /**
   * Find collection by proposal ID
   */
  async findByProposalId(proposalId: string): Promise<InterCollection | undefined> {
    const result = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, proposalId))
      .limit(1);

    return result[0];
  }

  /**
   * Find collection by codigoSolicitacao
   */
  async findByCodigoSolicitacao(codigoSolicitacao: string): Promise<InterCollection | undefined> {
    const result = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao))
      .limit(1);

    return result[0];
  }

  /**
   * Find collections by multiple codigoSolicitacao
   */
  async findByCodigosSolicitacao(codigos: string[]): Promise<InterCollection[]> {
    return await db
      .select()
      .from(interCollections)
      .where(inArray(interCollections.codigoSolicitacao, codigos));
  }

  /**
   * Search collections with filters
   */
  async searchCollections(params: {
    dataInicial?: string;
    dataFinal?: string;
    situacao?: string;
    pessoaPagadora?: string;
    seuNumero?: string;
    limit?: number;
    offset?: number;
  }): Promise<InterCollection[]> {
    let query = db.select().from(interCollections);
    const conditions = [];

    if (params.dataInicial && params.dataFinal) {
      conditions.push(
        and(
          gte(interCollections.dataVencimento, params.dataInicial),
          lte(interCollections.dataVencimento, params.dataFinal)
        )
      );
    }

    if (params.situacao) {
      conditions.push(eq(interCollections.situacao, params.situacao));
    }

    if (params.pessoaPagadora) {
      // Search by pagador name in metadata or other fields
      // TODO: Add proper field for pagador name search
    }

    if (params.seuNumero) {
      conditions.push(eq(interCollections.seuNumero, params.seuNumero));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(interCollections.createdAt));

    if (params.limit) {
      query = query.limit(params.limit);
    }

    if (params.offset) {
      query = query.offset(params.offset);
    }

    return await query;
  }

  /**
   * Create a new collection
   */
  async createCollection(data: Partial<InterCollection>): Promise<InterCollection> {
    const timestamp = getBrasiliaTimestamp();
    const collectionData = {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const result = await db.insert(interCollections).values(collectionData).returning();

    return result[0];
  }

  /**
   * Update collection
   */
  async updateCollection(
    id: number,
    data: Partial<InterCollection>
  ): Promise<InterCollection | undefined> {
    const result = await db
      .update(interCollections)
      .set({
        ...data,
        updatedAt: getBrasiliaTimestamp(),
      })
      .where(eq(interCollections.id, id))
      .returning();

    return result[0];
  }

  /**
   * Update collection by codigoSolicitacao
   */
  async updateByCodigoSolicitacao(
    codigoSolicitacao: string,
    data: Partial<InterCollection>
  ): Promise<InterCollection | undefined> {
    const result = await db
      .update(interCollections)
      .set({
        ...data,
        updatedAt: getBrasiliaTimestamp(),
      })
      .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao))
      .returning();

    return result[0];
  }

  /**
   * Delete collection (soft delete)
   */
  async deleteCollection(id: number): Promise<boolean> {
    const result = await db
      .update(interCollections)
      .set({
        deletedAt: getBrasiliaTimestamp(),
        updatedAt: getBrasiliaTimestamp(),
      })
      .where(eq(interCollections.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Get proposal by ID
   */
  async getProposal(proposalId: string): Promise<Proposta | undefined> {
    const result = await db.select().from(propostas).where(eq(propostas.id, proposalId)).limit(1);

    return result[0];
  }

  /**
   * Update proposal status
   */
  async updateProposalStatus(
    proposalId: string,
    status: string,
    userId?: string
  ): Promise<Proposta | undefined> {
    const result = await db
      .update(propostas)
      .set({
        status,
        updatedAt: getBrasiliaTimestamp(),
        usuarioId: userId,
      })
      .where(eq(propostas.id, proposalId))
      .returning();

    return result[0];
  }

  /**
   * Create observation history
   */
  async createObservationHistory(data: {
    propostaId: string;
    tipoObservacao: string;
    observacao: string;
    usuarioNome: string;
    usuarioId?: string;
    metadata?: any;
  }): Promise<any> {
    const result = await db
      .insert(historicoObservacoesCobranca)
      .values({
        ...data,
        dataObservacao: getBrasiliaTimestamp(),
        createdAt: getBrasiliaTimestamp(),
      })
      .returning();

    return result[0];
  }

  /**
   * Create status contextual
   */
  async createStatusContextual(data: {
    propostaId: string;
    statusAnterior: string;
    statusNovo: string;
    contexto: string;
    metadata?: any;
    usuarioId?: string;
  }): Promise<any> {
    const result = await db
      .insert(statusContextuais)
      .values({
        ...data,
        timestamp: getBrasiliaTimestamp(),
        createdAt: getBrasiliaTimestamp(),
      })
      .returning();

    return result[0];
  }

  /**
   * Get collections pending payment
   */
  async getCollectionsPendingPayment(limit: number = 100): Promise<InterCollection[]> {
    return await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.situacao, 'A_RECEBER'))
      .limit(limit);
  }

  /**
   * Mark collection as processing payment
   */
  async markAsProcessingPayment(id: number): Promise<InterCollection | undefined> {
    // Mark collection as being processed for payment
    return await this.updateCollection(id, {
      situacao: 'MARCADO_RECEBIDO',
      updatedAt: getBrasiliaTimestamp(),
    });
  }

  /**
   * Upload to storage
   */
  async uploadToStorage(
    bucket: string,
    path: string,
    file: Buffer | Uint8Array,
    contentType: string
  ): Promise<{ data: any; error: any }> {
    return await supabaseAdmin.storage.from(bucket).upload(path, file, {
      contentType,
      upsert: true,
    });
  }

  /**
   * Get download URL from storage
   */
  async getStorageUrl(bucket: string, path: string): Promise<{ data: any; error: any }> {
    return supabaseAdmin.storage.from(bucket).createSignedUrl(path, 3600); // 1 hour expiry
  }
}

export const interRepository = new InterRepository();
