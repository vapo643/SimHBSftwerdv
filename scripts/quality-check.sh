#!/bin/bash

# Script de Verificação de Qualidade de Código
# Executa ESLint e Prettier para manter o código limpo

echo "🔍 Iniciando verificação de qualidade..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar ESLint
check_eslint() {
    echo -e "${YELLOW}📋 Verificando ESLint...${NC}"
    
    # Conta erros e avisos
    ESLINT_OUTPUT=$(npx eslint . --ext .ts,.tsx,.js,.jsx --quiet 2>&1)
    ESLINT_COUNT=$(echo "$ESLINT_OUTPUT" | wc -l)
    
    if [ "$ESLINT_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✅ ESLint: Nenhum problema encontrado!${NC}"
        return 0
    else
        echo -e "${RED}❌ ESLint: $ESLINT_COUNT problemas encontrados${NC}"
        echo "$ESLINT_OUTPUT" | head -20
        echo "..."
        echo "Execute 'npx eslint . --ext .ts,.tsx,.js,.jsx --fix' para corrigir automaticamente"
        return 1
    fi
}

# Função para verificar Prettier
check_prettier() {
    echo -e "${YELLOW}🎨 Verificando Prettier...${NC}"
    
    PRETTIER_CHECK=$(npx prettier --check "**/*.{ts,tsx,js,jsx,json,css,md}" 2>&1)
    
    if echo "$PRETTIER_CHECK" | grep -q "All matched files use Prettier"; then
        echo -e "${GREEN}✅ Prettier: Todos os arquivos estão formatados!${NC}"
        return 0
    else
        echo -e "${RED}❌ Prettier: Alguns arquivos precisam de formatação${NC}"
        echo "$PRETTIER_CHECK" | head -10
        echo "Execute 'npx prettier --write \"**/*.{ts,tsx,js,jsx,json,css,md}\"' para formatar"
        return 1
    fi
}

# Executa as verificações
ESLINT_PASS=0
PRETTIER_PASS=0

check_eslint || ESLINT_PASS=1
echo ""
check_prettier || PRETTIER_PASS=1

# Resultado final
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ESLINT_PASS" -eq 0 ] && [ "$PRETTIER_PASS" -eq 0 ]; then
    echo -e "${GREEN}🎉 CÓDIGO PERFEITO! Nenhum problema encontrado.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  ATENÇÃO: Alguns problemas foram encontrados.${NC}"
    echo ""
    echo "Para corrigir automaticamente tudo, execute:"
    echo -e "${GREEN}npx eslint . --ext .ts,.tsx,.js,.jsx --fix && npx prettier --write \"**/*.{ts,tsx,js,jsx,json,css,md}\"${NC}"
    exit 1
fi