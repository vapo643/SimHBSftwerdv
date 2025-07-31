#!/bin/bash
# Projeto Cérbero - Script para atualizar OWASP Dependency-Check localmente

DEPENDENCY_CHECK_VERSION="12.1.0"
INSTALL_DIR="$HOME/.local/dependency-check"

echo "🚀 Atualizando OWASP Dependency-Check para versão $DEPENDENCY_CHECK_VERSION..."

# Criar diretório se não existir
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Fazer backup da versão anterior se existir
if [ -d "dependency-check" ]; then
    echo "📦 Fazendo backup da versão anterior..."
    mv dependency-check dependency-check.backup.$(date +%Y%m%d%H%M%S)
fi

# Download da nova versão
echo "⬇️  Baixando OWASP Dependency-Check v$DEPENDENCY_CHECK_VERSION..."
wget -q --show-progress "https://github.com/dependency-check/DependencyCheck/releases/download/v${DEPENDENCY_CHECK_VERSION}/dependency-check-${DEPENDENCY_CHECK_VERSION}-release.zip"

if [ $? -ne 0 ]; then
    echo "❌ Erro ao baixar Dependency-Check"
    exit 1
fi

# Extrair arquivo
echo "📂 Extraindo arquivos..."
unzip -q "dependency-check-${DEPENDENCY_CHECK_VERSION}-release.zip"
rm "dependency-check-${DEPENDENCY_CHECK_VERSION}-release.zip"

# Tornar executável
chmod +x dependency-check/bin/dependency-check.sh

# Atualizar base de dados NVD
echo "🔄 Atualizando base de dados NVD (pode demorar alguns minutos)..."
./dependency-check/bin/dependency-check.sh --updateonly

# Criar link simbólico para facilitar uso
if [ ! -L "/usr/local/bin/dependency-check" ]; then
    echo "🔗 Criando link simbólico (pode solicitar senha)..."
    sudo ln -sf "$INSTALL_DIR/dependency-check/bin/dependency-check.sh" /usr/local/bin/dependency-check
fi

echo "✅ OWASP Dependency-Check v$DEPENDENCY_CHECK_VERSION instalado com sucesso!"
echo ""
echo "📋 Para usar:"
echo "   dependency-check --project \"Simpix\" --scan . --format ALL"
echo ""
echo "📚 Documentação: https://jeremylong.github.io/DependencyCheck/"