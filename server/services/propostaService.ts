/**
 * Proposta Service
 * Business logic layer for proposta operations
 * Following Clean Architecture principles - separates business logic from controllers
 */

import {
  propostaRepository,
  Proposta,
  PropostaWithDetails,
} from '../repositories/proposta.repository';
import { transitionTo, InvalidTransitionError } from './statusFsmService';

export interface PropostaToggleStatusRequest {
  propostaId: string;
  userId: string;
  userRole: string;
}

export interface PropostaToggleStatusResponse {
  success: boolean;
  propostaId: string;
  statusAnterior: string;
  statusNovo: string;
  message: string;
}

export interface CcbAssinadaResponse {
  url?: string;
  clicksignDocumentId?: string;
  nome: string;
  status: string;
  dataAssinatura?: string | null;
  fonte: string;
  message?: string;
  caminho?: string;
}

export class PropostaService {
  private readonly statusSuspensiveis = [
    'rascunho',
    'aguardando_analise',
    'em_analise',
    'pendente',
  ];

  /**
   * Toggle proposta status between active and suspended
   */
  async togglePropostaStatus(
    request: PropostaToggleStatusRequest
  ): Promise<PropostaToggleStatusResponse> {
    const { propostaId, userId, userRole } = request;

    // 1. Fetch current proposta
    const proposta = await propostaRepository.getPropostaById(propostaId);

    if (!proposta) {
      throw new Error('Proposta não encontrada');
    }

    // 2. Check permissions
    if (userRole !== 'ADMINISTRADOR' && proposta.userId !== userId) {
      throw new Error('Você não tem permissão para alterar o status desta proposta');
    }

    // 3. Validate if proposta can be suspended/reactivated
    if (!this.statusSuspensiveis.includes(proposta.status) && proposta.status !== 'suspensa') {
      throw new Error('Esta proposta não pode ser suspensa/reativada no status atual');
    }

    // 4. Determine new status
    const novoStatus = proposta.status === 'suspensa' ? 'aguardando_analise' : 'suspensa';

    // 5. Use FSM for status transition validation
    try {
      await transitionTo({
        propostaId,
        novoStatus,
        userId: userId || 'sistema',
        contexto: 'geral',
        observacoes: `Status ${novoStatus === 'suspensa' ? 'suspenso' : 'reativado'} pelo usuário`,
        metadata: {
          tipoAcao: novoStatus === 'suspensa' ? 'SUSPENDER_PROPOSTA' : 'REATIVAR_PROPOSTA',
          statusAnterior: proposta.status,
          usuarioRole: userRole || 'desconhecido',
          motivoSuspensao: novoStatus === 'suspensa' ? 'Ação manual do usuário' : null,
        },
      });
    } catch (error) {
      if (error instanceof InvalidTransitionError) {
        throw new Error(error.message);
      }
      throw new Error('Erro ao atualizar status da proposta');
    }

    // 6. Create communication log
    await propostaRepository.createCommunicationLog({
      proposta_id: propostaId,
      usuario_id: userId,
      tipo: 'status_change',
      mensagem: `Status alterado de ${proposta.status} para ${novoStatus}`,
    });

    return {
      success: true,
      propostaId,
      statusAnterior: proposta.status,
      statusNovo: novoStatus,
      message:
        novoStatus === 'suspensa'
          ? 'Proposta suspensa com sucesso'
          : 'Proposta reativada com sucesso',
    };
  }

  /**
   * Get signed CCB URL for a proposta
   */
  async getCcbAssinada(propostaId: string): Promise<CcbAssinadaResponse> {
    console.log(`[CCB] Buscando CCB para proposta: ${propostaId}`);

    // Fetch proposta with ClickSign data
    const proposta = await propostaRepository.getPropostaById(propostaId);

    if (!proposta) {
      throw new Error('Proposta não encontrada');
    }

    console.log(`[CCB] Proposta encontrada. Caminho CCB: ${proposta.caminhoCcbAssinado}`);

    // PRIORITY 1: Use caminho_ccb_assinado if available
    if (proposta.caminhoCcbAssinado) {
      try {
        console.log(`[CCB] Tentando gerar URL para caminho: ${proposta.caminhoCcbAssinado}`);

        const signedUrl = await propostaRepository.generateCcbSignedUrl(
          proposta.caminhoCcbAssinado
        );

        if (signedUrl) {
          console.log(`[CCB] ✅ URL assinada gerada com sucesso`);
          return {
            url: signedUrl,
            nome: `CCB_${proposta.clienteNome}_${propostaId}.pdf`,
            status: 'assinado',
            dataAssinatura: proposta.dataAprovacao,
            fonte: 'storage',
            caminho: proposta.caminhoCcbAssinado,
          };
        }
      } catch (error) {
        console.error('[CCB] Erro ao buscar CCB pelo caminho salvo:', error);
      }
    }

    // PRIORITY 2: Try legacy path for compatibility
    try {
      const legacyPath = `proposta-${propostaId}/ccb-assinada.pdf`;
      console.log(`[CCB] Tentando caminho legado: ${legacyPath}`);

      const signedUrl = await propostaRepository.generateCcbSignedUrl(legacyPath);

      if (signedUrl) {
        console.log(`[CCB] ✅ URL legada gerada com sucesso`);
        return {
          url: signedUrl,
          nome: `CCB_${proposta.clienteNome}_${propostaId}.pdf`,
          status: 'assinado',
          dataAssinatura: proposta.dataAprovacao,
          fonte: 'storage_legado',
        };
      }
    } catch (error) {
      console.error('[CCB] Erro ao buscar no Storage legado:', error);
    }

    // PRIORITY 3: ClickSign as fallback
    if (proposta.clicksignDocumentKey) {
      console.log(`[CCB] Usando ClickSign como fallback: ${proposta.clicksignDocumentKey}`);
      return {
        clicksignDocumentId: proposta.clicksignDocumentKey,
        nome: `CCB_${proposta.clienteNome}_${propostaId}.pdf`,
        status: 'assinado',
        dataAssinatura: proposta.dataAprovacao,
        fonte: 'clicksign',
        message: 'Documento disponível no ClickSign. Acesse sua conta para visualizar.',
      };
    }

    // CCB not found
    console.log(`[CCB] ❌ CCB não encontrada para proposta ${propostaId}`);

    const debugInfo = {
      propostaId,
      caminhosSalvos: proposta.caminhoCcbAssinado,
      clicksignKey: proposta.clicksignDocumentKey,
      ccbGerado: proposta.ccbGerado,
      assinaturaConcluida: proposta.assinaturaEletronicaConcluida,
    };

    throw new Error(
      `CCB assinada não encontrada. Verifique se o documento foi processado corretamente. Debug: ${JSON.stringify(debugInfo)}`
    );
  }

  /**
   * Get propostas by status
   */
  async getPropostasByStatus(status: string): Promise<Proposta[]> {
    return await propostaRepository.getPropostasByStatus(status);
  }

  /**
   * Get propostas by user
   */
  async getPropostasByUser(userId: string): Promise<Proposta[]> {
    return await propostaRepository.getPropostasByUser(userId);
  }

  /**
   * Get propostas by loja
   */
  async getPropostasByLoja(lojaId: number): Promise<Proposta[]> {
    return await propostaRepository.getPropostasByLoja(lojaId);
  }

  /**
   * Get propostas pending signature
   */
  async getPropostasPendingSignature(): Promise<Proposta[]> {
    return await propostaRepository.getPropostasPendingSignature();
  }

  /**
   * Update CCB path for a proposta
   */
  async updateCcbPath(propostaId: string, ccbPath: string): Promise<void> {
    await propostaRepository.updateCcbPath(propostaId, ccbPath);
  }

  /**
   * Mark CCB as generated
   */
  async markCcbGenerated(propostaId: string): Promise<void> {
    await propostaRepository.markCcbGenerated(propostaId);
  }

  /**
   * Mark signature as completed
   */
  async markSignatureCompleted(propostaId: string, clicksignKey?: string): Promise<void> {
    await propostaRepository.markSignatureCompleted(propostaId, clicksignKey);
  }

  /**
   * Get proposta with full details
   */
  async getPropostaWithDetails(propostaId: string): Promise<PropostaWithDetails | null> {
    return await propostaRepository.getPropostaWithDetails(propostaId);
  }
}

// Export singleton instance
export const propostaService = new PropostaService();
