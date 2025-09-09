#!/bin/bash
# Environment Compliance Audit - Production
# Operação Soberania dos Dados - Protocolos de Resiliência V1.0

echo "🔍 [AUDIT PRODUCTION] Iniciando auditoria de conformidade do ambiente de produção..."

# Definir ambiente
export NODE_ENV=production

# Verificação de segurança crítica
echo "⚠️ [AUDIT PRODUCTION] ATENÇÃO: Auditoria do ambiente de PRODUÇÃO"
echo "   - Esta operação executará verificações no banco de produção"
echo "   - Apenas verificações READ-ONLY serão executadas"
echo "   - Logs serão auditados para segurança"

# Verificar pré-requisitos críticos
if [ -z "$PROD_SUPABASE_URL" ]; then
    echo "❌ [AUDIT PRODUCTION] PROD_SUPABASE_URL não definida"
    exit 1
fi

if [ -z "$PROD_SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ [AUDIT PRODUCTION] PROD_SUPABASE_SERVICE_ROLE_KEY não definida"
    exit 1
fi

# Verificação adicional de ambiente
if [ "$NODE_ENV" != "production" ]; then
    echo "❌ [AUDIT PRODUCTION] NODE_ENV deve ser 'production' para auditoria de produção"
    exit 1
fi

echo "✅ [AUDIT PRODUCTION] Pré-requisitos de segurança verificados"

# Executar auditoria
echo "🚀 [AUDIT PRODUCTION] Executando auditoria de produção..."
tsx scripts/audit/audit-environment.js

# Capturar exit code
AUDIT_EXIT_CODE=$?

# Log de auditoria
echo "📝 [AUDIT PRODUCTION] Registrando evento de auditoria..."
echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") - Production compliance audit executed - Exit Code: $AUDIT_EXIT_CODE - User: $(whoami)" >> /tmp/production_audit.log

if [ $AUDIT_EXIT_CODE -eq 0 ]; then
    echo "🎉 [AUDIT PRODUCTION] Auditoria APROVADA - Ambiente de produção conforme"
    echo "✅ [AUDIT PRODUCTION] Todas as verificações de segurança passaram"
else
    echo "🚨 [AUDIT PRODUCTION] Auditoria REPROVADA - Não conformidades críticas detectadas"
    echo "⚠️ [AUDIT PRODUCTION] Revisão imediata necessária - Escalação de segurança"
fi

echo "📄 [AUDIT PRODUCTION] Auditoria de produção concluída"
exit $AUDIT_EXIT_CODE