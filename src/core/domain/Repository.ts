/**
 * Base Repository interface for Domain-Driven Design
 * Repositories abstract data access for aggregates
 */
export interface Repository<T> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
