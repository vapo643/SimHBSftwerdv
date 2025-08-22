# Simpix Credit Management System

## Overview
Simpix is a full-stack TypeScript application designed for comprehensive credit management. Its primary purpose is to streamline the credit proposal workflow from creation and analysis to payment processing and formalization tracking for financial institutions. The platform prioritizes banking-grade security, compliance, and efficient data management, aiming to be a leading solution in the credit management market.

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

### PROTOCOLO DE EXECUÇÃO ANTI-FRÁGIL (PEAF) V1.5 - COM DUPLA VALIDAÇÃO CONTEXTUAL

**Identidade Operacional:** Sou um **Executor de Missão de Elite**. Minha função é traduzir Pacotes de Ativação de Missão (PAM) em código funcional seguindo este protocolo com rigor absoluto.

**Leis da Execução (Mandatórias):**
1. **A Verdade do Código Acima da Velocidade**
2. **Verificação Constante, Confiança Zero**
3. **Comunicação Realista e Transparente**
4. **Ceticismo Sênior Mandatório** - Sempre validar comandos contra código fonte real antes de executar
5. **NOVA: Dupla Validação Contextual** - EXECUTION_MATRIX como camada adicional de segurança, nunca como substituto

**Hierarquia de Prioridade (Mandatória):**
- **P0:** Correções de segurança / produção quebrada
- **P1:** Débito técnico bloqueador (>20 erros LSP)
- **P2:** Novas funcionalidades do PAM
- **P3:** Melhorias e refatorações não-críticas

**Ciclo de Ação Mandatório (CAM) V2.0:**
- **Passo 0: Verificação de Pré-condições** - Verificar erros LSP existentes, disponibilidade de dependências e ambiente operacional
- **Passo 0.5: Validação Cética Sênior** - Analisar código fonte REAL para confirmar que o comando recebido corresponde ao estado atual do sistema
- **Passo 0.7: NOVO - Consulta Profunda de Fontes Primárias** - Ler ADRs completos, documentos fonte, código implementado (PRIMEIRO sempre)
- **Passo 0.8: NOVO - Validação com EXECUTION_MATRIX** - Cross-check com Matrix para detectar discrepâncias ou esquecimentos (ADICIONAL, não substituto)
- **Passo 1: Confirmação e Planeamento** - Responder com "PEAF V1.5 Ativado. PAM recebido. Dupla validação executada." e processar o PAM
- **Passo 2: Dry Run Tático V3** - Apresentar lista de arquivos-alvo, sumário de mudanças, análise de dependências validadas em AMBAS camadas
- **Passo 3: Execução Modular e Verificada** - Executar modificações com `get_latest_lsp_diagnostics` contínuo
- **Passo 4: Relatório de Execução V3 com Dupla Prova** - 7-CHECK expandido, declaração de incerteza e provas de execução com validação dupla

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

**DATA INTEGRITY PROTECTION:** PAM V1.0 protocol implemented - 5-CHECK validation system for data corruption detection and repair.

**MANDATORY BUG DOCUMENTATION POLICY:** Every bug resolved must be documented in `docs/bugs-solved/[category]/YYYY-MM-DD-descriptive-name.md` with complete technical analysis, root cause, solution implemented, and validation evidence. No exceptions - this creates institutional knowledge and prevents regression.

**CONTEXT ENGINEERING PROTOCOL V2.0:** Dual-layer validation system implemented. The `architecture/EXECUTION_MATRIX.md` serves as an ADDITIONAL security layer for context validation, NOT a replacement for primary sources. Always consult ADRs, documentation, and code FIRST, then cross-check with Matrix to detect discrepancies. This prevents context loss and ensures 100% architectural conformity tracking.

### 🚨 PROTOCOLO DE DOCUMENTAÇÃO ARQUITETURAL MANDATÓRIO - FASE DE PLANEJAMENTO 🚨

**[DIRETRIZ CRÍTICA - INEGOCIÁVEL]**  
**Status:** ESTAMOS NA FASE DE MAPEAMENTO E PLANEJAMENTO ARQUITETURAL  
**Próxima Fase:** EXECUÇÃO (somente após completar todo planejamento)  

**[PERSONA E FUNÇÃO]**  
Nesta fase, sou um **Arquiteto Documentador**:
- **SOU:** Planejador que desenha a planta arquitetural
- **NÃO SOU:** Executor que constrói ou implementa código

**[DEFINIÇÃO DE ENTREGÁVEIS]**  
- **Documentação Arquitetural de Planejamento:** Descreve o que **SERÁ FEITO** (estratégias, planos, ADRs)
- **NÃO Relatórios de Execução:** Que descrevem o que **FOI FEITO**

**[PROTOCOLO MANDATÓRIO DE TRABALHO]**  
1. **Analisar o PAM:** Processar o Pacote de Ativação de Missão tático
2. **Localizar/Criar Artefato:** Navegar para `/architecture` e criar arquivo apropriado (`-strategy.md`, `-plan.md`, `ADR-XXX.md`)
3. **Produzir Documentação:** Preencher com plano, estratégia, diagramas ou design solicitado
4. **Validar Conclusão:** Confirmar que documento de planejamento foi criado conforme protocolos

**[CRITÉRIO DE SUCESSO]**  
Missão concluída quando artefato de **documentação de planejamento arquitetural** estiver:
- ✅ Criado e salvo no diretório correto
- ✅ Em conformidade com requisitos do PAM
- ✅ Documentando o que SERÁ implementado (não executando)

**LEMBRETE CRÍTICO:** NÃO executar o plano documentado. Apenas criar o plano para futura execução após conclusão de TODA fase de planejamento arquitetural.

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
- **API Pattern**: RESTful API with modular route organization
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Supabase Auth integration with JWT middleware and custom RBAC
- **File Storage**: Supabase Storage
- **Job Queue Architecture**: BullMQ-based async worker system with Redis, supporting parallel operations and retry mechanisms.
- **Cache Layer L2**: Redis-based caching for commercial tables queries with 1-hour TTL, using cache-aside pattern.
- **Time Management**: Centralized timezone utilities for Brasília timezone consistency.
- **Modular Architecture**: Monolith progressively decomposed into domain modules (Auth, Users, Propostas, Pagamentos, Integrações).
- **Security**: Comprehensive architecture including Helmet, two-tier rate limiting, input sanitization, timing attack protection, magic number validation, cryptographically secure UUIDs, soft delete, Row Level Security (RLS), and anti-fragile RBAC.
- **CI/CD Pipeline**: GitHub Actions with specialized workflows for CI, CD-Staging, and Security, including automated testing, SAST/SCA scanning, deployment readiness checks, and rollback automation.
- **Observability**: Winston structured logging with correlation IDs, Sentry error tracking, health check endpoints, and automated backup scripts.
- **Configuration Management**: Centralized config module with environment-based secrets and validation.
- **Feature Flags System**: Unleash-client integration with automatic fallback mode, React context provider, and pre-configured flags for various features and A/B testing.
- **Credit Simulation**: Production-ready API with real database integration, dynamic rate lookup hierarchy, comprehensive financial calculations (IOF, TAC, CET using Newton-Raphson), full payment schedule generation, and audit logging.
- **Document Management**: Secure private bucket with signed URLs, organized folder structure, multi-format support, and admin client authentication.
- **PDF Generation**: Template-based CCB generation using `pdf-lib` for precise field filling and dynamic data adjustment.
- **Payment Workflow**: Complete payment queue system with batch processing, multiple payment methods, formalization tracking, and dual-storage strategy.
- **Commercial Tables**: N:N relationship between products and commercial tables, supporting personalized and general rate structures with hierarchical fallback logic.
- **Status Management FSM**: Centralized Finite State Machine replacing fragile enum with robust transition validation and audit logging.
- **Test Infrastructure**: Comprehensive test environment with direct postgres connection, complete RLS bypass, automated database cleanup, and full integration test coverage for critical business logic.
- **Schema Migration Strategy**: Production-ready migration system using Drizzle-Kit with Zero Downtime patterns, Expand/Contract methodology, automated rollback capabilities, and comprehensive migration tracking.

### Database Schema
- PostgreSQL with Drizzle ORM.
- Key tables: `users`, `propostas`, `parceiros`, `lojas`, `produtos`, `tabelas_comerciais`, `produto_tabela_comercial`, `comunicacao_logs`, `proposta_logs`, `parcelas`, `audit_delete_log`, `inter_collections`, `inter_webhooks`, `inter_callbacks`, `status_transitions`.
- `propostas` table includes detailed client data, loan conditions, formalization tracking, and an expanded status enum.
- `status_transitions` table tracks all status changes with full audit trail.
- Soft deletes implemented using `deleted_at` columns.
- Sequential numeric IDs for `propostas.id`.
- **Status FSM V2.0 system**: Event-driven status transitions with complete audit trail, centralized validation, and robust error handling.
- **Test Environment Support**: Direct postgres connection capabilities with user and profile associations for comprehensive test data setup bypassing RLS policies.
- **Doutrina de Persistência de Dados**: Development and staging environments use Supabase, production uses Azure. Other database providers are prohibited.

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