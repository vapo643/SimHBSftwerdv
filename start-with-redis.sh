#!/bin/bash
# Operação "Ignição de Serviço" - Script de inicialização Redis + App

echo "🚀 [IGNIÇÃO] Iniciando Redis server (modo desenvolvimento)..."
# Configuração otimizada para ambiente Replit
redis-server \
  --port 6379 \
  --bind 127.0.0.1 \
  --save "" \
  --appendonly no \
  --maxmemory 64mb \
  --maxmemory-policy allkeys-lru \
  --daemonize yes \
  --logfile "" \
  --syslog-enabled no

# Aguardar Redis estar disponível
echo "⏳ [IGNIÇÃO] Aguardando Redis ficar disponível..."
sleep 3

# Verificar se Redis está rodando
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ [IGNIÇÃO] Redis conectado com sucesso!"
    redis-cli info server | grep redis_version
else
    echo "⚠️  [IGNIÇÃO] Redis não respondeu, continuando sem Redis (modo degradado)"
fi

echo "🔥 [IGNIÇÃO] Iniciando aplicação Node.js..."
exec npm run dev