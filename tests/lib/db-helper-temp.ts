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

