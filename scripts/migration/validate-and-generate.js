#!/usr/bin/env node

import { execSync } from 'child_process';

// Script para gerar migração com ambiente correto
const environment = process.env.NODE_ENV || 'development';

const DATABASE_URL_VAR = environment === 'development' ? 'DEV_DATABASE_URL' :
                        environment === 'staging' ? 'STAGING_DATABASE_URL' :
                        environment === 'production' ? 'PROD_DATABASE_URL' :
                        'TEST_DATABASE_URL';

if (!process.env[DATABASE_URL_VAR]) {
  console.error(`❌ ERRO: ${DATABASE_URL_VAR} não configurado`);
  console.error(`🔧 Configure esta variável nos Replit Secrets`);
  process.exit(1);
}

// Sobrescrever DATABASE_URL com o valor correto do ambiente
process.env.DATABASE_URL = process.env[DATABASE_URL_VAR];

console.log(`🔧 Gerando migração para ambiente: ${environment}`);
console.log(`🔒 DATABASE_URL configurado para: ${DATABASE_URL_VAR}`);

try {
  execSync('drizzle-kit generate', { stdio: 'inherit', env: process.env });
  console.log(`✅ Migração gerada para ambiente ${environment}`);
} catch (error) {
  console.error(`❌ Falha na geração de migração:`, error.message);
  process.exit(1);
}