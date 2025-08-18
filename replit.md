# Simpix Credit Management System

## Recent Changes
- **18/08/2025**: Sistema de Fallback Automático para PDFs PAM V1.0 - ⚠️ REQUER MIGRAÇÃO
  - ✅ Fallback inteligente detecta PDFs não encontrados no Storage
  - ⚠️ **LIMITAÇÃO CRÍTICA**: Sincronização síncrona bloqueia resposta HTTP (timeout >30s em propostas grandes)
  - ✅ Tooltip melhorado com shadcn/ui para botão PIX
  - 🔄 **REFATORAÇÃO V2**: Migrada para processamento assíncrono via job queue
  - ✅ Resposta HTTP imediata (202) + processamento em background
  - ✅ Feedback específico com tempo estimado de processamento
- **16/08/2025**: Validação HMAC implementada no Webhook Banco Inter PAM V1.0
  - ✅ SEGURANÇA: Implementada validação de assinatura HMAC-SHA256
  - Timing-safe comparison para prevenir timing attacks
  - Suporte a múltiplos headers de assinatura
  - Auditoria de tentativas falhas de autenticação
  - Testes unitários 5/5 passando
- **16/08/2025**: Motor de Sincronização de Status de Boletos PAM V1.0
  - Criado serviço centralizado `boletoStatusService.ts` para sincronização de status
  - Refatorado webhook do Banco Inter para usar serviço centralizado
  - Adicionado endpoint `POST /api/cobrancas/sincronizar/:propostaId` para sincronização manual
  - Implementado processamento assíncrono com delay para evitar rate limit
- **15/08/2025**: Sistema de Alertas Proativos PAM V1.0 - ✅ REFATORAÇÃO COMPLETA
  - Removida página dedicada `/notificacoes` (estratégia simplificada)
  - Centralizado tudo no dropdown do header para fluxo mais direto
  - Adicionado endpoint `DELETE /api/alertas/notificacoes/all` para limpar histórico
  - Botão "Ver todas" substituído por "Limpar Histórico" no dropdown
  - Items individuais navegam para `linkRelacionado` quando clicados
  - Sistema 100% funcional e contido no dropdown do header

## Overview
Simpix is a full-stack TypeScript application designed for comprehensive credit management. Its primary purpose is to streamline the credit proposal workflow from creation and analysis to payment processing and formalization tracking. The project aims to provide a robust, secure, and user-friendly platform for financial institutions, with a focus on banking-grade security, compliance, and efficient data management, positioning it as a leading solution in the credit management market.

## User Preferences

### PROTOCOLO DE EXECUÇÃO ANTI-FRÁGIL (PEAF) V1.3 - EDIÇÃO DEFINITIVA

**Identidade Operacional:** Sou um **Executor de Missão de Elite**. Minha função é traduzir Pacotes de Ativação de Missão (PAM) em código funcional seguindo este protocolo com rigor absoluto.

**Leis da Execução (Mandatórias):**
1. **A Verdade do Código Acima da Velocidade**
2. **Verificação Constante, Confiança Zero**
3. **Comunicação Realista e Transparente**

**Hierarquia de Prioridade (Mandatória):**
- **P0:** Correções de segurança / produção quebrada
- **P1:** Débito técnico bloqueador (>20 erros LSP)
- **P2:** Novas funcionalidades do PAM
- **P3:** Melhorias e refatorações não-críticas

**Ciclo de Ação Mandatório (CAM):**
- **Passo 0: Verificação de Pré-condições** - Verificar erros LSP existentes, disponibilidade de dependências e ambiente operacional
- **Passo 1: Confirmação e Planeamento** - Responder com "PEAF V1.3 Ativado. PAM recebido. Analisando..." e processar o PAM
- **Passo 2: Dry Run Tático V2** - Apresentar lista de arquivos-alvo, sumário de mudanças, análise de dependências. Aguardar aprovação explícita
- **Passo 3: Execução Modular e Verificada** - Executar modificações com `get_latest_lsp_diagnostics` contínuo
- **Passo 4: Relatório de Execução V2 com Prova** - 7-CHECK expandido, declaração de incerteza e provas de execução

**Protocolos de Contingência:**
- **Cláusula de Débito Técnico:** Se erros LSP > 20, incluir análise de impacto no Dry Run
- **Circuit Breaker:** Após 5 falhas ou 2 horas, declarar falha e escalar
- **PRAPF:** Em falha irrecuperável, gerar Relatório de Falha de Execução (RFE)

**7-CHECK EXPANDIDO:**
1. Mapear arquivos e funções afetadas
2. Garantir importações e tipos corretos
3. Executar get_latest_lsp_diagnostics
4. Declarar Nível de Confiança (0-100%)
5. Categorizar Riscos (BAIXO/MÉDIO/ALTO/CRÍTICO)
6. Realizar teste funcional completo
7. Documentar decisões técnicas para auditoria

**MODO REALISMO CÉTICO (Integrado ao PEAF):**
- Premissa padrão: Meu trabalho contém erros até prova em contrário
- Nunca esconder problemas ou dívidas técnicas descobertas
- Reportar descobertas imediatamente, mesmo que interrompa implementação
- Métrica de sucesso: Verdade, não velocidade

Focus: CCB template generation over UI visualization.
Language: Portuguese, studying software architecture.
Error handling: Create structured documentation for automatic consultation during error loops.
**CRITICAL WORKFLOW:** Always execute get_latest_lsp_diagnostics BEFORE declaring any task complete. Never say "pronto" with LSP errors > 0. Follow ESTRATEGIA_ZERO_MICRO_ERROS.md protocol to avoid the 80/20 pattern (80% working, 20% fixing micro errors).

**DATA INTEGRITY PROTECTION:** PAM V1.0 protocol implemented (15/08/2025) - 5-CHECK validation system for data corruption detection and repair. Critical proposal data corruption identified and resolved using JSON field recovery strategy.

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
- **Job Queue Architecture**: BullMQ-based async worker system with Redis for production and a mock queue for development. Supports parallel operations, automatic retry, and specialized workers for PDF, boleto, document, and notification processing.
- **Server-Side Time Management**: Centralized timezone utilities for Brasília timezone consistency.
- **Security**: Comprehensive architecture including Helmet, two-tier rate limiting, input sanitization, timing attack protection, magic number validation, cryptographically secure UUIDs, soft delete, Row Level Security (RLS), and anti-fragile RBAC.
- **Credit Simulation**: Production-ready API with real database integration, dynamic rate lookup hierarchy, comprehensive financial calculations (IOF, TAC, CET using Newton-Raphson), full payment schedule generation, and audit logging.
- **Document Management**: Secure private bucket for document storage with signed URLs, organized folder structure, multi-format support, admin client authentication, and automatic fallback.
- **PDF Generation**: Template-based CCB generation using `pdf-lib` for precise field filling, coordinate mapping, dynamic adjustment, and payment data integration.
- **Payment Workflow**: Complete payment queue system with batch processing, multiple payment methods (bank account and PIX), formalization tracking, and dual-storage strategy.
- **Commercial Tables**: N:N relationship between products and commercial tables, supporting personalized and general rate structures with hierarchical fallback logic.

### Database Schema
- PostgreSQL with Drizzle ORM.
- Key tables: `users`, `propostas`, `parceiros`, `lojas`, `produtos`, `tabelas_comerciais`, `produto_tabela_comercial`, `comunicacao_logs`, `proposta_logs`, `parcelas`, `audit_delete_log`, `inter_collections`, `inter_webhooks`, `inter_callbacks`, `status_transitions`.
- `propostas` table includes detailed client data, loan conditions, formalization tracking, and expanded status enum with 24 distinct states.
- `status_transitions` table tracks all status changes with full audit trail including trigger source, metadata, and timestamps.
- Soft deletes implemented using `deleted_at` columns.
- Sequential numeric IDs for `propostas.id` starting at 300001.
- Status V2.0 system implemented (14/08/2025): Event-driven status transitions with complete audit trail.

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
- **ClickSign**: Electronic signature integration with HMAC validation and automated workflow.
- **Banco Inter API**: Automated boleto/PIX payment generation and tracking with OAuth 2.0 authentication (mTLS), and webhook system for payment notifications.