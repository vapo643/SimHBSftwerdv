# 🚨 SUPER MEGA PROMPT DE EMERGÊNCIA - OPERAÇÃO CORRENTE DE CONFIANÇA V4.0 COMPACT 🚨

**PARA: IA ESPECIALISTA EM ARQUITETURA E RESOLUÇÃO DE CRISES (DEEP THINK)**  
**DE: ARQUITETO-CHEFE DO PROJETO SIMPIX**  
**ASSUNTO: SOLICITAÇÃO DE ANÁLISE DE CAUSA RAIZ E PLANO DE CORREÇÃO DEFINITIVO**

---

## **🔥 EMERGÊNCIA DEFCON 1 - SISTEMA EM COLAPSO TOTAL**

**SITUAÇÃO:**
- 🔴 **STATUS:** PRODUÇÃO `sistemasimpix.com.br` TOTALMENTE INACESSÍVEL  
- ⏰ **DURAÇÃO:** +6 HORAS DE DOWNTIME
- 👥 **IMPACTO:** 500+ usuários sem acesso, R$ 50.000+ de prejuízo/dia
- 🎯 **CAUSA:** MISMATCH DE JWT SECRET ENTRE FRONTEND E BACKEND

---

## **1. 📈 HISTÓRICO DE TENTATIVAS FALHADAS (+9 HORAS PERDIDAS)**

### **🔄 TENTATIVA #1: "Sincronização JWT" (3h) - ❌ FALHOU**
```
[CONFIG] 🚨 FALHA: SUPABASE_JWT_SECRET não definida
Error: Segredo JWT não configurado
```

### **🔄 TENTATIVA #2: "Detecção Automática" (4h) - ❌ FALHOU**
```typescript
const environmentType = detectEnvironmentFromDomain();
// Lógica com 31 linhas - introduziu MAIS contaminação
```

### **🔄 TENTATIVA #3: "Refatoração getJwtSecret" (2h) - ❌ FALHOU**
```
[CONFIG] ✅ Segredo JWT de desenvolvimento carregado: DEV_JTW_SECRET
# Mas ainda "invalid signature" em produção
```

**PADRÃO:** Todas focaram na configuração mas ignoraram o **MISMATCH FUNDAMENTAL** entre projetos Supabase.

---

## **2. 🔍 EVIDÊNCIAS FORENSES IRREFUTÁVEIS**

### **🖥️ LOGS COMPLETOS DO CONSOLE (PRODUÇÃO)**
```bash
# 🟢 FRONTEND: TOKEN GERADO COM SUCESSO
🔐 [AUTH EVENT] SIGNED_IN {hasSession: true, tokenLength: 783}
✅ [TOKEN MANAGER] Token refreshed successfully, expires at 2025-09-15T15:16:37.000Z

# 🟡 FRONTEND: ENVIO PARA BACKEND
[PASSO 3 - ENVIO] {
  url: 'https://sistemasimpix.com.br/api/debug/me', 
  authorizationHeader: 'Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6Ii9YS2RwUDA2a0R…', 
  hasToken: true
}

# 🔴 BACKEND: REJEIÇÃO TOTAL
GET https://sistemasimpix.com.br/api/debug/me 401 (Unauthorized)
[API Client] Raw JSON response: {message: 'Token inválido ou expirado'}
🗑️ [TOKEN MANAGER] Token invalidated

# 🔄 LOOP INFINITO CONFIRMADO
🔐 [TOKEN MANAGER] Refreshing token (attempt 1/3)
✅ [TOKEN MANAGER] Token refreshed successfully
GET https://sistemasimpix.com.br/api/debug/me 401 (Unauthorized)
Error: ApiError: Token inválido ou expirado
# CICLO CONTINUA INFINITAMENTE...
```

### **🖥️ LOGS DO SERVIDOR - "INVALID SIGNATURE"**
```bash
2025-09-15 11:03:17.01 | [JWT DEBUG] Falha na validação. Erro completo: {
  message: 'invalid signature',
  mode: 'LOCAL',
  fullError: '{"message": "invalid signature"}'
}
⚠️ [SECURITY] TOKEN_INVALID | severity=MEDIUM | FAILURE | ip=187.36.168.240

# PADRÃO REPETITIVO POR HORAS:
11:16:37 | [JWT DEBUG] ==== FIM DA VALIDAÇÃO JWT (FALHA) ====
11:16:37 | ⚠️ TOKEN_INVALID | FAILURE
11:24:22 | [JWT DEBUG] ==== FIM DA VALIDAÇÃO JWT (FALHA) ====
```

**ANÁLISE:** Frontend gera tokens válidos (783 chars), backend rejeita TODOS com "invalid signature" = **JWT SECRET MISMATCH CONFIRMADO**.

---

## **3. 🔐 AUDITORIA DE SECRETS - CONTAMINAÇÃO TOTAL**

**AMBIENTE PRODUÇÃO (41 SECRETS TOTAIS):**
```bash
# ✅ ESSENCIAIS CORRETOS:
VITE_SUPABASE_URL=••••••••
VITE_SUPABASE_ANON_KEY=••••••••
PROD_JWT_SECRET=••••••••
PROD_SUPABASE_URL=••••••••

# 🔴 CONTAMINAÇÃO DEV (DELETAR):
DEV_DATABASE_URL=••••••••          ← PROBLEMA!
DEV_SUPABASE_SERVICE_ROLE_KEY=••••••••  ← PROBLEMA!
DEV_SUPABASE_URL=••••••••           ← PROBLEMA!
DEV_JTW_SECRET=••••••••             ← PROBLEMA!

# 🟡 DUPLICATAS CONFUSAS:
VITE_PROD_SUPABASE_URL=••••••••     ← REDUNDANTE
VITE_PROD_SUPABASE_ANON_KEY=••••••••  ← REDUNDANTE
```

**DIAGNÓSTICO:** Sistema tem acesso a **4 projetos Supabase diferentes** mas não consegue decidir qual usar consistentemente.

---

## **4. 🧬 CAUSA RAIZ CONFIRMADA**

```mermaid
Frontend → usa VITE_SUPABASE_URL (Projeto A) → gera tokens com JWT Secret A
    ↓
Backend → usa PROD_JWT_SECRET (Projeto B) → valida com JWT Secret B
    ↓  
❌ REJEITA: JWT Secret A ≠ JWT Secret B = "invalid signature"
```

**MUTAÇÕES TÓXICAS NO CÓDIGO:**
```typescript
// ❌ CÓDIGO PROBLEMÁTICO:
function detectEnvironmentFromDomain() { /* LÓGICA MÁGICA FALHA */ }
function getJwtSecret() { 
  if (isProduction) { return PROD_JWT_SECRET; }
  else { return DEV_JTW_SECRET; }
}
```

---

## **5. 🚀 OPERAÇÃO PHOENIX - RESSURREIÇÃO IMEDIATA**

### **FRENTE 1: HOTFIX EMERGENCIAL (0-30 MIN)**

#### **📋 CHECKLIST CRÍTICO:**
```bash
# MINUTO 0-5: INVESTIGAÇÃO
1. Acessar sistemasimpix.com.br → F12 → Console
2. Procurar: [PASSO 3 - ENVIO] {url: '...'}
3. Extrair URL Supabase real do frontend

# MINUTO 5-15: IDENTIFICAÇÃO
4. URL = https://abc123.supabase.co
5. Acessar: https://app.supabase.com/project/abc123
6. Settings → API → Copiar "JWT Secret" (não service_role)

# MINUTO 15-25: CORREÇÃO CIRÚRGICA  
7. Definir: SUPABASE_JWT_SECRET=[VALOR_COPIADO]
8. REMOVER: PROD_JWT_SECRET, DEV_JTW_SECRET  
9. Redeploy aplicação

# MINUTO 25-30: VALIDAÇÃO
10. Testar: curl -H "Authorization: Bearer [TOKEN]" sistemasimpix.com.br/api/debug/me
11. SUCESSO = Status 200 + dados usuário
```

### **FRENTE 2: BLINDAGEM ARQUITETURAL (30-120 MIN)**

#### **DESCONTAMINAÇÃO:**
```typescript
// ✅ CÓDIGO LIMPO:
function getJwtSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('❌ SUPABASE_JWT_SECRET obrigatório');
  return secret;
}
```

#### **VALIDAÇÃO ANTI-REGRESSÃO:**
```typescript
// server/index.ts
const CRITICAL_SECRETS = ['SUPABASE_URL', 'SUPABASE_JWT_SECRET', 'SUPABASE_ANON_KEY'];
CRITICAL_SECRETS.forEach(secret => {
  if (!process.env[secret]) {
    console.error(`🚨 FATAL: ${secret} não configurado`);
    process.exit(1);
  }
});

// ALINHAMENTO FRONTEND-BACKEND:
if (process.env.VITE_SUPABASE_URL !== process.env.SUPABASE_URL) {
  console.error('🚨 FATAL: Frontend e backend usando projetos diferentes');
  process.exit(1);
}
```

#### **HEALTH CHECK:**
```typescript
app.get('/api/health/config', (req, res) => {
  res.json({
    status: 'HEALTHY',
    supabaseUrlsMatch: process.env.VITE_SUPABASE_URL === process.env.SUPABASE_URL,
    hasRequiredSecrets: CRITICAL_SECRETS.every(s => !!process.env[s]),
    contaminationDetected: ['DEV_JWT_SECRET', 'DEV_SUPABASE_URL'].some(s => !!process.env[s])
  });
});
```

---

## **6. 📋 CONFIGURAÇÃO DEFINITIVA**

### **PRODUÇÃO:**
```bash
# 🎯 CORE (UM PROJETO ÚNICO):
SUPABASE_URL=https://abc123.supabase.co
SUPABASE_JWT_SECRET=jwt-secret-do-projeto-abc123
SUPABASE_ANON_KEY=anon-key-do-projeto-abc123
VITE_SUPABASE_URL=https://abc123.supabase.co
VITE_SUPABASE_ANON_KEY=anon-key-do-projeto-abc123

# ❌ DELETAR PERMANENTEMENTE:
DEV_DATABASE_URL, DEV_SUPABASE_URL, DEV_JTW_SECRET
PROD_JWT_SECRET, VITE_PROD_SUPABASE_URL
```

### **DESENVOLVIMENTO:**
```bash
SUPABASE_URL=https://dev456.supabase.co
SUPABASE_JWT_SECRET=jwt-secret-do-projeto-dev456
VITE_SUPABASE_URL=https://dev456.supabase.co
```

---

## **7. ✅ CRITÉRIOS DE SUCESSO**

### **FASE 1 - HOTFIX:**
```bash
SUCESSO = (
  curl sistemasimpix.com.br/api/debug/me returns 200 AND
  browser console shows 0 "401 Unauthorized" AND  
  logs show "✅ Token validado com sucesso"
)
```

### **FASE 2 - BLINDAGEM:**
```bash
SUCESSO = (
  zero secrets DEV_ em produção AND
  VITE_SUPABASE_URL === SUPABASE_URL AND
  /api/health/config returns "HEALTHY"
)
```

---

## **🤖 PROTOCOLO DE COMUNICAÇÃO LLM-TO-LLM**

### **🎭 ROLE OBRIGATÓRIA:**
```
🏛️ ARQUITETO SÊNIOR DE SISTEMAS CRÍTICOS
- 15+ anos resolvendo falhas P0 em fintechs
- Especialista Supabase JWT + Node.js + contaminação ambiente
- Mindset: "ZERO TOLERÂNCIA A FALHAS"
```

### **📋 OUTPUT FORMAT:**
```markdown
## FASE X: [Nome]
### ✅ AÇÃO: [Específica]
**COMANDO:** `comando-copy-paste-pronto`
**VALIDAÇÃO:** `como-testar-sucesso`
**ERRO SE:** [condição-de-falha]
```

### **⚙️ CONSTRAINTS:**
- ✅ **PODE:** Gerar código TS/JS, scripts bash, arquiteturas
- ❌ **NÃO PODE:** Executar comandos, acessar Supabase, modificar secrets
- 🎯 **OBRIGATÓRIO:** 100% executável, zero ambiguidade

### **📊 MÉTRICAS QUANTIFICÁVEIS:**
```bash
# P0 (CRÍTICO): Produção funcionando <30 min
# P1 (URGENTE): Zero regressões  
# REGRA: Se P0 falhar, PARE e reavalie
```

### **🎨 COMUNICAÇÃO:**
- ✅ **DO:** Imperativo direto, comandos específicos, evidência quantificada
- ❌ **DON'T:** "talvez", "configure adequadamente", suposições

### **⚡ URGÊNCIA MÁXIMA:**
```
🚨 CADA MINUTO = R$ 35 DE PREJUÍZO
🚨 CADA ERRO = CREDIBILIDADE PERDIDA
🚨 FALHA = PROJETO EM RISCO TOTAL
```

---

## **📢 ATIVAÇÃO FINAL**

**🚀 ARQUITETO SÊNIOR, VOCÊ ESTÁ OFICIALMENTE ATIVADO!**

**MISSÃO:** Gerar plano SO DETALHADO que um dev júnior execute SEM ERROS e restaure sistemasimpix.com.br em 30 minutos.

**CRITÉRIO:** Se suas instruções não resolverem na PRIMEIRA tentativa, você FALHOU.

**A produção está em COLAPSO há 6+ horas. Você tem 2 horas para:**
1. **RESTAURAR** autenticação (0-30 min)
2. **BLINDAR** contra regressões (30-120 min)  
3. **VALIDAR** com testes automatizados

**EXECUTE OPERAÇÃO PHOENIX AGORA. FALHA NÃO É OPÇÃO.**