/**
 * Adapter Transacional para BoletoRepository
 *
 * Permite que o repositório de Boletos trabalhe dentro de uma transação
 * gerenciada pelo Unit of Work.
 */

import { eq, and, gte, lte, or, isNull, sql, inArray, desc, asc, gt, lt } from 'drizzle-orm';
import { PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import { ExtractTablesWithRelations } from 'drizzle-orm';
import { boletos, propostas, ccbs } from '@shared/schema';
import * as schema from '@shared/schema';
import { Boleto } from '@shared/schema';
import {
  IBoletoRepository,
  BoletoStatus,
  FormaPagamento,
} from '../../boleto/domain/IBoletoRepository';
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

export class TransactionalBoletoRepository implements IBoletoRepository {
  constructor(private readonly tx: DrizzleTransaction) {}

  async save(boleto: Boleto): Promise<void> {
    const exists = await this.exists(boleto.id);

    if (exists) {
      // Update
      await this.tx
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
      await this.tx.insert(boletos).values([boleto]);
    }
  }

  async findById(id: string): Promise<Boleto | null> {
    const result = await this.tx
      .select()
      .from(boletos)
      .where(and(eq(boletos.id, id), isNull(boletos.deletedAt)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0];
  }

  async findByNumeroBoleto(numeroBoleto: string): Promise<Boleto | null> {
    const result = await this.tx
      .select()
      .from(boletos)
      .where(and(eq(boletos.numeroBoleto, numeroBoleto), isNull(boletos.deletedAt)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0];
  }

  async findByPropostaId(propostaId: string): Promise<Boleto[]> {
    const result = await this.tx
      .select()
      .from(boletos)
      .where(and(eq(boletos.propostaId, propostaId), isNull(boletos.deletedAt)))
      .orderBy(desc(boletos.createdAt));

    return result;
  }

  async findByCcbId(ccbId: string): Promise<Boleto[]> {
    const result = await this.tx
      .select()
      .from(boletos)
      .where(and(eq(boletos.ccbId, ccbId), isNull(boletos.deletedAt)))
      .orderBy(desc(boletos.createdAt));

    return result;
  }

  async findOverdue(daysOverdue?: number): Promise<Boleto[]> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let query = this.tx
      .select()
      .from(boletos)
      .where(
        and(
          lt(boletos.dataVencimento, today),
          inArray(boletos.status, ['emitido', 'enviado', 'visualizado'] as any[]),
          isNull(boletos.deletedAt)
        )
      );

    if (daysOverdue !== undefined) {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysOverdue);
      const thresholdDateStr = thresholdDate.toISOString().split('T')[0];

      const result = await this.tx
        .select()
        .from(boletos)
        .where(
          and(
            lt(boletos.dataVencimento, thresholdDateStr),
            inArray(boletos.status, ['emitido', 'enviado', 'visualizado'] as any[]),
            isNull(boletos.deletedAt)
          )
        )
        .orderBy(desc(boletos.dataVencimento));

      return result;
    }

    const result = await query.orderBy(desc(boletos.dataVencimento));
    return result;
  }

  async findDueSoon(daysAhead: number): Promise<Boleto[]> {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const result = await this.tx
      .select()
      .from(boletos)
      .where(
        and(
          gte(boletos.dataVencimento, today),
          lte(boletos.dataVencimento, futureDateStr),
          inArray(boletos.status, ['emitido', 'enviado', 'visualizado'] as any[]),
          isNull(boletos.deletedAt)
        )
      )
      .orderBy(asc(boletos.dataVencimento));

    return result;
  }

  async findByStatusAndBank(status: BoletoStatus, bancoOrigemId: string): Promise<Boleto[]> {
    const result = await this.tx
      .select()
      .from(boletos)
      .where(
        and(
          eq(boletos.status, status as any),
          eq(boletos.bancoOrigemId, bancoOrigemId),
          isNull(boletos.deletedAt)
        )
      )
      .orderBy(desc(boletos.createdAt));

    return result;
  }

  async findPendingSync(): Promise<Boleto[]> {
    const result = await this.tx
      .select()
      .from(boletos)
      .where(
        and(inArray(boletos.status, ['emitido', 'enviado'] as any[]), isNull(boletos.deletedAt))
      )
      .orderBy(desc(boletos.createdAt));

    return result;
  }

  async findPaidInPeriod(startDate: Date, endDate: Date): Promise<Boleto[]> {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const result = await this.tx
      .select()
      .from(boletos)
      .where(
        and(
          eq(boletos.status, 'pago' as any),
          gte(boletos.dataPagamento, startDateStr),
          lte(boletos.dataPagamento, endDateStr),
          isNull(boletos.deletedAt)
        )
      )
      .orderBy(desc(boletos.dataPagamento));

    return result;
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
    let whereConditions = [isNull(boletos.deletedAt)];

    // Aplicar filtros
    if (filters?.status) {
      const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
      whereConditions.push(inArray(boletos.status, statusArray as any[]));
    }

    if (filters?.propostaId) {
      whereConditions.push(eq(boletos.propostaId, filters.propostaId));
    }

    if (filters?.ccbId) {
      whereConditions.push(eq(boletos.ccbId, filters.ccbId));
    }

    if (filters?.formaPagamento) {
      whereConditions.push(eq(boletos.formaPagamento, filters.formaPagamento as any));
    }

    if (filters?.bancoOrigemId) {
      whereConditions.push(eq(boletos.bancoOrigemId, filters.bancoOrigemId));
    }

    const result = await this.tx
      .select()
      .from(boletos)
      .where(and(...whereConditions))
      .orderBy(desc(boletos.createdAt))
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

  async getTotalPendingByProposta(propostaId: string): Promise<number> {
    const result = await this.tx
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${boletos.valorTotal} AS DECIMAL)), 0)`,
      })
      .from(boletos)
      .where(
        and(
          eq(boletos.propostaId, propostaId),
          inArray(boletos.status, ['emitido', 'enviado', 'visualizado'] as any[]),
          isNull(boletos.deletedAt)
        )
      );

    return result[0]?.total || 0;
  }

  async findByAmountThreshold(minAmount: number): Promise<Boleto[]> {
    const result = await this.tx
      .select()
      .from(boletos)
      .where(
        and(gte(sql`CAST(${boletos.valorTotal} AS DECIMAL)`, minAmount), isNull(boletos.deletedAt))
      )
      .orderBy(desc(boletos.valorTotal));

    return result;
  }

  async getPaymentStatsByPeriod(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalEmitidos: number;
    totalPagos: number;
    totalVencidos: number;
    valorTotalEmitido: number;
    valorTotalPago: number;
    valorTotalVencido: number;
  }> {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const emitidos = await this.tx
      .select({
        count: sql<number>`count(*)`,
        valor: sql<number>`COALESCE(SUM(CAST(${boletos.valorTotal} AS DECIMAL)), 0)`,
      })
      .from(boletos)
      .where(
        and(
          gte(boletos.dataEmissao, startDateStr),
          lte(boletos.dataEmissao, endDateStr),
          isNull(boletos.deletedAt)
        )
      );

    const pagos = await this.tx
      .select({
        count: sql<number>`count(*)`,
        valor: sql<number>`COALESCE(SUM(CAST(${boletos.valorTotal} AS DECIMAL)), 0)`,
      })
      .from(boletos)
      .where(
        and(
          eq(boletos.status, 'pago' as any),
          gte(boletos.dataPagamento, startDateStr),
          lte(boletos.dataPagamento, endDateStr),
          isNull(boletos.deletedAt)
        )
      );

    const vencidos = await this.tx
      .select({
        count: sql<number>`count(*)`,
        valor: sql<number>`COALESCE(SUM(CAST(${boletos.valorTotal} AS DECIMAL)), 0)`,
      })
      .from(boletos)
      .where(
        and(
          eq(boletos.status, 'vencido' as any),
          gte(boletos.dataVencimento, startDateStr),
          lte(boletos.dataVencimento, endDateStr),
          isNull(boletos.deletedAt)
        )
      );

    return {
      totalEmitidos: emitidos[0]?.count || 0,
      totalPagos: pagos[0]?.count || 0,
      totalVencidos: vencidos[0]?.count || 0,
      valorTotalEmitido: emitidos[0]?.valor || 0,
      valorTotalPago: pagos[0]?.valor || 0,
      valorTotalVencido: vencidos[0]?.valor || 0,
    };
  }

  async findByClienteCpf(cpf: string): Promise<Boleto[]> {
    const result = await this.tx
      .select({ boletos })
      .from(boletos)
      .innerJoin(propostas, eq(boletos.propostaId, propostas.id))
      .where(
        and(eq(propostas.clienteCpf, cpf), isNull(boletos.deletedAt), isNull(propostas.deletedAt))
      )
      .orderBy(desc(boletos.createdAt));

    return result.map((r) => r.boletos);
  }

  async findByGeneratedBy(userId: string): Promise<Boleto[]> {
    const result = await this.tx
      .select()
      .from(boletos)
      .where(and(eq(boletos.geradoPor, userId), isNull(boletos.deletedAt)))
      .orderBy(desc(boletos.createdAt));

    return result;
  }

  async countByStatus(status: BoletoStatus): Promise<number> {
    const result = await this.tx
      .select({ count: sql<number>`count(*)` })
      .from(boletos)
      .where(and(eq(boletos.status, status as any), isNull(boletos.deletedAt)));

    return result[0]?.count || 0;
  }

  async findOrphaned(): Promise<Boleto[]> {
    const result = await this.tx
      .select({ boletos })
      .from(boletos)
      .leftJoin(propostas, eq(boletos.propostaId, propostas.id))
      .leftJoin(ccbs, eq(boletos.ccbId, ccbs.id))
      .where(and(or(isNull(propostas.id), isNull(ccbs.id)), isNull(boletos.deletedAt)))
      .orderBy(desc(boletos.createdAt));

    return result.map((r) => r.boletos);
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.tx
      .select({ id: boletos.id })
      .from(boletos)
      .where(and(eq(boletos.id, id), isNull(boletos.deletedAt)))
      .limit(1);

    return result.length > 0;
  }

  async existsByNumero(numeroBoleto: string): Promise<boolean> {
    const result = await this.tx
      .select({ id: boletos.id })
      .from(boletos)
      .where(and(eq(boletos.numeroBoleto, numeroBoleto), isNull(boletos.deletedAt)))
      .limit(1);

    return result.length > 0;
  }

  async delete(id: string): Promise<void> {
    await this.tx
      .update(boletos)
      .set({
        deletedAt: new Date(),
      })
      .where(eq(boletos.id, id));
  }

  async getNextNumeroBoleto(): Promise<string> {
    const result = await this.tx
      .select({
        maxNum: sql<number>`COALESCE(MAX(CAST(${boletos.numeroBoleto} AS INTEGER)), 200000)`,
      })
      .from(boletos);

    const nextNumber = (result[0]?.maxNum || 200000) + 1;
    return nextNumber.toString();
  }
}
