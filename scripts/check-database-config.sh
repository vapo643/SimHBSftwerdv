
#!/bin/bash
# scripts/check-database-config.sh
# 🔍 VERIFICAÇÃO DE CONFIGURAÇÃO DO BANCO DE DADOS

echo "🔍 VERIFICANDO CONFIGURAÇÃO DO BANCO DE DADOS"
echo ""

# Verificar variáveis de ambiente
echo "📋 VARIÁVEIS CONFIGURADAS:"
echo "  - DATABASE_URL: ${DATABASE_URL:+CONFIGURADO} ${DATABASE_URL:-❌ NÃO CONFIGURADO}"
echo "  - SUPABASE_DATABASE_URL: ${SUPABASE_DATABASE_URL:+CONFIGURADO} ${SUPABASE_DATABASE_URL:-❌ NÃO CONFIGURADO}"
echo "  - NODE_ENV: ${NODE_ENV:-development}"
echo ""

# Verificar se DATABASE_URL aponta para Neon
if [[ "$DATABASE_URL" == *"neon.tech"* ]]; then
    echo "🚨 PROBLEMA DETECTADO:"
    echo "  - DATABASE_URL está apontando para Neon Database"
    echo "  - Isso viola a política de segurança do projeto"
    echo ""
    echo "🔧 SOLUÇÃO REQUERIDA:"
    echo "  1. Configure SUPABASE_DATABASE_URL nos Replit Secrets"
    echo "  2. Execute: npm run fix-database-config"
    echo ""
    exit 1
fi

# Verificar se é Supabase
if [[ "$DATABASE_URL" == *"supabase.co"* ]]; then
    echo "✅ CONFIGURAÇÃO CORRETA:"
    echo "  - DATABASE_URL está apontando para Supabase"
    echo "  - Configuração em conformidade com a política"
    echo ""
    exit 0
fi

echo "⚠️ CONFIGURAÇÃO DESCONHECIDA:"
echo "  - DATABASE_URL não aponta nem para Neon nem para Supabase"
echo "  - Verifique a configuração manualmente"
echo ""
exit 0
