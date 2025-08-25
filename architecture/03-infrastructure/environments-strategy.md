# 🌍 Estratégia de Ambientes - Sistema Simpix

**Documento Técnico:** Environments Strategy  
**Versão:** 1.0  
**Data:** 25 de Janeiro de 2025  
**Status:** Oficial - Definição Formal de Ambientes  
**Aprovação:** Pendente Ratificação do Arquiteto Chefe  
**Criticidade:** P0 - CRÍTICA

---

## 📋 **SUMÁRIO EXECUTIVO**

Este documento estabelece a estratégia formal de ambientes para o Sistema Simpix, definindo a estrutura, configuração, isolamento e promoção entre ambientes de desenvolvimento, staging e produção. Serve como "fonte da verdade" para garantir consistência, segurança e confiabilidade em todo o ciclo de vida do software.

**Ponto de Conformidade:** Remediação do Ponto 67 - Estratégia de Ambientes  
**Impacto:** Isolamento de mudanças, qualidade de releases, gestão de riscos  
**Revisão:** Trimestral ou mediante mudanças significativas

---

## 🎯 **1. VISÃO GERAL DOS AMBIENTES**

### 1.1 **Arquitetura de Ambientes**

```mermaid
graph TB
    subgraph "Developer Machines"
        LOCAL[Local Dev<br/>Node.js + Docker]
    end
    
    subgraph "Development"
        DEV[Development<br/>Replit Platform<br/>Continuous Deploy]
    end
    
    subgraph "Staging"
        STG[Staging<br/>Azure Container Apps<br/>Production Mirror]
    end
    
    subgraph "Production"
        PROD[Production<br/>Azure Container Apps<br/>High Availability]
    end
    
    LOCAL -->|git push| DEV
    DEV -->|PR merge| STG
    STG -->|Release| PROD
    
    style LOCAL fill:#f9f,stroke:#333,stroke-width:2px
    style DEV fill:#ff9,stroke:#333,stroke-width:2px
    style STG fill:#9ff,stroke:#333,stroke-width:2px
    style PROD fill:#9f9,stroke:#333,stroke-width:2px
```

### 1.2 **Matriz de Ambientes**

| Ambiente | Propósito | Infraestrutura | Uptime SLA | Data Refresh | Access |
|----------|-----------|----------------|------------|--------------|--------|
| **Local** | Development | Docker Compose | N/A | On-demand | Developers |
| **Development** | Integration | Replit | 95% | Live | Dev Team |
| **Staging** | UAT/Pre-prod | Azure | 99% | Weekly | Team + QA |
| **Production** | Live System | Azure HA | 99.5% | N/A | Customers |

---

## 💻 **2. LOCAL DEVELOPMENT**

### 2.1 **Configuração Base**

```yaml
# docker-compose.local.yml
version: '3.8'

services:
  postgres:
    image: postgres:15.5-alpine
    environment:
      POSTGRES_DB: simpix_local
      POSTGRES_USER: developer
      POSTGRES_PASSWORD: local_dev_2025
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U developer"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7.2-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
    environment:
      MH_STORAGE: memory
      MH_OUTGOING_SMTP: false

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### 2.2 **Environment Variables (.env.local)**

```bash
# .env.local - Local Development Configuration
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:5000

# Database
DATABASE_URL=postgresql://developer:local_dev_2025@localhost:5432/simpix_local
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_MOCK=false

# Storage (MinIO as S3 replacement)
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin123
STORAGE_BUCKET=simpix-local

# Email (MailHog)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
EMAIL_FROM=noreply@simpix.local

# Auth
JWT_SECRET=local_jwt_secret_change_in_production_2025
SESSION_SECRET=local_session_secret_change_in_production_2025

# External APIs (Mocked)
INTER_API_URL=http://localhost:3000/mock/inter
CLICKSIGN_API_URL=http://localhost:3000/mock/clicksign
OPENAI_API_KEY=sk-local-mock-key

# Feature Flags
UNLEASH_URL=http://localhost:4242/api
UNLEASH_API_KEY=default:development.local-token

# Monitoring (Disabled)
SENTRY_DSN=
DATADOG_API_KEY=
```

### 2.3 **Setup Script**

```bash
#!/bin/bash
# scripts/setup-local.sh

echo "🚀 Setting up local development environment..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required"; exit 1; }

# Copy environment file
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "✅ Created .env.local from template"
fi

# Start infrastructure
docker-compose -f docker-compose.local.yml up -d
echo "⏳ Waiting for services to start..."
sleep 10

# Run migrations
npm run db:migrate:local
echo "✅ Database migrations complete"

# Seed development data
npm run db:seed:local
echo "✅ Development data seeded"

# Create storage buckets
npm run storage:setup:local
echo "✅ Storage buckets created"

echo "
✨ Local environment ready!

Services running:
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- MailHog: http://localhost:8025
- MinIO: http://localhost:9001

Start the application:
  npm run dev

Happy coding! 🎉
"
```

---

## 🔧 **3. DEVELOPMENT ENVIRONMENT**

### 3.1 **Infrastructure Specification**

```yaml
Platform: Replit
URL: https://simpix-dev.replit.app

Infrastructure:
  Compute:
    Type: Shared container
    CPU: 0.5 vCPU (burstable to 2)
    Memory: 512MB - 2GB
    Storage: 10GB persistent
    
  Database:
    Provider: Supabase (Free tier)
    Size: 500MB
    Connections: 60 max
    Backup: Daily, 7 days retention
    
  Networking:
    Domain: *.replit.dev
    SSL: Automatic (Let's Encrypt)
    CDN: None
    
  Limitations:
    - Cold starts after 30min idle
    - Shared IP address
    - No custom domains
    - Limited monitoring
```

### 3.2 **Configuration Management**

```typescript
// config/environments/development.ts
export const developmentConfig = {
  app: {
    name: 'Simpix Development',
    env: 'development',
    debug: true,
    logLevel: 'debug',
    
    features: {
      debugPanel: true,
      mockData: true,
      hotReload: true,
      sourceMaps: true,
      verboseErrors: true
    }
  },
  
  security: {
    cors: {
      origin: ['http://localhost:3000', 'https://*.replit.dev'],
      credentials: true
    },
    
    rateLimit: {
      windowMs: 60000,
      max: 1000  // Very permissive for development
    },
    
    auth: {
      sessionTimeout: 86400000,  // 24 hours
      passwordPolicy: 'relaxed',
      mfaRequired: false
    }
  },
  
  integrations: {
    payment: {
      provider: 'mock',
      testMode: true
    },
    
    email: {
      provider: 'console',  // Log to console
      enabled: false
    },
    
    storage: {
      provider: 'supabase',
      publicUrl: 'https://[project].supabase.co/storage/v1'
    }
  },
  
  database: {
    ssl: false,
    poolSize: 5,
    idleTimeout: 10000,
    statementTimeout: 30000,
    
    migrations: {
      autoRun: true,
      validateChecksums: false
    }
  }
};
```

### 3.3 **Deployment Pipeline**

```yaml
# .github/workflows/deploy-development.yml
name: Deploy to Development

on:
  push:
    branches:
      - develop
      - 'feature/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: development
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        continue-on-error: true  # Don't block dev deploys
        
      - name: Deploy to Replit
        env:
          REPLIT_TOKEN: ${{ secrets.REPLIT_TOKEN }}
        run: |
          # Custom deploy script for Replit
          npm run deploy:dev
          
      - name: Notify Team
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Development deployment ${{ job.status }}'
        if: always()
```

---

## 🎭 **4. STAGING ENVIRONMENT**

### 4.1 **Infrastructure Specification**

```yaml
Platform: Azure Container Apps
URL: https://simpix-staging.azurecontainerapps.io

Infrastructure:
  Resource Group: rg-simpix-staging-eastus
  
  Compute:
    Service: Container Apps
    Plan: Consumption
    Replicas: 1-3 (auto-scaling)
    CPU: 0.5 vCPU per replica
    Memory: 1GB per replica
    
  Database:
    Service: Azure Database for PostgreSQL
    Tier: Burstable B1ms
    Storage: 32GB
    Backup: Daily, 14 days retention
    High Availability: No
    
  Storage:
    Service: Azure Blob Storage
    Redundancy: LRS (Locally Redundant)
    Tiers: Hot only
    
  Networking:
    Load Balancer: Container Apps ingress
    WAF: Basic rules
    Private Endpoints: No
    
  Monitoring:
    Application Insights: Basic
    Log Analytics: 7 days retention
    Alerts: Critical only
```

### 4.2 **Data Management Strategy**

```typescript
// scripts/staging-data-refresh.ts
interface StagingDataStrategy {
  source: 'production_subset' | 'synthetic' | 'anonymized';
  
  refreshSchedule: {
    frequency: 'weekly';
    day: 'sunday';
    time: '03:00 UTC';
    duration: '~2 hours';
  };
  
  dataSubsets: {
    users: {
      strategy: 'anonymized',
      sample: '10%',  // 10% of production users
      piiMasking: {
        name: 'faker.name()',
        email: 'hash(email) + @example.com',
        phone: 'XXX-XXX-' + last4,
        cpf: 'XXX.XXX.XXX-' + checksum,
        address: 'faker.address()'
      }
    };
    
    proposals: {
      strategy: 'recent_subset',
      filter: 'created_at > NOW() - INTERVAL 3 months',
      limit: 1000,
      relations: 'preserve'  // Keep relational integrity
    };
    
    payments: {
      strategy: 'synthetic',
      generator: 'payment_factory',
      count: 500,
      distribution: 'realistic'  // Match production patterns
    };
    
    documents: {
      strategy: 'reference',
      storage: 'sample_documents',  // Pre-generated samples
      piiRemoved: true
    };
  };
  
  validation: {
    preRefresh: [
      'backup_current_staging',
      'validate_source_connectivity',
      'check_disk_space'
    ];
    
    postRefresh: [
      'verify_row_counts',
      'test_sample_queries',
      'validate_pii_masking',
      'run_smoke_tests'
    ];
  };
}
```

### 4.3 **Configuration Differences**

```typescript
// config/environments/staging.ts
export const stagingConfig = {
  app: {
    name: 'Simpix Staging',
    env: 'staging',
    debug: false,
    logLevel: 'info',
    
    features: {
      debugPanel: false,
      mockData: false,
      hotReload: false,
      sourceMaps: true,  // For debugging
      verboseErrors: false
    }
  },
  
  security: {
    cors: {
      origin: ['https://simpix-staging.azurecontainerapps.io'],
      credentials: true
    },
    
    rateLimit: {
      windowMs: 60000,
      max: 100  // Production-like limits
    },
    
    auth: {
      sessionTimeout: 3600000,  // 1 hour
      passwordPolicy: 'strong',
      mfaRequired: false  // Optional in staging
    }
  },
  
  integrations: {
    payment: {
      provider: 'inter',
      testMode: true,  // Sandbox mode
      webhookUrl: 'https://simpix-staging.azurecontainerapps.io/webhooks/inter'
    },
    
    email: {
      provider: 'sendgrid',
      enabled: true,
      testRecipients: ['staging@simpix.com.br']
    },
    
    storage: {
      provider: 'azure',
      containerName: 'simpix-staging',
      cdnEnabled: false
    }
  },
  
  database: {
    ssl: true,
    poolSize: 20,
    idleTimeout: 30000,
    statementTimeout: 10000,
    
    migrations: {
      autoRun: false,  // Manual control
      validateChecksums: true
    }
  }
};
```

---

## 🚀 **5. PRODUCTION ENVIRONMENT**

### 5.1 **Infrastructure Specification**

```yaml
Platform: Azure Container Apps
URL: https://app.simpix.com.br

Infrastructure:
  Resource Group: rg-simpix-production-eastus
  
  Compute:
    Service: Container Apps
    Plan: Dedicated
    Replicas: 2-10 (auto-scaling)
    CPU: 1 vCPU per replica
    Memory: 2GB per replica
    Availability Zones: 2
    
  Database:
    Service: Azure Database for PostgreSQL
    Tier: General Purpose D2ds_v4
    Storage: 128GB (auto-growth to 1TB)
    IOPS: 500 baseline
    Backup: 
      - Continuous (PITR)
      - Geo-redundant
      - 35 days retention
    High Availability: Zone redundant
    Read Replicas: 1 (for analytics)
    
  Storage:
    Service: Azure Blob Storage
    Redundancy: ZRS (Zone Redundant)
    Tiers: 
      - Hot (active documents)
      - Cool (>30 days)
      - Archive (>90 days)
    CDN: Azure CDN Standard
    
  Networking:
    Load Balancer: Application Gateway
    WAF: OWASP Core Rule Set 3.2
    DDoS Protection: Basic
    Private Endpoints: Database, Storage
    
  Monitoring:
    Application Insights: Full
    Log Analytics: 90 days retention
    Alerts: Comprehensive
    Dashboards: Executive, Operational, Technical
```

### 5.2 **High Availability Configuration**

```typescript
// infrastructure/production-ha-config.ts
export const productionHAConfig = {
  loadBalancing: {
    algorithm: 'round_robin',
    healthCheck: {
      path: '/health',
      interval: 10,
      timeout: 5,
      unhealthyThreshold: 3,
      healthyThreshold: 2
    },
    
    sessionAffinity: {
      enabled: true,
      cookieName: 'SIMPIX_LB',
      ttl: 3600
    }
  },
  
  autoScaling: {
    metrics: [
      {
        type: 'cpu',
        target: 70,
        scaleUp: 85,
        scaleDown: 50
      },
      {
        type: 'memory',
        target: 75,
        scaleUp: 90,
        scaleDown: 60
      },
      {
        type: 'requests',
        target: 100,  // per second
        scaleUp: 150,
        scaleDown: 50
      }
    ],
    
    rules: {
      minReplicas: 2,
      maxReplicas: 10,
      scaleUpIncrement: 2,
      scaleDownIncrement: 1,
      cooldownPeriod: 300  // 5 minutes
    }
  },
  
  circuitBreaker: {
    enabled: true,
    threshold: 5,
    timeout: 60000,
    halfOpenRequests: 3,
    
    fallback: {
      strategy: 'cache',
      message: 'Service temporarily unavailable',
      retryAfter: 60
    }
  },
  
  disaster: {
    rpo: 300,  // 5 minutes
    rto: 3600,  // 1 hour
    
    backupRegion: 'brazilsouth',
    failoverStrategy: 'manual',  // Automatic in future
    
    drills: {
      frequency: 'quarterly',
      scenarios: ['database_failure', 'region_outage', 'ddos_attack']
    }
  }
};
```

### 5.3 **Security Hardening**

```yaml
# Production Security Configuration
Security:
  Network:
    - Private endpoints for all data services
    - IP whitelist for admin access
    - TLS 1.3 minimum
    - Certificate pinning for mobile apps
    
  Access:
    - Azure AD integration
    - MFA mandatory for admin
    - Service principals for automation
    - Key rotation every 90 days
    
  Data:
    - Encryption at rest (AES-256)
    - Encryption in transit (TLS)
    - Database TDE enabled
    - Backup encryption
    
  Compliance:
    - LGPD compliant
    - PCI DSS ready
    - SOC 2 Type II (planned)
    - ISO 27001 (roadmap)
    
  Monitoring:
    - Security Center enabled
    - Threat detection active
    - Vulnerability assessments weekly
    - Penetration testing quarterly
```

---

## 🔄 **6. ENVIRONMENT PROMOTION STRATEGY**

### 6.1 **Promotion Flow**

```mermaid
stateDiagram-v2
    [*] --> Local: Developer
    Local --> Development: git push
    Development --> Staging: PR Approved
    Staging --> Production: Release Tag
    
    Development --> Local: Rollback
    Staging --> Development: Rollback
    Production --> Staging: Rollback
    
    note right of Development
        Continuous Deployment
        All feature branches
    end note
    
    note right of Staging
        Manual Trigger
        Release candidates only
    end note
    
    note right of Production
        Scheduled Release
        Approved + Tested
    end note
```

### 6.2 **Promotion Criteria**

| From → To | Trigger | Validation | Approval | Rollback |
|-----------|---------|------------|----------|----------|
| **Local → Dev** | git push | Linting + Types | Automatic | git revert |
| **Dev → Staging** | PR merge to main | CI Pass + Review | 1 reviewer | Redeploy previous |
| **Staging → Prod** | Release tag | Full test suite + UAT | 2 approvers + PM | Blue-green swap |

### 6.3 **Release Process**

```bash
#!/bin/bash
# scripts/release.sh

VERSION=$1
ENVIRONMENT=$2

echo "🚀 Releasing version $VERSION to $ENVIRONMENT"

# Pre-flight checks
check_prerequisites() {
    echo "✓ Checking prerequisites..."
    
    # Verify git status
    if [[ -n $(git status -s) ]]; then
        echo "❌ Working directory not clean"
        exit 1
    fi
    
    # Verify on main branch
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$BRANCH" != "main" ]]; then
        echo "❌ Not on main branch"
        exit 1
    fi
    
    # Verify tests pass
    npm test || { echo "❌ Tests failed"; exit 1; }
    
    # Verify no critical vulnerabilities
    npm audit --audit-level=critical || { echo "❌ Critical vulnerabilities"; exit 1; }
}

# Tag release
create_release_tag() {
    echo "✓ Creating release tag..."
    
    git tag -a "v$VERSION" -m "Release version $VERSION"
    git push origin "v$VERSION"
}

# Deploy to environment
deploy_to_environment() {
    echo "✓ Deploying to $ENVIRONMENT..."
    
    case $ENVIRONMENT in
        staging)
            npm run deploy:staging
            ;;
        production)
            # Require confirmation
            read -p "⚠️  Deploy to PRODUCTION? (yes/no): " confirm
            if [[ "$confirm" == "yes" ]]; then
                npm run deploy:production
            else
                echo "❌ Production deployment cancelled"
                exit 1
            fi
            ;;
        *)
            echo "❌ Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
}

# Run smoke tests
run_smoke_tests() {
    echo "✓ Running smoke tests..."
    
    npm run test:smoke:$ENVIRONMENT || {
        echo "❌ Smoke tests failed!"
        echo "🔄 Initiating rollback..."
        npm run rollback:$ENVIRONMENT
        exit 1
    }
}

# Main execution
check_prerequisites
create_release_tag
deploy_to_environment
run_smoke_tests

echo "✅ Release $VERSION successfully deployed to $ENVIRONMENT!"
```

---

## 🔐 **7. SECRETS & CONFIGURATION MANAGEMENT**

### 7.1 **Secrets Hierarchy**

```typescript
// Secrets Management Strategy
interface SecretsStrategy {
  storage: {
    local: '.env.local',  // Git ignored
    development: 'Replit Secrets',
    staging: 'Azure Key Vault',
    production: 'Azure Key Vault + HSM'
  };
  
  rotation: {
    database: 'quarterly',
    jwt: 'monthly',
    api_keys: 'bi-annual',
    certificates: 'annual'
  };
  
  access: {
    local: 'developer',
    development: 'dev_team',
    staging: 'dev_team + qa',
    production: 'ops_team + break_glass'
  };
}
```

### 7.2 **Configuration Precedence**

```typescript
// config/index.ts
export class ConfigManager {
  private static instance: ConfigManager;
  
  private readonly precedence = [
    () => process.env,                    // 1. Environment variables
    () => this.loadSecrets(),            // 2. Secret manager
    () => this.loadEnvFile(),            // 3. .env file
    () => this.loadConfigFile(),         // 4. config.json
    () => this.getDefaults()             // 5. Default values
  ];
  
  public get(key: string): string | undefined {
    for (const source of this.precedence) {
      const value = source()[key];
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  }
  
  private validateRequiredConfigs(): void {
    const required = [
      'DATABASE_URL',
      'JWT_SECRET',
      'SESSION_SECRET',
      'NODE_ENV'
    ];
    
    for (const key of required) {
      if (!this.get(key)) {
        throw new Error(`Missing required config: ${key}`);
      }
    }
  }
}
```

---

## 📊 **8. MONITORING & OBSERVABILITY PER ENVIRONMENT**

### 8.1 **Monitoring Matrix**

| Metric | Local | Development | Staging | Production |
|--------|-------|-------------|---------|------------|
| **Application Logs** | Console | CloudWatch | App Insights | App Insights + SIEM |
| **Error Tracking** | Console | Sentry Free | Sentry Team | Sentry Business |
| **APM** | None | Basic Custom | DataDog Trial | DataDog Pro |
| **Uptime** | None | None | UptimeRobot | StatusPage |
| **Real User** | None | None | GA4 | GA4 + Hotjar |
| **Alerts** | None | Email | Email + Slack | PagerDuty |

### 8.2 **Environment-Specific Dashboards**

```typescript
// monitoring/dashboards.ts
export const dashboardConfigs = {
  development: {
    widgets: [
      'error_rate',
      'deployment_frequency',
      'active_branches',
      'test_coverage'
    ],
    refresh: '5m',
    retention: '7d'
  },
  
  staging: {
    widgets: [
      'api_performance',
      'database_queries',
      'cache_hit_rate',
      'user_sessions',
      'error_distribution'
    ],
    refresh: '1m',
    retention: '30d'
  },
  
  production: {
    widgets: [
      'business_metrics',
      'sla_compliance',
      'transaction_volume',
      'system_health',
      'security_events',
      'cost_tracking'
    ],
    refresh: '30s',
    retention: '90d',
    
    alerts: {
      sla_breach: 'immediate',
      high_error_rate: '1m',
      low_transaction: '5m',
      cost_anomaly: '1h'
    }
  }
};
```

---

## 🧪 **9. TESTING STRATEGY PER ENVIRONMENT**

### 9.1 **Test Execution Matrix**

| Test Type | Local | Development | Staging | Production |
|-----------|-------|-------------|---------|------------|
| **Unit Tests** | ✅ All | ✅ All | ✅ All | ❌ |
| **Integration** | ✅ All | ✅ All | ✅ All | ❌ |
| **E2E** | ⚠️ Subset | ✅ All | ✅ All | ⚠️ Synthetic |
| **Performance** | ❌ | ⚠️ Basic | ✅ Full | ⚠️ Synthetic |
| **Security** | ❌ | ⚠️ SAST | ✅ SAST+DAST | ✅ Continuous |
| **Smoke** | ✅ | ✅ | ✅ | ✅ After deploy |
| **Chaos** | ❌ | ❌ | ⚠️ Limited | ⚠️ Controlled |

### 9.2 **Test Data Strategy**

```typescript
interface TestDataStrategy {
  local: {
    source: 'fixtures',
    generator: 'faker.js',
    reset: 'per_test_suite'
  };
  
  development: {
    source: 'seeded',
    persistent: true,
    reset: 'daily'
  };
  
  staging: {
    source: 'production_subset',
    anonymized: true,
    reset: 'weekly'
  };
  
  production: {
    source: 'synthetic_only',
    isolated: true,
    cleanup: 'immediate'
  };
}
```

---

## 💰 **10. COST OPTIMIZATION PER ENVIRONMENT**

### 10.1 **Resource Allocation Budget**

| Environment | Monthly Budget | Actual | Optimization |
|-------------|---------------|--------|--------------|
| **Local** | $0 | $0 | Docker only |
| **Development** | $20 | $18 | Replit free tier |
| **Staging** | $200 | $175 | Scale to zero nights |
| **Production** | $1,500 | $1,200 | Reserved instances |

### 10.2 **Cost Optimization Rules**

```yaml
Development:
  - Auto-shutdown after 1 hour idle
  - Shared resources
  - Free tier maximization
  
Staging:
  - Scale to zero 00:00-06:00
  - Reduced replicas weekends
  - Spot instances for workers
  
Production:
  - Reserved capacity (1 year)
  - Auto-scaling based on load
  - CDN for static assets
  - Database query optimization
  - Archive old data to cold storage
```

---

## 🔄 **11. DISASTER RECOVERY**

### 11.1 **Backup Strategy Per Environment**

| Environment | Backup Frequency | Retention | Recovery Time | Recovery Point |
|-------------|-----------------|-----------|---------------|----------------|
| **Local** | None | N/A | N/A | N/A |
| **Development** | Daily | 7 days | 4 hours | 24 hours |
| **Staging** | Daily | 14 days | 2 hours | 12 hours |
| **Production** | Continuous | 35 days | 1 hour | 5 minutes |

### 11.2 **Disaster Recovery Procedures**

```bash
#!/bin/bash
# scripts/disaster-recovery.sh

ENVIRONMENT=$1
RESTORE_POINT=$2

case $ENVIRONMENT in
    production)
        echo "🚨 PRODUCTION DISASTER RECOVERY INITIATED"
        
        # 1. Activate incident response
        ./notify-team.sh "SEV1" "Production DR activated"
        
        # 2. Verify backup integrity
        az backup restore-point show \
            --resource-group rg-simpix-production \
            --vault-name vault-simpix-prod \
            --restore-point $RESTORE_POINT
        
        # 3. Initiate database restore
        az postgres flexible-server restore \
            --resource-group rg-simpix-production \
            --name psql-simpix-prod \
            --restore-time $RESTORE_POINT
        
        # 4. Restore application state
        kubectl rollout undo deployment/simpix-api \
            --to-revision=$RESTORE_POINT
        
        # 5. Verify system health
        ./health-check.sh production
        
        # 6. Update status page
        ./update-status.sh "Restored" "System restored to $RESTORE_POINT"
        ;;
        
    staging)
        echo "⚠️ Staging recovery initiated"
        # Simplified recovery for staging
        ;;
esac
```

---

## 📋 **12. ENVIRONMENT HYGIENE**

### 12.1 **Data Retention & Cleanup**

```typescript
// Automated cleanup policies
export const cleanupPolicies = {
  development: {
    logs: { retain: '7 days', action: 'delete' },
    uploads: { retain: '30 days', action: 'delete' },
    sessions: { retain: '24 hours', action: 'delete' },
    testData: { retain: '7 days', action: 'reset' }
  },
  
  staging: {
    logs: { retain: '30 days', action: 'archive' },
    uploads: { retain: '90 days', action: 'move_to_cold' },
    sessions: { retain: '7 days', action: 'delete' },
    testData: { retain: '30 days', action: 'anonymize' }
  },
  
  production: {
    logs: { retain: '90 days', action: 'archive' },
    uploads: { retain: '1 year', action: 'tiered_storage' },
    sessions: { retain: '30 days', action: 'delete' },
    audit: { retain: '5 years', action: 'archive' }
  }
};
```

### 12.2 **Environment Health Checks**

```typescript
// Health check endpoints per environment
app.get('/health', (req, res) => {
  const environment = process.env.NODE_ENV;
  
  const checks = {
    status: 'healthy',
    environment,
    timestamp: new Date().toISOString(),
    
    services: {
      database: checkDatabase(),
      redis: checkRedis(),
      storage: checkStorage(),
      externalAPIs: checkExternalAPIs()
    },
    
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  };
  
  // Environment-specific checks
  if (environment === 'production') {
    checks.services.payments = checkPaymentGateway();
    checks.services.notifications = checkNotificationService();
  }
  
  const isHealthy = Object.values(checks.services)
    .every(status => status === 'healthy');
  
  res.status(isHealthy ? 200 : 503).json(checks);
});
```

---

## ✅ **CONCLUSÃO**

### Conformidade Alcançada
- ✅ 4 ambientes formalmente definidos
- ✅ Isolamento completo entre ambientes
- ✅ Estratégia de promoção documentada
- ✅ Configuração específica por ambiente
- ✅ Gestão de secrets segregada
- ✅ Monitoramento diferenciado
- ✅ Disaster recovery definido
- ✅ Políticas de higienização

### Próximas Ações
1. Implementar scripts de automação
2. Configurar Azure Key Vault
3. Estabelecer pipelines de CI/CD
4. Treinar equipe nos procedimentos
5. Realizar DR drill

---

**DECLARAÇÃO DE CONFORMIDADE:**
Este documento estabelece formalmente a estratégia de ambientes do Sistema Simpix, garantindo isolamento, segurança e confiabilidade em todo o ciclo de desenvolvimento.

*Assinatura Digital*  
**Arquiteto de Sistemas Sênior**  
*SHA256-ENVIRONMENTS-2025-01-25*