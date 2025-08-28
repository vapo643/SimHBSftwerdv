/**
 * Interface do Repositório de CCBs (Cédulas de Crédito Bancário)
 * Banking-Grade Repository Pattern - PAM V1.0 Sprint 2
 *
 * Define o contrato para persistência de CCBs com queries de negócio específicas
 * para o workflow de formalização.
 */

import { PaginatedResult, CursorPaginationOptions, RepositoryFilters } from '@shared/types/pagination';
import { Ccb } from '@shared/schema';

export type CcbStatus = 
  | 'gerada'
  | 'enviada_para_assinatura'
  | 'assinada'
  | 'baixada'
  | 'cancelada';

export interface CcbRepository {
  // ========================================================================
  // CRUD BÁSICO
  // ========================================================================
  
  /**
   * Salva uma CCB (create ou update)
   */
  save(ccb: Ccb): Promise<void>;

  /**
   * Busca uma CCB por ID
   */
  findById(id: string): Promise<Ccb | null>;

  /**
   * Busca CCB por número único
   */
  findByNumeroCcb(numeroCcb: string): Promise<Ccb | null>;

  // ========================================================================
  // QUERIES DE NEGÓCIO ESPECÍFICAS - WORKFLOW DE FORMALIZAÇÃO
  // ========================================================================

  /**
   * Busca CCBs por proposta ID
   * Utilizada para verificar histórico de documentos de uma proposta
   * RBAC: Filtra por acesso do usuário
   */
  findByPropostaId(propostaId: string, userId?: string): Promise<Ccb[]>;

  /**
   * Busca CCBs prontas para envio para assinatura
   * Status: 'gerada' e dados completos
   */
  findReadyForSignature(): Promise<Ccb[]>;

  /**
   * Busca CCBs pendentes de assinatura com timeout próximo
   * Para alertas proativos e follow-up
   */
  findPendingSignatureWithTimeout(hours: number): Promise<Ccb[]>;

  /**
   * Busca CCBs por status ClickSign
   * Para sincronização e controle de workflow
   */
  findByClickSignStatus(clickSignStatus: string): Promise<Ccb[]>;

  /**
   * Busca CCBs prontas para baixa (assinadas)
   * Status: 'assinada' e prontas para processo de baixa
   */
  findReadyForDownload(): Promise<Ccb[]>;

  /**
   * Busca CCBs com paginação por cursor
   * Query principal para dashboards e listagens
   */
  findWithPagination(
    options: CursorPaginationOptions,
    filters?: RepositoryFilters & {
      status?: CcbStatus | CcbStatus[];
      propostaId?: string;
      clickSignStatus?: string;
    }
  ): Promise<PaginatedResult<Ccb>>;

  // ========================================================================
  // QUERIES DE CONTROLE E AUDITORIA
  // ========================================================================

  /**
   * Busca CCBs criadas em um período específico
   * Para relatórios e auditoria
   */
  findByDateRange(startDate: Date, endDate: Date): Promise<Ccb[]>;

  /**
   * Busca CCBs por usuário criador
   * Para auditoria e controle de atividades
   */
  findByCreatedBy(userId: string): Promise<Ccb[]>;

  /**
   * Conta CCBs por status
   * Para dashboards e métricas
   */
  countByStatus(status: CcbStatus): Promise<number>;

  /**
   * Busca CCBs órfãs (sem proposta válida)
   * Para limpeza e integridade de dados
   */
  findOrphaned(): Promise<Ccb[]>;

  // ========================================================================
  // UTILITÁRIOS
  // ========================================================================

  /**
   * Verifica se existe CCB com o ID
   */
  exists(id: string): Promise<boolean>;

  /**
   * Verifica se existe CCB com o número
   */
  existsByNumero(numeroCcb: string): Promise<boolean>;

  /**
   * Remove uma CCB (soft delete)
   */
  delete(id: string): Promise<void>;

  /**
   * Gera o próximo número de CCB sequencial
   */
  getNextNumeroCcb(): Promise<string>;
}

/**
 * Interface padrão para repositórios (alias para compatibilidade)
 */
export interface ICcbRepository extends CcbRepository {}