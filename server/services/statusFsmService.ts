/**
 * Serviço de Máquina de Estados Finitos (FSM) para Propostas
 * 
 * Este serviço centraliza toda a lógica de transição de status,
 * garantindo que apenas transições válidas de negócio possam ocorrer.
 * 
 * Data: 19/08/2025
 * PAM V1.0 - Implementação da FSM
 */

import { updateStatusWithContext, StatusContexto } from "../lib/status-context-helper";
import { db } from "../lib/supabase";
import { propostas } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Enum dos status ativos do sistema
 * Baseado na auditoria de status realizada em 19/08/2025
 * Valores expandidos para compatibilidade com testes
 */
export enum ProposalStatus {
  RASCUNHO = "rascunho",
  APROVADO = "aprovado",
  REJEITADO = "rejeitado",
  CCB_GERADA = "CCB_GERADA",
  AGUARDANDO_ASSINATURA = "AGUARDANDO_ASSINATURA",
  ASSINATURA_CONCLUIDA = "ASSINATURA_CONCLUIDA",
  BOLETOS_EMITIDOS = "BOLETOS_EMITIDOS",
  PAGAMENTO_AUTORIZADO = "pagamento_autorizado",
  SUSPENSA = "suspensa",
  
  // Status adicionais para compatibilidade com testes
  AGUARDANDO_DOCUMENTACAO = "aguardando_documentacao",
  DOCUMENTACAO_COMPLETA = "documentacao_completa", 
  ASSINATURA_PENDENTE = "assinatura_pendente",
  CANCELADO = "cancelado",
  PAGO_TOTAL = "pago",
  AGUARDANDO_PAGAMENTO = "aguardando_pagamento"
}

/**
 * Classe de erro customizada para transições inválidas
 */
export class InvalidTransitionError extends Error {
  constructor(
    public readonly fromStatus: string,
    public readonly toStatus: string,
    message?: string
  ) {
    const errorMessage = message || 
      `Transição inválida: não é permitido mudar de "${fromStatus}" para "${toStatus}"`;
    super(errorMessage);
    this.name = "InvalidTransitionError";
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
    ProposalStatus.APROVADO,
    ProposalStatus.REJEITADO,
    ProposalStatus.CANCELADO,
    ProposalStatus.SUSPENSA
  ],
  
  // Aprovado - próximo passo é gerar CCB, aguardar documentação ou cancelar
  // NÃO pode voltar para REJEITADO após aprovação (regra de negócio)
  [ProposalStatus.APROVADO]: [
    ProposalStatus.CCB_GERADA,
    ProposalStatus.AGUARDANDO_DOCUMENTACAO,
    ProposalStatus.CANCELADO,
    ProposalStatus.SUSPENSA
  ],
  
  // CCB gerada - enviada para assinatura
  [ProposalStatus.CCB_GERADA]: [
    ProposalStatus.AGUARDANDO_ASSINATURA,
    ProposalStatus.SUSPENSA
  ],
  
  // Aguardando assinatura - pode ser assinada ou suspensa
  [ProposalStatus.AGUARDANDO_ASSINATURA]: [
    ProposalStatus.ASSINATURA_CONCLUIDA,
    ProposalStatus.SUSPENSA
  ],
  
  // Assinatura concluída - boletos são emitidos
  [ProposalStatus.ASSINATURA_CONCLUIDA]: [
    ProposalStatus.BOLETOS_EMITIDOS,
    ProposalStatus.SUSPENSA
  ],
  
  // Boletos emitidos - aguardando autorização de pagamento
  [ProposalStatus.BOLETOS_EMITIDOS]: [
    ProposalStatus.PAGAMENTO_AUTORIZADO,
    ProposalStatus.SUSPENSA
  ],
  
  // Status de documentação
  [ProposalStatus.AGUARDANDO_DOCUMENTACAO]: [
    ProposalStatus.DOCUMENTACAO_COMPLETA,
    ProposalStatus.SUSPENSA
  ],
  
  [ProposalStatus.DOCUMENTACAO_COMPLETA]: [
    ProposalStatus.ASSINATURA_PENDENTE,
    ProposalStatus.CCB_GERADA,
    ProposalStatus.SUSPENSA
  ],
  
  [ProposalStatus.ASSINATURA_PENDENTE]: [
    ProposalStatus.ASSINATURA_CONCLUIDA,
    ProposalStatus.SUSPENSA
  ],
  
  // Status de pagamento
  [ProposalStatus.AGUARDANDO_PAGAMENTO]: [
    ProposalStatus.PAGO_TOTAL,
    ProposalStatus.SUSPENSA
  ],
  
  // Estados finais - não podem transicionar  
  [ProposalStatus.PAGAMENTO_AUTORIZADO]: [], // Estado final de sucesso
  [ProposalStatus.PAGO_TOTAL]: [], // Estado final de sucesso
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
    ProposalStatus.AGUARDANDO_DOCUMENTACAO,
    ProposalStatus.DOCUMENTACAO_COMPLETA,
    ProposalStatus.ASSINATURA_PENDENTE,
    ProposalStatus.AGUARDANDO_PAGAMENTO
  ]
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
  const { 
    propostaId, 
    novoStatus, 
    userId, 
    contexto = 'geral', 
    observacoes,
    metadata 
  } = params;
  
  console.log(`[FSM] 🚀 Iniciando transição para proposta ${propostaId}`);
  console.log(`[FSM] 📊 Novo status desejado: ${novoStatus}`);
  
  try {
    // 1. Buscar o estado atual da proposta
    const [propostaAtual] = await db
      .select({ 
        id: propostas.id,
        status: propostas.status 
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
          validatedBy: 'FSM'
        }
      }
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
    graph: transitionGraph
  };
}

// Exportar também o grafo para testes e documentação
export { transitionGraph };