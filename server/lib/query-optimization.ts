/**
 * Query Optimization and Eager Loading - Sprint 2
 * 
 * Implements high-performance query patterns and eager loading strategies
 * Optimizes database interactions for P95 < 500ms SLA compliance
 * 
 * Date: 2025-08-28
 * Author: GEM-07 AI Specialist System
 */

import { db } from './supabase';
import { eq, and, or, desc, asc, isNull, inArray, sql, exists } from 'drizzle-orm';
import * as schema from '@shared/schema';

/**
 * Query performance monitoring
 */
export interface QueryMetrics {
  queryName: string;
  duration: number;
  rowsReturned: number;
  cacheHit?: boolean;
}

/**
 * Optimized query builder with eager loading
 */
export class OptimizedQueryBuilder {
  private metrics: QueryMetrics[] = [];
  
  /**
   * High-performance proposal loading with related data
   * Implements eager loading to minimize N+1 queries
   */
  async getPropostasWithRelations(filters?: {
    lojaId?: number;
    status?: string[];
    dateRange?: { start: Date; end: Date };
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      // Single optimized query with joins instead of multiple queries
      const query = db
        .select({
          // Proposta fields
          proposta: {
            id: schema.propostas.id,
            status: schema.propostas.status,
            clienteData: schema.propostas.clienteData,
            condicoesData: schema.propostas.condicoesData,
            produtoId: schema.propostas.produtoId,
            lojaId: schema.propostas.lojaId,
            createdAt: schema.propostas.createdAt,
            updatedAt: schema.propostas.updatedAt,
          },
          // Loja data (eager loaded)
          loja: {
            id: schema.lojas.id,
            nomeLoja: schema.lojas.nomeLoja,
            parceiroId: schema.lojas.parceiroId,
          },
          // Parceiro data (eager loaded)
          parceiro: {
            id: schema.parceiros.id,
            razaoSocial: schema.parceiros.razaoSocial,
          },
          // Produto data (eager loaded)
          produto: {
            id: schema.produtos.id,
            nomeProduto: schema.produtos.nomeProduto,
            isActive: schema.produtos.isActive,
          },
          // Aggregated counts (subqueries)
          totalLogs: sql<number>`(
            SELECT COUNT(*) 
            FROM ${schema.propostaLogs} 
            WHERE ${schema.propostaLogs.propostaId} = ${schema.propostas.id}
          )`,
          totalDocumentos: sql<number>`(
            SELECT COUNT(*) 
            FROM ${schema.propostaDocumentos} 
            WHERE ${schema.propostaDocumentos.propostaId} = ${schema.propostas.id}
          )`,
        })
        .from(schema.propostas)
        .leftJoin(schema.lojas, eq(schema.propostas.lojaId, schema.lojas.id))
        .leftJoin(schema.parceiros, eq(schema.lojas.parceiroId, schema.parceiros.id))
        .leftJoin(schema.produtos, eq(schema.propostas.produtoId, schema.produtos.id))
        .where(
          and(
            isNull(schema.propostas.deletedAt), // Soft delete filter
            filters?.lojaId ? eq(schema.propostas.lojaId, filters.lojaId) : undefined,
            filters?.status ? inArray(schema.propostas.status, filters.status) : undefined,
            filters?.dateRange
              ? and(
                  sql`${schema.propostas.createdAt} >= ${filters.dateRange.start}`,
                  sql`${schema.propostas.createdAt} <= ${filters.dateRange.end}`
                )
              : undefined
          )
        )
        .orderBy(desc(schema.propostas.createdAt))
        .limit(filters?.limit || 50)
        .offset(filters?.offset || 0);
      
      const results = await query;
      
      this.recordMetrics('getPropostasWithRelations', startTime, results.length);
      
      return results;
    } catch (error) {
      this.recordMetrics('getPropostasWithRelations', startTime, 0, error);
      throw error;
    }
  }
  
  /**
   * Optimized proposal detail loading with all related entities
   * Single query with all necessary data for proposal view
   */
  async getPropostaDetailOptimized(propostaId: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Main proposal data with relations
      const mainQuery = db
        .select({
          // Complete proposal data
          id: schema.propostas.id,
          status: schema.propostas.status,
          clienteData: schema.propostas.clienteData,
          condicoesData: schema.propostas.condicoesData,
          produtoId: schema.propostas.produtoId,
          lojaId: schema.propostas.lojaId,
          createdAt: schema.propostas.createdAt,
          updatedAt: schema.propostas.updatedAt,
          // Joined data
          loja: {
            id: schema.lojas.id,
            nomeLoja: schema.lojas.nomeLoja,
            endereco: schema.lojas.endereco,
            telefone: schema.lojas.telefone,
            parceiroId: schema.lojas.parceiroId,
          },
          parceiro: {
            id: schema.parceiros.id,
            razaoSocial: schema.parceiros.razaoSocial,
            cnpj: schema.parceiros.cnpj,
            endereco: schema.parceiros.endereco,
          },
          produto: {
            id: schema.produtos.id,
            nomeProduto: schema.produtos.nomeProduto,
            tacValor: schema.produtos.tacValor,
            tacTipo: schema.produtos.tacTipo,
            modalidadeJuros: schema.produtos.modalidadeJuros,
          },
        })
        .from(schema.propostas)
        .leftJoin(schema.lojas, eq(schema.propostas.lojaId, schema.lojas.id))
        .leftJoin(schema.parceiros, eq(schema.lojas.parceiroId, schema.parceiros.id))
        .leftJoin(schema.produtos, eq(schema.propostas.produtoId, schema.produtos.id))
        .where(eq(schema.propostas.id, propostaId))
        .limit(1);
      
      // Related data queries (parallel execution)
      const [proposal, logs, documents, ccbs, statusHistory] = await Promise.all([
        mainQuery,
        this.getPropostaLogs(propostaId),
        this.getPropostaDocuments(propostaId),
        this.getPropostaCCBs(propostaId),
        this.getStatusHistory(propostaId),
      ]);
      
      if (!proposal || proposal.length === 0) {
        this.recordMetrics('getPropostaDetailOptimized', startTime, 0);
        return null;
      }
      
      const result = {
        ...proposal[0],
        logs,
        documents,
        ccbs,
        statusHistory,
      };
      
      this.recordMetrics('getPropostaDetailOptimized', startTime, 1);
      
      return result;
    } catch (error) {
      this.recordMetrics('getPropostaDetailOptimized', startTime, 0, error);
      throw error;
    }
  }
  
  /**
   * Optimized logs retrieval with pagination
   */
  private async getPropostaLogs(propostaId: string, limit = 50): Promise<any[]> {
    return await db
      .select({
        id: schema.propostaLogs.id,
        autorId: schema.propostaLogs.autorId,
        statusAnterior: schema.propostaLogs.statusAnterior,
        statusNovo: schema.propostaLogs.statusNovo,
        observacao: schema.propostaLogs.observacao,
        createdAt: schema.propostaLogs.createdAt,
      })
      .from(schema.propostaLogs)
      .where(eq(schema.propostaLogs.propostaId, propostaId))
      .orderBy(desc(schema.propostaLogs.createdAt))
      .limit(limit);
  }
  
  /**
   * Optimized documents retrieval
   */
  private async getPropostaDocuments(propostaId: string): Promise<any[]> {
    return await db
      .select({
        id: schema.propostaDocumentos.id,
        nomeDocumento: schema.propostaDocumentos.nomeDocumento,
        tipoDocumento: schema.propostaDocumentos.tipoDocumento,
        urlDocumento: schema.propostaDocumentos.urlDocumento,
        status: schema.propostaDocumentos.status,
        createdAt: schema.propostaDocumentos.createdAt,
      })
      .from(schema.propostaDocumentos)
      .where(
        and(
          eq(schema.propostaDocumentos.propostaId, propostaId),
          isNull(schema.propostaDocumentos.deletedAt)
        )
      )
      .orderBy(desc(schema.propostaDocumentos.createdAt));
  }
  
  /**
   * Optimized CCBs retrieval with boletos
   */
  private async getPropostaCCBs(propostaId: string): Promise<any[]> {
    return await db
      .select({
        ccb: {
          id: schema.ccbs.id,
          numeroCcb: schema.ccbs.numeroCcb,
          valorPrincipal: schema.ccbs.valorPrincipal,
          status: schema.ccbs.status,
          dataEmissao: schema.ccbs.dataEmissao,
          dataVencimento: schema.ccbs.dataVencimento,
        },
        boletos: sql<number>`(
          SELECT COUNT(*) 
          FROM ${schema.boletos} 
          WHERE ${schema.boletos.ccbId} = ${schema.ccbs.id}
        )`,
      })
      .from(schema.ccbs)
      .where(
        and(
          eq(schema.ccbs.propostaId, propostaId),
          isNull(schema.ccbs.deletedAt)
        )
      )
      .orderBy(desc(schema.ccbs.createdAt));
  }
  
  /**
   * Status history with contextual information
   */
  private async getStatusHistory(propostaId: string): Promise<any[]> {
    return await db
      .select({
        id: schema.statusContextuais.id,
        status: schema.statusContextuais.status,
        contexto: schema.statusContextuais.contexto,
        metadata: schema.statusContextuais.metadata,
        atualizadoEm: schema.statusContextuais.atualizadoEm,
        atualizadoPor: schema.statusContextuais.atualizadoPor,
      })
      .from(schema.statusContextuais)
      .where(eq(schema.statusContextuais.propostaId, propostaId))
      .orderBy(desc(schema.statusContextuais.atualizadoEm))
      .limit(20);
  }
  
  /**
   * Dashboard analytics with optimized aggregations
   */
  async getDashboardMetrics(lojaId?: number): Promise<{
    totalPropostas: number;
    proposatasPorStatus: Array<{ status: string; count: number }>;
    valorTotal: number;
    mediaValor: number;
    proposatasRecentes: number;
  }> {
    const startTime = Date.now();
    
    try {
      const baseCondition = and(
        isNull(schema.propostas.deletedAt),
        lojaId ? eq(schema.propostas.lojaId, lojaId) : undefined
      );
      
      // Parallel aggregation queries for performance
      const [
        totalCount,
        statusCounts,
        valueAggregations,
        recentCount,
      ] = await Promise.all([
        // Total proposals count
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(schema.propostas)
          .where(baseCondition),
        
        // Proposals by status
        db
          .select({
            status: schema.propostas.status,
            count: sql<number>`COUNT(*)`,
          })
          .from(schema.propostas)
          .where(baseCondition)
          .groupBy(schema.propostas.status),
        
        // Value aggregations (using JSON field)
        db
          .select({
            totalValue: sql<number>`SUM(CAST(${schema.propostas.condicoesData}->>'valor' AS NUMERIC))`,
            avgValue: sql<number>`AVG(CAST(${schema.propostas.condicoesData}->>'valor' AS NUMERIC))`,
          })
          .from(schema.propostas)
          .where(baseCondition),
        
        // Recent proposals (last 7 days)
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(schema.propostas)
          .where(
            and(
              baseCondition,
              sql`${schema.propostas.createdAt} >= NOW() - INTERVAL '7 days'`
            )
          ),
      ]);
      
      const result = {
        totalPropostas: totalCount[0]?.count || 0,
        proposatasPorStatus: statusCounts,
        valorTotal: valueAggregations[0]?.totalValue || 0,
        mediaValor: valueAggregations[0]?.avgValue || 0,
        proposatasRecentes: recentCount[0]?.count || 0,
      };
      
      this.recordMetrics('getDashboardMetrics', startTime, 1);
      
      return result;
    } catch (error) {
      this.recordMetrics('getDashboardMetrics', startTime, 0, error);
      throw error;
    }
  }
  
  /**
   * Performance monitoring
   */
  private recordMetrics(queryName: string, startTime: number, rowsReturned: number, error?: any): void {
    const duration = Date.now() - startTime;
    
    this.metrics.push({
      queryName,
      duration,
      rowsReturned,
    });
    
    // Log slow queries (> 1000ms)
    if (duration > 1000) {
      console.warn(`[SLOW QUERY] ${queryName}: ${duration}ms`, { error });
    }
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }
  
  /**
   * Get query performance statistics
   */
  getPerformanceStats(): {
    averageDuration: number;
    slowQueries: QueryMetrics[];
    totalQueries: number;
  } {
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const slowQueries = this.metrics.filter(m => m.duration > 500);
    
    return {
      averageDuration: this.metrics.length ? totalDuration / this.metrics.length : 0,
      slowQueries,
      totalQueries: this.metrics.length,
    };
  }
  
  /**
   * Clear performance metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }
}

// Export singleton instance
export const optimizedQuery = new OptimizedQueryBuilder();

/**
 * Query optimization utilities
 */
export class QueryOptimizer {
  
  /**
   * Build optimal WHERE conditions with proper indexing
   */
  static buildOptimalFilters(filters: any) {
    const conditions = [];
    
    // Always filter deleted records first (indexed column)
    conditions.push(isNull(schema.propostas.deletedAt));
    
    // Indexed filters should come first
    if (filters.lojaId) {
      conditions.push(eq(schema.propostas.lojaId, filters.lojaId));
    }
    
    if (filters.status) {
      conditions.push(inArray(schema.propostas.status, filters.status));
    }
    
    // Date range filters (if indexed)
    if (filters.dateRange) {
      conditions.push(
        and(
          sql`${schema.propostas.createdAt} >= ${filters.dateRange.start}`,
          sql`${schema.propostas.createdAt} <= ${filters.dateRange.end}`
        )
      );
    }
    
    return and(...conditions);
  }
  
  /**
   * Optimize pagination with cursor-based approach
   */
  static buildCursorPagination(cursor?: string, limit = 20) {
    const conditions = [];
    
    if (cursor) {
      // Cursor-based pagination is more efficient than OFFSET
      conditions.push(sql`${schema.propostas.createdAt} < ${cursor}`);
    }
    
    return {
      where: and(...conditions),
      limit: limit + 1, // Fetch one extra to check if there's more
      orderBy: desc(schema.propostas.createdAt),
    };
  }
}

// Export types for enhanced type safety
export type { QueryMetrics };