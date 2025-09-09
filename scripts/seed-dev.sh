#!/bin/bash
# Seed Development Database
# Operação Soberania dos Dados - Seeding System V1.0

echo "🌱 [SEED DEV] Iniciando seeding do ambiente de desenvolvimento..."

# Verificar NODE_ENV
export NODE_ENV=development

# Executar seeding
tsx scripts/seed-database.js

echo "✅ [SEED DEV] Seeding de desenvolvimento concluído"