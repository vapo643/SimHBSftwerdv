/**
 * Database Test Helper
 * PAM V1.0 - Robust Database Cleanup for Integration Tests
 * Date: 19/08/2025
 *
 * This module provides utilities for managing test database state,
 * ensuring proper cleanup between test runs while respecting foreign key constraints.
 */

import { db } from '../../server/lib/supabase';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';

/**
 * Cleans the test database by truncating all tables with CASCADE
 * This ensures all foreign key constraints are respected
 *
 * SAFETY: This function should ONLY be used in test environments
 */
export async function cleanTestDatabase(): Promise<void> {
  // 🚨 SISTEMA DE SALVAGUARDAS ANTI-DESTRUIÇÃO V2.0 - REM-DDD-01.3 🚨
  // MÚLTIPLAS CAMADAS DE PROTEÇÃO CONTRA EXECUÇÃO ACIDENTAL

  // Proteção 1: NODE_ENV DEVE ser explicitamente 'test' (não apenas "não-production")
  if (process.env.NODE_ENV !== 'test') {
    console.error(
      `🔴 CRITICAL SECURITY ALERT: NODE_ENV='${process.env.NODE_ENV}' - deve ser 'test'`
    );
    throw new Error(
      `FATAL: NODE_ENV='${process.env.NODE_ENV}' - Esta função só pode executar com NODE_ENV='test'. Operação abortada para proteger dados.`
    );
  }

  // Proteção 2: DATABASE_URL deve estar configurado
  const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    console.error('🔴 CRITICAL SECURITY ALERT: DATABASE_URL não está configurado');
    throw new Error(
      'FATAL: DATABASE_URL não configurado. Use um banco de dados de teste dedicado. Operação abortada.'
    );
  }

  // Proteção 3: VERIFICAÇÃO MANDATÓRIA DO NOME DO BANCO (NOVO - REM-DDD-01.3)
  try {
    const url = new URL(databaseUrl);
    const dbName = url.pathname.substring(1); // Remove leading '/'
    
    if (!dbName.endsWith('-test')) {
      console.error(
        `🔴 CRITICAL SECURITY ALERT: Nome do banco '${dbName}' NÃO termina com '-test'`
      );
      throw new Error(
        `FATAL: Nome do banco '${dbName}' deve terminar com '-test' para execução de limpeza. Operação abortada para proteger dados.`
      );
    }
    
    console.log(`✅ [SEGURANÇA] Nome do banco validado: '${dbName}' (termina com '-test')`);
  } catch (urlError) {
    console.error(`🔴 CRITICAL SECURITY ALERT: Erro ao analisar DATABASE_URL: ${urlError}`);
    throw new Error(
      'FATAL: Não foi possível validar o nome do banco de dados. Operação abortada para proteger dados.'
    );
  }

  // Proteção 4: VERIFICAÇÃO DE HOSTNAME PROIBIDO (NOVO - REM-DDD-01.3)
  try {
    const url = new URL(databaseUrl);
    const hostname = url.hostname.toLowerCase();
    
    // Lista de hostnames de produção conhecidos (expandir conforme necessário)
    const forbiddenHosts = [
      'prod-db.simpix.com',
      'production-database.simpix.com',
      'simpix-prod.database.azure.com',
      'live-db.simpix.com'
    ];
    
    const detectedForbiddenHost = forbiddenHosts.find(host => hostname.includes(host));
    
    if (detectedForbiddenHost) {
      console.error(
        `🔴 CRITICAL SECURITY ALERT: Hostname '${hostname}' está na lista de hosts proibidos: '${detectedForbiddenHost}'`
      );
      throw new Error(
        `FATAL: Hostname '${hostname}' é um servidor de produção conhecido. Operação abortada para proteger dados.`
      );
    }
    
    console.log(`✅ [SEGURANÇA] Hostname validado: '${hostname}' (não está na lista proibida)`);
  } catch (urlError) {
    console.error(`🔴 CRITICAL SECURITY ALERT: Erro ao analisar hostname: ${urlError}`);
    throw new Error(
      'FATAL: Não foi possível validar o hostname do banco de dados. Operação abortada para proteger dados.'
    );
  }

  // Proteção 5: Rejeitar URLs de produção conhecidas por padrões (mantida da V1.0)
  const prodPatterns = ['prod', 'production', 'azure', 'live', 'main'];
  const dbUrl = databaseUrl.toLowerCase();
  const detectedProdPattern = prodPatterns.find((pattern) => dbUrl.includes(pattern));

  if (detectedProdPattern) {
    console.error(
      `🔴 CRITICAL SECURITY ALERT: DATABASE_URL contém padrão de produção: '${detectedProdPattern}'`
    );
    throw new Error(
      `FATAL: DATABASE_URL parece ser de produção (contém '${detectedProdPattern}'). Operação abortada.`
    );
  }

  const startTime = Date.now();
  
  // 🚨 LOGS DE ALERTA DE ALTA VISIBILIDADE (NOVO - REM-DDD-01.3) 🚨
  console.warn('');
  console.warn('⚠️ ========================================= ⚠️');
  console.warn('⚠️  ALERTA: EXECUTANDO LIMPEZA DE BANCO DE DADOS DE TESTE  ⚠️');
  console.warn('⚠️ ========================================= ⚠️');
  console.warn(`⚠️  BANCO: ${process.env.DATABASE_URL || 'N/A'}`);
  console.warn(`⚠️  NODE_ENV: ${process.env.NODE_ENV}`);
  console.warn('⚠️  TODAS AS TABELAS SERÃO TRUNCADAS COM CASCADE!');
  console.warn('⚠️ ========================================= ⚠️');
  console.warn('');
  
  console.log('[TEST DB] 🧹 Starting comprehensive database cleanup...');

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
      'security_logs',
    ];

    // Build the TRUNCATE command
    const tableList = tables.map((t) => `"${t}"`).join(', ');

    // Execute TRUNCATE with CASCADE to handle all foreign key dependencies
    // RESTART IDENTITY resets all sequences (auto-increment counters)
    await db.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`));

    const duration = Date.now() - startTime;
    console.log(`[TEST DB] ✅ Database cleaned successfully in ${duration}ms`);
  } catch (error) {
    console.error('[TEST DB] ❌ Error during database cleanup:', error);

    // Fallback: Try to clean tables individually in reverse dependency order
    console.log('[TEST DB] 🔄 Attempting fallback cleanup strategy...');

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
        'comunicacao_logs',
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
      console.log('[TEST DB] ✓ Cleaned table: propostas');

      // Clean other reference tables if needed
      const referenceTables = [
        'produto_tabela_comercial',
        'tabelas_comerciais',
        'produtos',
        'gerente_lojas',
        'lojas',
        'parceiros',
        'users',
        'security_logs',
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

      console.log('[TEST DB] ✅ Fallback cleanup completed');
    } catch (fallbackError) {
      console.error('[TEST DB] ❌ Fallback cleanup also failed:', fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Creates a clean test environment with all necessary reference data
 * Uses direct postgres connection to bypass ALL Supabase restrictions
 *
 * @returns Object containing all created test entities
 */
export async function setupTestEnvironment(): Promise<{
  testUserId: string;
  testEmail: string;
  testPassword: string;
  testPartnerId: number;
  testStoreId: number;
  testProductId: number;
  testCommercialTableId: number;
}> {
  const startTime = Date.now();
  console.log('[TEST DB] 🔧 Setting up test environment with direct postgres connection...');

  let directDb: postgres.Sql;

  try {
    // Create direct postgres connection - bypasses ALL application layer restrictions
    // CRITICAL: Uses TEST_DATABASE_URL from .env.test when available (mapped to DATABASE_URL in setup.ts)
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not found in environment variables');
    }

    // Safety check: Warn if database doesn't appear to be a test database
    if (!databaseUrl.includes('test')) {
      console.warn(
        "[TEST DB] ⚠️ WARNING: Database URL doesn't contain 'test' - ensure you're using a test database!"
      );
    }

    // Connect with the same configuration as server/lib/supabase.ts
    let correctedUrl = databaseUrl;
    if (!correctedUrl.includes('sslmode=')) {
      correctedUrl += correctedUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
    }
    if (correctedUrl.includes(':5432')) {
      correctedUrl = correctedUrl.replace(':5432', ':6543');
    }

    directDb = postgres(correctedUrl, {
      ssl: 'require',
      max: 1, // Single connection for tests
      transform: postgres.camel,
    });

    console.log('[TEST DB] 🔌 Direct postgres connection established');

    // Create test user using Supabase Admin for proper authentication
    console.log('[TEST DB] 🔐 Creating Supabase auth user...');
    const timestamp = Date.now();
    const testEmail = `test-${timestamp}@simpix.com`; // Unique email for each test run
    const testPassword = 'TestPassword123!';

    // Import and use Supabase Admin Client
    const { createServerSupabaseAdminClient } = await import('../../server/lib/supabase');
    const supabaseAdmin = createServerSupabaseAdminClient();

    // Create new auth user with unique email (no deletion needed)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        name: 'Integration Test User',
        role: 'ATENDENTE',
      },
    });

    if (authError || !authUser.user) {
      throw new Error(`Failed to create Supabase auth user: ${authError?.message}`);
    }

    const testUserId = authUser.user.id;
    console.log(`[TEST DB] ✅ Supabase auth user created: ${testUserId}`);

    // 2. Create test user in public.users table using same email
    console.log('[TEST DB] 👤 Creating public.users entry...');
    const userResult = await directDb`
      INSERT INTO users (name, email, password, role)
      VALUES (
        'Integration Test User',
        ${testEmail},
        'hashed_password_test',
        'ATENDENTE'
      )
      ON CONFLICT (email) DO UPDATE SET
        name = 'Integration Test User',
        role = 'ATENDENTE'
      RETURNING id
    `;
    const dbUserId = userResult[0].id;

    // 3. Create test partner using raw SQL (with timestamp for uniqueness)
    console.log('[TEST DB] 🏢 Creating test partner...');
    const partnerResult = await directDb`
      INSERT INTO parceiros (razao_social, cnpj)
      VALUES (
        'Test Partner Company',
        ${`1234567800019${timestamp.toString().slice(-1)}`}
      )
      ON CONFLICT (cnpj) DO UPDATE SET
        razao_social = EXCLUDED.razao_social
      RETURNING id
    `;
    const testPartnerId = partnerResult[0].id;

    // 3. Create test store using raw SQL
    console.log('[TEST DB] 🏪 Creating test store...');
    const storeResult = await directDb`
      INSERT INTO lojas (nome_loja, parceiro_id, endereco)
      VALUES (
        'Test Store',
        ${testPartnerId},
        'Test Address'
      )
      RETURNING id
    `;
    const testStoreId = storeResult[0].id;

    // 5. Create test product using raw SQL (with timestamp for uniqueness)
    console.log('[TEST DB] 📦 Creating test product...');
    const productResult = await directDb`
      INSERT INTO produtos (nome_produto, is_active)
      VALUES (
        ${`Test Product ${timestamp}`},
        true
      )
      RETURNING id
    `;
    const testProductId = productResult[0].id;

    // 6. Create test commercial table using raw SQL (with timestamp for uniqueness)
    console.log('[TEST DB] 📊 Creating test commercial table...');
    const commercialTableResult = await directDb`
      INSERT INTO tabelas_comerciais (nome_tabela, taxa_juros, prazos, comissao)
      VALUES (
        ${`Test Commercial Table ${timestamp}`},
        '1.99',
        ARRAY[12, 24, 36],
        '5.00'
      )
      RETURNING id
    `;
    const testCommercialTableId = commercialTableResult[0].id;

    // 6. Create profile linking auth.users to store with proper RBAC role
    console.log(`[TEST DB] 👤 Creating user profile for testUserId: ${testUserId}...`);

    const profileInsertResult = await directDb`
      INSERT INTO profiles (id, role, loja_id, full_name)
      VALUES (
        ${testUserId},
        'ATENDENTE',
        ${testStoreId},
        'Integration Test User'
      )
      ON CONFLICT (id) DO UPDATE SET
        role = 'ATENDENTE',
        loja_id = EXCLUDED.loja_id,
        full_name = 'Integration Test User'
      RETURNING id, role, loja_id, full_name
    `;

    console.log(`[TEST DB] ✅ Profile insertion result:`, profileInsertResult[0]);

    // Verify the profile was created by querying it back
    const verifyProfile = await directDb`
      SELECT id, role, loja_id, full_name 
      FROM profiles 
      WHERE id = ${testUserId}
    `;

    console.log(`[TEST DB] 🔍 Profile verification query result:`, verifyProfile[0]);
    console.log(`[TEST DB] ✅ Profile created with ATENDENTE role for RBAC permissions`);

    // 7. Create gerente_lojas association for RLS (using UUID for gerente_id)
    console.log('[TEST DB] 🔗 Creating store manager association...');
    await directDb`
      INSERT INTO gerente_lojas (gerente_id, loja_id)
      VALUES (
        ${testUserId}::uuid,
        ${testStoreId}
      )
      ON CONFLICT (gerente_id, loja_id) DO NOTHING
    `;

    const duration = Date.now() - startTime;
    console.log(`[TEST DB] ✅ Test environment setup complete in ${duration}ms`);

    return {
      testUserId,
      testEmail,
      testPassword,
      testPartnerId,
      testStoreId,
      testProductId,
      testCommercialTableId,
    };
  } catch (error) {
    console.error('[TEST DB] ❌ Error setting up test environment:', error);
    throw error;
  } finally {
    // Always close the direct connection
    if (directDb!) {
      await directDb.end();
      console.log('[TEST DB] 🔌 Direct postgres connection closed');
    }
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
    console.error('[TEST DB] ❌ Error verifying database state:', error);
    return false;
  }
}
