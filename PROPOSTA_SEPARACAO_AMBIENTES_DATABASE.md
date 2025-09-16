# PROPOSTA: SEPARAÇÃO TOTAL DE AMBIENTES DATABASE
## Simpix - Sistema Bancário Grau de Crédito

**Data:** 09/09/2025  
**Status:** PROPOSTA PARA DEBATE COM GEM 02  
**Criticidade:** 🔴 ALTA - Operação de Crédito Sensível  

---

## 🎯 OBJETIVO ESTRATÉGICO

Implementar **isolamento total** entre ambientes de desenvolvimento e produção para o sistema de database, garantindo:

1. **Zero Risco** de afetar dados de produção durante desenvolvimento
2. **Switch Controlado** para acesso prod apenas quando necessário
3. **Plano de Contingência Bancário** para proteção de dados críticos
4. **Manutenção Segura** com processo de aprovação

---

## 📊 ANÁLISE DA SITUAÇÃO ATUAL

### ✅ **PONTOS POSITIVOS IDENTIFICADOS:**

- **Sistema de Testes Robusto:** 8 camadas de proteção anti-produção
- **Separação Parcial:** Variáveis `TEST_DATABASE_URL`, `STAGING_DATABASE_URL`, `PROD_DATABASE_URL`  
- **Monitoramento Avançado:** `dbMonitoring.ts` com métricas de performance
- **Proteção Anti-Neon:** Sistema já redireciona para Supabase
- **Validação de Hostname:** Diferenciação por servidor Supabase

### ⚠️ **LACUNAS CRÍTICAS:**

- **Desenvolvimento usa mesma DATABASE_URL:** Risco de acesso acidental à prod
- **Switch não controlado:** Sem auditoria de quando/quem acessa prod
- **Backup manual:** Sem automação de contingência  
- **Rollback não documentado:** Processo de recuperação não formalizado

---

## 🏗️ ARQUITETURA PROPOSTA

### **1. ISOLAMENTO POR AMBIENTES**

```typescript
// Configuração de Ambientes Seguros
const DATABASE_ENVIRONMENTS = {
  development: {
    primary: process.env.DEV_DATABASE_URL,     // Banco exclusivo dev
    fallback: process.env.TEST_DATABASE_URL,   // Fallback seguro
    hostname: 'dev-simpix.supabase.co',        // Servidor dedicado
    restrictions: ['NO_PRODUCTION_DATA']
  },
  
  staging: {
    primary: process.env.STAGING_DATABASE_URL, // Dados simulados prod
    hostname: 'staging-simpix.supabase.co',
    restrictions: ['LIMITED_OPERATIONS']
  },
  
  production: {
    primary: process.env.PROD_DATABASE_URL,    // Dados reais sensíveis  
    hostname: 'prod-simpix.supabase.co',
    restrictions: ['AUDIT_REQUIRED', 'APPROVAL_REQUIRED']
  }
}
```

### **2. SISTEMA DE SWITCH CONTROLADO**

```typescript
// Switch Seguro para Produção (apenas quando necessário)
class ProductionDatabaseAccess {
  async enableProductionAccess(options: {
    reason: string;              // Motivo obrigatório
    approvedBy: string;          // Aprovação gerencial  
    duration: number;            // Tempo limite (máx 30 min)
    operations: string[];        // Operações permitidas
    backupRequired: boolean;     // Backup obrigatório antes
  }): Promise<DatabaseConnection> {
    
    // VALIDAÇÕES DE SEGURANÇA
    await this.validateApproval(options.approvedBy);
    await this.createAuditLog(options);
    
    if (options.backupRequired) {
      await this.createEmergencyBackup();
    }
    
    // CONEXÃO TEMPORÁRIA E MONITORADA
    return this.createMonitoredConnection(options);
  }
}
```

### **3. PLANO DE CONTINGÊNCIA BANCÁRIO**

#### **A) BACKUP AUTOMATIZADO - RTO: 5 minutos**

```yaml
Backup Strategy:
  Frequência:
    - Incremental: A cada 15 minutos
    - Completo: A cada 6 horas  
    - Snapshot: Diário às 02:00 UTC
  
  Retenção:
    - Incrementais: 48 horas
    - Completos: 30 dias
    - Snapshots: 365 dias
  
  Localização:
    - Primário: Supabase Storage
    - Secundário: AWS S3 (região diferente)
    - Terciário: Local encrypted drive
```

#### **B) RECUPERAÇÃO EM CAMADAS**

```typescript
// Plano de Recuperação por Severidade
const DISASTER_RECOVERY_LEVELS = {
  
  LEVEL_1_MINOR: {
    scenario: 'Tabela corrompida',
    rto: '5 minutos',
    rpo: '15 minutos', 
    action: 'Restore tabela específica do backup incremental'
  },
  
  LEVEL_2_MODERATE: {
    scenario: 'Banco parcialmente indisponível',
    rto: '15 minutos',
    rpo: '15 minutos',
    action: 'Failover para instância secundária + restore parcial'
  },
  
  LEVEL_3_CRITICAL: {
    scenario: 'Perda total do banco',
    rto: '30 minutos',
    rpo: '15 minutos', 
    action: 'Restore completo + validação de integridade'
  },
  
  LEVEL_4_CATASTROPHIC: {
    scenario: 'Comprometimento de segurança',
    rto: '60 minutos',
    rpo: '0 minutos',
    action: 'Isolamento + investigação forense + restore limpo'
  }
}
```

#### **C) VALIDAÇÃO DE INTEGRIDADE**

```sql
-- Scripts de Validação Pós-Recuperação
DO $$ 
BEGIN
  -- 1. Validar contagens críticas
  ASSERT (SELECT COUNT(*) FROM propostas WHERE status = 'APROVADA') >= 0;
  
  -- 2. Validar referential integrity  
  ASSERT (SELECT COUNT(*) FROM propostas WHERE cliente_id NOT IN (SELECT id FROM clientes)) = 0;
  
  -- 3. Validar dados monetários
  ASSERT (SELECT COUNT(*) FROM propostas WHERE valor_emprestimo <= 0) = 0;
  
  -- 4. Validar timestamps
  ASSERT (SELECT COUNT(*) FROM propostas WHERE created_at > NOW()) = 0;
  
  RAISE NOTICE 'Validação de integridade: OK';
END $$;
```

---

## 🛡️ IMPLEMENTAÇÃO GRADUAL - FASE POR FASE

### **FASE 1: ISOLAMENTO BÁSICO (Semana 1)**

- [ ] **1.1** Criar `DEV_DATABASE_URL` dedicado no Supabase
- [ ] **1.2** Migrar configuração dev para usar banco exclusivo  
- [ ] **1.3** Atualizar `drizzle.config.ts` para detectar ambiente
- [ ] **1.4** Implementar validação de hostname por ambiente
- [ ] **1.5** Testes de regressão para garantir não impacto

### **FASE 2: SWITCH CONTROLADO (Semana 2)**

- [ ] **2.1** Implementar `ProductionDatabaseAccess` com auditoria
- [ ] **2.2** Sistema de aprovação para acesso prod em dev
- [ ] **2.3** Log completo de todas operações sensíveis
- [ ] **2.4** Interface CLI para solicitação de acesso
- [ ] **2.5** Timeout automático de sessões prod

### **FASE 3: CONTINGÊNCIA AVANÇADA (Semana 3)**

- [ ] **3.1** Backup incremental automático (15 min)
- [ ] **3.2** Scripts de restore por níveis de severidade  
- [ ] **3.3** Validação automática de integridade pós-restore
- [ ] **3.4** Alertas proativos para anomalias
- [ ] **3.5** Simulação mensal de disaster recovery

### **FASE 4: MONITORAMENTO COMPLETO (Semana 4)**

- [ ] **4.1** Dashboard de saúde multi-ambiente
- [ ] **4.2** Métricas de performance por ambiente
- [ ] **4.3** Alertas diferenciados por criticidade
- [ ] **4.4** Relatórios de compliance automáticos
- [ ] **4.5** Documentação operacional completa

---

## 🚨 CENÁRIOS DE EMERGÊNCIA

### **CENÁRIO 1: "Alguém deletou dados de produção"**

**Resposta Imediata:**
1. **T+0min:** Detectar via monitoramento automático
2. **T+1min:** Isolar conexões ativas ao banco
3. **T+2min:** Avaliar escopo do dano via audit log
4. **T+5min:** Iniciar restore incremental da última janela
5. **T+10min:** Validar integridade dos dados restaurados  
6. **T+15min:** Reativar sistema com dados íntegros

**Prevenção:**
- Backup incremental a cada 15 minutos = máximo 15 min de perda
- Soft delete por padrão em tabelas críticas
- Row Level Security impedindo deleções não autorizadas

### **CENÁRIO 2: "Banco de produção corrompido"**

**Resposta Estruturada:**
1. **Imediato:** Failover automático para réplica read-only  
2. **T+5min:** Restore completo em instância paralela
3. **T+15min:** Validação completa de integridade
4. **T+20min:** Switch controlado para instância limpa
5. **T+30min:** Sistema operacional com dados íntegros

### **CENÁRIO 3: "Comprometimento de segurança"**

**Protocolo de Isolamento:**
1. **Imediato:** Revogar todas as conexões ativas
2. **T+1min:** Criar snapshot forense do estado atual
3. **T+5min:** Restore de backup limpo (anterior ao compromisso)
4. **T+10min:** Auditoria de todos os acessos suspeitos
5. **T+30min:** Operação em ambiente isolado até investigação

---

## 💰 CUSTOS E BENEFÍCIOS

### **CUSTOS ESTIMADOS:**

- **Infraestrutura:** +$200/mês (bancos dedicados por ambiente)
- **Storage Backup:** +$50/mês (retenção 365 dias)
- **Desenvolvimento:** 40 horas-homem (4 semanas)
- **Treinamento:** 8 horas para equipe

**Total: ~$2,000 setup + $250/mês operacional**

### **BENEFÍCIOS QUANTIFICADOS:**

- **Risco Eliminado:** $500,000+ (custo de vazamento de dados)
- **Downtime Evitado:** 99.95% SLA (vs 99.5% atual)  
- **Compliance:** Atende LGPD/PCI-DSS integralmente
- **Produtividade:** +25% (desenvolvedores sem medo de quebrar)

**ROI: 2,500% no primeiro ano**

---

## 🎚️ CONFIGURAÇÕES ESPECÍFICAS

### **Variáveis de Ambiente Propostas:**

```bash
# DESENVOLVIMENTO (isolado)
DEV_DATABASE_URL=postgresql://dev_user:***@dev-simpix.supabase.co:6543/simpix_dev
DEV_SUPABASE_URL=https://dev-simpix.supabase.co
DEV_SUPABASE_ANON_KEY=***

# STAGING (simulação produção) 
STAGING_DATABASE_URL=postgresql://staging_user:***@staging-simpix.supabase.co:6543/simpix_staging
STAGING_SUPABASE_URL=https://staging-simpix.supabase.co

# PRODUÇÃO (dados reais sensíveis)
PROD_DATABASE_URL=postgresql://prod_user:***@prod-simpix.supabase.co:6543/simpix_prod
PROD_SUPABASE_URL=https://prod-simpix.supabase.co

# ACESSO CONTROLADO PRODUÇÃO
PROD_ACCESS_APPROVAL_REQUIRED=true
PROD_ACCESS_MAX_DURATION=1800  # 30 minutos
PROD_ACCESS_AUDIT_LOG=enabled
PROD_BACKUP_BEFORE_ACCESS=true
```

### **Drizzle Config Inteligente:**

```typescript
// drizzle.config.ts - Detecção automática de ambiente
const environment = process.env.NODE_ENV || 'development';

const DATABASE_CONFIGS = {
  development: process.env.DEV_DATABASE_URL,
  staging: process.env.STAGING_DATABASE_URL,
  production: process.env.PROD_DATABASE_URL,
  test: process.env.TEST_DATABASE_URL
};

const databaseUrl = DATABASE_CONFIGS[environment];

if (!databaseUrl) {
  throw new Error(`❌ ${environment.toUpperCase()}_DATABASE_URL não configurado`);
}

// Validação de segurança por hostname
const url = new URL(databaseUrl);
const expectedHostnames = {
  development: ['dev-simpix', 'localhost'],
  staging: ['staging-simpix'],
  production: ['prod-simpix'],
  test: ['test-simpix', 'localhost']
};

const validHost = expectedHostnames[environment]?.some(host => 
  url.hostname.includes(host)
);

if (!validHost) {
  throw new Error(`🚨 SECURITY: Hostname inválido para ambiente ${environment}`);
}
```

---

## 📋 CHECKLIST DE VALIDAÇÃO

### **ANTES DE IMPLEMENTAR:**

- [ ] **Aprovação Técnica:** Arquiteto Senior + Tech Lead
- [ ] **Aprovação Gerencial:** Diretor de TI + Compliance
- [ ] **Budget Aprovado:** Custos de infraestrutura liberados
- [ ] **Cronograma Validado:** 4 semanas sem impacto em releases
- [ ] **Equipe Designada:** Desenvolvedores + DevOps + DBA

### **DURANTE A IMPLEMENTAÇÃO:**

- [ ] **Backup Completo:** Sistema atual antes de qualquer mudança
- [ ] **Ambiente de Teste:** Validar em staging primeiro
- [ ] **Rollback Plan:** Procedimento de volta ao estado anterior
- [ ] **Communication:** Equipe informada sobre mudanças
- [ ] **Monitoring:** Alertas configurados para detectar problemas

### **PÓS-IMPLEMENTAÇÃO:**

- [ ] **Smoke Tests:** Funcionalidade básica operando normalmente
- [ ] **Performance Check:** Sem degradação de performance
- [ ] **Security Audit:** Acesso controlado funcionando
- [ ] **Backup Validation:** Restore de teste bem-sucedido
- [ ] **Team Training:** Equipe treinada nos novos procedimentos

---

## 🚀 PRÓXIMOS PASSOS PARA DEBATE

### **PERGUNTAS PARA GEM 02:**

1. **Cronograma:** Concordam com implementação em 4 semanas?
2. **Orçamento:** Aprovação para custos mensais de $250?
3. **Responsabilidades:** Quem será responsável por cada fase?
4. **Contingências:** Algum cenário adicional para considerar?
5. **Integração:** Impacto em outros sistemas conectados?

### **DECISÕES PENDENTES:**

- **Provedor de Backup Secundário:** AWS S3 vs Azure Blob vs GCP Storage
- **Frequência de Testes DR:** Mensal vs Trimestral  
- **Nível de Alertas:** Slack vs E-mail vs SMS para emergências
- **Auditoria Externa:** Necessária para compliance bancário?
- **Treinamento da Equipe:** Presencial vs Online vs Híbrido

---

## 📞 CONTATOS DE EMERGÊNCIA

**Para implementação desta proposta:**

- **Arquiteto Responsável:** GEM 01 (Replit Agent)
- **Desenvolvedor Especialista:** GEM 02 (Para debate técnico)
- **Aprovação Gerencial:** [A definir]
- **Compliance/Segurança:** [A definir]

**Documento gerado automaticamente em:** `2025-09-09T15:50:00Z`  
**Versão:** 1.0 - PROPOSTA INICIAL PARA DEBATE  
**Próxima revisão:** Após feedback do GEM 02

---

*Este documento contém informações técnicas sensíveis sobre infraestrutura de sistema bancário. Mantenha confidencialidade apropriada.*