/**
 * Implementação concreta do Repository de CCBs
 * Banking-Grade Repository Pattern - PAM V1.0 Sprint 2
 *
 * Usa Drizzle ORM para persistência no PostgreSQL.
 * Parte da camada de infraestrutura.
 */

import { eq, and, gte, lte, isNull, sql, inArray, desc, asc, gt, lt } from 'drizzle-orm';
import { db } from '../../../lib/supabase';
import { ccbs, propostas } from '@shared/schema';
import { Ccb } from '@shared/schema';
import { ICcbRepository, CcbStatus } from '../domain/ICcbRepository';
import {
  PaginatedResult,
  CursorPaginationOptions,
  RepositoryFilters,
  CursorUtils,
} from '@shared/types/pagination';

export class CcbRepository implements ICcbRepository {
  async save(ccb: Ccb): Promise<void> {
    const exists = await this.exists(ccb.id);

    if (exists) {
      // Update
      await db
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
      await db.insert(ccbs).values([ccb]);
    }
  }

  async findById(id: string): Promise<Ccb | null> {
    const result = await db
      .select()
      .from(ccbs)
      .where(and(eq(ccbs.id, id), isNull(ccbs.deletedAt)))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  async findByNumeroCcb(numeroCcb: string): Promise<Ccb | null> {
    const result = await db
      .select()
      .from(ccbs)
      .where(and(eq(ccbs.numeroCCB, numeroCcb), isNull(ccbs.deletedAt)))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  async findByPropostaId(propostaId: string, userId?: string): Promise<Ccb[]> {
    // RBAC: Se userId fornecido, verificar se o usuário tem acesso à proposta
    if (userId) {
      const results = await db
        .select({
          // Incluir todos os campos obrigatórios do tipo Ccb
          id: ccbs.id,
          propostaId: ccbs.propostaId,
          numeroCCB: ccbs.numeroCCB,
          valorCCB: ccbs.valorCCB,
          status: ccbs.status,
          caminhoDocumentoOriginal: ccbs.caminhoDocumentoOriginal,
          urlDocumentoOriginal: ccbs.urlDocumentoOriginal,
          caminhoDocumentoAssinado: ccbs.caminhoDocumentoAssinado,
          urlDocumentoAssinado: ccbs.urlDocumentoAssinado,
          clicksignDocumentKey: ccbs.clicksignDocumentKey,
          clicksignSignerKey: ccbs.clicksignSignerKey,
          clicksignListKey: ccbs.clicksignListKey,
          clicksignSignUrl: ccbs.clicksignSignUrl,
          clicksignStatus: ccbs.clicksignStatus,
          dataEnvioAssinatura: ccbs.dataEnvioAssinatura,
          dataAssinaturaConcluida: ccbs.dataAssinaturaConcluida,
          prazoAssinatura: ccbs.prazoAssinatura,
          tamanhoArquivo: ccbs.tamanhoArquivo,
          hashDocumento: ccbs.hashDocumento,
          versaoTemplate: ccbs.versaoTemplate,
          criadoPor: ccbs.criadoPor,
          observacoes: ccbs.observacoes,
          createdAt: ccbs.createdAt,
          updatedAt: ccbs.updatedAt,
          deletedAt: ccbs.deletedAt,
        })
        .from(ccbs)
        .innerJoin(propostas, eq(ccbs.propostaId, propostas.id))
        .where(
          and(
            eq(ccbs.propostaId, propostaId),
            eq(propostas.userId, userId), // RBAC: Filtrar por proprietário
            isNull(ccbs.deletedAt),
            isNull(propostas.deletedAt)
          )
        )
        .orderBy(desc(ccbs.createdAt));

      return results;
    } else {
      // Sem RBAC - para uso interno do sistema
      const results = await db
        .select()
        .from(ccbs)
        .where(and(eq(ccbs.propostaId, propostaId), isNull(ccbs.deletedAt)))
        .orderBy(desc(ccbs.createdAt));

      return results;
    }
  }

  async findReadyForSignature(): Promise<Ccb[]> {
    const results = await db
      .select()
      .from(ccbs)
      .where(
        and(
          eq(ccbs.status, 'gerada'),
          isNull(ccbs.deletedAt),
          isNull(ccbs.clicksignDocumentKey) // Ainda não enviada para ClickSign
        )
      )
      .orderBy(asc(ccbs.createdAt));

    return results;
  }

  async findPendingSignatureWithTimeout(hours: number): Promise<Ccb[]> {
    const timeoutDate = new Date();
    timeoutDate.setHours(timeoutDate.getHours() - hours);

    const results = await db
      .select()
      .from(ccbs)
      .where(
        and(
          eq(ccbs.status, 'enviada_para_assinatura'),
          isNull(ccbs.deletedAt),
          lte(ccbs.dataEnvioAssinatura, timeoutDate)
        )
      )
      .orderBy(asc(ccbs.dataEnvioAssinatura));

    return results;
  }

  async findByClickSignStatus(clickSignStatus: string): Promise<Ccb[]> {
    const results = await db
      .select()
      .from(ccbs)
      .where(and(eq(ccbs.clicksignStatus, clickSignStatus), isNull(ccbs.deletedAt)))
      .orderBy(desc(ccbs.updatedAt));

    return results;
  }

  async findReadyForDownload(): Promise<Ccb[]> {
    const results = await db
      .select()
      .from(ccbs)
      .where(
        and(
          eq(ccbs.status, 'assinada'),
          isNull(ccbs.deletedAt),
          isNull(ccbs.caminhoDocumentoAssinado) // Ainda não baixada
        )
      )
      .orderBy(asc(ccbs.dataAssinaturaConcluida));

    return results;
  }

  async findWithPagination(
    options: CursorPaginationOptions,
    filters?: RepositoryFilters & {
      status?: CcbStatus | CcbStatus[];
      propostaId?: string;
      clickSignStatus?: string;
    }
  ): Promise<PaginatedResult<Ccb>> {
    const { limit = 50, cursor, cursorField = 'created_at', direction = 'desc' } = options;

    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const conditions = [isNull(ccbs.deletedAt)];

    // Filtros específicos
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(ccbs.status, filters.status));
      } else {
        conditions.push(eq(ccbs.status, filters.status));
      }
    }

    if (filters?.propostaId) {
      conditions.push(eq(ccbs.propostaId, filters.propostaId));
    }

    if (filters?.clickSignStatus) {
      conditions.push(eq(ccbs.clicksignStatus, filters.clickSignStatus));
    }

    // Condição do cursor
    if (cursor && CursorUtils.isValid(cursor)) {
      const cursorValue = CursorUtils.decode(cursor);

      if (cursorField === 'created_at') {
        const cursorDate = new Date(cursorValue);
        const cursorCondition =
          direction === 'desc' ? lt(ccbs.createdAt, cursorDate) : gt(ccbs.createdAt, cursorDate);
        conditions.push(cursorCondition);
      }
    }

    const query = db
      .select()
      .from(ccbs)
      .where(and(...conditions))
      .limit(safeLimit + 1);

    if (direction === 'desc') {
      query.orderBy(desc(ccbs.createdAt));
    } else {
      query.orderBy(asc(ccbs.createdAt));
    }

    const results = await query;

    const hasNextPage = results.length > safeLimit;
    const data = hasNextPage ? results.slice(0, safeLimit) : results;

    let nextCursor: string | null = null;
    let prevCursor: string | null = null;

    if (hasNextPage && data.length > 0) {
      const lastItem = data[data.length - 1];
      nextCursor = CursorUtils.createFromItem(lastItem, cursorField);
    }

    if (cursor && data.length > 0) {
      const firstItem = data[0];
      prevCursor = CursorUtils.createFromItem(firstItem, cursorField);
    }

    return {
      data,
      pagination: {
        nextCursor,
        prevCursor,
        pageSize: data.length,
        hasNextPage,
        hasPrevPage: !!cursor,
      },
    };
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Ccb[]> {
    const results = await db
      .select()
      .from(ccbs)
      .where(
        and(gte(ccbs.createdAt, startDate), lte(ccbs.createdAt, endDate), isNull(ccbs.deletedAt))
      )
      .orderBy(desc(ccbs.createdAt));

    return results;
  }

  async findByCreatedBy(userId: string): Promise<Ccb[]> {
    const results = await db
      .select()
      .from(ccbs)
      .where(and(eq(ccbs.criadoPor, userId), isNull(ccbs.deletedAt)))
      .orderBy(desc(ccbs.createdAt));

    return results;
  }

  async countByStatus(status: CcbStatus): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(ccbs)
      .where(and(eq(ccbs.status, status), isNull(ccbs.deletedAt)));

    return result[0].count;
  }

  async findOrphaned(): Promise<Ccb[]> {
    const results = await db
      .select({
        ccb: ccbs,
      })
      .from(ccbs)
      .leftJoin(propostas, eq(ccbs.propostaId, propostas.id))
      .where(
        and(
          isNull(ccbs.deletedAt),
          isNull(propostas.id) // Proposta não existe
        )
      )
      .orderBy(desc(ccbs.createdAt));

    return results.map((row) => row.ccb);
  }

  async exists(id: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(ccbs)
      .where(and(eq(ccbs.id, id), isNull(ccbs.deletedAt)));

    return result[0].count > 0;
  }

  async existsByNumero(numeroCcb: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(ccbs)
      .where(and(eq(ccbs.numeroCCB, numeroCcb), isNull(ccbs.deletedAt)));

    return result[0].count > 0;
  }

  async delete(id: string): Promise<void> {
    const now = new Date();
    await db.update(ccbs).set({ deletedAt: now }).where(eq(ccbs.id, id));
  }

  async getNextNumeroCcb(): Promise<string> {
    const result = await db
      .select({
        maxNumero: sql<number>`COALESCE(MAX(CAST(SUBSTRING(numero_ccb FROM '[0-9]+') AS INTEGER)), 100000)`,
      })
      .from(ccbs);

    const nextNumber = result[0].maxNumero + 1;
    return `CCB-${String(nextNumber).padStart(6, '0')}`;
  }
}
