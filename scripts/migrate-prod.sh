#!/bin/bash
# Wrapper script for production migration
export NODE_ENV=production
echo "🔧 Executando migração de produção..."
node scripts/migration/validate-and-migrate.js production