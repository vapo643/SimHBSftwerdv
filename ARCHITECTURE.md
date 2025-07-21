
# Arquitetura de Software - Projeto Simpix

## 1. Visão Geral do Sistema

### 1.1 Contexto do Projeto
O **Simpix** é uma plataforma full-stack de gestão de crédito pessoal para uma rede de parceiros (lojistas). O sistema gerencia todo o ciclo de vida de propostas de crédito: criação, análise, formalização, pagamento e cobrança.

### 1.2 Princípio de Segurança Mestre
**Multi-Tenant com Isolamento Absoluto**: A arquitetura implementa segurança via Row Level Security (RLS) no PostgreSQL, garantindo que usuários de um parceiro/loja não acessem dados de outros.

### 1.3 Objetivos Arquiteturais
- **Segurança**: Isolamento total entre tenants
- **Escalabilidade**: Suporte a crescimento de parceiros
- **Manutenibilidade**: Código organizado e testável
- **Performance**: Resposta rápida para operações críticas
- **Compliance**: Auditoria completa de operações

## 2. Stack Tecnológica

### 2.1 Tecnologias Principais
```
Ambiente de Desenvolvimento: Replit
Linguagem: TypeScript (Full-stack)
Frontend: React 18 + Vite
Backend: Express.js + Node.js
Banco de Dados: PostgreSQL (Neon Database)
Autenticação: Supabase Auth
Armazenamento: Supabase Storage
ORM: Drizzle ORM
```

### 2.2 Bibliotecas e Dependências
```
Frontend:
- React Router: Wouter (lightweight)
- State Management: TanStack Query
- Form Handling: React Hook Form + Zod
- UI Components: Tailwind CSS + shadcn/ui
- Icons: Lucide React

Backend:
- Validation: Zod
- File Upload: Multer
- PDF Generation: PDFKit
- HTTP Client: Native fetch

Development:
- Build Tool: Vite + ESBuild
- Type Checking: TypeScript
- Database Migrations: Drizzle Kit
```

## 3. Arquitetura do Sistema

### 3.1 Padrão Arquitetural
**Monorepo Full-Stack**: Frontend e backend no mesmo repositório com separação clara de responsabilidades.

### 3.2 Estrutura de Diretórios
```
simpix/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes reutilizáveis
│   │   │   ├── ui/         # Componentes de UI básicos
│   │   │   ├── forms/      # Formulários específicos
│   │   │   └── [domain]/   # Componentes por domínio
│   │   ├── pages/          # Páginas/Rotas da aplicação
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilitários e configurações
│   │   └── data/           # Mock data e constantes
│   └── index.html
├── server/                 # Backend Express
│   ├── lib/                # Bibliotecas compartilhadas
│   ├── routes.ts           # Definição de rotas API
│   ├── storage.ts          # Camada de acesso a dados
│   └── index.ts            # Entry point do servidor
├── shared/                 # Código compartilhado
│   └── schema.ts           # Schemas Zod + Drizzle
└── [config files]         # Configurações do projeto
```

### 3.3 Comunicação Frontend-Backend
**Padrão RESTful API**: Escolhido por:
- Simplicidade de implementação
- Padronização bem estabelecida
- Facilidade de debug e teste
- Compatibilidade com ferramentas existentes

**Endpoints Principais**:
```
Authentication:
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/logout

Proposals:
GET    /api/propostas
POST   /api/propostas
GET    /api/propostas/:id
PATCH  /api/propostas/:id
POST   /api/propostas/:id/gerar-ccb

Business Logic:
POST   /api/simular
GET    /api/simulacao
GET    /api/produtos
GET    /api/prazos

File Management:
POST   /api/upload
```

## 4. Segurança e Autenticação

### 4.1 Modelo de Autenticação
- **Provedor**: Supabase Auth (JWT-based)
- **Fluxo**: Email/Password com sessões
- **Tokens**: Access tokens com renovação automática

### 4.2 Row Level Security (RLS)
```sql
-- Exemplo de política RLS
CREATE POLICY propostas_rls_policy ON propostas
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.loja_id = propostas.loja_id
  )
);
```

### 4.3 Middleware de Segurança
- Verificação de tokens em todas as rotas API
- Validação de dados com Zod schemas
- Upload seguro de arquivos com validação de tipo

## 5. Modelo de Dados

### 5.1 Entidades Principais
```
Users (Usuários)
├── id, email, name, password
└── Relaciona com: Profiles

Profiles (Perfis de Usuário)
├── user_id, loja_id, role
└── Relaciona com: Users, Lojas

Propostas (Propostas de Crédito)
├── Cliente: nome, cpf, email, telefone, renda
├── Empréstimo: valor, prazo, finalidade
├── Status: workflow de aprovação
├── Formalização: CCB, assinatura, biometria
└── Auditoria: created_at, updated_at, user_id

Parceiros (Rede de Parceiros)
├── nome, cnpj, contato
└── Relaciona com: Lojas

Lojas (Pontos de Venda)
├── parceiro_id, nome, endereco
└── Relaciona com: Parceiros, Profiles

Produtos (Produtos de Crédito)
├── nome, descricao, config
└── Relaciona com: Tabelas Comerciais

Tabelas Comerciais (Configurações de Taxa)
├── nome, taxa_juros, config
└── Relaciona com: Produtos
```

### 5.2 Workflow de Status
```
Proposta Status Flow:
rascunho → aguardando_analise → em_analise → 
aprovado/rejeitado → documentos_enviados → 
contratos_preparados → contratos_assinados → 
pronto_pagamento → pago
```

## 6. Camadas da Aplicação

### 6.1 Frontend (React)
```
Presentation Layer:
├── Pages (Rotas principais)
├── Components (UI reutilizável)
└── Forms (Formulários específicos)

State Management:
├── TanStack Query (Server State)
├── React Hook Form (Form State)
└── Local State (useState/useReducer)

Services Layer:
├── API Client (Fetch wrapper)
├── Auth Service (Supabase)
└── File Upload Service
```

### 6.2 Backend (Express)
```
API Layer:
├── Routes (Endpoint definitions)
├── Middleware (Auth, validation)
└── Error Handling

Business Logic:
├── Credit Simulation
├── Document Generation
└── Status Workflow

Data Access:
├── Storage Layer (Drizzle queries)
├── Database Connection
└── File Storage (Supabase)
```

## 7. Fluxos de Negócio

### 7.1 Criação de Proposta
```
1. Usuário preenche formulário multi-step
2. Upload de documentos (Supabase Storage)
3. Simulação de crédito em tempo real
4. Validação e persistência no banco
5. Mudança de status para "aguardando_analise"
```

### 7.2 Análise de Crédito
```
1. Proposta aparece na fila de análise
2. Analista visualiza dados e documentos
3. Sistema calcula score automático
4. Decisão manual com observações
5. Status atualizado para "aprovado/rejeitado"
```

### 7.3 Formalização (CCB)
```
1. Proposta aprovada entra na formalização
2. Geração automática de CCB (PDF)
3. Upload do documento para Storage
4. Atualização do campo ccb_documento_url
5. Controle de assinatura e biometria
```

## 8. Padrões de Desenvolvimento

### 8.1 Padrões Frontend
- **Component-Driven**: Componentes pequenos e reutilizáveis
- **Form-First**: React Hook Form com validação Zod
- **Type-Safe**: TypeScript em todos os níveis
- **Responsive-First**: Tailwind CSS mobile-first

### 8.2 Padrões Backend
- **API-First**: Definição clara de contratos
- **Validation-First**: Zod schemas compartilhados
- **Error-Handling**: Middleware centralizado
- **Database-First**: Drizzle ORM type-safe

### 8.3 Padrões de Segurança
- **Auth-Middleware**: Todas as rotas protegidas
- **Input-Validation**: Sanitização de dados
- **RLS-First**: Isolamento por tenant
- **Audit-Trail**: Log de todas as operações

## 9. Performance e Escalabilidade

### 9.1 Otimizações Frontend
- Lazy loading de componentes
- Caching com TanStack Query
- Debounce em simulações
- Compressão de assets (Vite)

### 9.2 Otimizações Backend
- Connection pooling (Database)
- File streaming (Uploads)
- Response compression
- Query optimization (Drizzle)

### 9.3 Estratégias de Cache
- Browser cache (Assets)
- Application cache (Queries)
- Database cache (Connection pool)

## 10. Deployment e DevOps

### 10.1 Ambiente Replit
```
Development:
- Hot reload (Vite + tsx)
- Environment variables
- Database migrations

Production:
- Build optimization
- Static file serving
- Process management
```

### 10.2 Pipeline de Deploy
```
1. Build frontend (Vite)
2. Build backend (ESBuild)
3. Database migrations
4. Asset optimization
5. Health checks
```

## 11. Monitoramento e Logs

### 11.1 Logging Strategy
- Request/Response logging
- Error tracking
- Performance metrics
- Business events

### 11.2 Health Checks
- Database connectivity
- External service status
- Application metrics

## 12. Boas Práticas e Recomendações

### 12.1 Três Principais Boas Práticas

1. **Segurança Multi-Tenant**:
   - Sempre usar RLS policies
   - Validar tenant_id em queries
   - Nunca expor dados cross-tenant

2. **Type Safety End-to-End**:
   - Schemas Zod compartilhados
   - TypeScript strict mode
   - Validação em runtime

3. **Error Handling Robusto**:
   - Try-catch em operações críticas
   - Error boundaries no React
   - Logs estruturados

### 12.2 Armadilhas a Evitar

1. **Vazamento de Dados**: Sempre filtrar por tenant
2. **Performance**: Evitar N+1 queries
3. **Security**: Nunca confiar apenas no frontend

## 13. Roadmap Técnico

### 13.1 Próximas Implementações
- [ ] Sistema de notificações
- [ ] Dashboard de métricas
- [ ] API de integração externa
- [ ] Sistema de auditoria avançado

### 13.2 Melhorias de Performance
- [ ] Cache Redis
- [ ] CDN para assets
- [ ] Database read replicas
- [ ] API rate limiting

## 14. Conclusão

A arquitetura do Simpix foi projetada para ser:
- **Segura**: Multi-tenant com RLS
- **Escalável**: Preparada para crescimento
- **Manutenível**: Código organizado e testável
- **Performática**: Otimizações em todas as camadas

O projeto utiliza tecnologias modernas e comprovadas, seguindo padrões estabelecidos da indústria, com foco especial na segurança multi-tenant que é crítica para o negócio.
