# 🚀 OTIMIZAÇÃO PACKAGE.JSON - RESOLVER TIMEOUT BUILD

## 📋 INSTRUÇÕES EXATAS

**LOCALIZAR A SEÇÃO `"scripts"` NO PACKAGE.JSON E SUBSTITUIR:**

### ❌ SUBSTITUIR ESTA LINHA:
```json
"build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
```

### ✅ POR ESTAS DUAS LINHAS:
```json
"build": "vite build && npm run build:server",
"build:server": "esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --minify --tree-shaking",
```

## 🎯 RESULTADO FINAL DA SEÇÃO SCRIPTS:
```json
"scripts": {
  "pre-dev": "bash scripts/prevent-neon-autoconfiguration.sh",
  "dev": "npm run pre-dev && NODE_ENV=development tsx server/index.ts",
  "check-db": "bash scripts/check-database-config.sh",
  "fix-database-config": "bash scripts/prevent-neon-autoconfiguration.sh",
  "build": "vite build && npm run build:server",
  "build:server": "esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --minify --tree-shaking",
  "start": "NODE_ENV=production node dist/index.js",
  "check": "tsc",
  "db:push": "drizzle-kit push",
  "prepare": "husky"
},
```

## ⚡ BENEFÍCIOS:
- ✅ **--minify**: Reduz drasticamente o tamanho do bundle
- ✅ **--tree-shaking**: Remove código não utilizado  
- ✅ **Build mais rápido**: Menor processamento = menor timeout
- ✅ **Debug melhor**: Comando separado facilita identificar problemas

## 🚨 AÇÃO:
1. Abrir `package.json`
2. Localizar seção `"scripts"`
3. Substituir exatamente como mostrado acima
4. Salvar arquivo
5. Fazer novo deployment

---
**OPERAÇÃO PHOENIX V1.5 - OTIMIZAÇÃO DE BUILD**