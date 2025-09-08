/**
 * Interface do Unit of Work (UoW) - Banking-Grade Transaction Management
 * PAM V1.0 Sprint 2 - Padrão Unit of Work
 *
 * Responsável por gerir transações atômicas que envolvem múltiplos repositórios,
 * garantindo que operações de negócio complexas sejam executadas como uma única
 * unidade indivisível.
 *
 * ATOMICIDADE: Todas as operações são confirmadas (commit) ou revertidas (rollback) em conjunto.
 * ISOLAMENTO: Transações em paralelo não interferem entre si.
 * DURABILIDADE: Uma vez confirmada, a transação persiste mesmo em caso de falha do sistema.
 */

import { IProposalRepository } from '../../proposal/domain/IProposalRepository';
import { ICcbRepository } from '../../ccb/domain/ICcbRepository';
import { IBoletoRepository } from '../../boleto/domain/IBoletoRepository';

export interface IUnitOfWork {
  // ========================================================================
  // REPOSITÓRIOS TRANSACIONAIS
  // ========================================================================

  /**
   * Repositório de Propostas dentro do contexto transacional
   */
  readonly proposals: IProposalRepository;

  /**
   * Repositório de CCBs dentro do contexto transacional
   */
  readonly ccbs: ICcbRepository;

  /**
   * Repositório de Boletos dentro do contexto transacional
   */
  readonly boletos: IBoletoRepository;

  // ========================================================================
  // CONTROLE TRANSACIONAL
  // ========================================================================

  /**
   * Executa um bloco de trabalho dentro de uma transação atômica.
   *
   * Se qualquer operação dentro do trabalho falhar, toda a transação é revertida.
   * Se todas as operações forem bem-sucedidas, a transação é confirmada.
   *
   * @param work Função que contém a lógica de negócio a ser executada transacionalmente
   * @returns Promise com o resultado do trabalho executado
   *
   * @example
   * ```typescript
   * const resultado = await uow.executeInTransaction(async () => {
   *   // Aprovar proposta
   *   const proposta = await uow.proposals.findById(propostaId);
   *   proposta.aprovar();
   *   await uow.proposals.save(proposta);
   *
   *   // Gerar CCB
   *   const ccb = new Ccb(proposta);
   *   await uow.ccbs.save(ccb);
   *
   *   return { propostaId: proposta.id, ccbId: ccb.id };
   * });
   * ```
   */
  executeInTransaction<T>(work: () => Promise<T>): Promise<T>;

  // ========================================================================
  // ESTADO DA TRANSAÇÃO (OPCIONAL - PARA DEBUGGING)
  // ========================================================================

  /**
   * Indica se há uma transação ativa
   */
  readonly isInTransaction: boolean;

  /**
   * ID da transação atual (para auditoria e debugging)
   */
  readonly transactionId: string | null;
}

/**
 * Type helper para funções que requerem Unit of Work
 */
export type UnitOfWorkFunction<T> = (uow: IUnitOfWork) => Promise<T>;

/**
 * Interface para factory do Unit of Work (Dependency Injection)
 */
export interface IUnitOfWorkFactory {
  /**
   * Cria uma nova instância do Unit of Work
   */
  create(): IUnitOfWork;
}
