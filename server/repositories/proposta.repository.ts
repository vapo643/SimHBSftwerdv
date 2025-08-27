/**
 * Proposta Repository
 * Encapsulates all database operations for propostas
 * Following architectural boundary rules - controllers must not access DB directly
 */

import { BaseRepository } from './base.repository';
import { createServerSupabaseAdminClient } from '../lib/supabase';
import { db } from '../lib/supabase';
import { propostas, statusContextuais } from '@shared/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';

export interface Proposta {
  id: string;
  clienteNome: string;
  clienteCpf?: string;
  valorSolicitado?: number;
  prazo?: number;
  status: string;
  userId?: string;
  lojaId?: number;
  caminhoCcbAssinado?: string | null;
  clicksignDocumentKey?: string | null;
  ccbGerado?: boolean;
  assinaturaEletronicaConcluida?: boolean;
  dataAprovacao?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface PropostaWithDetails extends Proposta {
  user?: {
    id: string;
    name: string;
    email: string;
  };
  loja?: {
    id: number;
    nome: string;
  };
}

export class PropostaRepository extends BaseRepository<Proposta> {
  private supabaseAdmin;

  constructor() {
    super('propostas');
    this.supabaseAdmin = createServerSupabaseAdminClient();
  }

  /**
   * Get proposta by ID with Drizzle
   */
  async getPropostaById(propostaId: string): Promise<Proposta | null> {
    try {
      const [proposta] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      return (proposta as unknown) || null;
    } catch (error) {
      throw new Error(
        `Failed to fetch proposta: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get proposta with user details from Supabase
   */
  async getPropostaWithDetails(propostaId: string): Promise<PropostaWithDetails | null> {
    const { data, error } = await this.supabaseAdmin
      .from(this.tableName)
      .select(
        `
        *,
        user:profiles!propostas_user_id_fkey(id, full_name, email),
        loja:lojas!propostas_loja_id_fkey(id, nome)
      `
      )
      .eq('id', propostaId)
      .single();

    if (error) {
      if (error.code == 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error(`Failed to fetch proposta with details: ${error.message}`);
    }

    return data as PropostaWithDetails;
  }

  /**
   * Update proposta status
   */
  async updateStatus(propostaId: string, novoStatus: string): Promise<void> {
    const { error } = await this.supabaseAdmin
      .from(this.tableName)
      .update({
        status: novoStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', propostaId);

    if (error) {
      throw new Error(`Failed to update proposta status: ${error.message}`);
    }
  }

  /**
   * Get propostas by status
   */
  async getPropostasByStatus(status: string): Promise<Proposta[]> {
    const { data, error } = await this.supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('status', status)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch propostas by status: ${error.message}`);
    }

    return data as Proposta[];
  }

  /**
   * Get propostas by user
   */
  async getPropostasByUser(userId: string): Promise<Proposta[]> {
    const { data, error } = await this.supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch propostas by user: ${error.message}`);
    }

    return data as Proposta[];
  }

  /**
   * Get propostas by loja
   */
  async getPropostasByLoja(lojaId: number): Promise<Proposta[]> {
    const { data, error } = await this.supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('loja_id', lojaId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch propostas by loja: ${error.message}`);
    }

    return data as Proposta[];
  }

  /**
   * Create communication log
   */
  async createCommunicationLog(log: {
    proposta_id: string;
    usuario_id?: string;
    tipo: string;
    mensagem: string;
  }): Promise<void> {
    const { error } = await this.supabaseAdmin.from('comunicacao_logs').insert({
      ...log,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to create communication log:', error);
      // Non-critical error, don't throw
    }
  }

  /**
   * Get propostas pending signature
   */
  async getPropostasPendingSignature(): Promise<Proposta[]> {
    const { data, error } = await this.supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('ccb_gerado', true)
      .eq('assinatura_eletronica_concluida', false)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch propostas pending signature: ${error.message}`);
    }

    return data as Proposta[];
  }

  /**
   * Update CCB path
   */
  async updateCcbPath(propostaId: string, ccbPath: string): Promise<void> {
    const { error } = await this.supabaseAdmin
      .from(this.tableName)
      .update({
        caminho_ccb_assinado: ccbPath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', propostaId);

    if (error) {
      throw new Error(`Failed to update CCB path: ${error.message}`);
    }
  }

  /**
   * Mark CCB as generated
   */
  async markCcbGenerated(propostaId: string): Promise<void> {
    const { error } = await this.supabaseAdmin
      .from(this.tableName)
      .update({
        ccb_gerado: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', propostaId);

    if (error) {
      throw new Error(`Failed to mark CCB as generated: ${error.message}`);
    }
  }

  /**
   * Mark signature as completed
   */
  async markSignatureCompleted(propostaId: string, clicksignKey?: string): Promise<void> {
    const updateData: unknown = {
      assinatura_eletronica_concluida: true,
      data_aprovacao: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (clicksignKey) {
      updateData.clicksign_document_key = clicksignKey;
    }

    const { error } = await this.supabaseAdmin
      .from(this.tableName)
      .update(updateData)
      .eq('id', propostaId);

    if (error) {
      throw new Error(`Failed to mark signature as completed: ${error.message}`);
    }
  }

  /**
   * Generate signed URL for CCB document
   */
  async generateCcbSignedUrl(path: string, expiresIn: number = 3600): Promise<string | null> {
    const { data, error } = await this.supabaseAdmin.storage
      .from('documents')
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Failed to generate signed URL:', error);
      return null;
    }

    return data?.signedUrl || null;
  }

  /**
   * Check if CCB exists in storage
   */
  async checkCcbExists(path: string): Promise<boolean> {
    const { data, error } = await this.supabaseAdmin.storage
      .from('documents')
      .list(path.split('/').slice(0, -1).join('/'), {
        search: path.split('/').pop(),
      });

    if (error) {
      console.error('Failed to check CCB existence:', error);
      return false;
    }

    return data && data.length > 0;
  }
}

// Export singleton instance
export const _propostaRepository = new PropostaRepository();
