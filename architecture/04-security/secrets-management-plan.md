# 🔐 Plano de Gestão de Secrets - Simpix
**Autor:** GEM 01 (Arquiteto)
**Data:** 21/08/2025
**Status:** Ready for Execution
**Criticidade:** P0 - CRÍTICA

---

## 🎯 ESTRATÉGIA DE MIGRAÇÃO DE SECRETS

### Estado Atual (VULNERÁVEL)
```yaml
Hardcoded/Embedded:
  - Algumas keys no código
  - .env commitado (!)
  - Certificates no repo
  
Partially External:
  - Algumas em .env local
  - Replit secrets (limitado)
```

### Estado Target (SEGURO)
```yaml
Fase 0 (Supabase):
  - 100% em .env
  - .env.example apenas
  - Git ignore rigoroso
  
Fase 1 (Azure):
  - Azure Key Vault
  - Managed Identity
  - Zero secrets no código
```

---

## 📋 INVENTÁRIO COMPLETO DE SECRETS

### Application Core
```yaml
Authentication:
  - SUPABASE_URL          # Public, mas externalizar
  - SUPABASE_ANON_KEY     # Public, mas externalizar  
  - SUPABASE_SERVICE_KEY  # CRÍTICO - Private
  - JWT_SECRET            # CRÍTICO - Rotacionar
  - SESSION_SECRET        # CRÍTICO - Rotacionar

Database:
  - DATABASE_URL          # CRÍTICO - Contains password
  - REDIS_URL            # Se usado
```

### External Integrations
```yaml
Banco Inter:
  - INTER_CLIENT_ID       # Sensitive
  - INTER_CLIENT_SECRET   # CRÍTICO
  - INTER_CERTIFICATE     # CRÍTICO - mTLS cert
  - INTER_PRIVATE_KEY     # CRÍTICO - mTLS key
  - INTER_ACCOUNT_NUMBER  # Sensitive

ClickSign:
  - CLICKSIGN_TOKEN       # CRÍTICO
  - CLICKSIGN_HMAC_KEY    # CRÍTICO
```

### Infrastructure
```yaml
Monitoring (Futuro):
  - DATADOG_API_KEY       # Sensitive
  - SENTRY_DSN           # Public, mas externalizar

Azure (Futuro):
  - AZURE_SUBSCRIPTION_ID # Sensitive
  - AZURE_TENANT_ID      # Sensitive
  - AZURE_CLIENT_ID      # Sensitive
  - AZURE_CLIENT_SECRET  # CRÍTICO
```

---

## 🚨 PLANO DE AÇÃO IMEDIATA (GEM 02)

### DIA 1: Auditoria e Limpeza
```bash
# 1. Buscar TODOS os secrets no código
grep -r "KEY\|SECRET\|TOKEN\|PASSWORD" --exclude-dir=node_modules .

# 2. Listar arquivos suspeitos
find . -name "*.pem" -o -name "*.key" -o -name "*.p12"

# 3. Verificar .gitignore
cat .gitignore | grep -E "env|key|pem|secret"

# 4. Criar .env.example
cp .env .env.example
# Editar e remover valores, deixar apenas:
# DATABASE_URL=postgresql://user:pass@host/db
# JWT_SECRET=your-secret-here
```

### DIA 2: Externalização
```javascript
// Criar config/secrets.js
const requiredSecrets = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SESSION_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY'
];

// Validar na inicialização
function validateSecrets() {
  const missing = requiredSecrets.filter(
    secret => !process.env[secret]
  );
  
  if (missing.length > 0) {
    console.error('Missing secrets:', missing);
    process.exit(1);
  }
}

// Chamar no server startup
validateSecrets();
```

### DIA 3: Rotação e Segurança
```yaml
Rotacionar Imediatamente:
  1. JWT_SECRET:
     - Gerar novo: openssl rand -base64 32
     - Update .env
     - Invalidar sessions antigas
     
  2. SESSION_SECRET:
     - Gerar novo: openssl rand -hex 32
     - Update .env
     - Force re-login
     
  3. API Keys (se comprometidas):
     - Regenerar no provider
     - Update .env
     - Test integrations
```

---

## 🔄 MIGRAÇÃO PARA AZURE KEY VAULT

### Setup Inicial (Futuro)
```bash
# Criar Key Vault
az keyvault create \
  --name kv-simpix-prod \
  --resource-group rg-simpix \
  --location brazilsouth

# Adicionar secrets
az keyvault secret set \
  --vault-name kv-simpix-prod \
  --name "database-url" \
  --value "${DATABASE_URL}"
```

### Integração no Código
```javascript
// Azure Key Vault client
const { SecretClient } = require("@azure/keyvault-secrets");
const { DefaultAzureCredential } = require("@azure/identity");

class SecretsManager {
  constructor() {
    const vaultUrl = `https://kv-simpix-prod.vault.azure.net`;
    const credential = new DefaultAzureCredential();
    this.client = new SecretClient(vaultUrl, credential);
    this.cache = new Map();
  }
  
  async getSecret(name) {
    // Cache com TTL de 1 hora
    if (this.cache.has(name)) {
      return this.cache.get(name);
    }
    
    const secret = await this.client.getSecret(name);
    this.cache.set(name, secret.value);
    
    // Clear cache após 1 hora
    setTimeout(() => this.cache.delete(name), 3600000);
    
    return secret.value;
  }
}
```

---

## 🛡️ POLÍTICAS DE SEGURANÇA

### Rotação de Secrets
```yaml
Frequência:
  - Passwords: 90 dias
  - API Keys: 180 dias
  - Certificates: Antes de expirar
  - Comprometidos: IMEDIATO

Processo:
  1. Gerar novo secret
  2. Update em staging
  3. Test functionality
  4. Update em production
  5. Revoke old secret
```

### Access Control
```yaml
Princípio: Least Privilege
  
Development:
  - Read: Developers
  - Write: Never (CI/CD only)
  
Production:
  - Read: Application only
  - Write: Admin com MFA
  - Delete: Requires approval
```

### Audit e Compliance
```yaml
Logging:
  - Todo acesso registrado
  - Alertas em acessos unusual
  - Review mensal
  
Compliance:
  - LGPD: Encryption required
  - PCI DSS: Key management
  - SOC 2: Access control
```

---

## 📝 BEST PRACTICES

### Do's ✅
```yaml
- Use variáveis de ambiente
- Validate secrets on startup
- Rotate regularmente
- Use secret managers
- Encrypt in transit/rest
- Audit access
- Document sem expor
```

### Don'ts ❌
```yaml
- Hardcode no código
- Commit .env files
- Log secrets
- Share via email/chat
- Use default passwords
- Ignore expiration
- Skip validation
```

---

## 🔍 FERRAMENTAS DE DETECÇÃO

### Git Secrets Scanner
```bash
# Instalar
npm install -g gitleaks

# Scan repository
gitleaks detect --source . -v

# Pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
gitleaks protect --staged -v
EOF
chmod +x .git/hooks/pre-commit
```

### GitHub Secret Scanning
```yaml
# .github/secret-scanning.yml
name: Secret Scanning
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
```

---

## ⚠️ INCIDENT RESPONSE

### Se Secret Comprometido:
```yaml
IMEDIATO (15 min):
  1. Rotacionar secret
  2. Audit logs de uso
  3. Bloquear se suspicious
  
INVESTIGAÇÃO (1 hora):
  1. Determinar exposure window
  2. Check for unauthorized access
  3. Assess damage
  
REMEDIAÇÃO (24 horas):
  1. Patch vulnerability
  2. Update all systems
  3. Notify affected parties
  4. Post-mortem
```

---

## ✅ CHECKLIST PARA GEM 02

### Hoje - Auditoria
- [ ] Grep em busca de secrets
- [ ] Listar todos os secrets usados
- [ ] Verificar .gitignore
- [ ] Criar .env.example

### Amanhã - Externalização
- [ ] Mover TODOS para .env
- [ ] Implementar validation
- [ ] Remover do código
- [ ] Test application

### Dia 3 - Segurança
- [ ] Rotacionar secrets críticos
- [ ] Setup secret scanning
- [ ] Documentar processo
- [ ] Train team

---

## 📊 MÉTRICAS DE SUCESSO

```yaml
Target:
  - 0 secrets no código
  - 100% em .env ou Key Vault
  - 100% secrets rotacionados
  - 0 secrets em logs
  - 100% compliance
```

---

*LEMBRE-SE: Um secret exposto = Potencial breach total!*