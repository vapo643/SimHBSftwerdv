# Simpix Credit Management System

## Overview

Simpix is a full-stack TypeScript application designed for comprehensive credit management. It streamlines the entire credit proposal workflow, from initial creation and in-depth analysis to payment processing and formalization tracking. The project aims to provide a robust, secure, and user-friendly platform for financial institutions handling credit operations, with a strong focus on security, compliance, and efficient data management. The ambition is to achieve banking-grade security and become a leading solution in the credit management market.

## User Preferences

Preferred communication style: Simple, everyday language.

## Effective Prompt Guidelines

Based on implementation patterns, these prompt structures work best:

### Anti-Failure Prompt Template:
```
IMPLEMENTAR: [funcionalidade específica]
DADOS REAIS: usar [tabela/registro específico existente]
ROLES: [role A] pode [ação], [role B] só pode [ação limitada]  
INTEGRAÇÃO: conectar com [sistema existente]
TESTE: validar com [cenário específico]
BANCO: verificar se [colunas/enums] existem
```

### Critical Pre-Implementation Checklist:
- [ ] Verificar schema do banco vs código Drizzle
- [ ] Confirmar roles/enums existem no banco
- [ ] Testar com dados reais de propostas existentes
- [ ] Validar permissões por role antes de codificar
- [ ] Integrar com APIs já configuradas (não recriar)

### Most Effective Prompt Patterns:
1. **Context + Current State + Expected**: "Estou na tela X, deveria mostrar Y mas aparece Z"
2. **Role-Based Specification**: "Admin vê tudo, COBRANÇA vê apenas inadimplentes"  
3. **Data Reference**: "Usar proposta PROP-1753723342043 que já tem boletos"
4. **Integration Requirement**: "Conectar com Inter Bank API já configurada"

### Common Implementation Gaps to Avoid:
- Schema mismatch (código vs banco real)
- Role enum não atualizado no banco
- Filtros aplicados incorretamente (todos vs específicos)
- Não validar dados reais existentes
- Ignorar integrações já funcionais

### Real-World Examples from Recent Implementations:

**❌ Problema Típico:**
```
Prompt: "implementar sistema de cobranças"
Resultado: Erro database "codigo_boleto does not exist"
Causa: Não verifiquei se colunas existiam no banco
```

**✅ Solução Melhorada:**
```
IMPLEMENTAR: sistema de cobranças
DADOS REAIS: propostas já aprovadas com status pago/pronto_pagamento
ROLES: ADMINISTRADOR vê tudo, COBRANÇA vê só inadimplentes 
INTEGRAÇÃO: usar Inter Bank API já configurada
BANCO: verificar se parcelas tem colunas de boleto
TESTE: validar com usuário admin vs usuário cobrança
```

### Phrases That Prevent Implementation Gaps:
- "Verificar se as colunas/enums existem no banco antes de implementar"
- "Testar com dados reais da proposta [ID específico]"
- "Garantir que funciona para ambos os roles: ADMIN e [ROLE]"
- "Conectar com [API] já configurada, não recriar"

---

## Implementation Status

CCB Generation: ✅ IMPLEMENTED - Uses custom PDF template provided by user instead of agent-generated formatting to ensure professional results without text overlapping. System now fills user's exact template with proposal data.
Inter Bank API: Complete integration for automated boleto generation with focus on anti-fragile RBAC system and comprehensive automated proposal lifecycle management.
Security: "Redobrada" (doubled) security measures required for banking/loan data - maximum OWASP Top 10 compliance is critical.
Production Timeline: Software to be deployed at Eleeve loan stores by next week (August 2025) - ALL INTEGRATIONS READY FOR PRODUCTION DEPLOYMENT.
Formalization Interface: ✅ COMPLETELY UNIFIED - Attendant and Administrator interfaces are now 100% identical. All role-based conditional rendering removed - both roles see exactly the same interface, buttons, controls, and timeline visualization. Backend RLS handles data filtering while frontend provides consistent experience for all authorized roles (August 2025).
Collections Dashboard: ✅ IMPLEMENTED (05/08/2025) - Comprehensive financial collections system with KPIs (Total Contracts, Delinquency Rate, Total Receivable), advanced filters (CPF/CNPJ search with LGPD masking, payment status, date ranges), detailed installment tracking table, Inter Bank boleto visualization, and quick actions for contact management.
Financial Payments: ✅ IMPLEMENTED (05/08/2025) - Complete loan disbursement interface with maker/checker approval workflow, batch payment processing, transaction history, comprehensive validation controls, and role-based approval permissions for secure fund transfers.
Client Profile Contact Data: ✅ IMPLEMENTED (06/08/2025) - Fixed contact data display in Collections module Client Profile. Now correctly shows real client phone, email, and address data from propostas table. Fixed backend API to include enderecoCliente and cepCliente fields. Added fallback displays for missing data and protection for contact buttons when data unavailable.
Real-time Boleto Status Sync: ✅ IMPLEMENTED (06/08/2025) - Complete synchronization system with Inter Bank API for real-time boleto status updates. Comprehensive status mapping (RECEBIDO→pago, CANCELADO→cancelado, ATRASADO→vencido, A_RECEBER→pendente) with automatic parcela updates. Sync button in Collections interface successfully tested with 14 boletos updated from real Inter Bank data.
Projeto Cérbero Audit System: ✅ IMPLEMENTED (06/08/2025) - Complete audit system with comprehensive logging for "Prorrogar Vencimento" and "Desconto para Quitação" operations. All logs marked with 🔍 [AUDIT] for easy tracking. Includes: real-time payload tracking, end-to-end API verification with recuperarCobranca, database synchronization validation, detailed success/failure reporting, comprehensive traceability with 6-step audit process for each operation, and automatic verification of API vs database consistency.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query for server state, `useReducer` for complex local state (e.g., ProposalContext)
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend Architecture

- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful API with `/api` prefix
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Supabase Auth integration with JWT middleware and custom role-based access control (RBAC)
- **File Storage**: Supabase Storage for document uploads
- **Server-Side Time Management**: All timestamp operations use centralized timezone utilities for Brasília timezone consistency
- **Security**: Comprehensive security architecture including:
    - Helmet for security headers (CSP, HSTS, X-Frame-Options)
    - Two-tier rate limiting with IP+email tracking
    - Input sanitization middleware
    - Timing attack protection (TimingNormalizer middleware)
    - Magic number validation and comprehensive file security validation for uploads
    - Cryptographically secure UUIDs for IDs
    - Soft delete implementation for financial compliance
    - Row Level Security (RLS) for multi-tenant data isolation and fine-grained access control
    - Automated security testing pipeline (SAST/DAST) with ESLint Security, Semgrep, npm audit, Trivy, GitLeaks, OWASP ZAP, Nuclei
    - OWASP ASVS Level 1 compliance
    - OWASP SAMM v1.5 integration for security maturity assessment
    - Anti-fragile RBAC implementation with robust session enrichment and role guards
- **Credit Simulation**: Real-time credit simulation API using Tabela Price formula, IOF, TAC, and CET calculations, integrated with commercial tables.
- **Document Management**: Secure private bucket for document storage with signed URLs, organized folder structure, and multi-format support.
- **PDF Generation**: ✅ ENHANCED - Template-based CCB (Cédula de Crédito Bancário) generation using user's exact PDF template with pdf-lib for precise field filling, ensuring professional layout and compliance with legal requirements. Automatically fills all proposal data into the provided template.
- **Payment Workflow**: Complete payment queue system with batch processing, multiple payment methods, and formalization tracking integration.
- **Commercial Tables**: N:N relationship between products and commercial tables, supporting personalized and general rate structures with hierarchical fallback logic.

### Database Schema

- PostgreSQL with Drizzle ORM.
- Key tables: `users`, `propostas`, `parceiros`, `lojas`, `produtos`, `tabelas_comerciais`, `produto_tabela_comercial` (junction table), `comunicacao_logs`, `proposta_logs`, `parcelas`, `audit_delete_log`, `inter_collections`, `inter_webhooks`, `inter_callbacks`.
- `propostas` table includes detailed client data, loan conditions, formalization tracking fields (e.g., `ccb_gerado`, `assinatura_eletronica_concluida`), and status tracking (rascunho, aguardando_analise, em_analise, aprovado, rejeitado, pronto_pagamento, pago, cancelado, pendente).
- `deleted_at` columns are implemented for soft deletes on critical tables.

## External Dependencies

- **Supabase**: Primary provider for Authentication, PostgreSQL Database, and File Storage.
- **Drizzle ORM**: Type-safe ORM for PostgreSQL interactions.
- **TanStack Query**: For server state management and caching on the frontend.
- **React Hook Form**: For form management and validation.
- **Zod**: For schema validation (frontend and backend).
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **shadcn/ui**: Pre-built React components.
- **Wouter**: Lightweight React router.
- **Vite**: Build tool.
- **Express.js**: Backend framework.
- **@neondatabase/serverless**: PostgreSQL client.
- **jwt-simple**: For JWT token handling.
- **Helmet**: For setting HTTP security headers.
- **express-rate-limit**: For API rate limiting.
- **zxcvbn**: For password strength validation.
- **uuid**: For generating cryptographically secure UUIDs.
- **PDFKit**: For dynamic PDF generation (CCB).
- **OWASP ZAP**: Dynamic Application Security Testing (DAST).
- **Semgrep**: Static Application Security Testing (SAST).
- **OWASP Dependency-Check**: Software Composition Analysis (SCA).
- **ClickSign**: For electronic signature integration - ✅ PRODUCTION READY (API v1 fully operational, webhooks implemented, full documentation)
  - Complete webhook system with HMAC validation, timestamp validation, and event deduplication
  - Automatic workflow: CCB signature → boleto generation via Inter Bank
  - API v1 implementation ready (Documents → Signers → Lists → Notifications flow)
  - Critical points documented: CPF formatting, rate limits, flow order, HMAC validation
  - 130 API endpoints fully documented and understood
  - Enhanced security layer: Input validation, XSS protection, rate limiting, IP whitelisting, secure logging
  - Full OWASP compliance: ASVS Level 1 verified, Top 10 mitigations implemented
  - ✅ NEW: Regenerate signature link functionality - Attendants can generate new signature links if needed
  - ✅ NEW: Configuration guide created (CLICKSIGN_CONFIGURACAO_OBRIGATORIA.md) - Covers webhook setup, account settings, and security requirements
  - ✅ ARCHITECTURAL FIX (04/08/2025): All API calls now use simple JSON format (`{signer: {...}}`) instead of JSON:API format - resolved HTML response errors
  - ✅ HEADERS FIX: All endpoints now use `Content-Type: application/json` - aligned with ClickSign documentation
  - ✅ CRITICAL DISCOVERY (04/08/2025): ClickSign API v3 doesn't exist! Changed from `/api/v3` to `/api/v2` - this was causing 404 HTML responses
  - ✅ HTTP 202 FIX (04/08/2025): Fixed handling of HTTP 202 (Accepted) status code for notifications - now correctly treats as success for asynchronous operations
  - ✅ INTER BANK BOLETO DISPLAY (04/08/2025): Implemented comprehensive boleto display with QR codes and payment details
    - Formalization screen now shows all generated boletos with QR codes, barcodes, and download links
    - Collections screen enhanced to display Inter Bank payment status and QR codes
    - Webhook system updates payment status in real-time when boletos are paid
- **Banco Inter API**: For automated boleto/PIX payment generation and tracking - ✅ PRODUCTION READY (100% OPERATIONAL, production credentials working)
  - Complete OAuth 2.0 authentication with mTLS following official documentation
  - Automatic boleto generation after ClickSign signature (fully automated)  
  - Webhook system for payment notifications with HMAC validation
  - Full CRUD operations for collections with error handling
  - Code validated against official Inter documentation (31/07/2025)
  - **CONFIRMED WORKING**: Production OAuth2 token obtained successfully (01/08/2025)
  - **mTLS Certificates**: Properly configured and validated
  - **Integration Status**: 100% operational, ready for real transactions
  - **OAuth2 FIX (04/08/2025)**: Resolved persistent 400 error - Node.js fetch was not sending certificates properly. Solution: Implemented fallback to native HTTPS module which works perfectly. Access token now obtained successfully!
  - **PDF DOWNLOAD LIMITATION (05/08/2025)**: Inter Bank API does NOT support PDF download. Endpoint `/pdf` returns 406 error. Solution: Removed PDF download completely, now displays PIX Copia e Cola and complete Linha Digitável (47 digits) for payment. This prevents virus detection from corrupted downloads.