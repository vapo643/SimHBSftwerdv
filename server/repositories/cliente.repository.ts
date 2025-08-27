/**
 * Cliente Repository
 * Handles all database operations for client-related data
 * PAM V1.0 - Repository pattern implementation
 */

import { BaseRepository } from './base.repository.js';
import { db } from '../lib/supabase.js';
import { propostas } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

export class ClienteRepository extends BaseRepository<typeof propostas> {
  constructor() {
    super('propostas');
  }

  /**
   * Find client data by CPF
   */
  async findByCPF(cpf: string): Promise<any | null> {
    try {
      const [proposta] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.clienteCpf, cpf))
        .orderBy(desc(propostas.createdAt))
        .limit(1);

      return proposta || null;
    }
catch (error) {
      console.error('[CLIENTE_REPO] Error finding client by CPF:', error);
      return null;
    }
  }

  /**
   * Get all proposals for a given CPF
   */
  async getProposalsByCPF(cpf: string): Promise<any[]> {
    try {
      return await db
        .select()
        .from(propostas)
        .where(eq(propostas.clienteCpf, cpf))
        .orderBy(desc(propostas.createdAt));
    }
catch (error) {
      console.error('[CLIENTE_REPO] Error getting proposals by CPF:', error);
      return [];
    }
  }

  /**
   * Check if client exists
   */
  async clientExists(cpf: string): Promise<boolean> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(propostas)
        .where(eq(propostas.clienteCpf, cpf));

      return (result[0]?.count || 0) > 0;
    }
catch (error) {
      console.error('[CLIENTE_REPO] Error checking client existence:', error);
      return false;
    }
  }
}

export const clienteRepository = new ClienteRepository();
