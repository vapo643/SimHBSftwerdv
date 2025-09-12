/**
 * Interface do Repositório de Propostas
 * Banking-Grade Repository Pattern - PAM V1.0 Sprint 2
 *
 * Define o contrato para persistência de propostas com queries de negócio específicas
 * e paginação baseada em cursor para performance otimizada.
 */

import { Proposal, ProposalStatus } from './Proposal';
import {
  PaginatedResult,
  CursorPaginationOptions,
  RepositoryFilters,
} from '@shared/types/pagination';

export interface ProposalSearchCriteria {
  status?: string;
  statusArray?: string[]; // CORREÇÃO CRÍTICA: Suporte para múltiplos status na fila de análise
  lojaId?: number;
  atendenteId?: string;
  cpf?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ProposalRepository {
  // ========================================================================
  // CRUD BÁSICO
  // ========================================================================

  /**
   * Salva uma proposta (create ou update)
   */
  save(proposal: Proposal): Promise<void>;

  /**
   * Busca uma proposta por ID
   */
  findById(id: string): Promise<Proposal | null>;

  // ========================================================================
  // QUERIES DE NEGÓCIO ESPECÍFICAS - PAM V1.0
  // ========================================================================

  /**
   * Busca propostas por CPF do cliente e status específicos
   * Útil para verificar histórico do cliente e compliance
   */
  findByClienteCpfAndStatus(cpf: string, status: ProposalStatus[]): Promise<Proposal[]>;

  /**
   * Busca propostas pendentes para análise com paginação por cursor
   * Query crítica para dashboard de analistas
   */
  findPendingForAnalysis(
    options: CursorPaginationOptions,
    filters?: RepositoryFilters
  ): Promise<PaginatedResult<Proposal>>;

  /**
   * Busca propostas por comprometimento de renda acima do threshold
   * Essencial para análise de risco e compliance
   */
  findByComprometimentoRenda(threshold: number): Promise<Proposal[]>;

  /**
   * Busca propostas pendentes atribuídas a um analista específico
   * Para workload management e distribuição de tarefas
   */
  findPendingByAnalyst(analistaId: string): Promise<Proposal[]>;

  /**
   * Busca propostas prontas para geração de CCB
   * Status: APROVADO e sem CCB gerada
   */
  findReadyForCCBGeneration(): Promise<Proposal[]>;

  /**
   * Busca propostas aguardando geração de boletos
   * Status: ASSINATURA_CONCLUIDA e sem boletos gerados
   */
  findAwaitingBoletoGeneration(): Promise<Proposal[]>;

  // ========================================================================
  // QUERIES LEGADAS (MANTIDAS PARA COMPATIBILIDADE)
  // ========================================================================

  /**
   * Busca propostas por critérios
   */
  findByCriteria(criteria: ProposalSearchCriteria): Promise<Proposal[]>;

  /**
   * Busca todas as propostas (DEPRECATED - usar paginação)
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

  // ========================================================================
  // UTILITÁRIOS
  // ========================================================================

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

  /**
   * Busca propostas por critérios com formato lightweight para listagem
   * Retorna dados otimizados para a UI com JOINs mínimos necessários
   */
  findByCriteriaLightweight(criteria: ProposalSearchCriteria): Promise<any[]>;

  // 🚀 MÉTODOS EFICIENTES PARA OPERAÇÕES SIMPLES
  /**
   * Busca apenas o status de uma proposta (sem reconstituir objeto completo)
   * PERFORMANCE: Muito mais eficiente que findById() para verificações de status
   */
  getProposalStatus(id: string): Promise<ProposalStatus | null>;

  /**
   * Atualiza apenas o status de uma proposta (sem carregar dados completos)  
   * PERFORMANCE: Operação lean para transições de status simples
   */
  updateStatus(id: string, newStatus: ProposalStatus, userId: string): Promise<void>;
}

/**
 * Interface padrão para repositórios (alias para compatibilidade)
 */
export interface IProposalRepository extends ProposalRepository {}
