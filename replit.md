# Replit.md - Simpix Credit Management System

## Overview

This is a full-stack TypeScript application for credit management called "Simpix". It provides a complete workflow for credit proposals, from creation through analysis to payment processing and formalization tracking. The application follows a modern web architecture with a React frontend, Express.js backend, and PostgreSQL database using Drizzle ORM.

## Recent Changes

### December 2024

- **401 Unauthorized Error Fix**: Implemented fetchWithToken API client for secure authenticated requests
- Created centralized API client with automatic JWT token inclusion
- Refactored all fetch calls to use new authenticated request system
- **Supabase Refactoring Complete**: Implemented proper singleton pattern for Supabase client instances
- Fixed multiple GoTrueClient instances warning with proper client management
- Enhanced client/server separation with dedicated creation functions
- **Authentication Enhancement**: Improved authentication flow with JWT token management and secure session handling
- Enhanced query client with automatic JWT token inclusion in API requests
- Strengthened backend API protection with comprehensive auth middleware
- **T-05 - Fila de Pagamento**: Complete payment queue system with batch processing, payment tracking, and comprehensive filtering
- Enhanced payment processing with individual and batch operations, multiple payment methods (PIX, TED, transferência, boleto)
- Implemented tabbed interface for payment queue and payment history with real-time statistics
- Added advanced search, filtering, and sorting capabilities for payment management
- Enhanced status workflow integration with formalization tracking
- **T-04 - Painel de Acompanhamento da Formalização**: Complete formalization tracking panel with timeline view, document management, contract tracking, and status updates
- Enhanced database schema with formalization fields: dataAprovacao, documentosAdicionais, contratoGerado, contratoAssinado, dataAssinatura, dataPagamento, observacoesFormalização
- Added comprehensive status tracking: aprovado → documentos_enviados → contratos_preparados → contratos_assinados → pronto_pagamento → pago
- Implemented tabbed interface for timeline, documents, and contracts management
- Added progress tracking with percentage completion and visual indicators
- **T-01 - Nova Proposta**: Complete three-tab proposal creation form with client data, loan conditions, and document upload functionality
- **T-02 - Fila de Análise**: Credit analysis queue page with proposal listing, filtering, and analysis routing functionality
- **T-03 - Painel de Análise Manual**: Manual analysis panel structure with dynamic routing, tabs for different analysis views, and document viewer
- **Navigation Enhancement**: Added functional navigation from T-02 to T-03 using wouter Link component for seamless user flow between analysis queue and individual proposal analysis
- **T-04 - Acompanhamento da Formalização**: Created formalization tracking page with dynamic routing, checklist functionality, and client interaction tools
- **T-05 - Fila de Pagamento**: Created payment queue page with proposal listing, payment processing functionality, and bank details management
- **Dashboard Navigation**: Added functional navigation from dashboard "Criar Nova Proposta" button to T-01 Nova Proposta page using wouter Link component
- **F-PRO-03 - Gestão de Tabelas Comerciais**: Complete CRUD functionality for commercial tables management with form validation, modal interfaces, and comprehensive testing
- **Tela 1 - Gestão de Usuários e Perfis**: Complete user management system with CRUD operations, user profile management, and status toggling functionality
- **Tela 2 - Gestão de Parceiros e Lojas**: Complete partner management system with CRUD operations, partner listing, and detailed partner view with stores management
- **Tela 3 - Gestão de Produtos de Crédito**: Complete product management system with CRUD operations, form validation, and business rules
- **Product Form Integration**: Created ProdutoForm component with Zod validation and integrated into products page modal
- **T-01 Dynamic Integration**: Connected Nova Proposta to backend with real-time credit simulation API using Tabela Price formula
- **Credit Simulation API**: Implemented POST /api/simular with mathematical loan calculation and proper validation
- **T-01 State Management Fix**: Refactored form architecture to centralize state management and prevent data loss between tabs
- **Form Architecture Improvement**: Moved from separate form states to unified form state with prop drilling for better data persistence
- **T-01 Complete Refactoring**: Enhanced Nova Proposta with real-time credit simulation, TAC checkbox, email validation, and improved UX
- **Enhanced Credit Simulation**: Added debounced API calls with loading states and comprehensive error handling with toast notifications
- **Complete DadosClienteForm Reconstruction**: Implemented comprehensive client data form with all required fields for Brazilian credit operations
- **Advanced Client Data Collection**: Added RG, órgão emissor, estado civil, nacionalidade, CEP, endereço, telefone, ocupação, and renda mensal fields
- **CET Calculation Enhancement**: Updated POST /api/simular to include CET (Custo Efetivo Total) calculation alongside installment values
- **Enhanced Credit Simulation API**: Added comprehensive cost calculation with annual CET percentage for better loan transparency
- **Business Logic Implementation**: Refactored simulation API to use commercial table IDs for dynamic interest rate calculation
- **Commercial Table Integration**: Added tabela comercial selector with mock data (Tabela A: 5.0%, Tabela B: 7.5%) and dynamic rate lookup
- **T-01 Refinement and Dynamic Simulator**: Implemented comprehensive credit simulation with IOF, TAC, and detailed cost breakdown
- **Enhanced Simulation API**: Added GET /api/simulacao endpoint with advanced calculations including IOF (0.38%), TAC, and accurate CET calculation
- **Comprehensive Cost Display**: Enhanced simulation results to show installment value, interest rate, IOF, TAC, and annual CET in detailed format
- **Daily Interest Logic with Grace Period**: Implemented daily interest calculation with 45-day maximum grace period validation
- **Enhanced Grace Period Calculation**: Added taxaJurosDiaria calculation and jurosCarencia integration for accurate loan scheduling
- **T-02 Enhanced Dashboard**: Upgraded Fila de Análise de Crédito with comprehensive KPIs, advanced filtering, and improved UX
- **Advanced KPI Metrics**: Added real-time metrics for daily proposals, monthly accumulation, and pending proposal counts
- **Comprehensive Filtering System**: Implemented status and partner filters with dynamic data filtering capabilities
- **Filter Bug Fix**: Corrected empty value bug in Select components by using "all" as default values with proper filtering logic
- **Hierarchical Partner-Store Filtering**: Enhanced filtering with dynamic partner-store relationships and cascading filter reset functionality
- **Enhanced Data Model**: Added separate partner and store columns with relational data structure for better organization
- **Complete Analysis Workflow Implementation**: Built comprehensive T-03 analysis system with proposal details, decision panel, and communication history
- **Analysis API Endpoints**: Added PUT /api/propostas/:id/status, GET /api/propostas/:id/logs, and GET /api/propostas/:id for complete analysis workflow
- **HistoricoComunicao Component**: Created dedicated component for proposal timeline and communication tracking with TanStack Query v5 integration
- **Decision Panel with Validation**: Implemented Zod schema validation for proposal decisions with proper form handling and mutation management
- **Backend API Bug Fix**: Corrected taxaJurosMensal undefined error in credit simulation endpoint
- **Server-Side Time Management**: Added GET /api/server-time endpoint for reliable timestamp source and server-based grace period calculations
- **Enhanced Grace Period Validation**: Updated simulation API to use server-side date calculations for consistent 45-day validation across time zones
- **TAC Parameter Bug Fix**: Corrected incluir_tac parameter handling in both frontend and backend to ensure proper boolean string conversion and interpretation
- **T-01 Refinement and Dynamic Simulator**: Implemented comprehensive credit simulation with IOF, TAC, and detailed cost breakdown
- **Enhanced Simulation API**: Added GET /api/simulacao endpoint with advanced calculations including IOF (0.38%), TAC, and accurate CET calculation
- **Comprehensive Cost Display**: Enhanced simulation results to show installment value, interest rate, IOF, TAC, and annual CET in detailed format
- **Code Quality Foundation Implementation**: Established comprehensive code quality and governance framework with ESLint, Prettier, Husky, and Commitlint
- **ESLint Configuration**: TypeScript + React rules with accessibility checks and Prettier integration for consistent code style
- **Prettier Setup**: Code formatting with Tailwind CSS class sorting and comprehensive file type support
- **Git Hooks Implementation**: Pre-commit linting and formatting, commit message validation via Husky
- **Conventional Commits**: Enforced commit message standards with detailed type definitions and validation rules
- **Git Flow Documentation**: Complete branching strategy documentation with examples and workflow guidelines

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query for server state
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and production builds

### Backend Architecture

- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful API with `/api` prefix
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Supabase Auth integration
- **File Storage**: Supabase Storage for document uploads
- **Database Client**: Neon Database (@neondatabase/serverless)

### Database Schema

The application uses PostgreSQL with the following main tables:

- `users`: User authentication and profile data
- `propostas`: Credit proposals with client information, loan details, and status tracking
- Status enum for proposal workflow: rascunho, aguardando_analise, em_analise, aprovado, rejeitado, pronto_pagamento, pago, cancelado

## Key Components

### Authentication System

- Supabase-based authentication with email/password
- Protected routes using `ProtectedRoute` component
- Session management with automatic redirects
- JWT token-based API authentication

### Dashboard Layout

- Centralized `DashboardLayout` component with sidebar navigation
- Responsive design with mobile support
- Navigation links for all main application sections

### Proposal Management

- Multi-step form for creating new proposals (client data, loan conditions, documents)
- File upload functionality for supporting documents
- Status tracking throughout the proposal lifecycle
- CRUD operations for proposal management

### Credit Analysis Workflow

- Queue system for proposals awaiting analysis
- Manual analysis interface with decision capabilities
- Status updates and approval/rejection workflow
- Priority-based filtering and search functionality

### Payment Processing

- Payment tracking and batch processing
- Integration with formalization workflow
- Status monitoring for approved proposals

## Data Flow

### Proposal Creation Flow

1. User creates new proposal through multi-step form
2. Client data, loan conditions, and documents are collected
3. Files uploaded to Supabase Storage
4. Proposal saved to database with "rascunho" status
5. Proposal moves to "aguardando_analise" when submitted

### Analysis Flow

1. Proposals appear in credit analysis queue
2. Analysts can filter and search proposals
3. Individual proposal analysis with decision interface
4. Status updates to "aprovado" or "rejeitado"
5. Approved proposals move to formalization

### Payment Flow

1. Approved proposals become available for payment processing
2. Batch selection and processing capabilities
3. Status tracking through payment completion
4. Integration with formalization workflow

## External Dependencies

### Core Dependencies

- **Supabase**: Authentication, database, and file storage
- **Drizzle ORM**: Type-safe database operations
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form state management
- **Zod**: Schema validation
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Pre-built React components

### Development Dependencies

- **Vite**: Build tool and development server
- **TypeScript**: Type safety and development experience
- **ESBuild**: Production bundling
- **Multer**: File upload handling

## Deployment Strategy

### Development Environment

- Vite development server with HMR
- Express.js backend with live reloading
- Environment variables for Supabase and database configuration
- Replit-specific development tooling integration

### Production Build

- Vite builds frontend to `dist/public`
- ESBuild bundles backend to `dist/index.js`
- Single Express server serves both API and static files
- Environment-based configuration management

### Database Management

- Drizzle Kit for schema management and migrations
- PostgreSQL as primary database
- Supabase for authentication and file storage
- Connection pooling with postgres-js

### Key Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `NODE_ENV`: Environment configuration

The application is designed to be deployed on Replit with integrated database provisioning and automatic environment variable management.
