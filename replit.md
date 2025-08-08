# Simpix Credit Management System

## Overview
Simpix is a full-stack TypeScript application for comprehensive credit management. It streamlines the credit proposal workflow from creation and analysis to payment processing and formalization tracking. The project aims to provide a robust, secure, and user-friendly platform for financial institutions, focusing on banking-grade security, compliance, and efficient data management to become a leading solution in the credit management market.

## User Preferences
Preferred communication style: Simple, everyday language.
Focus: CCB template generation over UI visualization.
Language: Portuguese, studying software architecture.
Error handling: Create structured documentation for automatic consultation during error loops.

## Recent Changes (2025-08-08)
- ✅ **QUALITY GATE IMPLEMENTATION:** Professional-grade automated code quality control:
  - Installed Husky + lint-staged (industry standard)
  - Pre-commit hooks automatically run ESLint --fix and Prettier
  - Only modified files are checked (ultra-fast)
  - No separate process needed - runs automatically on git commit
  - Test with: `npx lint-staged` or `./scripts/test-quality-gate.sh`
- ✅ **CODE QUALITY REVOLUTION:** ESLint problems reduced from 3000+ to 634 (79% reduction):
  - Migrated from legacy .eslintrc.js to modern eslint.config.js (v9.x format)
  - Configured separate environments for client (browser) and server (Node.js)
  - Added missing globals (React, setTimeout, fetch, etc.)
  - Removed obsolete configuration files
  - Integrated Prettier for automatic formatting
  - Documentation at `/error_docs/ESLINT_3000_ERRORS_RESOLUTION.md`

## Recent Changes (2025-08-08 - Earlier)
- ✅ **NEW FEATURE:** Tela de Gestão de Contratos implementada com sucesso:
  - Backend: API `/api/contratos` com restrição RBAC (ADMIN/DIRETOR)
  - Frontend: Nova página em `/gestao/contratos` com tabela completa
  - Integração com Supabase Storage para visualização de CCBs assinados
  - Paginação, loading states e empty states implementados
  - TanStack Query para gerenciamento de estado
  - Item adicionado ao menu lateral para usuários autorizados
- ✅ **CRITICAL FIX:** Menu lateral responsivo implementado definitivamente:
  - Estado sidebarOpen com useState para controle de visibilidade
  - useEffect para fechar menu com tecla Escape
  - Botão hamburger mobile (lg:hidden) no header
  - Overlay com backdrop-blur-sm para UX adequada
  - Sidebar com transform/transition para animação suave
  - Links com onClick={handleNavClick} para fechar menu ao navegar
  - Documentação em `/error_docs/SIDEBAR_MENU_RESPONSIVE_FIX.md` para evitar reincidência

## Recent Changes (2025-08-07)
- ✅ **CRITICAL FIX:** CCB template conflict resolved - all routes now use `ccbGenerationService.ts` with pdf-lib
- ✅ Legacy services renamed: `ccbGenerator.ts.LEGADO_PDFKit`, `ccbTemplateGenerator.ts.LEGADO_v1`, etc.
- ✅ `clicksign-integration.ts` corrected to use template-based CCB generation (preserves logo/formatting)
- ✅ `/ccb-url` endpoint enhanced to always fetch latest version from storage
- ✅ Error Documentation System implemented in `/error_docs/`
- ✅ Storage error fixes: Admin client for Supabase Storage operations
- ✅ **BREAKTHROUGH:** Template file issue resolved - replaced 16KB generic with 564KB real Simpix template
- ✅ **COORDINATE MAPPING SYSTEM:** Implemented professional field positioning architecture:
  - `ccbFieldMapping.ts` - Pre-defined coordinates for all CCB fields
  - `ccbCoordinateMapper.ts` - Dynamic adjustment system with presets
  - `ccb-coordinate-test.ts` - Testing endpoints for iterative refinement
  - Template now displays with Simpix logo and properly positioned data fields
- ✅ **URL ROUTING FIX:** Resolved "Erro ao carregar status do CCB" caused by malformed API URLs:
  - Frontend now consistently uses `/api/formalizacao/{id}/ccb` endpoint
  - Fixed DocumentViewer to handle `ccb_gerado: false` state gracefully
  - Removed special character "✓" that caused pdf-lib encoding errors
  - Eliminated "[OBJECT] [OBJECT]" errors from URL parsing issues
- ✅ **COMPLETE FRONTEND IMPLEMENTATION:** All 30+ digitizable CCB fields now fully integrated:
  - PF/PJ toggle with conditional fields (Razão Social, CNPJ for companies)
  - Complete RG documentation (UF emission, emission date)
  - Detailed address fields (logradouro, número, complemento, bairro, cidade, UF)
  - PIX vs bank account payment tabs with full data capture
  - Local de nascimento field for complete personal data
  - ClientDataStep.tsx completely rewritten with validation
  - nova.tsx updated to map ALL new fields to database
  - Complete data flow established: Frontend Forms → Database → CCB PDF Generation

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query for server state, `useReducer` for complex local state
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful API
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Supabase Auth integration with JWT middleware and custom RBAC
- **File Storage**: Supabase Storage for document uploads
- **Server-Side Time Management**: Centralized timezone utilities for Brasília timezone consistency
- **Security**: Comprehensive security architecture including:
    - Helmet for security headers
    - Two-tier rate limiting
    - Input sanitization
    - Timing attack protection
    - Magic number validation and comprehensive file security validation for uploads
    - Cryptographically secure UUIDs for IDs
    - Soft delete implementation for financial compliance
    - Row Level Security (RLS) for multi-tenant data isolation and fine-grained access control
    - Automated security testing pipeline (SAST/DAST)
    - OWASP ASVS Level 1 compliance and SAMM v1.5 integration
    - Anti-fragile RBAC implementation
- **Credit Simulation**: Real-time credit simulation API using Tabela Price, IOF, TAC, and CET calculations, integrated with commercial tables.
- **Document Management**: Secure private bucket for document storage with signed URLs, organized folder structure, and multi-format support. Enhanced with admin client authentication and automatic fallback for missing files.
- **PDF Generation**: Template-based CCB generation using authentic Simpix template (564KB) with `pdf-lib` for precise field filling. **BREAKTHROUGH RESOLUTION:** Discovered and fixed critical template file issue (was using 16KB generic instead of real Simpix template). Includes professional coordinate mapping system for accurate field positioning, dynamic adjustment capabilities, and comprehensive testing framework.
- **Payment Workflow**: Complete payment queue system with batch processing, multiple payment methods, and formalization tracking integration.
- **Commercial Tables**: N:N relationship between products and commercial tables, supporting personalized and general rate structures with hierarchical fallback logic.

### Database Schema
- PostgreSQL with Drizzle ORM.
- Key tables: `users`, `propostas`, `parceiros`, `lojas`, `produtos`, `tabelas_comerciais`, `produto_tabela_comercial`, `comunicacao_logs`, `proposta_logs`, `parcelas`, `audit_delete_log`, `inter_collections`, `inter_webhooks`, `inter_callbacks`.
- `propostas` table includes detailed client data, loan conditions, formalization tracking, and status tracking.
- Soft deletes implemented using `deleted_at` columns.

## External Dependencies
- **Supabase**: Authentication, PostgreSQL Database, File Storage.
- **Drizzle ORM**: Type-safe ORM for PostgreSQL.
- **TanStack Query**: Server state management.
- **React Hook Form**: Form management.
- **Zod**: Schema validation.
- **Tailwind CSS**: Styling.
- **shadcn/ui**: React components.
- **Wouter**: React router.
- **Vite**: Build tool.
- **Express.js**: Backend framework.
- **postgres**: PostgreSQL client.
- **jwt-simple**: JWT token handling.
- **Helmet**: HTTP security headers.
- **express-rate-limit**: API rate limiting.
- **zxcvbn**: Password strength validation.
- **uuid**: Cryptographically secure UUIDs.
- **PDFKit**: Dynamic PDF generation.
- **OWASP ZAP**: Dynamic Application Security Testing (DAST).
- **Semgrep**: Static Application Security Testing (SAST).
- **OWASP Dependency-Check**: Software Composition Analysis (SCA).
- **ClickSign**: Electronic signature integration with HMAC validation, event deduplication, and automated workflow for CCB signature to boleto generation. Supports regenerating signature links.
- **Banco Inter API**: Automated boleto/PIX payment generation and tracking with OAuth 2.0 authentication (mTLS), and webhook system for payment notifications.
- **Error Documentation System**: Structured error documentation in `/error_docs/` with categorized .md files for automatic consultation during error loops. Includes tested solutions and prevention strategies.