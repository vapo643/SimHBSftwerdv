/**
 * Adapter Transacional para CcbRepository
 *
 * Permite que o repositório de CCBs trabalhe dentro de uma transação
 * gerenciada pelo Unit of Work.
 */

import { eq, and, gte, lte, or, isNull, sql, inArray, desc, asc, gt, lt } from 'drizzle-orm';
import { PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import { ExtractTablesWithRelations } from 'drizzle-orm';
import { ccbs, propostas } from '@shared/schema';
import * as schema from '@shared/schema';
import { Ccb } from '@shared/schema';
import { ICcbRepository, CcbStatus } from '../../ccb/domain/ICcbRepository';
import {
  PaginatedResult,
  CursorPaginationOptions,
  RepositoryFilters,
  CursorUtils,
} from '@shared/types/pagination';

// Type para transação Drizzle
type DrizzleTransaction = PostgresJsTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export class TransactionalCcbRepository implements ICcbRepository {
  constructor(private readonly tx: DrizzleTransaction) {}

  async save(ccb: Ccb): Promise<void> {
    const exists = await this.exists(ccb.id);

    if (exists) {
      // Update
      await this.tx
        .update(ccbs)
        .set({
          status: ccb.status,
          caminhoDocumentoOriginal: ccb.caminhoDocumentoOriginal,
          urlDocumentoOriginal: ccb.urlDocumentoOriginal,
          caminhoDocumentoAssinado: ccb.caminhoDocumentoAssinado,
          urlDocumentoAssinado: ccb.urlDocumentoAssinado,
          clicksignDocumentKey: ccb.clicksignDocumentKey,
          clicksignSignerKey: ccb.clicksignSignerKey,
          clicksignListKey: ccb.clicksignListKey,
          clicksignSignUrl: ccb.clicksignSignUrl,
          clicksignStatus: ccb.clicksignStatus,
          dataEnvioAssinatura: ccb.dataEnvioAssinatura,
          dataAssinaturaConcluida: ccb.dataAssinaturaConcluida,
          prazoAssinatura: ccb.prazoAssinatura,
          tamanhoArquivo: ccb.tamanhoArquivo,
          hashDocumento: ccb.hashDocumento,
          versaoTemplate: ccb.versaoTemplate,
          observacoes: ccb.observacoes,
          updatedAt: new Date(),
        })
        .where(eq(ccbs.id, ccb.id));
    } else {
      // Create
      await this.tx.insert(ccbs).values([ccb]);
    }
  }

  async findById(id: string): Promise<Ccb | null> {
    const result = await this.tx
      .select()
      .from(ccbs)
      .where(and(eq(ccbs.id, id), isNull(ccbs.deletedAt)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0];
  }

  async findByNumeroCcb(numeroCcb: string): Promise<Ccb | null> {
    const result = await this.tx
      .select()
      .from(ccbs)
      .where(and(eq(ccbs.numeroCCB, numeroCcb), isNull(ccbs.deletedAt)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0];
  }

  async findByPropostaId(propostaId: string): Promise<Ccb[]> {
    const result = await this.tx
      .select()
      .from(ccbs)
      .where(and(eq(ccbs.propostaId, propostaId), isNull(ccbs.deletedAt)))
      .orderBy(desc(ccbs.createdAt));

    return result;
  }

  async findReadyForSignature(): Promise<Ccb[]> {
    const result = await this.tx
      .select()
      .from(ccbs)
      .where(and(eq(ccbs.status, 'gerada' as any), isNull(ccbs.deletedAt)))
      .orderBy(desc(ccbs.createdAt));

    return result;
  }

  async findPendingSignatureWithTimeout(hours: number): Promise<Ccb[]> {
    const timeoutDate = new Date();
    timeoutDate.setHours(timeoutDate.getHours() - hours);

    const result = await this.tx
      .select()
      .from(ccbs)
      .where(
        and(
          eq(ccbs.status, 'enviada_para_assinatura' as any),
          lte(ccbs.dataEnvioAssinatura, timeoutDate),
          isNull(ccbs.deletedAt)
        )
      )
      .orderBy(desc(ccbs.createdAt));

    return result;
  }

  async findByClickSignStatus(clickSignStatus: string): Promise<Ccb[]> {
    const result = await this.tx
      .select()
      .from(ccbs)
      .where(and(eq(ccbs.clicksignStatus, clickSignStatus), isNull(ccbs.deletedAt)))
      .orderBy(desc(ccbs.createdAt));

    return result;
  }

  async findReadyForDownload(): Promise<Ccb[]> {
    const result = await this.tx
      .select()
      .from(ccbs)
      .where(and(eq(ccbs.status, 'assinada' as any), isNull(ccbs.deletedAt)))
      .orderBy(desc(ccbs.createdAt));

    return result;
  }

  async findWithPagination(
    options: CursorPaginationOptions,
    filters?: RepositoryFilters & {
      status?: CcbStatus | CcbStatus[];
      propostaId?: string;
      clickSignStatus?: string;
    }
  ): Promise<PaginatedResult<Ccb>> {
    let whereConditions = [isNull(ccbs.deletedAt)];

    // Aplicar filtros
    if (filters?.status) {
      const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
      whereConditions.push(inArray(ccbs.status, statusArray as any[]));
    }

    if (filters?.propostaId) {
      whereConditions.push(eq(ccbs.propostaId, filters.propostaId));
    }

    if (filters?.clickSignStatus) {
      whereConditions.push(eq(ccbs.clicksignStatus, filters.clickSignStatus));
    }

    const result = await this.tx
      .select()
      .from(ccbs)
      .where(and(...whereConditions))
      .orderBy(desc(ccbs.createdAt))
      .limit(options.limit || 50);

    return {
      data: result,
      pagination: {
        nextCursor:
          result.length === (options.limit || 50)
            ? CursorUtils.createFromItem(result[result.length - 1], 'createdAt')
            : null,
        prevCursor: null,
        pageSize: result.length,
        hasNextPage: result.length === (options.limit || 50),
        hasPrevPage: false,
      },
    };
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Ccb[]> {
    const result = await this.tx
      .select()
      .from(ccbs)
      .where(
        and(gte(ccbs.createdAt, startDate), lte(ccbs.createdAt, endDate), isNull(ccbs.deletedAt))
      )
      .orderBy(desc(ccbs.createdAt));

    return result;
  }

  async findByCreatedBy(userId: string): Promise<Ccb[]> {
    const result = await this.tx
      .select()
      .from(ccbs)
      .where(and(eq(ccbs.criadoPor, userId), isNull(ccbs.deletedAt)))
      .orderBy(desc(ccbs.createdAt));

    return result;
  }

  async countByStatus(status: CcbStatus): Promise<number> {
    const result = await this.tx
      .select({ count: sql<number>`count(*)` })
      .from(ccbs)
      .where(and(eq(ccbs.status, status as any), isNull(ccbs.deletedAt)));

    return result[0]?.count || 0;
  }

  async findOrphaned(): Promise<Ccb[]> {
    const result = await this.tx
      .select({ ccbs })
      .from(ccbs)
      .leftJoin(propostas, eq(ccbs.propostaId, propostas.id))
      .where(and(isNull(propostas.id), isNull(ccbs.deletedAt)))
      .orderBy(desc(ccbs.createdAt));

    return result.map((r) => r.ccbs);
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.tx
      .select({ id: ccbs.id })
      .from(ccbs)
      .where(and(eq(ccbs.id, id), isNull(ccbs.deletedAt)))
      .limit(1);

    return result.length > 0;
  }

  async existsByNumero(numeroCcb: string): Promise<boolean> {
    const result = await this.tx
      .select({ id: ccbs.id })
      .from(ccbs)
      .where(and(eq(ccbs.numeroCCB, numeroCcb), isNull(ccbs.deletedAt)))
      .limit(1);

    return result.length > 0;
  }

  async delete(id: string): Promise<void> {
    await this.tx
      .update(ccbs)
      .set({
        deletedAt: new Date(),
      })
      .where(eq(ccbs.id, id));
  }

  async getNextNumeroCcb(): Promise<string> {
    const result = await this.tx
      .select({ maxNum: sql<number>`COALESCE(MAX(CAST(${ccbs.numeroCCB} AS INTEGER)), 100000)` })
      .from(ccbs);

    const nextNumber = (result[0]?.maxNum || 100000) + 1;
    return nextNumber.toString();
  }
}
