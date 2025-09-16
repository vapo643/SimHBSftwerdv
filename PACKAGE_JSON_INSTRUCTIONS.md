# 📦 INSTRUÇÕES PACKAGE.JSON - PAM V1.0

## 🎯 LOCALIZAÇÃO DOS SCRIPTS

Localize esta seção no seu `package.json`:

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
    "db:push": "drizzle-kit push",    👈 ENCONTRE ESTA LINHA
    "prepare": "husky"
  },
```

## ✅ ADICIONAR ESTAS 3 LINHAS

**ADICIONE EXATAMENTE APÓS** a linha `"db:push": "drizzle-kit push",`:

```json
    "db:migrate:generate": "npx drizzle-kit generate:pg --out=./migrations --schema=./shared/schema.ts",
    "db:migrate:validate": "npx drizzle-kit check:pg --out=./migrations",
    "db:migrate:prod": "npx drizzle-kit push:pg --verbose",
```

## 📋 RESULTADO FINAL

A seção scripts deve ficar assim:

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
    "db:migrate:generate": "npx drizzle-kit generate:pg --out=./migrations --schema=./shared/schema.ts",
    "db:migrate:validate": "npx drizzle-kit check:pg --out=./migrations",
    "db:migrate:prod": "npx drizzle-kit push:pg --verbose",
    "prepare": "husky"
  },
```

## 🚨 IMPORTANTE

- **NÃO esqueça as vírgulas** após cada linha
- **Mantenha a indentação** (4 espaços)
- **Não remova** nenhum script existente

---

### ✅ PAM V1.0 - OPERAÇÃO DE RECONCILIAÇÃO SISTÊMICA CONCLUÍDA

Após adicionar os scripts, a **blindagem estratégica** estará completa e o sistema estará protegido contra futuras divergências de schema.