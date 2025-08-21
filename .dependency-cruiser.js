/**
 * Dependency Cruiser Configuration
 * Phase 1 - Domain-Driven Design Enforcement
 * 
 * Este arquivo define as regras de dependência entre os Bounded Contexts
 * identificados na sessão de Event Storming para garantir o desacoplamento.
 */

module.exports = {
  // Regras proibidas - violações causam build failure
  forbidden: [
    /* ==== REGRAS DE BOUNDED CONTEXTS ==== */
    {
      name: 'no-cross-context-imports',
      severity: 'error',
      comment: 'Bounded Contexts não podem importar diretamente uns dos outros',
      from: {
        path: '^server/contexts/([^/]+)/'
      },
      to: {
        path: '^server/contexts/(?!$1)[^/]+/',
        pathNot: [
          // Exceções permitidas: contratos compartilhados
          '^server/contexts/shared/',
          '^server/contexts/contracts/'
        ]
      }
    },
    {
      name: 'credit-proposal-isolation',
      severity: 'error',
      comment: 'Credit Proposal Context deve ser completamente isolado',
      from: {
        pathNot: [
          '^server/contexts/credit-proposal/',
          '^server/contexts/shared/'
        ]
      },
      to: {
        path: '^server/contexts/credit-proposal/domain/'
      }
    },
    {
      name: 'credit-analysis-isolation',
      severity: 'error',
      comment: 'Credit Analysis Context deve ser completamente isolado',
      from: {
        pathNot: [
          '^server/contexts/credit-analysis/',
          '^server/contexts/shared/'
        ]
      },
      to: {
        path: '^server/contexts/credit-analysis/domain/'
      }
    },
    {
      name: 'contract-management-isolation',
      severity: 'error',
      comment: 'Contract Management Context deve ser completamente isolado',
      from: {
        pathNot: [
          '^server/contexts/contract-management/',
          '^server/contexts/shared/'
        ]
      },
      to: {
        path: '^server/contexts/contract-management/domain/'
      }
    },
    
    /* ==== REGRAS DE ARQUITETURA HEXAGONAL ==== */
    {
      name: 'domain-no-infrastructure',
      severity: 'error',
      comment: 'Camada de domínio não pode depender de infraestrutura',
      from: {
        path: '.*/domain/.*'
      },
      to: {
        path: '.*/infrastructure/.*'
      }
    },
    {
      name: 'domain-no-application',
      severity: 'error',
      comment: 'Camada de domínio não pode depender de aplicação',
      from: {
        path: '.*/domain/.*'
      },
      to: {
        path: '.*/application/.*'
      }
    },
    {
      name: 'application-no-infrastructure',
      severity: 'error',
      comment: 'Camada de aplicação não pode depender diretamente de infraestrutura',
      from: {
        path: '.*/application/.*'
      },
      to: {
        path: '.*/infrastructure/.*',
        pathNot: [
          // Exceção: portas e adaptadores
          '.*/ports/.*',
          '.*/adapters/.*'
        ]
      }
    },
    
    /* ==== REGRAS DE ANTI-CORRUPTION LAYER ==== */
    {
      name: 'payment-acl-required',
      severity: 'error',
      comment: 'Payment Context deve usar ACL para integrações externas',
      from: {
        path: '^server/contexts/payment/'
      },
      to: {
        path: '^server/lib/(inter-api|clicksign)/',
        pathNot: '^server/contexts/payment/adapters/'
      }
    },
    
    /* ==== REGRAS DE SEGURANÇA ==== */
    {
      name: 'no-direct-db-access',
      severity: 'error',
      comment: 'Acesso direto ao banco só é permitido via Storage interface',
      from: {
        pathNot: [
          '^server/storage\\.ts$',
          '^server/lib/supabase\\.ts$',
          '^migrations/.*'
        ]
      },
      to: {
        path: [
          'drizzle-orm',
          'postgres',
          '@supabase/supabase-js'
        ]
      }
    },
    
    /* ==== REGRAS DE FRONTEND ==== */
    {
      name: 'ui-no-backend-direct',
      severity: 'error',
      comment: 'Frontend não pode importar código do backend diretamente',
      from: {
        path: '^client/'
      },
      to: {
        path: '^server/',
        pathNot: '^shared/'
      }
    },
    {
      name: 'components-isolation',
      severity: 'warn',
      comment: 'Componentes devem ser independentes',
      from: {
        path: '^client/src/components/ui/'
      },
      to: {
        path: '^client/src/pages/'
      }
    }
  ],
  
  // Dependências permitidas explicitamente
  allowed: [
    {
      from: {},
      to: {
        path: '^shared/'
      }
    },
    {
      from: {
        path: '^server/routes/'
      },
      to: {
        path: '^server/contexts/.*/application/'
      }
    },
    {
      from: {
        path: '^server/contexts/.*/application/'
      },
      to: {
        path: '^server/contexts/$1/domain/'
      }
    }
  ],
  
  // Opções de análise
  options: {
    doNotFollow: {
      path: [
        'node_modules',
        '\\.test\\.[jt]s',
        '\\.spec\\.[jt]s'
      ]
    },
    includeOnly: [
      '^client/',
      '^server/',
      '^shared/'
    ],
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default']
    },
    reporterOptions: {
      dot: {
        collapsePattern: '^node_modules/[^/]+',
        theme: {
          graph: {
            bgcolor: 'transparent'
          }
        }
      },
      text: {
        highlightFocused: true
      }
    }
  }
};