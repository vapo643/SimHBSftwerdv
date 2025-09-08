# Contributing to Simpix Credit Management System

## Development Workflow

### Testing

Para executar a suíte de testes completa:

```bash
npx vitest run
```

Para executar testes específicos:

```bash
npx vitest run tests/unit/status-fsm.test.ts
npx vitest run tests/integration/
```

Para executar testes com watch mode durante desenvolvimento:

```bash
npx vitest
```

### Code Quality

- Todos os commits devem passar pelos testes unitários
- Use LSP diagnostics para validar tipagem TypeScript
- Siga as convenções definidas no projeto (ESLint/Prettier configurado)

### Architecture

- Frontend: React + TypeScript + Vite
- Backend: Express.js + TypeScript + Drizzle ORM
- Database: PostgreSQL (via Supabase)
- Authentication: Supabase Auth + custom RBAC

### Project Structure

```
├── client/           # Frontend React application
├── server/           # Backend Express application
├── shared/           # Shared types and schemas
├── tests/            # Test suites (unit + integration)
└── docs/             # Project documentation
```

Consulte `replit.md` para detalhes arquiteturais completos.
