
#!/bin/bash
# scripts/prevent-neon-autoconfiguration.sh
# 🛡️ PROTEÇÃO ANTI-NEON DATABASE - PAM V1.0

echo "🛡️ EXECUTANDO PROTEÇÃO ANTI-NEON DATABASE"
echo ""

# Verificar se existe DATABASE_URL do Neon
if [[ "$DATABASE_URL" == *"neon.tech"* ]]; then
    echo "🚨 DETECTADO: DATABASE_URL do Neon encontrado!"
    echo "🔄 CORRIGINDO: Redirecionando para Supabase..."
    
    # Usar Supabase como fallback
    if [ -n "$SUPABASE_DATABASE_URL" ]; then
        export DATABASE_URL="$SUPABASE_DATABASE_URL"
        echo "✅ DATABASE_URL redirecionado para Supabase"
    else
        echo "❌ ERRO: SUPABASE_DATABASE_URL não encontrado nos secrets"
        echo "📝 Configure SUPABASE_DATABASE_URL nos Replit Secrets"
        exit 1
    fi
fi

# Verificar configuração atual
echo "🔍 VERIFICAÇÃO FINAL:"
echo "  - DATABASE_URL: ${DATABASE_URL:0:30}..."
echo "  - Ambiente: ${NODE_ENV:-development}"

# Validar que não é Neon
if [[ "$DATABASE_URL" == *"neon.tech"* ]]; then
    echo "🚨 FALHA: Ainda detectando Neon Database"
    echo "🛑 DEPLOY BLOQUEADO por segurança"
    exit 1
fi

echo "✅ PROTEÇÃO ANTI-NEON: SUCESSO"
echo ""
