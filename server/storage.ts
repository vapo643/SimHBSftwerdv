import {
  users,
  propostas,
  gerenteLojas,
  lojas,
  parceiros,
  type User,
  type InsertUser,
  type Proposta,
  type InsertProposta,
  type UpdateProposta,
  type GerenteLojas,
  type InsertGerenteLojas,
  type Loja,
  type InsertLoja,
  type UpdateLoja,
} from "@shared/schema";
import { db } from "./lib/supabase";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  getUsersWithDetails(): Promise<any[]>;

  // Propostas
  getPropostas(): Promise<any[]>;
  getPropostaById(id: string | number): Promise<Proposta | undefined>;
  getPropostasByStatus(status: string): Promise<Proposta[]>;
  createProposta(proposta: InsertProposta): Promise<Proposta>;
  updateProposta(id: string | number, proposta: UpdateProposta): Promise<Proposta>;
  deleteProposta(id: string | number): Promise<void>;

  // Lojas
  getLojas(): Promise<Loja[]>;
  getLojaById(id: number): Promise<Loja | undefined>;
  createLoja(loja: InsertLoja): Promise<Loja>;
  updateLoja(id: number, loja: UpdateLoja): Promise<Loja>;
  deleteLoja(id: number): Promise<void>;
  checkLojaDependencies(id: number): Promise<{ hasUsers: boolean; hasPropostas: boolean; hasGerentes: boolean }>;

  // Gerente-Lojas Relationships
  getGerenteLojas(gerenteId: number): Promise<GerenteLojas[]>;
  getLojasForGerente(gerenteId: number): Promise<number[]>;
  getGerentesForLoja(lojaId: number): Promise<number[]>;
  addGerenteToLoja(relationship: InsertGerenteLojas): Promise<GerenteLojas>;
  removeGerenteFromLoja(gerenteId: number, lojaId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.name);
  }

  async getUsersWithDetails(): Promise<any[]> {
    const { createServerSupabaseAdminClient } = await import('./lib/supabase');
    const supabase = createServerSupabaseAdminClient();
    
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          role,
          loja_id,
          auth_user:auth.users!inner(email),
          loja:lojas(id, nome_loja, parceiro_id, parceiro:parceiros(id, razao_social)),
          gerente_lojas(loja_id, loja:lojas(id, nome_loja, parceiro_id, parceiro:parceiros(id, razao_social)))
        `);

      if (error) {
        console.error('Database error in getUsersWithDetails:', error);
        throw new Error(`Erro ao buscar usuários: ${error.message}`);
      }

      return users || [];
    } catch (error) {
      console.error('Critical error in getUsersWithDetails:', error);
      throw error;
    }
  }

  async getPropostas(): Promise<any[]> {
    // Using raw SQL to handle snake_case to camelCase mapping
    const { createServerSupabaseAdminClient } = await import('./lib/supabase');
    const supabase = createServerSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('propostas')
      .select(`
        id,
        status,
        nome_cliente,
        cpf_cliente,
        email_cliente,
        telefone_cliente,
        valor_solicitado,
        prazo,
        loja_id,
        created_at,
        updated_at,
        lojas!inner (
          id,
          nome_loja,
          parceiros!inner (
            id,
            razao_social
          )
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching propostas:', error);
      throw error;
    }
    
    // Map the data to match the expected format
    return (data || []).map(p => ({
      id: p.id,
      status: p.status,
      nomeCliente: p.nome_cliente || 'Cliente não informado',
      cpfCliente: p.cpf_cliente,
      emailCliente: p.email_cliente,
      telefoneCliente: p.telefone_cliente,
      valorSolicitado: p.valor_solicitado || 0,
      prazo: p.prazo,
      lojaId: p.loja_id,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      loja: p.lojas ? {
        id: p.lojas.id,
        nomeLoja: p.lojas.nome_loja
      } : null,
      parceiro: p.lojas?.parceiros ? {
        id: p.lojas.parceiros.id,
        razaoSocial: p.lojas.parceiros.razao_social
      } : null
    }));
  }

  async getPropostaById(id: string | number): Promise<Proposta | undefined> {
    const result = await db.select().from(propostas).where(eq(propostas.id, String(id))).limit(1);
    return result[0];
  }

  async getPropostasByStatus(status: string): Promise<Proposta[]> {
    return await db
      .select()
      .from(propostas)
      .where(eq(propostas.status, status as any))
      .orderBy(desc(propostas.createdAt));
  }

  async createProposta(proposta: InsertProposta): Promise<Proposta> {
    const result = await db.insert(propostas).values(proposta).returning();
    return result[0];
  }

  async updateProposta(id: string | number, proposta: UpdateProposta): Promise<Proposta> {
    const result = await db
      .update(propostas)
      .set({ ...proposta, updatedAt: new Date() })
      .where(eq(propostas.id, String(id)))
      .returning();
    return result[0];
  }

  async deleteProposta(id: string | number): Promise<void> {
    await db.delete(propostas).where(eq(propostas.id, String(id)));
  }

  // Lojas CRUD implementation
  async getLojas(): Promise<Loja[]> {
    return await db.select().from(lojas).where(eq(lojas.isActive, true)).orderBy(lojas.nomeLoja);
  }

  async getLojaById(id: number): Promise<Loja | undefined> {
    const result = await db.select().from(lojas).where(and(eq(lojas.id, id), eq(lojas.isActive, true))).limit(1);
    return result[0];
  }

  async createLoja(loja: InsertLoja): Promise<Loja> {
    const result = await db.insert(lojas).values(loja).returning();
    return result[0];
  }

  async updateLoja(id: number, loja: UpdateLoja): Promise<Loja> {
    const result = await db
      .update(lojas)
      .set(loja)
      .where(eq(lojas.id, id))
      .returning();
    return result[0];
  }

  async deleteLoja(id: number): Promise<void> {
    await db.update(lojas).set({ isActive: false }).where(eq(lojas.id, id));
  }

  async checkLojaDependencies(id: number): Promise<{ hasUsers: boolean; hasPropostas: boolean; hasGerentes: boolean }> {
    try {
      // Check if there are proposals associated with this store
      const propostasCount = await db.select({ id: propostas.id }).from(propostas).where(eq(propostas.lojaId, id)).limit(1);
      
      // Check if there are manager-store relationships
      const gerentesCount = await db.select({ id: gerenteLojas.gerenteId }).from(gerenteLojas).where(eq(gerenteLojas.lojaId, id)).limit(1);
      
      return {
        hasUsers: false, // Users don't have direct loja association in our current schema
        hasPropostas: propostasCount.length > 0,
        hasGerentes: gerentesCount.length > 0,
      };
    } catch (error) {
      console.error('Error checking loja dependencies:', error);
      return {
        hasUsers: false,
        hasPropostas: false,
        hasGerentes: false,
      };
    }
  }

  // Gerente-Lojas Relationships
  async getGerenteLojas(gerenteId: number): Promise<GerenteLojas[]> {
    return await db
      .select()
      .from(gerenteLojas)
      .where(eq(gerenteLojas.gerenteId, gerenteId));
  }

  async getLojasForGerente(gerenteId: number): Promise<number[]> {
    const result = await db
      .select({ lojaId: gerenteLojas.lojaId })
      .from(gerenteLojas)
      .where(eq(gerenteLojas.gerenteId, gerenteId));
    return result.map(r => r.lojaId);
  }

  async getGerentesForLoja(lojaId: number): Promise<number[]> {
    const result = await db
      .select({ gerenteId: gerenteLojas.gerenteId })
      .from(gerenteLojas)
      .where(eq(gerenteLojas.lojaId, lojaId));
    return result.map(r => r.gerenteId);
  }

  async addGerenteToLoja(relationship: InsertGerenteLojas): Promise<GerenteLojas> {
    const result = await db.insert(gerenteLojas).values(relationship).returning();
    return result[0];
  }

  async removeGerenteFromLoja(gerenteId: number, lojaId: number): Promise<void> {
    await db
      .delete(gerenteLojas)
      .where(and(
        eq(gerenteLojas.gerenteId, gerenteId),
        eq(gerenteLojas.lojaId, lojaId)
      ));
  }
}

export const storage = new DatabaseStorage();
