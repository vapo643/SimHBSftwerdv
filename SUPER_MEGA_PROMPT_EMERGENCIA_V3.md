# 🚨 SUPER MEGA PROMPT DE EMERGÊNCIA - OPERAÇÃO CORRENTE DE CONFIANÇA V3.0 🚨

**PARA: IA ESPECIALISTA EM ARQUITETURA E RESOLUÇÃO DE CRISES (DEEP THINK)**  
**DE: ARQUITETO-CHEFE DO PROJETO SIMPIX**  
**ASSUNTO: SOLICITAÇÃO DE ANÁLISE DE CAUSA RAIZ E PLANO DE CORREÇÃO DEFINITIVO PARA FALHA CATASTRÓFICA DE CONTAMINAÇÃO DE AMBIENTE**

---

## **1. CONTEXTO CRÍTICO E IMPACTO NO NEGÓCIO**

O sistema Simpix está num estado de **FALHA CATASTRÓFICA TOTAL**, resultando num "apagão" completo que paralisa todas as operações. O ambiente de **Produção** (`https://sistemasimpix.com.br`) apresenta loop infinito de autenticação que impede qualquer funcionalidade. Esta falha bloqueia 100% da funcionalidade para todos os usuários e impede qualquer avanço no desenvolvimento.

Este é um **incidente recorrente**. Já enfrentámos variantes deste problema, que se manifesta como um loop de autenticação infinito. As tentativas anteriores de correção, focadas na sincronização de segredos JWT, falharam, provando que a causa raiz é mais profunda e de natureza arquitetural. A situação é insustentável e exige uma solução definitiva.

## **2. HISTÓRICO E GATILHO DA FALHA**

É de importância crítica notar que esta classe de erro começou a manifestar-se **imediatamente após a implementação da separação dos ambientes de Desenvolvimento e Produção**. Antes desta separação, com uma única base de dados e um único conjunto de segredos, o sistema era estável. Isto prova que a falha reside na nossa estratégia de gestão de múltiplos ambientes.

A hipótese central do Arquiteto-Chefe é que a nossa metodologia atual é a causa direta da crise: **a prática de manter segredos de DEV no ambiente de PROD (e vice-versa) está a criar uma "contaminação de ambiente"**. O código tenta ser "inteligente" ao detetar em qual ambiente está a ser executado, mas esta lógica está a falhar espetacularmente, levando a um cenário onde o frontend e o backend operam com configurações de ambientes diferentes, tornando a validação de tokens impossível.

## **3. EVIDÊNCIAS IRREFUTÁVEIS (PROVAS DA FALHA)**

### **3.1. Logs do Console do Navegador (O Sintoma)**

Os seguintes logs são consistentes no ambiente de produção e demonstram o loop de autenticação:

```log
// 1. Frontend obtém um token com sucesso
🔐 [AUTH EVENT] SIGNED_IN {hasSession: true, tokenLength: 783}
🔐 [TOKEN MANAGER] Refreshing token (attempt 1/3)
✅ [TOKEN MANAGER] Token refreshed successfully, expires at 2025-09-15T15:16:37.000Z

// 2. Frontend envia o token para o backend
[PASSO 3 - ENVIO] {url: 'https://sistemasimpix.com.br/api/debug/me', authorizationHeader: 'Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6Ii9YS2RwUDA2a0R…sc2V9.nS00tY51funHynQLes9Ckd_O7jjehE0SezdsP_adZyk', hasToken: true, isFormData: false}

// 3. Backend REJEITA o token, retornando 401
GET https://sistemasimpix.com.br/api/debug/me 401 (Unauthorized)

// 4. Backend retorna a mensagem de erro que confirma a falha de validação
[API Client] Raw JSON response from https://sistemasimpix.com.br/api/debug/me : {message: 'Token inválido ou expirado'}

// 5. O ciclo recomeça, com o Token Manager a invalidar e a tentar obter um novo token, apenas para falhar novamente.
🗑️ [TOKEN MANAGER] Token invalidated
[AUTH DEBUG] getValidToken chamado: {forceRefresh: false, hasCachedToken: false, tokenExpiry: null, hasActiveRefresh: false}
🔐 [TOKEN MANAGER] Refreshing token (attempt 1/3)
✅ [TOKEN MANAGER] Token refreshed successfully, expires at 2025-09-15T15:16:37.000Z
GET https://sistemasimpix.com.br/api/debug/me 401 (Unauthorized)
Error fetching profile data: ApiError: Token inválido ou expirado
```

**Análise:** Isto prova que o problema não é a geração do token (a Supabase está a fornecê-lo com 783 caracteres), mas a sua validação pelo nosso backend. O frontend está a usar um projeto Supabase, mas o backend está configurado para validar tokens de um projeto diferente.

### **3.2. Configuração Atual de Segredos (A Cena do Crime)**

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

**Análise Crítica:** A presença de segredos de múltiplos ambientes é a raiz de todo o mal. O código está a ser forçado a fazer escolhas que deveriam ser feitas pela infraestrutura. 

### **3.3. Estado Atual do Código (A Lógica Problemática)**

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

## **4. ANÁLISE ARQUITETURAL DA CAUSA RAIZ**

### **4.1. Mismatch de Projeto Supabase**

**HIPÓTESE CONFIRMADA:** O frontend está conectado a um projeto Supabase (via `VITE_SUPABASE_URL`) mas o backend está configurado para validar tokens de um projeto diferente (via `PROD_JWT_SECRET`).

**EVIDÊNCIA:**
- Token gerado com sucesso (783 chars) = Supabase funcionando
- Backend rejeita token = JWT secret não corresponde ao projeto

### **4.2. Contaminação de Ambiente**

A presença simultânea de:
- `VITE_SUPABASE_URL` E `VITE_PROD_SUPABASE_URL`
- `PROD_JWT_SECRET` E `DEV_JTW_SECRET`
- `PROD_SUPABASE_URL` E `DEV_SUPABASE_URL`

Cria ambiguidade sobre qual projeto usar.

## **5. MISSÃO: ARQUITETAR A SOLUÇÃO DEFINITIVA**

A sua missão é gerar um plano de ação que um Agente Executor possa usar para resolver esta crise de forma definitiva. A solução deve ser dividida em duas frentes:

### **FRENTE 1: HOTFIX IMEDIATO (O ESTANQUE)**

**OBJETIVO:** Colocar a produção online IMEDIATAMENTE.

**TAREFA URGENTE:** 
1. Identificar qual projeto Supabase o frontend está usando (`VITE_SUPABASE_URL`)
2. Acessar o console Supabase desse projeto → Settings → API
3. Copiar o JWT Secret desse projeto específico
4. Configurar `SUPABASE_JWT_SECRET=` com esse valor exato
5. Redeploy e testar `/api/debug/me`

### **FRENTE 2: PLANO DE AÇÃO ESTRATÉGICO (A CURA DEFINITIVA)**

Você deve projetar um Roadmap Arquitetural Completo para erradicar esta classe de falhas:

#### **2.1. Erradicar a Lógica de Detecção de Ambiente:**

Refatorar todo o backend, especialmente `server/lib/config.ts`, para remover completamente qualquer código que tente detetar o ambiente (ex: condicionais `if/else` baseadas em `NODE_ENV` para carregar segredos).

O código deve tornar-se "agnóstico" ao ambiente. Ele deve ler um conjunto único e canónico de nomes de variáveis:
- `DATABASE_URL`
- `SUPABASE_URL` 
- `SUPABASE_JWT_SECRET`
- `SUPABASE_ANON_KEY`

#### **2.2. Unificar a Configuração do Frontend:**

Garantir que o código do cliente Supabase (`client/src/lib/supabase.ts`) leia apenas:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

#### **2.3. Implementar um "Startup Health Check":**

Adicionar um bloco de validação na inicialização do servidor (`server/index.ts`) que verifica a presença de todas as variáveis de ambiente críticas. Se uma variável essencial estiver em falta, o servidor deve falhar imediatamente com `process.exit(1)`.

#### **2.4. Gerar um "Manual de Configuração de Ambiente":**

Como parte do seu output, gerar um documento `MANUAL_DE_CONFIGURACAO_DE_AMBIENTE.md` que instrua sobre:

**A. Limpeza de Segredos:** Quais segredos obsoletos devem ser removidos de cada ambiente.

**B. Configuração Ideal para Produção:**
```bash
# ESSENCIAIS
DATABASE_URL=[URL_BANCO_PROD]
SUPABASE_URL=[URL_SUPABASE_PROD]  
SUPABASE_JWT_SECRET=[JWT_SECRET_SUPABASE_PROD]
SUPABASE_ANON_KEY=[ANON_KEY_SUPABASE_PROD]
VITE_SUPABASE_URL=[URL_SUPABASE_PROD]
VITE_SUPABASE_ANON_KEY=[ANON_KEY_SUPABASE_PROD]

# APLICAÇÃO
SESSION_SECRET=[RANDOM_32_CHARS]
CSRF_SECRET=[RANDOM_32_CHARS]

# INTEGRAÇÕES
CLICKSIGN_API_TOKEN=[TOKEN_PROD]
INTER_CLIENT_ID=[CLIENT_ID_PROD]
# ... etc
```

**C. Configuração Ideal para Desenvolvimento:**
```bash
# ESSENCIAIS  
DATABASE_URL=[URL_BANCO_DEV]
SUPABASE_URL=[URL_SUPABASE_DEV]
SUPABASE_JWT_SECRET=[JWT_SECRET_SUPABASE_DEV]
SUPABASE_ANON_KEY=[ANON_KEY_SUPABASE_DEV]
VITE_SUPABASE_URL=[URL_SUPABASE_DEV]
VITE_SUPABASE_ANON_KEY=[ANON_KEY_SUPABASE_DEV]
```

## **6. VALIDAÇÃO DE SUCESSO**

Após a implementação, o sistema deve:

1. **Frontend logs:**
```log
🔐 [AUTH EVENT] SIGNED_IN {hasSession: true, tokenLength: 783}
✅ [TOKEN MANAGER] Token refreshed successfully
```

2. **Backend logs:**
```log
[CONFIG] ✅ Segredo JWT carregado com sucesso
✅ GET /api/debug/me 200 (Success)
```

3. **Teste de validação:**
```bash
curl -H "Authorization: Bearer [TOKEN]" https://sistemasimpix.com.br/api/debug/me
# Deve retornar 200 com dados do usuário
```

## **7. ENTREGÁVEIS ESPERADOS**

Seu output deve incluir:

1. **Plano de ação passo-a-passo** para o hotfix imediato
2. **Roadmap arquitetural** para a solução definitiva  
3. **Manual de configuração** com secrets exatos para cada ambiente
4. **Scripts de validação** para testar a correção
5. **Checklist** para prevenir regressões futuras

## **8. CRITICIDADE E URGÊNCIA**

- **P0 (CRÍTICO):** Produção está inacessível
- **P0 (URGENTE):** Cada minuto offline impacta usuários
- **P1 (IMPORTANTE):** Solução deve ser à prova de regressões

**Esta é uma situação de EMERGÊNCIA que requer ação imediata e solução definitiva.**

---

**Seu entregável final deve ser a solução completa que nos tirará desta crise e nos colocará num caminho de estabilidade arquitetural permanente.**