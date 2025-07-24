import {
  users,
  propostas,
  gerenteLojas,
  lojas,
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

  // Propostas
  getPropostas(): Promise<Proposta[]>;
  getPropostaById(id: number): Promise<Proposta | undefined>;
  getPropostasByStatus(status: string): Promise<Proposta[]>;
  createProposta(proposta: InsertProposta): Promise<Proposta>;
  updateProposta(id: number, proposta: UpdateProposta): Promise<Proposta>;
  deleteProposta(id: number): Promise<void>;

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
    try {
      const result = await db.select().from(users).orderBy(users.name);
      console.log(`[Storage] getUsers() returned ${result.length} users`);
      return result;
    } catch (error) {
      console.error('[Storage] Error in getUsers():', error);
      throw new Error('Failed to fetch users from database');
    }
  }

  async getPropostas(): Promise<Proposta[]> {
    return await db.select().from(propostas).orderBy(desc(propostas.createdAt));
  }

  async getPropostaById(id: number): Promise<Proposta | undefined> {
    const result = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);
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

  async updateProposta(id: number, proposta: UpdateProposta): Promise<Proposta> {
    const result = await db
      .update(propostas)
      .set({ ...proposta, updatedAt: new Date() })
      .where(eq(propostas.id, id))
      .returning();
    return result[0];
  }

  async deleteProposta(id: number): Promise<void> {
    await db.delete(propostas).where(eq(propostas.id, id));
  }

  // Lojas CRUD implementation
  async getLojas(): Promise<Loja[]> {
    try {
      const result = await db.select().from(lojas).where(eq(lojas.isActive, true)).orderBy(lojas.nomeLoja);
      console.log(`[Storage] getLojas() returned ${result.length} active lojas`);
      return result;
    } catch (error) {
      console.error('[Storage] Error in getLojas():', error);
      throw new Error('Failed to fetch lojas from database');
    }
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
