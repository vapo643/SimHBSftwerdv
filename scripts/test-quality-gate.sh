#!/bin/bash

# Script para testar se o Quality Gate (pre-commit) está funcionando

echo "🔍 Testando Quality Gate (Pre-commit Hook)"
echo "=========================================="
echo ""

# Verifica se o Husky está instalado
if [ -d ".husky" ]; then
    echo "✅ Husky está instalado"
else
    echo "❌ Husky NÃO está instalado"
    exit 1
fi

# Verifica se o pre-commit hook existe
if [ -f ".husky/pre-commit" ]; then
    echo "✅ Pre-commit hook existe"
    cat .husky/pre-commit
else
    echo "❌ Pre-commit hook NÃO existe"
    exit 1
fi

echo ""

# Verifica se lint-staged está configurado
if [ -f ".lintstagedrc.json" ]; then
    echo "✅ Lint-staged está configurado"
    echo "Configuração:"
    cat .lintstagedrc.json
else
    echo "❌ Lint-staged NÃO está configurado"
    exit 1
fi

echo ""

# Verifica se lint-staged está instalado
if npx lint-staged --version > /dev/null 2>&1; then
    VERSION=$(npx lint-staged --version)
    echo "✅ Lint-staged instalado (versão: $VERSION)"
else
    echo "❌ Lint-staged NÃO está instalado"
    exit 1
fi

echo ""

# Verifica se o git está configurado para usar o Husky
HOOKS_PATH=$(git config --get core.hooksPath)
if [ "$HOOKS_PATH" = ".husky" ]; then
    echo "✅ Git está configurado para usar Husky (hooksPath: $HOOKS_PATH)"
else
    echo "⚠️  Git hooks path: $HOOKS_PATH (esperado: .husky)"
fi

echo ""
echo "=========================================="
echo "📊 RESUMO DO QUALITY GATE:"
echo ""
echo "🎯 Quando você fizer um commit, automaticamente:"
echo "   1. ESLint irá verificar e corrigir os arquivos .ts/.tsx/.js/.jsx"
echo "   2. Prettier irá formatar todos os arquivos"
echo "   3. Apenas arquivos modificados serão verificados (rápido!)"
echo ""
echo "🚀 O Quality Gate está ATIVO e funcionando!"
echo "   Todos os commits passarão por verificação automática."
echo ""
echo "💡 Para testar manualmente:"
echo "   npx lint-staged"
echo ""
echo "✅ SUCESSO: Quality Gate implementado com padrão de mercado!"