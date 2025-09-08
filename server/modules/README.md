# Domain-Driven Design Architecture

## Bounded Contexts

### 1. Credit Context (Propostas)

- **Core Domain**: Gerenciamento de propostas de crédito
- **Aggregates**: Proposal, Customer
- **Domain Services**: CreditAnalysis, RiskAssessment
- **Repositories**: ProposalRepository, CustomerRepository

### 2. Payment Context (Pagamentos)

- **Supporting Domain**: Processamento de pagamentos
- **Aggregates**: Payment, Invoice
- **Domain Services**: PaymentProcessor, InvoiceGenerator
- **Repositories**: PaymentRepository

### 3. User Context (Usuários)

- **Supporting Domain**: Gestão de usuários e autenticação
- **Aggregates**: User, Profile
- **Domain Services**: Authentication, Authorization
- **Repositories**: UserRepository

### 4. Partner Context (Parceiros)

- **Supporting Domain**: Gestão de parceiros e lojas
- **Aggregates**: Partner, Store
- **Domain Services**: CommissionCalculator
- **Repositories**: PartnerRepository

## Architecture Layers

```
contexts/
├── credit/                 # Bounded Context de Crédito
│   ├── domain/
│   │   ├── aggregates/    # Entidades e Agregados
│   │   ├── services/      # Domain Services
│   │   └── repositories/  # Interfaces de Repositório
│   ├── application/       # Application Services
│   ├── infrastructure/    # Implementações concretas
│   └── presentation/      # Controllers e DTOs
│
├── payment/               # Bounded Context de Pagamentos
├── user/                  # Bounded Context de Usuários
└── partner/              # Bounded Context de Parceiros
```

## Design Principles

1. **Aggregate Boundaries**: Cada agregado mantém sua própria consistência
2. **Repository Pattern**: Abstração da camada de persistência
3. **Domain Services**: Lógica de negócio complexa
4. **Application Services**: Orquestração de casos de uso
5. **Anti-Corruption Layer**: Proteção contra sistemas externos
