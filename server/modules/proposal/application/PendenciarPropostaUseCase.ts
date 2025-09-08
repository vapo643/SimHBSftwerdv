/**
 * Use Case: Pendenciar Proposta
 *
 * Implementação da funcionalidade de pendência para o fluxo do analista.
 * Este use case permite que analistas marquem propostas como pendentes
 * quando necessitam de documentação adicional ou esclarecimentos.
 *
 * Data: 2025-09-03
 * PAM V2.5 - OPERAÇÃO VISÃO CLARA - Missão P0
 */

import { IProposalRepository } from '../domain/IProposalRepository';
import { transitionTo, InvalidTransitionError } from '../../../services/statusFsmService';

export interface PendenciarPropostaRequest {
  propostaId: string;
  motivoPendencia: string;
  analistaId: string;
  observacoes?: string;
}

export interface PendenciarPropostaResponse {
  success: boolean;
  message: string;
  propostaId: string;
  novoStatus: string;
}

export class PendenciarPropostaUseCase {
  constructor(private readonly proposalRepository: IProposalRepository) {}

  async execute(request: PendenciarPropostaRequest): Promise<PendenciarPropostaResponse> {
    const { propostaId, motivoPendencia, analistaId, observacoes } = request;

    console.log(`[PENDENCIAR USE CASE] 🚀 Iniciando pendência para proposta ${propostaId}`);

    try {
      // 1. Validar proposta existe e buscar estado atual
      const proposta = await this.proposalRepository.findById(propostaId);

      if (!proposta) {
        throw new Error(`Proposta com ID ${propostaId} não encontrada`);
      }

      const statusAtual = proposta.status;
      console.log(`[PENDENCIAR USE CASE] 📊 Status atual: ${statusAtual}`);

      // 2. Validar se a proposta está em estado que permite pendência
      if (!['aguardando_analise', 'em_analise'].includes(statusAtual)) {
        throw new Error(
          `Não é possível pendenciar proposta com status '${statusAtual}'. Status deve ser 'aguardando_analise' ou 'em_analise'.`
        );
      }

      // 3. Validar parâmetros obrigatórios
      if (!motivoPendencia || motivoPendencia.trim().length === 0) {
        throw new Error('Motivo da pendência é obrigatório');
      }

      // 4. Aplicar transição FSM para 'pendenciado'
      console.log(`[PENDENCIAR USE CASE] 🔄 Aplicando transição FSM: ${statusAtual} → pendenciado`);

      await transitionTo({
        propostaId,
        novoStatus: 'pendenciado',
        userId: analistaId,
        contexto: 'geral',
        observacoes: observacoes || `Pendenciado pelo analista. Motivo: ${motivoPendencia}`,
        metadata: {
          motivoPendencia,
          analistaId,
          acao: 'pendenciar_proposta',
          timestamp: new Date().toISOString(),
        },
      });

      console.log(`[PENDENCIAR USE CASE] ✅ Transição aplicada com sucesso`);

      // 5. Buscar proposta atualizada para confirmar status
      const propostaAtualizada = await this.proposalRepository.findById(propostaId);
      if (!propostaAtualizada || !['pendente', 'pendenciado'].includes(propostaAtualizada.status)) {
        throw new Error('Falha na atualização do status da proposta');
      }

      console.log(`[PENDENCIAR USE CASE] 💾 Motivo da pendência salvo no banco`);

      // 6. Retornar resultado de sucesso
      return {
        success: true,
        message: 'Proposta pendenciada com sucesso',
        propostaId,
        novoStatus: 'pendenciado',
      };
    } catch (error: any) {
      console.error(`[PENDENCIAR USE CASE] ❌ Erro ao pendenciar proposta:`, error);

      // Buscar status atual para retorno de erro
      let currentStatus = 'unknown';
      try {
        const currentProposta = await this.proposalRepository.findById(propostaId);
        currentStatus = currentProposta?.status || 'unknown';
      } catch (statusError) {
        console.warn('[PENDENCIAR USE CASE] Não foi possível buscar status atual para erro');
      }

      // Tratar erros específicos da FSM
      if (error instanceof InvalidTransitionError) {
        return {
          success: false,
          message: `Transição inválida: ${error.message}`,
          propostaId,
          novoStatus: currentStatus,
        };
      }

      // Outros erros
      return {
        success: false,
        message: error.message || 'Erro interno ao pendenciar proposta',
        propostaId,
        novoStatus: currentStatus,
      };
    }
  }
}
