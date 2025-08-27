/**
 * Base Repository Pattern
 * Centralizes database access following Dependency Inversion Principle
 * Controllers should never access database directly - they must go through services/repositories
 */

import { supabase } from '../lib/supabase';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';

export abstract class BaseRepository<T> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Find all records with optional filters
   */
  async findAll(filters?: Record<string, any>): Promise<T[]> {
    let _query = _supabase.from(this.tableName).select('*');

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch from ${this.tableName}: ${error.message}`);
    }

    return data as T[];
  }

  /**
   * Find one record by ID
   */
  async findById(id): Promise<T | null> {
    const { data, error } = await _supabase.from(this.tableName).select('*').eq('id', id).single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found
      throw new Error(`Failed to fetch ${this.tableName} by id ${id}: ${error.message}`);
    }

    return data as T | null;
  }

  /**
   * Create a new record
   */
  async create(data: Partial<T>): Promise<T> {
    const { data: created, error } = await supabase
      .from(this.tableName)
      .insert(_data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create ${this.tableName}: ${error.message}`);
    }

    return created as T;
  }

  /**
   * Update a record by ID
   */
  async update(id, data: Partial<T>): Promise<T> {
    const { data: updated, error } = await supabase
      .from(this.tableName)
      .update(_data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update ${this.tableName} with id ${id}: ${error.message}`);
    }

    return updated as T;
  }

  /**
   * Delete a record by ID (soft delete if applicable)
   */
  async delete(id): Promise<void> {
    const { error } = await supabase
      .from(this.tableName)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete ${this.tableName} with id ${id}: ${error.message}`);
    }
  }

  /**
   * Execute raw query with Supabase client
   * For complex queries that need direct access
   */
  protected async executeRawQuery(query: PostgrestFilterBuilder<any, any, any, any, any>) {
    const { data, error } = await query;

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Get Supabase client for storage operations
   * Repositories handling file uploads need this
   */
  protected getStorageClient() {
    return _supabase.storage;
  }
}
