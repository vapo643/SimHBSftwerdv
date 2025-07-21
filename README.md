# Simpix Credit Management System

A comprehensive credit management platform that transforms financial workflows through an intelligent, data-driven credit proposal system with advanced simulation capabilities.

## 🏗️ Tech Stack

- **Frontend**: React 18 with TypeScript
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS with shadcn/ui
- **State Management**: TanStack Query
- **Form Validation**: React Hook Form + Zod
- **Authentication**: Supabase Auth
- **Build Tools**: Vite + ESBuild

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Supabase account (for authentication)

### Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see Environment Variables section)
4. Push database schema: `npm run db:push`
5. Start development server: `npm run dev`

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type check TypeScript
- `npm run db:push` - Push database schema changes
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Code Quality & Governance

This project implements strict code quality standards:

#### ESLint & Prettier

- **ESLint**: TypeScript + React rules with accessibility checks
- **Prettier**: Code formatting with Tailwind CSS class sorting
- **Configuration**: See `.eslintrc.js` and `.prettierrc`

#### Commit Standards

- **Conventional Commits**: Enforced via Commitlint
- **Git Hooks**: Pre-commit linting and formatting via Husky
- **Types**: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert

#### Example Commit Messages

```bash
feat: add real-time credit simulation API
fix: correct TAC parameter handling in frontend
docs: update installation instructions
style: format code according to Prettier rules
refactor: improve form state management architecture
```

## 🌿 Git Flow Strategy

This project follows the **Git Flow** branching model:

### Main Branches

#### `main`

- **Purpose**: Production-ready code
- **Rules**: Only accepts merges from `develop` via pull requests
- **Protection**: Direct pushes forbidden, requires code review
- **Tags**: All releases are tagged here (v1.0.0, v1.1.0, etc.)

#### `develop`

- **Purpose**: Integration branch for features
- **Rules**: Latest development changes, always deployable
- **Merges**: Accepts feature branches and hotfixes
- **Testing**: All CI/CD tests must pass

### Supporting Branches

#### Feature Branches (`feature/feature-name`)

- **Purpose**: New features and enhancements
- **Naming**: `feature/credit-simulation`, `feature/user-authentication`
- **Origin**: Branch from `develop`
- **Merge**: Back to `develop` via pull request
- **Lifespan**: Deleted after merge

#### Hotfix Branches (`hotfix/fix-name`)

- **Purpose**: Critical production fixes
- **Naming**: `hotfix/critical-security-patch`, `hotfix/payment-bug`
- **Origin**: Branch from `main`
- **Merge**: To both `main` and `develop`
- **Release**: Immediate production deployment

#### Release Branches (`release/version-number`)

- **Purpose**: Prepare releases, final testing
- **Naming**: `release/v1.2.0`
- **Origin**: Branch from `develop`
- **Merge**: To `main` (with tag) and back to `develop`
- **Activities**: Bug fixes, documentation, version bumps

### Workflow Example

```bash
# Create feature branch
git checkout develop
git pull origin develop
git checkout -b feature/new-payment-system

# Work on feature
git add .
git commit -m "feat: implement payment processing logic"
git push origin feature/new-payment-system

# Create pull request to develop
# After review and merge, delete feature branch

# Prepare release
git checkout develop
git checkout -b release/v1.3.0
# Final testing and bug fixes
git commit -m "chore: prepare v1.3.0 release"

# Merge to main
git checkout main
git merge release/v1.3.0
git tag v1.3.0
git push origin main --tags

# Merge back to develop
git checkout develop
git merge release/v1.3.0
git branch -d release/v1.3.0
```

### Branch Protection Rules

- **main**: Requires pull request, passing CI, code review
- **develop**: Requires pull request, passing CI
- **feature/\***: Regular development branches
- **hotfix/\***: Emergency fix branches with expedited review

## 🏢 Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/           # Utility functions
├── server/                 # Backend Express.js application
│   ├── routes.ts          # API routes
│   ├── storage.ts         # Database layer
│   └── index.ts          # Server entry point
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Database schema definitions
└── .husky/                # Git hooks configuration
```

## 📊 Key Features

- **Credit Proposal Management**: Complete workflow from creation to approval
- **Real-time Credit Simulation**: IOF, TAC, and CET calculations
- **Analysis Workflow**: Manual review and decision tracking
- **Payment Processing**: Queue management and tracking
- **User Management**: Authentication and role-based access
- **Document Upload**: Secure file handling with Supabase Storage

## 🔒 Environment Variables

Create a `.env` file with the following variables:

```env
DATABASE_URL=your_postgresql_url
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
NODE_ENV=development
```

## 📝 Contributing

1. Follow the Git Flow branching strategy
2. Use Conventional Commits for all commit messages
3. Ensure code passes ESLint and Prettier checks
4. Write tests for new features
5. Update documentation as needed

## 🏛️ Architecture

The application follows a modern full-stack architecture:

- **Frontend**: Component-based React with TypeScript
- **Backend**: RESTful API with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based with Supabase
- **File Storage**: Supabase Storage for documents
- **Real-time**: TanStack Query for server state management

## 📄 License

MIT License - see LICENSE file for details
