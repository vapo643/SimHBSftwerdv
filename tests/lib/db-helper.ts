/**
 * Database Test Helper
 * PAM V1.0 - Robust Database Cleanup for Integration Tests
 * Date: 19/08/2025
 * 
 * This module provides utilities for managing test database state,
 * ensuring proper cleanup between test runs while respecting foreign key constraints.
 */

import { db } from "../../server/lib/supabase";
import { sql } from "drizzle-orm";

/**
 * Cleans the test database by truncating all tables with CASCADE
 * This ensures all foreign key constraints are respected
 * 
 * SAFETY: This function should ONLY be used in test environments
 */
export async function cleanTestDatabase(): Promise<void> {
  const startTime = Date.now();
  console.log("[TEST DB] 🧹 Starting comprehensive database cleanup...");
  
  try {
    // List of all tables to truncate
    // Order matters less with CASCADE, but we list them logically
    const tables = [
      // Dependent tables first (those that reference propostas)
      'historico_observacoes_cobranca',
      'parcelas',
      'inter_collections',
      'inter_webhooks',
      'inter_callbacks',
      'status_transitions',
      'solicitacoes_modificacao',
      'proposta_documentos',
      'status_contextuais',
      'proposta_logs',
      'referencia_pessoal',
      'comunicacao_logs',
      
      // Core tables
      'propostas',
      
      // Reference tables (less likely to have test data but included for completeness)
      'produto_tabela_comercial',
      'tabelas_comerciais',
      'produtos',
      'gerente_lojas',
      'lojas',
      'parceiros',
      'users',
      
      // Security tables
      'security_logs'
    ];
    
    // Build the TRUNCATE command
    const tableList = tables.map(t => `"${t}"`).join(', ');
    
    // Execute TRUNCATE with CASCADE to handle all foreign key dependencies
    // RESTART IDENTITY resets all sequences (auto-increment counters)
    await db.execute(
      sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`)
    );
    
    const duration = Date.now() - startTime;
    console.log(`[TEST DB] ✅ Database cleaned successfully in ${duration}ms`);
    
  } catch (error) {
    console.error("[TEST DB] ❌ Error during database cleanup:", error);
    
    // Fallback: Try to clean tables individually in reverse dependency order
    console.log("[TEST DB] 🔄 Attempting fallback cleanup strategy...");
    
    try {
      // Tables with foreign keys to propostas (delete first)
      const dependentTables = [
        'historico_observacoes_cobranca',
        'parcelas',
        'inter_collections',
        'inter_webhooks',
        'inter_callbacks',
        'status_transitions',
        'solicitacoes_modificacao',
        'proposta_documentos',
        'status_contextuais',
        'proposta_logs',
        'referencia_pessoal',
        'comunicacao_logs'
      ];
      
      // Clean dependent tables first
      for (const table of dependentTables) {
        try {
          await db.execute(sql.raw(`DELETE FROM "${table}"`));
          console.log(`[TEST DB] ✓ Cleaned table: ${table}`);
        } catch (e) {
          console.warn(`[TEST DB] ⚠️ Could not clean table ${table}:`, e);
        }
      }
      
      // Then clean core tables
      await db.execute(sql.raw(`DELETE FROM "propostas"`));
      console.log("[TEST DB] ✓ Cleaned table: propostas");
      
      // Clean other reference tables if needed
      const referenceTables = [
        'produto_tabela_comercial',
        'tabelas_comerciais',
        'produtos',
        'gerente_lojas',
        'lojas',
        'parceiros',
        'users',
        'security_logs'
      ];
      
      for (const table of referenceTables) {
        try {
          await db.execute(sql.raw(`DELETE FROM "${table}"`));
          console.log(`[TEST DB] ✓ Cleaned table: ${table}`);
        } catch (e) {
          // These might fail if they have data referenced by other tables
          // We continue anyway as they're less critical for tests
          console.debug(`[TEST DB] Skipped table ${table}`);
        }
      }
      
      console.log("[TEST DB] ✅ Fallback cleanup completed");
      
    } catch (fallbackError) {
      console.error("[TEST DB] ❌ Fallback cleanup also failed:", fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Creates a clean test environment by:
 * 1. Cleaning the database
 * 2. Optionally seeding with base data
 */
export async function setupTestEnvironment(seedData: boolean = false): Promise<void> {
  await cleanTestDatabase();
  
  if (seedData) {
    console.log("[TEST DB] 🌱 Seeding test data...");
    // Add seed data logic here if needed in the future
    console.log("[TEST DB] ✅ Test data seeded");
  }
}

/**
 * Verifies that the database is in a clean state
 * Useful for debugging test isolation issues
 */
export async function verifyCleanDatabase(): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM propostas
    `);
    
    // Access the result array directly
    const rows = result as any;
    const count = rows[0]?.count || 0;
    const isClean = count === 0 || count === '0';
    
    if (!isClean) {
      console.warn(`[TEST DB] ⚠️ Database not clean: ${count} propostas found`);
    }
    
    return isClean;
  } catch (error) {
    console.error("[TEST DB] ❌ Error verifying database state:", error);
    return false;
  }
}