
# Simpix - Sistema de Gestão de Crédito

## 📋 Visão Geral

O **Simpix** é um sistema completo de gestão de crédito desenvolvido com arquitetura full-stack moderna. O projeto permite gerenciar todo o ciclo de vida de propostas de crédito, desde a criação até a formalização e pagamento.

## 🏗️ Arquitetura do Sistema

### Frontend
- **Framework**: React 18 com TypeScript
- **Roteamento**: Wouter (router leve para React)
- **Estilização**: Tailwind CSS + shadcn/ui
- **Gerenciamento de Estado**: TanStack Query para estado do servidor
- **Formulários**: React Hook Form + Zod para validação
- **Build**: Vite para desenvolvimento e produção

### Backend
- **Framework**: Express.js com TypeScript
- **Padrão API**: RESTful com prefixo `/api`
- **Banco de Dados**: PostgreSQL com Drizzle ORM
- **Autenticação**: Supabase Auth
- **Armazenamento**: Supabase Storage para documentos

## 📁 Estrutura do Projeto

```
simpix/
├── client/                    # Frontend React
│   ├── src/
│   │   ├── components/        # Componentes reutilizáveis
│   │   │   ├── ui/           # Componentes base do shadcn/ui
│   │   │   ├── forms/        # Formulários específicos
│   │   │   ├── analise/      # Componentes de análise
│   │   │   ├── parceiros/    # Gestão de parceiros
│   │   │   ├── produtos/     # Gestão de produtos
│   │   │   └── usuarios/     # Gestão de usuários
│   │   ├── pages/            # Páginas da aplicação
│   │   │   ├── admin/        # Administração
│   │   │   ├── configuracoes/# Configurações
│   │   │   ├── credito/      # Análise de crédito
│   │   │   ├── financeiro/   # Pagamentos
│   │   │   ├── formalizacao/ # Formalização
│   │   │   ├── parceiros/    # Gestão de parceiros
│   │   │   └── propostas/    # Gestão de propostas
│   │   ├── lib/              # Utilitários e configurações
│   │   └── hooks/            # Hooks customizados
├── server/                   # Backend Express
│   ├── lib/                  # Bibliotecas do servidor
│   ├── routes.ts             # Rotas da API
│   └── index.ts              # Servidor principal
└── shared/                   # Schemas compartilhados
    └── schema.ts             # Validações Zod
```

## 🗄️ Esquema do Banco de Dados

### Tabelas Principais

#### `profiles`
- Perfis de usuários com roles (ADMINISTRADOR, GERENTE, ATENDENTE)
- Relacionamento com usuários do Supabase Auth

#### `parceiros`
- Cadastro de parceiros comerciais
- Informações de contato e configurações

#### `lojas`
- Lojas vinculadas aos parceiros
- Configurações específicas por loja

#### `produtos`
- Produtos de crédito disponíveis
- Taxas, prazos e condições

#### `tabelas_comerciais`
- Tabelas de taxa por parceiro/produto
- Configuração de comissionamento

#### `propostas`
- Propostas de crédito dos clientes
- Status: rascunho → aguardando_analise → em_analise → aprovado/rejeitado → pronto_pagamento → pago

#### `proposta_logs`
- Histórico de alterações nas propostas
- Auditoria de ações dos usuários

#### `parcelas`
- Detalhamento das parcelas de cada proposta
- Cálculos de juros e valores

## 🔒 Segurança e Multi-tenancy

### Row Level Security (RLS)
- Políticas implementadas em todas as tabelas
- Isolamento por `loja_id` para ATENDENTES e GERENTES
- Acesso total para ADMINISTRADORES

### Autenticação
- Integração com Supabase Auth
- JWT tokens para sessões
- Rotas protegidas no frontend

## 🚀 Funcionalidades Implementadas

### ✅ Módulos Completos

1. **Gestão de Usuários e Perfis**
   - CRUD completo de usuários
   - Atribuição de roles e lojas
   - Interface administrativa

2. **Gestão de Parceiros e Lojas**
   - Cadastro de parceiros
   - Subcadastro de lojas
   - Configuração comercial

3. **Gestão de Produtos de Crédito**
   - Cadastro de produtos
   - Configuração de taxas e prazos
   - Vinculação com tabelas comerciais

4. **Tabelas Comerciais**
   - Configuração de taxas por parceiro
   - Sistema de comissionamento
   - Validações de negócio

5. **Criação de Propostas**
   - Formulário multi-etapas
   - Dados do cliente
   - Condições do empréstimo
   - Anexo de documentos
   - Simulador de crédito em tempo real

### 🔄 Em Desenvolvimento

6. **Esteira de Análise de Crédito**
   - Fila de análise automatizada
   - Painel para analistas
   - Histórico de comunicação

7. **Processamento de Pagamentos**
   - Fila de pagamentos
   - Processamento em lote
   - Acompanhamento de status

8. **Formalização**
   - Geração de CCB
   - Assinatura eletrônica
   - Acompanhamento do processo

## 🛠️ Configuração do Ambiente

### Pré-requisitos
- Node.js 20+
- PostgreSQL 16+
- Conta no Supabase

### Instalação

1. **Clone o repositório**
```bash
git clone <url-do-repositorio>
cd simpix
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
# Crie um arquivo .env com:
DATABASE_URL=sua_url_postgresql
SUPABASE_URL=sua_url_supabase
SUPABASE_ANON_KEY=sua_chave_anonima
NODE_ENV=development
```

4. **Configure o banco de dados**
```bash
# Execute os scripts SQL fornecidos no Supabase:
# 1. CREATE TABLE (criação das tabelas)
# 2. ALTER TABLE (chaves estrangeiras)
# 3. RLS (políticas de segurança)
```

### Execução

**Desenvolvimento**
```bash
npm run dev
```
Acesse: `http://localhost:5000`

**Produção**
```bash
npm run build
npm start
```

## 📋 Scripts Disponíveis

- `npm run dev` - Servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm start` - Servidor de produção
- `npm run check` - Verificação de tipos TypeScript
- `npm run db:push` - Push do schema para o banco

## 🧪 Padrões de Desenvolvimento

### Organização de Código
- Componentes organizados por funcionalidade
- Hooks customizados para lógica reutilizável
- Schemas Zod para validação consistente
- Tipagem TypeScript em todo o projeto

### Convenções
- Nomenclatura em português para domínio de negócio
- PascalCase para componentes React
- camelCase para funções e variáveis
- kebab-case para arquivos de páginas

### Qualidade
- Validação com Zod em frontend e backend
- Tratamento de erros padronizado
- Feedback de usuário com toast notifications
- Loading states em todas as operações assíncronas

## 🌐 Deploy

O projeto está configurado para deploy no **Replit** com:
- Build automático via Vite + ESBuild
- Servidor Express servindo frontend e API
- Configuração de ambiente automática
- Integração com PostgreSQL e Supabase

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique a documentação do código
2. Consulte os logs do servidor
3. Entre em contato com a equipe de desenvolvimento

---

**Status**: Em desenvolvimento ativo  
**Versão**: 1.0.0  
**Licença**: MIT
