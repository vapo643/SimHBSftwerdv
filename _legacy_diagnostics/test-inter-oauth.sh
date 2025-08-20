#!/bin/bash

# Teste de OAuth 2.0 - Banco Inter API
# Este script testa a autenticação diretamente

echo "========================================="
echo "🏦 TESTE OAUTH 2.0 - BANCO INTER"
echo "========================================="
echo ""

# Verificar variáveis
if [ -z "$INTER_CLIENT_ID" ] || [ -z "$INTER_CLIENT_SECRET" ]; then
    echo "❌ Erro: Variáveis INTER_CLIENT_ID e INTER_CLIENT_SECRET não definidas"
    exit 1
fi

# URL do ambiente sandbox
OAUTH_URL="https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token"

echo "📋 Configuração:"
echo "   - URL: $OAUTH_URL"
echo "   - Client ID: ${INTER_CLIENT_ID:0:10}..."
echo "   - Ambiente: Sandbox"
echo ""

echo "🔑 Tentando autenticação..."

# Fazer requisição OAuth sem certificado (teste básico)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$OAUTH_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=$INTER_CLIENT_ID" \
  -d "client_secret=$INTER_CLIENT_SECRET" \
  -d "grant_type=client_credentials" \
  -d "scope=cobv.write cobv.read")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo ""
echo "📡 Resposta HTTP: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Autenticação bem-sucedida!"
    echo ""
    echo "📄 Token recebido:"
    echo "$BODY" | jq '.'
else
    echo "❌ Erro na autenticação"
    echo ""
    echo "📄 Resposta do servidor:"
    echo "$BODY"
    
    echo ""
    echo "💡 Possíveis causas:"
    echo "   - Credenciais inválidas ou expiradas"
    echo "   - Certificado mTLS obrigatório"
    echo "   - Ambiente sandbox indisponível"
fi

echo ""
echo "========================================="
echo "🔍 TESTE ADICIONAL - COM CERTIFICADO"
echo "========================================="
echo ""

# Verificar se temos certificado
if [ -n "$INTER_CERTIFICATE" ] && [ -n "$INTER_PRIVATE_KEY" ]; then
    echo "✅ Certificado e chave privada encontrados"
    
    # Criar arquivos temporários
    CERT_FILE=$(mktemp)
    KEY_FILE=$(mktemp)
    
    # Escrever certificado e chave
    echo "$INTER_CERTIFICATE" > "$CERT_FILE"
    echo "$INTER_PRIVATE_KEY" > "$KEY_FILE"
    
    echo "🔐 Tentando com certificado mTLS..."
    
    # Fazer requisição com certificado
    RESPONSE_CERT=$(curl -s -w "\n%{http_code}" -X POST "$OAUTH_URL" \
      --cert "$CERT_FILE" \
      --key "$KEY_FILE" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "client_id=$INTER_CLIENT_ID" \
      -d "client_secret=$INTER_CLIENT_SECRET" \
      -d "grant_type=client_credentials" \
      -d "scope=cobv.write cobv.read" 2>&1)
    
    HTTP_CODE_CERT=$(echo "$RESPONSE_CERT" | tail -n1)
    
    echo ""
    echo "📡 Resposta com mTLS: $HTTP_CODE_CERT"
    
    # Limpar arquivos temporários
    rm -f "$CERT_FILE" "$KEY_FILE"
    
    if [[ "$RESPONSE_CERT" == *"SSL"* ]] || [[ "$RESPONSE_CERT" == *"certificate"* ]]; then
        echo "⚠️  Problema com certificado SSL detectado"
        echo "💡 O certificado pode estar em formato incorreto ou expirado"
    fi
else
    echo "❌ Certificado ou chave privada não encontrados"
fi

echo ""
echo "========================================="
echo "📊 RESUMO"
echo "========================================="

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE_CERT" = "200" ]; then
    echo "✅ API do Banco Inter está FUNCIONANDO!"
    echo "✅ Autenticação OAuth 2.0 validada"
else
    echo "❌ API do Banco Inter com PROBLEMAS"
    echo ""
    echo "🔧 Ações necessárias:"
    echo "1. Verificar se as credenciais sandbox ainda são válidas"
    echo "2. Confirmar formato correto do certificado"
    echo "3. Contatar suporte Banco Inter se problema persistir"
fi