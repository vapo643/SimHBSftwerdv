#!/bin/bash
# scripts/db-push-safe.sh
# 🛡️ SCRIPT SEGURO PARA DB PUSH - PAM V1.0

echo "🛡️ SCRIPT SEGURO PARA DB PUSH - PAM V1.0"
echo ""

# Verificar NODE_ENV
if [ -z "$NODE_ENV" ]; then
    echo "🚨 ERRO: NODE_ENV não definido. Defina como 'development', 'test' ou 'production'."
    exit 1
fi

echo "🎯 Ambiente detectado: $NODE_ENV"

case $NODE_ENV in
    "production")
        echo "🚨 ERRO: Push direto proibido em produção. Use migrações: npm run db:migrate:prod"
        exit 1
        ;;
    "development")
        echo "⚠️ Ambiente de desenvolvimento detectado."
        ./scripts/confirm-destructive.sh development "DATABASE_PUSH"
        if [ $? -eq 0 ]; then
            echo "🚀 Executando drizzle-kit push..."
            DRIZZLE_CONFIRM_DESTRUCTIVE=YES_I_UNDERSTAND_THE_RISKS drizzle-kit push
        fi
        ;;
    "test")
        echo "🧪 Ambiente de teste detectado - executando push sem confirmação."
        drizzle-kit push
        ;;
    *)
        echo "🚨 ERRO: NODE_ENV '$NODE_ENV' não reconhecido."
        exit 1
        ;;
esac