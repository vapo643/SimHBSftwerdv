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
    const result = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);
    
    if (result.length === 0) {
      return null;
    }
    
    return this.toDomainEntity(result[0]);
  }

  /**
   * Find proposals by CPF
   */
  async findByCpf(cpf: string): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .where(eq(propostas.cliente_cpf, cpf));
    
    return results.map((r: any) => this.toDomainEntity(r));
  }

  /**
   * Find proposals by store ID
   */
  async findByStoreId(storeId: string): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .where(eq(propostas.loja_id, parseInt(storeId)));
    
    return results.map((r: any) => this.toDomainEntity(r));
  }

  /**
   * Find all proposals
   */
  async findAll(): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .orderBy(propostas.created_at);
    
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
    
    await db
      .update(propostas)
      .set(data)
      .where(eq(propostas.id, proposal.getId()));
  }

  /**
   * Delete a proposal (soft delete)
   */
  async delete(id: string): Promise<void> {
    await db
      .update(propostas)
      .set({ deleted_at: new Date() })
      .where(eq(propostas.id, id));
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
      .where(
        and(
          eq(propostas.status, status),
          between(propostas.created_at, startDate, endDate)
        )
      );
    
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
      .select({ total: sql<number>`sum(valor_solicitado)` })
      .from(propostas)
      .where(eq(propostas.status, status));
    
    return result[0]?.total || 0;
  }

  /**
   * Convert database record to domain entity
   */
  private toDomainEntity(record: any): Proposal {
    const customerData = {
      name: record.cliente_nome,
      cpf: record.cliente_cpf,
      email: record.cliente_email,
      phone: record.cliente_telefone,
      birthDate: record.cliente_data_nascimento,
      monthlyIncome: record.cliente_renda,
      rg: record.cliente_rg,
      issuingBody: record.cliente_orgao_emissor,
      maritalStatus: record.cliente_estado_civil,
      nationality: record.cliente_nacionalidade,
      zipCode: record.cliente_cep,
      address: record.cliente_endereco,
      occupation: record.cliente_ocupacao
    };
    
    const loanConditions = {
      requestedAmount: record.valor_solicitado,
      term: record.prazo,
      purpose: record.finalidade,
      collateral: record.garantia,
      tacValue: record.valor_tac,
      iofValue: record.valor_iof,
      totalFinancedAmount: record.valor_total_financiado,
      monthlyPayment: record.valor_parcela,
      interestRate: record.taxa_juros
    };
    
    return Proposal.fromPersistence({
      id: record.id,
      status: record.status,
      customerData,
      loanConditions,
      partnerId: record.parceiro_id?.toString(),
      storeId: record.loja_id?.toString(),
      productId: record.produto_id?.toString(),
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      pendingReason: record.motivo_pendencia,
      observations: record.observacoes
    });
  }

  /**
   * Convert domain entity to database record
   */
  private toPersistence(proposal: Proposal): any {
    const customerData = proposal.getCustomerData();
    const loanConditions = proposal.getLoanConditions();
    
    return {
      id: proposal.getId(),
      status: proposal.getStatus(),
      cliente_nome: customerData.name,
      cliente_cpf: customerData.cpf,
      cliente_email: customerData.email,
      cliente_telefone: customerData.phone,
      cliente_data_nascimento: customerData.birthDate,
      cliente_renda: customerData.monthlyIncome,
      cliente_rg: customerData.rg,
      cliente_orgao_emissor: customerData.issuingBody,
      cliente_estado_civil: customerData.maritalStatus,
      cliente_nacionalidade: customerData.nationality,
      cliente_cep: customerData.zipCode,
      cliente_endereco: customerData.address,
      cliente_ocupacao: customerData.occupation,
      valor_solicitado: loanConditions.requestedAmount,
      prazo: loanConditions.term,
      finalidade: loanConditions.purpose,
      garantia: loanConditions.collateral,
      valor_tac: loanConditions.tacValue,
      valor_iof: loanConditions.iofValue,
      valor_total_financiado: loanConditions.totalFinancedAmount,
      valor_parcela: loanConditions.monthlyPayment,
      taxa_juros: loanConditions.interestRate,
      parceiro_id: proposal.getPartnerId() ? parseInt(proposal.getPartnerId()!) : null,
      loja_id: proposal.getStoreId() ? parseInt(proposal.getStoreId()!) : null,
      produto_id: proposal.getProductId() ? parseInt(proposal.getProductId()!) : null,
      motivo_pendencia: proposal.getPendingReason(),
      observacoes: proposal.getObservations(),
      updated_at: proposal.getUpdatedAt()
    };
  }
}