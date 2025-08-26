/**
 * Implementação concreta do Repository de Propostas
 *
 * Usa Drizzle ORM para persistência no PostgreSQL.
 * Parte da camada de infraestrutura.
 */

import { eq, and, gte, lte, or, isNull, sql } from 'drizzle-orm';
import { db } from '../../../lib/supabase';
import { propostas } from '@shared/schema';
import { Proposal } from '../domain/Proposal';
import { IProposalRepository, ProposalSearchCriteria } from '../domain/IProposalRepository';

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
          dadosPagamentoMetodo: data.dados_pagamento?.metodo,
          dadosPagamentoBanco: data.dados_pagamento?.banco,
          dadosPagamentoAgencia: data.dados_pagamento?.agencia,
          dadosPagamentoConta: data.dados_pagamento?.conta,
          dadosPagamentoTipoConta: data.dados_pagamento?.tipo_conta,
          dadosPagamentoPix: data.dados_pagamento?.pix_chave,
          motivoRejeicao: data.motivo_rejeicao,
          observacoes: data.observacoes,
          ccbDocumentoUrl: data.ccb_url,
          updatedAt: data.updated_at,
        })
        .where(eq(propostas.id, data.id));
    } else {
      // Create - gerar IDs sequenciais
      const sequentialId = await this.getNextSequentialId();
      const numeroProposta = await this.getNextNumeroProposta();

      await db.insert(propostas).values([{
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
        dadosPagamentoMetodo: data.dados_pagamento?.metodo,
        dadosPagamentoBanco: data.dados_pagamento?.banco,
        dadosPagamentoAgencia: data.dados_pagamento?.agencia,
        dadosPagamentoConta: data.dados_pagamento?.conta,
        dadosPagamentoTipoConta: data.dados_pagamento?.tipo_conta,
        dadosPagamentoPix: data.dados_pagamento?.pix_chave,
        motivoRejeicao: data.motivo_rejeicao,
        observacoes: data.observacoes,
        ccbDocumentoUrl: data.ccb_url,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }]);
    }

    // Processar eventos de domínio
    const events = proposal.getUncommittedEvents();
    for (const event of events) {
      // Aqui poderíamos publicar os eventos para um event bus
      // Por enquanto, apenas logamos
      console.log(`[DOMAIN EVENT] ${event.eventType} for aggregate ${event.aggregateId}`);
    }
    proposal.markEventsAsCommitted();
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
      conditions.push(eq(propostas.analistaId, criteria.atendenteId));
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
