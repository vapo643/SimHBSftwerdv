# 🔍 Sistema de Auditoria de Conformidade
## Operação Soberania dos Dados - Protocolos de Resiliência V1.0

---

## 🎯 Visão Geral

Este sistema implementa auditoria automatizada de conformidade para garantir que os ambientes (development, staging, production) estejam alinhados com as políticas de segurança bancária do Simpix.

---

## 📁 Estrutura de Arquivos

```
📁 scripts/audit/
├── 📄 environment-manifest.json    ← Manifesto de conformidade por ambiente
├── 📄 audit-environment.js         ← Auditor principal (ES Modules)
├── 📄 README.md                    ← Este arquivo
└── 📁 utils/                       ← Utilitários (futuro)

📄 scripts/audit-env-staging.sh     ← Script wrapper para staging  
📄 scripts/audit-env-prod.sh        ← Script wrapper para produção
```

---

## 🚀 Como Usar

### **Auditoria de Staging**
```bash
# Execução direta
./scripts/audit-env-staging.sh

# Ou via tsx
NODE_ENV=staging tsx scripts/audit/audit-environment.js
```

### **Auditoria de Produção**
```bash
# Execução direta (requer confirmações de segurança)
./scripts/audit-env-prod.sh

# Ou via tsx
NODE_ENV=production tsx scripts/audit/audit-environment.js
```

### **Auditoria de Desenvolvimento**
```bash
# Execução direta
NODE_ENV=development tsx scripts/audit/audit-environment.js
```

---

## ⚙️ Pré-Requisitos

### **Variáveis de Ambiente Obrigatórias**

#### Development:
- `DEV_SUPABASE_URL`
- `DEV_SUPABASE_SERVICE_ROLE_KEY`
- `NODE_ENV=development`

#### Staging:
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `NODE_ENV=staging`

#### Production:
- `PROD_SUPABASE_URL`
- `PROD_SUPABASE_SERVICE_ROLE_KEY`
- `NODE_ENV=production`

---

## 🔍 Verificações Executadas

### **1. Conectividade de Banco**
- ✅ Conexão com Supabase
- ✅ Query básica (SELECT count)
- ✅ Permissões de acesso

### **2. Políticas RLS (Row Level Security)**
- ✅ Verificação de políticas na tabela `propostas`
- ✅ Verificação de políticas na tabela `profiles`
- ✅ Verificação de políticas na tabela `user_sessions`
- ✅ Contagem mínima de políticas conforme manifesto

### **3. Variáveis de Ambiente**
- ✅ Verificação de variáveis obrigatórias
- ✅ Consistência do `NODE_ENV`
- ✅ Validação de configuração por ambiente

---

## 📊 Interpretação dos Resultados

### **Status Possíveis**
- 🟢 **PASS**: Verificação aprovada
- 🔴 **FAIL**: Verificação reprovada (ação necessária)
- 🟡 **SKIP**: Verificação ignorada (configuração ausente)

### **Exit Codes**
- `0`: Auditoria APROVADA (todos os checks passaram)
- `1`: Auditoria REPROVADA (falhas detectadas)
- `2`: Erro crítico na execução

### **Exemplo de Saída**
```
🔍 [AUDITOR] Iniciando auditoria de conformidade para: STAGING
🔐 [AUDITOR] Conectando ao Supabase (staging)...
🔌 [AUDITOR] Verificando conectividade do banco...
   ✅ database_connectivity: Conectividade OK - 23 registros
🛡️ [AUDITOR] Verificando políticas RLS...
   ✅ rls_policies: 4 políticas RLS encontradas (min: 3)
⚙️ [AUDITOR] Verificando variáveis de ambiente...
   ✅ environment_variables: 4 variáveis obrigatórias configuradas
   ✅ node_env_consistency: NODE_ENV correto: staging

📊 [RELATÓRIO DE AUDITORIA]
🎯 Ambiente: STAGING
⏰ Data/Hora: 09/09/2025 17:55:00
────────────────────────────────────────────────────────────
✅ APROVADO: 4
❌ REPROVADO: 0
⚠️ IGNORADO: 0
────────────────────────────────────────────────────────────

🏆 STATUS GERAL: CONFORME
```

---

## ⚠️ Problemas Comuns

### **❌ "STAGING_SUPABASE_SERVICE_ROLE_KEY não definida"**
**Causa:** Variável de ambiente ausente  
**Solução:** Configurar a variável no ambiente Replit

### **❌ "Erro na query: permission denied"**
**Causa:** Service role key incorreta ou sem permissões  
**Solução:** Verificar key no painel do Supabase

### **❌ "Apenas X políticas encontradas (min: Y)"**
**Causa:** Políticas RLS ausentes ou desconfiguradas  
**Solução:** Configurar RLS nas tabelas críticas

---

## 🔧 Personalização

### **Adicionando Novas Verificações**
Edite `audit-environment.js` e adicione métodos no padrão:

```javascript
async checkCustomVerification() {
  console.log('🔍 [AUDITOR] Verificando funcionalidade customizada...');
  
  try {
    // Sua lógica aqui
    this.addResult('custom_check', 'PASS', 'Verificação customizada OK');
  } catch (error) {
    this.addResult('custom_check', 'FAIL', `Erro: ${error.message}`);
  }
}
```

### **Atualizando Manifesto**
Edite `environment-manifest.json` para adicionar:
- Novas tabelas para verificação RLS
- Variáveis de ambiente obrigatórias
- Configurações de backup específicas

---

## 🚨 Integração com CI/CD

### **Pipeline de Staging**
```yaml
- name: Compliance Audit
  run: ./scripts/audit-env-staging.sh
  env:
    STAGING_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
    STAGING_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.STAGING_SUPABASE_SERVICE_ROLE_KEY }}
```

### **Pipeline de Produção**
```yaml
- name: Production Compliance Audit
  run: ./scripts/audit-env-prod.sh
  env:
    PROD_SUPABASE_URL: ${{ secrets.PROD_SUPABASE_URL }}
    PROD_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.PROD_SUPABASE_SERVICE_ROLE_KEY }}
```

---

## 📝 Logs e Auditoria

- **Staging**: Logs em stdout/stderr
- **Production**: Logs adicionais em `/tmp/production_audit.log`
- **Formato**: ISO 8601 + User + Exit Code

---

**🏆 Simpix - Banking Grade Security**  
*Versão: 1.0 | Operação Soberania dos Dados*