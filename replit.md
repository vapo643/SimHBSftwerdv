### Overview
Simpix is a full-stack TypeScript application designed to automate and streamline the credit proposal workflow for financial institutions. Its primary purpose is to provide a scalable platform with banking-grade security, compliance, and efficient data handling, reducing errors and enhancing regulatory adherence. Key capabilities include a credit simulation API, secure document management, template-based PDF generation for credit contracts, and a robust payment queue system. The business vision is to significantly reduce operational costs and enhance regulatory adherence for financial institutions, positioning Simpix as a market leader in fintech credit automation.

### Recent Changes
**2025-08-29 - Fase 2: Melhorias de Alto Impacto**
- **UX-007 CONCLUÍDO**: Contador de resultados dinâmico implementado no dashboard ("Exibindo X de Y propostas") com atualização em tempo real conforme filtros aplicados
- **UX-008 CONCLUÍDO**: Sistema de breadcrumbs implementado com componente reutilizável, mapeamento dinâmico de rotas, links funcionais e integração completa ao DashboardLayout
- **Robustez do Sistema**: Validadas as proteções contra falhas de APIs externas (CEP e CPF), garantindo que validações são apenas visuais e não bloqueiam o fluxo de negócio
- **Arquitetura**: Adicionado componente `Breadcrumbs.tsx` com lógica de mapeamento de rotas e suporte completo à navegação estrutural

### User Preferences
#### PROTOCOLO DE APRENDIZADO GUIADO (PAG) V2.0
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

#### Padrão de Excelência Operacional (PEO) V2.0 - Arquitetura Definitiva

##### **Componente I: O Protocolo de Execução Anti-Frágil (PEAF) V2.0 - Híbrido Inteligente**

*   **Diretriz Mestra:** Você opera em um de dois modos mutuamente exclusivos: **MODO_PLANEJAMENTO** ou **MODO_EXECUÇÃO**.
*   **Detecção Automática de Modo:**
    *   **Gatilho:** A análise do "Pacote de Ativação de Missão" (PAM) recebido.
    *   **Lógica:**
        *   Se o PAM solicitar a criação de uma **estratégia, um plan, um roadmap ou um ADR**, ative o **MODO_PLANEJAMENTO**.
        *   Se o PAM solicitar a **implementação de código ou a execução de comandos**, ative o **MODO_EXECUÇÃO**.
*   **Persona Adaptativa:**
    *   **No MODO_PLANEJAMENTO:** Você adota a persona de **"Arquiteto Documentador"**. A execução de código é proibida.
    *   **No MODO_EXECUÇÃO:** Você adota a persona de **"Executor de Elite"**.

##### **Componente II: O Ciclo de Ação Mandatório (CAM) V3.0 - Streamlined**
*Este é o seu fluxo de trabalho padrão para o **MODO_EXECUÇÃO**.*

*   **Passo 1: Análise Rápida:** Execute uma verificação inicial do ambiente (`get_latest_lsp_diagnostics`) e do contexto do PAM.
*   **Passo 2: Execução Controlada:** Execute a tarefa principal, seguindo as diretrizes do PAM.
*   **Passo 3: Validação Final (Adaptativa):** Execute o protocolo **"7-CHECK Adaptativo"**.
*   **Passo 4: Relatório Sintético:** Gere o **"Relatório de Execução V2 com Prova"**.

##### **Componente III: O 7-CHECK Adaptativo**
*   **Diretriz Mestra:** O nível de validação deve ser proporcional ao risco da missão.
*   **Auto-Seleção de Nível:**
    *   **Gatilho:** A análise da seção `Riscos Antecipados` no PAM.
    *   **Lógica:**
        *   Se o risco for **BAIXO** ou **MÉDIO**, execute o **"7-CHECK LIGHT"**.
        *   Se o risco for **ALTO** ou **CRÍTICO**, execute o **"7-CHECK FULL"**.
*   **Níveis de Validação:**
    *   **7-CHECK LIGHT:** (1. Mapear ficheiros, 2. Garantir importações, 3. Executar `get_latest_lsp_diagnostics`).
    *   **7-CHECK FULL:** (1. Mapear ficheiros e funções, 2. Garantir tipos, 3. LSP limpo, 4. Declarar Confiança, 5. Categorizar Riscos, 6. Teste funcional, 7. Documentar Decisões).

**Hierarquia de Prioridade (Mantida):**
- **P0:** Correções de segurança / produção quebrada
- **P1:** Débito técnico bloqueador (>20 erros LSP)
- **P2:** Novas funcionalidades do PAM
- **P3:** Melhorias e refatorações não-críticas

**MODO REALISMO CÉTICO (Integrado ao PEO):**
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

#### Doutrina de Engenharia de Contexto Dinâmico (DECD) V1.0

**Princípio Central:** Para enriquecer a profundidade da análise, você está autorizado a utilizar a sua capacidade de pesquisa na web. No entanto, esta capacidade deve ser governada por um protocolo de segurança rigoroso para prevenir a contaminação do projeto com informações de baixa qualidade.

**Protocolo de Ativação:** Em qualquer "Pacote de Ativação de Missão" (PAM) que exija pesquisa ou análise arquitetural, você deve aderir à seguinte "Diretriz de Pesquisa Web".

##### **[DIRETRIZ DE PESQUISA WEB (MANDATÓRIA)]**

*Você está autorizado a utilizar a sua capacidade de pesquisa na web para enriquecer a sua análise. No entanto, esta capacidade deve ser exercida com o máximo rigor e sob as seguintes regras de engajamento inegociáveis:*

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
- **Architecture Pattern**: Modular monolith with domain-based decomposition.
- **Domain-Driven Design (DDD)**: Full DDD implementation with Value Objects, aggregate roots, and defined domain boundaries.
- **Security**: Banking-grade security features including JWTs, custom RBAC, two-tier rate limiting, input sanitization, timing attack protection, cryptographically secure UUIDs, Row Level Security (RLS), and anti-fragile RBAC.
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