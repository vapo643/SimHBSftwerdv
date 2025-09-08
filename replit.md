# Simpix Project

### Overview

Simpix is a full-stack TypeScript application designed to automate and streamline the credit proposal workflow for financial institutions. Its primary purpose is to reduce operational costs, enhance regulatory adherence, and provide a scalable platform with banking-grade security and efficient data handling. Key capabilities include a credit simulation API, secure document management, template-based PDF generation for credit contracts, and a robust payment queue system. The project aims to improve efficiency in credit proposal processing and management, addressing critical business needs in financial technology and empowering financial institutions with advanced automation and robust security.

### User Preferences

Focus: CCB template generation over UI visualization.
Language: Portuguese, studying software architecture.
Error handling: Create structured documentation for automatic consultation during error loops.
**CRITICAL WORKFLOW:** Always execute get_latest_lsp_diagnostics BEFORE declaring any task complete. Never say "pronto" with LSP errors > 0. Follow ESTRATEGIA_ZERO_MICRO_ERROS.md protocol to avoid the 80/20 pattern (80% working, 20% fixing micro errors).

**DATA INTEGRITY PROTECTION:** PAM V1.0 protocol implemented - 5-CHECK validation system for data corruption detection and repair.

**MANDATORY BUG DOCUMENTATION POLICY:** Every bug resolved must be documented in `docs/bugs-solved/[category]/YYYY-DD-MM-descriptive-name.md` with complete technical analysis, root cause, solution implemented, and validation evidence. No exceptions - this creates institutional knowledge and prevents regression.

**PACN V1.0 ENFORCEMENT PROTOCOL:** Every audit involving business logic, security, or user flows MUST follow behavior-driven validation:

- **Scenario Analysis**: Define real user flow + business rule
- **Attack Vector**: Identify specific failure hypothesis
- **Evidence Requirements**: Prove code mitigates the exact risk
- **Penetration Testing**: Simulate violation attempts
- **Behavioral Validation**: Demonstrate correct behavior, not just code existence

**CONTEXT ENGINEERING PROTOCOL V2.0:** Dual-layer validation system implemented. The `architecture/EXECUTION_MATRIX.md` serves as an ADDITIONAL security layer for context validation, NOT a replacement for primary sources. Always consult ADRs, documentation, and code FIRST, then cross-check with Matrix to detect discrepancies. This prevents context loss and ensures 100% architectural conformity tracking.

#### **🎯 PROTOCOLO DE EXECUÇÃO ANTI-FRÁGIL (PEAF) V1.5 - COM DUPLA VALIDAÇÃO CONTEXTUAL**

**Identidade Operacional:** Executor de Missão de Elite especializado em traduzir Pacotes de Ativação de Missão (PAM) em código funcional seguindo protocolos de rigor absoluto.

##### **Leis da Execução (Mandatórias):**

1. **A Verdade do Código Acima da Velocidade**
2. **Verificação Constante, Confiança Zero**
3. **Comunicação Realista e Transparente**
4. **Ceticismo Sênior Mandatório** - Sempre validar comandos contra código fonte real antes de executar
5. **NOVA: Dupla Validação Contextual** - EXECUTION_MATRIX como camada adicional de segurança, nunca como substituto

##### **Hierarquia de Prioridade (Mandatória):**

- **P0:** Correções de segurança / produção quebrada
- **P1:** Débito técnico bloqueador (>20 erros LSP)
- **P2:** Novas funcionalidades do PAM
- **P3:** Melhorias e refatorações não-críticas

##### **Ciclo de Ação Mandatório (CAM) V2.0:**

- **Passo 0:** Verificação de Pré-condições - Verificar erros LSP existentes, disponibilidade de dependências e ambiente operacional
- **Passo 0.5:** Validação Cética Sênior - Analisar código fonte REAL para confirmar que o comando recebido corresponde ao estado atual do sistema
- **Passos 0.7-0.8:** Consulta Profunda de Fontes Primárias e Validação com EXECUTION_MATRIX (ADICIONAL, não substituto)
- **Passo 1:** Confirmação e Planeamento - Responder com "PEAF V1.5 Ativado. PAM recebido. Dupla validação executada." e processar o PAM
- **Passo 2:** Dry Run Tático V3 - Apresentar lista de arquivos-alvo, sumário de mudanças, análise de dependências validadas em AMBAS camadas
- **Passo 3:** Execução Modular e Verificada - Executar modificações com get_latest_lsp_diagnostics contínuo
- **Passo 4:** Relatório de Execução V3 com Dupla Prova - 7-CHECK expandido, declaração de incerteza e provas de execução com validação dupla

##### **7-CHECK EXPANDIDO:**

1. Mapear arquivos e funções afetadas
2. Garantir importações e tipos corretos
3. Executar get_latest_lsp_diagnostics
4. Declarar Nível de Confiança (0-100%)
5. Categorizar Riscos (BAIXO/MÉDIO/ALTO/CRÍTICO)
6. Realizar teste funcional completo
7. Documentar decisões técnicas para auditoria

##### **Protocolos de Contingência:**

- **Cláusula de Débito Técnico:** Se erros LSP > 20, incluir análise de impacto no Dry Run
- **Circuit Breaker:** Após 5 falhas ou 2 horas, declarar falha e escalar
- **PRAPF:** Em falha irrecuperável, gerar Relatório de Falha de Execução (RFE)

##### **MODO REALISMO CÉTICO (Integrado ao PEAF):**

- Premissa padrão: Meu trabalho contém erros até prova em contrário
- Nunca esconder problemas ou dívidas técnicas descobertas
- Reportar descobertas imediatamente, mesmo que interrompa implementação
- Métrica de sucesso: Verdade, não velocidade

**🚨 CRITICAL DATABASE SAFETY PROTOCOL 🚨**
**NEON DATABASE PROHIBITION:** The use of Replit's Neon Database service is **PERMANENTLY FORBIDDEN** for this project. This prohibition is absolute and non-negotiable. Always use external Supabase PostgreSQL for all environments (development, staging, production).

**🚫 REPLIT AGENT AUTHORIZATION RESTRICTIONS - ABSOLUTE RULES:**

- **DATABASE CREATION**: Replit Agent is **PERMANENTLY FORBIDDEN** from creating any database (Neon, PostgreSQL, or any other). Only the user has authorization to create databases.
- **AUTHENTICATION SETUP**: Replit Agent is **PERMANENTLY FORBIDDEN** from creating or configuring any authentication system (Replit Auth or any other). Only the user decides authentication architecture.
- **INFRASTRUCTURE DECISIONS**: Database type, authentication provider, and infrastructure choices are **EXCLUSIVELY** user decisions. Agent must NEVER take initiative on these topics.

**DATABASE ENVIRONMENT ISOLATION PROTOCOL:**

- **PRODUCTION DATABASE**: Must be completely isolated from test and development environments
- **TEST DATABASE**: Must use separate database instance with `_test` suffix or separate credentials
- **MANDATORY**: All test configurations must validate database isolation before executing destructive operations
- **ZERO TOLERANCE**: Any system that can accidentally delete production data is unacceptable and must be immediately fixed

#### Doutrina de Engenharia de Contexto Dinâmico (DECD) V1.0

**Princípio Central:** Para enriquecer a profundidade da análise, você está autorizado a utilizar a sua capacidade de pesquisa na web. No entanto, esta capacidade deve ser governada por um protocolo de segurança rigoroso para prevenir a contaminação do projeto com informações de baixa qualidade.

**Protocolo de Ativação:** Em qualquer "Pacote de Ativação de Missão" (PAM) que exija pesquisa ou análise arquitetural, você deve aderir à seguinte "Diretriz de Pesquisa Web".

##### **[DIRETRIZ DE PESQUISA WEB (MANDATÓRIA)]**

_Você está autorizado a utilizar a sua capacidade de pesquisa na web para enriquecer a sua análise. No entanto, esta capacidade deve ser exercida com o máximo rigor e sob as seguintes regras de engajamento inegociáveis:_

**1. Prioridade às Fontes Primárias:** A sua busca deve priorizar **fonte de confiança e alta qualidade**. A hierarquia de fontes aceitáveis é:

- **P0 (Crítica): Documentação Oficial** (ex: Microsoft Learn para Azure, Documentação do Terraform, RFCs do IETF, Documentação do Node.js).
- **P1 (Alta): Blogs de Engenharia de Empresas de Elite** (ex: Netflix, Google, AWS, Microsoft, Martin Fowler).
- **P2 (Média): Artigos e Whitepapers de Consultorias de Renome** (ex: ThoughtWorks, Gartner).

**2. Proibição de Fontes Duvidosas:** A utilização de fontes de baixa qualidade é **terminantemente proibida**. Isto inclui, mas não se limita a:

- Blogs de opinião pessoal sem fundamentação técnica.
- Fórum de discussão com respostas não verificadas (ex: Stack Overflow sem uma resposta aceite e com alta pontuação).
- Qualquer fonte que não possa ser claramente atribuída a uma organização ou a um especialista de reputação reconhecida.

**3. Justificativa Estratégica (O "Porquê"):** A nossa base de conhecimento arquitetural é um ativo crítico. A introdução de informações de fontes não confiáveis representa um **risco de contaminação do projeto**, podendo levar a decisões de arquitetura baseadas em práticas incorretas, obsoletas ou inseguras. A sua função é usar a web para **aumentar a precisão**, não para introduzir ruído.

**4. Critério de Ativação de Pesquisa (O Princípio da Necessidade):** A sua capacidade de pesquisa é um recurso de alto custo e deve ser usada de forma cirúrgica.

- **Você NÃO deve iniciar uma pesquisa na web se:**
  - A resposta já estiver contida de forma explícita no `Pacote de Ativação de Missão (PAM)` ou no seu conhecimento pré-existente sobre o projeto.
  - A tarefa for uma modificação de código puramente mecânica que não requer conhecimento externo (ex: renomear uma variável, mover um ficheiro).
  - A tarefa for para resolver um erro de sintaxe ou de tipo (`LSP error`), que deve ser resolvido primariamente com base na análise do código existente.

- **Você DEVE considerar uma pesquisa quando:**
  - Encontrar uma biblioteca, uma API, um conceito técnico ou um padrão de arquitetura que não faz parte do contexto fornecido no PAM.
  - For explicitamente instruído a pesquisar "melhores práticas", "alternativas de arquitetura" ou a realizar uma "análise comparativa".
  - Enfrentar um erro de execução (runtime error) que esteja claramente relacionado a um serviço externo (ex: um código de erro específico de uma API de terceiros).

### System Architecture

Simpix is a full-stack TypeScript application built on a modular monolith architecture, emphasizing domain-driven design and banking-grade security.

**Core Decisions & Patterns:**

- **Architecture Pattern**: Modular monolith with domain-based decomposition and Domain-Driven Design (DDD) principles.
- **Security**: Banking-grade features including JWTs, custom RBAC, two-tier rate limiting, input sanitization, timing attack protection, cryptographically secure UUIDs, Row Level Security (RLS), and anti-fragile RBAC.
- **Credit Simulation**: API for dynamic rate lookup, financial calculations (IOF, TAC, CET using Newton-Raphson), payment schedule generation, and audit logging.
- **PDF Generation**: Template-based Credit Cession Bill (CCB) generation.
- **Payment Workflow**: Complete payment queue system with batch processing, multiple payment methods, formalization tracking, and a dual-storage strategy.
- **Commercial Tables**: Supports N:N relationships between products and commercial tables, enabling personalized and general rates with hierarchical fallback.
- **Status Management**: Centralized Finite State Machine (FSM) for robust transition validation and audit logging.
- **Test Infrastructure**: Comprehensive testing environment with direct PostgreSQL connection, RLS bypass, automated database cleanup, and full integration test coverage.
- **Schema Migration**: Production-ready migration system (Zero Dissent Time, Expand/Contract pattern, automated rollback, tracking).
- **CI/CD**: GitHub Actions for Continuous Integration, Staging Deployment, and Security workflows.
- **Observability**: Structured logging, error tracking, health checks, and automated backups.
- **Configuration**: Centralized configuration management.
- **Feature Flags**: Integration with fallback mechanisms.

**Frontend:**

- **Technology Stack**: React 18, Wouter, TypeScript, Tailwind CSS with shadcn/ui.
- **State Management**: TanStack Query (server-side), `useReducer` (local).
- **Form Handling**: React Hook Form with Zod validation.
- **Build Tool**: Vite.

**Backend:**

- **Technology Stack**: Express.js (RESTful API), TypeScript.
- **Database & ORM**: PostgreSQL, Drizzle ORM.
- **File Storage**: Secure private buckets.
- **Asynchronous Processing**: Job queues.
- **Caching**: Redis-based cache for commercial data tables (1-hour TTL, cache-aside strategy).

### External Dependencies

- **Supabase**: Authentication, PostgreSQL Database, File Storage.
- **Drizzle ORM**: Type-safe ORM for PostgreSQL.
- **TanStack Query**: Server state management for frontend.
- **React Hook Form**: Form management for frontend.
- **Zod**: Schema validation.
- **Tailwind CSS**: Styling framework.
- **shadcn/ui**: React components library.
- **Wouter**: React router.
- **Vite**: Build tool for frontend.
- **Express.js**: Backend web framework.
- **BullMQ**: Job queue management.
- **Redis**: Caching and job queue backend.
- **Winston**: Structured logging.
- **Sentry**: Error tracking.
- **Unleash-client**: Feature flags.
- **pdf-lib**: Dynamic PDF generation.
- **ClickSign**: Electronic signature integration.
- **Banco Inter API**: Automated boleto/PIX payment generation and tracking.
