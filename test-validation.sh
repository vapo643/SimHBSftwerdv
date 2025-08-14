#!/bin/bash

echo ""
echo "================================================================="
echo "🚀 PAM V1.0 - TESTE DE VALIDAÇÃO DA DUPLA ESCRITA"
echo "================================================================="
echo ""

# Buscar a última proposta criada e verificar os campos
psql "$DATABASE_URL" -c "
SELECT 
    id,
    cliente_nome,
    cliente_cpf,
    cliente_email, 
    cliente_telefone,
    cliente_data->>'nome' as json_nome,
    cliente_data->>'cpf' as json_cpf,
    cliente_data->>'email' as json_email,
    cliente_data->>'telefone' as json_telefone,
    created_at
FROM propostas 
ORDER BY created_at DESC 
LIMIT 1;
" 2>/dev/null

echo ""
echo "📊 ANÁLISE DOS RESULTADOS:"
echo ""

# Verificar se há propostas com campos relacionais preenchidos
RESULT=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) 
FROM propostas 
WHERE cliente_nome IS NOT NULL 
  AND cliente_cpf IS NOT NULL 
  AND created_at > NOW() - INTERVAL '10 minutes';
" 2>/dev/null | tr -d ' ')

if [ "$RESULT" -gt "0" ]; then
    echo "✅ CORREÇÃO VALIDADA: Encontradas $RESULT propostas recentes com campos relacionais preenchidos!"
else
    echo "⚠️  AGUARDANDO: Nenhuma proposta recente com campos relacionais preenchidos ainda."
    echo "    Crie uma nova proposta pela interface para testar a correção."
fi

echo ""
echo "================================================================="
