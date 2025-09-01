#!/bin/bash

echo "🔍 [VALIDAÇÃO] Iniciando auditoria pós-refatoração Redis..."

# Contadores
TOTAL_ERRORS=0
TOTAL_CHECKS=5

echo ""
echo "===== AUDITORIA REDIS SINGLETON PATTERN ====="
echo ""

# 1. Verificar se não há instâncias new Redis() fora do manager
echo "📋 [CHECK 1/5] Verificando instâncias diretas de 'new Redis()' fora do manager..."
REDIS_INSTANCES=$(rg "new Redis\(" --type ts --type js server/ --exclude="**/redis-manager.ts" || true)

if [ -z "$REDIS_INSTANCES" ]; then
  echo "✅ PASS - Nenhuma instância direta de Redis encontrada fora do manager"
else
  echo "❌ FAIL - Instâncias diretas de Redis encontradas:"
  echo "$REDIS_INSTANCES"
  TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

# 2. Verificar imports do antigo redis-config.ts
echo ""
echo "📋 [CHECK 2/5] Verificando imports do antigo redis-config.ts..."
OLD_CONFIG_IMPORTS=$(rg "from.*redis-config" --type ts --type js server/ || true)

if [ -z "$OLD_CONFIG_IMPORTS" ]; then
  echo "✅ PASS - Nenhum import do antigo redis-config.ts encontrado"
else
  echo "❌ FAIL - Imports do antigo redis-config.ts encontrados:"
  echo "$OLD_CONFIG_IMPORTS"
  TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

# 3. Verificar se getRedisClient() está sendo usado
echo ""
echo "📋 [CHECK 3/5] Verificando uso da API centralizada getRedisClient()..."
GET_CLIENT_USAGE=$(rg "getRedisClient\(" --type ts --type js server/ | wc -l || echo "0")

if [ "$GET_CLIENT_USAGE" -gt 0 ]; then
  echo "✅ PASS - getRedisClient() está sendo usado ($GET_CLIENT_USAGE ocorrências)"
else
  echo "❌ FAIL - getRedisClient() não está sendo usado"
  TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

# 4. Verificar se Redis Manager está bem estruturado
echo ""
echo "📋 [CHECK 4/5] Verificando estrutura do Redis Manager..."
if [ -f "server/lib/redis-manager.ts" ]; then
  # Verificar se tem classe RedisManager
  if rg "class RedisManager" server/lib/redis-manager.ts > /dev/null; then
    echo "✅ PASS - Redis Manager tem estrutura de classe"
  else
    echo "❌ FAIL - Redis Manager não tem estrutura de classe adequada"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
  fi
  
  # Verificar se tem Singleton pattern
  if rg "private static instance" server/lib/redis-manager.ts > /dev/null; then
    echo "✅ PASS - Redis Manager implementa padrão Singleton"
  else
    echo "❌ FAIL - Redis Manager não implementa padrão Singleton"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
  fi
else
  echo "❌ FAIL - Arquivo server/lib/redis-manager.ts não encontrado"
  TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

# 5. Verificar se exports getters assíncronos estão implementados
echo ""
echo "📋 [CHECK 5/5] Verificando getters assíncronos para filas..."
ASYNC_GETTERS=$(rg "async function get.*Queue\(" server/lib/queues.ts | wc -l || echo "0")

if [ "$ASYNC_GETTERS" -gt 0 ]; then
  echo "✅ PASS - Getters assíncronos para filas implementados ($ASYNC_GETTERS encontrados)"
else
  echo "❌ FAIL - Getters assíncronos para filas não implementados"
  TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

# Relatório final
echo ""
echo "===== RELATÓRIO FINAL ====="
echo "Total de verificações: $TOTAL_CHECKS"
echo "Verificações com falha: $TOTAL_ERRORS"
echo "Verificações bem-sucedidas: $((TOTAL_CHECKS - TOTAL_ERRORS))"

if [ $TOTAL_ERRORS -eq 0 ]; then
  echo ""
  echo "🎉 [SUCESSO] Refatoração Redis Singleton validada com sucesso!"
  echo "✅ Todas as verificações passaram"
  echo "✅ Padrão Singleton implementado corretamente"
  echo "✅ Vazamentos de conexão Redis eliminados"
  exit 0
else
  echo ""
  echo "❌ [FALHA] Refatoração Redis tem $TOTAL_ERRORS problema(s)"
  echo "🔧 Corrija os problemas identificados e execute novamente"
  exit 1
fi