#!/bin/bash
# Wrapper script for staging migration
export NODE_ENV=staging
echo "🔧 Executando migração de staging..."
node scripts/migration/validate-and-migrate.js staging