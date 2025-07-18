import { users, propostas, type User, type InsertUser, type Proposta, type InsertProposta, type UpdateProposta } from "@shared/schema";
import { db } from "./lib/supabase";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Propostas
  getPropostas(): Promise<Proposta[]>;
  getPropostaById(id: string | number): Promise<Proposta | undefined>;
  getPropostasByStatus(status: string): Promise<Proposta[]>;
  createProposta(proposta: InsertProposta): Promise<Proposta>;
  updateProposta(id: number, proposta: UpdateProposta): Promise<Proposta>;
  deleteProposta(id: number): Promise<void>;
  getPropostaLogs(id: number): Promise<any[]>;
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

  async getPropostas(): Promise<Proposta[]> {
    return await db.select().from(propostas).orderBy(desc(propostas.createdAt));
  }

  async getPropostaById(id: string | number): Promise<Proposta | undefined> {
    // Handle both string and number IDs
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    if (isNaN(numericId)) {
      return undefined;
    }
    const result = await db.select().from(propostas).where(eq(propostas.id, numericId)).limit(1);
    return result[0];
  }

  async getPropostasByStatus(status: string): Promise<Proposta[]> {
    return await db.select().from(propostas).where(eq(propostas.status, status as any)).orderBy(desc(propostas.createdAt));
  }

  async createProposta(proposta: InsertProposta): Promise<Proposta> {
    const result = await db.insert(propostas).values(proposta).returning();
    return result[0];
  }

  async updateProposta(id: number, proposta: UpdateProposta): Promise<Proposta> {
    const result = await db.update(propostas).set({ ...proposta, updatedAt: new Date() }).where(eq(propostas.id, id)).returning();
    return result[0];
  }

  async deleteProposta(id: number): Promise<void> {
    await db.delete(propostas).where(eq(propostas.id, id));
  }

  async getPropostaLogs(id: number): Promise<any[]> {
    // Mock implementation for now - in real implementation this would query a logs table
    return [
      {
        id: 1,
        proposta_id: id,
        status_novo: 'Em Análise',
        observacao: 'Proposta recebida para análise',
        user_id: 'user123',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        proposta_id: id,
        status_novo: 'Pendente',
        observacao: 'Documentos adicionais necessários',
        user_id: 'user456',
        created_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }
    ];
  }
}

export const storage = new DatabaseStorage();
