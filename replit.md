# Simpix Credit Management System

## Overview
Simpix is a full-stack TypeScript application for comprehensive credit management, streamlining the credit proposal workflow from creation and analysis to payment processing and formalization tracking. It aims to provide a robust, secure, and user-friendly platform for financial institutions, focusing on banking-grade security, compliance, and efficient data management to become a leading solution in the credit management market.

## User Preferences
Preferred communication style: Simple, everyday language.
Focus: CCB template generation over UI visualization.
Language: Portuguese, studying software architecture.
Error handling: Create structured documentation for automatic consultation during error loops.
**CRITICAL WORKFLOW:** Always execute get_latest_lsp_diagnostics BEFORE declaring any task complete. Never say "pronto" with LSP errors > 0. Follow ESTRATEGIA_ZERO_MICRO_ERROS.md protocol to avoid the 80/20 pattern (80% working, 20% fixing micro errors).

## Recent Major Fixes (August 2025)
- **✅ Inter Boleto PDF Download Bug RESOLVED**: Fixed critical issue where all boletos had invalid "CORRETO-" prefixed codes instead of Inter API UUIDs. Created regeneration system that replaced 24 invalid boletos with valid UUID codes, restoring full PDF download functionality. System now processes downloads correctly with HTTP 200 responses.

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
- **Security**: Comprehensive security architecture including Helmet, two-tier rate limiting, input sanitization, timing attack protection, magic number validation, cryptographically secure UUIDs for IDs, soft delete implementation, Row Level Security (RLS), automated security testing (SAST/DAST), OWASP ASVS Level 1 compliance, SAMM v1.5 integration, and anti-fragile RBAC implementation.
- **Credit Simulation**: Production-ready credit simulation API with real database integration, dynamic rate lookup hierarchy (Partner → Product → Default), comprehensive financial calculations (IOF, TAC, CET using Newton-Raphson method), full payment schedule generation, and detailed audit logging for regulatory compliance.
- **Document Management**: Secure private bucket for document storage with signed URLs, organized folder structure, multi-format support, admin client authentication, and automatic fallback for missing files.
- **PDF Generation**: Template-based CCB generation using authentic Simpix template (564KB) with `pdf-lib` for precise field filling, professional coordinate mapping, dynamic adjustment capabilities, comprehensive testing framework, and complete payment data integration.
- **Payment Workflow**: Complete payment queue system with batch processing, multiple payment methods (bank account and PIX), formalization tracking integration, and dual-storage strategy for payment data (dedicated columns + JSON fallback).
- **Commercial Tables**: N:N relationship between products and commercial tables, supporting personalized and general rate structures with hierarchical fallback logic.

### Database Schema
- PostgreSQL with Drizzle ORM.
- Key tables: `users`, `propostas`, `parceiros`, `lojas`, `produtos`, `tabelas_comerciais`, `produto_tabela_comercial`, `comunicacao_logs`, `proposta_logs`, `parcelas`, `audit_delete_log`, `inter_collections`, `inter_webhooks`, `inter_callbacks`.
- `propostas` table includes detailed client data, loan conditions, formalization tracking, and status tracking.
- Soft deletes implemented using `deleted_at` columns.
- Sequential numeric IDs for `propostas.id` starting at 300001.

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
- **pdf-lib**: Dynamic PDF generation.
- **OWASP ZAP**: Dynamic Application Security Testing (DAST).
- **Semgrep**: Static Application Security Testing (SAST).
- **OWASP Dependency-Check**: Software Composition Analysis (SCA).
- **ClickSign**: Electronic signature integration with HMAC validation, event deduplication, and automated workflow for CCB signature to boleto generation.
- **Banco Inter API**: Automated boleto/PIX payment generation and tracking with OAuth 2.0 authentication (mTLS), and webhook system for payment notifications.
- **Error Documentation System**: Structured error documentation in `/error_docs/` for automatic consultation.