/**
 * Serviço de Máquina de Estados Finitos (FSM) para Propostas
 *
 * Este serviço centraliza toda a lógica de transição de status,
 * garantindo que apenas transições válidas de negócio possam ocorrer.
 *
 * Data: 19/08/2025
 * PAM V1.0 - Implementação da FSM
 */

import { updateStatusWithContext, StatusContexto } from '../lib/status-context-helper';
import { db, SYSTEM_USER_ID } from '../lib/supabase';
import { propostas } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { ProposalStatus } from '../modules/proposal/domain/Proposal';

/**
 * Classe de erro customizada para transições inválidas
 */
export class InvalidTransitionError extends Error {
  constructor(
    public readonly fromStatus: string,
    public readonly toStatus: string,
    message?: string
  ) {
    const errorMessage =
      message || `Transição inválida: não é permitido mudar de "${fromStatus}" para "${toStatus}"`;
    super(errorMessage);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Grafo de transições válidas entre status
 * Define todas as transições de negócio permitidas
 *
 * Baseado no fluxo de negócio real do sistema Simpix:
 * 1. Proposta começa em RASCUNHO
 * 2. Pode ser APROVADO ou REJEITADO
 * 3. Se aprovada, gera CCB
 * 4. CCB enviado para assinatura
 * 5. Após assinatura, boletos são emitidos
 * 6. Pagamento é autorizado
 * 7. Qualquer status pode ser SUSPENSA (exceto estados finais)
 */
const transitionGraph: Record<string, string[]> = {
  // Status inicial - pode ser aprovado, rejeitado, cancelado ou suspenso
  [ProposalStatus.RASCUNHO]: [
    ProposalStatus.EM_ANALISE,
    ProposalStatus.APROVADO,
    ProposalStatus.REJEITADO,
    ProposalStatus.CANCELADO,
    ProposalStatus.SUSPENSA,
  ],

  // Status de análise - podem ser aprovados, rejeitados, pendenciados ou suspensos

  [ProposalStatus.EM_ANALISE]: [
    ProposalStatus.APROVADO,
    ProposalStatus.REJEITADO,
    ProposalStatus.PENDENCIADO,
    ProposalStatus.SUSPENSA,
  ],

  // Estados pendenciados podem voltar para análise ou serem aprovados/rejeitados
  [ProposalStatus.PENDENCIADO]: [
    ProposalStatus.EM_ANALISE,
    ProposalStatus.APROVADO,
    ProposalStatus.REJEITADO,
    ProposalStatus.SUSPENSA,
  ],

  // Aprovado - próximo passo é gerar CCB, aguardar documentação ou cancelar
  // NÃO pode voltar para REJEITADO após aprovação (regra de negócio)
  [ProposalStatus.APROVADO]: [
    ProposalStatus.CCB_GERADA,
    ProposalStatus.CANCELADO,
    ProposalStatus.SUSPENSA,
  ],

  // CCB gerada - enviada para assinatura
  [ProposalStatus.CCB_GERADA]: [ProposalStatus.AGUARDANDO_ASSINATURA, ProposalStatus.SUSPENSA],

  // Aguardando assinatura - pode ser assinada ou suspensa
  [ProposalStatus.AGUARDANDO_ASSINATURA]: [
    ProposalStatus.ASSINATURA_CONCLUIDA,
    ProposalStatus.SUSPENSA,
  ],

  // Assinatura concluída - boletos são emitidos
  [ProposalStatus.ASSINATURA_CONCLUIDA]: [ProposalStatus.BOLETOS_EMITIDOS, ProposalStatus.SUSPENSA],

  // Boletos emitidos - aguardando autorização de pagamento
  [ProposalStatus.BOLETOS_EMITIDOS]: [ProposalStatus.PAGAMENTO_AUTORIZADO, ProposalStatus.SUSPENSA],

  // Estados finais - não podem transicionar
  [ProposalStatus.PAGAMENTO_AUTORIZADO]: [], // Estado final de sucesso
  [ProposalStatus.REJEITADO]: [], // Estado final de rejeição
  [ProposalStatus.CANCELADO]: [], // Estado final de cancelamento

  // Suspensa pode voltar para qualquer estado anterior (exceto finais)
  [ProposalStatus.SUSPENSA]: [
    ProposalStatus.RASCUNHO,
    ProposalStatus.APROVADO,
    ProposalStatus.CCB_GERADA,
    ProposalStatus.AGUARDANDO_ASSINATURA,
    ProposalStatus.ASSINATURA_CONCLUIDA,
    ProposalStatus.BOLETOS_EMITIDOS,
    // Status canônicos apenas
  ],
};

/**
 * Interface para os parâmetros da transição
 */
interface TransitionParams {
  propostaId: string;
  novoStatus: string;
  userId: string;
  contexto?: StatusContexto;
  observacoes?: string;
  metadata?: Record<string, any>;
}

/**
 * Valida se uma transição de status é permitida
 */
export function validateTransition(fromStatus: string, toStatus: string): boolean {
  const allowedTransitions = transitionGraph[fromStatus];

  // Se não há regras definidas para o status atual, não permite transição
  if (!allowedTransitions) {
    console.warn(`[FSM] Status não mapeado no grafo: ${fromStatus}`);
    return false;
  }

  return allowedTransitions.includes(toStatus);
}

// Alias para compatibilidade interna
const isTransitionValid = validateTransition;

/**
 * Função principal para realizar transição de status com validação FSM
 *
 * @param params - Parâmetros da transição
 * @throws {InvalidTransitionError} Se a transição não for permitida
 * @throws {Error} Se a proposta não for encontrada ou houver erro no banco
 */
export async function transitionTo(params: TransitionParams): Promise<void> {
  const { propostaId, novoStatus, userId, contexto = 'geral', observacoes, metadata } = params;

  console.log(`[FSM] 🚀 Iniciando transição para proposta ${propostaId}`);
  console.log(`[FSM] 📊 Novo status desejado: ${novoStatus}`);

  try {
    // Verificar se db está disponível
    if (!db) {
      throw new Error('Database connection not available');
    }

    // 1. Buscar o estado atual da proposta
    const [propostaAtual] = await db
      .select({
        id: propostas.id,
        status: propostas.status,
      })
      .from(propostas)
      .where(eq(propostas.id, propostaId))
      .limit(1);

    // Validar se a proposta existe
    if (!propostaAtual) {
      throw new Error(`Proposta ${propostaId} não encontrada no banco de dados`);
    }

    const statusAtual = propostaAtual.status;
    console.log(`[FSM] 📍 Status atual: ${statusAtual}`);

    // 2. Se o status não mudou, não fazer nada
    if (statusAtual === novoStatus) {
      console.log(`[FSM] ℹ️ Status já está em ${novoStatus}, nenhuma transição necessária`);
      return;
    }

    // 3. Validar se a transição é permitida
    if (!isTransitionValid(statusAtual, novoStatus)) {
      console.error(`[FSM] ❌ Transição inválida: ${statusAtual} → ${novoStatus}`);
      throw new InvalidTransitionError(
        statusAtual,
        novoStatus,
        `A transição de "${statusAtual}" para "${novoStatus}" não é permitida pelas regras de negócio`
      );
    }

    console.log(`[FSM] ✅ Transição válida: ${statusAtual} → ${novoStatus}`);

    // 4. Delegar a escrita para updateStatusWithContext
    console.log(`[FSM] 📝 Delegando escrita para updateStatusWithContext`);

    const result = await updateStatusWithContext({
      propostaId,
      novoStatus,
      contexto,
      userId,
      observacoes: observacoes || `Transição FSM: ${statusAtual} → ${novoStatus}`,
      metadata: {
        ...metadata,
        fsmTransition: {
          from: statusAtual,
          to: novoStatus,
          timestamp: new Date().toISOString(),
          validatedBy: 'FSM',
        },
      },
    });

    if (!result.success) {
      throw new Error(`Falha ao atualizar status: ${result.error}`);
    }

    console.log(`[FSM] ✅ Transição concluída com sucesso`);
  } catch (error) {
    // Re-lançar InvalidTransitionError sem modificação
    if (error instanceof InvalidTransitionError) {
      throw error;
    }

    // Encapsular outros erros
    console.error(`[FSM] ❌ Erro durante transição:`, error);
    throw new Error(
      `Erro ao processar transição de status: ${
        error instanceof Error ? error.message : 'Erro desconhecido'
      }`
    );
  }
}

/**
 * Função auxiliar para obter as transições possíveis a partir de um status
 */
export function getPossibleTransitions(fromStatus: string): string[] {
  return transitionGraph[fromStatus] || [];
}

/**
 * Função auxiliar para verificar se um status é final (sem transições possíveis)
 */
export function isFinalStatus(status: string): boolean {
  const transitions = transitionGraph[status];
  return Array.isArray(transitions) && transitions.length === 0;
}

/**
 * Função auxiliar para obter informações sobre o grafo de transições
 */
export function getTransitionGraphInfo() {
  return {
    totalStates: Object.keys(transitionGraph).length,
    finalStates: Object.keys(transitionGraph).filter(isFinalStatus),
    graph: transitionGraph,
  };
}

// Exportar também o grafo para testes e documentação
export { transitionGraph };

// ============================================
// NOVA CLASSE ROBUSTA PROPOSTA PELO DEEPTHINK
// ============================================

// Mapeamento canônico usando ProposalStatus (CORRIGIDO para permitir ClickSign)
const STATUS_TRANSITIONS = {
  'RASCUNHO': ['EM_ANALISE', 'REJEITADA'],
  'EM_ANALISE': ['APROVADO', 'REJEITADA', 'PENDENTE'],
  'PENDENTE': ['EM_ANALISE', 'REJEITADA'],
  'APROVADO': ['CCB_GERADA', 'REJEITADA'],
  'CCB_GERADA': ['AGUARDANDO_ASSINATURA', 'ASSINATURA_CONCLUIDA', 'REJEITADA'], // CORREÇÃO CRÍTICA
  'AGUARDANDO_ASSINATURA': ['ASSINATURA_CONCLUIDA', 'REJEITADA'], // NOVA TRANSIÇÃO
  'ASSINATURA_CONCLUIDA': ['BOLETOS_EMITIDOS', 'REJEITADA'],
  'BOLETOS_EMITIDOS': ['FINALIZADA'],
  'REJEITADA': ['FINALIZADA'],
  'FINALIZADA': [] // Estado final
};

// Normalização de status para evitar problemas de casing
function normalizeStatus(status: string): string {
  return status.toUpperCase().replace(/-/g, '_');
}

export class StatusFSMService {
  private readonly maxRetries = 3;
  private readonly lockTimeout = 5000; // 5 segundos

  async processStatusTransition(
    propostaId: string,
    newStatus: string,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`[FSM] 🚀 Iniciando transição para proposta ${propostaId}`);
    console.log(`[FSM] 📊 Novo status desejado: ${newStatus}`);

    // Normaliza o status para evitar problemas de casing
    const normalizedNewStatus = normalizeStatus(newStatus);
    
    // Garante userId válido ou usa SYSTEM_USER_ID (corrige problema crítico de UUID)
    const validUserId = (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))
      ? userId 
      : SYSTEM_USER_ID;
    
    console.log(`[FSM] 👤 Using userId: ${validUserId}`);
    
    // Retry logic com exponential backoff
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Verifica se db está disponível
        if (!db) {
          throw new Error('Database connection not available');
        }
        
        // Usa transação com lock pessimista
        const result = await db.transaction(async (tx) => {
          // 1. Obtém proposta com lock FOR UPDATE
          const [proposta] = await tx
            .select()
            .from(propostas)
            .where(eq(propostas.id, propostaId))
            .for('update')
            .execute();

          if (!proposta) {
            throw new Error(`Proposta ${propostaId} não encontrada no banco de dados`);
          }

          const currentStatus = normalizeStatus(proposta.status);
          console.log(`[FSM] 📍 Status atual: ${currentStatus}`);

          // 2. Valida transição
          if (currentStatus === normalizedNewStatus) {
            console.log(`[FSM] ✅ Status já está em ${normalizedNewStatus}, nada a fazer`);
            return { success: true, data: proposta, noChange: true };
          }

          const allowedTransitions = (STATUS_TRANSITIONS as any)[currentStatus] || [];
          if (!allowedTransitions.includes(normalizedNewStatus)) {
            throw new Error(
              `Transição não permitida: ${currentStatus} → ${normalizedNewStatus}. ` +
              `Transições permitidas: ${allowedTransitions.join(', ')}`
            );
          }

          // 3. Executa hooks pré-transição
          await this.executePreTransitionHooks(currentStatus, normalizedNewStatus, proposta, metadata);

          // 4. Atualiza status com timestamp
          const updatedAt = new Date();
          const [updatedProposta] = await tx
            .update(propostas)
            .set({
              status: normalizedNewStatus,
              updatedAt
            })
            .where(eq(propostas.id, propostaId))
            .returning();

          // 5. Registra no histórico (placeholder - implementar quando necessário)
          console.log(`[FSM] 📝 Histórico: ${currentStatus} → ${normalizedNewStatus} para ${propostaId}`);

          // 6. Executa hooks pós-transição
          await this.executePostTransitionHooks(
            currentStatus, 
            normalizedNewStatus, 
            updatedProposta, 
            metadata
          );

          console.log(`[FSM] ✅ Transição concluída: ${currentStatus} → ${normalizedNewStatus}`);
          return { success: true, data: updatedProposta };
        });

        // Se chegou aqui, transação foi bem-sucedida
        return result;

      } catch (error) {
        console.error(`[FSM] ❌ Tentativa ${attempt + 1} falhou:`, error);
        
        if (attempt === this.maxRetries - 1) {
          // Última tentativa falhou
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          };
        }

        // Aguarda antes de tentar novamente (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return {
      success: false,
      error: 'Máximo de tentativas excedido'
    };
  }

  private async executePreTransitionHooks(
    fromStatus: string,
    toStatus: string,
    proposta: any,
    metadata?: any
  ): Promise<void> {
    // Validações específicas por transição
    
    if (toStatus === 'CCB_GERADA') {
      // Valida se todos os documentos necessários foram enviados
      if (!proposta.documentosCompletos) {
        throw new Error('Documentação incompleta para gerar CCB');
      }
    }

    if (toStatus === 'ASSINATURA_CONCLUIDA') {
      // Valida se existe documento na ClickSign
      if (!metadata?.clicksignDocumentKey && !proposta.clicksignDocumentKey) {
        throw new Error('Documento não encontrado na ClickSign');
      }
    }

    if (toStatus === 'CONCLUIDA') {
      // Valida se assinatura foi concluída
      if (fromStatus !== 'ASSINATURA_CONCLUIDA') {
        throw new Error('Proposta precisa ter assinatura concluída antes de ser marcada como concluída');
      }
    }
  }

  private async executePostTransitionHooks(
    fromStatus: string,
    toStatus: string,
    proposta: any,
    metadata?: any
  ): Promise<void> {
    // Ações após transição bem-sucedida
    
    if (toStatus === 'ASSINATURA_CONCLUIDA') {
      // Trigger integração com Banco Inter
      await this.triggerInterBankIntegration(proposta.id);
    }

    if (toStatus === 'CONCLUIDA') {
      // Envia notificações
      await this.sendCompletionNotifications(proposta);
    }

    if (toStatus === 'CANCELADA' || toStatus === 'REPROVADA') {
      // Limpa recursos alocados
      await this.cleanupProposalResources(proposta.id);
    }
  }

  private async triggerInterBankIntegration(propostaId: string): Promise<void> {
    try {
      console.log(`[FSM] 🏦 Triggering Inter Bank integration for ${propostaId}`);
      // Implementação da integração com Banco Inter
      // Este é um placeholder - implemente conforme sua lógica
    } catch (error) {
      console.error('[FSM] ❌ Inter Bank integration failed:', error);
      // Não falha a transação, mas registra o erro
    }
  }

  private async sendCompletionNotifications(proposta: any): Promise<void> {
    try {
      console.log(`[FSM] 📧 Sending completion notifications for ${proposta.id}`);
      // Implementação de notificações
    } catch (error) {
      console.error('[FSM] ❌ Notification sending failed:', error);
    }
  }

  private async cleanupProposalResources(propostaId: string): Promise<void> {
    try {
      console.log(`[FSM] 🧹 Cleaning up resources for ${propostaId}`);
      // Limpa arquivos temporários, cancela jobs pendentes, etc.
    } catch (error) {
      console.error('[FSM] ❌ Resource cleanup failed:', error);
    }
  }
}
