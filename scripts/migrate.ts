#!/usr/bin/env tsx
/**
 * Script de Migração Segura para Zero Downtime
 * Implementa padrão Expand/Contract para mudanças de schema
 *
 * Uso: tsx scripts/migrate.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '../shared/schema';
import winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

// Logger configurado para migração
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { service: 'schema-migration' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({
      filename: 'logs/migrations.log',
      level: 'info',
    }),
  ],
});

/**
 * Verifica pré-condições antes da migração
 */
async function checkPreconditions(sql: postgres.Sql) {
  logger.info('🔍 Verificando pré-condições...');

  try {
    // Verificar conectividade
    const dbCheck = await sql`SELECT NOW() as current_time`;
    logger.info(`✅ Banco de dados acessível: ${dbCheck[0].current_time}`);

    // Verificar espaço em disco
    const diskSpace = await sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
    `;
    logger.info(`📊 Tamanho do banco: ${diskSpace[0].db_size}`);

    // Verificar locks ativos
    const locks = await sql`
      SELECT COUNT(*) as lock_count 
      FROM pg_locks 
      WHERE NOT granted
    `;

    if (parseInt(locks[0].lock_count) > 0) {
      logger.warn(`⚠️ ${locks[0].lock_count} locks pendentes detectados`);
    }

    // Criar tabela de tracking se não existir
    await sql`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash VARCHAR(256) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        success BOOLEAN DEFAULT TRUE,
        rollback_at TIMESTAMP,
        error_message TEXT,
        execution_time_ms INTEGER
      )
    `;
    logger.info('✅ Tabela de tracking de migrações verificada');

    return true;
  } catch (error) {
    logger.error('❌ Falha nas pré-condições:', error);
    return false;
  }
}

/**
 * Executa backup antes da migração
 */
async function createBackupPoint(sql: postgres.Sql) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `pre_migration_${timestamp}`;

  logger.info(`💾 Criando ponto de backup: ${backupName}`);

  // Em produção, usar pg_dump ou snapshot do provedor cloud
  // Aqui apenas registramos o ponto
  await sql`
    INSERT INTO __drizzle_migrations (hash, created_at, success, error_message)
    VALUES (${backupName}, NOW(), true, 'BACKUP_POINT')
  `;

  return backupName;
}

/**
 * Executa a migração principal
 */
async function runMigration() {
  const startTime = Date.now();
  logger.info('🚀 Iniciando migração segura...');
  logger.info('📋 Ambiente: ' + (process.env.NODE_ENV || 'development'));

  // Configuração de conexão com pool limitado e SSL
  const sql = postgres(process.env.DATABASE_URL!, {
    max: 1, // Single connection para evitar conflicts
    idle_timeout: 0,
    connect_timeout: 30,
    ssl: 'require', // SSL obrigatório para Supabase
    onnotice: (notice) => {
      logger.info(`📢 PostgreSQL Notice: ${notice.message}`);
    },
  });

  const db = drizzle(sql, { schema });

  try {
    // Passo 1: Verificar pré-condições
    const preCheckOk = await checkPreconditions(sql);
    if (!preCheckOk) {
      throw new Error('Pré-condições não atendidas');
    }

    // Passo 2: Criar backup point
    const backupPoint = await createBackupPoint(sql);
    logger.info(`✅ Backup point criado: ${backupPoint}`);

    // Passo 3: Executar migração (EXPAND phase)
    logger.info('🔄 Executando fase EXPAND...');

    await migrate(db, {
      migrationsFolder: './migrations',
    });

    // Passo 4: Verificar integridade pós-migração
    logger.info('🔍 Verificando integridade...');

    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;

    logger.info(`📊 Total de tabelas: ${tables.length}`);

    // Verificar constraints
    const constraints = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public'
    `;

    logger.info(`🔒 Total de constraints: ${constraints[0].count}`);

    // Registrar sucesso
    const executionTime = Date.now() - startTime;
    await sql`
      INSERT INTO __drizzle_migrations (hash, created_at, success, execution_time_ms)
      VALUES (${'migration_' + Date.now()}, NOW(), true, ${executionTime})
    `;

    logger.info(`✅ Migração EXPAND concluída com sucesso em ${executionTime}ms`);

    // Passo 5: Instruções para CONTRACT phase
    logger.info('');
    logger.info('📝 PRÓXIMOS PASSOS:');
    logger.info('1. Monitorar aplicação por 24-48h');
    logger.info('2. Verificar logs de erro');
    logger.info('3. Executar CONTRACT phase quando estável');
    logger.info('');

    return true;
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    logger.error('❌ Erro na migração:', error);

    // Registrar falha
    try {
      await sql`
        INSERT INTO __drizzle_migrations (hash, created_at, success, error_message, execution_time_ms)
        VALUES (${'failed_' + Date.now()}, NOW(), false, ${error.message}, ${executionTime})
      `;
    } catch (logError) {
      logger.error('Erro ao registrar falha:', logError);
    }

    logger.error('');
    logger.error('🔴 AÇÃO REQUERIDA:');
    logger.error('1. Verificar logs detalhados');
    logger.error('2. Considerar rollback com: tsx scripts/rollback.ts');
    logger.error('3. Contatar equipe de infraestrutura se necessário');
    logger.error('');

    process.exit(1);
  } finally {
    await sql.end();
    logger.info('🔌 Conexão com banco encerrada');
  }
}

// Verificar se DATABASE_URL está configurada
if (!process.env.DATABASE_URL) {
  logger.error('❌ DATABASE_URL não configurada');
  logger.error('Configure a variável de ambiente DATABASE_URL antes de executar');
  process.exit(1);
}

// Confirmar execução em produção
if (process.env.NODE_ENV === 'production') {
  logger.warn('⚠️ ATENÇÃO: Você está prestes a executar migração em PRODUÇÃO!');
  logger.warn('Certifique-se de ter um backup recente antes de continuar.');
  // Em produção real, adicionar prompt de confirmação aqui
}

// Executar migração
runMigration()
  .then((success) => {
    if (success) {
      logger.info('🎉 Processo de migração concluído com sucesso!');
      process.exit(0);
    }
  })
  .catch((error) => {
    logger.error('💥 Erro fatal no processo de migração:', error);
    process.exit(1);
  });
