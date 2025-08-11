#!/bin/bash

# Obter o token de autenticação real
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjdGJjaWNwaG9qYXJyc3Zla3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTYwNTAsImV4cCI6MjA2OTM3MjA1MH0.9pXNhRjb7LhM0BRLz1gzYuIQdHT8hm_2kHJJJ5HuRtI"

# Fazer login primeiro
echo "🔐 Fazendo login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@simpix.com.br","password":"Admin@123456"}')

# Extrair token do response se houver
if echo "$LOGIN_RESPONSE" | grep -q "token"; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
  echo "✅ Login realizado com sucesso"
else
  echo "⚠️ Usando token padrão"
fi

# Regenerar CCB
echo ""
echo "📄 Regenerando CCB..."
RESPONSE=$(curl -s -X POST http://localhost:5000/api/propostas/88a44696-9b63-42ee-aa81-15f9519d24cb/regenerate-ccb \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}')

echo "Resposta: $RESPONSE"

# Buscar URL do CCB
echo ""
echo "🔗 Buscando URL do CCB..."
CCB_URL=$(curl -s -X GET http://localhost:5000/api/formalizacao/88a44696-9b63-42ee-aa81-15f9519d24cb/ccb \
  -H "Authorization: Bearer $TOKEN" | jq -r '.url')

echo "URL do CCB: $CCB_URL"
