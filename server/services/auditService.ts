/**
 * Audit Service - Sistema de Status V2.0
 *
 * Serviço responsável por registrar todas as transições de status
 * no novo modelo de auditoria completa, garantindo rastreabilidade
 * total de todas as mudanças de estado das propostas.
 */

import { db } from '../lib/supabase.js';
import { statusTransitions } from '../../shared/schema.js';
import type { InsertStatusTransition } from '../../shared/schema.js';
import { getBrasiliaTimestamp } from '../lib/timezone.js';

export type TriggeredBy = 'api' | 'webhook' | 'manual' | 'scheduler' | 'system';

interface StatusTransitionLog {
  propostaId: string;
  fromStatus: string | null;
  toStatus: string;
  triggeredBy: TriggeredBy;
  metadata?: Record<string, any>;
  userId?: string;
  webhookEventId?: string;
  errorMessage?: string;
}

/**
 * Log a status transition to the audit table
 *
 * @param transition - The transition details to log
 * @returns The created transition record
 */
export async function logStatusTransition(transition: StatusTransitionLog) {
  try {
    console.log(
      `[AUDIT V2.0] 📝 Registering status transition for proposal ${transition.propostaId}`
    );
    console.log(
      `[AUDIT V2.0] Transition: ${transition.fromStatus || 'INITIAL'} → ${transition.toStatus}`
    );
    console.log(`[AUDIT V2.0] Triggered by: ${transition.triggeredBy}`);

    // Add timestamp to metadata
    const enrichedMetadata = {
      ...transition.metadata,
      timestamp_brasilia: getBrasiliaTimestamp(),
      source_version: 'V2.0',
    };

    // Prepare insert data
    const insertData: InsertStatusTransition = {
      propostaId: transition.propostaId,
      fromStatus: transition.fromStatus,
      toStatus: transition.toStatus,
      triggeredBy: transition.triggeredBy,
      metadata: enrichedMetadata,
      userId: transition.userId,
      webhookEventId: transition.webhookEventId,
      errorMessage: transition.errorMessage,
    };

    // Insert into database
    const [result] = await db.insert(statusTransitions).values(insertData).returning();

    console.log(`[AUDIT V2.0] ✅ Transition logged successfully with ID: ${result.id}`);

    return result;
  } catch (error) {
    console.error(`[AUDIT V2.0] ❌ Failed to log status transition:`, error);
    throw error;
  }
}

/**
 * Get all status transitions for a specific proposal
 *
 * @param propostaId - The proposal ID to get transitions for
 * @returns Array of status transitions ordered by creation date
 */
export async function getProposalStatusHistory(propostaId: string) {
  try {
    console.log(`[AUDIT V2.0] 📖 Fetching status history for proposal ${propostaId}`);

    const transitions = await db
      .select()
      .from(statusTransitions)
      .where(eq(statusTransitions.propostaId, propostaId))
      .orderBy(statusTransitions.createdAt);

    console.log(`[AUDIT V2.0] Found ${transitions.length} transitions`);

    return transitions;
  } catch (error) {
    console.error(`[AUDIT V2.0] ❌ Failed to fetch status history:`, error);
    throw error;
  }
}

/**
 * Get the last successful transition for a proposal
 *
 * @param propostaId - The proposal ID
 * @returns The last successful transition or null
 */
export async function getLastTransition(propostaId: string) {
  try {
    const transitions = await db
      .select()
      .from(statusTransitions)
      .where(
        and(eq(statusTransitions.propostaId, propostaId), isNull(statusTransitions.errorMessage))
      )
      .orderBy(desc(statusTransitions.createdAt))
      .limit(1);

    return transitions[0] || null;
  } catch (error) {
    console.error(`[AUDIT V2.0] ❌ Failed to fetch last transition:`, error);
    throw error;
  }
}

/**
 * Log a failed status transition attempt
 *
 * @param transition - The failed transition details
 * @returns The created error record
 */
export async function logFailedTransition(
  transition: StatusTransitionLog & { errorMessage: string }
) {
  console.error(`[AUDIT V2.0] ❌ Logging failed transition for proposal ${transition.propostaId}`);
  console.error(`[AUDIT V2.0] Error: ${transition.errorMessage}`);

  return logStatusTransition(transition);
}

/**
 * Check if a transition is valid based on the current status
 *
 * @param currentStatus - The current status
 * @param targetStatus - The target status
 * @returns Whether the transition is valid
 */
export function isValidTransition(currentStatus: string, targetStatus: string): boolean {
  // Define valid transitions based on the V2.0 workflow
  const validTransitions: Record<string, string[]> = {
    rascunho: ['em_analise', 'cancelado'],
    em_analise: ['aprovado', 'rejeitado', 'pendente', 'cancelado'],
    aprovado: ['CCB_GERADA', 'aguardando_aceite_atendente', 'cancelado'],
    CCB_GERADA: ['AGUARDANDO_ASSINATURA', 'cancelado'],
    AGUARDANDO_ASSINATURA: ['ASSINATURA_PENDENTE', 'ASSINATURA_CONCLUIDA', 'cancelado'],
    ASSINATURA_PENDENTE: ['ASSINATURA_CONCLUIDA', 'cancelado'],
    ASSINATURA_CONCLUIDA: ['BOLETOS_EMITIDOS', 'contratos_assinados', 'cancelado'],
    contratos_assinados: ['BOLETOS_EMITIDOS', 'pronto_pagamento', 'cancelado'],
    BOLETOS_EMITIDOS: ['PAGAMENTO_PENDENTE', 'cancelado'],
    PAGAMENTO_PENDENTE: ['PAGAMENTO_PARCIAL', 'INADIMPLENTE', 'QUITADO', 'cancelado'],
    PAGAMENTO_PARCIAL: ['QUITADO', 'INADIMPLENTE', 'cancelado'],
    INADIMPLENTE: ['PAGAMENTO_PARCIAL', 'QUITADO', 'cancelado'],
    pronto_pagamento: ['pagamento_autorizado', 'pago', 'cancelado'],
    pagamento_autorizado: ['pago', 'cancelado'],
  };

  // Special case: unknown status can transition to 'cancelado' or 'suspensa'
  if (targetStatus === 'cancelado' || targetStatus === 'suspensa') {
    return true;
  }

  const allowedTransitions = validTransitions[currentStatus];
  return allowedTransitions ? allowedTransitions.includes(targetStatus) : false;
}

// Import required functions from drizzle-orm
import { eq, and, isNull, desc } from 'drizzle-orm';

// Export the service
export const auditService = {
  logStatusTransition,
  getProposalStatusHistory,
  getLastTransition,
  logFailedTransition,
  isValidTransition,
};

export default auditService;
