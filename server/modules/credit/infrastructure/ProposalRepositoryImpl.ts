/**
 * Proposal Repository Implementation
 * Concrete implementation using Drizzle ORM
 */

import { eq, and, between, sql } from 'drizzle-orm';
import { db } from '../../../lib/supabase';
import { propostas } from '../../../../shared/schema';
import { Proposal } from '../../proposal/domain/Proposal';
import { IProposalRepository } from '../domain/repositories/IProposalRepository';

export class ProposalRepositoryImpl implements IProposalRepository {
  /**
   * Find proposal by ID
   */
  async findById(id: string): Promise<Proposal | null> {
    const result = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);

    if (result.length === 0) {
      return null;
    }

    return this.toDomainEntity(result[0]);
  }

  /**
   * Find proposals by CPF
   */
  async findByCpf(cpf: string): Promise<Proposal[]> {
    const results = await db.select().from(propostas).where(eq(propostas.clienteCpf, cpf));

    return results.map((r: any) => this.toDomainEntity(r));
  }

  /**
   * Find proposals by store ID
   */
  async findByStoreId(storeId: string): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .where(eq(propostas.lojaId, parseInt(storeId)));

    return results.map((r: any) => this.toDomainEntity(r));
  }

  /**
   * Find all proposals
   */
  async findAll(): Promise<Proposal[]> {
    const results = await db.select().from(propostas).orderBy(propostas.createdAt);

    return results.map((r: any) => this.toDomainEntity(r));
  }

  /**
   * Save a new proposal
   */
  async save(proposal: Proposal): Promise<void> {
    const data = this.toPersistence(proposal);

    await db.insert(propostas).values(data);
  }

  /**
   * Update an existing proposal
   */
  async update(proposal: Proposal): Promise<void> {
    const data = this.toPersistence(proposal);

    await db.update(propostas).set(data).where(eq(propostas.id, proposal.id));
  }

  /**
   * Delete a proposal (soft delete)
   */
  async delete(id: string): Promise<void> {
    await db.update(propostas).set({ deletedAt: new Date() }).where(eq(propostas.id, id));
  }

  /**
   * Find proposals pending analysis
   */
  async findPendingAnalysis(): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .where(eq(propostas.status, 'aguardando_analise'));

    return results.map((r: any) => this.toDomainEntity(r));
  }

  /**
   * Find proposals by status and date range
   */
  async findByStatusAndDateRange(
    status: string,
    startDate: Date,
    endDate: Date
  ): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .where(and(eq(propostas.status, status), between(propostas.createdAt, startDate, endDate)));

    return results.map((r: any) => this.toDomainEntity(r));
  }

  /**
   * Count proposals by status
   */
  async countByStatus(status: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(propostas)
      .where(eq(propostas.status, status));

    return result[0]?.count || 0;
  }

  /**
   * Get total amount by status
   */
  async getTotalAmountByStatus(status: string): Promise<number> {
    const result = await db
      .select({ total: sql<number>`sum(valor)` })
      .from(propostas)
      .where(eq(propostas.status, status));

    return result[0]?.total || 0;
  }

  /**
   * Convert database record to domain entity
   */
  private toDomainEntity(record: any): Proposal {
    const customerData = {
      name: record.clienteNome,
      cpf: record.clienteCpf,
      email: record.clienteEmail,
      phone: record.clienteTelefone,
      birthDate: record.clienteDataNascimento,
      monthlyIncome: record.clienteRenda,
      rg: record.clienteRg,
      issuingBody: record.clienteOrgaoEmissor,
      maritalStatus: record.clienteEstadoCivil,
      nationality: record.clienteNacionalidade,
      zipCode: record.clienteCep,
      address: record.clienteEndereco,
      occupation: record.clienteOcupacao,
    };

    const loanConditions = {
      requestedAmount: record.valor,
      term: record.prazo,
      purpose: record.finalidade,
      collateral: record.garantia,
      tacValue: record.valorTac,
      iofValue: record.valorIof,
      totalFinancedAmount: record.valorTotalFinanciado,
      monthlyPayment: record.valorParcela,
      interestRate: record.taxaJuros,
    };

    return Proposal.fromDatabase({
      id: record.id,
      status: record.status,
      cliente_data: {
        nome: customerData.name,
        cpf: customerData.cpf,
        email: customerData.email,
        telefone: customerData.phone,
        data_nascimento: customerData.birthDate,
        renda_mensal: customerData.monthlyIncome,
        rg: customerData.rg,
        orgao_emissor: customerData.issuingBody,
        estado_civil: customerData.maritalStatus,
        nacionalidade: customerData.nationality,
        cep: customerData.zipCode,
        endereco: customerData.address,
        ocupacao: customerData.occupation,
      },
      valor: loanConditions.requestedAmount,
      prazo: loanConditions.term,
      taxa_juros: loanConditions.interestRate || 2.5,
      produto_id: record.produtoId,
      tabela_comercial_id: record.tabelaComercialId || 1,
      loja_id: record.lojaId,
      analista_id: record.analistaId || 'e647afc0-03fa-482d-8293-d824dcab0399',
      valor_tac: loanConditions.tacValue || 0,
      valor_iof: loanConditions.iofValue || 0,
      valor_total_financiado: loanConditions.totalFinancedAmount || loanConditions.requestedAmount,
      taxa_juros_anual: (loanConditions.interestRate || 2.5) * 12,
      ccb_documento_url: '',
      dados_pagamento_banco: '001',
      cliente_comprometimento_renda: 30,
      parceiro_id: record.parceiroId,
      atendente_id: record.atendenteId,
      finalidade: loanConditions.purpose,
      garantia: loanConditions.collateral,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      motivo_rejeicao: record.motivoPendencia,
      observacoes: record.observacoes
    });
  }

  /**
   * Convert domain entity to database record
   */
  private toPersistence(proposal: Proposal): any {
    const customerData = proposal.clienteData;
    const loanConditions = {
      requestedAmount: proposal.valor.getReais(),
      term: proposal.prazo,
      purpose: proposal.finalidade,
      collateral: proposal.garantia,
      tacValue: proposal.valorTac,
      iofValue: proposal.valorIof,
      totalFinancedAmount: proposal.valorTotalFinanciado,
      monthlyPayment: proposal.calculateMonthlyPayment(),
      interestRate: proposal.taxaJuros
    };

    return {
      id: proposal.id,
      status: proposal.status,
      clienteNome: customerData.name,
      clienteCpf: customerData.cpf,
      clienteEmail: customerData.email,
      clienteTelefone: customerData.phone,
      clienteDataNascimento: customerData.birthDate,
      clienteRenda: customerData.monthlyIncome,
      clienteRg: customerData.rg,
      clienteOrgaoEmissor: customerData.issuingBody,
      clienteEstadoCivil: customerData.maritalStatus,
      clienteNacionalidade: customerData.nationality,
      clienteCep: customerData.zipCode,
      clienteEndereco: customerData.address,
      clienteOcupacao: customerData.occupation,
      valor: loanConditions.requestedAmount,
      prazo: loanConditions.term,
      finalidade: loanConditions.purpose,
      garantia: loanConditions.collateral,
      valorTac: loanConditions.tacValue,
      valorIof: loanConditions.iofValue,
      valorTotalFinanciado: loanConditions.totalFinancedAmount,
      valorParcela: loanConditions.monthlyPayment,
      taxaJuros: loanConditions.interestRate,
      parceiroId: proposal.parceiroId ? parseInt(proposal.parceiroId.toString()) : null,
      lojaId: proposal.lojaId || null,
      produtoId: proposal.produtoId || null,
      motivoPendencia: proposal.motivoRejeicao,
      observacoes: proposal.observacoes,
      updatedAt: proposal.updatedAt,
    };
  }
}
