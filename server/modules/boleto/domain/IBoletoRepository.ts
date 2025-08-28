/**
 * Interface do Repositório de Boletos
 * Banking-Grade Repository Pattern - PAM V1.0 Sprint 2
 *
 * Define o contrato para persistência de boletos com queries de negócio específicas
 * para o sistema de cobrança e pagamentos.
 */

import { PaginatedResult, CursorPaginationOptions, RepositoryFilters } from '@shared/types/pagination';
import { Boleto } from '@shared/schema';

export type BoletoStatus = 
  | 'emitido'
  | 'enviado'
  | 'visualizado'
  | 'pago'
  | 'vencido'
  | 'cancelado';

export type FormaPagamento = 
  | 'boleto'
  | 'pix'
  | 'transferencia'
  | 'cartao';

export interface BoletoRepository {
  // ========================================================================
  // CRUD BÁSICO
  // ========================================================================
  
  /**
   * Salva um boleto (create ou update)
   */
  save(boleto: Boleto): Promise<void>;

  /**
   * Busca um boleto por ID
   */
  findById(id: string): Promise<Boleto | null>;

  /**
   * Busca boleto por número único
   */
  findByNumeroBoleto(numeroBoleto: string): Promise<Boleto | null>;

  // ========================================================================
  // QUERIES DE NEGÓCIO ESPECÍFICAS - SISTEMA DE COBRANÇA
  // ========================================================================

  /**
   * Busca boletos por proposta ID
   * Para visualizar cronograma completo de pagamentos
   * RBAC: Filtra por acesso do usuário
   */
  findByPropostaId(propostaId: string, userId?: string): Promise<Boleto[]>;

  /**
   * Busca boletos por CCB ID
   * Para relacionar boletos aos documentos formalizados
   */
  findByCcbId(ccbId: string): Promise<Boleto[]>;

  /**
   * Busca boletos vencidos não pagos
   * Query crítica para cobrança e inadimplência
   */
  findOverdue(daysOverdue?: number): Promise<Boleto[]>;

  /**
   * Busca boletos com vencimento próximo
   * Para alertas proativos e lembretes
   */
  findDueSoon(daysAhead: number): Promise<Boleto[]>;

  /**
   * Busca boletos por status e banco de origem
   * Para controle de integração bancária
   */
  findByStatusAndBank(status: BoletoStatus, bancoOrigemId: string): Promise<Boleto[]>;

  /**
   * Busca boletos pendentes de sincronização
   * Para jobs de sincronização com bancos
   */
  findPendingSync(): Promise<Boleto[]>;

  /**
   * Busca boletos com pagamento confirmado no período
   * Para relatórios financeiros e conciliação
   */
  findPaidInPeriod(startDate: Date, endDate: Date): Promise<Boleto[]>;

  /**
   * Busca boletos com paginação por cursor
   * Query principal para dashboards e listagens
   */
  findWithPagination(
    options: CursorPaginationOptions,
    filters?: RepositoryFilters & {
      status?: BoletoStatus | BoletoStatus[];
      propostaId?: string;
      ccbId?: string;
      formaPagamento?: FormaPagamento;
      bancoOrigemId?: string;
    }
  ): Promise<PaginatedResult<Boleto>>;

  // ========================================================================
  // QUERIES DE ANÁLISE FINANCEIRA
  // ========================================================================

  /**
   * Calcula valor total em aberto por proposta
   */
  getTotalPendingByProposta(propostaId: string): Promise<number>;

  /**
   * Busca boletos por valor acima do threshold
   * Para análise de risco e monitoramento
   */
  findByAmountThreshold(minAmount: number): Promise<Boleto[]>;

  /**
   * Busca estatísticas de pagamento por período
   * Para dashboards executivos
   */
  getPaymentStatsByPeriod(startDate: Date, endDate: Date): Promise<{
    totalEmitidos: number;
    totalPagos: number;
    totalVencidos: number;
    valorTotalEmitido: number;
    valorTotalPago: number;
    valorTotalVencido: number;
  }>;

  /**
   * Busca boletos por CPF do cliente
   * Para histórico de pagamentos do cliente
   */
  findByClienteCpf(cpf: string): Promise<Boleto[]>;

  // ========================================================================
  // QUERIES DE CONTROLE E AUDITORIA
  // ========================================================================

  /**
   * Busca boletos gerados por usuário
   * Para auditoria e controle de atividades
   */
  findByGeneratedBy(userId: string): Promise<Boleto[]>;

  /**
   * Conta boletos por status
   * Para métricas e dashboards
   */
  countByStatus(status: BoletoStatus): Promise<number>;

  /**
   * Busca boletos órfãos (sem proposta ou CCB válida)
   * Para limpeza e integridade de dados
   */
  findOrphaned(): Promise<Boleto[]>;

  // ========================================================================
  // UTILITÁRIOS
  // ========================================================================

  /**
   * Verifica se existe boleto com o ID
   */
  exists(id: string): Promise<boolean>;

  /**
   * Verifica se existe boleto com o número
   */
  existsByNumero(numeroBoleto: string): Promise<boolean>;

  /**
   * Remove um boleto (soft delete)
   */
  delete(id: string): Promise<void>;

  /**
   * Gera o próximo número de boleto sequencial
   */
  getNextNumeroBoleto(): Promise<string>;
}

/**
 * Interface padrão para repositórios (alias para compatibilidade)
 */
export interface IBoletoRepository extends BoletoRepository {}