/**
 * Implementação concreta do Unit of Work (UoW)
 * Banking-Grade Transaction Management - PAM V1.0 Sprint 2
 *
 * Responsável por gerir transações atômicas no PostgreSQL usando Drizzle ORM.
 * Garante que operações de negócio complexas sejam executadas como uma única
 * unidade indivisível (ACID).
 */

import { eq } from 'drizzle-orm';
import { PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import { ExtractTablesWithRelations } from 'drizzle-orm';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { db } from '../../../lib/supabase';
import * as schema from '@shared/schema';

import { IUnitOfWork } from '../domain/IUnitOfWork';
import { IProposalRepository } from '../../proposal/domain/IProposalRepository';
import { ICcbRepository } from '../../ccb/domain/ICcbRepository';
import { IBoletoRepository } from '../../boleto/domain/IBoletoRepository';

// Importar implementações concretas modificadas para aceitar transação
import { TransactionalProposalRepository } from './TransactionalProposalRepository';
import { TransactionalCcbRepository } from './TransactionalCcbRepository';
import { TransactionalBoletoRepository } from './TransactionalBoletoRepository';

// Type para transação Drizzle
type DrizzleTransaction = PostgresJsTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export class UnitOfWork implements IUnitOfWork {
  private _isInTransaction: boolean = false;
  private _transactionId: string | null = null;
  private _proposals!: IProposalRepository;
  private _ccbs!: ICcbRepository;
  private _boletos!: IBoletoRepository;

  // ========================================================================
  // REPOSITÓRIOS TRANSACIONAIS
  // ========================================================================

  get proposals(): IProposalRepository {
    if (!this._isInTransaction) {
      throw new Error('Cannot access repositories outside of transaction context');
    }
    return this._proposals;
  }

  get ccbs(): ICcbRepository {
    if (!this._isInTransaction) {
      throw new Error('Cannot access repositories outside of transaction context');
    }
    return this._ccbs;
  }

  get boletos(): IBoletoRepository {
    if (!this._isInTransaction) {
      throw new Error('Cannot access repositories outside of transaction context');
    }
    return this._boletos;
  }

  // ========================================================================
  // CONTROLE TRANSACIONAL
  // ========================================================================

  async executeInTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this._isInTransaction) {
      throw new Error('Cannot start nested transaction');
    }

    // Gerar ID único para auditoria
    this._transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[UoW] Starting transaction: ${this._transactionId}`);

    try {
      // Executar dentro de uma transação Drizzle
      const result = await db.transaction(async (tx: DrizzleTransaction) => {
        // Configurar estado transacional
        this._isInTransaction = true;

        // Instanciar repositórios com contexto transacional
        this._proposals = new TransactionalProposalRepository(tx);
        this._ccbs = new TransactionalCcbRepository(tx);
        this._boletos = new TransactionalBoletoRepository(tx);

        console.log(`[UoW] Transaction context initialized: ${this._transactionId}`);

        try {
          // Executar lógica de negócio
          const workResult = await work();

          console.log(`[UoW] Work completed successfully: ${this._transactionId}`);
          return workResult;
        } catch (error) {
          console.error(
            `[UoW] Work failed, rolling back transaction: ${this._transactionId}`,
            error
          );
          throw error; // Drizzle automaticamente faz rollback quando há exception
        }
      });

      console.log(`[UoW] Transaction committed successfully: ${this._transactionId}`);
      return result;
    } catch (error) {
      console.error(`[UoW] Transaction failed: ${this._transactionId}`, error);
      throw error;
    } finally {
      // Limpar estado transacional
      this._isInTransaction = false;
      this._transactionId = null;

      // Limpar referências dos repositórios
      this._proposals = undefined as any;
      this._ccbs = undefined as any;
      this._boletos = undefined as any;

      console.log(`[UoW] Transaction context cleaned up`);
    }
  }

  // ========================================================================
  // ESTADO DA TRANSAÇÃO
  // ========================================================================

  get isInTransaction(): boolean {
    return this._isInTransaction;
  }

  get transactionId(): string | null {
    return this._transactionId;
  }
}

/**
 * Factory para criar instâncias do Unit of Work
 */
export class UnitOfWorkFactory {
  static create(): IUnitOfWork {
    return new UnitOfWork();
  }
}

/**
 * Singleton global para uso em Services (Development/Testing)
 * Para produção, usar Dependency Injection
 */
export const unitOfWork = new UnitOfWork();
