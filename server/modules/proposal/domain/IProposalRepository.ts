/**
 * Interface do Repositório de Propostas
 *
 * Define o contrato para persistência de propostas.
 * Parte do domínio, mas não conhece detalhes de implementação.
 */

import { Proposal } from './Proposal';

export interface ProposalSearchCriteria {
  status?: string;
  lojaId?: number;
  atendenteId?: string;
  cpf?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface IProposalRepository {
  /**
   * Salva uma proposta (create ou update)
   */
  save(proposal: Proposal): Promise<void>;

  /**
   * Busca uma proposta por ID
   */
  findById(id: string): Promise<Proposal | null>;

  /**
   * Busca propostas por critérios
   */
  findByCriteria(criteria: ProposalSearchCriteria): Promise<Proposal[]>;

  /**
   * Busca todas as propostas
   */
  findAll(): Promise<Proposal[]>;

  /**
   * Busca propostas por status
   */
  findByStatus(status: string): Promise<Proposal[]>;

  /**
   * Busca propostas por CPF do cliente
   */
  findByCPF(cpf: string): Promise<Proposal[]>;

  /**
   * Busca propostas por loja
   */
  findByLojaId(lojaId: number): Promise<Proposal[]>;

  /**
   * Busca propostas por atendente
   */
  findByAtendenteId(atendenteId: string): Promise<Proposal[]>;

  /**
   * Verifica se existe proposta com o ID
   */
  exists(id: string): Promise<boolean>;

  /**
   * Remove uma proposta (soft delete)
   */
  delete(id: string): Promise<void>;

  /**
   * Gera o próximo ID sequencial (para compatibilidade com sistema legado)
   */
  getNextSequentialId(): Promise<number>;
}
