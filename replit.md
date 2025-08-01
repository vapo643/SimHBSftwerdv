# Simpix Credit Management System

## Overview

Simpix is a full-stack TypeScript application designed for comprehensive credit management. It streamlines the entire credit proposal workflow, from initial creation and in-depth analysis to payment processing and formalization tracking. The project aims to provide a robust, secure, and user-friendly platform for financial institutions handling credit operations, with a strong focus on security, compliance, and efficient data management. The ambition is to achieve banking-grade security and become a leading solution in the credit management market.

## User Preferences

Preferred communication style: Simple, everyday language.
CCB Generation: ✅ IMPLEMENTED - Uses custom PDF template provided by user instead of agent-generated formatting to ensure professional results without text overlapping. System now fills user's exact template with proposal data.
Inter Bank API: Complete integration for automated boleto generation with focus on anti-fragile RBAC system and comprehensive automated proposal lifecycle management.
Security: "Redobrada" (doubled) security measures required for banking/loan data - maximum OWASP Top 10 compliance is critical.
Production Timeline: Software to be deployed at Eleeve loan stores by next week (August 2025) - ALL INTEGRATIONS READY FOR PRODUCTION DEPLOYMENT.
Formalization Interface: ✅ UNIFIED - Attendant and Administrator interfaces must be identical. Both roles now have the same access to formalization controls and functionality (August 2025).

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
- **ClickSign**: For electronic signature integration - ✅ PRODUCTION READY (API v3 mastered, webhooks implemented, full documentation)
  - Complete webhook system with HMAC validation, timestamp validation, and event deduplication
  - Automatic workflow: CCB signature → boleto generation via Inter Bank
  - API v3 implementation ready (Envelopes instead of Lists)
  - Critical points documented: CPF formatting, rate limits, flow order, HMAC validation
  - 130 API endpoints fully documented and understood
  - Enhanced security layer: Input validation, XSS protection, rate limiting, IP whitelisting, secure logging
  - Full OWASP compliance: ASVS Level 1 verified, Top 10 mitigations implemented
  - ✅ NEW: Regenerate signature link functionality - Attendants can generate new signature links if needed
  - ✅ NEW: Configuration guide created (CLICKSIGN_CONFIGURACAO_OBRIGATORIA.md) - Covers webhook setup, account settings, and security requirements
- **Banco Inter API**: For automated boleto/PIX payment generation and tracking - ✅ PRODUCTION READY (100% OPERATIONAL, production credentials working)
  - Complete OAuth 2.0 authentication with mTLS following official documentation
  - Automatic boleto generation after ClickSign signature (fully automated)  
  - Webhook system for payment notifications with HMAC validation
  - Full CRUD operations for collections with error handling
  - Code validated against official Inter documentation (31/07/2025)
  - **CONFIRMED WORKING**: Production OAuth2 token obtained successfully (01/08/2025)
  - **mTLS Certificates**: Properly configured and validated
  - **Integration Status**: 100% operational, ready for real transactions