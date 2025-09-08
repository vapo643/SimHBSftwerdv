/**
 * Tipos compartilhados para paginação baseada em cursor
 * Implementação Banking-Grade conforme PAM V1.0
 */

export interface PaginatedResult<T> {
  /** Dados da página atual */
  data: T[];

  /** Metadados de paginação */
  pagination: {
    /** Cursor para a próxima página (null se for a última) */
    nextCursor: string | null;

    /** Cursor para a página anterior (null se for a primeira) */
    prevCursor: string | null;

    /** Total de itens na página atual */
    pageSize: number;

    /** Indica se há mais páginas após esta */
    hasNextPage: boolean;

    /** Indica se há páginas anteriores a esta */
    hasPrevPage: boolean;
  };
}

export interface CursorPaginationOptions {
  /** Número máximo de itens por página (padrão: 50, máximo: 100) */
  limit?: number;

  /** Cursor para buscar itens após este ponto */
  cursor?: string;

  /** Campo a ser usado como cursor (padrão: 'created_at') */
  cursorField?: 'created_at' | 'updated_at' | 'id';

  /** Direção da ordenação (padrão: 'desc') */
  direction?: 'asc' | 'desc';
}

export interface RepositoryFilters {
  /** Filtros por status */
  status?: string | string[];

  /** Filtros por data de criação */
  createdAfter?: Date;
  createdBefore?: Date;

  /** Filtros por data de atualização */
  updatedAfter?: Date;
  updatedBefore?: Date;

  /** Filtros específicos por entidade */
  [key: string]: any;
}

/**
 * Utilitários para construção de cursors
 */
export class CursorUtils {
  /**
   * Codifica um valor em cursor base64
   */
  static encode(value: string | number | Date): string {
    const stringValue = value instanceof Date ? value.toISOString() : String(value);
    return Buffer.from(stringValue, 'utf-8').toString('base64');
  }

  /**
   * Decodifica um cursor base64 para valor original
   */
  static decode(cursor: string): string {
    try {
      return Buffer.from(cursor, 'base64').toString('utf-8');
    } catch (error) {
      throw new Error('Cursor inválido');
    }
  }

  /**
   * Valida se um cursor é válido
   */
  static isValid(cursor: string): boolean {
    try {
      this.decode(cursor);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cria um cursor a partir de um item
   */
  static createFromItem(item: any, field: string): string {
    const value = item[field];
    if (value === null || value === undefined) {
      throw new Error(`Campo ${field} não encontrado no item para criação do cursor`);
    }
    return this.encode(value);
  }
}
