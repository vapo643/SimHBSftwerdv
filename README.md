
# Simpix - Sistema de Crédito

Sistema completo de gestão de crédito com análise automatizada e workflow de formalização.

## Tecnologias

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **Banco de Dados**: PostgreSQL (Supabase)
- **ORM**: Drizzle
- **UI**: Tailwind CSS + shadcn/ui
- **Testes**: Vitest + Testing Library

## Instalação

```bash
npm install
npm run dev
```

## Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm run start` - Inicia o servidor de produção
- `npm test` - Executa os testes
- `npm run test:ui` - Interface visual dos testes
- `npm run db:push` - Sincroniza o schema do banco

## Estratégia de Versionamento (Git Flow)

Este projeto utiliza uma estratégia simplificada do Git Flow para organizar o desenvolvimento:

### Branches Principais

#### `main`
- Branch de produção
- Contém apenas código estável e testado
- Deploys automáticos são feitos a partir desta branch
- **Nunca** commite diretamente nesta branch

#### `develop`
- Branch de integração e desenvolvimento
- Onde todas as features são integradas antes de ir para produção
- Base para criação de novas branches de feature
- Código deve estar sempre funcional, mesmo que incompleto

#### `feature/*`
- Branches para desenvolvimento de novas funcionalidades
- Nomenclatura: `feature/nome-da-funcionalidade`
- Exemplos:
  - `feature/nova-proposta-form`
  - `feature/analise-credito-workflow`
  - `feature/dashboard-kpis`

### Fluxo de Trabalho

1. **Nova Feature**: Crie uma branch a partir de `develop`
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/minha-funcionalidade
   ```

2. **Desenvolvimento**: Faça commits seguindo o padrão Conventional Commits
   ```bash
   git add .
   git commit -m "feat: adiciona formulário de nova proposta"
   ```

3. **Integração**: Merge na branch `develop`
   ```bash
   git checkout develop
   git merge feature/minha-funcionalidade
   git push origin develop
   ```

4. **Release**: Quando `develop` estiver estável, merge em `main`
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```

### Conventional Commits

Este projeto utiliza o padrão Conventional Commits para padronizar as mensagens de commit:

#### Tipos de Commit

- `feat:` - Nova funcionalidade
- `fix:` - Correção de bug
- `docs:` - Documentação
- `style:` - Formatação, sem mudança de código
- `refactor:` - Refatoração de código
- `perf:` - Melhoria de performance
- `test:` - Adição ou correção de testes
- `chore:` - Manutenção, build, CI/CD

#### Exemplos

```bash
feat: adiciona simulador de crédito em tempo real
fix: corrige cálculo de juros na tabela Price
docs: atualiza documentação da API de propostas
refactor: reorganiza componentes do dashboard
test: adiciona testes para componente Button
chore: atualiza dependências do projeto
```

#### Validação Automática

O projeto possui hooks do Git configurados para validar automaticamente as mensagens de commit. Se a mensagem não seguir o padrão, o commit será rejeitado.

## Estrutura do Projeto

```
├── client/          # Frontend React
├── server/          # Backend Express
├── shared/          # Schemas compartilhados
├── migrations/      # Migrações do banco
└── tests/          # Testes automatizados
```

## Contribuição

1. Crie uma branch de feature a partir de `develop`
2. Desenvolva sua funcionalidade
3. Adicione testes quando necessário
4. Faça commits seguindo o Conventional Commits
5. Integre sua branch com `develop`
6. Solicite review antes do merge em `main`
