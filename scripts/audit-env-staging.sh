#!/bin/bash
# Environment Compliance Audit - Staging
# Operação Soberania dos Dados - Protocolos de Resiliência V1.0

echo "🔍 [AUDIT STAGING] Iniciando auditoria de conformidade do ambiente de staging..."

# Definir ambiente
export NODE_ENV=staging

# Verificar pré-requisitos
if [ -z "$STAGING_SUPABASE_URL" ]; then
    echo "❌ [AUDIT STAGING] STAGING_SUPABASE_URL não definida"
    exit 1
fi

if [ -z "$STAGING_SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ [AUDIT STAGING] STAGING_SUPABASE_SERVICE_ROLE_KEY não definida"
    exit 1
fi

echo "✅ [AUDIT STAGING] Pré-requisitos verificados"

# Executar auditoria
echo "🚀 [AUDIT STAGING] Executando auditoria..."
tsx scripts/audit/audit-environment.js

# Capturar exit code
AUDIT_EXIT_CODE=$?

if [ $AUDIT_EXIT_CODE -eq 0 ]; then
    echo "🎉 [AUDIT STAGING] Auditoria APROVADA - Ambiente conforme"
else
    echo "🚨 [AUDIT STAGING] Auditoria REPROVADA - Não conformidades detectadas"
fi

echo "📄 [AUDIT STAGING] Auditoria de staging concluída"
exit $AUDIT_EXIT_CODE