/**
 * Webhook Repository
 * Encapsulates all database operations for webhooks
 * Following architectural boundary rules - controllers must not access DB directly
 */

import { BaseRepository } from './base.repository';
import { createServerSupabaseAdminClient } from '../lib/supabase';
import { db } from '../lib/supabase';
import { sql } from 'drizzle-orm';

export interface WebhookLog {
  id?: string;
  source: 'clicksign' | 'inter' | 'other';
  event: string;
  payload: unknown;
  signature?: string;
  status: 'pending' | 'processed' | 'failed';
  propostaId?: string;
  documentKey?: string;
  error?: string;
  processedAt?: string;
  createdAt?: string;
  metadata?: unknown;
}

export interface Proposal {
  id: string;
  clienteNome: string;
  status: string;
  clicksignDocumentId?: string;
  clicksignEnvelopeId?: string;
  nossoNumero?: string;
}

export interface Payment {
  id: string;
  nossoNumero: string;
  valorPago?: number;
  dataPagamento?: string;
  status: string;
  propostaId: string;
}

export class WebhookRepository extends BaseRepository<WebhookLog> {
  private supabaseAdmin;

  constructor() {
    super('webhook_logs');
    this.supabaseAdmin = createServerSupabaseAdminClient();
  }

  /**
   * Find proposal by ClickSign document key
   */
  async findProposalByClickSignDocument(documentKey: string): Promise<Proposal | null> {
    try {
      const _result = await db.execute(sql`
        SELECT id, cliente_nome, status, clicksign_document_id, clicksign_envelope_id
        FROM propostas 
        WHERE clicksign_document_id = ${documentKey}
           OR clicksign_envelope_id = ${documentKey}
        LIMIT 1
      `);

      if (!result || _result.length == 0) {
        return null;
      }

      const _row = result[0];
      return {
        id: row.id as string,
        clienteNome: row.cliente_nome as string,
        status: row.status as string,
        clicksignDocumentId: row.clicksign_document_id as string | undefined,
        clicksignEnvelopeId: row.clicksign_envelope_id as string | undefined,
      };
    } catch (error) {
      throw new Error(`Failed to find proposal by ClickSign document: ${error.message}`);
    }
  }

  /**
   * Find proposal by nosso_numero (Inter)
   */
  async findProposalByNossoNumero(nossoNumero: string): Promise<Proposal | null> {
    try {
      const _result = await db.execute(sql`
        SELECT id, cliente_nome, status, nosso_numero
        FROM propostas 
        WHERE nosso_numero = ${nossoNumero}
        LIMIT 1
      `);

      if (!result || _result.length == 0) {
        return null;
      }

      const _row = result[0];
      return {
        id: row.id as string,
        clienteNome: row.cliente_nome as string,
        status: row.status as string,
        nossoNumero: row.nosso_numero as string | undefined,
      };
    } catch (error) {
      throw new Error(`Failed to find proposal by nosso_numero: ${error.message}`);
    }
  }

  /**
   * Find payment by nosso_numero
   */
  async findPaymentByNossoNumero(nossoNumero: string): Promise<Payment | null> {
    try {
      const _result = await db.execute(sql`
        SELECT id, nosso_numero, valor_pago, data_pagamento, status, proposta_id
        FROM pagamentos 
        WHERE nosso_numero = ${nossoNumero}
        LIMIT 1
      `);

      if (!result || _result.length == 0) {
        return null;
      }

      const _row = result[0];
      return {
        id: row.id as string,
        nossoNumero: row.nosso_numero as string,
        valorPago: row.valor_pago as number | undefined,
        dataPagamento: row.data_pagamento as string | undefined,
        status: row.status as string,
        propostaId: row.proposta_id as string,
      };
    } catch (error) {
      throw new Error(`Failed to find payment by nosso_numero: ${error.message}`);
    }
  }

  /**
   * Update proposal signature status
   */
  async updateProposalSignatureStatus(
    propostaId: string,
    updates: {
      assinaturaEletronicaConcluida?: boolean;
      dataAssinatura?: string;
      clicksignDocumentId?: string;
      caminhoCcbAssinado?: string;
    }
  ): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE propostas 
        SET 
          assinatura_eletronica_concluida = ${updates.assinaturaEletronicaConcluida ?? false},
          data_assinatura = ${updates.dataAssinatura || null},
          clicksign_document_id = COALESCE(${updates.clicksignDocumentId || null}, clicksign_document_id),
          caminho_ccb_assinado = COALESCE(${updates.caminhoCcbAssinado || null}, caminho_ccb_assinado),
          updated_at = NOW()
        WHERE id = ${propostaId}
      `);
    } catch (error) {
      throw new Error(`Failed to update proposal signature status: ${error.message}`);
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    updates: {
      status?: string;
      valorPago?: number;
      dataPagamento?: string;
      metadata?: unknown;
    }
  ): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE pagamentos 
        SET 
          status = COALESCE(${updates.status || null}, status),
          valor_pago = COALESCE(${updates.valorPago || null}, valor_pago),
          data_pagamento = COALESCE(${updates.dataPagamento || null}, data_pagamento),
          metadata = COALESCE(${JSON.stringify(updates.metadata) || null}, metadata),
          updated_at = NOW()
        WHERE id = ${paymentId}
      `);
    } catch (error) {
      throw new Error(`Failed to update payment status: ${error.message}`);
    }
  }

  /**
   * Create webhook log entry
   */
  async createWebhookLog(log: WebhookLog): Promise<string> {
    const { data, error } = await this.supabaseAdmin
      .from(this.tableName)
      .insert({
        source: log.source,
        event: log.event,
        payload: log.payload,
        signature: log.signature,
        status: log.status,
        proposta_id: log.propostaId,
        document_key: log.documentKey,
        error: log.error,
        processed_at: log.processedAt,
        metadata: log.metadata,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create webhook log:', error);
      // Non-critical error, don't throw
      return '';
    }

    return data?.id || '';
  }

  /**
   * Update webhook log status
   */
  async updateWebhookLogStatus(
    logId: string,
    status: 'processed' | 'failed',
    error?: string
  ): Promise<void> {
    const updateData: unknown = {
      _status,
      processed_at: new Date().toISOString(),
    };

    if (error) {
      updateData.error = error;
    }

    const { error: updateError } = await this.supabaseAdmin
      .from(this.tableName)
      .update(updateData)
      .eq('id', logId);

    if (updateError) {
      console.error('Failed to update webhook log status:', updateError);
      // Non-critical error, don't throw
    }
  }

  /**
   * Check if webhook was already processed (idempotency)
   */
  async isWebhookProcessed(source: string, eventId: string): Promise<boolean> {
    const { data, error } = await this.supabaseAdmin
      .from(this.tableName)
      .select('id')
      .eq('source', source)
      .eq('metadata->event_id', eventId)
      .eq('status', 'processed')
      .limit(1);

    if (error) {
      console.error('Failed to check webhook idempotency:', error);
      return false;
    }

    return data && data.length > 0;
  }

  /**
   * Get recent webhook logs
   */
  async getRecentWebhookLogs(limit: number = 100): Promise<WebhookLog[]> {
    const { data, error } = await this.supabaseAdmin
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch webhook logs: ${error.message}`);
    }

    return data as WebhookLog[];
  }

  /**
   * Get webhook logs by proposal
   */
  async getWebhookLogsByProposal(propostaId: string): Promise<WebhookLog[]> {
    const { data, error } = await this.supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('proposta_id', propostaId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch webhook logs for proposal: ${error.message}`);
    }

    return data as WebhookLog[];
  }
}

// Export singleton instance
export const _webhookRepository = new WebhookRepository();
