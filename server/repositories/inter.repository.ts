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
import { getBrasiliaTimestamp, getBrasiliaDate } from '../lib/timezone.js';

export class InterRepository extends BaseRepository<typeof interCollections> {
  constructor() {
    super('inter_collections');
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
    let query = db.select().from(interCollections) as any;
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
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(interCollections.createdAt)) as any;

    if (params.limit) {
      query = query.limit(params.limit) as any;
    }

    if (params.offset) {
      query = query.offset(params.offset) as any;
    }

    return await query;
  }

  /**
   * Create a new collection
   */
  async createCollection(data: Partial<InterCollection>): Promise<InterCollection> {
    const timestamp = getBrasiliaDate();

    // Ensure required fields are present
    if (
      !data.propostaId ||
      !data.codigoSolicitacao ||
      !data.seuNumero ||
      !data.valorNominal ||
      !data.dataVencimento
    ) {
      throw new Error('Required fields missing for collection creation');
    }

    const collectionData = {
      ...data,
      propostaId: data.propostaId!,
      codigoSolicitacao: data.codigoSolicitacao!,
      seuNumero: data.seuNumero!,
      valorNominal: data.valorNominal!,
      dataVencimento: data.dataVencimento!,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const result = await db.insert(interCollections).values([collectionData]).returning();

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
        updatedAt: getBrasiliaDate(),
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
        updatedAt: getBrasiliaDate(),
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
        isActive: false,
        updatedAt: getBrasiliaDate(),
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
        updatedAt: getBrasiliaDate(),
        userId: userId,
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
    mensagem: string;
    criadoPor: string;
    tipoAcao?: string;
    dadosAcao?: any;
  }): Promise<any> {
    const result = await db
      .insert(historicoObservacoesCobranca)
      .values([
        {
          propostaId: data.propostaId,
          mensagem: data.mensagem,
          criadoPor: data.criadoPor,
          tipoAcao: data.tipoAcao,
          dadosAcao: data.dadosAcao,
        },
      ])
      .returning();

    return result[0];
  }

  /**
   * Create status contextual
   */
  async createStatusContextual(data: {
    propostaId: string;
    contexto: string;
    status: string;
    statusAnterior?: string;
    atualizadoPor?: string;
    observacoes?: string;
  }): Promise<any> {
    const result = await db
      .insert(statusContextuais)
      .values([
        {
          propostaId: data.propostaId,
          contexto: data.contexto,
          status: data.status,
          statusAnterior: data.statusAnterior,
          atualizadoPor: data.atualizadoPor,
          observacoes: data.observacoes,
        },
      ])
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
      updatedAt: getBrasiliaDate(),
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
