#!/bin/bash

# Script para preparar aplicação para deploy
echo "🔄 Iniciando build para deploy..."

# 1. Build do frontend (Vite)
echo "📦 Building frontend..."
vite build

# 2. Copiar assets para local correto (LIMPAR PRIMEIRO)
echo "📂 Copiando assets (FRESH CLEAN COPY)..."
rm -rf server/public/* 2>/dev/null || true
mkdir -p server/public/assets
cp -r dist/public/* server/public/
echo "✅ Assets copiados limpos para server/public/"
echo "📋 Assets no diretório:"
ls -la server/public/assets/

# 3. Build do backend (esbuild)  
echo "⚙️ Building backend..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "✅ Build completo! Pronto para deploy."
echo "💡 Execute: chmod +x build-for-deploy.sh && ./build-for-deploy.sh"