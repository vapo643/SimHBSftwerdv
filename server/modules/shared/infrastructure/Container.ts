/**
 * IoC Container - IMPLEMENTAÇÃO P0.2 PLANO SOBERANIA
 * Centralização de dependências seguindo princípio DIP
 *
 * Substitui dependencies.ts por container real de injeção de dependência
 */

export class Container {
  private static instance: Container;
  private services: Map<string | symbol, any> = new Map();
  private factories: Map<string | symbol, () => any> = new Map();

  private constructor() {}

  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Registra um singleton no container
   */
  register<T>(token: string | symbol, instance: T): void {
    this.services.set(token, instance);
  }

  /**
   * Registra uma factory function no container
   */
  registerFactory<T>(token: string | symbol, factory: () => T): void {
    this.factories.set(token, factory);
  }

  /**
   * Resolve uma dependência do container
   */
  resolve<T>(token: string | symbol): T {
    // Primeiro tenta resolver singleton
    if (this.services.has(token)) {
      return this.services.get(token) as T;
    }

    // Depois tenta resolver factory
    if (this.factories.has(token)) {
      const factory = this.factories.get(token)!;
      return factory() as T;
    }

    throw new Error(`Service not found: ${String(token)}`);
  }

  /**
   * Verifica se um serviço está registrado
   */
  has(token: string | symbol): boolean {
    return this.services.has(token) || this.factories.has(token);
  }

  /**
   * Remove um serviço do container (para testes)
   */
  clear(token?: string | symbol): void {
    if (token) {
      this.services.delete(token);
      this.factories.delete(token);
    } else {
      this.services.clear();
      this.factories.clear();
    }
  }
}

/**
 * Tokens para injeção de dependência
 * Evita strings hardcoded e permite refatoração segura
 */
export const TOKENS = {
  // Repositories
  PROPOSAL_REPOSITORY: Symbol('ProposalRepository'),

  // Use Cases
  CREATE_PROPOSAL_USE_CASE: Symbol('CreateProposalUseCase'),
  GET_PROPOSAL_BY_ID_USE_CASE: Symbol('GetProposalByIdUseCase'),
  APPROVE_PROPOSAL_USE_CASE: Symbol('ApproveProposalUseCase'),
  REJECT_PROPOSAL_USE_CASE: Symbol('RejectProposalUseCase'),
  PENDENCIAR_PROPOSTA_USE_CASE: Symbol('PendenciarPropostaUseCase'),
  SUBMIT_FOR_ANALYSIS_USE_CASE: Symbol('SubmitForAnalysisUseCase'),

  // 🏡 P0.2 GREEN - Novos use cases para eliminar DIP leakage
  LIST_PROPOSALS_BY_CRITERIA_USE_CASE: Symbol('ListProposalsByCriteriaUseCase'),
  RESUBMIT_PENDING_PROPOSAL_USE_CASE: Symbol('ResubmitPendingProposalUseCase'),
} as const;
