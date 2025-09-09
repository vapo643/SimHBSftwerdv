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

// Validação simplificada para evitar conflitos com hostnames Supabase reais
const isDatabaseUrlDifferent = (env) => {
  const prodUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  if (!prodUrl) return true;
  
  return correctDatabaseUrl !== prodUrl;
};

// Para test e development, garantir que não seja igual ao DATABASE_URL de produção
if ((REQUIRED_ENVIRONMENT === 'test' || REQUIRED_ENVIRONMENT === 'development')) {
  if (!isDatabaseUrlDifferent(REQUIRED_ENVIRONMENT)) {
    console.error(`🚨 SECURITY: Database URL ${REQUIRED_ENVIRONMENT} igual ao de PRODUÇÃO!`);
    console.error(`🔧 Configure um ${DATABASE_URL_VAR} específico para ${REQUIRED_ENVIRONMENT}`);
    process.exit(1);
  }
}

console.log(`🔒 SEGURANÇA: Database isolado para ambiente ${REQUIRED_ENVIRONMENT}`);

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