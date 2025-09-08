/**
 * Dependency Cruiser Configuration
 * Fitness Functions para Validação Arquitetural
 * Implementa validação automática dos limites dos Bounded Contexts
 * e regras da arquitetura hexagonal
 */

module.exports = {
  forbidden: [
    {
      name: 'boundary-violation-between-bounded-contexts',
      severity: 'error',
      comment:
        'Bounded Contexts não podem importar uns dos outros diretamente. Comunicação deve ser via Application Services ou Eventos.',
      from: {
        path: '^server/contexts/([^/]+)/',
      },
      to: {
        path: '^server/contexts/(?!$1)([^/]+)/',
        pathNot: [
          // Permitir imports de tipos compartilhados se necessário
          '^server/contexts/shared/',
          // Permitir imports de interfaces de aplicação se existirem
          '^server/contexts/[^/]+/application/interfaces/',
        ],
      },
    },
    {
      name: 'domain-cannot-depend-on-infrastructure',
      severity: 'error',
      comment: 'Camada de domínio deve ser pura e não pode depender de infraestrutura',
      from: {
        path: ['^server/contexts/[^/]+/domain/', '^shared/schema\\.ts$'],
      },
      to: {
        path: [
          '^server/contexts/[^/]+/infrastructure/',
          '^server/lib/',
          '^server/services/',
          '^server/middleware/',
          // Bibliotecas de infraestrutura específicas
          'node_modules/@supabase/',
          'node_modules/drizzle-orm/',
          'node_modules/express',
          'node_modules/bullmq',
          'node_modules/ioredis',
          'node_modules/winston',
          'node_modules/pdf-lib',
        ],
      },
    },
    {
      name: 'domain-cannot-depend-on-application',
      severity: 'error',
      comment: 'Camada de domínio não pode depender da camada de aplicação',
      from: {
        path: '^server/contexts/[^/]+/domain/',
      },
      to: {
        path: '^server/contexts/[^/]+/application/',
      },
    },
    {
      name: 'domain-cannot-depend-on-presentation',
      severity: 'error',
      comment: 'Camada de domínio não pode depender da camada de apresentação',
      from: {
        path: '^server/contexts/[^/]+/domain/',
      },
      to: {
        path: ['^server/contexts/[^/]+/presentation/', '^server/routes/', '^server/controllers/'],
      },
    },
    {
      name: 'application-cannot-depend-on-presentation',
      severity: 'error',
      comment: 'Camada de aplicação não pode depender da camada de apresentação',
      from: {
        path: '^server/contexts/[^/]+/application/',
      },
      to: {
        path: ['^server/contexts/[^/]+/presentation/', '^server/routes/', '^server/controllers/'],
      },
    },
    {
      name: 'infrastructure-cannot-depend-on-presentation',
      severity: 'error',
      comment: 'Camada de infraestrutura não pode depender da camada de apresentação',
      from: {
        path: '^server/contexts/[^/]+/infrastructure/',
      },
      to: {
        path: ['^server/contexts/[^/]+/presentation/', '^server/routes/', '^server/controllers/'],
      },
    },
    {
      name: 'shared-schema-independence',
      severity: 'error',
      comment: 'Shared schema deve permanecer independente de implementações específicas',
      from: {
        path: '^shared/schema\\.ts$',
      },
      to: {
        path: [
          '^server/',
          '^client/',
          'node_modules/express',
          'node_modules/@supabase/',
          'node_modules/bullmq',
        ],
        pathNot: [
          // Permitir apenas imports essenciais do Drizzle para definição de schema
          'node_modules/drizzle-orm',
          'node_modules/drizzle-zod',
        ],
      },
    },
    {
      name: 'controllers-should-not-have-business-logic',
      severity: 'warn',
      comment: 'Controllers devem delegar lógica de negócio para services ou use cases',
      from: {
        path: ['^server/controllers/', '^server/routes/', '^server/contexts/[^/]+/presentation/'],
      },
      to: {
        path: ['node_modules/drizzle-orm', '^server/lib/supabase', '^server/lib/database'],
        pathNot: [
          // Permitir imports de services e use cases
          '^server/services/',
          '^server/contexts/[^/]+/application/',
          '^server/contexts/[^/]+/domain/services/',
        ],
      },
    },
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      comment: 'Dependências circulares são proibidas em toda a base de código',
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: 'no-orphaned-modules',
      severity: 'warn',
      comment: 'Módulos órfãos (não utilizados) devem ser removidos',
      from: {
        orphan: true,
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: {
      path: ['node_modules', '\\.test\\.[jt]sx?$', '\\.spec\\.[jt]sx?$', '\\.stories\\.[jt]sx?$'],
    },
    includeOnly: ['^server/', '^shared/', '^client/src/'],
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
        theme: {
          graph: {
            splines: 'ortho',
          },
        },
      },
      text: {
        highlightFocused: true,
      },
      markdown: {
        showTitle: true,
      },
    },
    cache: true,
    progress: {
      type: 'performance-log',
    },
  },
};
