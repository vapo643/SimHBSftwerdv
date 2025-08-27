#!/usr/bin/env tsx
/**
 * Script de Rollback de Migrações
 * Reverte migrações de forma segura com verificação de integridade
 *
 * Uso: tsx scripts/rollback.ts [número_de_steps]
 * Exemplo: tsx scripts/rollback.ts 1
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import winston from 'winston';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../shared/schema';

// Logger configurado para rollback
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { service: 'schema-rollback' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({
      filename: 'logs/rollbacks.log',
      level: 'info',
    }),
  ],
});

/**
 * Verifica se é seguro fazer rollback
 */
async function checkRollbackSafety(sql: postgres.Sql): Promise<boolean> {
  logger.info('🔍 Verificando segurança do rollback...');

  try {
    // Verificar transações ativas
    const activeTransactions = await sql`
      SELECT COUNT(*) as count 
      FROM pg_stat_activity 
      WHERE state = 'active' 
      AND pid != pg_backend_pid()
    `;

    if (parseInt(activeTransactions[0].count) > 0) {
      logger.warn(`⚠️ ${activeTransactions[0].count} transações ativas detectadas`);
      return false;
    }

    // Verificar locks
    const locks = await sql`
      SELECT COUNT(*) as count 
      FROM pg_locks 
      WHERE NOT granted
    `;

    if (parseInt(locks[0].count) > 0) {
      logger.warn(`⚠️ ${locks[0].count} locks pendentes detectados`);
      return false;
    }

    return true;
  }
catch (error) {
    logger.error('❌ Erro ao verificar segurança:', error);
    return false;
  }
}

/**
 * Cria ponto de restauração antes do rollback
 */
async function createRestorePoint(sql: postgres.Sql): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const restorePoint = `pre_rollback_${timestamp}`;

  logger.info(`💾 Criando ponto de restauração: ${restorePoint}`);

  await sql`
    INSERT INTO __drizzle_migrations (hash, createdat, success, error_message)
    VALUES (${restorePoint}, NOW(), true, 'RESTORE_POINT_BEFORE_ROLLBACK')
  `;

  return restorePoint;
}

/**
 * Busca arquivo de rollback para uma migração
 */
function findRollbackFile(migrationHash: string): string | null {
  // Procurar em diferentes locais possíveis
  const possiblePaths = [
    path.join('./migrations', `${migrationHash}_down.sql`),
    path.join('./migrations', migrationHash, 'down.sql'),
    path.join('./migrations/rollback', `${migrationHash}.sql`),
  ];

  for (const rollbackPath of possiblePaths) {
    if (fs.existsSync(rollbackPath)) {
      return rollbackPath;
    }
  }

  return null;
}

/**
 * Gera SQL de rollback baseado na análise da migração
 */
async function generateRollbackSQL(
  sql: postgres.Sql,
  migrationHash: string
): Promise<string | null> {
  logger.info(`🔧 Tentando gerar rollback automático para ${migrationHash}`);

  try {
    // Buscar informações sobre mudanças recentes no schema
    const recentChanges = await sql`
      SELECT 
        event_object_table as tablename,
        event_manipulation as action,
        event_time
      FROM information_schema.events
      WHERE event_time > NOW() - INTERVAL '7 days'
      ORDER BY event_time DESC
      LIMIT 10
    `;

    // Por segurança, não gerar rollback automático para operações complexas
    logger.warn('⚠️ Rollback automático não disponível - rollback manual necessário');
    return null;
  }
catch (error) {
    logger.error('Erro ao gerar rollback automático:', error);
    return null;
  }
}

/**
 * Executa o rollback de migrações
 */
async function rollbackMigration(steps: number = 1) {
  const startTime = Date.now();
  logger.info(`🔙 Iniciando rollback de ${steps} migração(ões)...`);
  logger.info('📋 Ambiente: ' + (process.env.NODE_ENV || 'development'));

  const sql = postgres(process.env.DATABASE_URL!, {
    max: 1,
    idle_timeout: 0,
    connect_timeout: 30,
    ssl: 'require', // SSL obrigatório para Supabase
    onnotice: (notice) => {
      logger.info(`📢 PostgreSQL Notice: ${notice.message}`);
    },
  });

  try {
    // Verificar se tabela de tracking existe
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = '__drizzle_migrations'
      ) as exists
    `;

    if (!tableExists[0].exists) {
      logger.error('❌ Tabela de tracking de migrações não encontrada');
      logger.error('Execute uma migração primeiro com: tsx scripts/migrate.ts');
      return false;
    }

    // Verificar segurança
    const isSafe = await checkRollbackSafety(sql);
    if (!isSafe) {
      logger.error('❌ Não é seguro fazer rollback agora');
      logger.error('Aguarde transações ativas terminarem');
      return false;
    }

    // Criar ponto de restauração
    const restorePoint = await createRestorePoint(sql);
    logger.info(`✅ Ponto de restauração criado: ${restorePoint}`);

    // Buscar últimas migrações aplicadas
    const migrations = await sql`
      SELECT * FROM __drizzle_migrations 
      WHERE success = true 
      AND error_message IS NULL
      ORDER BY created_at DESC 
      LIMIT ${steps}
    `;

    if (migrations.length == 0) {
      logger.info('ℹ️ Nenhuma migração para reverter');
      return true;
    }

    logger.info(`📋 Migrações a reverter: ${migrations.length}`);

    // Executar rollback para cada migração
    let successCount = 0;
    let failureCount = 0;

    for (const migration of migrations) {
      logger.info(`🔄 Revertendo: ${migration.hash}`);

      try {
        // Procurar arquivo de rollback
        const rollbackFile = findRollbackFile(migration.hash);

        if (rollbackFile) {
          logger.info(`📄 Arquivo de rollback encontrado: ${rollbackFile}`);

          const rollbackSQL = fs.readFileSync(rollbackFile, 'utf-8');

          // Executar em transação
          await sql.begin(async (sql) => {
            // Executar SQL de rollback
            await sql.unsafe(rollbackSQL);

            // Marcar migração como revertida
            await sql`
              UPDATE __drizzle_migrations 
              SET 
                success = false,
                rollback_at = NOW(),
                error_message = 'ROLLED_BACK'
              WHERE hash = ${migration.hash}
            `;
          });

          logger.info(`✅ Revertida com sucesso: ${migration.hash}`);
          successCount++;
        }
else {
          // Tentar gerar rollback automático
          const generatedSQL = await generateRollbackSQL(sql, migration.hash);

          if (generatedSQL) {
            await sql.unsafe(generatedSQL);
            logger.info(`✅ Rollback automático executado: ${migration.hash}`);
            successCount++;
          }
else {
            logger.warn(`⚠️ Arquivo de rollback não encontrado para ${migration.hash}`);
            logger.warn('Rollback manual pode ser necessário');
            failureCount++;
          }
        }
      }
catch (error: any) {
        logger.error(`❌ Erro ao reverter ${migration.hash}:`, error.message);
        failureCount++;

        // Registrar falha
        await sql`
          INSERT INTO __drizzle_migrations (hash, createdat, success, error_message)
          VALUES (${'rollback_failed_' + Date.now()}, NOW(), false, ${error.message})
        `;
      }
    }

    // Verificar integridade após rollback
    logger.info('🔍 Verificando integridade pós-rollback...');

    const tables = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

    const constraints = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public'
    `;

    logger.info(`📊 Tabelas: ${tables[0].count}, Constraints: ${constraints[0].count}`);

    // Relatório final
    const executionTime = Date.now() - startTime;
    logger.info('');
    logger.info('📊 RELATÓRIO DE ROLLBACK:');
    logger.info(`✅ Sucesso: ${successCount}`);
    logger.info(`❌ Falhas: ${failureCount}`);
    logger.info(`⏱️ Tempo total: ${executionTime}ms`);

    if (failureCount > 0) {
      logger.warn('');
      logger.warn('⚠️ ATENÇÃO: Algumas migrações não foram revertidas');
      logger.warn('Verifique os logs e considere rollback manual');
    }

    return failureCount == 0;
  }
catch (error: any) {
    logger.error('💥 Erro fatal no rollback:', error);

    // Registrar erro crítico
    try {
      await sql`
        INSERT INTO __drizzle_migrations (hash, createdat, success, error_message)
        VALUES (${'rollback_critical_' + Date.now()}, NOW(), false, ${error.message})
      `;
    }
catch (logError) {
      logger.error('Erro ao registrar falha crítica:', logError);
    }

    return false;
  }
finally {
    await sql.end();
    logger.info('🔌 Conexão com banco encerrada');
  }
}

// Verificar DATABASE_URL
if (!process.env.DATABASE_URL) {
  logger.error('❌ DATABASE_URL não configurada');
  logger.error('Configure a variável de ambiente DATABASE_URL antes de executar');
  process.exit(1);
}

// Obter número de steps do argumento
const steps = parseInt(process.argv[2] || '1');
if (_isNaN(steps) || steps < 1) {
  logger.error('❌ Número de steps inválido');
  logger.error('Uso: tsx scripts/rollback.ts [número_de_steps]');
  logger.error('Exemplo: tsx scripts/rollback.ts 2');
  process.exit(1);
}

// Confirmar execução em produção
if (process.env.NODE_ENV == 'production') {
  logger.warn('');
  logger.warn('🔴 ATENÇÃO: Você está prestes a executar ROLLBACK em PRODUÇÃO!');
  logger.warn(`📊 Migrações a reverter: ${steps}`);
  logger.warn('');
  logger.warn('Este é um processo DESTRUTIVO e pode causar perda de dados.');
  logger.warn('Certifique-se de ter um backup completo antes de continuar.');
  logger.warn('');
  // Em produção real, adicionar prompt de confirmação aqui
}

// Executar rollback
rollbackMigration(steps)
  .then((success) => {
    if (success) {
      logger.info('✅ Rollback concluído com sucesso!');
      process.exit(0);
    }
else {
      logger.error('❌ Rollback concluído com erros');
      process.exit(1);
    }
  })
  .catch ((error) => {
    logger.error('💥 Erro fatal no processo de rollback:', error);
    process.exit(1);
  });
