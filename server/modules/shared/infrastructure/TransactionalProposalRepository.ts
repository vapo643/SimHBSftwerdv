/**
 * Adapter Transacional para ProposalRepository
 * 
 * Permite que o repositório de propostas trabalhe dentro de uma transação
 * gerenciada pelo Unit of Work.
 */

import { eq, and, gte, lte, or, isNull, sql, inArray, desc, asc, gt, lt } from 'drizzle-orm';
import { PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import { ExtractTablesWithRelations } from 'drizzle-orm';
import { propostas, ccbs, boletos } from '@shared/schema';
import * as schema from '@shared/schema';
import { Proposal, ProposalStatus } from '../../proposal/domain/Proposal';
import { IProposalRepository, ProposalSearchCriteria } from '../../proposal/domain/IProposalRepository';
import { PaginatedResult, CursorPaginationOptions, RepositoryFilters, CursorUtils } from '@shared/types/pagination';

// Type para transação Drizzle
type DrizzleTransaction = PostgresJsTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export class TransactionalProposalRepository implements IProposalRepository {
  constructor(private readonly tx: DrizzleTransaction) {}

  async save(proposal: Proposal): Promise<void> {
    const data = proposal.toPersistence();

    // Verificar se é create ou update
    const exists = await this.exists(proposal.id);

    if (exists) {
      // Update
      await this.tx
        .update(propostas)
        .set({
          status: data.status,
          clienteData: JSON.stringify(data.cliente_data),
          valor: data.valor.toString(),
          prazo: data.prazo,
          taxaJuros: data.taxa_juros.toString(),
          produtoId: data.produto_id,
          tabelaComercialId: data.tabela_comercial_id,
          lojaId: data.loja_id,
          dadosPagamentoTipo: data.dados_pagamento?.tipo_conta,
          dadosPagamentoBanco: data.dados_pagamento?.banco,
          dadosPagamentoAgencia: data.dados_pagamento?.agencia,
          dadosPagamentoConta: data.dados_pagamento?.conta,
          dadosPagamentoPix: data.dados_pagamento?.pix_chave,
          motivoPendencia: data.motivo_rejeicao,
          observacoes: data.observacoes,
          ccbDocumentoUrl: data.ccb_url,
        })
        .where(eq(propostas.id, data.id));
    } else {
      // Create - gerar IDs sequenciais
      const sequentialId = await this.getNextSequentialId();
      const numeroProposta = await this.getNextNumeroProposta();

      await this.tx.insert(propostas).values([
        {
          id: proposal.id,
          numeroProposta: numeroProposta,
          status: data.status,
          clienteNome: data.cliente_data.nome,
          clienteCpf: data.cliente_data.cpf,
          clienteData: JSON.stringify(data.cliente_data),
          valor: data.valor.toString(),
          prazo: data.prazo,
          taxaJuros: data.taxa_juros.toString(),
          produtoId: data.produto_id,
          tabelaComercialId: data.tabela_comercial_id,
          lojaId: data.loja_id,
          metodoPagamento: data.dados_pagamento?.metodo,
          dadosPagamentoTipo: data.dados_pagamento?.tipo_conta,
          dadosPagamentoBanco: data.dados_pagamento?.banco,
          dadosPagamentoAgencia: data.dados_pagamento?.agencia,
          dadosPagamentoConta: data.dados_pagamento?.conta,
          dadosPagamentoPix: data.dados_pagamento?.pix_chave,
          motivoPendencia: data.motivo_rejeicao,
          observacoes: data.observacoes,
          ccbDocumentoUrl: data.ccb_url,
          createdAt: data.created_at,
        },
      ]);
    }
  }

  async findById(id: string): Promise<Proposal | null> {
    const result = await this.tx
      .select()
      .from(propostas)
      .where(and(eq(propostas.id, id), isNull(propostas.deletedAt)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return Proposal.fromDatabase(result[0]);
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.tx
      .select({ id: propostas.id })
      .from(propostas)
      .where(and(eq(propostas.id, id), isNull(propostas.deletedAt)))
      .limit(1);

    return result.length > 0;
  }

  async delete(id: string): Promise<void> {
    await this.tx
      .update(propostas)
      .set({
        deletedAt: new Date(),
      })
      .where(eq(propostas.id, id));
  }

  async getNextSequentialId(): Promise<number> {
    const result = await this.tx
      .select({ maxId: sql<number>`COALESCE(MAX(${propostas.numeroProposta}), 300000)` })
      .from(propostas);

    return (result[0]?.maxId || 300000) + 1;
  }

  private async getNextNumeroProposta(): Promise<number> {
    return this.getNextSequentialId();
  }

  // ========================================================================
  // IMPLEMENTAÇÕES BÁSICAS DAS DEMAIS INTERFACES
  // ========================================================================

  async findByClienteCpfAndStatus(cpf: string, status: ProposalStatus[]): Promise<Proposal[]> {
    const result = await this.tx
      .select()
      .from(propostas)
      .where(
        and(
          eq(propostas.clienteCpf, cpf),
          inArray(propostas.status, status as any[]),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(desc(propostas.createdAt));

    return result.map((r: any) => Proposal.fromDatabase(r));
  }

  async findPendingForAnalysis(
    options: CursorPaginationOptions,
    filters?: RepositoryFilters
  ): Promise<PaginatedResult<Proposal>> {
    // Implementação simplificada - pode ser expandida
    const query = this.tx
      .select()
      .from(propostas)
      .where(
        and(
          inArray(propostas.status, ['aguardando_analise', 'em_analise'] as any[]),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(desc(propostas.createdAt))
      .limit(options.limit || 50);

    const result = await query;
    const proposals = result.map((r: any) => Proposal.fromDatabase(r));

    return {
      data: proposals,
      pagination: {
        nextCursor: result.length === (options.limit || 50) ? CursorUtils.createFromItem(result[result.length - 1], 'createdAt') : null,
        prevCursor: null,
        pageSize: proposals.length,
        hasNextPage: result.length === (options.limit || 50),
        hasPrevPage: false,
      },
    };
  }

  async findByComprometimentoRenda(threshold: number): Promise<Proposal[]> {
    // Implementação simplificada
    const result = await this.tx
      .select()
      .from(propostas)
      .where(isNull(propostas.deletedAt))
      .orderBy(desc(propostas.createdAt));

    return result.map((r: any) => Proposal.fromDatabase(r));
  }

  async findPendingByAnalyst(analistaId: string): Promise<Proposal[]> {
    const result = await this.tx
      .select()
      .from(propostas)
      .where(
        and(
          eq(propostas.analistaId, analistaId),
          inArray(propostas.status, ['em_analise'] as any[]),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(desc(propostas.createdAt));

    return result.map((r: any) => Proposal.fromDatabase(r));
  }

  async findReadyForCCBGeneration(): Promise<Proposal[]> {
    const result = await this.tx
      .select()
      .from(propostas)
      .leftJoin(ccbs, eq(propostas.id, ccbs.propostaId))
      .where(
        and(
          eq(propostas.status, 'aprovado' as any),
          isNull(ccbs.id),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(desc(propostas.createdAt));

    return result.map(r => Proposal.fromDatabase(r.propostas));
  }

  async findAwaitingBoletoGeneration(): Promise<Proposal[]> {
    const result = await this.tx
      .select()
      .from(propostas)
      .leftJoin(boletos, eq(propostas.id, boletos.propostaId))
      .where(
        and(
          eq(propostas.status, 'assinatura_concluida' as any),
          isNull(boletos.id),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(desc(propostas.createdAt));

    return result.map(r => Proposal.fromDatabase(r.propostas));
  }

  // ========================================================================
  // MÉTODOS LEGADOS (IMPLEMENTAÇÕES BÁSICAS)
  // ========================================================================

  async findByCriteria(criteria: ProposalSearchCriteria): Promise<Proposal[]> {
    // Construir condições usando and() para combinar múltiplas condições
    const conditions = [isNull(propostas.deletedAt)];

    if (criteria.status) {
      conditions.push(eq(propostas.status, criteria.status as any));
    }

    if (criteria.lojaId) {
      conditions.push(eq(propostas.lojaId, criteria.lojaId));
    }

    if (criteria.cpf) {
      conditions.push(eq(propostas.clienteCpf, criteria.cpf));
    }

    const result = await this.tx
      .select()
      .from(propostas)
      .where(and(...conditions))
      .orderBy(desc(propostas.createdAt));

    return result.map((r: any) => Proposal.fromDatabase(r));
  }

  async findAll(): Promise<Proposal[]> {
    const result = await this.tx
      .select()
      .from(propostas)
      .where(isNull(propostas.deletedAt))
      .orderBy(desc(propostas.createdAt));

    return result.map((r: any) => Proposal.fromDatabase(r));
  }

  async findByStatus(status: string): Promise<Proposal[]> {
    const result = await this.tx
      .select()
      .from(propostas)
      .where(
        and(
          eq(propostas.status, status as any),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(desc(propostas.createdAt));

    return result.map((r: any) => Proposal.fromDatabase(r));
  }

  async findByCPF(cpf: string): Promise<Proposal[]> {
    const result = await this.tx
      .select()
      .from(propostas)
      .where(
        and(
          eq(propostas.clienteCpf, cpf),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(desc(propostas.createdAt));

    return result.map((r: any) => Proposal.fromDatabase(r));
  }

  async findByLojaId(lojaId: number): Promise<Proposal[]> {
    const result = await this.tx
      .select()
      .from(propostas)
      .where(
        and(
          eq(propostas.lojaId, lojaId),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(desc(propostas.createdAt));

    return result.map((r: any) => Proposal.fromDatabase(r));
  }

  async findByAtendenteId(atendenteId: string): Promise<Proposal[]> {
    const result = await this.tx
      .select()
      .from(propostas)
      .where(
        and(
          eq(propostas.userId, atendenteId),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(desc(propostas.createdAt));

    return result.map((r: any) => Proposal.fromDatabase(r));
  }
}