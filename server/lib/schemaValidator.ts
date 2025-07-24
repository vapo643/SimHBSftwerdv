
import { db } from "./supabase";
import { users, propostas, lojas, parceiros, gerenteLojas } from "@shared/schema";
import { sql } from "drizzle-orm";

export interface ValidationError {
  type: 'error' | 'warning';
  table: string;
  field?: string;
  message: string;
  suggestion?: string;
}

export interface ValidationReport {
  isValid: boolean;
  timestamp: string;
  errors: ValidationError[];
  warnings: ValidationError[];
  tablesChecked: string[];
  totalChecks: number;
}

export class SchemaValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private tablesChecked: string[] = [];

  /**
   * Main validation method that orchestrates all checks
   */
  async validateDatabaseSync(): Promise<ValidationReport> {
    console.log('[SchemaValidator] Starting database schema validation...');
    
    this.errors = [];
    this.warnings = [];
    this.tablesChecked = [];

    try {
      // Check if all expected tables exist
      await this.validateTablesExist();
      
      // Check if all expected methods are implemented in storage
      await this.validateStorageMethods();
      
      // Check for orphaned relationships
      await this.validateRelationshipIntegrity();
      
      // Check for missing indexes (performance)
      await this.validatePerformanceIndexes();
      
      const report: ValidationReport = {
        isValid: this.errors.length === 0,
        timestamp: new Date().toISOString(),
        errors: this.errors,
        warnings: this.warnings,
        tablesChecked: this.tablesChecked,
        totalChecks: this.errors.length + this.warnings.length,
      };

      console.log(`[SchemaValidator] Validation complete. Status: ${report.isValid ? 'HEALTHY' : 'ISSUES_FOUND'}`);
      console.log(`[SchemaValidator] Errors: ${this.errors.length}, Warnings: ${this.warnings.length}`);
      
      return report;
    } catch (error) {
      console.error('[SchemaValidator] Critical error during validation:', error);
      
      return {
        isValid: false,
        timestamp: new Date().toISOString(),
        errors: [{
          type: 'error',
          table: 'system',
          message: `Critical validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          suggestion: 'Check database connectivity and schema integrity'
        }],
        warnings: [],
        tablesChecked: [],
        totalChecks: 1,
      };
    }
  }

  /**
   * Validate that all expected tables exist in the database
   */
  private async validateTablesExist(): Promise<void> {
    const expectedTables = ['users', 'propostas', 'lojas', 'parceiros', 'gerente_lojas'];
    
    for (const tableName of expectedTables) {
      try {
        // Try to query information_schema to check table existence
        const result = await db.execute(sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        `);
        
        if (result.rowCount === 0) {
          this.errors.push({
            type: 'error',
            table: tableName,
            message: `Table '${tableName}' does not exist in database`,
            suggestion: `Run database migrations to create missing table`
          });
        } else {
          this.tablesChecked.push(tableName);
        }
      } catch (error) {
        this.errors.push({
          type: 'error',
          table: tableName,
          message: `Failed to check existence of table '${tableName}': ${error}`,
          suggestion: 'Verify database connectivity and permissions'
        });
      }
    }
  }

  /**
   * Validate that storage methods are properly implemented
   */
  private async validateStorageMethods(): Promise<void> {
    const { storage } = await import("../storage");
    
    // Test critical methods that were previously missing
    const methodTests = [
      {
        name: 'getUsers',
        test: async () => {
          const result = await storage.getUsers();
          return Array.isArray(result);
        }
      },
      {
        name: 'getLojas', 
        test: async () => {
          const result = await storage.getLojas();
          return Array.isArray(result);
        }
      },
      {
        name: 'getPropostas',
        test: async () => {
          const result = await storage.getPropostas();
          return Array.isArray(result);
        }
      }
    ];

    for (const methodTest of methodTests) {
      try {
        const isValid = await methodTest.test();
        if (!isValid) {
          this.errors.push({
            type: 'error',
            table: 'storage',
            field: methodTest.name,
            message: `Storage method '${methodTest.name}()' returned invalid result`,
            suggestion: `Check implementation of ${methodTest.name} method in storage.ts`
          });
        }
      } catch (error) {
        this.errors.push({
          type: 'error',
          table: 'storage',
          field: methodTest.name,
          message: `Storage method '${methodTest.name}()' failed: ${error}`,
          suggestion: `Implement or fix ${methodTest.name} method in storage.ts`
        });
      }
    }
  }

  /**
   * Validate relationship integrity between tables
   */
  private async validateRelationshipIntegrity(): Promise<void> {
    try {
      // Check for orphaned lojas (lojas without valid parceiros)
      const orphanedLojas = await db.execute(sql`
        SELECT l.id, l.nome_loja 
        FROM lojas l 
        LEFT JOIN parceiros p ON l.parceiro_id = p.id 
        WHERE p.id IS NULL AND l.is_active = true
      `);

      if (orphanedLojas.rowCount && orphanedLojas.rowCount > 0) {
        this.warnings.push({
          type: 'warning',
          table: 'lojas',
          message: `Found ${orphanedLojas.rowCount} active lojas with missing parceiro references`,
          suggestion: 'Review and fix foreign key relationships'
        });
      }

      // Check for orphaned gerente_lojas relationships
      const orphanedGerenteLojas = await db.execute(sql`
        SELECT gl.gerente_id, gl.loja_id 
        FROM gerente_lojas gl 
        LEFT JOIN lojas l ON gl.loja_id = l.id 
        WHERE l.id IS NULL
      `);

      if (orphanedGerenteLojas.rowCount && orphanedGerenteLojas.rowCount > 0) {
        this.warnings.push({
          type: 'warning',
          table: 'gerente_lojas',
          message: `Found ${orphanedGerenteLojas.rowCount} gerente-loja relationships with missing loja references`,
          suggestion: 'Clean up orphaned gerente-loja relationships'
        });
      }

    } catch (error) {
      this.warnings.push({
        type: 'warning',
        table: 'relationships',
        message: `Could not validate relationship integrity: ${error}`,
        suggestion: 'Check database permissions for cross-table queries'
      });
    }
  }

  /**
   * Validate performance indexes exist
   */
  private async validatePerformanceIndexes(): Promise<void> {
    const expectedIndexes = [
      { table: 'propostas', column: 'status', reason: 'Frequently filtered by status' },
      { table: 'lojas', column: 'parceiro_id', reason: 'Foreign key relationship' },
      { table: 'users', column: 'email', reason: 'Login queries' },
    ];

    for (const index of expectedIndexes) {
      try {
        const result = await db.execute(sql`
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = ${index.table} 
          AND indexdef ILIKE '%' || ${index.column} || '%'
        `);

        if (result.rowCount === 0) {
          this.warnings.push({
            type: 'warning',
            table: index.table,
            field: index.column,
            message: `Missing performance index on ${index.table}.${index.column}`,
            suggestion: `Consider adding index: CREATE INDEX idx_${index.table}_${index.column} ON ${index.table}(${index.column})`
          });
        }
      } catch (error) {
        // Index checks are non-critical, just log as warning
        console.warn(`[SchemaValidator] Could not check index for ${index.table}.${index.column}:`, error);
      }
    }
  }
}
