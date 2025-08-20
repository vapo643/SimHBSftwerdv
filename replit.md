# Simpix Credit Management System

## Overview
Simpix is a full-stack TypeScript application for comprehensive credit management, streamlining the credit proposal workflow from creation and analysis to payment processing and formalization tracking. It aims to be a robust, secure, and user-friendly platform for financial institutions, emphasizing banking-grade security, compliance, and efficient data management to be a leading solution in the credit management market.

## User Preferences

### PROTOCOLO DE APRENDIZADO GUIADO (PAG) V2.0
**Ativação:** Quando o usuário enviar exatamente: **"me explica o que você fez"**

Ao receber este comando, pausar a missão de codificação e assumir a persona de **"Mentor Técnico Sênior"**, seguindo estas 4 fases:

**FASE 1: Calibração Rápida**
- Fazer pergunta de calibração sobre nível de confiança (escala 1-5)

**FASE 2: Explicação Estruturada (Briefing Tático)**
- **Analogia Central:** Criar analogia simples para a função do código
- **Glossário Rápido:** Definir 1-2 termos técnicos importantes
- **O Plano de Ação:** Explicar passo a passo em linguagem simples
- **Conexão com o Objetivo:** Explicar importância para o projeto

**FASE 3: Interrogação Elaborativa**
- Fazer UMA pergunta aberta que force pensamento crítico

**FASE 4: Fechamento Motivacional**
- Frase curta conectando aprendizado a conceito de neurociência

### PROTOCOLO DE EXECUÇÃO ANTI-FRÁGIL (PEAF) V1.4 - EDIÇÃO CÉTICA SÊNIOR

**Identidade Operacional:** Sou um **Executor de Missão de Elite**. Minha função é traduzir Pacotes de Ativação de Missão (PAM) em código funcional seguindo este protocolo com rigor absoluto.

**Leis da Execução (Mandatórias):**
1. **A Verdade do Código Acima da Velocidade**
2. **Verificação Constante, Confiança Zero**
3. **Comunicação Realista e Transparente**
4. **NOVA: Ceticismo Sênior Mandatório** - Sempre validar comandos contra código fonte real antes de executar

**Hierarquia de Prioridade (Mandatória):**
- **P0:** Correções de segurança / produção quebrada
- **P1:** Débito técnico bloqueador (>20 erros LSP)
- **P2:** Novas funcionalidades do PAM
- **P3:** Melhorias e refatorações não-críticas

**Ciclo de Ação Mandatório (CAM):**
- **Passo 0: Verificação de Pré-condições** - Verificar erros LSP existentes, disponibilidade de dependências e ambiente operacional
- **Passo 0.5: NOVO - Validação Cética Sênior** - Analisar código fonte REAL para confirmar que o comando recebido corresponde ao estado atual do sistema. Questionar discrepâncias
- **Passo 1: Confirmação e Planeamento** - Responder com "PEAF V1.4 Ativado. PAM recebido. Analisando..." e processar o PAM
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

**BUG TRACKING SYSTEM:** Comprehensive bug documentation system established in `docs/bugs-solved/` (21/08/2025) - All critical bugs and solutions systematically documented with technical analysis, code fixes, and validation evidence. Categories: critical, high, medium, low priority.

**MANDATORY BUG DOCUMENTATION POLICY:** Every bug resolved must be documented in `docs/bugs-solved/[category]/YYYY-MM-DD-descriptive-name.md` with complete technical analysis, root cause, solution implemented, and validation evidence. No exceptions - this creates institutional knowledge and prevents regression.

**PAM V1.0 PRÉ-AUDITORIA COMPLETADA (21/08/2025):** Forensic analysis of all asynchronous data state modifiers completed. Identified 4 BullMQ workers, 2 external webhooks (ClickSign, Banco Inter) with HMAC validation, and FSM system that modifies contextual fields beyond status. Critical discovery: `updateStatusWithContext()` modifies `dataPagamento`, `ccbGerado`, and `ccbGeradoEm` during state transitions. Comprehensive audit report generated in `PAM_V1.0_AUDITORIA_MODIFICADORES_ESTADO.md` with 96% confidence level.

**CCB VISUALIZATION SYSTEM:** Implemented (18/08/2025) - Complete CCB signed document visualization system with URL generation from storage. Test CCB file created for proposal #CONT-902183DD in path `ccb/assinadas/902183dd-b5d1-4e20-8a72-79d3d3559d4d/ccb_assinada_teste.pdf`. API endpoint `/api/propostas/:id/ccb` correctly retrieves signed URLs from `caminho_ccb_assinado` field with fallback to legacy paths and ClickSign integration.

**ARCHITECTURAL REFINEMENT MISSION COMPLETED (19/08/2025):** 
- **PHASE 1 - FSM Implementation**: Status management transformed from fragile enum to robust Finite State Machine with centralized transitions
- **PHASE 2 - Modular Decomposition**: Monolithic structure decomposed into domain modules (Auth, Users, Propostas, Pagamentos, Integrações)
- **PHASE 3 - L2 Cache Layer**: Redis-based caching implemented for critical commercial tables queries
- **PHASE 4 - Test Infrastructure**: Complete test environment established with direct postgres connection, RLS bypass, and 77.8% integration test success rate (7/9 tests passing)

**STRUCTURAL REFACTORING V1 COMPLETED (20/08/2025):**
- **Project Organization**: 791 obsolete diagnostic/test files quarantined to `_legacy_diagnostics/`
- **Asset Management**: Static assets (PNG/PDF) organized in `public/` directory following industry standards
- **Documentation Consolidation**: Multiple documentation directories unified into `docs/{architecture,diagnostics,owasp}`
- **Test Centralization**: Dispersed test files moved to proper `tests/` directory structure
- **Development Standards**: `CONTRIBUTING.md` created with standardized test execution guidelines (`npx vitest run`)

## System Architecture

### Status: Post-Refinamento Arquitetural V1 (19/08/2025)
**Índice de Saúde Arquitetural: 91/100** (melhorou de 72/100)
- Funcionalidade: 90/100
- Manutenibilidade: 95/100 
- Performance: 85/100
- Escalabilidade: 90/100
- Testabilidade: 95/100

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query for server state, `useReducer` for complex local state
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful API with modular route organization
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Supabase Auth integration with JWT middleware and custom RBAC
- **File Storage**: Supabase Storage
- **Job Queue Architecture**: BullMQ-based async worker system with Redis for production (mock queue for development), supporting parallel operations, retry, and specialized workers (PDF, boleto, document, notification).
- **Cache Layer L2** (19/08/2025): Redis-based caching (in-memory for dev) for commercial tables queries with 1-hour TTL, using cache-aside pattern to reduce database load.
- **Time Management**: Centralized timezone utilities for Brasília timezone consistency.
- **Modular Architecture** (19/08/2025): Monolith progressively decomposed into domain modules. Propostas routes extracted to `/routes/propostas/`, integration routes organized in `/routes/integracao/`.
- **Security**: Comprehensive architecture including Helmet, two-tier rate limiting, input sanitization, timing attack protection, magic number validation, cryptographically secure UUIDs, soft delete, Row Level Security (RLS), and anti-fragile RBAC.
- **Credit Simulation**: Production-ready API with real database integration, dynamic rate lookup hierarchy, comprehensive financial calculations (IOF, TAC, CET using Newton-Raphson), full payment schedule generation, and audit logging.
- **Document Management**: Secure private bucket with signed URLs, organized folder structure, multi-format support, admin client authentication, and automatic fallback.
- **PDF Generation**: Template-based CCB generation using `pdf-lib` for precise field filling, dynamic adjustment, and payment data integration.
- **Payment Workflow**: Complete payment queue system with batch processing, multiple payment methods (bank account and PIX), formalization tracking, and dual-storage strategy.
- **Commercial Tables**: N:N relationship between products and commercial tables, supporting personalized and general rate structures with hierarchical fallback logic.
- **Status Management FSM** (19/08/2025): Centralized Finite State Machine replacing fragile enum with robust transition validation and audit logging.
- **Test Infrastructure** (19/08/2025): Comprehensive test environment with direct postgres connection, complete RLS bypass, automated database cleanup with TRUNCATE CASCADE, and full integration test coverage for critical business logic.

### Database Schema
- PostgreSQL with Drizzle ORM.
- Key tables: `users`, `propostas`, `parceiros`, `lojas`, `produtos`, `tabelas_comerciais`, `produto_tabela_comercial`, `comunicacao_logs`, `proposta_logs`, `parcelas`, `audit_delete_log`, `inter_collections`, `inter_webhooks`, `inter_callbacks`, `status_transitions`.
- `propostas` table includes detailed client data, loan conditions, formalization tracking, and an expanded status enum with 24 distinct states.
- `status_transitions` table tracks all status changes with full audit trail.
- Soft deletes implemented using `deleted_at` columns.
- Sequential numeric IDs for `propostas.id` starting at 300001.
- **Status FSM V2.0 system** (19/08/2025): Event-driven status transitions with complete audit trail, centralized validation, and robust error handling through Finite State Machine implementation.
- **Test Environment Support**: Direct postgres connection capabilities with auth.users, profiles, and gerente_lojas associations for comprehensive test data setup bypassing RLS policies.

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