/**
 * Proposal Repository Implementation
 * Concrete implementation using Drizzle ORM
 */

import { eq, and, between, sql } from 'drizzle-orm';
import { db } from '../../../lib/supabase';
import { propostas } from '../../../../shared/schema';
import { Proposal } from '../domain/aggregates/Proposal';
import { IProposalRepository } from '../domain/repositories/IProposalRepository';

export class ProposalRepositoryImpl implements IProposalRepository {
  /**
   * Find proposal by ID
   */
  async findById(id: string): Promise<Proposal | null> {
    const _result = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);

    if (_result.length == 0) {
      return null;
    }

    return this.toDomainEntity(result[0]);
  }

  /**
   * Find proposals by CPF
   */
  async findByCpf(cpf: string): Promise<Proposal[]> {
    const _results = await db.select().from(propostas).where(eq(propostas.clienteCpf, cpf));

    return results.map((r) => this.toDomainEntity(r));
  }

  /**
   * Find proposals by store ID
   */
  async findByStoreId(storeId: string): Promise<Proposal[]> {
    const _results = await db
      .select()
      .from(propostas)
      .where(eq(propostas.lojaId, parseInt(storeId)));

    return results.map((r) => this.toDomainEntity(r));
  }

  /**
   * Find all proposals
   */
  async findAll(): Promise<Proposal[]> {
    const _results = await db.select().from(propostas).orderBy(propostas.createdAt);

    return results.map((r) => this.toDomainEntity(r));
  }

  /**
   * Save a new proposal
   */
  async save(proposal: Proposal): Promise<void> {
    const _data = this.toPersistence(proposal);

    await db.insert(propostas).values(_data);
  }

  /**
   * Update an existing proposal
   */
  async update(proposal: Proposal): Promise<void> {
    const _data = this.toPersistence(proposal);

    await db.update(propostas).set(_data).where(eq(propostas.id, proposal.getId()));
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
    const _results = await db
      .select()
      .from(propostas)
      .where(eq(propostas.status, 'aguardando_analise'));

    return results.map((r) => this.toDomainEntity(r));
  }

  /**
   * Find proposals by status and date range
   */
  async findByStatusAndDateRange(
    status: string,
    startDate: Date,
    endDate: Date
  ): Promise<Proposal[]> {
    const _results = await db
      .select()
      .from(propostas)
      .where(and(eq(propostas.status, status), between(propostas.createdAt, startDate, endDate)));

    return results.map((r) => this.toDomainEntity(r));
  }

  /**
   * Count proposals by status
   */
  async countByStatus(status: string): Promise<number> {
    const _result = await db
      .select({ count: sql<number>`count(*)` })
      .from(propostas)
      .where(eq(propostas.status, status));

    return result[0]?.count || 0;
  }

  /**
   * Get total amount by status
   */
  async getTotalAmountByStatus(status: string): Promise<number> {
    const _result = await db
      .select({ total: sql<number>`sum(valor)` })
      .from(propostas)
      .where(eq(propostas.status, status));

    return result[0]?.total || 0;
  }

  /**
   * Convert database record to domain entity
   */
  private toDomainEntity(record): Proposal {
    const _customerData = {
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

    const _loanConditions = {
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

    return Proposal.fromPersistence({
      id: record.id,
      status: record.status,
      _customerData,
      _loanConditions,
      partnerId: record.parceiroId?.toString(),
      storeId: record.lojaId?.toString(),
      productId: record.produtoId?.toString(),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      pendingReason: record.motivoPendencia,
      observations: record.observacoes,
    });
  }

  /**
   * Convert domain entity to database record
   */
  private toPersistence(proposal: Proposal): unknown {
    const _customerData = proposal.getCustomerData();
    const _loanConditions = proposal.getLoanConditions();

    return {
      id: proposal.getId(),
      status: proposal.getStatus(),
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
      parceiroId: proposal.getPartnerId() ? parseInt(proposal.getPartnerId()!) : null,
      lojaId: proposal.getStoreId() ? parseInt(proposal.getStoreId()!) : null,
      produtoId: proposal.getProductId() ? parseInt(proposal.getProductId()!) : null,
      motivoPendencia: proposal.getPendingReason(),
      observacoes: proposal.getObservations(),
      updatedAt: proposal.getUpdatedAt(),
    };
  }
}
