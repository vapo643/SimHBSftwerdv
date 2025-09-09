# CORREÇÕES DRIZZLE CONFIG - ENVIRONMENT AWARENESS

**Data:** 2025-09-09  
**Arquivo:** `drizzle.config.ts`  
**Problema:** Configuração não respeita ambientes  
**Prioridade:** 🔴 CRÍTICA - Risco de migração cruzada  

---

## 🚨 **PROBLEMA IDENTIFICADO**

### **Código Atual (PROBLEMÁTICO):**
```typescript
// ❌ drizzle.config.ts - Estado Atual
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL, // ⚠️ SEMPRE A MESMA URL
  },
});
```

### **Riscos Identificados:**
1. **Migração Cruzada:** `drizzle migrate` pode executar em produção sem intenção
2. **Falta de Validação:** Não verifica se ambiente está configurado corretamente
3. **Inconsistência:** Não usa a lógica de `server/config/environment.ts`

---

## ✅ **SOLUÇÃO IMPLEMENTADA**

### **Código Corrigido:**
```typescript
// ✅ drizzle.config.ts - Versão Corrigida
import { defineConfig } from "drizzle-kit";

// Detectar ambiente atual
const environment = process.env.NODE_ENV || 'development';

// Mapeamento de URLs por ambiente
const DATABASE_CONFIGS = {
  development: process.env.DEV_DATABASE_URL,
  staging: process.env.STAGING_DATABASE_URL,
  production: process.env.PROD_DATABASE_URL,
  test: process.env.TEST_DATABASE_URL
} as const;

// Obter URL para o ambiente atual
const databaseUrl = DATABASE_CONFIGS[environment as keyof typeof DATABASE_CONFIGS];

// Validação obrigatória de configuração
if (!databaseUrl) {
  throw new Error(`❌ ${environment.toUpperCase()}_DATABASE_URL não configurado para ambiente ${environment}`);
}

// Validação de segurança por hostname
const url = new URL(databaseUrl);
const expectedHostnames = {
  development: ['dev-simpix', 'localhost', '127.0.0.1'],
  staging: ['staging-simpix'],
  production: ['prod-simpix'],
  test: ['test-simpix', 'localhost', '127.0.0.1']
} as const;

const validHost = expectedHostnames[environment as keyof typeof expectedHostnames]?.some(host => 
  url.hostname.includes(host)
);

if (!validHost) {
  throw new Error(`🚨 SECURITY: Hostname ${url.hostname} inválido para ambiente ${environment}. Expected: ${expectedHostnames[environment as keyof typeof expectedHostnames]?.join(', ')}`);
}

// Log de segurança
console.log(`🔧 Drizzle Config: Ambiente ${environment} configurado`);
console.log(`🔗 Drizzle Config: Conectando em ${url.hostname}`);

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: environment === 'development', // Debug apenas em dev
  strict: true, // Validações rigorosas
});
```

---

## 🔧 **SCRIPTS NPM NECESSÁRIOS**

### **Adicionar em package.json:**
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate:dev": "NODE_ENV=development drizzle-kit migrate",
    "db:migrate:staging": "NODE_ENV=staging drizzle-kit migrate", 
    "db:migrate:prod": "NODE_ENV=production drizzle-kit migrate",
    "db:studio:dev": "NODE_ENV=development drizzle-kit studio",
    "db:studio:staging": "NODE_ENV=staging drizzle-kit studio",
    
    // Comandos seguros (sem migração)
    "db:introspect:dev": "NODE_ENV=development drizzle-kit introspect",
    "db:push:dev": "NODE_ENV=development drizzle-kit push",
    
    // Validação de configuração
    "db:validate": "node scripts/validate-db-config.js"
  }
}
```

### **Script de Validação (scripts/validate-db-config.js):**
```javascript
// Validar configurações de database por ambiente
const environments = ['development', 'staging', 'production', 'test'];

console.log('🔍 Validando configurações de database...\n');

environments.forEach(env => {
  const envVar = env === 'development' ? 'DEV_DATABASE_URL' : 
                 env === 'staging' ? 'STAGING_DATABASE_URL' :
                 env === 'production' ? 'PROD_DATABASE_URL' : 'TEST_DATABASE_URL';
  
  const url = process.env[envVar];
  
  if (url) {
    try {
      const parsed = new URL(url);
      console.log(`✅ ${env}: ${envVar} configurado - ${parsed.hostname}`);
    } catch (e) {
      console.log(`❌ ${env}: ${envVar} URL inválida`);
    }
  } else {
    console.log(`⚠️ ${env}: ${envVar} não configurado`);
  }
});

console.log('\n🔍 Validação completa.');
```

---

## 🎯 **VARIÁVEIS DE AMBIENTE NECESSÁRIAS**

### **Development Environment:**
```bash
# Desenvolvimento - banco isolado
DEV_DATABASE_URL=postgresql://dev_user:***@dev-simpix.supabase.co:6543/simpix_dev
NODE_ENV=development
```

### **Staging Environment:**
```bash  
# Staging - dados sintéticos
STAGING_DATABASE_URL=postgresql://staging_user:***@staging-simpix.supabase.co:6543/simpix_staging
NODE_ENV=staging
```

### **Production Environment:**
```bash
# Produção - dados reais (críticos)
PROD_DATABASE_URL=postgresql://prod_user:***@prod-simpix.supabase.co:6543/simpix_prod
NODE_ENV=production
```

### **Test Environment:**
```bash
# Testes - banco temporário
TEST_DATABASE_URL=postgresql://test_user:***@localhost:5432/simpix_test
NODE_ENV=test
```

---

## ✅ **VALIDAÇÃO DE CORREÇÃO**

### **Teste 1: Ambiente Não Configurado**
```bash
NODE_ENV=production npm run db:generate
# Deve falhar com: "PROD_DATABASE_URL não configurado"
```

### **Teste 2: Hostname Inválido**
```bash
PROD_DATABASE_URL=postgresql://user:pass@wrong-host.com/db NODE_ENV=production npm run db:generate
# Deve falhar com: "Hostname wrong-host.com inválido para ambiente production"
```

### **Teste 3: Ambiente Correto**
```bash
NODE_ENV=development npm run db:generate
# Deve funcionar e mostrar: "Ambiente development configurado"
```

---

## 📊 **BENEFÍCIOS DA CORREÇÃO**

### **Segurança:**
- ✅ Impossível migrar ambiente errado por acidente
- ✅ Validação de hostname impede conexões cruzadas
- ✅ Logs claros de qual ambiente está sendo usado

### **Operacional:**
- ✅ Scripts específicos por ambiente
- ✅ Validação pré-execução
- ✅ Consistência com `server/config/environment.ts`

### **Desenvolvimento:**
- ✅ Falha rápida se configuração estiver errada
- ✅ Debug apenas em development
- ✅ Comandos CLI claros e específicos

---

## 🚀 **PRÓXIMOS PASSOS**

1. **Implementar correção no drizzle.config.ts**
2. **Adicionar scripts npm específicos**  
3. **Criar script de validação**
4. **Configurar variáveis por ambiente**
5. **Testar migração em cada ambiente**
6. **Documentar processo operacional**

---

**Status:** 📋 DOCUMENTADO - Pronto para implementação  
**Impacto:** 🔴 CRÍTICO - Necessário antes de qualquer migração  
**Tempo Estimado:** 4 horas implementação + 2 horas testes