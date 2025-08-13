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
- **✅ Inter Boleto PDF Download Bug COMPLETELY RESOLVED (12/08/2025)**: Fixed critical 30+ day issue where PDF downloads failed. Root cause: API v3 returns PDF as base64 string inside JSON field "pdf" instead of binary PDF. Implemented smart parser that detects base64 in multiple possible fields, validates PDF magic bytes, and converts to proper Buffer. System now successfully downloads 41KB PDFs from 55KB base64 JSON responses.
- **✅ ZIP Batch Download System IMPLEMENTED (12/08/2025)**: Created `/baixar-todos-boletos` endpoint that generates ZIP with all proposal boletos. Frontend button changed to "Baixar todos os boletos para impressão" for optimized attendant workflow - single click downloads all parcels.
- **⚠️ MCAFEE ANTIVIRUS CHALLENGE RESOLVED (13/08/2025)**: After implementing 4 complete technical solutions (6-layer sanitization, container secure, PDF-to-image conversion, alternative formats including PNG/Word/CSV/HTML), ALL were detected as viruses by McAfee. **FINAL CONCLUSION**: Problem is McAfee configuration, not file content - even pure PNG images detected as viruses. **SOLUTION IMPLEMENTED**: "APENAS CÓDIGOS" system - displays all payment codes (barcode, PIX) in modal without any downloads. System now works 100% regardless of antivirus configuration. Critical learning: not all problems are technical - sometimes user environment is the constraint.

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