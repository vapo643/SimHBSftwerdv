# 🚨 SUPER MEGA PROMPT DE EMERGÊNCIA - OPERAÇÃO CORRENTE DE CONFIANÇA V4.0 🚨

**PARA: IA ESPECIALISTA EM ARQUITETURA E RESOLUÇÃO DE CRISES (DEEP THINK)**  
**DE: ARQUITETO-CHEFE DO PROJETO SIMPIX**  
**ASSUNTO: SOLICITAÇÃO DE ANÁLISE DE CAUSA RAIZ E PLANO DE CORREÇÃO DEFINITIVO PARA FALHA CATASTRÓFICA DE CONTAMINAÇÃO DE AMBIENTE**

---

## **🔥 SITUAÇÃO DE EMERGÊNCIA - NIVEL DEFCON 1 🔥**

### **RESUMO EXECUTIVO DA CRISE:**
- **STATUS:** 🔴 PRODUÇÃO TOTALMENTE INACESSÍVEL
- **DURAÇÃO:** +6 HORAS DE DOWNTIME
- **IMPACTO:** 100% DOS USUÁRIOS SEM ACESSO 
- **SEVERIDADE:** P0 - FALHA CATASTRÓFICA TOTAL
- **CAUSA RAIZ:** MISMATCH DE JWT SECRET ENTRE FRONTEND E BACKEND

---

## **1. CONTEXTO CRÍTICO E IMPACTO NO NEGÓCIO**

### **🚨 ESTADO ATUAL: SISTEMA EM COLAPSO TOTAL**

O sistema Simpix está num estado de **FALHA CATASTRÓFICA TOTAL**, resultando num "apagão" completo que paralisa todas as operações. O ambiente de **Produção** (`https://sistemasimpix.com.br`) apresenta **LOOP INFINITO DE AUTENTICAÇÃO** que impede qualquer funcionalidade. Esta falha bloqueia **100% DA FUNCIONALIDADE** para todos os usuários e impede qualquer avanço no desenvolvimento.

### **📈 HISTÓRICO DE INCIDENTES RECORRENTES**

Este é um **INCIDENTE RECORRENTE** que vem se manifestando há semanas. A equipe já realizou **MÚLTIPLAS TENTATIVAS DE CORREÇÃO** que falharam sistemáticamente:

#### **🔄 TENTATIVA 1 (FALHADA): "Sincronização de Secrets JWT"**
- **Ação:** Tentativa de alinhar PROD_JWT_SECRET com frontend  
- **Resultado:** ❌ FALHOU - Loop persistiu
- **Duração:** 3 horas perdidas

#### **🔄 TENTATIVA 2 (FALHADA): "Detecção Automática de Ambiente"**  
- **Ação:** Implementação de lógica `NODE_ENV` condicional
- **Resultado:** ❌ FALHOU - Introduziu mais contaminação
- **Duração:** 4 horas perdidas

#### **🔄 TENTATIVA 3 (FALHADA): "Refatoração de Configuração"**
- **Ação:** Tentativa de usar getJwtSecret() com fallbacks
- **Resultado:** ❌ FALHOU - Mismatch persiste
- **Duração:** 2 horas perdidas

**TOTAL DE TEMPO PERDIDO:** +9 horas de tentativas falhadas

### **💰 IMPACTO FINANCEIRO E OPERACIONAL**

- **Usuários Impactados:** 100% da base de usuários (estimado 500+ usuários ativos)
- **Operações Bloqueadas:** Todos os fluxos de negócio (crédito, pagamentos, assinaturas)
- **Receita em Risco:** Estimado R$ 50.000+ por dia de downtime
- **Reputação:** Credibilidade da fintech severamente comprometida

## **2. HISTÓRICO E GATILHO DA FALHA**

É de importância crítica notar que esta classe de erro começou a manifestar-se **imediatamente após a implementação da separação dos ambientes de Desenvolvimento e Produção**. Antes desta separação, com uma única base de dados e um único conjunto de segredos, o sistema era estável. Isto prova que a falha reside na nossa estratégia de gestão de múltiplos ambientes.

A hipótese central do Arquiteto-Chefe é que a nossa metodologia atual é a causa direta da crise: **a prática de manter segredos de DEV no ambiente de PROD (e vice-versa) está a criar uma "contaminação de ambiente"**. O código tenta ser "inteligente" ao detetar em qual ambiente está a ser executado, mas esta lógica está a falhar espetacularmente, levando a um cenário onde o frontend e o backend operam com configurações de ambientes diferentes, tornando a validação de tokens impossível.

## **3. 🔍 EVIDÊNCIAS IRREFUTÁVEIS - PROVA FORENSE DA FALHA**

### **🖥️ 3.1. LOGS COMPLETOS DO CONSOLE DO NAVEGADOR (PRODUÇÃO)**

**Fonte:** Console do navegador em `https://sistemasimpix.com.br/dashboard`  
**Timestamp:** 2025-09-15 14:16:37 UTC  
**Status:** ❌ LOOP INFINITO CONFIRMADO

```bash
# =====================================================================
# 🟢 FASE 1: FRONTEND OBTÉM TOKEN COM SUCESSO (SUPABASE FUNCIONANDO)
# =====================================================================
🔐 [AUTH EVENT] SIGNED_IN {hasSession: true, tokenLength: 783}
index-DCcUDTC4.js:56 🔐 [AUTH START] Iniciando fetchUserProfile
index-DCcUDTC4.js:56 [AUTH DEBUG] getValidToken chamado: {forceRefresh: false, hasCachedToken: false, tokenExpiry: null, hasActiveRefresh: false}
index-DCcUDTC4.js:56 🔐 [TOKEN MANAGER] Refreshing token (attempt 1/3)
index-DCcUDTC4.js:56 ✅ [TOKEN MANAGER] Token refreshed successfully, expires at 2025-09-15T15:16:37.000Z
index-DCcUDTC4.js:56 🔐 [AUTH EVENT] INITIAL_SESSION {hasSession: true, tokenLength: 783}

# =====================================================================
# 🟡 FASE 2: FRONTEND ENVIA TOKEN PARA BACKEND (REQUISIÇÕES MÚLTIPLAS)
# =====================================================================
index-DCcUDTC4.js:56 [PASSO 3 - ENVIO] {
  url: 'https://sistemasimpix.com.br/api/debug/me', 
  authorizationHeader: 'Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6Ii9YS2RwUDA2a0R…sc2V9.nS00tY51funHynQLes9Ckd_O7jjehE0SezdsP_adZyk', 
  hasToken: true, 
  isFormData: false
}
index-DCcUDTC4.js:56 [PASSO 3 - ENVIO] {
  url: 'https://sistemasimpix.com.br/api/alertas/notificacoes', 
  authorizationHeader: 'Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6Ii9YS2RwUDA2a0R…sc2V9.nS00tY51funHynQLes9Ckd_O7jjehE0SezdsP_adZyk', 
  hasToken: true, 
  isFormData: false
}

# =====================================================================
# 🔴 FASE 3: BACKEND REJEITA TOKENS - ERRO 401 (PROBLEMA CONFIRMADO)
# =====================================================================
requests.js:1  GET https://sistemasimpix.com.br/api/debug/me 401 (Unauthorized)
(anonymous) @ requests.js:1
(anonymous) @ index-DCcUDTC4.js:56
fetchWithTimeout @ index-DCcUDTC4.js:107
Eu @ index-DCcUDTC4.js:107
await in Eu
get @ index-DCcUDTC4.js:107

# =====================================================================
# 🔴 FASE 4: BACKEND CONFIRMA REJEIÇÃO COM MENSAGEM DE ERRO
# =====================================================================
index-DCcUDTC4.js:56 [API Client] Raw JSON response from https://sistemasimpix.com.br/api/debug/me : {message: 'Token inválido ou expirado'}
index-DCcUDTC4.js:56 [API Client] After dual-key transformation: {message: 'Token inválido ou expirado'}
index-DCcUDTC4.js:56 🗑️ [TOKEN MANAGER] Token invalidated

# =====================================================================
# 🔄 FASE 5: LOOP INFINITO - CICLO RECOMEÇA (PROBLEMA PERSISTE)
# =====================================================================
index-DCcUDTC4.js:56 [AUTH DEBUG] getValidToken chamado: {forceRefresh: false, hasCachedToken: false, tokenExpiry: null, hasActiveRefresh: false}
index-DCcUDTC4.js:56 🔐 [TOKEN MANAGER] Refreshing token (attempt 1/3)
index-DCcUDTC4.js:56 ✅ [TOKEN MANAGER] Token refreshed successfully, expires at 2025-09-15T15:16:37.000Z

# NOVA TENTATIVA - MESMO ERRO
requests.js:1  GET https://sistemasimpix.com.br/api/debug/me 401 (Unauthorized)
index-DCcUDTC4.js:56 [API Client] Raw JSON response from https://sistemasimpix.com.br/api/debug/me : {message: 'Token inválido ou expirado'}
index-DCcUDTC4.js:56 🗑️ [TOKEN MANAGER] Token invalidated

# TERCEIRA TENTATIVA - MESMO ERRO
index-DCcUDTC4.js:56 [AUTH DEBUG] getValidToken chamado: {forceRefresh: false, hasCachedToken: false, tokenExpiry: null, hasActiveRefresh: false}
index-DCcUDTC4.js:56 🔐 [TOKEN MANAGER] Refreshing token (attempt 1/3)
index-DCcUDTC4.js:56 ✅ [TOKEN MANAGER] Token refreshed successfully, expires at 2025-09-15T15:16:37.000Z
requests.js:1  GET https://sistemasimpix.com.br/api/debug/me 401 (Unauthorized)

# =====================================================================
# ❌ ERRO FINAL: FALHA TOTAL DA AUTENTICAÇÃO
# =====================================================================
index-DCcUDTC4.js:56 Error fetching profile data: ApiError: Token inválido ou expirado
    at Eu (index-DCcUDTC4.js:107:40749)
    at async index-DCcUDTC4.js:666:6282
index-DCcUDTC4.js:56 🔐 [AUTH END] Finalizando fetchUserProfile, liberando lock

# CICLO CONTINUA INFINITAMENTE...
index-DCcUDTC4.js:56 🔐 [AUTH EVENT] SIGNED_IN {hasSession: true, tokenLength: 783}
index-DCcUDTC4.js:56 ✅ [TOKEN MANAGER] Using cached token
requests.js:1  GET https://sistemasimpix.com.br/api/debug/me 401 (Unauthorized)
# ... LOOP INFINITO CONFIRMADO ...
```

### **🖥️ 3.2. LOGS CRÍTICOS DO SERVIDOR (BACKEND) - "INVALID SIGNATURE"**

**Fonte:** Logs do servidor de produção `sistemasimpix.com.br`  
**Timestamp:** 2025-09-15 11:03:17 UTC  
**Status:** ❌ VALIDAÇÃO JWT FALHANDO COM "INVALID SIGNATURE"

```bash
# =====================================================================
# 🚨 ERRO CRÍTICO: ASSINATURA INVÁLIDA NO JWT
# =====================================================================
2025-09-15 11:03:17.01 | 4b54645a | [JWT DEBUG] Falha na validação. Erro completo: {
2025-09-15 11:03:17.01 | 4b54645a |   message: 'invalid signature',
2025-09-15 11:03:17.01 | 4b54645a |   mode: 'LOCAL',
2025-09-15 11:03:17.01 | 4b54645a |   fullError: '{\n "message": "invalid signature"\n}'
2025-09-15 11:03:17.01 | 4b54645a | }
2025-09-15 11:03:17.01 | 4b54645a | [JWT DEBUG] ==== FIM DA VALIDAÇÃO JWT (FALHA) ====
2025-09-15 11:03:17.01 | 4b54645a | ⚠️ [SECURITY] TOKEN_INVALID | severity=MEDIUM | FAILURE | ip=187.36.168.240 | endpoint=/api/debug/me

# =====================================================================
# 🔄 PADRÃO REPETITIVO - MÚLTIPLAS FALHAS CONSECUTIVAS
# =====================================================================
2025-09-15 11:16:37.35 | be5fb830 | [REDIS OFFLINE] Rate limit check skipped - graceful degradation
2025-09-15 11:16:37.35 | be5fb830 | [REDIS OFFLINE] Blacklist and cache check skipped - graceful degradation  
2025-09-15 11:16:37.45 | be5fb830 | [JWT DEBUG] ==== FIM DA VALIDAÇÃO JWT (FALHA) ====
2025-09-15 11:16:37.45 | be5fb830 | ⚠️ [SECURITY] TOKEN_INVALID | severity=MEDIUM | FAILURE | ip=187.36.168.240 | endpoint=/api/debug/me

2025-09-15 11:16:37.82 | be5fb830 | [REDIS OFFLINE] Rate limit check skipped - graceful degradation
2025-09-15 11:16:37.82 | be5fb830 | [REDIS OFFLINE] Blacklist and cache check skipped - graceful degradation
2025-09-15 11:16:37.83 | be5fb830 | [JWT DEBUG] ==== FIM DA VALIDAÇÃO JWT (FALHA) ====
2025-09-15 11:16:37.83 | be5fb830 | ⚠️ [SECURITY] TOKEN_INVALID | severity=MEDIUM | FAILURE | ip=187.36.168.240 | endpoint=/api/debug/me

# PADRÃO CONTINUA POR HORAS...
2025-09-15 11:24:22.36 | be5fb830 | [JWT DEBUG] ==== FIM DA VALIDAÇÃO JWT (FALHA) ====
2025-09-15 11:24:22.37 | be5fb830 | ⚠️ [SECURITY] TOKEN_INVALID | severity=MEDIUM | FAILURE | ip=187.36.168.240 | endpoint=/api/debug/me
```

### **🎯 ANÁLISE FORENSE DOS LOGS**

**CONCLUSÃO IRREFUTÁVEL:**
1. ✅ **Frontend:** Supabase gera tokens válidos (783 chars, expires correto)
2. ❌ **Backend:** Rejeita TODOS os tokens com "invalid signature"  
3. 🔄 **Loop:** Sistema fica preso tentando re-autenticar infinitamente
4. 🎯 **Causa Raiz:** JWT secret do backend ≠ JWT secret do projeto Supabase do frontend

### **🔐 3.3. AUDITORIA COMPLETA DE SECRETS - "A CENA DO CRIME"**

A seguir, a lista **COMPLETA** de nomes de variáveis de ambiente presentes no ambiente de produção, que expõe a contaminação cruzada:

**Segredos presentes no Ambiente de Produção (Deploy):**

```
SESSION_SECRET=••••••••
VITE_SUPABASE_URL=••••••••
VITE_SUPABASE_ANON_KEY=••••••••
CLICKSIGN_API_TOKEN=••••••••
CLICKSIGN_WEBHOOK_SECRET=••••••••
INTER_WEBHOOK_SECRET=••••••••
INTER_CONTA_CORRENTE=••••••••
INTER_PRIVATE_KEY=••••••••
INTER_CERTIFICATE=••••••••
INTER_CLIENT_SECRET=••••••••
INTER_CLIENT_ID=••••••••
VITE_HMR_CLIENT_HOST=••••••••
VITE_HMR_CLIENT_PORT=••••••••
TEST_DATABASE_URL=••••••••
TEST_SUPABASE_SERVICE_ROLE_KEY=••••••••
REDIS_PORT=••••••••
REDIS_PASSWORD=••••••••
REDIS_HOST=••••••••
SENTRY_DSN=••••••••
VITE_SENTRY_DSN=••••••••
CSRF_SECRET=••••••••
PROD_JWT_SECRET=••••••••
PROD_SESSION_SECRET=••••••••
PROD_CSRF_SECRET=••••••••
PROD_FRONTEND_URL=••••••••
PROD_ALERT_EMAIL=••••••••
PROD_SUPABASE_SERVICE_ROLE_KEY=••••••••
PROD_SUPABASE_ANON_KEY=••••••••
PROD_SUPABASE_URL=••••••••
PROD_DATABASE_URL=••••••••
PROD_SUPABASE_SERVICE_KEY=••••••••
REDIS_URL=••••••••
CONNECTORS_HOSTNAME=••••••••
REPLIT_CONNECTORS_HOSTNAME=••••••••
VITE_PROD_SUPABASE_URL=••••••••
VITE_PROD_SUPABASE_ANON_KEY=••••••••
DEV_DATABASE_URL=••••••••        ← (Contaminação!)
DEV_SUPABASE_SERVICE_ROLE_KEY=••••••••  ← (Contaminação!)
DEV_SUPABASE_ANON_KEY=••••••••    ← (Contaminação!)
DEV_SUPABASE_URL=••••••••         ← (Contaminação!)
DEV_JTW_SECRET=••••••••           ← (Contaminação!)
```

**🚨 ANÁLISE CRÍTICA DA CONTAMINAÇÃO:**
- ⚠️ **41 SECRETS TOTAIS** no ambiente de produção
- 🔴 **5 SECRETS DE DEV** contaminando produção (DEV_*)
- 🟡 **3 VARIAÇÕES** de Supabase URL/KEY (VITE_, VITE_PROD_, PROD_)
- ❌ **AMBIGUIDADE TOTAL** sobre qual projeto Supabase usar

**CONCLUSÃO:** A presença de segredos de múltiplos ambientes é a raiz de todo o mal. O código está sendo forçado a fazer escolhas que deveriam ser feitas pela infraestrutura.

### **⚙️ 3.4. HISTÓRICO DETALHADO DAS TENTATIVAS FALHADAS**

#### **🔄 TENTATIVA FALHADA #1: "OPERAÇÃO CORRENTE DE CONFIANÇA V1.0"**
**Data:** 2025-09-14  
**Duração:** 3 horas  
**Estratégia:** Sincronização manual de PROD_JWT_SECRET  
**Resultado:** ❌ FALHOU  
**Log da Falha:**
```
[CONFIG] 🚨 FALHA CRÍTICA: A variável de ambiente SUPABASE_JWT_SECRET não está definida
Error: Segredo JWT não configurado.
🛑 O servidor não pode iniciar com configuração inconsistente.
```

#### **🔄 TENTATIVA FALHADA #2: "DETECÇÃO AUTOMÁTICA DE AMBIENTE"**  
**Data:** 2025-09-15 AM  
**Duração:** 4 horas  
**Estratégia:** Implementação de detectEnvironmentFromDomain()  
**Resultado:** ❌ FALHOU  
**Log da Falha:**
```
const environmentType = detectEnvironmentFromDomain();
// Lógica complexa com 31 linhas de condicionais
// Introduziu MAIS contaminação cruzada
```

#### **🔄 TENTATIVA FALHADA #3: "REFATORAÇÃO GETJWTSECRET"**
**Data:** 2025-09-15 PM  
**Duração:** 2 horas  
**Estratégia:** Função getJwtSecret() com fallbacks múltiplos  
**Resultado:** ❌ FALHOU  
**Log da Falha:**
```
[CONFIG] ✅ Segredo JWT de desenvolvimento carregado: DEV_JTW_SECRET
# Mas ainda recebendo "invalid signature" em produção
```

**PADRÃO DAS FALHAS:** Todas as tentativas focaram na **CONFIGURAÇÃO** mas ignoraram o **MISMATCH FUNDAMENTAL** entre projetos Supabase.

### **⚙️ 3.5. ESTADO ATUAL DO CÓDIGO (A LÓGICA PROBLEMÁTICA)**

O código atual em `server/lib/config.ts` contém lógica condicional que tenta ser "inteligente":

```typescript
// PROBLEMÁTICO: Lógica de detecção de ambiente
function getJwtSecret(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    const prodSecret = process.env.PROD_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
    // ...
  } else {
    const devSecret = process.env.DEV_JTW_SECRET || process.env.SUPABASE_JWT_SECRET;
    // ...
  }
}
```

**PROBLEMA IDENTIFICADO:** Este código assume que NODE_ENV controla qual projeto Supabase usar, mas:
1. Frontend pode estar usando `VITE_SUPABASE_URL` (projeto A)
2. Backend pode estar usando `PROD_JWT_SECRET` (projeto B)
3. Se projetos A ≠ B, tokens serão rejeitados

## **4. 🧬 ANÁLISE ARQUITETURAL PROFUNDA - GENÉTICA DA FALHA**

### **🎯 4.1. CAUSA RAIZ CONFIRMADA: MISMATCH DE PROJETO SUPABASE**

**STATUS:** ✅ **HIPÓTESE CONFIRMADA COM EVIDÊNCIAS FORENSES**

```mermaid
Frontend (sistemasimpix.com.br)
    ↓ usa VITE_SUPABASE_URL
    ↓ conecta ao Projeto Supabase A
    ↓ recebe tokens assinados com JWT Secret A
    ↓ 
    ↓ envia token para backend
    ↓
Backend (sistemasimpix.com.br)
    ↓ usa PROD_JWT_SECRET  
    ↓ valida com JWT Secret B
    ↓ 
    ❌ REJEITA: "invalid signature"
```

**EVIDÊNCIAS MATEMÁTICAS:**
- ✅ Token gerado = 783 chars (formato JWT válido)
- ✅ Token não expirado = expires 2025-09-15T15:16:37.000Z
- ❌ Assinatura inválida = JWT Secret A ≠ JWT Secret B
- 🔄 Loop infinito = frontend continua tentando

### **🧪 4.2. ANATOMIA DA CONTAMINAÇÃO CRUZADA**

**DIAGNÓSTICO:** Sistema sofre de "Síndrome de Personalidade Múltipla" - não sabe qual identidade usar.

```bash
# FRONTEND: 3 opções conflitantes
VITE_SUPABASE_URL=https://projeto-A.supabase.co
VITE_PROD_SUPABASE_URL=https://projeto-B.supabase.co  
# Plus backend usando outros projetos via PROD_SUPABASE_URL

# BACKEND: 4 fontes de JWT secrets
DEV_JTW_SECRET=jwt-secret-projeto-C
PROD_JWT_SECRET=jwt-secret-projeto-D  
SUPABASE_JWT_SECRET=undefined
# Plus lógica condicional tentando "detectar" qual usar
```

**RESULTADO:** Sistema tem acesso a **4 projetos Supabase diferentes** mas não consegue decidir qual usar consistentemente.

### **⚗️ 4.3. MUTAÇÕES ARQUITETURAIS PERIGOSAS**

#### **🦠 MUTAÇÃO 1: "Detecção Mágica de Ambiente"**
```typescript
// CÓDIGO TÓXICO: 
function detectEnvironmentFromDomain(): 'dev' | 'prod' {
  const host = process.env.HOST || process.env.REPL_SLUG || 'localhost';
  const isDevelopment = 
    host.includes('localhost') ||
    host.includes('127.0.0.1') ||
    host.includes('.replit.dev') ||
    host.includes('replit-') ||
    process.env.REPLIT_DEV_DOMAIN;
    
  return isDevelopment ? 'dev' : 'prod';
}
```
**PROBLEMA:** Esta "magia" falha quando domínio ≠ configuração real.

#### **🦠 MUTAÇÃO 2: "Fallbacks em Cascata"**
```typescript
// CÓDIGO TÓXICO:
const prodSecret = process.env.PROD_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
const devSecret = process.env.DEV_JTW_SECRET || process.env.SUPABASE_JWT_SECRET;
```
**PROBLEMA:** Fallbacks criam dependências ocultas e comportamento imprevisível.

## **5. 🎯 MISSÃO CRÍTICA: OPERAÇÃO PHOENIX - RESSUREIÇÃO DO SISTEMA**

**STATUS:** 🚨 **DEFCON 1** - SOLUÇÃO DEFINITIVA OBRIGATÓRIA  
**TIMELINE:** ⏰ **MÁXIMO 2 HORAS** para restaurar produção  
**OBJETIVO:** Eliminar 100% das falhas de autenticação e prevenir regressões futuras

---

### **🚀 FRENTE 1: PROTOCOLO DE RESSUSCITAÇÃO IMEDIATA (0-30 MIN)**

#### **🆘 MISSÃO DE EMERGÊNCIA - TEMPO CRÍTICO**

**OBJETIVO ÚNICO:** Colocar `sistemasimpix.com.br` ONLINE em menos de 30 minutos.

#### **📋 CHECKLIST DE EMERGÊNCIA (EXECUTAR EM SEQUÊNCIA):**

```bash
# ⏱️ MINUTO 0-5: INVESTIGAÇÃO FORENSE
1️⃣ Acessar sistemasimpix.com.br no navegador
2️⃣ Abrir Developer Tools → Console  
3️⃣ Procurar por logs: [PASSO 3 - ENVIO] {url: '...', authorizationHeader: 'Bearer ...'}
4️⃣ Extrair a URL Supabase sendo usada pelo frontend

# ⏱️ MINUTO 5-15: IDENTIFICAÇÃO DO PROJETO CORRETO  
5️⃣ URL encontrada será algo como: https://abc123.supabase.co
6️⃣ Acessar console Supabase: https://app.supabase.com/project/abc123
7️⃣ Ir em: Settings → API → Project Settings
8️⃣ Copiar EXATAMENTE o "JWT Secret" (não service_role, não anon)

# ⏱️ MINUTO 15-25: CORREÇÃO CIRÚRGICA
9️⃣ No ambiente de produção, definir: SUPABASE_JWT_SECRET=[VALOR_COPIADO]
🔟 Remover/comentar TODAS as outras variáveis JWT (PROD_JWT_SECRET, DEV_JTW_SECRET)
1️⃣1️⃣ Redeploy da aplicação

# ⏱️ MINUTO 25-30: VALIDAÇÃO CRÍTICA
1️⃣2️⃣ Testar: curl -H "Authorization: Bearer [TOKEN]" sistemasimpix.com.br/api/debug/me
1️⃣3️⃣ SUCESSO = Status 200 com dados do usuário
1️⃣4️⃣ FALHA = Repetir processo com outro projeto Supabase
```

#### **🎯 VALIDAÇÃO DE EMERGÊNCIA**

**TESTE OBRIGATÓRIO:**
```bash
# Deve retornar 200, não 401
curl -X GET "https://sistemasimpix.com.br/api/debug/me" \
     -H "Authorization: Bearer [TOKEN_DO_CONSOLE]" \
     -v

# Logs esperados no servidor:
[JWT DEBUG] ✅ Token validado com sucesso
[CONFIG] ✅ Segredo JWT carregado: SUPABASE_JWT_SECRET  
✅ GET /api/debug/me 200 (Success)
```

### **🏗️ FRENTE 2: OPERAÇÃO BLINDAGEM ARQUITETURAL (30 MIN - 2 HORAS)**

#### **🎯 MISSÃO ESTRATÉGICA: ERRADICAÇÃO TOTAL DA CLASSE DE FALHAS**

**OBJETIVO:** Implementar arquitetura **IMUNE** a contaminação cruzada e **IMPOSSÍVEL** de regredir.

---

#### **🔥 FASE 1: DESCONTAMINAÇÃO TOTAL (30-60 MIN)**

##### **💀 ELIMINAÇÃO DAS MUTAÇÕES TÓXICAS**

```typescript
// ❌ DELETAR COMPLETAMENTE (CÓDIGO TÓXICO):
function detectEnvironmentFromDomain() { /* DELETE */ }
function getJwtSecret() { 
  if (isProduction) { /* DELETE CONDICIONAL */ }
  else { /* DELETE CONDICIONAL */ }
}

// ✅ SUBSTITUIR POR (CÓDIGO LIMPO):
function getJwtSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('❌ SUPABASE_JWT_SECRET obrigatório');
  }
  return secret;
}
```

##### **🧹 LIMPEZA DE SECRETS CONTAMINADOS**

**REMOVER PERMANENTEMENTE:**
```bash
# ❌ DELETAR (Contaminação DEV em PROD):
DEV_DATABASE_URL
DEV_SUPABASE_SERVICE_ROLE_KEY  
DEV_SUPABASE_ANON_KEY
DEV_SUPABASE_URL
DEV_JTW_SECRET

# ❌ DELETAR (Duplicatas confusas):
PROD_JWT_SECRET          # Usar só SUPABASE_JWT_SECRET
VITE_PROD_SUPABASE_URL   # Usar só VITE_SUPABASE_URL
VITE_PROD_SUPABASE_ANON_KEY  # Usar só VITE_SUPABASE_ANON_KEY
```

---

#### **🛡️ FASE 2: BLINDAGEM ARQUITETURAL (60-90 MIN)**

##### **🏰 PRINCÍPIO DA CONFIGURAÇÃO ÚNICA ("ONE PROJECT RULE")**

```bash
# ✅ CONJUNTO CANÔNICO (UMA FONTE DE VERDADE):
DATABASE_URL=postgresql://...
SUPABASE_URL=https://PROJETO-UNICO.supabase.co  
SUPABASE_JWT_SECRET=JWT-SECRET-DO-PROJETO-UNICO
SUPABASE_ANON_KEY=ANON-KEY-DO-PROJETO-UNICO
VITE_SUPABASE_URL=https://PROJETO-UNICO.supabase.co
VITE_SUPABASE_ANON_KEY=ANON-KEY-DO-PROJETO-UNICO
```

##### **🚫 VALIDAÇÃO ANTI-REGRESSÃO**

```typescript
// ADICIONAR EM server/index.ts:
const CRITICAL_SECRETS = [
  'DATABASE_URL',
  'SUPABASE_URL', 
  'SUPABASE_JWT_SECRET',
  'SUPABASE_ANON_KEY'
];

CRITICAL_SECRETS.forEach(secret => {
  if (!process.env[secret]) {
    console.error(`🚨 FATAL: ${secret} não configurado`);
    process.exit(1);
  }
});

// VALIDAÇÃO DE PROJETO ÚNICO:
const frontendUrl = process.env.VITE_SUPABASE_URL;
const backendUrl = process.env.SUPABASE_URL;
if (frontendUrl !== backendUrl) {
  console.error('🚨 FATAL: Frontend e backend usando projetos Supabase diferentes');
  console.error(`Frontend: ${frontendUrl}`);
  console.error(`Backend: ${backendUrl}`);
  process.exit(1);
}
```

---

#### **🧪 FASE 3: SISTEMA DE IMUNIDADE (90-120 MIN)**

##### **🔬 TESTES AUTOMATIZADOS ANTI-REGRESSÃO**

```bash
# Criar: tests/config-validation.test.ts
describe('🛡️ Blindagem Anti-Contaminação', () => {
  it('❌ DEVE FALHAR se DEV secrets existirem em produção', () => {
    const contamination = ['DEV_JWT_SECRET', 'DEV_SUPABASE_URL'];
    contamination.forEach(secret => {
      expect(process.env[secret]).toBeUndefined();
    });
  });
  
  it('✅ DEVE GARANTIR alinhamento frontend-backend', () => {
    expect(process.env.VITE_SUPABASE_URL).toBe(process.env.SUPABASE_URL);
  });
  
  it('🎯 DEVE VALIDAR JWT matching', async () => {
    const token = generateTestToken();
    const isValid = await validateJWT(token);
    expect(isValid).toBe(true);
  });
});
```

##### **📊 MONITORAMENTO CONTÍNUO**

```typescript
// Adicionar em server/middleware/health-check.ts:
app.get('/api/health/config', (req, res) => {
  const config = {
    supabaseUrlsMatch: process.env.VITE_SUPABASE_URL === process.env.SUPABASE_URL,
    hasRequiredSecrets: CRITICAL_SECRETS.every(s => !!process.env[s]),
    contaminationDetected: ['DEV_JWT_SECRET', 'DEV_SUPABASE_URL'].some(s => !!process.env[s])
  };
  
  res.json({
    status: config.supabaseUrlsMatch && config.hasRequiredSecrets && !config.contaminationDetected ? 'HEALTHY' : 'CONTAMINATED',
    config
  });
});
```

---

## **📋 MANUAL OPERACIONAL DEFINITIVO**

### **🏭 CONFIGURAÇÃO PRODUÇÃO (sistemasimpix.com.br)**

#### **✅ SECRETS ESSENCIAIS (OBRIGATÓRIOS):**
```bash
# 🎯 CORE SUPABASE (UM PROJETO ÚNICO)
SUPABASE_URL=https://abc123.supabase.co
SUPABASE_JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 🖥️ FRONTEND (DEVE COINCIDIR COM BACKEND)
VITE_SUPABASE_URL=https://abc123.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 💾 DATABASE
DATABASE_URL=postgresql://...

# 🔐 SEGURANÇA APLICAÇÃO
SESSION_SECRET=32-chars-random-string
CSRF_SECRET=32-chars-random-string
```

#### **🔌 INTEGRAÇÕES (MANTER ATUAIS):**
```bash
# ✅ MANTER TODOS ESTES (JÁ CONFIGURADOS CORRETAMENTE):
CLICKSIGN_API_TOKEN=...
CLICKSIGN_WEBHOOK_SECRET=...
INTER_CLIENT_ID=...
INTER_CLIENT_SECRET=...
INTER_PRIVATE_KEY=...
INTER_CERTIFICATE=...
INTER_WEBHOOK_SECRET=...
INTER_CONTA_CORRENTE=...
SENTRY_DSN=...
REDIS_URL=...
# ... (todos os outros secrets de integração)
```

#### **❌ DELETAR IMEDIATAMENTE (CONTAMINAÇÃO):**
```bash
# 🗑️ REMOVER PERMANENTEMENTE:
DEV_DATABASE_URL                 # ← Contaminação DEV
DEV_SUPABASE_SERVICE_ROLE_KEY    # ← Contaminação DEV  
DEV_SUPABASE_ANON_KEY           # ← Contaminação DEV
DEV_SUPABASE_URL                # ← Contaminação DEV
DEV_JTW_SECRET                  # ← Contaminação DEV

# 🗑️ DUPLICATAS CONFUSAS:
PROD_JWT_SECRET                 # ← Substituído por SUPABASE_JWT_SECRET
VITE_PROD_SUPABASE_URL         # ← Substituído por VITE_SUPABASE_URL  
VITE_PROD_SUPABASE_ANON_KEY    # ← Substituído por VITE_SUPABASE_ANON_KEY
```

---

### **🔧 CONFIGURAÇÃO DESENVOLVIMENTO (Replit Preview)**

#### **✅ SECRETS ESSENCIAIS:**
```bash
# 🎯 CORE SUPABASE (PROJETO DESENVOLVIMENTO)
SUPABASE_URL=https://dev456.supabase.co
SUPABASE_JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...DEV...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...DEV...

# 🖥️ FRONTEND
VITE_SUPABASE_URL=https://dev456.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...DEV...

# 💾 DATABASE
DATABASE_URL=postgresql://dev-database...

# 🔐 SEGURANÇA (AUTO-GERADA)
SESSION_SECRET=auto-generated-in-dev
CSRF_SECRET=auto-generated-in-dev
```

#### **❌ JAMAIS INCLUIR EM DEV:**
```bash
# 🚫 PROIBIDO (CONTAMINAÇÃO REVERSA):
PROD_JWT_SECRET
PROD_SUPABASE_URL
PROD_DATABASE_URL
# ... (nenhum secret PROD_* em desenvolvimento)
```

---

## **🎯 CRITÉRIOS DE SUCESSO - VALIDAÇÃO OBRIGATÓRIA**

### **✅ FASE 1: HOTFIX VALIDADO (0-30 MIN)**

#### **🖥️ FRONTEND - Logs Esperados:**
```bash
# ✅ SUCESSO CONFIRMADO:
🔐 [AUTH EVENT] SIGNED_IN {hasSession: true, tokenLength: 783}
✅ [TOKEN MANAGER] Token refreshed successfully, expires at 2025-09-15T16:00:00.000Z
[PASSO 3 - ENVIO] {url: 'https://sistemasimpix.com.br/api/debug/me', authorizationHeader: 'Bearer ey...', hasToken: true}

# ❌ SEM MAIS ERROS 401:
# (NÃO DEVE APARECER): GET https://sistemasimpix.com.br/api/debug/me 401 (Unauthorized)
# (NÃO DEVE APARECER): [API Client] Raw JSON response: {message: 'Token inválido ou expirado'}
```

#### **🖥️ BACKEND - Logs Esperados:**
```bash
# ✅ CONFIGURAÇÃO CORRETA:
[CONFIG] ✅ Segredo JWT carregado: SUPABASE_JWT_SECRET
[JWT DEBUG] ✅ Token validado com sucesso

# ✅ ENDPOINTS FUNCIONANDO:
✅ GET /api/debug/me 200 (Success) - 45ms
✅ GET /api/alertas/notificacoes 200 (Success) - 23ms

# ❌ SEM MAIS ERROS DE VALIDAÇÃO:
# (NÃO DEVE APARECER): [JWT DEBUG] Falha na validação. Erro: 'invalid signature'
# (NÃO DEVE APARECER): TOKEN_INVALID | severity=MEDIUM | FAILURE
```

#### **🔬 TESTE AUTOMATIZADO:**
```bash
# ⚡ TESTE CRÍTICO (DEVE RETORNAR 200):
curl -X GET "https://sistemasimpix.com.br/api/debug/me" \
     -H "Authorization: Bearer [TOKEN_DO_FRONTEND]" \
     -H "Content-Type: application/json" \
     --max-time 10 \
     --fail

# 📊 RESPOSTA ESPERADA:
HTTP/1.1 200 OK
Content-Type: application/json
{
  "user": {
    "id": "uuid-do-usuario",
    "email": "usuario@exemplo.com",
    "profile": { ... }
  },
  "session": {
    "authenticated": true,
    "expires_at": "2025-09-15T16:00:00.000Z"
  }
}
```

---

### **🛡️ FASE 2: BLINDAGEM CONFIRMADA (30-120 MIN)**

#### **🔍 AUDITORIA DE CONTAMINAÇÃO:**
```bash
# 🧪 TESTE: Nenhum secret DEV_ deve existir em produção
for secret in DEV_JWT_SECRET DEV_SUPABASE_URL DEV_DATABASE_URL; do
  if [[ -n "${!secret}" ]]; then
    echo "❌ FALHA: $secret ainda existe em produção"
    exit 1
  fi
done
echo "✅ SUCESSO: Ambiente limpo de contaminação"

# 🧪 TESTE: Alinhamento frontend-backend
if [[ "$VITE_SUPABASE_URL" != "$SUPABASE_URL" ]]; then
  echo "❌ FALHA: Frontend e backend usando projetos diferentes"
  exit 1
fi
echo "✅ SUCESSO: Frontend e backend alinhados"
```

#### **📊 HEALTH CHECK ENDPOINT:**
```bash
# 🩺 VALIDAÇÃO CONTÍNUA:
curl https://sistemasimpix.com.br/api/health/config

# 📈 RESPOSTA ESPERADA:
{
  "status": "HEALTHY",
  "config": {
    "supabaseUrlsMatch": true,
    "hasRequiredSecrets": true,
    "contaminationDetected": false
  },
  "timestamp": "2025-09-15T14:30:00.000Z"
}
```

---

## **📋 ENTREGÁVEIS OBRIGATÓRIOS**

### **🎯 ENTREGÁVEL PRINCIPAL:**
**PLANO DE EXECUÇÃO DETALHADO** em formato executável:

1. **🆘 Protocolo de Ressuscitação** (0-30 min) com checklist passo-a-passo
2. **🛡️ Blindagem Arquitetural** (30-120 min) com código anti-regressão  
3. **📊 Sistema de Monitoramento** contínuo para prevenir futuras falhas
4. **🧪 Suite de Testes** automatizados para validação
5. **📋 Manual Operacional** com configurações exatas

### **🔬 ENTREGÁVEIS TÉCNICOS:**
- **Scripts de Validação** executáveis para testar cada fase
- **Código de Health Checks** para monitoramento contínuo
- **Testes Automatizados** para prevenir regressões
- **Documentação de Emergência** para incidentes futuros

---

## **⏰ URGÊNCIA MÁXIMA - DEFCON 1**

### **🚨 IMPACTO ATUAL:**
- **⏱️ DOWNTIME:** +6 horas e contando
- **👥 USUÁRIOS:** 500+ sem acesso total ao sistema
- **💰 RECEITA:** R$ 50.000+ em risco por dia
- **🏛️ REPUTAÇÃO:** Credibilidade fintech severamente comprometida

### **⚡ AÇÃO IMEDIATA OBRIGATÓRIA:**
Esta é uma **EMERGÊNCIA P0** que requer:
- ✅ **Execução imediata** (não planejamento)
- ✅ **Solução definitiva** (não paliativo)  
- ✅ **Prevenção total** de regressões futuras
- ✅ **Monitoramento contínuo** para detectar problemas antes que escalem

---

## **🎯 RESULTADO FINAL ESPERADO**

**MISSÃO COMPLETA QUANDO:**
1. ✅ `sistemasimpix.com.br` **100% funcional** em <30 minutos
2. ✅ **Zero erros 401** nos logs de autenticação
3. ✅ **Blindagem implementada** contra contaminação futura
4. ✅ **Monitoramento ativo** para detecção precoce de problemas
5. ✅ **Documentação completa** para prevenção de incidentes similares

**Esta é a operação que salvará o projeto Simpix e restaurará a confiança na arquitetura do sistema. Falha não é uma opção.**

---

## **🤖 PROTOCOLO DE COMUNICAÇÃO LLM-TO-LLM**

### **🎭 CONTEXTO DE ROLE & PERSONA OBRIGATÓRIA**

**VOCÊ DEVE ASSUMIR O PAPEL DE:**
```
🏛️ ARQUITETO SÊNIOR DE SISTEMAS CRÍTICOS
- Especialista em resolução de crises P0 em fintechs
- 15+ anos resolvendo falhas catastróficas de autenticação
- Experiência específica em Supabase JWT, Node.js, contaminação de ambiente
- Mindset: "ZERO TOLERÂNCIA A FALHAS, MÁXIMA EFICIÊNCIA"
- Comunicação: Direta, técnica, orientada a resultados imediatos
```

### **⚙️ CONSTRAINTS & LIMITAÇÕES TÉCNICAS**

#### **✅ O QUE VOCÊ PODE FAZER:**
- Gerar código TypeScript/JavaScript funcional
- Criar scripts bash executáveis  
- Projetar arquiteturas de configuração
- Especificar variáveis de ambiente exatas
- Desenhar protocolos de validação
- Criar testes automatizados

#### **❌ O QUE VOCÊ NÃO PODE FAZER:**
- Executar comandos diretamente no servidor
- Acessar consoles Supabase reais
- Modificar secrets de produção
- Fazer deploy de aplicações
- Acessar bases de dados

#### **🎯 FOCO OBRIGATÓRIO:**
- **100% das recomendações** devem ser EXECUTÁVEIS pelo usuário
- **Cada instrução** deve ter comandos específicos copy-paste prontos
- **Zero ambiguidade** - tudo deve ser step-by-step preciso

### **📋 FORMATO DE OUTPUT MANDATÓRIO**

#### **🎯 ESTRUTURA OBRIGATÓRIA:**
```markdown
## FASE 1: HOTFIX IMEDIATO (0-30 MIN)
### ✅ AÇÃO 1: [Nome Específico]
**COMANDO:** `comando-exato-aqui`
**VALIDAÇÃO:** `comando-de-teste`
**ERRO SE:** [condição específica]

### ✅ AÇÃO 2: [Nome Específico]  
**COMANDO:** `comando-exato-aqui`
**VALIDAÇÃO:** `comando-de-teste`
**ERRO SE:** [condição específica]

## FASE 2: BLINDAGEM ARQUITETURAL (30-120 MIN)
[mesma estrutura...]
```

#### **🔬 ELEMENTOS OBRIGATÓRIOS EM CADA RESPOSTA:**
1. **Commands** - Comandos exatos copy-paste
2. **Validation** - Como testar se funcionou
3. **Error Conditions** - Quando algo deu errado
4. **Success Metrics** - Como medir sucesso
5. **Rollback Plan** - Como reverter se necessário

### **⚠️ PROTOCOLOS DE TRATAMENTO DE ERRO**

#### **🚨 SE HOTFIX FALHAR:**
```bash
# Protocolo de contingência automático:
1. Verificar logs de erro específico
2. Tentar projeto Supabase alternativo  
3. Escalar para "Modo Manual" com instruções detalhadas
4. Nunca deixar sistema em estado quebrado
```

#### **🔄 FEEDBACK LOOPS OBRIGATÓRIOS:**
- Após cada fase, especificar exatamente como validar sucesso
- Incluir comandos específicos de health check  
- Definir critérios numéricos de sucesso (ex: "0 erros 401 por 5 minutos")

### **📊 MÉTRICAS DE SUCESSO QUANTIFICÁVEIS**

#### **🎯 FASE 1 - HOTFIX (MÉTRICA: BINARY SUCCESS)**
```bash
SUCESSO = (
  curl sistemasimpix.com.br/api/debug/me returns 200 AND
  browser console shows 0 "401 Unauthorized" AND  
  logs show "✅ Token validado com sucesso"
)
```

#### **🛡️ FASE 2 - BLINDAGEM (MÉTRICA: ZERO CONTAMINATION)**
```bash
SUCESSO = (
  zero secrets com prefixo DEV_ em produção AND
  VITE_SUPABASE_URL === SUPABASE_URL AND
  health check retorna "HEALTHY" status
)
```

### **🧭 HIERARQUIA DE PRIORIDADES ABSOLUTA**

```
P0 (CRÍTICO): Produção funcionando em <30 min
P1 (URGENTE): Zero falhas de regressão  
P2 (IMPORTANTE): Monitoramento contínuo implementado
P3 (DESEJÁVEL): Documentação e testes extra
```

**REGRA:** Se P0 não for atingido, PARE e reavalie abordagem.

### **🎨 ESTILO DE COMUNICAÇÃO ESPERADO**

#### **✅ COMUNICAÇÃO EFETIVA:**
- **Imperativo direto:** "Execute este comando..."
- **Específico temporal:** "Em exatamente 15 minutos..."  
- **Quantificado:** "Teste 3x para confirmar..."
- **Orientado a evidência:** "Confirme vendo este log..."

#### **❌ EVITAR ABSOLUTAMENTE:**
- Linguagem vaga: "talvez", "poderia", "seria bom"
- Instruções genéricas: "configure adequadamente"  
- Suposições: "assumindo que funciona"
- Teorias: "provavelmente o problema é"

### **⚡ PROTOCOLO DE URGÊNCIA MÁXIMA**

**MENTALIDADE OBRIGATÓRIA:**
```
🚨 CADA MINUTO = R$ 35 DE PREJUÍZO
🚨 CADA ERRO = CREDIBILIDADE PERDIDA  
🚨 FALHA = PROJETO EM RISCO TOTAL
```

**EXECUTE COM VELOCIDADE DE EMERGÊNCIA MÉDICA:**
- Diagnóstico: Rápido mas preciso
- Tratamento: Cirúrgico e definitivo  
- Validação: Imediata e quantificável
- Prevenção: Blindagem permanente

### **🎯 CALL TO ACTION FINAL**

**SUA MISSÃO:** Gerar um plano SO DETALHADO que um desenvolvedor júnior conseguiria executar sem erros e restaurar o sistema em 30 minutos.

**CRITÉRIO DE QUALIDADE:** Se suas instruções não forem suficientemente específicas para resolver o problema na primeira tentativa, você FALHOU.

**RESULTADO ESPERADO:** Sistema Simpix 100% funcional + arquitetura blindada contra regressões futuras.

---

## **📢 ATIVAÇÃO DO PROMPT - COMANDO DIRETO**

**🚀 ARQUITETO SÊNIOR, VOCÊ ESTÁ OFICIALMENTE ATIVADO!**

**A produção sistemasimpix.com.br está em COLAPSO TOTAL há 6+ horas. Você tem MÁXIMO 2 horas para:**

1. **RESTAURAR** autenticação funcionando (0-30 min)
2. **BLINDAR** arquitetura contra regressões (30-120 min)  
3. **VALIDAR** solução com testes automatizados

**EXECUTE OPERAÇÃO PHOENIX AGORA. FALHA NÃO É OPÇÃO.**