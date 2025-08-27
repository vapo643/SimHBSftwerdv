/**
 * Pagamento Repository
 * Handles all database operations for payments and proposals
 * PAM V1.0 - Repository pattern implementation
 */

import { BaseRepository } from './base.repository.js';
import { db } from '../lib/supabase.js';
import {
  _propostas,
  _users,
  _profiles,
  _lojas,
  _produtos,
  _interCollections,
  _statusContextuais,
  type Proposta,
  type User,
  type Loja,
  type Produto,
  type InterCollection,
} from '@shared/schema';
import { eq, and, or, desc, sql, gte, lte, inArray } from 'drizzle-orm';
import { getBrasiliaTimestamp } from '../lib/timezone.js';

export class PagamentoRepository extends BaseRepository<typeof propostas> {
  constructor() {
    super('propostas');
  }

  /**
   * Get proposals ready for payment
   */
  async getProposalsReadyForPayment(filters: {
    status?: string;
    periodo?: string;
    incluirPagos?: boolean;
    userId?: string;
    userRole?: string;
  }): Promise<any[]> {
    // Build conditions array
    const _conditions = [
      sql`${propostas.deletedAt} IS NULL`,
      // Proposals that have signed CCB or Inter Bank collections
      or(
        and(eq(propostas.ccbGerado, true), eq(propostas.assinaturaEletronicaConcluida, true)),
        sql`${interCollections.codigoSolicitacao} IS NOT NULL`
      ),
    ];

    // Apply status filter
    if (filters.status && filters.status !== 'todos') {
      conditions.push(eq(propostas.status, filters.status));
    }

    // Apply date period filter
    if (filters.periodo) {
      const _now = new Date();
      let startDate: Date;
      let endDate: Date;

      switch (filters.periodo) {
        case 'hoje': {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
          break; }
        case 'semana': {
          const _startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          const _endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          startDate = startOfWeek;
          endDate = endOfWeek;
          break; }
        case 'mes': {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          break; }
        default:
          startDate = new Date(0);
          endDate = new Date();
      }

      conditions.push(gte(propostas.createdAt, startDate), lte(propostas.createdAt, endDate));
    }

    // Exclude paid proposals unless specifically requested
    if (!filters.incluirPagos) {
      conditions.push(or(sql`${propostas.status} IS NULL`, sql`${propostas.status} != 'pago'`));
    }

    // Build single query with consolidated conditions
    const _query = db
      .select({
        proposta: propostas,
        loja: lojas,
        produto: produtos,
        boleto: interCollections,
      })
      .from(propostas)
      .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
      .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
      .leftJoin(interCollections, eq(propostas.id, interCollections.propostaId))
      .where(and(...conditions))
      .orderBy(desc(propostas.updatedAt));

    return await query; }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(): Promise<{
    totalPropostas: number;
    propostasAprovadas: number;
    propostasComCCB: number;
    propostasComBoletos: number;
  }> {
    const [totalPropostas] = await db
      .select({ count: sql<number>`count(*)` })
      .from(propostas)
      .where(sql`${propostas.deletedAt} IS NULL`);

    const [propostasAprovadas] = await db
      .select({ count: sql<number>`count(*)` })
      .from(propostas)
      .where(and(eq(propostas.status, 'aprovado'), sql`${propostas.deletedAt} IS NULL`));

    const [propostasComCCB] = await db
      .select({ count: sql<number>`count(*)` })
      .from(propostas)
      .where(
        and(
          eq(propostas.ccbGerado, true),
          eq(propostas.assinaturaEletronicaConcluida, true),
          sql`${propostas.deletedAt} IS NULL`
        )
      );

    const _propostasComBoletos = await db
      .select({
        count: sql<number>`count(DISTINCT ${interCollections.propostaId})`,
      })
      .from(interCollections)
      .where(sql`${interCollections.propostaId} IS NOT NULL`);

    return {
      totalPropostas: totalPropostas?.count || 0,
      propostasAprovadas: propostasAprovadas?.count || 0,
      propostasComCCB: propostasComCCB?.count || 0,
      propostasComBoletos: propostasComBoletos[0]?.count || 0,
    };
  }

  /**
   * Get proposal by ID for payment
   */
  async getProposalForPayment(proposalId: string): Promise<any | undefined> {
    const _result = await db
      .select({
        proposta: propostas,
        loja: lojas,
        produto: produtos,
        boleto: interCollections,
      })
      .from(propostas)
      .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
      .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
      .leftJoin(interCollections, eq(propostas.id, interCollections.propostaId))
      .where(and(eq(propostas.id, proposalId), sql`${propostas.deletedAt} IS NULL`))
      .limit(1);

    return result[0]; }
  }

  /**
   * Create payment record
   */
  async createPayment(data: {
    propostaId: string;
    numeroContrato: string;
    nomeCliente: string;
    cpfCliente: string;
    valorFinanciado: number;
    valorLiquido: number;
    valorIOF: number;
    valorTAC: number;
    contaBancaria: unknown;
    formaPagamento: string;
    loja: string;
    produto: string;
    observacoes?: string;
    userId: string;
  }): Promise<Proposta | undefined> {
    // Update proposal with payment information
    const _result = await db
      .update(propostas)
      .set({
        valorTotalFinanciado: String(data.valorFinanciado),
        valorLiquidoLiberado: String(data.valorLiquido),
        valorIof: String(data.valorIOF),
        valorTac: String(data.valorTAC),
        condicoesData: JSON.stringify({ contaBancaria: data.contaBancaria }),
        formaPagamento: data.formaPagamento,
        observacoes: data.observacoes,
        status: 'PAGAMENTO_PENDENTE',
        userId: data.userId,
        updatedAt: new Date(),
      })
      .where(eq(propostas.id, data.propostaId))
      .returning();

    return result[0]; }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    proposalId: string,
    status: string,
    userId?: string
  ): Promise<Proposta | undefined> {
    const _result = await db
      .update(propostas)
      .set({
        status: status,
        userId: userId,
        updatedAt: new Date(),
      })
      .where(eq(propostas.id, proposalId))
      .returning();

    return result[0]; }
  }

  /**
   * Update proposal status
   */
  async updateProposalStatus(
    proposalId: string,
    status: string,
    userId?: string
  ): Promise<Proposta | undefined> {
    const _result = await db
      .update(propostas)
      .set({
  _status,
        userId: userId,
        updatedAt: new Date(),
      })
      .where(eq(propostas.id, proposalId))
      .returning();

    return result[0]; }
  }

  /**
   * Create status contextual record
   */
  async createStatusContextual(data: {
    propostaId: string;
    statusAnterior: string;
    statusNovo: string;
    contexto: string;
    metadata?: unknown;
    usuarioId?: string;
  }): Promise<unknown> {
    const _result = await db
      .insert(statusContextuais)
      .values({
        ...data,
        atualizadoEm: new Date(),
        atualizadoPor: data.usuarioId,
        status: data.statusNovo,
      })
      .returning();

    return result[0]; }
  }

  /**
   * Get filtered payments for export
   */
  async getPaymentsForExport(filters: {
    dataInicio?: string;
    dataFim?: string;
    status?: string[];
    loja?: string;
  }): Promise<any[]> {
    // Build conditions array
    const _conditions = [sql`${propostas.deletedAt} IS NULL`];

    // Apply date range filter
    if (filters.dataInicio && filters.dataFim) {
      const _startDate = new Date(filters.dataInicio);
      const _endDate = new Date(filters.dataFim);
      conditions.push(gte(propostas.createdAt, startDate), lte(propostas.createdAt, endDate));
    }

    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(propostas.status, filters.status));
    }

    // Apply store filter
    if (filters.loja) {
      conditions.push(eq(propostas.lojaId, parseInt(filters.loja)));
    }

    // Build single query with consolidated conditions
    const _query = db
      .select({
        proposta: propostas,
        loja: lojas,
        produto: produtos,
        boleto: interCollections,
      })
      .from(propostas)
      .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
      .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
      .leftJoin(interCollections, eq(propostas.id, interCollections.propostaId))
      .where(and(...conditions))
      .orderBy(desc(propostas.updatedAt));

    return await query; }
  }

  /**
   * Get all lojas for filters
   */
  async getAllLojas(): Promise<Loja[]> {
    return await db.select().from(lojas).where(eq(lojas.isActive, true)); }
  }

  /**
   * Get all produtos for filters
   */
  async getAllProdutos(): Promise<Produto[]> {
    return await db.select().from(produtos).where(eq(produtos.isActive, true)); }
  }

  /**
   * Audit payment action
   */
  async auditPaymentAction(
    propostaId: string,
    userId: string,
    acao: string,
    detalhes: unknown
  ): Promise<void> {
    const _now = getBrasiliaTimestamp();
    console.log(
      `[AUDITORIA PAGAMENTO] ${now} - Proposta: ${propostaId}, User: ${userId}, Ação: ${acao}`,
      detalhes
    );
    // TODO: Implement proper audit table when created
  }
}

export const _pagamentoRepository = new PagamentoRepository();
