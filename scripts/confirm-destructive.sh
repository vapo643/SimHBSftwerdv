#!/bin/bash
# scripts/confirm-destructive.sh
# 🛡️ SCRIPT DE CONFIRMAÇÃO PARA OPERAÇÕES DESTRUTIVAS - PAM V1.0

ENVIRONMENT=$1
OPERATION=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$OPERATION" ]; then
    echo "🚨 ERRO: Uso incorreto. Sintaxe: $0 <ambiente> <operação>"
    exit 1
fi

echo ""
echo "⚠️  ======================================================"
echo "🚨 ATENÇÃO: OPERAÇÃO DESTRUTIVA DETECTADA"
echo "⚠️  ======================================================"
echo ""
echo "🎯 Ambiente: $ENVIRONMENT"
echo "⚡ Operação: $OPERATION"
echo "📅 Data: $(date)"
echo "👤 Usuário: $(whoami)"
echo ""

# Mostrar conexão atual do banco
if [ "$ENVIRONMENT" = "development" ]; then
    if [ -f .env.development ]; then
        echo "🔍 Verificando conexão de banco..."
        DATABASE_URL=$(grep "^DATABASE_URL=" .env.development | cut -d'=' -f2-)
        if [ -n "$DATABASE_URL" ]; then
            # Extrair hostname da URL (forma segura)
            HOSTNAME=$(echo "$DATABASE_URL" | sed -n 's|.*://[^@]*@\([^:/]*\).*|\1|p')
            echo "🌐 Hostname do banco: $HOSTNAME"
        fi
    fi
fi

echo ""
echo "⚠️  Esta operação pode modificar ou deletar dados!"
echo "⚠️  Certifique-se de que é o ambiente correto."
echo ""

# Confirmação dupla para máxima segurança
echo "🔐 Para confirmar, digite o nome do ambiente: $ENVIRONMENT"
read -p "👉 Confirmar ambiente: " CONFIRM_ENV

if [ "$CONFIRM_ENV" != "$ENVIRONMENT" ]; then
    echo "❌ Ambiente não confirmado. Operação CANCELADA."
    exit 1
fi

echo ""
echo "🔐 Para prosseguir, digite exatamente: YES_EXECUTE_$OPERATION"
read -p "👉 Confirmação final: " CONFIRM_OPERATION

EXPECTED_CONFIRM="YES_EXECUTE_$OPERATION"
if [ "$CONFIRM_OPERATION" != "$EXPECTED_CONFIRM" ]; then
    echo "❌ Operação não confirmada. CANCELADA por segurança."
    exit 1
fi

echo ""
echo "✅ Confirmação recebida. Executando operação..."
echo "📝 Log: $(date) - $OPERATION confirmada por $(whoami)" >> logs/destructive-operations.log
echo ""

# Script continua apenas se chegou até aqui
exit 0