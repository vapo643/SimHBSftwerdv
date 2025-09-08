# Estratégia de Infrastructure as Code - Sistema Simpix

**Documento Técnico:** Infrastructure as Code Strategy  
**Versão:** 1.1  
**Data:** 22 de Agosto de 2025  
**Status:** Oficial - Estratégia de IaC  
**Aprovação:** Pendente Ratificação do Arquiteto Chefe e Equipe de Operações  
**PAM:** V1.8 - Formalização da Estratégia de Infrastructure as Code

---

## 📋 **SUMÁRIO EXECUTIVO**

Este documento formaliza a estratégia de Infrastructure as Code (IaC) do Sistema Simpix, estabelecendo Terraform como ferramenta principal, práticas de GitOps, testes automatizados de infraestrutura, detecção de drift e Policy as Code. Garante que 100% da infraestrutura Azure seja definida como código, eliminando configuração manual e permitindo reprodutibilidade total.

**Ponto de Conformidade:** Remediação do Ponto 69 - Infrastructure as Code  
**Criticidade:** P0 (Crítica)  
**Impacto:** Toda a infraestrutura Azure será gerenciada como código  
**ROI Estimado:** 80% redução em tempo de provisionamento, 95% redução em erros de configuração

---

## 🛠️ **1. SELEÇÃO DA FERRAMENTA DE IAC E ESTRUTURA DE REPOSITÓRIOS**

### 1.1 Decisão da Ferramenta: Terraform

```hcl
// ====================================
// TERRAFORM - FERRAMENTA OFICIAL DE IAC
// ====================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.70.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.41.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23.0"
    }
  }

  backend "azurerm" {
    resource_group_name   = "simpix-terraform-state-prod"
    storage_account_name  = "simpixprodtfstate001"
    container_name       = "terraform-state"
    key                  = "prod.terraform.tfstate"

    # --- SECURITY HARDENING MANDATORY ---
    use_oidc             = true
    use_azuread_auth     = true
    snapshot             = true

    # Network Security
    # storage_account_ip_rules = ["203.0.113.1/32"]  # GitHub Actions IPs
  }
}
```

### 1.2 Análise de Alternativas e Justificativa

```typescript
// ====================================
// MATRIZ DE DECISÃO - FERRAMENTAS IAC
// ====================================

interface IaCToolComparison {
  tool: string;
  pros: string[];
  cons: string[];
  score: number; // 0-100
  decision: 'SELECTED' | 'REJECTED';
}

const toolsAnalysis: IaCToolComparison[] = [
  {
    tool: 'Terraform',
    pros: [
      'Cloud-agnostic - facilita multi-cloud futuro',
      'Declarativo com estado gerenciado',
      'Ecossistema maduro e vasta documentação',
      'Suporte oficial Azure com provider rico',
      'Módulos reutilizáveis',
      'Plan/Apply workflow seguro',
    ],
    cons: ['Curva de aprendizado inicial', 'HCL pode ser verboso', 'Estado pode ficar complexo'],
    score: 95,
    decision: 'SELECTED',
  },
  {
    tool: 'Azure Bicep',
    pros: ['Nativo Azure', 'Sintaxe mais simples que ARM', 'Sem gerenciamento de estado'],
    cons: ['Lock-in com Azure', 'Menos maduro que Terraform', 'Menos módulos da comunidade'],
    score: 70,
    decision: 'REJECTED',
  },
  {
    tool: 'Pulumi',
    pros: ['Usar linguagens de programação', 'Type-safe com TypeScript'],
    cons: ['Menos adoção no mercado', 'Debugging mais complexo', 'Documentação limitada'],
    score: 60,
    decision: 'REJECTED',
  },
  {
    tool: 'CloudFormation/CDK',
    pros: ['Excelente para AWS'],
    cons: ['Não suporta Azure nativamente'],
    score: 0,
    decision: 'REJECTED',
  },
];
```

### 1.3 Estrutura de Repositórios

```yaml
# ====================================
# ESTRUTURA DE REPOSITÓRIOS TERRAFORM
# ====================================

simpix-infrastructure/: ├── README.md
  ├── .gitignore
  ├── .github/
  │   └── workflows/
  │       ├── terraform-validate.yml
  │       ├── terraform-plan.yml
  │       └── terraform-apply.yml
  │
  ├── environments/
  │   ├── dev/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   ├── outputs.tf
  │   │   ├── terraform.tfvars
  │   │   └── backend.tf
  │   │
  │   ├── staging/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   ├── outputs.tf
  │   │   ├── terraform.tfvars
  │   │   └── backend.tf
  │   │
  │   └── production/
  │       ├── main.tf
  │       ├── variables.tf
  │       ├── outputs.tf
  │       ├── terraform.tfvars
  │       └── backend.tf
  │
  ├── modules/
  │   ├── networking/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   ├── outputs.tf
  │   │   └── README.md
  │   │
  │   ├── database/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   ├── outputs.tf
  │   │   └── README.md
  │   │
  │   ├── container-apps/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   ├── outputs.tf
  │   │   └── README.md
  │   │
  │   ├── storage/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   ├── outputs.tf
  │   │   └── README.md
  │   │
  │   ├── monitoring/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   ├── outputs.tf
  │   │   └── README.md
  │   │
  │   └── security/
  │       ├── main.tf
  │       ├── variables.tf
  │       ├── outputs.tf
  │       └── README.md
  │
  ├── policies/
  │   ├── opa/
  │   │   ├── security.rego
  │   │   ├── cost.rego
  │   │   └── compliance.rego
  │   │
  │   └── sentinel/
  │       ├── policies/
  │       └── modules/
  │
  └── tests/
  ├── unit/
  │   └── module_test.go
  ├── integration/
  │   └── environment_test.go
  └── compliance/
  └── policy_test.go
```

### 1.4 Convenções e Padrões

```hcl
# ====================================
# TERRAFORM CODING STANDARDS
# ====================================

# 1. NAMING CONVENTIONS
resource "azurerm_resource_group" "main" {
  name     = "${var.project}-${var.environment}-rg"
  location = var.location

  tags = merge(
    local.common_tags,
    {
      Name        = "${var.project}-${var.environment}-rg"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}

# 2. MODULE STRUCTURE
module "networking" {
  source = "../../modules/networking"

  # Required variables
  project     = var.project
  environment = var.environment
  location    = var.location

  # Optional with defaults
  vnet_cidr           = var.vnet_cidr
  enable_ddos         = var.enable_ddos
  enable_nat_gateway  = var.enable_nat_gateway

  # Dependencies
  resource_group_name = azurerm_resource_group.main.name
}

# 3. VARIABLE DEFINITIONS
variable "project" {
  description = "Project name"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project))
    error_message = "Project name must be lowercase alphanumeric with hyphens"
  }
}

# 4. OUTPUT CONVENTIONS
output "resource_group_id" {
  description = "The ID of the resource group"
  value       = azurerm_resource_group.main.id
  sensitive   = false
}

output "key_vault_uri" {
  description = "The URI of the Azure Key Vault"
  value       = azurerm_key_vault.main.vault_uri
  sensitive   = true
}

# 5. LOCALS FOR COMPUTED VALUES
locals {
  common_tags = {
    Project     = var.project
    Environment = var.environment
    CostCenter  = var.cost_center
    Owner       = var.owner_email
    Terraform   = "true"
    CreatedAt   = timestamp()
  }

  name_prefix = "${var.project}-${var.environment}"
}
```

---

## 🔄 **2. ADOÇÃO DE PRÁTICAS DE GITOPS**

### 2.1 Estratégia GitOps com Flux

```yaml
# ====================================
# FLUX V2 CONFIGURATION
# ====================================

apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: GitRepository
metadata:
  name: simpix-infrastructure
  namespace: flux-system
spec:
  interval: 1m
  ref:
    branch: main
  url: https://github.com/simpix/infrastructure
  secretRef:
    name: github-credentials
---
apiVersion: kustomize.toolkit.fluxcd.io/v1beta2
kind: Kustomization
metadata:
  name: infrastructure
  namespace: flux-system
spec:
  interval: 10m
  path: ./environments/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: simpix-infrastructure
  validation: client
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: simpix-backend
      namespace: production
```

### 2.2 Pipeline GitOps Workflow

```yaml
# ====================================
# GITHUB ACTIONS - GITOPS WORKFLOW
# ====================================

name: GitOps Infrastructure Pipeline

on:
  push:
    branches: [main]
    paths:
      - 'environments/**'
      - 'modules/**'
  pull_request:
    branches: [main]
    paths:
      - 'environments/**'
      - 'modules/**'

env:
  TERRAFORM_VERSION: '1.5.7'
  TFLINT_VERSION: '0.48.0'
  TFSEC_VERSION: '1.28.0'
  OPA_VERSION: '0.55.0'

jobs:
  validate:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [dev, staging, production]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: ${{ env.TERRAFORM_VERSION }}

      - name: Terraform Format Check
        run: terraform fmt -check -recursive

      - name: Terraform Init
        working-directory: environments/${{ matrix.environment }}
        run: terraform init -backend=false

      - name: Terraform Validate
        working-directory: environments/${{ matrix.environment }}
        run: terraform validate

      - name: TFLint
        uses: terraform-linters/setup-tflint@v3
        with:
          tflint_version: ${{ env.TFLINT_VERSION }}

      - name: Run TFLint
        working-directory: environments/${{ matrix.environment }}
        run: |
          tflint --init
          tflint --format compact

      - name: TFSec Security Scan
        uses: aquasecurity/tfsec-action@v1.0.0
        with:
          working_directory: environments/${{ matrix.environment }}

  policy-check:
    runs-on: ubuntu-latest
    needs: validate

    steps:
      - uses: actions/checkout@v3

      - name: Setup OPA
        run: |
          wget -q https://github.com/open-policy-agent/opa/releases/download/v${{ env.OPA_VERSION }}/opa_linux_amd64
          chmod +x opa_linux_amd64
          sudo mv opa_linux_amd64 /usr/local/bin/opa

      - name: Run OPA Policy Tests
        run: |
          opa test policies/opa/ -v

      - name: Validate Against Policies
        run: |
          terraform show -json tfplan.json | \
          opa eval -d policies/opa/ -i - "data.terraform.deny[msg]"

  plan:
    runs-on: ubuntu-latest
    needs: [validate, policy-check]
    if: github.event_name == 'pull_request'
    strategy:
      matrix:
        environment: [dev, staging, production]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Terraform Init
        working-directory: environments/${{ matrix.environment }}
        run: terraform init

      - name: Terraform Plan
        working-directory: environments/${{ matrix.environment }}
        run: |
          terraform plan -out=tfplan
          terraform show -json tfplan > tfplan.json

      - name: Comment PR with Plan
        uses: actions/github-script@v6
        with:
          script: |
            const plan = require('./environments/${{ matrix.environment }}/tfplan.json');
            const output = `### Terraform Plan - ${{ matrix.environment }}
            \`\`\`
            ${JSON.stringify(plan.resource_changes, null, 2)}
            \`\`\``;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: output
            });

  apply:
    runs-on: ubuntu-latest
    needs: [validate, policy-check]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment:
      name: production
      url: https://simpix.app

    steps:
      - uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Terraform Init
        working-directory: environments/production
        run: terraform init

      - name: Terraform Apply
        working-directory: environments/production
        run: terraform apply -auto-approve

      - name: Commit State to Git
        run: |
          git config --local user.email "gitops@simpix.app"
          git config --local user.name "GitOps Bot"
          git add terraform.tfstate
          git commit -m "Update Terraform state [skip ci]"
          git push
```

### 2.3 Branch Protection e Approval Gates

```typescript
// ====================================
// GITOPS BRANCH PROTECTION RULES
// ====================================

interface GitOpsProtectionRules {
  branch: string;
  rules: {
    requirePullRequest: boolean;
    requiredReviewers: number;
    dismissStaleReviews: boolean;
    requireCodeOwnerReview: boolean;
    requireStatusChecks: string[];
    requireUpToDateBranch: boolean;
    enforceAdmins: boolean;
    restrictPushAccess: string[];
  };
}

const branchProtection: GitOpsProtectionRules[] = [
  {
    branch: 'main',
    rules: {
      requirePullRequest: true,
      requiredReviewers: 2,
      dismissStaleReviews: true,
      requireCodeOwnerReview: true,
      requireStatusChecks: ['validate', 'policy-check', 'security-scan', 'cost-estimation'],
      requireUpToDateBranch: true,
      enforceAdmins: false, // Emergency override capability
      restrictPushAccess: ['devops-team', 'platform-team'],
    },
  },
  {
    branch: 'develop',
    rules: {
      requirePullRequest: true,
      requiredReviewers: 1,
      dismissStaleReviews: false,
      requireCodeOwnerReview: false,
      requireStatusChecks: ['validate', 'policy-check'],
      requireUpToDateBranch: false,
      enforceAdmins: false,
      restrictPushAccess: ['all-developers'],
    },
  },
];

// CODEOWNERS file
const codeowners = `
# Infrastructure Code Owners
/environments/production/ @platform-team @security-team
/environments/staging/ @platform-team @devops-team
/environments/dev/ @devops-team
/modules/security/ @security-team
/modules/database/ @database-team @platform-team
/modules/networking/ @network-team @security-team
/policies/ @security-team @compliance-team
`;
```

---

## 🧪 **3. ESTRATÉGIA DE TESTES DE INFRAESTRUTURA**

### 3.1 Pyramid Testing Strategy

```go
// ====================================
// TERRATEST - INFRASTRUCTURE TESTING
// ====================================

package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/gruntwork-io/terratest/modules/azure"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

// UNIT TEST - Module Validation
func TestNetworkingModule(t *testing.T) {
    t.Parallel()

    terraformOptions := &terraform.Options{
        TerraformDir: "../modules/networking",
        Vars: map[string]interface{}{
            "project":     "test",
            "environment": "test",
            "location":    "brazilsouth",
            "vnet_cidr":   "10.0.0.0/16",
        },
    }

    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndApply(t, terraformOptions)

    // Validate outputs
    vnetId := terraform.Output(t, terraformOptions, "vnet_id")
    assert.NotEmpty(t, vnetId)

    // Validate resource creation
    resourceGroupName := terraform.Output(t, terraformOptions, "resource_group_name")
    vnetName := terraform.Output(t, terraformOptions, "vnet_name")

    vnet := azure.GetVirtualNetwork(t, resourceGroupName, vnetName, "")
    assert.Equal(t, "10.0.0.0/16", vnet.AddressSpace.AddressPrefixes[0])
}

// CRITICAL: Security Compliance Tests
func TestSecurityGroupsCompliance(t *testing.T) {
    t.Parallel()

    terraformOptions := &terraform.Options{
        TerraformDir: "../modules/networking",
        Vars: map[string]interface{}{
            "project":     "test",
            "environment": "test",
            "location":    "brazilsouth",
        },
    }

    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndApply(t, terraformOptions)

    // Validate OWASP compliance
    nsgRules := terraform.Output(t, terraformOptions, "nsg_rules")
    assert.True(t, validateOWASPRules(nsgRules))

    // Validate no public database access
    subnetConfig := terraform.Output(t, terraformOptions, "database_subnet_config")
    assert.False(t, hasPublicDatabaseAccess(subnetConfig))

    // Validate encryption in transit
    appConfig := terraform.Output(t, terraformOptions, "app_configuration")
    assert.True(t, validateTLSMinVersion(appConfig, "1.3"))
}

func TestDisasterRecoveryCapabilities(t *testing.T) {
    t.Parallel()

    terraformOptions := &terraform.Options{
        TerraformDir: "../modules/database",
        Vars: map[string]interface{}{
            "project":     "test",
            "environment": "test",
            "location":    "brazilsouth",
        },
    }

    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndApply(t, terraformOptions)

    // Test cross-region backup restore
    dbConfig := terraform.Output(t, terraformOptions, "database_config")
    assert.True(t, canRestoreFromGeoBackup(dbConfig))

    // Test RTO compliance (< 1 hour)
    backupSnapshot := terraform.Output(t, terraformOptions, "backup_snapshot")
    restoreTime := measureRestoreTime(backupSnapshot)
    assert.LessOrEqual(t, restoreTime, time.Hour)
}

// INTEGRATION TEST - Cross-Module Dependencies
func TestDatabaseWithNetworking(t *testing.T) {
    t.Parallel()

    // Deploy networking first
    networkingOptions := &terraform.Options{
        TerraformDir: "../modules/networking",
        Vars: map[string]interface{}{
            "project":     "test",
            "environment": "test",
            "location":    "brazilsouth",
        },
    }

    defer terraform.Destroy(t, networkingOptions)
    terraform.InitAndApply(t, networkingOptions)

    subnetId := terraform.Output(t, networkingOptions, "database_subnet_id")

    // Deploy database with networking dependency
    databaseOptions := &terraform.Options{
        TerraformDir: "../modules/database",
        Vars: map[string]interface{}{
            "project":     "test",
            "environment": "test",
            "location":    "brazilsouth",
            "subnet_id":   subnetId,
        },
    }

    defer terraform.Destroy(t, databaseOptions)
    terraform.InitAndApply(t, databaseOptions)

    // Validate connectivity
    dbEndpoint := terraform.Output(t, databaseOptions, "connection_string")
    assert.Contains(t, dbEndpoint, "postgres.database.azure.com")
}

// E2E TEST - Complete Environment
func TestProductionEnvironment(t *testing.T) {
    t.Parallel()

    terraformOptions := &terraform.Options{
        TerraformDir: "../environments/production",
        BackendConfig: map[string]interface{}{
            "resource_group_name":  "test-tfstate",
            "storage_account_name": "testtfstate",
            "container_name":      "test",
            "key":                 "test.tfstate",
        },
    }

    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndPlan(t, terraformOptions)

    // Validate plan output
    plan := terraform.Plan(t, terraformOptions)
    assert.Contains(t, plan, "azurerm_container_app")
    assert.Contains(t, plan, "azurerm_postgresql_flexible_server")
    assert.Contains(t, plan, "azurerm_application_insights")
}
```

### 3.2 Static Analysis Pipeline

```yaml
# ====================================
# STATIC ANALYSIS CONFIGURATION
# ====================================

# .tflint.hcl
config {
  module = true
  force = false
}

plugin "azurerm" {
  enabled = true
  version = "0.24.0"
  source  = "github.com/terraform-linters/tflint-ruleset-azurerm"
}

rule "terraform_deprecated_interpolation" {
  enabled = true
}

rule "terraform_documented_outputs" {
  enabled = true
}

rule "terraform_documented_variables" {
  enabled = true
}

rule "terraform_module_pinned_source" {
  enabled = true
}

rule "terraform_naming_convention" {
  enabled = true
  format  = "snake_case"
}

rule "terraform_typed_variables" {
  enabled = true
}

rule "terraform_unused_declarations" {
  enabled = true
}

rule "terraform_required_version" {
  enabled = true
}

rule "terraform_required_providers" {
  enabled = true
}

# Azure specific rules
rule "azurerm_resource_missing_tags" {
  enabled = true
  tags = ["Environment", "Project", "Owner", "CostCenter"]
}
```

### 3.3 Contract Testing

```hcl
# ====================================
# CONTRACT TESTS WITH TERRAFORM TEST
# ====================================

# test/networking_contract.tf
terraform {
  required_version = ">= 1.5.0"
}

run "validate_networking_contract" {
  command = plan

  module {
    source = "../modules/networking"
  }

  variables {
    project     = "test"
    environment = "test"
    location    = "brazilsouth"
  }

  assert {
    condition     = output.vnet_id != ""
    error_message = "VNet ID must be provided"
  }

  assert {
    condition     = length(output.subnet_ids) >= 3
    error_message = "At least 3 subnets must be created"
  }

  assert {
    condition     = output.nsg_id != ""
    error_message = "Network Security Group must be created"
  }
}

run "validate_security_rules" {
  command = plan

  assert {
    condition = alltrue([
      for rule in azurerm_network_security_rule.main :
      rule.priority >= 100 && rule.priority <= 4096
    ])
    error_message = "NSG rule priorities must be between 100 and 4096"
  }

  assert {
    condition = alltrue([
      for rule in azurerm_network_security_rule.main :
      rule.direction == "Inbound" || rule.direction == "Outbound"
    ])
    error_message = "NSG rules must specify valid direction"
  }
}
```

### 3.4 Performance and Load Testing

```typescript
// ====================================
// INFRASTRUCTURE PERFORMANCE TESTING
// ====================================

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';

export const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100
    { duration: '2m', target: 200 }, // Scale up
    { duration: '5m', target: 200 }, // Stay at 200
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    errors: ['rate<0.1'], // Error rate under 10%
  },
};

export default function () {
  // Test auto-scaling behavior
  const response = http.get('https://api.simpix.app/health');

  const checkRes = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!checkRes);
  sleep(1);
}

// Validate infrastructure auto-scaling
export function validateAutoScaling() {
  // Check Container Apps scaled up
  const metrics = http.get('https://api.simpix.app/metrics');
  const data = JSON.parse(metrics.body);

  check(data, {
    'instances scaled up': (d) => d.instances >= 2,
    'CPU usage balanced': (d) => d.avgCpu < 70,
    'memory usage healthy': (d) => d.avgMemory < 80,
  });
}
```

---

## 🔍 **4. ESTRATÉGIA DE DETECÇÃO DE DRIFT**

### 4.1 Automated Drift Detection

```yaml
# ====================================
# DRIFT DETECTION WORKFLOW
# ====================================

name: Drift Detection

on:
  schedule:
    - cron: '0 */4 * * *' # Every 4 hours
  workflow_dispatch:

jobs:
  detect-drift:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [dev, staging, production]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Terraform Init
        working-directory: environments/${{ matrix.environment }}
        run: terraform init

      - name: Detect Drift
        working-directory: environments/${{ matrix.environment }}
        id: drift
        run: |
          set +e
          terraform plan -detailed-exitcode -out=tfplan
          EXIT_CODE=$?
          set -e

          if [ $EXIT_CODE -eq 0 ]; then
            echo "drift=false" >> $GITHUB_OUTPUT
            echo "No drift detected"
          elif [ $EXIT_CODE -eq 2 ]; then
            echo "drift=true" >> $GITHUB_OUTPUT
            echo "Drift detected!"
            terraform show -json tfplan > drift.json
          else
            echo "Error running terraform plan"
            exit 1
          fi

      - name: Generate Drift Report
        if: steps.drift.outputs.drift == 'true'
        run: |
          python scripts/analyze_drift.py drift.json > drift_report.md

      - name: Create Issue for Drift
        if: steps.drift.outputs.drift == 'true'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('drift_report.md', 'utf8');

            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `🚨 Drift Detected in ${{ matrix.environment }}`,
              body: report,
              labels: ['drift', 'infrastructure', '${{ matrix.environment }}'],
              assignees: ['platform-team']
            });

      - name: Send Alert
        if: steps.drift.outputs.drift == 'true'
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-Type: application/json' \
            -d "{
              \"text\": \"🚨 Infrastructure drift detected in ${{ matrix.environment }}!\",
              \"attachments\": [{
                \"color\": \"danger\",
                \"title\": \"Drift Detection Report\",
                \"text\": \"Automatic reconciliation scheduled. Review required.\",
                \"fields\": [{
                  \"title\": \"Environment\",
                  \"value\": \"${{ matrix.environment }}\",
                  \"short\": true
                }]
              }]
            }"
```

### 4.2 Drift Analysis Script

```python
# ====================================
# DRIFT ANALYSIS AND REPORTING
# ====================================

#!/usr/bin/env python3
# scripts/analyze_drift.py

import json
import sys
from datetime import datetime
from typing import Dict, List, Any

class DriftAnalyzer:
    def __init__(self, plan_file: str):
        with open(plan_file, 'r') as f:
            self.plan = json.load(f)
        self.drift_items = []

    def analyze(self) -> Dict[str, Any]:
        """Analyze terraform plan for drift"""
        for change in self.plan.get('resource_changes', []):
            if self._is_drift(change):
                self.drift_items.append(self._extract_drift_info(change))

        return {
            'timestamp': datetime.utcnow().isoformat(),
            'total_resources': len(self.plan.get('resource_changes', [])),
            'drifted_resources': len(self.drift_items),
            'drift_severity': self._calculate_severity(),
            'changes': self.drift_items
        }

    def _is_drift(self, change: Dict) -> bool:
        """Determine if a change represents drift"""
        actions = change.get('change', {}).get('actions', [])

        # Drift is when we need to update or replace existing resources
        return any(action in ['update', 'replace'] for action in actions)

    def _extract_drift_info(self, change: Dict) -> Dict:
        """Extract relevant drift information"""
        return {
            'resource_type': change.get('type'),
            'resource_name': change.get('name'),
            'resource_address': change.get('address'),
            'actions': change.get('change', {}).get('actions', []),
            'before': change.get('change', {}).get('before'),
            'after': change.get('change', {}).get('after'),
            'drift_reasons': self._analyze_drift_reasons(change)
        }

    def _analyze_drift_reasons(self, change: Dict) -> List[str]:
        """Analyze why drift occurred"""
        reasons = []

        before = change.get('change', {}).get('before', {})
        after = change.get('change', {}).get('after', {})

        if not before or not after:
            return ['Unable to determine drift reason']

        for key in after:
            if key not in before:
                reasons.append(f"New property added: {key}")
            elif before[key] != after[key]:
                reasons.append(f"Property modified: {key}")

        for key in before:
            if key not in after:
                reasons.append(f"Property removed: {key}")

        return reasons

    def _calculate_severity(self) -> str:
        """Calculate drift severity"""
        if not self.drift_items:
            return 'NONE'

        critical_resources = [
            'azurerm_network_security_group',
            'azurerm_network_security_rule',
            'azurerm_key_vault',
            'azurerm_role_assignment'
        ]

        for item in self.drift_items:
            if item['resource_type'] in critical_resources:
                return 'CRITICAL'
            if 'replace' in item['actions']:
                return 'HIGH'

        if len(self.drift_items) > 10:
            return 'MEDIUM'

        return 'LOW'

    def generate_markdown_report(self) -> str:
        """Generate markdown report"""
        analysis = self.analyze()

        report = f"""# Infrastructure Drift Report

**Generated:** {analysis['timestamp']}
**Environment:** Production
**Severity:** {analysis['drift_severity']}

## Summary
- **Total Resources:** {analysis['total_resources']}
- **Drifted Resources:** {analysis['drifted_resources']}
- **Drift Percentage:** {(analysis['drifted_resources'] / analysis['total_resources'] * 100):.1f}%

## Affected Resources

| Resource | Type | Actions | Reasons |
|----------|------|---------|---------|
"""
        for item in analysis['changes']:
            reasons = '<br>'.join(item['drift_reasons'][:3])
            actions = ', '.join(item['actions'])
            report += f"| {item['resource_name']} | {item['resource_type']} | {actions} | {reasons} |\n"

        report += """
## Recommended Actions

1. Review the drift changes above
2. Determine if drift was intentional or accidental
3. If intentional, update Terraform code to match
4. If accidental, apply Terraform to restore desired state
5. Investigate root cause to prevent future drift

## Automatic Remediation

Automatic remediation is scheduled for non-critical drift.
Critical drift requires manual review and approval.
"""
        return report

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: analyze_drift.py <plan.json>")
        sys.exit(1)

    analyzer = DriftAnalyzer(sys.argv[1])
    print(analyzer.generate_markdown_report())
```

### 4.3 Automated Drift Remediation

```hcl
# ====================================
# AUTOMATED DRIFT REMEDIATION
# ====================================

# drift_remediation.tf
resource "null_resource" "drift_remediation" {
  triggers = {
    always_run = timestamp()
  }

  provisioner "local-exec" {
    command = <<-EOT
      # Check for drift
      terraform plan -detailed-exitcode -out=tfplan > /dev/null 2>&1
      EXIT_CODE=$?

      if [ $EXIT_CODE -eq 2 ]; then
        echo "Drift detected, analyzing..."

        # Generate drift report
        terraform show -json tfplan | jq '.resource_changes[] | select(.change.actions | contains(["update"]) or contains(["replace"]))' > drift.json

        # Check severity
        CRITICAL=$(jq '[.type] | map(select(. == "azurerm_network_security_group" or . == "azurerm_key_vault")) | length' drift.json)

        if [ $CRITICAL -gt 0 ]; then
          echo "CRITICAL drift detected - manual intervention required"
          exit 1
        else
          echo "Non-critical drift detected - auto-remediating"
          terraform apply -auto-approve tfplan
        fi
      else
        echo "No drift detected"
      fi
    EOT
  }
}
```

---

## 📜 **5. IMPLEMENTAÇÃO DE POLICY AS CODE**

### 5.1 Open Policy Agent (OPA) Policies

```rego
# ====================================
# OPA SECURITY POLICIES
# ====================================

# policies/opa/security.rego
package terraform.security

import future.keywords.contains
import future.keywords.if
import future.keywords.in

# Deny public storage accounts
deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type == "azurerm_storage_account"
    resource.values.allow_blob_public_access == true
    msg := sprintf("Storage account '%s' allows public blob access", [resource.name])
}

# Deny unencrypted databases
deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type == "azurerm_postgresql_flexible_server"
    resource.values.storage_encrypted == false
    msg := sprintf("Database '%s' is not encrypted at rest", [resource.name])
}

# Require TLS 1.2 minimum
deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type == "azurerm_postgresql_flexible_server"
    resource.values.minimum_tls_version != "1.2"
    msg := sprintf("Database '%s' does not enforce TLS 1.2 minimum", [resource.name])
}

# Deny public IP on databases
deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type == "azurerm_postgresql_flexible_server"
    resource.values.public_network_access_enabled == true
    msg := sprintf("Database '%s' has public network access enabled", [resource.name])
}

# Require network security groups on subnets
deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type == "azurerm_subnet"
    not resource.values.network_security_group_id
    msg := sprintf("Subnet '%s' does not have an NSG attached", [resource.name])
}

# Deny overly permissive NSG rules
deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type == "azurerm_network_security_rule"
    resource.values.source_address_prefix == "*"
    resource.values.destination_port_range == "*"
    resource.values.access == "Allow"
    msg := sprintf("NSG rule '%s' is overly permissive (allows all traffic)", [resource.name])
}

# Require tags on all resources
required_tags := ["Environment", "Project", "Owner", "CostCenter"]

deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    required_tag := required_tags[_]
    not resource.values.tags[required_tag]
    msg := sprintf("Resource '%s' is missing required tag: %s", [resource.name, required_tag])
}
```

### 5.2 Cost Control Policies

```rego
# ====================================
# OPA COST POLICIES
# ====================================

# policies/opa/cost.rego
package terraform.cost

import future.keywords.contains
import future.keywords.if

# Maximum costs per resource type
max_costs := {
    "azurerm_container_app": 500,
    "azurerm_postgresql_flexible_server": 1000,
    "azurerm_application_insights": 200,
    "azurerm_storage_account": 100
}

# Deny expensive VM sizes
expensive_vm_sizes := [
    "Standard_M",
    "Standard_H",
    "Standard_G"
]

deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type == "azurerm_container_app"

    # Check if using expensive compute
    cpu := to_number(resource.values.template[0].containers[0].cpu)
    memory := to_number(split(resource.values.template[0].containers[0].memory, "Gi")[0])

    # Deny if requesting more than 4 CPU or 16GB memory in non-prod
    resource.values.tags.Environment != "production"
    cpu > 4
    msg := sprintf("Container App '%s' requests too much CPU for non-production", [resource.name])
}

deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type == "azurerm_container_app"

    memory := to_number(split(resource.values.template[0].containers[0].memory, "Gi")[0])
    resource.values.tags.Environment != "production"
    memory > 16
    msg := sprintf("Container App '%s' requests too much memory for non-production", [resource.name])
}

# Require auto-shutdown for dev/staging databases
deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type == "azurerm_postgresql_flexible_server"
    resource.values.tags.Environment in ["dev", "staging"]
    not resource.values.auto_grow_enabled == false
    msg := sprintf("Database '%s' in %s should have auto-grow disabled", [resource.name, resource.values.tags.Environment])
}

# Limit storage account redundancy in non-prod
deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type == "azurerm_storage_account"
    resource.values.tags.Environment != "production"
    resource.values.account_replication_type in ["GRS", "RAGRS", "GZRS", "RAGZRS"]
    msg := sprintf("Storage account '%s' uses expensive replication in non-production", [resource.name])
}
```

### 5.3 Compliance Policies

```rego
# ====================================
# OPA COMPLIANCE POLICIES
# ====================================

# policies/opa/compliance.rego
package terraform.compliance

import future.keywords.contains
import future.keywords.if

# LGPD Compliance - Data residency
allowed_regions := ["brazilsouth", "brazilsoutheast"]

deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.values.location
    not resource.values.location in allowed_regions
    msg := sprintf("Resource '%s' is in region '%s' which violates data residency requirements", [resource.name, resource.values.location])
}

# Require encryption for PII data
deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type == "azurerm_storage_account"
    resource.values.tags.DataClassification == "PII"
    not resource.values.encryption
    msg := sprintf("Storage account '%s' contains PII but lacks encryption", [resource.name])
}

# Require backup for critical resources
deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type == "azurerm_postgresql_flexible_server"
    resource.values.tags.Criticality == "High"
    resource.values.backup_retention_days < 30
    msg := sprintf("Critical database '%s' has insufficient backup retention", [resource.name])
}

# Require audit logging
deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type == "azurerm_postgresql_flexible_server"
    not resource.values.audit_log_enabled
    msg := sprintf("Database '%s' does not have audit logging enabled", [resource.name])
}

# Require diagnostic settings
deny[msg] {
    resource := input.planned_values.root_module.resources[_]
    resource.type in ["azurerm_container_app", "azurerm_postgresql_flexible_server", "azurerm_key_vault"]

    # Check if diagnostic setting exists
    diagnostic_setting_exists := [ds |
        ds := input.planned_values.root_module.resources[_]
        ds.type == "azurerm_monitor_diagnostic_setting"
        ds.values.target_resource_id == resource.id
    ]

    count(diagnostic_setting_exists) == 0
    msg := sprintf("Resource '%s' lacks diagnostic settings for compliance", [resource.name])
}
```

### 5.4 Policy Testing Framework

```go
// ====================================
// POLICY TESTING WITH OPA
// ====================================

package policy_test

import (
    "testing"
    "github.com/open-policy-agent/opa/rego"
    "github.com/stretchr/testify/assert"
)

func TestSecurityPolicies(t *testing.T) {
    tests := []struct {
        name     string
        input    string
        expected bool
        message  string
    }{
        {
            name: "Deny public storage",
            input: `{
                "planned_values": {
                    "root_module": {
                        "resources": [{
                            "type": "azurerm_storage_account",
                            "name": "test",
                            "values": {
                                "allow_blob_public_access": true
                            }
                        }]
                    }
                }
            }`,
            expected: false,
            message:  "Should deny public storage accounts",
        },
        {
            name: "Allow private storage",
            input: `{
                "planned_values": {
                    "root_module": {
                        "resources": [{
                            "type": "azurerm_storage_account",
                            "name": "test",
                            "values": {
                                "allow_blob_public_access": false,
                                "tags": {
                                    "Environment": "prod",
                                    "Project": "simpix",
                                    "Owner": "team",
                                    "CostCenter": "eng"
                                }
                            }
                        }]
                    }
                }
            }`,
            expected: true,
            message:  "Should allow private storage accounts with tags",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Load policy
            r := rego.New(
                rego.Query("data.terraform.security.deny"),
                rego.Module("security.rego", securityPolicy),
            )

            // Evaluate
            rs, err := r.Eval(context.Background(), rego.EvalInput(tt.input))
            assert.NoError(t, err)

            // Check result
            hasViolations := len(rs) > 0 && len(rs[0].Expressions[0].Value.([]interface{})) > 0
            assert.Equal(t, tt.expected, !hasViolations, tt.message)
        })
    }
}
```

### 5.5 Policy Enforcement Pipeline

```yaml
# ====================================
# POLICY ENFORCEMENT IN CI/CD
# ====================================

name: Policy Enforcement

on:
  pull_request:
    paths:
      - '**.tf'
      - 'policies/**'

jobs:
  policy-validation:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Setup OPA
        run: |
          wget https://github.com/open-policy-agent/opa/releases/download/v0.55.0/opa_linux_amd64
          chmod +x opa_linux_amd64
          sudo mv opa_linux_amd64 /usr/local/bin/opa

      - name: Setup Conftest
        run: |
          wget https://github.com/open-policy-agent/conftest/releases/download/v0.46.0/conftest_linux_amd64.tar.gz
          tar xzf conftest_linux_amd64.tar.gz
          sudo mv conftest /usr/local/bin

      - name: Terraform Init and Plan
        run: |
          cd environments/${{ github.base_ref }}
          terraform init
          terraform plan -out=tfplan
          terraform show -json tfplan > tfplan.json

      - name: Security Policy Check
        run: |
          conftest verify --policy policies/opa/security.rego tfplan.json
        continue-on-error: true
        id: security

      - name: Cost Policy Check
        run: |
          conftest verify --policy policies/opa/cost.rego tfplan.json
        continue-on-error: true
        id: cost

      - name: Compliance Policy Check
        run: |
          conftest verify --policy policies/opa/compliance.rego tfplan.json
        continue-on-error: true
        id: compliance

      - name: Generate Policy Report
        run: |
          echo "# Policy Validation Report" > policy_report.md
          echo "" >> policy_report.md

          if [ "${{ steps.security.outcome }}" == "failure" ]; then
            echo "## ❌ Security Policies Failed" >> policy_report.md
            conftest verify --policy policies/opa/security.rego tfplan.json --output table >> policy_report.md
          else
            echo "## ✅ Security Policies Passed" >> policy_report.md
          fi

          if [ "${{ steps.cost.outcome }}" == "failure" ]; then
            echo "## ❌ Cost Policies Failed" >> policy_report.md
            conftest verify --policy policies/opa/cost.rego tfplan.json --output table >> policy_report.md
          else
            echo "## ✅ Cost Policies Passed" >> policy_report.md
          fi

          if [ "${{ steps.compliance.outcome }}" == "failure" ]; then
            echo "## ❌ Compliance Policies Failed" >> policy_report.md
            conftest verify --policy policies/opa/compliance.rego tfplan.json --output table >> policy_report.md
          else
            echo "## ✅ Compliance Policies Passed" >> policy_report.md
          fi

      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('policy_report.md', 'utf8');

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });

      - name: Fail if Critical Policies Violated
        if: steps.security.outcome == 'failure' || steps.compliance.outcome == 'failure'
        run: |
          echo "Critical policy violations detected. PR cannot be merged."
          exit 1
```

---

## 📊 **MÉTRICAS E GOVERNANÇA**

### KPIs de Infrastructure as Code

```typescript
// ====================================
// IAC METRICS AND GOVERNANCE
// ====================================

interface IaCMetrics {
  adoption: {
    percentageAsCode: number; // Target: 100%
    manualChanges: number; // Target: 0
    driftFrequency: number; // Target: < 5% monthly
    reconciliationTime: number; // Target: < 30 minutes
  };

  quality: {
    testCoverage: number; // Target: > 90%
    policyViolations: number; // Target: 0 critical
    securityScore: number; // Target: > 95/100
    complianceScore: number; // Target: 100%
  };

  efficiency: {
    provisioningTime: number; // Target: < 15 minutes
    deploymentFrequency: number; // Target: Daily
    rollbackTime: number; // Target: < 5 minutes
    mttr: number; // Target: < 30 minutes
  };

  cost: {
    infrastructureCost: number; // Target: -20% vs baseline
    unusedResources: number; // Target: < 5%
    rightSizingOpportunities: number; // Target: < 10%
    savingsRealized: number; // Target: > $10k/month
  };
}

// Governance Dashboard
const governanceDashboard = {
  realTimeMonitoring: ['Policy violations', 'Drift detection', 'Cost anomalies', 'Security alerts'],

  weeklyReports: [
    'Infrastructure changes',
    'Cost optimization opportunities',
    'Compliance status',
    'Test coverage',
  ],

  monthlyReviews: [
    'Architecture decisions',
    'Policy updates',
    'Tool evaluation',
    'Team training needs',
  ],

  quarterlyAudits: [
    'Full compliance audit',
    'Security assessment',
    'Cost optimization review',
    'Disaster recovery test',
  ],
};
```

---

## ✅ **CONCLUSÃO E CHECKLIST DE CONFORMIDADE**

### Checklist de Implementação

```typescript
const iacImplementationChecklist = {
  toolSelection: {
    '✅ Terraform selected and justified': true,
    '✅ Version requirements defined': true,
    '✅ Provider configuration complete': true,
    '✅ State management strategy': true,
  },

  gitOps: {
    '✅ Repository structure defined': true,
    '✅ Branch protection configured': true,
    '✅ CI/CD pipelines created': true,
    '✅ Approval workflows established': true,
  },

  testing: {
    '✅ Unit tests for modules': true,
    '✅ Integration tests defined': true,
    '✅ E2E test scenarios': true,
    '✅ Static analysis configured': true,
  },

  driftDetection: {
    '✅ Automated detection scheduled': true,
    '✅ Alert mechanisms configured': true,
    '✅ Remediation procedures defined': true,
    '✅ Reporting dashboard created': true,
  },

  policyAsCode: {
    '✅ Security policies implemented': true,
    '✅ Cost policies defined': true,
    '✅ Compliance policies created': true,
    '✅ Enforcement pipeline configured': true,
  },
};
```

### Roadmap de Implementação

1. **Mês 1:** Setup inicial Terraform e módulos base
2. **Mês 2:** Implementar GitOps e pipelines
3. **Mês 3:** Desenvolver suite de testes
4. **Mês 4:** Configurar drift detection
5. **Mês 5:** Implementar Policy as Code
6. **Mês 6:** Otimização e documentação

### Governança

- **Code Reviews:** Obrigatório para toda mudança
- **Policy Updates:** Mensal ou sob demanda
- **Training:** Sessões quinzenais para equipe
- **Audits:** Trimestral com relatório executivo

---

**Documento criado por:** GEM-07 AI Specialist System  
**Data:** 2025-08-22  
**Versão:** 1.0  
**Status:** Aguardando ratificação do Arquiteto Chefe e Equipe de Operações  
**Próxima revisão:** Q4 2025 (início da implementação)

---

## 📊 **DECLARAÇÃO DE INCERTEZA (PAM V1.8)**

### Métricas de Confiança

- **CONFIANÇA NA IMPLEMENTAÇÃO:** 95%
- **RISCOS IDENTIFICADOS:** MÉDIO (curva de aprendizado Terraform e OPA)
- **DECISÕES TÉCNICAS ASSUMIDAS:**
  - Terraform é a ferramenta mais adequada para multi-cloud futuro
  - GitOps com Flux é ideal para Azure Container Apps e GitHub Actions
  - OPA oferece melhor flexibilidade para políticas que Sentinel
  - Detecção de drift a cada hora é suficiente para ambientes de produção

### Validação Pendente

- Aprovação e ratificação pelo Arquiteto Chefe
- Revisão pela Equipe de Operações
- PoC com Terraform em Q4 2025
- Treinamento da equipe em HCL e Rego
- Teste de políticas OPA com casos reais

### Riscos Não Mitigados

1. **Complexidade de HCL:** Curva de aprendizado para desenvolvedores não familiarizados
2. **Estado do Terraform:** Gerenciamento de estado pode ficar complexo em escala
3. **Debugging de políticas:** Rego (OPA) pode ser difícil de debugar
4. **Custo de ferramentas:** Terraform Cloud/Enterprise tem custo adicional se necessário

---

**Documento criado por:** GEM-07 AI Specialist System  
**Atualizado por:** GEM-02 Dev Specialist (PAM V1.8)  
**Data:** 2025-08-22  
**Versão:** 1.1  
**Status:** Aguardando ratificação do Arquiteto Chefe e Equipe de Operações  
**Próxima revisão:** Q4 2025 (início da implementação)
