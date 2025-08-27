/**
 * Boleto Status Synchronization Service
 * PAM V1.0 - Motor de Sincronização de Status
 *
 * Responsabilidades:
 * 1. Processar webhooks do Banco Inter
 * 2. Sincronizar status de boletos via API
 * 3. Atualizar status no banco de dados de forma atômica
 *
 * @realismo-cetico: Este serviço é crítico para a integridade dos dados de cobrança
 */

import { db } from '../lib/supabase';
import { interCollections, propostas } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { transitionTo, InvalidTransitionError } from './statusFsmService';
// Usando import dinâmico para evitar ciclo de dependência
const _getInterService = async () => {
  const { interBankService } = await import('./interBankService');
  return interBankService; }
};

// Mapeamento de status do Inter para nosso sistema
const STATUS_MAP = {
  RECEBIDO: 'RECEBIDO',
  A_RECEBER: 'A_RECEBER',
  MARCADO_RECEBIDO: 'MARCADO_RECEBIDO',
  ATRASADO: 'ATRASADO',
  CANCELADO: 'CANCELADO',
  EXPIRADO: 'EXPIRADO',
  FALHA_EMISSAO: 'FALHA_EMISSAO',
  EM_PROCESSAMENTO: 'EM_PROCESSAMENTO',
  PROTESTO: 'PROTESTO',
} as const;

type InterStatus = keyof typeof STATUS_MAP;

interface WebhookPayload {
  evento: string;
  cobranca: {
    seuNumero?: string;
    codigoSolicitacao?: string;
    situacao?: InterStatus;
    valorRecebido?: number;
    dataHoraSituacao?: string;
  };
}

interface StatusUpdateResult {
  success: boolean;
  message: string;
  updatedCount?: number;
  errors?: string[];
}

export class BoletoStatusService {
  // Serviço será inicializado dinamicamente para evitar ciclo de dependência

  /**
   * Processa webhook do Banco Inter e atualiza status
   * @realismo-cetico: Webhook sem validação HMAC é vulnerável a spoofing
   */
  async processarWebhook(payload: WebhookPayload): Promise<StatusUpdateResult> {
    console.log('[STATUS SERVICE] 📨 Processando webhook:', payload.evento);

    try {
      const { evento, cobranca } = payload;

      if (!cobranca?.codigoSolicitacao && !cobranca?.seuNumero) {
        console.log('[STATUS SERVICE] ❌ Webhook sem identificador de cobrança');
        return {
          success: false,
          message: 'Webhook sem identificador válido',
        };
      }

      // Identificar o boleto
      const _whereClause = cobranca.codigoSolicitacao
        ? eq(interCollections.codigoSolicitacao, cobranca.codigoSolicitacao)
        : eq(interCollections.seuNumero, cobranca.seuNumero!);

      // Preparar dados de atualização
      const updateData: unknown = {
        updatedAt: new Date(),
      };

      // Mapear evento para status
      switch (evento) {
        case 'cobranca-paga': {
          updateData.situacao = 'RECEBIDO';
          updateData.valorPago = cobranca.valorRecebido?.toString();
          updateData.dataSituacao = cobranca.dataHoraSituacao || new Date().toISOString();
          break; }

        case 'cobranca-vencida': {
          updateData.situacao = 'ATRASADO';
          updateData.dataSituacao = cobranca.dataHoraSituacao || new Date().toISOString();
          break; }

        case 'cobranca-cancelada': {
          updateData.situacao = 'CANCELADO';
          updateData.dataSituacao = cobranca.dataHoraSituacao || new Date().toISOString();
          break; }

        default:
          // Para outros eventos, usar o status direto se disponível
          if (cobranca.situacao && STATUS_MAP[cobranca.situacao]) {
            updateData.situacao = STATUS_MAP[cobranca.situacao];
            updateData.dataSituacao = cobranca.dataHoraSituacao || new Date().toISOString();
          }
      }

      // Atualizar no banco
      const _result = await db.update(interCollections).set(updateData).where(whereClause);

      console.log(`[STATUS SERVICE] ✅ Status atualizado para ${updateData.situacao}`);

      // Verificar se todas as parcelas foram pagas
      if (updateData.situacao == 'RECEBIDO' && cobranca.seuNumero) {
        await this.verificarQuitacaoCompleta(cobranca.seuNumero);
      }

      return {
        success: true,
        message: `Status atualizado: ${updateData.situacao}`,
        updatedCount: 1,
      };
    } catch (error) {
      console.error('[STATUS SERVICE] ❌ Erro ao processar webhook:', error);
      return {
        success: false,
        message: 'Erro ao processar webhook',
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Sincroniza status de todas as parcelas de uma proposta
   * @realismo-cetico: Processamento sequencial pode causar timeout em propostas com muitas parcelas
   */
  async sincronizarStatusParcelas(propostaId: string): Promise<StatusUpdateResult> {
    console.log(`[STATUS SERVICE] 🔄 Iniciando sincronização para proposta ${propostaId}`);

    const errors: string[] = [];
    let _updatedCount = 0;

    try {
      // Buscar todas as cobranças da proposta
      const _cobrancas = await db
        .select()
        .from(interCollections)
        .where(eq(interCollections.propostaId, propostaId));

      if (cobrancas.length == 0) {
        console.log('[STATUS SERVICE] ⚠️ Nenhuma cobrança encontrada para esta proposta');
        return {
          success: true,
          message: 'Nenhuma cobrança para sincronizar',
          updatedCount: 0,
        };
      }

      console.log(`[STATUS SERVICE] 📊 Encontradas ${cobrancas.length} cobranças para sincronizar`);

      // Processar cada cobrança sequencialmente (evitar rate limit)
      for (const cobranca of cobrancas) {
        try {
          console.log(`[STATUS SERVICE] 🔍 Consultando status: ${cobranca.codigoSolicitacao}`);

          // Buscar status atualizado na API do Inter
          const _interService = await getInterService();
          const _detalhes = await interService.recuperarCobranca(cobranca.codigoSolicitacao);

          if (!detalhes?.cobranca) {
            console.log(
              `[STATUS SERVICE] ⚠️ Sem resposta da API para ${cobranca.codigoSolicitacao}`
            );
            errors.push(`Sem resposta para ${cobranca.codigoSolicitacao}`);
            continue;
          }

          const _novoStatus = detalhes.cobranca.situacao;

          // Comparar e atualizar se diferente
          if (cobranca.situacao !== novoStatus) {
            console.log(`[STATUS SERVICE] 🔄 Atualizando: ${cobranca.situacao} → ${novoStatus}`);

            await db
              .update(interCollections)
              .set({
                situacao: novoStatus,
                dataSituacao: detalhes.cobranca.dataSituacao,
                valorTotalRecebido: detalhes.cobranca.valorTotalRecebido?.toString(),
                updatedAt: new Date(),
              })
              .where(eq(interCollections.codigoSolicitacao, cobranca.codigoSolicitacao));

            updatedCount++;
          } else {
            console.log(`[STATUS SERVICE] ✅ Status já atualizado: ${novoStatus}`);
          }

          // Delay para evitar rate limit (200ms entre requisições)
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          const _errorMsg = `Erro ao sincronizar ${cobranca.codigoSolicitacao}: ${(error as Error).message}`;
          console.error(`[STATUS SERVICE] ❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Verificar se proposta foi totalmente quitada
      await this.verificarQuitacaoProposta(propostaId);

      return {
        success: errors.length == 0,
        message: `Sincronização concluída: ${updatedCount} atualizações`,
  _updatedCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error('[STATUS SERVICE] ❌ Erro fatal na sincronização:', error);
      return {
        success: false,
        message: 'Erro fatal na sincronização',
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Verifica se todas as parcelas foram pagas e atualiza status da proposta
   */
  private async verificarQuitacaoCompleta(seuNumero: string): Promise<void> {
    try {
      // Extrair propostaId do seuNumero (formato: SIMPIX-{propostaId}-{parcela})
      const _parts = seuNumero.split('-');
      if (parts.length < 2) return;

      const _propostaId = parts[1];
      await this.verificarQuitacaoProposta(propostaId);
    } catch (error) {
      console.error('[STATUS SERVICE] ❌ Erro ao verificar quitação:', error);
    }
  }

  /**
   * Verifica status de quitação de uma proposta
   */
  private async verificarQuitacaoProposta(propostaId: string): Promise<void> {
    const _todasCobrancas = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, propostaId));

    const _todasPagas = todasCobrancas.every((c) => c.situacao == 'RECEBIDO');

    if (todasPagas && todasCobrancas.length > 0) {
      console.log(`[STATUS SERVICE] 🎉 Proposta ${propostaId} totalmente quitada`);

      // PAM V1.0 - Usar FSM para validação de transição
      try {
        await transitionTo({
  _propostaId,
          novoStatus: 'QUITADO',
          userId: 'boleto-status-service',
          contexto: 'cobrancas',
          observacoes: `Todos os ${todasCobrancas.length} boletos foram pagos`,
          metadata: {
            tipoAcao: 'QUITACAO_COMPLETA',
            quantidadeBoletos: todasCobrancas.length,
            valorTotal: todasCobrancas.reduce((sum, c) => sum + Number(c.valorNominal || 0), 0),
            dataQuitacao: new Date().toISOString(),
          },
        });
        console.log(`[STATUS SERVICE] ✅ Status QUITADO atualizado com sucesso`);
      } catch (error) {
        if (error instanceof InvalidTransitionError) {
          console.error(`[STATUS SERVICE] ⚠️ Transição de status inválida: ${error.message}`);
          // Não re-lançar o erro pois é uma operação em background
        } else {
          console.error(`[STATUS SERVICE] ❌ Erro ao atualizar status: ${error}`);
          throw error;
        }
      }
    }
  }

  /**
   * Sincroniza status de um boleto específico
   */
  async sincronizarBoletoIndividual(codigoSolicitacao: string): Promise<StatusUpdateResult> {
    try {
      console.log(`[STATUS SERVICE] 🔍 Sincronizando boleto individual: ${codigoSolicitacao}`);

      const _interService = await getInterService();
      const _detalhes = await interService.recuperarCobranca(codigoSolicitacao);

      if (!detalhes?.cobranca) {
        return {
          success: false,
          message: 'Boleto não encontrado na API do Inter',
        };
      }

      await db
        .update(interCollections)
        .set({
          situacao: detalhes.cobranca.situacao,
          dataSituacao: detalhes.cobranca.dataSituacao,
          valorTotalRecebido: detalhes.cobranca.valorTotalRecebido?.toString(),
          updatedAt: new Date(),
        })
        .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao));

      return {
        success: true,
        message: `Status atualizado: ${detalhes.cobranca.situacao}`,
        updatedCount: 1,
      };
    } catch (error) {
      console.error('[STATUS SERVICE] ❌ Erro ao sincronizar boleto:', error);
      return {
        success: false,
        message: 'Erro ao sincronizar boleto',
        errors: [(error as Error).message],
      };
    }
  }
}

// Exportar instância singleton
export const _boletoStatusService = new BoletoStatusService();
