#!/bin/bash
# Projeto Cérbero - Script simplificado para ambiente Replit

echo "🚀 Iniciando análise de vulnerabilidades..."

# Executar diretamente o script Python
python3 .security/dependency-check-with-exceptions.py

# Verificar se o relatório foi gerado
if [ -f "dependency-check-report.json" ]; then
    echo "✅ Análise de segurança concluída com sucesso"
    echo "📄 Relatório gerado: dependency-check-report.json"
    exit 0
else
    echo "❌ Falha ao gerar relatório"
    exit 1
fi