# ADR-007: Guia de Estilo de APIs RESTful

## Status
**Status:** Proposto  
**Data:** 22 de Agosto de 2025  
**Autor:** GEM-07 AI Specialist System  
**Decisor:** Arquiteto Chefe  

## Contexto

O sistema Simpix cresceu organicamente para incluir mais de 30 endpoints RESTful, mas sem um guia de estilo consistente. As auditorias recentes identificaram **inconsistências significativas** em nomenclatura, versionamento, gestão de idempotência e estratégias de caching. Com a meta de 100.000 propostas/mês até 2026 e a exposição planejada das APIs para parceiros externos, precisamos de padrões rigorosos e aplicáveis.

### Drivers Estratégicos
- **Developer Experience:** APIs previsíveis e intuitivas reduzem erros de integração
- **Partner Integration:** Parceiros externos precisam de documentação clara e consistente
- **Performance at Scale:** Caching eficiente é crítico para latência < 500ms p99
- **Financial Compliance:** Idempotência é mandatória para operações financeiras

### Estado Atual (Problemas Identificados)
- **Versionamento Ad-hoc:** Alguns endpoints usam `/v1/`, outros não têm versão
- **Idempotência Inconsistente:** POST/PATCH críticos sem proteção contra duplicação
- **Caching Inexistente:** Endpoints GET sem `ETag` causando tráfego desnecessário
- **Correlação Perdida:** Logs distribuídos sem rastreabilidade entre serviços

---

## 1. Decisão Principal

**Adotaremos um Guia de Estilo de API rigoroso e mandatório, cobrindo Versionamento via URL (`/api/v1/`), Idempotência via `Idempotency-Key` header, e Cacheabilidade via `ETag` e `Cache-Control` headers. Este guia será enforced através de linting automatizado e validação em CI/CD.**

### Declaração Formal
```
PADRÃO OBRIGATÓRIO: API Style Guide v1.0
ENFORCEMENT: ESLint rules + OpenAPI validation + CI/CD gates
APLICAÇÃO: Progressiva (novos endpoints primeiro, migração gradual dos existentes)
REVISÃO: Trimestral com métricas de aderência
```

---

## 2. Estratégia de Versionamento Mandatória

### 2.1 Padrão de Versionamento

**Decisão:** Versionamento via URL com prefixo `/api/v{major}/`

```
CORRETO:   /api/v1/proposals
           /api/v1/payments/boletos
           /api/v2/proposals (futura breaking change)

INCORRETO: /proposals
           /api/proposals/v1
           /proposals?version=1
```

### 2.2 Regras de Versionamento

| **Tipo de Mudança** | **Ação Requerida** | **Exemplo** |
|---------------------|-------------------|-------------|
| **Adição de campo opcional** | Mesma versão | `v1` → `v1` (retrocompatível) |
| **Mudança de tipo de dado** | Nova versão major | `v1` → `v2` |
| **Remoção de campo** | Nova versão major | `v1` → `v2` |
| **Mudança de comportamento** | Nova versão major | `v1` → `v2` |
| **Correção de bug** | Mesma versão | `v1` → `v1` (patch) |

### 2.3 Política de Sunset

```typescript
// Headers mandatórios para deprecação
{
  "Sunset": "2026-12-31",                    // RFC 8594
  "Deprecation": "2026-06-30",               // Data de deprecação
  "Link": "</api/v2/resource>; rel=\"successor-version\""
}
```

**Período mínimo de deprecação:** 6 meses para breaking changes

---

## 3. Garantias de Idempotência

### 3.1 Princípio Fundamental

**Todas as requisições POST e PATCH que não sejam naturalmente idempotentes DEVEM suportar o header `Idempotency-Key`.**

### 3.2 Implementação Técnica

```typescript
// Cliente envia
POST /api/v1/payments
Headers:
  Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
  Content-Type: application/json

Body: {
  "proposalId": "abc123",
  "amount": 10000.00,
  "method": "PIX"
}

// Servidor responde (primeira chamada)
201 Created
{
  "id": "payment_xyz789",
  "status": "processing",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}

// Servidor responde (chamadas subsequentes com mesma key)
200 OK  // Nota: status 200, não 201
{
  "id": "payment_xyz789",
  "status": "processing",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 3.3 Regras de Idempotência

| **Operação** | **Idempotência Requerida** | **Justificativa** |
|--------------|----------------------------|-------------------|
| **POST /payments** | ✅ OBRIGATÓRIO | Previne cobrança duplicada |
| **POST /proposals** | ✅ OBRIGATÓRIO | Evita propostas duplicadas |
| **PATCH /proposals/{id}** | ⚠️ RECOMENDADO | Proteção contra race conditions |
| **POST /webhooks** | ✅ OBRIGATÓRIO | Evita processamento duplicado |
| **GET /***  | ❌ NÃO APLICÁVEL | Operação read-only |
| **DELETE /***  | ✅ NATURALMENTE IDEMPOTENTE | DELETE é idempotente por definição |

### 3.4 Armazenamento e TTL

```typescript
interface IdempotencyRecord {
  key: string;                // UUID do cliente
  requestHash: string;        // Hash do body da requisição
  response: any;              // Response cached
  statusCode: number;         // HTTP status original
  createdAt: Date;
  expiresAt: Date;           // TTL de 24 horas
}

// Implementação no Redis
class IdempotencyService {
  private readonly TTL = 24 * 60 * 60; // 24 horas em segundos
  
  async store(key: string, response: any, statusCode: number) {
    await redis.setex(
      `idempotency:${key}`,
      this.TTL,
      JSON.stringify({ response, statusCode, timestamp: Date.now() })
    );
  }
}
```

---

## 4. Estratégia de Cacheabilidade (HTTP Caching)

### 4.1 Princípio de Caching

**Todos os endpoints GET devem implementar caching via `ETag` e `Cache-Control` para otimizar performance e reduzir carga no servidor.**

### 4.2 Implementação de ETag

```typescript
// Servidor gera ETag baseado no conteúdo
GET /api/v1/proposals/abc123
200 OK
Headers:
  ETag: "686897696a7c876b7e"
  Cache-Control: private, max-age=60
  
Body: { ... }

// Cliente envia ETag em requisições subsequentes
GET /api/v1/proposals/abc123
Headers:
  If-None-Match: "686897696a7c876b7e"

// Servidor responde se não houve mudança
304 Not Modified
Headers:
  ETag: "686897696a7c876b7e"
  Cache-Control: private, max-age=60
// Sem body (economia de bandwidth)
```

### 4.3 Estratégias de Cache-Control

| **Tipo de Recurso** | **Cache-Control** | **Justificativa** |
|---------------------|------------------|-------------------|
| **Dados de proposta** | `private, max-age=60` | Dados sensíveis, cache curto |
| **Lista de produtos** | `public, max-age=3600` | Muda raramente |
| **Dados do usuário** | `private, no-cache` | Sempre validar com servidor |
| **Relatórios** | `private, max-age=300, must-revalidate` | Balance entre performance e freshness |
| **Arquivos estáticos** | `public, max-age=31536000, immutable` | Versionados via URL |

### 4.4 Implementação Prática

```typescript
// Middleware Express para ETag automático
import crypto from 'crypto';

function etagMiddleware(req, res, next) {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Gerar ETag baseado no conteúdo
    const etag = crypto
      .createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
    
    // Verificar If-None-Match do cliente
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    
    // Adicionar headers de cache
    res.set('ETag', etag);
    res.set('Cache-Control', getCacheStrategy(req.path));
    
    return originalSend.call(this, data);
  };
  
  next();
}
```

---

## 5. Padronização de Cabeçalhos

### 5.1 Cabeçalhos Obrigatórios

| **Header** | **Direção** | **Obrigatoriedade** | **Formato** |
|------------|-------------|---------------------|-------------|
| **X-Correlation-ID** | Request & Response | ✅ OBRIGATÓRIO | UUID v4 |
| **X-Request-ID** | Request & Response | ✅ OBRIGATÓRIO | UUID v4 |
| **X-API-Version** | Response | ✅ OBRIGATÓRIO | `v1`, `v2` |
| **X-Rate-Limit-***  | Response | ✅ OBRIGATÓRIO | RFC 6585 |
| **Idempotency-Key** | Request | ⚠️ CONDICIONAL | UUID v4 |

### 5.2 Propagação de Correlation ID

```typescript
// Middleware para garantir propagação
function correlationMiddleware(req, res, next) {
  // Usar existing ou gerar novo
  const correlationId = req.headers['x-correlation-id'] || uuid.v4();
  
  // Propagar para todos os serviços downstream
  req.correlationId = correlationId;
  res.set('X-Correlation-ID', correlationId);
  
  // Adicionar ao contexto de logging
  logger.addContext({ correlationId });
  
  next();
}

// Exemplo de propagação para serviços externos
async function callExternalService(data) {
  return axios.post('https://external-api.com/endpoint', data, {
    headers: {
      'X-Correlation-ID': getCurrentCorrelationId()
    }
  });
}
```

### 5.3 Rate Limiting Headers

```typescript
// Headers RFC 6585 compliant
{
  "X-RateLimit-Limit": "1000",      // Limite de requisições
  "X-RateLimit-Remaining": "999",   // Requisições restantes
  "X-RateLimit-Reset": "1609459200" // Unix timestamp para reset
}

// Resposta quando limite excedido
429 Too Many Requests
{
  "error": {
    "type": "rate_limit_exceeded",
    "message": "API rate limit exceeded",
    "retryAfter": 3600
  }
}
```

---

## 6. Guia de Estilo (Anexo Completo)

### 6.1 Convenções de Nomenclatura

#### URLs e Paths

```
✅ CORRETO:
/api/v1/proposals                    // Plural para collections
/api/v1/proposals/{id}               // Singular para resource
/api/v1/proposals/{id}/documents     // Nested resources
/api/v1/payment-methods              // Kebab-case para compostos

❌ INCORRETO:
/api/v1/proposal                     // Singular para collection
/api/v1/proposals/{id}/Documents     // PascalCase
/api/v1/payment_methods              // Snake_case
/api/v1/getProposals                 // Verbo no path
```

#### Query Parameters

```typescript
// ✅ CORRETO - camelCase para query params
GET /api/v1/proposals?statusFilter=approved&sortBy=createdAt&pageSize=20

// ❌ INCORRETO
GET /api/v1/proposals?status_filter=approved&sort-by=created_at
```

### 6.2 Uso Semântico de Métodos HTTP

| **Método** | **Uso** | **Idempotente** | **Safe** | **Exemplo** |
|------------|---------|-----------------|----------|-------------|
| **GET** | Buscar recursos | ✅ Sim | ✅ Sim | `GET /proposals/{id}` |
| **POST** | Criar recursos | ❌ Não | ❌ Não | `POST /proposals` |
| **PUT** | Substituir completo | ✅ Sim | ❌ Não | `PUT /proposals/{id}` |
| **PATCH** | Atualização parcial | ❌ Não* | ❌ Não | `PATCH /proposals/{id}` |
| **DELETE** | Remover recursos | ✅ Sim | ❌ Não | `DELETE /proposals/{id}` |

*PATCH pode ser idempotente dependendo da implementação

### 6.3 Formato de Response Padrão

#### Sucesso (2xx)

```typescript
// Single Resource
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "proposal",
    "attributes": {
      "status": "approved",
      "amount": 10000.00
    },
    "relationships": {
      "client": { "id": "client_123" },
      "store": { "id": "store_456" }
    }
  },
  "meta": {
    "timestamp": "2025-08-22T10:00:00Z",
    "version": "v1"
  }
}

// Collection com Paginação
{
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalPages": 5,
      "totalItems": 100
    }
  },
  "links": {
    "self": "/api/v1/proposals?page=1",
    "next": "/api/v1/proposals?page=2",
    "prev": null,
    "first": "/api/v1/proposals?page=1",
    "last": "/api/v1/proposals?page=5"
  }
}
```

#### Erro (4xx, 5xx) - RFC 7807 Compliant

```typescript
{
  "error": {
    "type": "/errors/validation-failed",
    "title": "Validation Failed",
    "status": 400,
    "detail": "The request body failed validation",
    "instance": "/api/v1/proposals",
    "correlationId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2025-08-22T10:00:00Z",
    "errors": [
      {
        "field": "amount",
        "message": "Amount must be greater than 0",
        "code": "INVALID_AMOUNT"
      }
    ]
  }
}
```

### 6.4 Status Codes Semânticos

| **Código** | **Uso** | **Exemplo de Cenário** |
|------------|---------|------------------------|
| **200 OK** | Sucesso genérico | GET, PUT, PATCH bem-sucedidos |
| **201 Created** | Recurso criado | POST bem-sucedido |
| **202 Accepted** | Processamento assíncrono | Operação enfileirada |
| **204 No Content** | Sucesso sem body | DELETE bem-sucedido |
| **304 Not Modified** | Cache válido | ETag match |
| **400 Bad Request** | Erro de validação | Dados inválidos |
| **401 Unauthorized** | Autenticação falhou | Token inválido |
| **403 Forbidden** | Sem permissão | RBAC negou acesso |
| **404 Not Found** | Recurso inexistente | ID não encontrado |
| **409 Conflict** | Conflito de estado | Duplicação detectada |
| **422 Unprocessable Entity** | Erro de negócio | Regra de negócio violada |
| **429 Too Many Requests** | Rate limit excedido | Throttling ativado |
| **500 Internal Server Error** | Erro não tratado | Exceção inesperada |
| **503 Service Unavailable** | Serviço indisponível | Manutenção/Circuit breaker |

### 6.5 Filtros, Ordenação e Paginação

```typescript
// Filtros via query parameters
GET /api/v1/proposals?status=approved&minAmount=1000&maxAmount=50000

// Ordenação
GET /api/v1/proposals?sortBy=createdAt&sortOrder=desc
GET /api/v1/proposals?sort=-createdAt,+amount  // Alternativa compacta

// Paginação cursor-based (recomendado para grandes datasets)
GET /api/v1/proposals?cursor=eyJpZCI6MTAwfQ&limit=20

// Paginação offset-based (simples mas menos eficiente)
GET /api/v1/proposals?page=2&pageSize=20

// Field selection (sparse fieldsets)
GET /api/v1/proposals?fields=id,status,amount,client.name
```

### 6.6 Operações Batch

```typescript
// Batch create
POST /api/v1/proposals/batch
{
  "operations": [
    { "data": { ... } },
    { "data": { ... } }
  ]
}

// Response com resultados individuais
{
  "results": [
    { "status": 201, "data": { "id": "abc123" } },
    { "status": 422, "error": { "message": "Validation failed" } }
  ],
  "summary": {
    "successful": 1,
    "failed": 1,
    "total": 2
  }
}
```

---

## 7. Enforcement e Automação

### 7.1 Validação via OpenAPI

```yaml
# Adicionar ao OpenAPI spec
x-api-style-version: "1.0"
x-idempotency-required: true
x-cache-strategy: "etag"

components:
  parameters:
    CorrelationId:
      name: X-Correlation-ID
      in: header
      required: true
      schema:
        type: string
        format: uuid
```

### 7.2 ESLint Rules

```javascript
// .eslintrc.js customizado para APIs
module.exports = {
  rules: {
    'api/version-in-path': 'error',
    'api/plural-collections': 'error',
    'api/kebab-case-paths': 'error',
    'api/correlation-id-required': 'error',
    'api/standard-response-format': 'error'
  }
};
```

### 7.3 CI/CD Gates

```yaml
# GitHub Actions validation
- name: Validate API Style Guide
  run: |
    npm run lint:api
    npm run test:openapi
    npm run test:idempotency
```

---

## 8. Roadmap de Implementação

### Fase 1: Foundation (Sprint atual)
- [x] Criar e aprovar ADR-007
- [ ] Implementar middleware de correlation ID
- [ ] Adicionar suporte básico a Idempotency-Key
- [ ] Configurar ETag para endpoints críticos

### Fase 2: Rollout (Próximas 2 sprints)
- [ ] Migrar 10 endpoints prioritários
- [ ] Implementar rate limiting headers
- [ ] Adicionar validação OpenAPI no CI/CD
- [ ] Treinar equipe no novo padrão

### Fase 3: Full Adoption (Q1 2026)
- [ ] Migrar todos os 30+ endpoints
- [ ] Implementar cache distribuído com Redis
- [ ] Adicionar métricas de aderência
- [ ] Publicar documentação para parceiros

---

## 9. Métricas de Sucesso

### Indicadores de Qualidade
- **API Style Compliance:** > 95% dos endpoints em conformidade
- **Cache Hit Rate:** > 60% para endpoints GET
- **Idempotency Coverage:** 100% para operações financeiras
- **Correlation Success:** 100% de propagação em logs distribuídos

### Indicadores de Performance
- **P50 Latency:** < 100ms (com cache)
- **P99 Latency:** < 500ms (mesmo sem cache)
- **Bandwidth Reduction:** > 40% via ETag/304 responses
- **Error Rate:** < 0.1% por malformação de request

---

## 10. Riscos e Mitigações

| **Risco** | **Probabilidade** | **Impacto** | **Mitigação** |
|-----------|------------------|-------------|---------------|
| **Breaking changes em migração** | MÉDIO | ALTO | Versionamento permite coexistência v1/v2 |
| **Performance overhead do ETag** | BAIXO | MÉDIO | Hash computation assíncrono |
| **Complexidade de idempotência** | MÉDIO | MÉDIO | Redis TTL automático + cleanup job |
| **Resistência da equipe** | BAIXO | BAIXO | Training + ferramentas automáticas |

---

## 11. Decisão Final

**APROVADO:** Implementação do Guia de Estilo de API v1.0 com enforcement progressivo via automação e validação em CI/CD.

### Próximos Passos Imediatos
1. **Configurar ESLint** com regras customizadas para APIs
2. **Implementar middleware base** para correlation e idempotency
3. **Atualizar OpenAPI spec** com novos padrões
4. **Criar template** para novos endpoints
5. **Documentar em README** para onboarding

---

## Referências

- **RFC 7807:** Problem Details for HTTP APIs
- **RFC 8594:** The Sunset HTTP Header Field
- **RFC 6585:** Additional HTTP Status Codes (Rate Limiting)
- **ADR-006:** Padrões de Integração e Comunicação
- **OpenAPI Specification 3.0.3**
- **JSON:API Specification:** Inspiração para formato de response
- **REST Maturity Model:** Richardson (Level 3 - HATEOAS)

**Data de Revisão:** 22 de Setembro de 2025  
**Próxima Avaliação:** Q1 2026 (métricas de adoção)