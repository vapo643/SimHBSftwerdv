/**
 * Implementação concreta do Repository de Propostas
 *
 * Usa Drizzle ORM para persistência no PostgreSQL.
 * Parte da camada de infraestrutura.
 */

import { eq, and, gte, lte, or, isNull, sql, inArray, desc, asc, gt, lt } from 'drizzle-orm';
import { db } from '../../../lib/supabase';
import { propostas, ccbs, boletos } from '@shared/schema';
import { Proposal, ProposalStatus } from '../domain/Proposal';
import { IProposalRepository, ProposalSearchCriteria } from '../domain/IProposalRepository';
import { PaginatedResult, CursorPaginationOptions, RepositoryFilters, CursorUtils } from '@shared/types/pagination';
import { EventDispatcher } from '../../../infrastructure/events/EventDispatcher';

export class ProposalRepository implements IProposalRepository {
  async save(proposal: Proposal): Promise<void> {
    const data = proposal.toPersistence();

    // Verificar se é create ou update
    const exists = await this.exists(proposal.id);

    if (exists) {
      // Update
      await db
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
          // updatedAt campo removido - será atualizado automaticamente pelo schema
        })
        .where(eq(propostas.id, data.id));
    } else {
      // Create - gerar número da proposta sequencial
      const numeroProposta = await this.getNextNumeroProposta();

      console.log('[REPOSITORY DEBUG] About to insert with values:', {
        id: proposal.id,
        numeroProposta,
        status: data.status,
        produtoId: data.produto_id,
        tabelaComercialId: data.tabela_comercial_id,
        lojaId: data.loja_id,
        userId: data.user_id
      });

      await db.insert(propostas).values([
        {
          id: proposal.id, // UUID do domínio
          numeroProposta: numeroProposta, // ID sequencial começando em 300001
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
          userId: data.user_id, // Campo adicionado para corrigir o erro
          createdAt: data.created_at,
          // updatedAt campo removido - será atualizado automaticamente pelo schema
        },
      ]);
    }

    // Processar eventos de domínio (comentado temporariamente para load test)
    const events = proposal.getUncommittedEvents();
    
    // Em desenvolvimento, apenas log dos eventos sem despachar para Redis
    if (process.env.NODE_ENV === 'development') {
      for (const event of events) {
        console.log(`[DOMAIN EVENT LOGGED] ${event.eventType} for aggregate ${event.aggregateId} (Redis disabled in dev)`);
      }
      proposal.markEventsAsCommitted();
    } else {
      const eventDispatcher = EventDispatcher.getInstance();
      for (const event of events) {
        await eventDispatcher.dispatch(event);
        console.log(`[DOMAIN EVENT DISPATCHED] ${event.eventType} for aggregate ${event.aggregateId}`);
      }
      proposal.markEventsAsCommitted();
    }
  }

  async findById(id: string): Promise<Proposal | null> {
    const result = await db
      .select()
      .from(propostas)
      .where(and(eq(propostas.id, id), isNull(propostas.deletedAt)))
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    return this.mapToDomain(result[0]);
  }

  async findByCriteria(criteria: ProposalSearchCriteria): Promise<Proposal[]> {
    const conditions = [isNull(propostas.deletedAt)];

    if (criteria.status) {
      conditions.push(eq(propostas.status, criteria.status));
    }

    if (criteria.lojaId) {
      conditions.push(eq(propostas.lojaId, criteria.lojaId));
    }

    if (criteria.atendenteId) {
      conditions.push(eq(propostas.userId, criteria.atendenteId));
    }

    if (criteria.cpf) {
      const cleanCPF = criteria.cpf.replace(/\D/g, '');
      conditions.push(eq(propostas.clienteCpf, cleanCPF));
    }

    if (criteria.dateFrom) {
      conditions.push(gte(propostas.createdAt, criteria.dateFrom));
    }

    if (criteria.dateTo) {
      conditions.push(lte(propostas.createdAt, criteria.dateTo));
    }

    const results = await db
      .select()
      .from(propostas)
      .where(and(...conditions));

    return results.map((row) => this.mapToDomain(row));
  }

  async findAll(): Promise<Proposal[]> {
    const results = await db.select().from(propostas).where(isNull(propostas.deletedAt));

    return results.map((row) => this.mapToDomain(row));
  }

  async findByStatus(status: string): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .where(and(eq(propostas.status, status), isNull(propostas.deletedAt)));

    return results.map((row) => this.mapToDomain(row));
  }

  async findByCPF(cpf: string): Promise<Proposal[]> {
    const cleanCPF = cpf.replace(/\D/g, '');

    const results = await db
      .select()
      .from(propostas)
      .where(and(eq(propostas.clienteCpf, cleanCPF), isNull(propostas.deletedAt)));

    return results.map((row) => this.mapToDomain(row));
  }

  async findByLojaId(lojaId: number): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .where(and(eq(propostas.lojaId, lojaId), isNull(propostas.deletedAt)));

    return results.map((row) => this.mapToDomain(row));
  }

  async findByAtendenteId(atendenteId: string): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .where(and(eq(propostas.analistaId, atendenteId), isNull(propostas.deletedAt)));

    return results.map((row) => this.mapToDomain(row));
  }

  async exists(id: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(propostas)
      .where(and(eq(propostas.id, id), isNull(propostas.deletedAt)));

    return result[0].count > 0;
  }

  async delete(id: string): Promise<void> {
    const now = new Date();

    await db.update(propostas).set({ deletedAt: now }).where(eq(propostas.id, id));
  }

  async getNextSequentialId(): Promise<number> {
    // Buscar o maior ID atual e incrementar
    // Como o ID é string no banco, precisamos converter
    const result = await db
      .select({ maxId: sql<number>`COALESCE(MAX(CAST(id AS INTEGER)), 300000)` })
      .from(propostas);

    return result[0].maxId + 1;
  }

  async getNextNumeroProposta(): Promise<number> {
    // Buscar o maior numero_proposta e incrementar
    // Inicia em 300001 se não houver propostas
    const result = await db
      .select({ maxNumero: sql<number>`COALESCE(MAX(numero_proposta), 300000)` })
      .from(propostas);

    return result[0].maxNumero + 1;
  }

  // ========================================================================
  // NOVOS MÉTODOS - PAM V1.0 QUERIES DE NEGÓCIO ESPECÍFICAS
  // ========================================================================

  async findByClienteCpfAndStatus(cpf: string, status: ProposalStatus[]): Promise<Proposal[]> {
    const cleanCPF = cpf.replace(/\D/g, '');
    
    const results = await db
      .select()
      .from(propostas)
      .where(
        and(
          eq(propostas.clienteCpf, cleanCPF),
          inArray(propostas.status, status),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(desc(propostas.createdAt));

    return results.map((row) => this.mapToDomain(row));
  }

  async findPendingForAnalysis(
    options: CursorPaginationOptions,
    filters?: RepositoryFilters
  ): Promise<PaginatedResult<Proposal>> {
    const {
      limit = 50,
      cursor,
      cursorField = 'created_at',
      direction = 'desc'
    } = options;

    // Validar limite
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    
    // Construir condições base
    const conditions = [
      eq(propostas.status, ProposalStatus.EM_ANALISE),
      isNull(propostas.deletedAt)
    ];

    // Adicionar filtros opcionais
    if (filters?.createdAfter) {
      conditions.push(gte(propostas.createdAt, filters.createdAfter));
    }
    if (filters?.createdBefore) {
      conditions.push(lte(propostas.createdAt, filters.createdBefore));
    }

    // Adicionar condição do cursor
    if (cursor && CursorUtils.isValid(cursor)) {
      const cursorValue = CursorUtils.decode(cursor);
      
      if (cursorField === 'created_at') {
        const cursorDate = new Date(cursorValue);
        const cursorCondition = direction === 'desc' 
          ? lt(propostas.createdAt, cursorDate)
          : gt(propostas.createdAt, cursorDate);
        conditions.push(cursorCondition);
      }
    }

    // Executar query
    const query = db
      .select()
      .from(propostas)
      .where(and(...conditions))
      .limit(safeLimit + 1); // +1 para verificar hasNextPage

    // Aplicar ordenação
    if (direction === 'desc') {
      query.orderBy(desc(propostas.createdAt));
    } else {
      query.orderBy(asc(propostas.createdAt));
    }

    const results = await query;
    
    // Verificar se há próxima página
    const hasNextPage = results.length > safeLimit;
    const data = hasNextPage ? results.slice(0, safeLimit) : results;
    
    // Gerar cursors
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
      data: data.map((row) => this.mapToDomain(row)),
      pagination: {
        nextCursor,
        prevCursor,
        pageSize: data.length,
        hasNextPage,
        hasPrevPage: !!cursor
      }
    };
  }

  async findByComprometimentoRenda(threshold: number): Promise<Proposal[]> {
    // Query complexa que calcula comprometimento de renda
    // Utilizando campos de renda mensal e valor da proposta
    const results = await db
      .select()
      .from(propostas)
      .where(
        and(
          isNull(propostas.deletedAt),
          sql`
            CASE 
              WHEN ${propostas.clienteRenda} IS NOT NULL AND ${propostas.clienteRenda} > 0 
              THEN ((${propostas.valor}::numeric / ${propostas.prazo}) / ${propostas.clienteRenda}::numeric) * 100 
              ELSE 0 
            END >= ${threshold}
          `
        )
      )
      .orderBy(desc(propostas.createdAt));

    return results.map((row) => this.mapToDomain(row));
  }

  async findPendingByAnalyst(analistaId: string): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .where(
        and(
          eq(propostas.analistaId, analistaId),
          eq(propostas.status, ProposalStatus.EM_ANALISE),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(asc(propostas.createdAt)); // FIFO para workload management

    return results.map((row) => this.mapToDomain(row));
  }

  async findReadyForCCBGeneration(): Promise<Proposal[]> {
    // Busca propostas aprovadas que ainda não têm CCB gerada
    const results = await db
      .select({
        proposta: propostas,
      })
      .from(propostas)
      .leftJoin(ccbs, eq(propostas.id, ccbs.propostaId))
      .where(
        and(
          eq(propostas.status, ProposalStatus.APROVADO),
          isNull(propostas.deletedAt),
          isNull(ccbs.id) // Não tem CCB ainda
        )
      )
      .orderBy(asc(propostas.createdAt));

    return results.map((row) => this.mapToDomain(row.proposta));
  }

  async findAwaitingBoletoGeneration(): Promise<Proposal[]> {
    // Busca propostas com assinatura concluída que ainda não têm boletos
    const results = await db
      .select({
        proposta: propostas,
      })
      .from(propostas)
      .leftJoin(boletos, eq(propostas.id, boletos.propostaId))
      .where(
        and(
          eq(propostas.status, ProposalStatus.ASSINATURA_CONCLUIDA),
          isNull(propostas.deletedAt),
          isNull(boletos.id) // Não tem boletos ainda
        )
      )
      .orderBy(asc(propostas.createdAt));

    return results.map((row) => this.mapToDomain(row.proposta));
  }

  /**
   * Mapeia dados do banco para o agregado Proposal
   */
  private mapToDomain(row: any): Proposal {
    // ID já é string no banco
    const aggregateId = row.id;

    // Parse cliente_data from JSON string if it exists
    let clienteData;
    if (row.clienteData) {
      try {
        clienteData =
          typeof row.clienteData === 'string' ? JSON.parse(row.clienteData) : row.clienteData;
      } catch {
        clienteData = {
          nome: row.clienteNome,
          cpf: row.clienteCpf,
          rg: row.clienteRg,
          email: row.clienteEmail,
          telefone: row.clienteTelefone,
          endereco: row.clienteEndereco,
          cidade: row.clienteCidade,
          estado: row.clienteUf,
          cep: row.clienteCep,
          data_nascimento: row.clienteDataNascimento,
          renda_mensal: row.clienteRenda ? parseFloat(row.clienteRenda) : undefined,
          empregador: row.clienteEmpresaNome,
          tempo_emprego: row.clienteTempoEmprego,
          dividas_existentes: row.clienteDividasExistentes
            ? parseFloat(row.clienteDividasExistentes)
            : undefined,
        };
      }
    } else {
      clienteData = {
        nome: row.clienteNome,
        cpf: row.clienteCpf,
        rg: row.clienteRg,
        email: row.clienteEmail,
        telefone: row.clienteTelefone,
        endereco: row.clienteEndereco,
        cidade: row.clienteCidade,
        estado: row.clienteUf,
        cep: row.clienteCep,
        data_nascimento: row.clienteDataNascimento,
        renda_mensal: row.clienteRenda ? parseFloat(row.clienteRenda) : undefined,
        empregador: row.clienteEmpresaNome,
        tempo_emprego: row.clienteTempoEmprego,
        dividas_existentes: row.clienteDividasExistentes
          ? parseFloat(row.clienteDividasExistentes)
          : undefined,
      };
    }

    return Proposal.fromDatabase({
      id: aggregateId,
      status: row.status,
      cliente_data: clienteData,
      valor: parseFloat(row.valor),
      prazo: row.prazo,
      taxa_juros: parseFloat(row.taxaJuros),
      produto_id: row.produtoId,
      tabela_comercial_id: row.tabelaComercialId,
      loja_id: row.lojaId,
      parceiro_id: row.parceiroId,
      atendente_id: row.atendenteId,
      dados_pagamento: row.dadosPagamentoMetodo
        ? {
            metodo: row.dadosPagamentoMetodo || row.metodoPagamento,
            banco: row.dadosPagamentoBanco,
            agencia: row.dadosPagamentoAgencia,
            conta: row.dadosPagamentoConta,
            tipo_conta: row.dadosPagamentoTipoConta,
            pix_chave: row.dadosPagamentoPix,
            pix_tipo: row.dadosPagamentoPixTipo,
          }
        : undefined,
      motivo_rejeicao: row.motivoRejeicao,
      observacoes: row.observacoes,
      ccb_url: row.ccbDocumentoUrl,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    });
  }
}
