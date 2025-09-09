#!/bin/bash
# Seed Staging Database
# Operação Soberania dos Dados - Seeding System V1.0

echo "🌱 [SEED STAGING] Iniciando seeding do ambiente de staging..."

# Verificar NODE_ENV
export NODE_ENV=staging

# Executar seeding
tsx scripts/seed-database.js

echo "✅ [SEED STAGING] Seeding de staging concluído"