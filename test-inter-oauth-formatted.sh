#!/bin/bash

# Teste formatado de OAuth 2.0 - Banco Inter API
# Verifica diferentes formatos de requisição

echo "========================================="
echo "🏦 TESTE DETALHADO - BANCO INTER API"
echo "========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verificar variáveis
if [ -z "$INTER_CLIENT_ID" ] || [ -z "$INTER_CLIENT_SECRET" ]; then
    echo -e "${RED}❌ Erro: Variáveis INTER_CLIENT_ID e INTER_CLIENT_SECRET não definidas${NC}"
    exit 1
fi

# URLs dos ambientes
SANDBOX_URL="https://cdpj-sandbox.partners.uatinter.co"
PROD_URL="https://cdpj.partners.bancointer.com.br"

echo -e "${BLUE}📋 Teste 1: Verificar conectividade básica${NC}"
echo "==========================================="

# Teste de conectividade
echo "Testando conexão com sandbox..."
PING_RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$SANDBOX_URL")

if [ "$PING_RESULT" != "000" ]; then
    echo -e "${GREEN}✅ Servidor sandbox acessível${NC}"
else
    echo -e "${RED}❌ Servidor sandbox inacessível${NC}"
fi

echo ""
echo -e "${BLUE}📋 Teste 2: OAuth com diferentes formatos${NC}"
echo "==========================================="

# Teste 1: Formato URL-encoded padrão
echo "Formato 1: URL-encoded padrão..."
RESPONSE1=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$SANDBOX_URL/oauth/v2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=$INTER_CLIENT_ID&client_secret=$INTER_CLIENT_SECRET&grant_type=client_credentials&scope=cobv.write%20cobv.read" 2>&1)

HTTP1=$(echo "$RESPONSE1" | grep "HTTP_CODE:" | cut -d: -f2)
BODY1=$(echo "$RESPONSE1" | grep -v "HTTP_CODE:")

echo "Resposta: HTTP $HTTP1"
if [ "$HTTP1" = "200" ]; then
    echo -e "${GREEN}✅ Formato 1 funcionou!${NC}"
else
    echo -e "${YELLOW}⚠️  Formato 1 falhou${NC}"
fi

# Teste 2: Formato JSON
echo ""
echo "Formato 2: JSON..."
RESPONSE2=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$SANDBOX_URL/oauth/v2/token" \
  -H "Content-Type: application/json" \
  -d "{\"client_id\":\"$INTER_CLIENT_ID\",\"client_secret\":\"$INTER_CLIENT_SECRET\",\"grant_type\":\"client_credentials\",\"scope\":\"cobv.write cobv.read\"}" 2>&1)

HTTP2=$(echo "$RESPONSE2" | grep "HTTP_CODE:" | cut -d: -f2)
echo "Resposta: HTTP $HTTP2"

# Teste 3: Com Authorization Header
echo ""
echo "Formato 3: Basic Auth..."
AUTH=$(echo -n "$INTER_CLIENT_ID:$INTER_CLIENT_SECRET" | base64)
RESPONSE3=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$SANDBOX_URL/oauth/v2/token" \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&scope=cobv.write%20cobv.read" 2>&1)

HTTP3=$(echo "$RESPONSE3" | grep "HTTP_CODE:" | cut -d: -f2)
echo "Resposta: HTTP $HTTP3"

echo ""
echo -e "${BLUE}📋 Teste 3: Verificar documentação da API${NC}"
echo "==========================================="

# Tentar acessar endpoint de documentação
DOC_TEST=$(curl -s -o /dev/null -w "%{http_code}" "$SANDBOX_URL/swagger" --connect-timeout 5)
echo "Endpoint /swagger: HTTP $DOC_TEST"

DOC_TEST2=$(curl -s -o /dev/null -w "%{http_code}" "$SANDBOX_URL/api-docs" --connect-timeout 5)
echo "Endpoint /api-docs: HTTP $DOC_TEST2"

echo ""
echo -e "${BLUE}📋 Teste 4: Análise de certificado${NC}"
echo "==========================================="

if [ -n "$INTER_CERTIFICATE" ]; then
    # Verificar formato do certificado
    CERT_LINES=$(echo "$INTER_CERTIFICATE" | wc -l)
    echo "Linhas no certificado: $CERT_LINES"
    
    if [ "$CERT_LINES" -eq 1 ]; then
        echo -e "${YELLOW}⚠️  Certificado em linha única (pode precisar formatação)${NC}"
    else
        echo -e "${GREEN}✅ Certificado com múltiplas linhas${NC}"
    fi
    
    # Verificar headers
    if echo "$INTER_CERTIFICATE" | grep -q "BEGIN CERTIFICATE"; then
        echo -e "${GREEN}✅ Header de certificado encontrado${NC}"
    else
        echo -e "${RED}❌ Header de certificado não encontrado${NC}"
    fi
else
    echo -e "${RED}❌ Certificado não configurado${NC}"
fi

echo ""
echo "========================================="
echo -e "${BLUE}📊 DIAGNÓSTICO FINAL${NC}"
echo "========================================="

# Análise dos resultados
if [ "$HTTP1" = "200" ] || [ "$HTTP2" = "200" ] || [ "$HTTP3" = "200" ]; then
    echo -e "${GREEN}✅ API do Banco Inter está ACESSÍVEL${NC}"
    echo -e "${GREEN}✅ Autenticação OAuth 2.0 FUNCIONANDO${NC}"
    echo ""
    echo "Token obtido com sucesso!"
else
    echo -e "${RED}❌ PROBLEMA na autenticação OAuth${NC}"
    echo ""
    echo -e "${YELLOW}Diagnóstico:${NC}"
    
    if [ "$PING_RESULT" = "000" ]; then
        echo "1. Servidor sandbox inacessível (problema de rede)"
    elif [ "$HTTP1" = "400" ]; then
        echo "1. Erro 400 - Requisição mal formada"
        echo "   - Verificar se credenciais estão corretas"
        echo "   - Confirmar se conta sandbox está ativa"
    elif [ "$HTTP1" = "401" ]; then
        echo "1. Erro 401 - Credenciais inválidas"
        echo "   - Client ID ou Secret incorretos"
    elif [ "$HTTP1" = "403" ]; then
        echo "1. Erro 403 - Acesso negado"
        echo "   - Certificado mTLS pode ser obrigatório"
    fi
    
    echo ""
    echo -e "${YELLOW}Próximos passos:${NC}"
    echo "1. Verificar status da conta sandbox no portal Inter"
    echo "2. Confirmar que as credenciais são do ambiente correto"
    echo "3. Verificar se certificado mTLS é obrigatório"
    echo "4. Contatar suporte técnico do Banco Inter"
fi

echo ""
echo "Detalhes da última resposta:"
echo "$BODY1" | head -20