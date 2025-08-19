/**
 * Database Test Helper
 * PAM V1.0 - Robust Database Cleanup for Integration Tests
 * Date: 19/08/2025
 * 
 * This module provides utilities for managing test database state,
 * ensuring proper cleanup between test runs while respecting foreign key constraints.
 */

import { db } from "../../server/lib/supabase";
import { createServerSupabaseAdminClient } from "../../server/lib/supabase";
import { sql } from "drizzle-orm";
import { parceiros, lojas, produtos, tabelasComerciais, users } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

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
 * Creates a clean test environment with all necessary reference data
 * Uses Supabase Admin Client to bypass RLS policies
 * 
 * @returns Object containing all created test entities
 */
export async function setupTestEnvironment(): Promise<{
  testUserId: string;
  testPartnerId: number;
  testStoreId: number;
  testProductId: number;
  testCommercialTableId: number;
}> {
  const startTime = Date.now();
  console.log("[TEST DB] 🔧 Setting up test environment with Admin Client...");
  
  try {
    // Create Admin Client that bypasses RLS
    const adminClient = createServerSupabaseAdminClient();
    
    // 1. Create test user in auth.users using Admin API
    const testUserId = uuidv4();
    const testEmail = `test-${Date.now()}@test.com`;
    
    console.log("[TEST DB] 👤 Creating test user...");
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: {
        name: "Test User",
        role: "ATENDENTE"
      }
    });
    
    if (authError) {
      console.error("[TEST DB] ❌ Error creating auth user:", authError);
      // If we can't create auth user, use a dummy UUID
      console.log("[TEST DB] ⚠️ Falling back to dummy user ID");
    }
    
    const finalUserId = authUser?.id || testUserId;
    
    // 2. Create test user in public.users table  
    // Note: users table might have different fields - only insert what exists
    try {
      await db.insert(users).values({
        name: "Test User",
        email: testEmail,
        password: "hashed_password", // Required field
        role: "ATENDENTE"
      }).onConflictDoNothing();
    } catch (e) {
      console.log("[TEST DB] ⚠️ User insert skipped (may already exist)");
    }
    
    // 3. Create test partner
    console.log("[TEST DB] 🏢 Creating test partner...");
    const [partner] = await db.insert(parceiros)
      .values({
        razaoSocial: "Test Partner Company",
        cnpj: "12345678000199"
      })
      .returning({ id: parceiros.id });
    
    // 4. Create test store associated with partner  
    console.log("[TEST DB] 🏪 Creating test store...");
    const [store] = await db.insert(lojas)
      .values({
        nomeLoja: "Test Store",
        parceiroId: partner.id,
        endereco: "Test Address"
      })
      .returning({ id: lojas.id });
    
    // 5. Create test product
    console.log("[TEST DB] 📦 Creating test product...");
    const [product] = await db.insert(produtos)
      .values({
        nomeProduto: "Test Product",
        isActive: true
      })
      .returning({ id: produtos.id });
    
    // 6. Create test commercial table
    console.log("[TEST DB] 📊 Creating test commercial table...");
    const [commercialTable] = await db.insert(tabelasComerciais)
      .values({
        nomeTabela: "Test Commercial Table",
        taxaJuros: "1.99",
        prazos: [12, 24, 36],
        comissao: "5.00"
      })
      .returning({ id: tabelasComerciais.id });
    
    const duration = Date.now() - startTime;
    console.log(`[TEST DB] ✅ Test environment setup complete in ${duration}ms`);
    
    return {
      testUserId: finalUserId,
      testPartnerId: partner.id,
      testStoreId: store.id,
      testProductId: product.id,
      testCommercialTableId: commercialTable.id
    };
    
  } catch (error) {
    console.error("[TEST DB] ❌ Error setting up test environment:", error);
    throw error;
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