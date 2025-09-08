#!/bin/bash

# Script para preparar aplicação para deploy
echo "🔄 Iniciando build para deploy..."

# 1. Build do frontend (Vite)
echo "📦 Building frontend..."
vite build

# 2. Copiar assets para local correto
echo "📂 Copiando assets..."
mkdir -p server/public
cp -r dist/public/* server/public/

# 3. Build do backend (esbuild)  
echo "⚙️ Building backend..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "✅ Build completo! Pronto para deploy."
echo "💡 Execute: chmod +x build-for-deploy.sh && ./build-for-deploy.sh"