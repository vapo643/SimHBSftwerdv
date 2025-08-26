# C4 Level 3 - Component Diagram: Credit Proposal Bounded Context

## Overview
This diagram shows the internal structure of the Credit Proposal bounded context, implementing Domain-Driven Design (DDD) patterns with clear separation of concerns across four layers.

## Architecture Principle
**Data Flow Direction:** `Presentation → Application → Domain ← Infrastructure`

Each layer depends only on layers below it, with Infrastructure depending on Domain interfaces (Dependency Inversion Principle).

## Component Diagram

```mermaid
graph TB
    %% Styling
    classDef presentationLayer fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef applicationLayer fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef domainLayer fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef infrastructureLayer fill:#fff3e0,stroke:#e65100,stroke-width:2px
    
    %% External actors
    Client[HTTP Client]
    Database[(PostgreSQL Database)]
    
    %% Presentation Layer
    subgraph "Presentation Layer"
        Controller["ProposalController<br/>• create()<br/>• getById()<br/>• update()<br/>• delete()<br/>• list()"]
        Routes["Express Routes<br/>• POST /api/proposals<br/>• GET /api/proposals/:id<br/>• PUT /api/proposals/:id<br/>• DELETE /api/proposals/:id"]
    end
    
    %% Application Layer  
    subgraph "Application Layer"
        AppService["ProposalApplicationService<br/>• createProposal()<br/>• getProposal()<br/>• updateProposal()<br/>• deleteProposal()<br/>• listProposals()<br/>• analyzeProposal()"]
    end
    
    %% Domain Layer
    subgraph "Domain Layer"
        Aggregate["Proposal Aggregate<br/>• new Proposal()<br/>• fromPersistence()<br/>• calculateMonthlyPayment()<br/>• calculateTotalAmount()<br/>• updateStatus()<br/>• validate()"]
        
        RepoInterface["IProposalRepository<br/>• findById()<br/>• save()<br/>• delete()<br/>• findAll()<br/>• findByStatus()"]
        
        DomainService["CreditAnalysisService<br/>• analyzeCredit()<br/>• calculateRisk()<br/>• validateBusinessRules()"]
    end
    
    %% Infrastructure Layer
    subgraph "Infrastructure Layer"
        RepoImpl["ProposalRepositoryImpl<br/>• findById()<br/>• save()<br/>• delete()<br/>• findAll()<br/>• toDomain()<br/>• toPersistence()"]
    end
    
    %% Relationships
    Client --> Routes
    Routes --> Controller
    Controller --> AppService
    AppService --> Aggregate
    AppService --> DomainService
    AppService --> RepoInterface
    RepoInterface <|.. RepoImpl
    RepoImpl --> Database
    
    %% Apply styles
    class Controller,Routes presentationLayer
    class AppService applicationLayer
    class Aggregate,RepoInterface,DomainService domainLayer
    class RepoImpl infrastructureLayer
```

## Component Responsibilities

### Presentation Layer
- **ProposalController**: Handles HTTP requests, input validation (Zod), response formatting
- **Express Routes**: Maps HTTP endpoints to controller methods, middleware integration

### Application Layer  
- **ProposalApplicationService**: Orchestrates use cases, coordinates between domain and infrastructure
  - Converts DTOs to/from domain entities
  - Implements business workflows
  - Manages transactions and error handling

### Domain Layer
- **Proposal Aggregate**: Core business entity with rich domain logic
  - Encapsulates proposal state and behavior
  - Enforces business invariants
  - Provides calculation methods
- **IProposalRepository**: Repository contract/interface
  - Defines persistence operations
  - Maintains domain independence
- **CreditAnalysisService**: Domain service for credit analysis logic
  - Complex business rules that don't belong in single entity
  - Cross-cutting concerns within the domain

### Infrastructure Layer
- **ProposalRepositoryImpl**: Concrete repository implementation
  - Database access through Drizzle ORM
  - Data mapping (domain ↔ persistence)
  - Query optimization

## Key Architectural Patterns

### 1. **Dependency Inversion**
```
Application Service → IProposalRepository ← ProposalRepositoryImpl
```
Application layer depends on abstraction, not concrete implementation.

### 2. **Rich Domain Model**
```
Proposal Aggregate contains:
- CustomerData (Value Object)
- LoanConditions (Value Object)  
- Business methods (calculateMonthlyPayment, etc.)
```

### 3. **Repository Pattern**
```
Domain defines contract → Infrastructure implements contract
```
Separates domain logic from data access concerns.

### 4. **Application Service Pattern**
```
Controller → Application Service → Domain + Infrastructure
```
Thin controllers, fat domain, coordinated by application services.

## Data Flow Example: Create Proposal

1. **HTTP Request** → `POST /api/proposals`
2. **Routes** → Maps to `Controller.create()`
3. **Controller** → Validates input, calls `AppService.createProposal()`
4. **Application Service** → Creates `Proposal` aggregate, calls `Repository.save()`
5. **Repository Interface** → Implemented by `ProposalRepositoryImpl`
6. **Repository Implementation** → Persists to PostgreSQL via Drizzle ORM
7. **Response Flow** → Database → Repository → App Service → Controller → HTTP Response

## Benefits of This Architecture

- **Testability**: Each layer can be unit tested in isolation
- **Maintainability**: Clear separation of concerns
- **Flexibility**: Easy to swap infrastructure components
- **Domain Focus**: Business logic concentrated in domain layer
- **Type Safety**: Full TypeScript coverage across all layers

---

**Generated on:** 2025-08-21  
**Architecture Status:** ✅ Implemented and Operational  
**DDD Conformity:** 100% - All layers properly implemented with correct dependencies