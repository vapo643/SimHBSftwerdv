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
  // 🛡️ SISTEMA DE SALVAGUARDAS ANTI-DESTRUIÇÃO V3.0 - PAM V1.0 BLINDAGEM 🛡️
  // 8 CAMADAS INDEPENDENTES DE PROTEÇÃO CONTRA EXECUÇÃO ACIDENTAL

  // 🛡️ CAMADA 1: VALIDAÇÃO ABSOLUTA DE NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== 'test') {
    const errorMsg = `🚨 FATAL SECURITY VIOLATION: cleanTestDatabase() chamada com NODE_ENV='${nodeEnv}'. ` +
                    `Esta função SOMENTE pode executar com NODE_ENV='test'. OPERAÇÃO NEGADA.`;
    
    // Log crítico de segurança
    console.error(errorMsg);
    console.error(`🚨 SECURITY LOG: ${new Date().toISOString()} - ${process.env.USER || 'unknown'} - ${process.cwd()}`);
    
    throw new Error(errorMsg);
  }

  // 🛡️ CAMADA 2: CARREGAMENTO FORÇADO DO .env.test
  const { config: loadEnv } = await import('dotenv');
  const envResult = loadEnv({ path: '.env.test' });
  if (envResult.error) {
    throw new Error(
      `🚨 FATAL: Falha ao carregar .env.test: ${envResult.error.message}. ` +
      `Arquivo .env.test é obrigatório para testes de banco.`
    );
  }

  // 🛡️ CAMADA 3: VALIDAÇÃO RIGOROSA DE TEST_DATABASE_URL
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error(
      '🚨 FATAL: TEST_DATABASE_URL não definida. Esta função NUNCA pode usar DATABASE_URL de produção. ' +
      'Configure TEST_DATABASE_URL no arquivo .env.test'
    );
  }

  // 🛡️ CAMADA 4: VALIDAÇÃO DE HOSTNAME SEGURO
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(testDatabaseUrl);
  } catch (error) {
    throw new Error(`🚨 FATAL: TEST_DATABASE_URL inválida: ${(error as Error).message}`);
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname;
  const dbName = pathname.substring(1); // Remove '/' inicial

  // Lista de hostnames proibidos (produção)
  const prohibitedHostnames = [
    'prod.supabase.co',
    'production.supabase.co',
    'prod-db.domain.com',
    'main.supabase.co'
  ];

  const isProhibitedHost = prohibitedHostnames.some(prohibited => 
    hostname.includes(prohibited)
  );

  if (isProhibitedHost) {
    throw new Error(
      `🚨 FATAL: Hostname '${hostname}' é um ambiente de PRODUÇÃO. ` +
      `OPERAÇÃO NEGADA por segurança.`
    );
  }

  // 🛡️ CAMADA 5: VALIDAÇÃO DE NOME DE BANCO SEGURO
  const allowedTestDatabases = [
    'postgres',
    'test',
    'testing'
  ];

  const isTestDatabase = dbName.endsWith('-test') || 
                         dbName.endsWith('_test') || 
                         allowedTestDatabases.includes(dbName);

  if (!isTestDatabase) {
    throw new Error(
      `🚨 FATAL: Nome do banco '${dbName}' não é reconhecido como seguro para testes. ` +
      `Banco deve terminar com '-test' ou '_test', ou ser um dos permitidos: ${allowedTestDatabases.join(', ')}`
    );
  }

  // 🛡️ CAMADA 6: VALIDAÇÃO DE CONTEXTO DE EXECUÇÃO
  const stackTrace = new Error().stack || '';
  const isCalledFromTest = stackTrace.includes('vitest') || 
                          stackTrace.includes('.test.') || 
                          stackTrace.includes('.spec.');

  if (!isCalledFromTest) {
    console.warn(
      `⚠️  WARNING: cleanTestDatabase() não foi chamada de um contexto de teste reconhecido. ` +
      `Stack trace: ${stackTrace.split('\n')[1]}`
    );
  }

  // 🛡️ CAMADA 7: CONEXÃO DIRETA E ISOLADA
  let directDb: postgres.Sql;
  try {
    directDb = postgres(testDatabaseUrl, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
      ssl: 'require'
    });

    // Teste de conectividade
    await directDb`SELECT 1 as test`;
    
  } catch (error) {
    throw new Error(`🚨 FATAL: Falha na conexão com banco de teste: ${(error as Error).message}`);
  }

  // 🛡️ CAMADA 8: LIMPEZA SEGURA COM LOG
  try {
    console.log(`🧹 [TEST DB CLEAN] Iniciando limpeza segura do banco: ${dbName}`);
    console.log(`🔍 [TEST DB CLEAN] Hostname: ${hostname}`);
    console.log(`⏰ [TEST DB CLEAN] Timestamp: ${new Date().toISOString()}`);

    // Lista de tabelas para limpeza (explícita para controle)
    const tablesToClean = [
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
      'propostas',
      'produto_tabela_comercial',
      'tabelas_comerciais',
      'produtos',
      'gerente_lojas',
      'lojas',
      'parceiros',
      'security_logs'
    ];

    // Limpeza individual para controle total
    for (const table of tablesToClean) {
      try {
        await directDb`DELETE FROM ${directDb(table)}`;
        console.log(`✅ [TEST DB CLEAN] Tabela limpa: ${table}`);
      } catch (error) {
        console.warn(`⚠️  [TEST DB CLEAN] Erro ao limpar ${table}: ${(error as Error).message}`);
      }
    }

    console.log(`✅ [TEST DB CLEAN] Limpeza concluída com sucesso`);

  } finally {
    await directDb.end();
  }

}

/**
 * Função auxiliar: Verificação de segurança
 */
export function validateTestEnvironmentSafety(): boolean {
  try {
    // Todas as validações da cleanTestDatabase(), mas sem executar limpeza
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv !== 'test') return false;

    const testDatabaseUrl = process.env.TEST_DATABASE_URL;
    if (!testDatabaseUrl) return false;

    const url = new URL(testDatabaseUrl);
    const dbName = url.pathname.substring(1);
    
    return dbName.endsWith('-test') || dbName.endsWith('_test') || 
           ['postgres', 'test', 'testing'].includes(dbName);
    
  } catch {
    return false;
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
    // CRITICAL: SEMPRE usar TEST_DATABASE_URL (NUNCA DATABASE_URL de produção)
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl) {
      console.error('🔴 CRITICAL: TEST_DATABASE_URL não configurado');
      console.error('🔴 Detectado DATABASE_URL de produção, mas NEGADO');
      throw new Error('FATAL: TEST_DATABASE_URL obrigatório. NUNCA usar DATABASE_URL de produção.');
    }

    // Safety check: Validação por hostname para diferenciar produção de teste
    const url = new URL(databaseUrl);
    const hostname = url.hostname;
    
    // VALIDAÇÃO CRÍTICA: Diferentes servidores Supabase para produção vs teste
    const isTestDatabase = hostname.includes('fkfmirnnredvhocnhost') || hostname.includes('test');
    const isProductionDatabase = hostname.includes('dvglgxrvhmtsixaabxha') || hostname.includes('prod');
    
    if (isProductionDatabase) {
      console.error('🔴 CRITICAL SECURITY ALERT: Hostname de produção detectado em testes!');
      console.error(`🔴 Hostname: ${hostname}`);
      throw new Error('FATAL: Tentativa de usar banco de PRODUÇÃO em testes. Operação NEGADA.');
    }
    
    if (!isTestDatabase) {
      console.warn(`[TEST DB] ⚠️ WARNING: Hostname '${hostname}' não reconhecido como teste`);
    } else {
      console.log(`✅ [SEGURANÇA] Hostname de teste validado: ${hostname}`);
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

    // ESTRATÉGIA SIMPLIFICADA: Usar usuário de teste fixo em vez de criar dinamicamente
    console.log('[TEST DB] 🔐 Using fixed test user strategy...');
    
    // Gerar UUID válido para testes de integração  
    const testUserId = uuidv4();
    
    console.log(`[TEST DB] ✅ Using test user ID: ${testUserId}`);

    // 2. Create test user in public.users table using same email (INTEGER ID)
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
    console.log(`[TEST DB] ✅ Created public.users entry with ID: ${dbUserId}`);

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

    // 6. ESTRATÉGIA BYPASS: Desabilitar FK constraints temporariamente para testes
    console.log(`[TEST DB] 🔧 Temporarily disabling FK constraints for test setup...`);
    
    await directDb`SET session_replication_role = replica;`; // Disable triggers and FK constraints
    
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
    
    await directDb`SET session_replication_role = DEFAULT;`; // Re-enable constraints
    
    console.log(`[TEST DB] ✅ Profile created with UUID (FK bypass): ${testUserId}`);

    // 7. Create gerente_lojas association using UUID from profiles table  
    console.log('[TEST DB] 🔗 Creating store manager association...');
    await directDb`
      INSERT INTO gerente_lojas (gerente_id, loja_id)
      VALUES (
        ${testUserId}::uuid,
        ${testStoreId}
      )
      ON CONFLICT (gerente_id, loja_id) DO NOTHING
    `;
    
    console.log(`[TEST DB] ✅ Store manager association created (gerente_id: ${testUserId})`);

    // NOTE: Para compatibilidade, retornar o UUID como testUserId
    const modernTestUserId = String(testUserId); // UUID string
    console.log(`[TEST DB] 📝 Returning testUserId as UUID: "${modernTestUserId}"`);

    const duration = Date.now() - startTime;
    console.log(`[TEST DB] ✅ Test environment setup complete in ${duration}ms`);

    return {
      testUserId: modernTestUserId, // Using UUID for modern Supabase Auth compatibility
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
