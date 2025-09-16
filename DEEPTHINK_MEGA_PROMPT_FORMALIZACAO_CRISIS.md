# 🚨 DEEPTHINK MEGA PROMPT - RESOLUÇÃO CRÍTICA DE PROBLEMA PERSISTENTE
# Aplicação: Simpix - Sistema de Crédito Bancário
# Problema: Rota /api/propostas/formalizacao retorna erro 500 com "Invalid API key" em produção

---

## 📋 CONTEXTO GERAL DA APLICAÇÃO

### **Sistema: Simpix**
- **Tipo**: Full-stack TypeScript application for financial credit proposal automation
- **Arquitetura**: Modular monolith com Domain-Driven Design (DDD)
- **Propósito**: Automatização de workflows de propostas de crédito para instituições financeiras
- **Segurança**: Banking-grade com autenticação JWT, RBAC, rate limiting, sanitização de input
- **Ambiente Prod**: https://sistemasimpix.com.br/
- **Ambiente Dev**: localhost:5000

### **Stack Tecnológico**
**Frontend:**
- React 18 + TypeScript
- Wouter (routing)
- TanStack Query (server state)
- Tailwind CSS + shadcn/ui
- React Hook Form + Zod validation

**Backend:**
- Express.js + TypeScript
- PostgreSQL + Drizzle ORM
- Supabase (auth, database, storage)
- BullMQ (job queues)
- Redis (caching)
- Winston (logging)
- Sentry (error tracking)

### **Deployment**
- **Produção**: Replit deployment (sistemasimpix.com.br)
- **Secrets**: 30+ environment variables configuradas
- **Database**: External Supabase PostgreSQL (NÃO Replit Neon)
- **Observability**: Structured logging, error tracking, health checks

---

## 🔥 DESCRIÇÃO DETALHADA DO PROBLEMA

### **Sintomas Principais**
1. **Rota afetada**: `GET /api/propostas/formalizacao`
2. **Erro consistente**: HTTP 500 Internal Server Error
3. **Mensagem de erro**: `"Invalid API key"` vindo do Supabase
4. **Ambiente**: Afeta APENAS produção (desenvolvimento funciona perfeitamente)
5. **Frequência**: 100% das requisições falham
6. **Usuário afetado**: Todos os usuários autenticados
7. **Dados de resposta**:
   ```json
   {
     "message": "Erro na consulta de propostas de formalização",
     "error": "SUPABASE_QUERY_ERROR", 
     "details": "Invalid API key",
     "correlationId": "oxblpm3gt"
   }
   ```

### **Impacto no Negócio**
- **Tela de formalização**: Completamente inacessível
- **Fluxo de crédito**: Interrompido na etapa crítica de formalização
- **Usuários afetados**: Equipe de atendimento, gerentes, analistas
- **Duração**: Problema persiste há 4+ horas com múltiplas tentativas de correção
- **Prioridade**: CRÍTICA - Sistema de produção quebrado

---

## 🕵️ EVIDÊNCIAS COLETADAS

### **Logs de Console do Frontend (Produção)**
```javascript
// Requisições repetidas falhando
api/propostas/formalizacao:1  Failed to load resource: the server responded with a status of 500 ()

// Resposta JSON sempre com mesmo padrão de erro
[API Client] Raw JSON response from https://sistemasimpix.com.br/api/propostas/formalizacao : {
  message: 'Erro na consulta de propostas de formalização', 
  error: 'SUPABASE_QUERY_ERROR', 
  details: 'Invalid API key', 
  correlationId: 'oxblpm3gt'
}

// Token JWT funcional (outras rotas OK)
✅ [TOKEN MANAGER] Using cached token
[PASSO 3 - ENVIO] {
  url: 'https://sistemasimpix.com.br/api/propostas/formalizacao',
  authorizationHeader: 'Bearer eyJhbGciOiJIUzI1NiIs...',
  hasToken: true,
  isFormData: false
}

// Outras rotas funcionam normalmente
[API Client] Raw JSON response from https://sistemasimpix.com.br/api/debug/me : Object
[API Client] Raw JSON response from https://sistemasimpix.com.br/api/features : Object
```

### **Logs do Servidor (Produção)**
```
// Evidência CRÍTICA: NENHUM log de debug da rota aparece!
// Os seguintes logs DEVERIAM aparecer se a rota estivesse sendo executada:
// 🚀 [FORMALIZATION] Route accessed
// ✅ [FORMALIZATION] Authentication validated  
// ✅ [FORMALIZATION] Supabase client initialized
// ❌ ESTES LOGS NÃO APARECEM = ROTA NÃO ESTÁ SENDO EXECUTADA

// Logs que aparecem (outras funcionalidades):
[JWT DEBUG] FORCE LOCAL JWT - Supabase DISABLED for this environment
[JWT DEBUG] Using local JWT validation  
[CONFIG] ✅ Segredo JWT carregado com sucesso (Length: 88)
[PHOENIX DEBUG] JWT_SECRET length: 88
[PHOENIX DEBUG] ✅ JWT verification SUCCESS: {
  userId: '2c3feed3-6b45-4a47-8031-96cdab09fbe9',
  email: 'ramon.barbosa@eellevepromotora.com.br',
  role: 'authenticated'
}
[PHOENIX DEBUG] 🚨 FRONTEND PROJECT ID: dvglgxrvhmtsixaabxha
[PHOENIX DEBUG] 🚨 VERIFIQUE SE O SUPABASE_JWT_SECRET É DESTE PROJETO!

// Redis funcionando
[REDIS MANAGER] 💡 Redis desabilitado - Volume baixo: {
  slowRequests: 4,
  proposalRequests: 10, 
  threshold: '50 proposals/day'
}
```

### **Logs de Desenvolvimento (Funcionando)**
```
✅ Database: Configuring Supabase connection...
✅ Database: Connection pool configured with 20 max connections
🔍 SUPABASE_ADMIN_CLIENT_DEBUG - Environment: development
🔍 SUPABASE_URL: [FOUND]
🔍 SERVICE_KEY: [FOUND]
🔍 URL source: valid-supabase-domain
🔍 Project ID: fkfmirnnredvhocnhost
🔍 SERVICE_KEY length: 219 chars
🔍 SERVICE_KEY prefix: eyJhbGciOiJIUzI1NiIs...
🔍 SERVICE_KEY format valid: YES
✅ Supabase Admin Client configurado com sucesso
🚀 Server running on port 5000
✅ Database: ✅ Connected
✅ Storage bucket "documents" already exists as PRIVATE
```

---

## 🔧 ANÁLISE TÉCNICA DETALHADA

### **Configuração de Secrets (Produção)**
```
SUPABASE_SERVICE_ROLE_KEY: ••••••••  ✅ CONFIGURADO
SUPABASE_SERVICE_KEY: ••••••••       ✅ CONFIGURADO (duplicado)
SUPABASE_ANON_KEY: ••••••••           ✅ CONFIGURADO  
SUPABASE_URL: ••••••••                ✅ CONFIGURADO
VITE_SUPABASE_URL: ••••••••           ✅ CONFIGURADO
VITE_SUPABASE_ANON_KEY: ••••••••      ✅ CONFIGURADO
SUPABASE_JWT_SECRET: ••••••••         ✅ CONFIGURADO
DATABASE_URL: ••••••••                ✅ CONFIGURADO
```

### **Implementação da Rota (server/routes.ts - linha ~670)**
```typescript
// 🔧 CORREÇÃO CRÍTICA: Mover endpoint específico ANTES da rota genérica /:id
// New endpoint for formalization proposals (filtered by status) - VERSÃO ROBUSTA
app.get(
  '/api/propostas/formalizacao',
  jwtAuthMiddleware as any,
  async (req: AuthenticatedRequest, res) => {
    const startTime = Date.now();
    const correlationId = Math.random().toString(36).substr(2, 9);
    
    logInfo('🚀 [FORMALIZATION] Route accessed', {
      correlationId,
      url: req.url,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    try {
      // 🔍 ETAPA 1: Validação de Autenticação
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const userLojaId = req.user?.loja_id;

      if (!userId || !userRole) {
        logError('❌ [FORMALIZATION] Authentication validation failed', {
          correlationId,
          userId,
          userRole,
          userLojaId,
          step: 'AUTH_VALIDATION'
        });
        return res.status(401).json({ 
          message: 'Usuário não autenticado corretamente',
          error: 'AUTHENTICATION_FAILED',
          correlationId 
        });
      }

      logInfo('✅ [FORMALIZATION] Authentication validated', {
        correlationId,
        userId,
        userRole,
        userLojaId,
        step: 'AUTH_VALIDATED'
      });

      // 🔍 ETAPA 2: Inicialização do Supabase Client
      let supabase;
      try {
        const { createServerSupabaseAdminClient } = await import('./lib/supabase');
        supabase = createServerSupabaseAdminClient();
        
        logInfo('✅ [FORMALIZATION] Supabase client initialized', {
          correlationId,
          step: 'SUPABASE_INIT'
        });
      } catch (supabaseError) {
        logError('❌ [FORMALIZATION] Supabase client initialization failed', {
          correlationId,
          error: supabaseError instanceof Error ? supabaseError.message : String(supabaseError),
          step: 'SUPABASE_INIT_FAILED'
        });
        return res.status(500).json({
          message: 'Erro na inicialização da conexão com banco de dados',
          error: 'DATABASE_CONNECTION_FAILED',
          correlationId
        });
      }

      // Resto da implementação com logging extensivo...
```

### **Configuração do Supabase Admin Client (server/lib/supabase.ts)**
```typescript
export const createServerSupabaseAdminClient = () => {
  const timestamp = new Date().toISOString();
  const nodeEnv = process.env.NODE_ENV || 'unknown';
  
  console.log(`🔍 [${timestamp}] SUPABASE_ADMIN_CLIENT_DEBUG - Environment: ${nodeEnv}`);
  
  // Multi-tier environment variable detection with fallbacks
  const url = process.env.SUPABASE_URL || 
              process.env.VITE_SUPABASE_URL || 
              process.env.PROD_SUPABASE_URL ||
              process.env.STAGING_SUPABASE_URL ||
              process.env.DEV_SUPABASE_URL;
              
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
                     process.env.SUPABASE_SERVICE_KEY || // Alternative naming
                     process.env.PROD_SUPABASE_SERVICE_ROLE_KEY ||
                     process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ||
                     process.env.DEV_SUPABASE_SERVICE_ROLE_KEY;

  // Enhanced diagnostic logging with specific production debug info
  console.log(`🔍 [${timestamp}] SUPABASE_URL: ${url ? '[FOUND]' : '[MISSING]'}`);
  console.log(`🔍 [${timestamp}] SERVICE_KEY: ${serviceKey ? '[FOUND]' : '[MISSING]'}`);
  
  if (url) {
    console.log(`🔍 [${timestamp}] URL source: ${url.includes('supabase.co') ? 'valid-supabase-domain' : 'custom-domain'}`);
    const projectMatch = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    const projectId = projectMatch ? projectMatch[1] : 'unknown';
    console.log(`🔍 [${timestamp}] Project ID: ${projectId}`);
  }
  
  if (serviceKey) {
    console.log(`🔍 [${timestamp}] SERVICE_KEY length: ${serviceKey.length} chars`);
    const keyPrefix = serviceKey.substring(0, 20) + '...';
    console.log(`🔍 [${timestamp}] SERVICE_KEY prefix: ${keyPrefix}`);
    
    const isValidFormat = serviceKey.startsWith('eyJ');
    console.log(`🔍 [${timestamp}] SERVICE_KEY format valid: ${isValidFormat ? 'YES' : 'NO - POTENTIAL ISSUE'}`);
  }

  // Retorna cliente Supabase com service key para operações admin
  return createClient(url, serviceKey, {
    auth: { persistSession: false }
  });
};
```

---

## 🛠️ CORREÇÕES TENTADAS (SEM SUCESSO)

### **Tentativa 1: Correção de Importações Supabase**
- **Problema identificado**: Servidor importando client do frontend
- **Ação**: Substituição em múltiplos arquivos:
  ```typescript
  // ANTES (ERRADO)
  import { createServerSupabaseClient } from '../client/src/lib/supabase';
  
  // DEPOIS (CORRETO) 
  import { createServerSupabaseAdminClient } from './lib/supabase';
  ```
- **Arquivos corrigidos**: `server/routes.ts`, `server/routes/email-change-original.ts`, `server/lib/providers/supabase-server-auth-provider.ts`
- **Resultado**: ❌ Problema persistiu

### **Tentativa 2: Route Shadowing Fix**
- **Problema identificado**: Rotas genéricas `/api/propostas/:id` capturando "formalizacao"
- **Ação**: 
  - Reordenação: `/api/propostas/formalizacao` movida para o topo
  - Regex restritivo: `/api/propostas/:id([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})`
  - Limpeza de rotas duplicadas
- **Resultado**: ❌ Problema persistiu

### **Tentativa 3: Nomenclatura de Secrets**
- **Problema identificado**: Conflito entre `SUPABASE_SERVICE_KEY` e `SUPABASE_SERVICE_ROLE_KEY`
- **Ação**: Verificação de que ambos existem com mesma credencial
- **Resultado**: ✅ Ambos configurados corretamente

### **Tentativa 4: Análise de Logs Profunda**
- **Descoberta crítica**: Logs de debug da rota `[FORMALIZATION]` NÃO aparecem em produção
- **Implicação**: Requisições não chegam à rota implementada
- **Status**: 🚨 EVIDÊNCIA DE QUE A ROTA NÃO ESTÁ SENDO EXECUTADA

---

## 🔍 EVIDÊNCIAS CRÍTICAS PARA ANÁLISE

### **Evidência 1: Ausência de Logs de Debug**
```
❌ ESPERADO EM PRODUÇÃO (mas não aparece):
🚀 [FORMALIZATION] Route accessed
✅ [FORMALIZATION] Authentication validated
✅ [FORMALIZATION] Supabase client initialized

✅ APARECE EM DESENVOLVIMENTO:
🔍 [2025-09-16T01:33:53.788Z] SUPABASE_ADMIN_CLIENT_DEBUG
✅ [2025-09-16T01:33:53.788Z] Supabase Admin Client configurado com sucesso
```

### **Evidência 2: Diferentes Projetos Supabase**
```
DESENVOLVIMENTO: Project ID: fkfmirnnredvhocnhost
PRODUÇÃO: Project ID: dvglgxrvhmtsixaabxha  ⚠️ DIFERENTE!
```

### **Evidência 3: Padrão de Erro Consistente**
- **Sempre mesmo JSON**: `{"error": "SUPABASE_QUERY_ERROR", "details": "Invalid API key"}`
- **Sempre mesmo HTTP status**: 500
- **Correlation ID diferente**: Indica que alguma rota está sendo executada

### **Evidência 4: Outras Rotas Funcionando**
- `/api/debug/me`: ✅ Funciona
- `/api/features`: ✅ Funciona
- `/api/propostas/formalizacao`: ❌ Falha

---

## 🎯 ANÁLISES ESPECÍFICAS NECESSÁRIAS

### **Hipótese 1: Deployment/Build Issues**
- **Teoria**: Código atualizado não foi deployado corretamente
- **Validação necessária**: 
  - Verificar se build de produção contém alterações
  - Confirmar ordem das rotas no bundle final
  - Verificar se há cache/CDN servindo versão antiga

### **Hipótese 2: Environment Variable Mismatch**
- **Teoria**: Produção usa projeto Supabase diferente
- **Evidência**: Project IDs diferentes (fkfmirnnredvhocnhost vs dvglgxrvhmtsixaabxha)
- **Validação necessária**: 
  - Confirmar se SUPABASE_URL/SERVICE_KEY são do mesmo projeto
  - Verificar se há inconsistência entre VITE_* e SUPABASE_* vars

### **Hipótese 3: Route Handler Precedence**
- **Teoria**: Handler antigo ainda interceptando requisições
- **Evidência**: Erro tem formato específico de handler legado
- **Validação necessária**: 
  - Mapear todas as rotas `/api/propostas*` 
  - Identificar qual handler está realmente executando

### **Hipótese 4: Express Middleware Chain Issues**
- **Teoria**: Problema na cadeia de middlewares
- **Validação necessária**:
  - Verificar ordem de registro de rotas
  - Confirmar se middleware de auth está correto
  - Analisar se há middleware que corrompe a requisição

---

## 📐 ARQUITETURA DE ROTAS ESPERADA

### **Estrutura Atual (server/routes.ts)**
```typescript
export async function registerRoutes(app: Express): Promise<Server> {
  // === SECURITY & MIDDLEWARES ===
  
  // === DEBUG ENDPOINTS ===
  app.get('/api/debug/me', jwtAuthMiddleware, ...)
  
  // === SPECIFIC ROUTES (SHOULD BE FIRST) ===  
  app.get('/api/propostas/formalizacao', jwtAuthMiddleware, ...) // LINHA ~670
  app.get('/api/propostas/analise', jwtAuthMiddleware, ...)
  
  // === GENERIC ROUTES (SHOULD BE LAST) ===
  app.get('/api/propostas/:id([UUID-REGEX])', jwtAuthMiddleware, ...)
  app.put('/api/propostas/:id([UUID-REGEX])', jwtAuthMiddleware, ...)
  
  // === EXTERNAL ROUTERS ===
  app.use('/api/origination', originationRoutes);
  app.use('/api/clicksign', clickSignRouter);
  // ... outros routers
}
```

### **Possível Conflito**
```typescript
// Se houver esta rota SEM regex, ela captura "formalizacao":
app.get('/api/propostas/:id', ...) // ❌ CAPTURA /formalizacao como :id

// Ou routers externos:
app.use('/api/propostas', someOtherRouter); // ❌ PODE INTERCEPTAR
```

---

## 🚨 REQUISITOS PARA SOLUÇÃO

### **Requisito 1: Diagnóstico Definitivo**
- **Identificar EXATAMENTE** qual handler está processando `/api/propostas/formalizacao`
- **Confirmar** se a rota implementada está sendo registrada corretamente  
- **Mapear** toda a cadeia de middlewares e rotas envolvidas

### **Requisito 2: Consistência de Environment**
- **Validar** que todas as variáveis Supabase apontam para mesmo projeto
- **Confirmar** que service keys têm permissões adequadas
- **Verificar** se não há conflitos entre VITE_* e SUPABASE_* vars

### **Requisito 3: Logging Definitivo**
- **Implementar** logs que apareçam SEMPRE na entrada da requisição
- **Capturar** informações sobre qual handler está executando
- **Registrar** detalhes do projeto Supabase sendo usado

### **Requisito 4: Rollback Strategy**
- **Identificar** última versão funcional conhecida
- **Preparar** estratégia de rollback se correção complexa for necessária
- **Documentar** todos os componentes afetados

---

## 📊 DADOS TÉCNICOS ADICIONAIS

### **JWT Token Analysis**
```json
{
  "iss": "https://dvglgxrvhmtsixaabxha.supabase.co/auth/v1",
  "aud": "authenticated",
  "exp": 1757988018,
  "sub": "2c3feed3-6b45-4a47-8031-96cdab09fbe9",
  "algorithm": "not specified"
}
```

### **User Context**
```json
{
  "userId": "2c3feed3-6b45-4a47-8031-96cdab09fbe9",
  "email": "ramon.barbosa@eellevepromotora.com.br", 
  "role": "authenticated"
}
```

### **Request Flow**
```
1. Frontend → GET https://sistemasimpix.com.br/api/propostas/formalizacao
2. Auth Header → Bearer eyJhbGciOiJIUzI1NiIs...
3. Server → ??? (Unknown handler executes)
4. Response → 500 {"error": "SUPABASE_QUERY_ERROR", "details": "Invalid API key"}
```

---

## 🎯 DEEPTHINK REQUEST

**Sua tarefa é ser um detective técnico de elite e resolver este mistério de uma vez por todas.**

**Analise TUDO:**
- Os logs ausentes indicam que nossa rota não está sendo executada
- Project IDs diferentes entre dev/prod sugerem ambiente inconsistente  
- Erro "Invalid API key" vem de handler desconhecido
- Outras rotas funcionam, só formalização falha

**Investigue PROFUNDAMENTE:**
- Como pode uma rota estar "registrada" mas não executar?
- Por que development funciona mas production não?
- Qual handler está realmente processando esta requisição?
- Como resolver a inconsistência de project IDs?

**Forneça SOLUÇÃO DEFINITIVA:**
- Diagnóstico preciso do problema raiz
- Passos exatos para correção
- Validação que a solução não quebra outras funcionalidades
- Prevenção de regressão futura

**ESTE PROBLEMA ESTÁ AFETANDO SISTEMA DE PRODUÇÃO HÁ HORAS.**
**PRECISO DE SUA EXPERTISE MÁXIMA PARA RESOLVER DEFINITIVAMENTE.**

**Por favor, seja o sherlock holmes da engenharia de software e resolva este caso!** 🕵️‍♂️