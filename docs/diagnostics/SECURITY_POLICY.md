# Política de Segurança - Sistema Simpix

**Data de Criação**: 31 de Janeiro de 2025  
**Versão**: 1.0  
**Responsável**: Equipe de Segurança  
**Aprovação**: OWASP ASVS Level 1 Compliance

## Objetivo

Este documento estabelece as regras formais de autorização e controle de acesso do Sistema Simpix, cumprindo o requisito **ASVS V8.1.1** (Documentação de Autorização) do padrão OWASP Application Security Verification Standard.

---

## V8: Regras de Autorização

### Modelo de Segurança

O Sistema Simpix implementa um modelo de segurança híbrido com duas camadas:

1. **Controle de Acesso Baseado em Funções (RBAC)** - Controla acesso a funcionalidades
2. **Segurança em Nível de Linha (RLS)** - Controla acesso a dados específicos

### Estrutura de Perfis

#### 1. ATENDENTE

**Responsabilidades**: Criação e edição de propostas de crédito
**Escopo de Acesso**: Limitado à sua loja

**Permissões de Funcionalidades**:

- ✅ Criar novas propostas
- ✅ Editar propostas pendentes
- ✅ Visualizar suas próprias propostas
- ✅ Acessar formalização de suas propostas
- ❌ Analisar propostas de crédito
- ❌ Aprovar/rejeitar propostas
- ❌ Acessar painel administrativo

**Permissões de Dados (RLS)**:

- **Propostas**: SELECT, INSERT, UPDATE (apenas sua loja)
- **Clientes**: SELECT, INSERT, UPDATE (apenas sua loja)
- **Documentos**: SELECT, INSERT (apenas sua loja)
- **Produtos**: SELECT (apenas sua loja)
- **Tabelas Comerciais**: SELECT (apenas sua loja)

#### 2. ANALISTA

**Responsabilidades**: Análise e decisão sobre propostas de crédito
**Escopo de Acesso**: Multi-loja (conforme configuração)

**Permissões de Funcionalidades**:

- ✅ Visualizar fila de análise
- ✅ Analisar propostas individualmente
- ✅ Aprovar/rejeitar/pender propostas
- ✅ Adicionar observações técnicas
- ❌ Criar novas propostas
- ❌ Acessar formalização
- ❌ Acessar painel administrativo

**Permissões de Dados (RLS)**:

- **Propostas**: SELECT, UPDATE (status e observações)
- **Logs de Comunicação**: SELECT, INSERT
- **Documentos**: SELECT (visualização para análise)

#### 3. GERENTE

**Responsabilidades**: Gestão operacional e supervisão
**Escopo de Acesso**: Limitado às suas lojas

**Permissões de Funcionalidades**:

- ✅ Todas as permissões de ATENDENTE
- ✅ Visualizar relatórios gerenciais
- ✅ Gerenciar equipe de atendentes
- ✅ Acessar formalização
- ✅ Configurar tabelas comerciais personalizadas
- ❌ Gerenciar usuários do sistema
- ❌ Acessar configurações globais

**Permissões de Dados (RLS)**:

- **Propostas**: SELECT, INSERT, UPDATE (suas lojas)
- **Usuários**: SELECT (apenas sua equipe)
- **Tabelas Comerciais**: SELECT, INSERT, UPDATE, DELETE (suas lojas)
- **Produtos**: SELECT, INSERT, UPDATE, DELETE (suas lojas)

#### 4. ADMINISTRADOR

**Responsabilidades**: Administração completa do sistema
**Escopo de Acesso**: Global (todas as lojas)

**Permissões de Funcionalidades**:

- ✅ Acesso total a todas as funcionalidades
- ✅ Gerenciamento de usuários
- ✅ Configurações do sistema
- ✅ Relatórios de segurança
- ✅ Auditoria e monitoramento
- ✅ Gestão de parceiros e lojas

**Permissões de Dados (RLS)**:

- **Bypass de RLS**: Acesso irrestrito para operações administrativas
- **Todas as Tabelas**: SELECT, INSERT, UPDATE, DELETE (global)
- **Logs de Segurança**: SELECT, INSERT (monitoramento)

### Implementação Técnica

#### 1. Role Guards (Middleware de Aplicação)

**Arquivo**: `server/lib/role-guards.ts`

**requireAdmin()**

```javascript
// Requer perfil ADMINISTRADOR
// Aplicado em: /api/admin/*, /api/security/*, /api/owasp/*
```

**requireManagerOrAdmin()**

```javascript
// Requer perfil GERENTE ou ADMINISTRADOR
// Aplicado em: gestão de produtos, tabelas comerciais
```

**requireAnyRole()**

```javascript
// Requer qualquer perfil válido (ATENDENTE, GERENTE, ADMINISTRADOR)
// Aplicado em: endpoints básicos da aplicação
```

#### 2. Row Level Security (RLS) Policies

**Arquivo**: `drizzle/migrations/0001_multi_tenant_rls.sql`

##### Função Principal

```sql
get_current_user_loja_id()
-- Retorna loja_id do usuário autenticado baseado no JWT
```

##### Políticas por Tabela

**Propostas**:

- SELECT: `loja_id = get_current_user_loja_id()`
- INSERT: `loja_id = get_current_user_loja_id()`
- UPDATE: `loja_id = get_current_user_loja_id()`
- DELETE: `false` (bloqueado - soft delete apenas)

**Tabelas Comerciais**:

- SELECT: `loja_id = get_current_user_loja_id()`
- INSERT: `loja_id = get_current_user_loja_id()`
- UPDATE: `loja_id = get_current_user_loja_id()`
- DELETE: `loja_id = get_current_user_loja_id()`

**Produtos**:

- SELECT: `loja_id = get_current_user_loja_id()`
- INSERT: `loja_id = get_current_user_loja_id()`
- UPDATE: `loja_id = get_current_user_loja_id()`
- DELETE: `loja_id = get_current_user_loja_id()`

**Logs de Comunicação**:

- SELECT: `loja_id = get_current_user_loja_id()`
- INSERT: `loja_id = get_current_user_loja_id()`
- UPDATE: `false` (imutável para auditoria)
- DELETE: `false` (imutável para auditoria)

**Parceiros**:

- SELECT: Apenas parceiro da própria loja
- INSERT: `false` (controlado na aplicação)
- UPDATE: Apenas próprio parceiro
- DELETE: `false` (bloqueado)

**Lojas**:

- SELECT: `id = get_current_user_loja_id()`
- INSERT: Controlado na aplicação
- UPDATE: `id = get_current_user_loja_id()`
- DELETE: `false` (bloqueado)

### Matriz de Permissões

| Recurso            | ATENDENTE      | ANALISTA             | GERENTE         | ADMINISTRADOR |
| ------------------ | -------------- | -------------------- | --------------- | ------------- |
| **Propostas**      |
| Criar              | ✅ (sua loja)  | ❌                   | ✅ (suas lojas) | ✅ (global)   |
| Visualizar         | ✅ (sua loja)  | ✅ (conforme config) | ✅ (suas lojas) | ✅ (global)   |
| Editar             | ✅ (pendentes) | ✅ (status/obs)      | ✅ (suas lojas) | ✅ (global)   |
| Aprovar/Rejeitar   | ❌             | ✅                   | ✅              | ✅            |
| **Usuários**       |
| Visualizar         | ❌             | ❌                   | ✅ (sua equipe) | ✅ (global)   |
| Criar              | ❌             | ❌                   | ❌              | ✅            |
| Editar             | ❌             | ❌                   | ❌              | ✅            |
| Desativar          | ❌             | ❌                   | ❌              | ✅            |
| **Produtos**       |
| Visualizar         | ✅ (sua loja)  | ❌                   | ✅ (suas lojas) | ✅ (global)   |
| Gerenciar          | ❌             | ❌                   | ✅ (suas lojas) | ✅ (global)   |
| **Configurações**  |
| Tabelas Comerciais | ❌             | ❌                   | ✅ (suas lojas) | ✅ (global)   |
| Sistema            | ❌             | ❌                   | ❌              | ✅            |
| Segurança          | ❌             | ❌                   | ❌              | ✅            |

### Controles de Segurança Adicionais

#### 1. Isolamento Multi-Tenant

- Todos os dados são isolados por `loja_id`
- Usuários não podem acessar dados de outras lojas
- Exceção: ADMINISTRADOR tem acesso global

#### 2. Auditoria e Logs

- Logs de comunicação são imutáveis
- Todas as ações são registradas
- Eventos de segurança são monitorados

#### 3. Prevenção de Bypass

- RLS não pode ser desabilitado por usuários
- Políticas aplicadas automaticamente no banco
- Validação dupla: aplicação + banco de dados

### Processo de Revisão

#### Frequência

- **Revisão Trimestral**: Verificação de políticas e permissões
- **Revisão Anual**: Avaliação completa da arquitetura de segurança

#### Responsáveis

- **Administrador de Sistema**: Implementação técnica
- **Gerente de Segurança**: Aprovação de mudanças
- **Auditor Interno**: Verificação de conformidade

#### Checklist de Revisão

- [ ] Verificar se RLS está ativo em todas as tabelas
- [ ] Testar isolamento entre lojas
- [ ] Validar role guards em novos endpoints
- [ ] Confirmar logs de auditoria funcionando
- [ ] Testar cenários de bypass de segurança

### Exceções e Casos Especiais

#### 1. Operações do Sistema

- Usuário `simpix_system` pode bypassar RLS para operações automatizadas
- Migrations e manutenção usam privilégios elevados temporários

#### 2. Usuários Órfãos

- Usuários sem loja_id são bloqueados automaticamente
- Middleware valida existência de perfil válido

#### 3. Desativação de Conta

- Todos os tokens são invalidados imediatamente
- Sessões ativas são terminadas
- Logs de segurança registram a ação

---

## Conformidade OWASP ASVS

Este documento atende aos seguintes requisitos:

- **V8.1.1** ✅ - Documentação de regras de autorização
- **V8.1.4** ✅ - Processo de revisão documentado
- **V8.2.1** ✅ - Controle de acesso a funções
- **V8.2.2** ✅ - Proteção contra IDOR/BOLA

**Data da Última Atualização**: 31 de Janeiro de 2025  
**Próxima Revisão Programada**: 30 de Abril de 2025
