#!/bin/bash

# PAM V1.0 - Script para capturar evidência bruta
echo "🔬 PAM V1.0 - CAPTURA DE EVIDÊNCIA FORENSE"
echo "========================================"

# Fazer requisição para acionar o endpoint
echo "📡 Acionando endpoint GET /api/cobrancas..."
curl -s "http://localhost:5000/api/cobrancas" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "User-Agent: PAM-Forensic-Audit" \
  > /tmp/api_response.json

echo "📊 Resposta capturada em /tmp/api_response.json"
echo "📏 Tamanho da resposta: $(wc -c < /tmp/api_response.json) bytes"
echo "🔍 Primeiras linhas da evidência:"
head -10 /tmp/api_response.json

echo ""
echo "========================================"
echo "✅ EVIDÊNCIA CAPTURADA - Verifique os logs do console do Replit"