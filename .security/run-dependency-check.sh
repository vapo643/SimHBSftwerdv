#!/bin/bash
# Projeto Cérbero - Script wrapper para execução no CI/CD

echo "🚀 Iniciando análise de vulnerabilidades com gestão de exceções..."

# Verificar se Python está disponível
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 não encontrado. Por favor, instale Python 3."
    exit 1
fi

# Instalar dependências Python se necessário
pip install -q pyyaml || {
    echo "❌ Falha ao instalar dependências Python"
    exit 1
}

# Executar script de análise
python3 .security/dependency-check-with-exceptions.py

# Capturar código de saída
EXIT_CODE=$?

# Gerar badge de status
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Análise de segurança passou com sucesso"
else
    echo "❌ Análise de segurança falhou"
fi

exit $EXIT_CODE