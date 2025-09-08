# C4 Model - Level 1: System Context Diagram

**Sistema:** Simpix Credit Management System  
**Data:** 26/08/2025  
**Versão:** 1.1 P0-REMEDIATED  
**Status:** Thread 3.3 Remediation Complete

---

## 📊 Diagrama de Contexto

```mermaid
graph TB
    %% Styling
    classDef person fill:#08427b,stroke:#073b6f,color:#fff
    classDef coreContext fill:#e1f5fe,stroke:#01579b,stroke-width:3px
    classDef supportContext fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef genericContext fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef external fill:#999999,stroke:#898989,color:#fff

    %% External Actors
    Analyst["👤 Analista de Crédito"]:::person
    Manager["👤 Gerente"]:::person
    Client["👤 Cliente"]:::person

    %% Core System with Bounded Contexts (DDD Compliant)
    subgraph "Simpix Credit Management System"
        subgraph "Core Contexts"
            CP["📋 Credit Proposal Context<br/>[Bounded Context]<br/><br/>Proposal lifecycle<br/>Status FSM (24 states)"]:::coreContext
            CA["🔍 Credit Analysis Context<br/>[Bounded Context]<br/><br/>Risk assessment<br/>Score calculation"]:::coreContext
            CM["📄 Contract Management Context<br/>[Bounded Context]<br/><br/>CCB generation<br/>Digital signatures"]:::coreContext
        end

        subgraph "Supporting Contexts"
            PP["💰 Payment Processing Context<br/>[Bounded Context]<br/><br/>Boleto generation<br/>Payment reconciliation"]:::supportContext
            PM["🏪 Partner Management Context<br/>[Bounded Context]<br/><br/>Store management<br/>Commission tables"]:::supportContext
            NM["📢 Notification Management Context<br/>[Bounded Context]<br/><br/>Multi-channel alerts<br/>Event notifications<br/>Email/SMS/Push templates"]:::supportContext
        end

        subgraph "Generic Contexts"
            AUTH["🔐 Authentication Context<br/>[Bounded Context]<br/><br/>JWT validation<br/>RBAC enforcement"]:::genericContext
            AUDIT["📊 Audit Context<br/>[Bounded Context]<br/><br/>Event sourcing<br/>Compliance logging"]:::genericContext
        end
    end

    %% External Systems
    ClickSign["📝 ClickSign API<br/>[External System]<br/><br/>Digital signatures<br/>Document tracking"]:::external
    BancoInter["🏦 Banco Inter API<br/>[External System]<br/><br/>Boleto/PIX generation<br/>Payment webhooks"]:::external
    Supabase["☁️ Supabase<br/>[External System]<br/><br/>Authentication<br/>File storage"]:::external

    %% Actor Interactions with Bounded Contexts
    Analyst -->|"Analisa propostas"| CA
    Analyst -->|"Cria propostas"| CP
    Manager -->|"Aprova propostas"| CA
    Client -->|"Inicia solicitação"| CP
    Client -->|"Assina contratos"| CM
    Client -->|"Realiza pagamentos"| PP

    %% Core Context Dependencies (Customer/Supplier Pattern)
    CP -->|"Proposta submetida"| CA
    CA -->|"Decisão aprovação"| CM
    CM -->|"Contrato assinado"| PP

    %% Supporting Context Integration (ACL Pattern)
    CP -.->|"ACL"| PM
    CA -.->|"ACL"| NM
    PP -.->|"ACL"| NM
    CM -.->|"ACL"| NM

    %% Generic Context Dependencies (Shared Kernel)
    CP -.->|"Shared Kernel"| AUTH
    CA -.->|"Shared Kernel"| AUTH
    CM -.->|"Shared Kernel"| AUTH
    PP -.->|"Shared Kernel"| AUTH
    PM -.->|"Shared Kernel"| AUTH

    %% Audit Integration (Open Host Service)
    AUDIT -->|"OHS"| CP
    AUDIT -->|"OHS"| CA
    AUDIT -->|"OHS"| CM
    AUDIT -->|"OHS"| PP

    %% External Integrations (ACL Pattern + Circuit Breakers)
    CM -->|"ACL + Circuit Breaker"| ClickSign
    PP -->|"ACL + Circuit Breaker"| BancoInter
    AUTH -->|"ACL"| Supabase

    %% External System Responses
    ClickSign -->|"Signature webhooks"| CM
    BancoInter -->|"Payment webhooks"| PP
```

---

## 📝 Descrição dos Elementos

### **Pessoas (Users)**

| Ator                    | Descrição                    | Principais Interações                                  |
| ----------------------- | ---------------------------- | ------------------------------------------------------ |
| **Analista de Crédito** | Usuário principal do sistema | Cria propostas, analisa clientes, acompanha pagamentos |
| **Gerente**             | Supervisor das operações     | Aprova propostas, monitora KPIs, gerencia equipe       |
| **Administrador**       | Responsável técnico          | Configura tabelas comerciais, gerencia acessos         |
| **Cliente**             | Beneficiário do crédito      | Assina contratos, realiza pagamentos                   |

### **Bounded Contexts (DDD Architecture)**

#### **Core Contexts (Diferencial Competitivo)**

| Context                 | Aggregate Root | Responsabilidades                                                                                     |
| ----------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| **Credit Proposal**     | Proposta       | - Lifecycle completo da proposta<br/>- Status FSM (24 estados)<br/>- Validação de regras de negócio   |
| **Credit Analysis**     | Análise        | - Cálculo de score automático<br/>- Decisão de aprovação/rejeição<br/>- Motor de políticas de crédito |
| **Contract Management** | Contrato       | - Geração automatizada de CCB<br/>- Integração ClickSign<br/>- Tracking de assinaturas                |

#### **Supporting Contexts (Suporte Necessário)**

| Context                     | Aggregate Root | Responsabilidades                                                                                                      |
| --------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Payment Processing**      | Pagamento      | - Integração Banco Inter<br/>- Geração de boletos<br/>- Reconciliação de pagamentos                                    |
| **Partner Management**      | Parceiro       | - Gestão de lojas parceiras<br/>- Tabelas comerciais<br/>- Cálculo de comissões                                        |
| **Notification Management** | Notificação    | - Comunicação multicanal<br/>- Event-driven notifications<br/>- Templates personalizados<br/>- Email/SMS/Push delivery |

#### **Generic Contexts (Commodities)**

| Context            | Aggregate Root | Responsabilidades                                                     |
| ------------------ | -------------- | --------------------------------------------------------------------- |
| **Authentication** | Usuário        | - JWT validation<br/>- RBAC enforcement<br/>- Session management      |
| **Audit**          | AuditEvent     | - Event sourcing<br/>- Compliance logging<br/>- Immutable audit trail |

### **Sistemas Externos**

| Sistema         | Tipo               | Integração       | Criticidade |
| --------------- | ------------------ | ---------------- | ----------- |
| **Supabase**    | PaaS               | REST API + SDK   | 🔴 Crítica  |
| **Banco Inter** | API Bancária       | REST + OAuth 2.0 | 🔴 Crítica  |
| **ClickSign**   | Assinatura Digital | REST API         | 🟡 Alta     |
| **Sentry**      | Observabilidade    | SDK              | 🟢 Média    |

---

## 🔄 Fluxos de Dados Principais

### **1. Fluxo Inter-Context (Customer/Supplier)**

```
Credit Proposal Context → Credit Analysis Context → Contract Management Context → Payment Processing Context
```

### **2. Fluxo de Autenticação (Shared Kernel)**

```
Authentication Context ←→ All Bounded Contexts (JWT + RBAC)
```

### **3. Fluxo de Auditoria (Open Host Service)**

```
Audit Context ← All Core Contexts (Event Sourcing)
```

### **4. Fluxo de Integração Externa (ACL Pattern)**

```
Contract Management Context ↔ ClickSign API (Circuit Breaker)
Payment Processing Context ↔ Banco Inter API (Circuit Breaker)
```

---

## 🚨 Pontos de Atenção

### **Context Integration Patterns:**

1. **Customer/Supplier** - Core contexts seguem fluxo linear de valor
2. **Anti-Corruption Layer (ACL)** - Protege bounded contexts de APIs externas
3. **Shared Kernel** - Authentication e domain primitives compartilhados
4. **Open Host Service** - Audit context fornece APIs padronizadas

### **Riscos Arquiteturais Identificados:**

- **Context Boundaries** - Potencial vazamento entre bounded contexts
- **Integration Failures** - Circuit breakers podem isolar contexts críticos
- **Event Consistency** - Domain events devem manter consistência eventual

---

## 📊 Métricas de Contexto

| Métrica              | Valor Atual | Meta  |
| -------------------- | ----------- | ----- |
| Usuários Ativos      | ~50         | 200+  |
| Propostas/Dia        | ~30         | 100+  |
| Integrações Externas | 4           | 6-8   |
| Disponibilidade      | 98%         | 99.9% |

---

## 🔮 Evolução Planejada (TO-BE)

### **Fase 1 - Desacoplamento:**

- Abstrair Supabase com Repository Pattern
- Implementar cache layer com Redis
- Adicionar circuit breakers

### **Fase 2 - Resiliência:**

- Message queue para webhooks
- Backup payment provider
- Multi-region deployment

### **Fase Final - Azure (DDD Preservado):**

- **Authentication Context** → Azure AD integration
- **All Contexts** → Azure SQL Database com schema separation
- **Inter-Context Communication** → Azure Service Bus
- **Audit Context** → Azure Monitor + Event Sourcing

---

**Próximo:** [C4 Level 2 - Container Diagram](./c4-level2-container.md)
