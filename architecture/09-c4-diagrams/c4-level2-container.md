# C4 Model - Level 2: Container Diagram
**Sistema:** Simpix Credit Management System  
**Data:** 21/08/2025  
**Versão:** 1.0 AS-IS

---

## 📊 Diagrama de Containers

```mermaid
graph TB
    %% Styling
    classDef person fill:#08427b,stroke:#073b6f,color:#fff
    classDef webApp fill:#1168bd,stroke:#0e5ba6,color:#fff
    classDef api fill:#1168bd,stroke:#0e5ba6,color:#fff
    classDef db fill:#438dd5,stroke:#3b7fc4,color:#fff
    classDef queue fill:#85bbf0,stroke:#78b3ec,color:#000
    classDef external fill:#999999,stroke:#898989,color:#fff
    
    %% Users
    User["👤 Usuários<br/>(All Roles)"]:::person
    
    %% Containers - Frontend
    subgraph "Frontend [Browser]"
        SPA["🌐 Single Page Application<br/>[Container: React + TypeScript]<br/><br/>Interface web responsiva<br/>Wouter routing, TanStack Query"]:::webApp
    end
    
    %% Containers - Backend
    subgraph "Backend [Node.js]"
        API["⚙️ REST API<br/>[Container: Express + TypeScript]<br/><br/>Business logic, validations<br/>Drizzle ORM, JWT auth"]:::api
        
        Workers["👷 Background Workers<br/>[Container: BullMQ]<br/><br/>PDF generation, payment sync<br/>Async processing"]:::queue
    end
    
    %% Containers - Data
    subgraph "Data Layer"
        DB[("🗄️ PostgreSQL<br/>[Container: Supabase]<br/><br/>Propostas, users, logs<br/>24 status states FSM")]:::db
        
        Cache[("⚡ Cache<br/>[Container: In-Memory/Redis]<br/><br/>Commercial tables<br/>1-hour TTL")]:::queue
        
        Storage["📁 File Storage<br/>[Container: Supabase Storage]<br/><br/>PDFs, documents<br/>Signed URLs"]:::db
    end
    
    %% External Systems
    SupaAuth["🔐 Supabase Auth<br/>[External]"]:::external
    Inter["🏦 Banco Inter API<br/>[External]"]:::external
    Click["📝 ClickSign API<br/>[External]"]:::external
    Sentry["🔍 Sentry<br/>[External]"]:::external
    
    %% Relationships - User Flow
    User -->|"HTTPS"| SPA
    SPA -->|"REST API<br/>JWT Token"| API
    
    %% Relationships - Backend
    API -->|"Queries<br/>Drizzle ORM"| DB
    API -->|"Cache<br/>reads"| Cache
    API -->|"Enqueue<br/>jobs"| Workers
    API -->|"Upload<br/>files"| Storage
    
    Workers -->|"Process"| DB
    Workers -->|"Generate<br/>PDFs"| Storage
    
    %% Relationships - External
    API -->|"Auth"| SupaAuth
    API -->|"Payments"| Inter
    API -->|"Contracts"| Click
    API -->|"Errors"| Sentry
    Workers -->|"Errors"| Sentry
    
    Inter -->|"Webhooks"| API
    Click -->|"Webhooks"| API
```

---

## 📦 Descrição dos Containers

### **Frontend Container**

| Container | Tecnologia | Responsabilidades | Portas |
|-----------|------------|-------------------|---------|
| **SPA** | React 18 + TypeScript | - Renderização de UI<br/>- Gerenciamento de estado local<br/>- Cache de queries (TanStack)<br/>- Validação de formulários | :5000 (dev) |

**Principais Bibliotecas:**
- Wouter (routing)
- TanStack Query (server state)
- React Hook Form + Zod
- Tailwind CSS + shadcn/ui

### **Backend Containers**

| Container | Tecnologia | Responsabilidades | Portas |
|-----------|------------|-------------------|---------|
| **REST API** | Express + TypeScript | - Autenticação/Autorização<br/>- Business logic<br/>- Validação de dados<br/>- Integração com externos | :5000 |
| **Workers** | BullMQ + Redis | - Geração de PDFs<br/>- Sincronização de pagamentos<br/>- Processamento assíncrono<br/>- Retry logic | N/A |

**Segurança Implementada:**
- Helmet (headers)
- Rate limiting (2 tiers)
- CSRF protection
- Input sanitization
- JWT validation

### **Data Containers**

| Container | Tecnologia | Responsabilidades | Dados |
|-----------|------------|-------------------|--------|
| **PostgreSQL** | Supabase Postgres | - Persistência principal<br/>- Transações ACID<br/>- Row Level Security | ~50 tables |
| **Cache** | In-Memory/Redis | - Cache L2 para queries<br/>- Session storage<br/>- Rate limit counters | TTL: 1h |
| **File Storage** | Supabase Storage | - Documentos PDF<br/>- Contratos assinados<br/>- Avatares | ~10GB |

---

## 🔄 Fluxos de Comunicação

### **1. Fluxo Síncrono (Request/Response)**
```
Browser → SPA → API → Database → API → SPA → Browser
         JWT  REST  SQL       JSON  React
```

### **2. Fluxo Assíncrono (Background Jobs)**
```
API → BullMQ Queue → Worker → Database
    → Redis Store  → Process → Update Status
```

### **3. Fluxo de Webhooks**
```
External Service → API Webhook Endpoint → Validation → Database
(Inter/ClickSign)  (POST /webhooks/*)     (HMAC)      (Update)
```

---

## 🏗️ Arquitetura de Deployment (AS-IS)

### **Ambiente Atual - Replit**
```
┌─────────────────────────────────────┐
│         Replit Container            │
│  ┌─────────┐  ┌─────────┐          │
│  │   SPA   │  │   API   │          │
│  │  :5000  │←→│  :5000  │          │
│  └─────────┘  └─────────┘          │
│       ↓           ↓                 │
└───────┼───────────┼─────────────────┘
        ↓           ↓
   [Supabase]  [External APIs]
```

### **Configuração de Módulos**

| Módulo | Localização | Padrão |
|--------|-------------|---------|
| **Auth** | `server/lib/jwt-auth-middleware.ts` | JWT + Supabase |
| **Database** | `server/lib/database.ts` | Drizzle ORM |
| **Logging** | `server/lib/logger.ts` | Winston + Correlation |
| **Config** | `server/lib/config.ts` | Centralized secrets |
| **Queue** | `server/lib/queue/` | BullMQ patterns |

---

## 📊 Métricas por Container

| Container | CPU | Memory | Requests/min | P99 Latency |
|-----------|-----|--------|--------------|-------------|
| **SPA** | 5% | 50MB | N/A | N/A |
| **API** | 15% | 200MB | ~100 | 200ms |
| **Workers** | 20% | 150MB | ~10 jobs | 5s |
| **Database** | 10% | 500MB | ~500 | 50ms |

---

## 🚨 Gargalos Identificados

### **Performance:**
1. Falta de connection pooling otimizado
2. Queries N+1 em algumas rotas
3. PDF generation síncrona em alguns casos

### **Segurança:**
1. Secrets ainda parcialmente hardcoded
2. Falta de API Gateway
3. Ausência de WAF

### **Resiliência:**
1. Single point of failure (Replit)
2. Sem health checks granulares
3. Circuit breakers parciais

---

## 🔮 Evolução Planejada

### **Fase 1 - Containerização:**
```yaml
Containers:
  - frontend: Docker (nginx + React)
  - api: Docker (Node.js)
  - workers: Docker (Node.js)
  - database: Managed PostgreSQL
```

### **Fase 2 - Orquestração:**
```yaml
Platform: Kubernetes
Services:
  - Ingress Controller
  - Service Mesh (Istio)
  - Horizontal Pod Autoscaler
```

### **Fase Final - Azure Native:**
```yaml
Services:
  - Azure Container Apps
  - Azure SQL Database
  - Azure Service Bus
  - Azure Key Vault
```

---

**Próximo:** [C4 Level 3 - Component Diagram](./c4-level3-component.md)