#!/bin/bash

# PAM V1.0 - Script de Inicialização Redis + Node.js
# Operação "Restauração de Doutrina"

echo "🚀 [PAM] Iniciando Redis server..."

# Kill any existing Redis processes
pkill redis-server 2>/dev/null || true

# Start Redis with optimized settings for Replit environment
redis-server --daemonize yes --bind 127.0.0.1 --port 6379 --maxmemory 128mb --maxmemory-policy allkeys-lru 2>/dev/null &

# Wait for Redis to be ready
echo "⏳ [PAM] Aguardando Redis inicializar..."
timeout=10
counter=0
while [ $counter -lt $timeout ]; do
  if redis-cli ping >/dev/null 2>&1; then
    echo "✅ [PAM] Redis server conectado com sucesso (porta 6379)"
    break
  fi
  sleep 1
  counter=$((counter + 1))
done

if [ $counter -eq $timeout ]; then
  echo "⚠️  [PAM] Redis não iniciou - degradando para modo fallback"
  echo "📊 [PAM] BullMQ funcionará em modo degradado"
fi

echo "🚀 [PAM] Iniciando Node.js server..."
NODE_ENV=development tsx server/index.ts