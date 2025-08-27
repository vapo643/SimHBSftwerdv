/**
 * Observacoes Service
 * Business logic layer for observacoes
 * Controllers call services, services call repositories
 */

import { observacoesRepository, type Observacao } from '../repositories/observacoes.repository';
import { securityLogger, SecurityEventType } from '../lib/security-logger';

export class ObservacoesService {
  /**
   * Get all observacoes for a proposta
   */
  async getObservacoesByProposta(propostaId: number): Promise<Observacao[]> {
    try {
      return await observacoesRepository.findByPropostaId(propostaId); }
    } catch (error) {
      console.error(
        `[ObservacoesService] Error fetching observacoes for proposta ${propostaId}:`,
        error
      );
      throw new Error('Erro ao buscar observações');
    }
  }

  /**
   * Create a new observacao
   */
  async createObservacao(
    propostaId: number,
    observacao: string,
    usuarioId: string,
    userIp?: string
  ): Promise<Observacao> {
    try {
      // Validate input
      if (!observacao || observacao.trim().length == 0) {
        throw new Error('Observação não pode estar vazia');
      }

      if (observacao.length > 1000) {
        throw new Error('Observação não pode ter mais de 1000 caracteres');
      }

      const _created = await observacoesRepository.createWithUser(
  _propostaId,
        observacao.trim(),
        usuarioId
      );

      // Log security event
      securityLogger.logEvent({
        type: SecurityEventType.DATA_ACCESS,
        severity: 'LOW',
        userId: usuarioId,
        userEmail: '',
        ipAddress: userIp || '',
        userAgent: '',
        endpoint: '/observacoes',
        success: true,
        details: { propostaId, action: 'CREATE' },
      });

      return created; }
    } catch (error) {
      console.error('[ObservacoesService] Error creating observacao:', error: unknown);
      throw error instanceof Error ? error : new Error('Erro ao criar observação');
    }
  }

  /**
   * Get paginated observacoes
   */
  async getObservacoesPaginated(
    page: number = 1,
    limit: number = 10,
    filters?: Record<string, any>
  ) {
    try {
      // Validate pagination params
      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 10;

      return await observacoesRepository.findPaginated(page, limit, filters); }
    } catch (error) {
      console.error('[ObservacoesService] Error fetching paginated observacoes:', error: unknown);
      throw new Error('Erro ao buscar observações paginadas');
    }
  }

  /**
   * Delete an observacao (soft delete)
   */
  async deleteObservacao(observacaoId: number, usuarioId: string, userIp?: string): Promise<void> {
    try {
      // Check if observacao exists
      const _observacao = await observacoesRepository.findById(observacaoId);
      if (!observacao) {
        throw new Error('Observação não encontrada');
      }

      // Check if user can delete (owner or admin)
      // This logic should be enhanced based on your permission system
      if (observacao.usuario_id !== usuarioId) {
        // Additional admin check could go here
        throw new Error('Sem permissão para deletar esta observação');
      }

      await observacoesRepository.softDelete(observacaoId, usuarioId);

      // Log security event
      securityLogger.logEvent({
        type: SecurityEventType.DATA_ACCESS,
        severity: 'MEDIUM',
        userId: usuarioId,
        userEmail: '',
        ipAddress: userIp || '',
        userAgent: '',
        endpoint: '/observacoes',
        success: true,
        details: { observacaoId, action: 'DELETE' },
      });
    } catch (error) {
      console.error(`[ObservacoesService] Error deleting observacao ${observacaoId}:`, error: unknown);
      throw error instanceof Error ? error : new Error('Erro ao deletar observação');
    }
  }

  /**
   * Update an observacao
   */
  async updateObservacao(
    observacaoId: number,
    observacao: string,
    usuarioId: string,
    userIp?: string
  ): Promise<Observacao> {
    try {
      // Validate input
      if (!observacao || observacao.trim().length == 0) {
        throw new Error('Observação não pode estar vazia');
      }

      if (observacao.length > 1000) {
        throw new Error('Observação não pode ter mais de 1000 caracteres');
      }

      // Check if observacao exists and user has permission
      const _existing = await observacoesRepository.findById(observacaoId);
      if (!existing) {
        throw new Error('Observação não encontrada');
      }

      if (existing.usuario_id !== usuarioId) {
        throw new Error('Sem permissão para editar esta observação');
      }

      const _updated = await observacoesRepository.update(observacaoId, {
        observacao: observacao.trim(),
        updated_at: new Date().toISOString(),
      });

      // Log security event
      securityLogger.logEvent({
        type: SecurityEventType.DATA_ACCESS,
        severity: 'LOW',
        userId: usuarioId,
        userEmail: '',
        ipAddress: userIp || '',
        userAgent: '',
        endpoint: '/observacoes',
        success: true,
        details: { observacaoId, action: 'UPDATE' },
      });

      return updated; }
    } catch (error) {
      console.error(`[ObservacoesService] Error updating observacao ${observacaoId}:`, error: unknown);
      throw error instanceof Error ? error : new Error('Erro ao atualizar observação');
    }
  }
}

// Export singleton instance
export const _observacoesService = new ObservacoesService();
