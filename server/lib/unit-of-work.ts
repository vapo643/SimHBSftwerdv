/**
 * Unit of Work Pattern Implementation
 * 
 * Sprint 2 - Data Layer & Domain Model Enhancement
 * Implements atomic transactions for complex business operations
 * 
 * Date: 2025-08-28
 * Author: GEM-07 AI Specialist System
 */

import { db } from './supabase';
import { PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import { ExtractTablesWithRelations } from 'drizzle-orm';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';

// Transaction type for type safety
export type Transaction = PostgresJsTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

// Unit of Work interface for transaction management
export interface IUnitOfWork {
  /**
   * Execute operations within a transaction
   * All operations succeed or all fail atomically
   */
  withTransaction<T>(
    operation: (tx: Transaction) => Promise<T>
  ): Promise<T>;
  
  /**
   * Execute multiple operations in parallel within a transaction
   * Useful for operations that don't depend on each other
   */
  withParallelTransaction<T>(
    operations: Array<(tx: Transaction) => Promise<any>>
  ): Promise<T[]>;
}

/**
 * Transaction Repository base class
 * Provides common transaction operations for domain repositories
 */
export abstract class TransactionRepository {
  constructor(protected tx: Transaction) {}
  
  /**
   * Execute a query within the current transaction
   */
  protected async execute<T>(query: any): Promise<T> {
    return await query;
  }
  
  /**
   * Bulk insert with transaction safety
   */
  protected async bulkInsert<T>(table: any, values: any[]): Promise<T[]> {
    if (values.length === 0) return [];
    return await this.tx.insert(table).values(values).returning();
  }
  
  /**
   * Conditional update with validation
   */
  protected async conditionalUpdate<T>(
    table: any,
    condition: any,
    updates: any,
    validator?: (currentData: any) => boolean
  ): Promise<T | null> {
    if (validator) {
      const current = await this.tx.select().from(table).where(condition).limit(1);
      if (current.length === 0) return null;
      
      if (!validator(current[0])) {
        throw new Error('Validation failed for conditional update');
      }
    }
    
    const result = await this.tx.update(table).set(updates).where(condition).returning();
    return result[0] || null;
  }
}

/**
 * Unit of Work implementation with domain-specific transaction patterns
 */
export class UnitOfWork implements IUnitOfWork {
  
  /**
   * Execute operations within a single transaction
   * Implements atomic commit/rollback pattern
   */
  async withTransaction<T>(
    operation: (tx: Transaction) => Promise<T>
  ): Promise<T> {
    return await db.transaction(async (tx) => {
      try {
        const result = await operation(tx);
        
        // Implicit commit happens when function succeeds
        return result;
      } catch (error) {
        // Implicit rollback happens when function throws
        console.error('[UoW] Transaction failed, rolling back:', error);
        throw error;
      }
    });
  }
  
  /**
   * Execute multiple independent operations in parallel within a transaction
   * Useful for operations that don't have dependencies
   */
  async withParallelTransaction<T>(
    operations: Array<(tx: Transaction) => Promise<any>>
  ): Promise<T[]> {
    return await this.withTransaction(async (tx) => {
      // Execute all operations in parallel within the same transaction
      return await Promise.all(operations.map(op => op(tx)));
    });
  }
  
  /**
   * Complex business operation pattern
   * For operations involving multiple entities with business rules
   */
  async withBusinessOperation<T>(
    operation: (repositories: BusinessRepositories) => Promise<T>
  ): Promise<T> {
    return await this.withTransaction(async (tx) => {
      const repositories = {
        propostas: new PropostaTransactionRepository(tx),
        ccbs: new CcbTransactionRepository(tx),
        boletos: new BoletoTransactionRepository(tx),
        logs: new LogTransactionRepository(tx),
        statusContextual: new StatusContextualTransactionRepository(tx),
      };
      
      return await operation(repositories);
    });
  }
}

/**
 * Business repositories interface for complex operations
 */
export interface BusinessRepositories {
  propostas: PropostaTransactionRepository;
  ccbs: CcbTransactionRepository;
  boletos: BoletoTransactionRepository;
  logs: LogTransactionRepository;
  statusContextual: StatusContextualTransactionRepository;
}

/**
 * Domain-specific transaction repositories
 */
export class PropostaTransactionRepository extends TransactionRepository {
  async createWithLogs(proposta: any, log: any): Promise<any> {
    const createdProposta = await this.tx.insert(schema.propostas).values(proposta).returning();
    await this.tx.insert(schema.propostaLogs).values({
      ...log,
      propostaId: createdProposta[0].id,
    });
    return createdProposta[0];
  }
  
  async updateStatusWithContext(
    propostaId: string, 
    newStatus: string, 
    context: any,
    userId: string
  ): Promise<void> {
    // Atomic status update with context and audit
    await Promise.all([
      this.tx.update(schema.propostas)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(schema.propostas.id, propostaId)),
      
      this.tx.insert(schema.propostaLogs).values({
        propostaId,
        autorId: userId,
        statusNovo: newStatus,
        observacao: context.observacao,
      }),
      
      this.tx.insert(schema.statusContextuais).values({
        propostaId,
        contexto: context.contexto,
        status: newStatus,
        atualizadoPor: userId,
        metadata: context.metadata,
      }),
    ]);
  }
}

export class CcbTransactionRepository extends TransactionRepository {
  async createWithBoletos(ccb: any, boletos: any[]): Promise<{ ccb: any; boletos: any[] }> {
    const createdCcb = await this.tx.insert(schema.ccbs).values(ccb).returning();
    const ccbId = createdCcb[0].id;
    
    const boletosWithCcbId = boletos.map(b => ({ ...b, ccbId }));
    const createdBoletos = await this.bulkInsert(schema.boletos, boletosWithCcbId);
    
    return {
      ccb: createdCcb[0],
      boletos: createdBoletos,
    };
  }
}

export class BoletoTransactionRepository extends TransactionRepository {
  async updatePaymentStatus(boletoId: string, paymentData: any): Promise<any> {
    return await this.conditionalUpdate(
      schema.boletos,
      eq(schema.boletos.id, boletoId),
      paymentData,
      (current) => current.status !== 'CANCELADO' // Business rule validation
    );
  }
}

export class LogTransactionRepository extends TransactionRepository {
  async createMultiple(logs: any[]): Promise<any[]> {
    return await this.bulkInsert(schema.propostaLogs, logs);
  }
}

export class StatusContextualTransactionRepository extends TransactionRepository {
  async updateContext(propostaId: string, contexto: string, newStatus: string, metadata: any): Promise<any> {
    return await this.tx.insert(schema.statusContextuais).values({
      propostaId,
      contexto,
      status: newStatus,
      metadata,
      atualizadoEm: new Date(),
    }).returning();
  }
}

// Export singleton instance
export const unitOfWork = new UnitOfWork();

// Import shortcuts for common patterns
export { db as database };
export type { Transaction };