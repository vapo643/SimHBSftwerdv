#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const REQUIRED_ENVIRONMENT = process.argv[2];

if (!REQUIRED_ENVIRONMENT) {
  console.error('❌ ERRO: Ambiente obrigatório não fornecido');
  console.error('💡 Uso: npm run migrate:dev | migrate:staging | migrate:prod');
  process.exit(1);
}

const VALID_ENVIRONMENTS = ['development', 'staging', 'production', 'test'];
if (!VALID_ENVIRONMENTS.includes(REQUIRED_ENVIRONMENT)) {
  console.error(`❌ ERRO: Ambiente inválido: ${REQUIRED_ENVIRONMENT}`);
  console.error(`✅ Válidos: ${VALID_ENVIRONMENTS.join(', ')}`);
  process.exit(1);
}

// Validação crítica: NODE_ENV deve corresponder ao ambiente solicitado
process.env.NODE_ENV = REQUIRED_ENVIRONMENT;

const DATABASE_URL_VAR = REQUIRED_ENVIRONMENT === 'development' ? 'DEV_DATABASE_URL' :
                        REQUIRED_ENVIRONMENT === 'staging' ? 'STAGING_DATABASE_URL' :
                        REQUIRED_ENVIRONMENT === 'production' ? 'PROD_DATABASE_URL' :
                        'TEST_DATABASE_URL';

if (!process.env[DATABASE_URL_VAR]) {
  console.error(`❌ ERRO: ${DATABASE_URL_VAR} não configurado`);
  console.error(`🔧 Configure esta variável nos Replit Secrets`);
  process.exit(1);
}

// 🚀 SOLUÇÃO: Sobrescrever DATABASE_URL com o valor correto do ambiente
const correctDatabaseUrl = process.env[DATABASE_URL_VAR];
process.env.DATABASE_URL = correctDatabaseUrl;

// Validação de hostname (segurança extra)
const url = new URL(correctDatabaseUrl);
const expectedHostnames = {
  development: ['dev-simpix', 'localhost', '127.0.0.1'],
  staging: ['staging-simpix'],
  production: ['prod-simpix'],
  test: ['test-simpix', 'localhost', '127.0.0.1']
};

const validHost = expectedHostnames[REQUIRED_ENVIRONMENT]?.some(host => 
  url.hostname.includes(host)
);

if (!validHost) {
  console.error(`🚨 SECURITY: Hostname ${url.hostname} inválido para ambiente ${REQUIRED_ENVIRONMENT}`);
  console.error(`✅ Esperado: ${expectedHostnames[REQUIRED_ENVIRONMENT]?.join(', ')}`);
  process.exit(1);
}

// Log de segurança
console.log(`🔧 Iniciando migração para ambiente: ${REQUIRED_ENVIRONMENT}`);
console.log(`🔗 Database: ${url.hostname}`);
console.log(`📊 NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`🔒 DATABASE_URL configurado para: ${DATABASE_URL_VAR}`);

// Executar migração com DATABASE_URL correto
try {
  console.log('📋 Executando drizzle-kit migrate...');
  execSync('drizzle-kit migrate', { stdio: 'inherit', env: process.env });
  console.log(`✅ Migração ${REQUIRED_ENVIRONMENT} concluída com sucesso`);
} catch (error) {
  console.error(`❌ Falha na migração ${REQUIRED_ENVIRONMENT}:`, error.message);
  process.exit(1);
}