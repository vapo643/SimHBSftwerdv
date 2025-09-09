/**
 * Database Cleaner - Utilitário para limpeza segura de tabelas
 * Operação Soberania dos Dados - Seeding System V1.0
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Create database connection
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);
import { sql } from 'drizzle-orm';

/**
 * Limpa tabelas específicas em ordem correta (respeitando FKs)
 * ATENÇÃO: Apenas tabelas explicitamente listadas são limpadas por segurança
 */
export class DatabaseCleaner {
  
  static SEEDING_TABLES = [
    'propostas',           // Propostas de empréstimo (dados principais)
    'user_sessions',       // Sessões de usuários
    'gerente_lojas',       // Relacionamento gerentes x lojas
    // NÃO limpar: profiles (vinculado ao Supabase), lojas, parceiros (dados base)
  ];

  static async cleanSeedingTables() {
    console.log('🧹 [DATABASE CLEANER] Iniciando limpeza das tabelas de seeding...');
    
    for (const tableName of this.SEEDING_TABLES) {
      try {
        const result = await db.execute(sql.raw(`DELETE FROM ${tableName};`));
        console.log(`✅ [DATABASE CLEANER] Tabela '${tableName}' limpa`);
      } catch (error) {
        console.warn(`⚠️ [DATABASE CLEANER] Falha ao limpar tabela '${tableName}':`, error.message);
      }
    }
    
    console.log('🏁 [DATABASE CLEANER] Limpeza concluída');
  }

  /**
   * Verificação de segurança - confirma que estamos em ambiente não-produção
   */
  static validateEnvironment() {
    const env = process.env.NODE_ENV;
    
    if (!env || env === 'production') {
      throw new Error('🚨 DATABASE CLEANER: Operação bloqueada - ambiente de produção detectado ou NODE_ENV não definido');
    }
    
    console.log(`✅ [DATABASE CLEANER] Ambiente validado: ${env}`);
    return env;
  }
}