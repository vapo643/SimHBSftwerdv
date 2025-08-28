/**
 * Implementação concreta do Repository de Boletos
 * Banking-Grade Repository Pattern - PAM V1.0 Sprint 2
 *
 * Usa Drizzle ORM para persistência no PostgreSQL.
 * Parte da camada de infraestrutura.
 */

import { eq, and, gte, lte, isNull, sql, inArray, desc, asc, gt, lt, or } from 'drizzle-orm';
import { db } from '../../../lib/supabase';
import { boletos, propostas, ccbs } from '@shared/schema';
import { Boleto } from '@shared/schema';
import { IBoletoRepository, BoletoStatus, FormaPagamento } from '../domain/IBoletoRepository';
import { PaginatedResult, CursorPaginationOptions, RepositoryFilters, CursorUtils } from '@shared/types/pagination';

export class BoletoRepository implements IBoletoRepository {
  async save(boleto: Boleto): Promise<void> {
    const exists = await this.exists(boleto.id);

    if (exists) {
      // Update
      await db
        .update(boletos)
        .set({
          status: boleto.status,
          valorPrincipal: boleto.valorPrincipal,
          valorJuros: boleto.valorJuros,
          valorMulta: boleto.valorMulta,
          valorTotal: boleto.valorTotal,
          dataVencimento: boleto.dataVencimento,
          dataEmissao: boleto.dataEmissao,
          dataPagamento: boleto.dataPagamento,
          formaPagamento: boleto.formaPagamento,
          bancoOrigemId: boleto.bancoOrigemId,
          codigoBarras: boleto.codigoBarras,
          linhaDigitavel: boleto.linhaDigitavel,
          nossoNumero: boleto.nossoNumero,
          pixTxid: boleto.pixTxid,
          pixCopiaECola: boleto.pixCopiaECola,
          qrCodePix: boleto.qrCodePix,
          urlBoleto: boleto.urlBoleto,
          urlComprovantePagamento: boleto.urlComprovantePagamento,
          tentativasEnvio: boleto.tentativasEnvio,
          ultimoEnvio: boleto.ultimoEnvio,
          motivoCancelamento: boleto.motivoCancelamento,
          observacoes: boleto.observacoes,
          updatedAt: new Date(),
        })
        .where(eq(boletos.id, boleto.id));
    } else {
      // Create
      await db.insert(boletos).values([boleto]);
    }
  }

  async findById(id: string): Promise<Boleto | null> {
    const result = await db
      .select()
      .from(boletos)
      .where(and(eq(boletos.id, id), isNull(boletos.deletedAt)))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  async findByNumeroBoleto(numeroBoleto: string): Promise<Boleto | null> {
    const result = await db
      .select()
      .from(boletos)
      .where(and(eq(boletos.numeroBoleto, numeroBoleto), isNull(boletos.deletedAt)))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  async findByPropostaId(propostaId: string, userId?: string): Promise<Boleto[]> {
    // RBAC: Se userId fornecido, verificar se o usuário tem acesso à proposta
    if (userId) {
      const results = await db
        .select({
          // Incluir todos os campos obrigatórios do tipo Boleto
          id: boletos.id,
          propostaId: boletos.propostaId,
          ccbId: boletos.ccbId,
          numeroBoleto: boletos.numeroBoleto,
          numeroParcela: boletos.numeroParcela,
          totalParcelas: boletos.totalParcelas,
          valorPrincipal: boletos.valorPrincipal,
          valorJuros: boletos.valorJuros,
          valorMulta: boletos.valorMulta,
          valorTotal: boletos.valorTotal,
          dataVencimento: boletos.dataVencimento,
          dataEmissao: boletos.dataEmissao,
          dataPagamento: boletos.dataPagamento,
          status: boletos.status,
          formaPagamento: boletos.formaPagamento,
          bancoOrigemId: boletos.bancoOrigemId,
          codigoBarras: boletos.codigoBarras,
          linhaDigitavel: boletos.linhaDigitavel,
          nossoNumero: boletos.nossoNumero,
          pixTxid: boletos.pixTxid,
          pixCopiaECola: boletos.pixCopiaECola,
          qrCodePix: boletos.qrCodePix,
          urlBoleto: boletos.urlBoleto,
          urlComprovantePagamento: boletos.urlComprovantePagamento,
          tentativasEnvio: boletos.tentativasEnvio,
          ultimoEnvio: boletos.ultimoEnvio,
          motivoCancelamento: boletos.motivoCancelamento,
          geradoPor: boletos.geradoPor,
          observacoes: boletos.observacoes,
          createdAt: boletos.createdAt,
          updatedAt: boletos.updatedAt,
          deletedAt: boletos.deletedAt
        })
        .from(boletos)
        .innerJoin(propostas, eq(boletos.propostaId, propostas.id))
        .where(
          and(
            eq(boletos.propostaId, propostaId),
            eq(propostas.userId, userId), // RBAC: Filtrar por proprietário
            isNull(boletos.deletedAt),
            isNull(propostas.deletedAt)
          )
        )
        .orderBy(asc(boletos.numeroParcela));

      return results;
    } else {
      // Sem RBAC - para uso interno do sistema
      const results = await db
        .select()
        .from(boletos)
        .where(and(eq(boletos.propostaId, propostaId), isNull(boletos.deletedAt)))
        .orderBy(asc(boletos.numeroParcela));

      return results;
    }
  }

  async findByCcbId(ccbId: string): Promise<Boleto[]> {
    const results = await db
      .select()
      .from(boletos)
      .where(and(eq(boletos.ccbId, ccbId), isNull(boletos.deletedAt)))
      .orderBy(asc(boletos.numeroParcela));

    return results;
  }

  async findOverdue(daysOverdue?: number): Promise<Boleto[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let overdueDate = today;
    if (daysOverdue !== undefined) {
      overdueDate = new Date(today);
      overdueDate.setDate(today.getDate() - daysOverdue);
    }

    const results = await db
      .select()
      .from(boletos)
      .where(
        and(
          eq(boletos.status, 'emitido'),
          lte(boletos.dataVencimento, overdueDate.toISOString().split('T')[0]),
          isNull(boletos.deletedAt)
        )
      )
      .orderBy(asc(boletos.dataVencimento));

    return results;
  }

  async findDueSoon(daysAhead: number): Promise<Boleto[]> {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + daysAhead);

    const results = await db
      .select()
      .from(boletos)
      .where(
        and(
          eq(boletos.status, 'emitido'),
          gte(boletos.dataVencimento, today.toISOString().split('T')[0]),
          lte(boletos.dataVencimento, futureDate.toISOString().split('T')[0]),
          isNull(boletos.deletedAt)
        )
      )
      .orderBy(asc(boletos.dataVencimento));

    return results;
  }

  async findByStatusAndBank(status: BoletoStatus, bancoOrigemId: string): Promise<Boleto[]> {
    const results = await db
      .select()
      .from(boletos)
      .where(
        and(
          eq(boletos.status, status),
          eq(boletos.bancoOrigemId, bancoOrigemId),
          isNull(boletos.deletedAt)
        )
      )
      .orderBy(desc(boletos.updatedAt));

    return results;
  }

  async findPendingSync(): Promise<Boleto[]> {
    const results = await db
      .select()
      .from(boletos)
      .where(
        and(
          inArray(boletos.status, ['emitido', 'enviado']),
          isNull(boletos.dataPagamento),
          isNull(boletos.deletedAt)
        )
      )
      .orderBy(asc(boletos.dataVencimento));

    return results;
  }

  async findPaidInPeriod(startDate: Date, endDate: Date): Promise<Boleto[]> {
    const results = await db
      .select()
      .from(boletos)
      .where(
        and(
          eq(boletos.status, 'pago'),
          gte(boletos.dataPagamento, startDate.toISOString()),
          lte(boletos.dataPagamento, endDate.toISOString()),
          isNull(boletos.deletedAt)
        )
      )
      .orderBy(desc(boletos.dataPagamento));

    return results;
  }

  async findWithPagination(
    options: CursorPaginationOptions,
    filters?: RepositoryFilters & {
      status?: BoletoStatus | BoletoStatus[];
      propostaId?: string;
      ccbId?: string;
      formaPagamento?: FormaPagamento;
      bancoOrigemId?: string;
    }
  ): Promise<PaginatedResult<Boleto>> {
    const {
      limit = 50,
      cursor,
      cursorField = 'created_at',
      direction = 'desc'
    } = options;

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    
    const conditions = [isNull(boletos.deletedAt)];

    // Filtros específicos
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(boletos.status, filters.status));
      } else {
        conditions.push(eq(boletos.status, filters.status));
      }
    }

    if (filters?.propostaId) {
      conditions.push(eq(boletos.propostaId, filters.propostaId));
    }

    if (filters?.ccbId) {
      conditions.push(eq(boletos.ccbId, filters.ccbId));
    }

    if (filters?.formaPagamento) {
      conditions.push(eq(boletos.formaPagamento, filters.formaPagamento));
    }

    if (filters?.bancoOrigemId) {
      conditions.push(eq(boletos.bancoOrigemId, filters.bancoOrigemId));
    }

    // Condição do cursor
    if (cursor && CursorUtils.isValid(cursor)) {
      const cursorValue = CursorUtils.decode(cursor);
      
      if (cursorField === 'created_at') {
        const cursorDate = new Date(cursorValue);
        const cursorCondition = direction === 'desc' 
          ? lt(boletos.createdAt, cursorDate)
          : gt(boletos.createdAt, cursorDate);
        conditions.push(cursorCondition);
      }
    }

    const query = db
      .select()
      .from(boletos)
      .where(and(...conditions))
      .limit(safeLimit + 1);

    if (direction === 'desc') {
      query.orderBy(desc(boletos.createdAt));
    } else {
      query.orderBy(asc(boletos.createdAt));
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
        hasPrevPage: !!cursor
      }
    };
  }

  async getTotalPendingByProposta(propostaId: string): Promise<number> {
    const result = await db
      .select({ 
        total: sql<number>`COALESCE(SUM(${boletos.valorTotal}::numeric), 0)` 
      })
      .from(boletos)
      .where(
        and(
          eq(boletos.propostaId, propostaId),
          inArray(boletos.status, ['emitido', 'enviado', 'vencido']),
          isNull(boletos.deletedAt)
        )
      );

    return result[0].total;
  }

  async findByAmountThreshold(minAmount: number): Promise<Boleto[]> {
    const results = await db
      .select()
      .from(boletos)
      .where(
        and(
          gte(boletos.valorTotal, minAmount.toString()),
          isNull(boletos.deletedAt)
        )
      )
      .orderBy(desc(boletos.valorTotal));

    return results;
  }

  async getPaymentStatsByPeriod(startDate: Date, endDate: Date): Promise<{
    totalEmitidos: number;
    totalPagos: number;
    totalVencidos: number;
    valorTotalEmitido: number;
    valorTotalPago: number;
    valorTotalVencido: number;
  }> {
    const stats = await db
      .select({
        totalEmitidos: sql<number>`COUNT(CASE WHEN status = 'emitido' THEN 1 END)`,
        totalPagos: sql<number>`COUNT(CASE WHEN status = 'pago' THEN 1 END)`,
        totalVencidos: sql<number>`COUNT(CASE WHEN status = 'vencido' THEN 1 END)`,
        valorTotalEmitido: sql<number>`COALESCE(SUM(CASE WHEN status = 'emitido' THEN ${boletos.valorTotal}::numeric ELSE 0 END), 0)`,
        valorTotalPago: sql<number>`COALESCE(SUM(CASE WHEN status = 'pago' THEN ${boletos.valorTotal}::numeric ELSE 0 END), 0)`,
        valorTotalVencido: sql<number>`COALESCE(SUM(CASE WHEN status = 'vencido' THEN ${boletos.valorTotal}::numeric ELSE 0 END), 0)`,
      })
      .from(boletos)
      .where(
        and(
          gte(boletos.createdAt, startDate),
          lte(boletos.createdAt, endDate),
          isNull(boletos.deletedAt)
        )
      );

    return stats[0] || {
      totalEmitidos: 0,
      totalPagos: 0,
      totalVencidos: 0,
      valorTotalEmitido: 0,
      valorTotalPago: 0,
      valorTotalVencido: 0,
    };
  }

  async findByClienteCpf(cpf: string): Promise<Boleto[]> {
    const cleanCPF = cpf.replace(/\D/g, '');
    
    const results = await db
      .select({
        boleto: boletos,
      })
      .from(boletos)
      .innerJoin(propostas, eq(boletos.propostaId, propostas.id))
      .where(
        and(
          eq(propostas.clienteCpf, cleanCPF),
          isNull(boletos.deletedAt),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(desc(boletos.dataVencimento));

    return results.map(row => row.boleto);
  }

  async findByGeneratedBy(userId: string): Promise<Boleto[]> {
    const results = await db
      .select()
      .from(boletos)
      .where(and(eq(boletos.geradoPor, userId), isNull(boletos.deletedAt)))
      .orderBy(desc(boletos.createdAt));

    return results;
  }

  async countByStatus(status: BoletoStatus): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(boletos)
      .where(and(eq(boletos.status, status), isNull(boletos.deletedAt)));

    return result[0].count;
  }

  async findOrphaned(): Promise<Boleto[]> {
    const results = await db
      .select({
        boleto: boletos,
      })
      .from(boletos)
      .leftJoin(propostas, eq(boletos.propostaId, propostas.id))
      .leftJoin(ccbs, eq(boletos.ccbId, ccbs.id))
      .where(
        and(
          isNull(boletos.deletedAt),
          or(
            isNull(propostas.id), // Proposta não existe
            and(boletos.ccbId, isNull(ccbs.id)) // CCB referenciada não existe
          )
        )
      )
      .orderBy(desc(boletos.createdAt));

    return results.map(row => row.boleto);
  }

  async exists(id: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(boletos)
      .where(and(eq(boletos.id, id), isNull(boletos.deletedAt)));

    return result[0].count > 0;
  }

  async existsByNumero(numeroBoleto: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(boletos)
      .where(and(eq(boletos.numeroBoleto, numeroBoleto), isNull(boletos.deletedAt)));

    return result[0].count > 0;
  }

  async delete(id: string): Promise<void> {
    const now = new Date();
    await db.update(boletos).set({ deletedAt: now }).where(eq(boletos.id, id));
  }

  async getNextNumeroBoleto(): Promise<string> {
    const result = await db
      .select({ maxNumero: sql<number>`COALESCE(MAX(CAST(SUBSTRING(numero_boleto FROM '[0-9]+') AS INTEGER)), 200000)` })
      .from(boletos);

    const nextNumber = result[0].maxNumero + 1;
    return `BOL-${String(nextNumber).padStart(8, '0')}`;
  }
}