# ESTRATÉGIA DATA SEEDING SINTÉTICO - AMBIENTES SEGUROS

**Data:** 2025-09-09  
**Problema:** Ausência de dados de teste controlados  
**Solução:** Geração sintética com faker.js  
**Compliance:** LGPD - Zero dados de produção em não-produção  

---

## 🎯 **OBJETIVO**

Implementar sistema de data seeding 100% sintético que:
- **Gera dados realistas** sem usar informações de produção
- **Protege PII** garantindo compliance LGPD total
- **Diferencia ambientes** com volumes e complexidade adequados
- **Previne contaminação** com dados reais sensíveis

---

## 🏗️ **ARQUITETURA DO SISTEMA**

### **Estrutura de Arquivos:**
```
server/seeds/
├── index.ts              # Orquestrador principal
├── generators/
│   ├── proposals.ts      # Gerador de propostas
│   ├── clients.ts        # Gerador de clientes
│   ├── products.ts       # Gerador de produtos
│   └── commercial-tables.ts  # Tabelas comerciais
├── environments/
│   ├── development.ts    # Config para dev (dados mínimos)
│   ├── staging.ts        # Config para staging (dados realistas)
│   └── test.ts          # Config para testes (dados rápidos)
└── utils/
    ├── faker-config.ts   # Configuração do Faker
    └── validation.ts     # Validação de dados gerados
```

### **Dependência Necessária:**
```bash
npm install --save-dev @faker-js/faker
npm install --save-dev @types/faker
```

---

## 🔧 **IMPLEMENTAÇÃO**

### **1. Configuração Base (server/seeds/utils/faker-config.ts):**
```typescript
import { faker } from '@faker-js/faker';

// Configuração para dados brasileiros
faker.setLocale('pt_BR');

// Seed determinístico para reprodutibilidade
export const DETERMINISTIC_SEEDS = {
  development: 12345,
  staging: 54321, 
  test: 99999
} as const;

export function configureFaker(environment: keyof typeof DETERMINISTIC_SEEDS) {
  faker.seed(DETERMINISTIC_SEEDS[environment]);
  console.log(`🎲 Faker configurado para ${environment} com seed ${DETERMINISTIC_SEEDS[environment]}`);
}

// Geradores específicos para domínio financeiro
export const FinancialFaker = {
  // CPF sintético válido (algoritmo de dígito verificador)
  cpf: () => {
    const digits = Array.from({length: 9}, () => faker.number.int({min: 0, max: 9}));
    // Implementar algoritmo de dígito verificador do CPF
    return generateValidCPF(digits);
  },

  // Valor de empréstimo realista
  loanAmount: () => faker.number.float({min: 1000, max: 500000, precision: 0.01}),

  // Taxa de juros realista
  interestRate: () => faker.number.float({min: 0.5, max: 15, precision: 0.01}),

  // CNPJ sintético
  cnpj: () => generateValidCNPJ(),

  // Status de proposta
  proposalStatus: () => faker.helpers.arrayElement([
    'RASCUNHO', 'EM_ANALISE', 'APROVADA', 'REJEITADA', 'PENDENTE'
  ])
};

function generateValidCPF(digits: number[]): string {
  // Implementar algoritmo real de validação CPF
  // Retornar CPF sintético mas válido
  return digits.join('').padStart(11, '0');
}

function generateValidCNPJ(): string {
  // Implementar geração de CNPJ sintético válido
  return faker.string.numeric(14);
}
```

### **2. Gerador de Clientes (server/seeds/generators/clients.ts):**
```typescript
import { faker } from '@faker-js/faker';
import { FinancialFaker } from '../utils/faker-config';
import { clientes } from '@shared/schema';

export interface SyntheticClient {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  renda_mensal: number;
  created_at: Date;
}

export class ClientGenerator {
  static generate(count: number): SyntheticClient[] {
    console.log(`📊 Gerando ${count} clientes sintéticos...`);
    
    return Array.from({length: count}, (_, index) => ({
      id: faker.string.uuid(),
      nome: faker.person.fullName(),
      cpf: FinancialFaker.cpf(),
      email: faker.internet.email(),
      telefone: faker.phone.number('(##) #####-####'),
      renda_mensal: faker.number.float({min: 1500, max: 15000, precision: 0.01}),
      created_at: faker.date.between({
        from: new Date('2023-01-01'),
        to: new Date()
      })
    }));
  }

  // Geração com perfis específicos para testes
  static generateProfiles(): {
    highIncome: SyntheticClient;
    lowIncome: SyntheticClient;
    averageIncome: SyntheticClient;
  } {
    return {
      highIncome: {
        ...this.generate(1)[0],
        renda_mensal: faker.number.float({min: 10000, max: 50000}),
        nome: 'Cliente Alto Padrão Sintético'
      },
      lowIncome: {
        ...this.generate(1)[0],
        renda_mensal: faker.number.float({min: 1500, max: 3000}),
        nome: 'Cliente Renda Baixa Sintético'
      },
      averageIncome: {
        ...this.generate(1)[0],
        renda_mensal: faker.number.float({min: 3000, max: 8000}),
        nome: 'Cliente Renda Média Sintético'
      }
    };
  }
}
```

### **3. Gerador de Propostas (server/seeds/generators/proposals.ts):**
```typescript
import { faker } from '@faker-js/faker';
import { FinancialFaker } from '../utils/faker-config';
import { propostas } from '@shared/schema';

export interface SyntheticProposal {
  id: string;
  cliente_id: string;
  produto_id: string;
  valor_emprestimo: number;
  prazo_meses: number;
  taxa_juros: number;
  status: string;
  observacoes: string | null;
  created_at: Date;
}

export class ProposalGenerator {
  static generate(clientIds: string[], productIds: string[], count: number): SyntheticProposal[] {
    console.log(`📋 Gerando ${count} propostas sintéticas...`);
    
    return Array.from({length: count}, () => {
      const loanAmount = FinancialFaker.loanAmount();
      const termMonths = faker.helpers.arrayElement([6, 12, 18, 24, 36, 48]);
      
      return {
        id: faker.string.uuid(),
        cliente_id: faker.helpers.arrayElement(clientIds),
        produto_id: faker.helpers.arrayElement(productIds),
        valor_emprestimo: loanAmount,
        prazo_meses: termMonths,
        taxa_juros: FinancialFaker.interestRate(),
        status: FinancialFaker.proposalStatus(),
        observacoes: faker.helpers.maybe(() => 
          faker.lorem.sentence({min: 10, max: 50})
        ),
        created_at: faker.date.between({
          from: new Date('2023-01-01'),
          to: new Date()
        })
      };
    });
  }

  // Cenários específicos para testes
  static generateTestScenarios(): {
    approved: SyntheticProposal;
    rejected: SyntheticProposal;
    pending: SyntheticProposal;
  } {
    const baseProposal = this.generate(['test-client'], ['test-product'], 1)[0];
    
    return {
      approved: { ...baseProposal, status: 'APROVADA', id: 'test-approved' },
      rejected: { ...baseProposal, status: 'REJEITADA', id: 'test-rejected' },
      pending: { ...baseProposal, status: 'PENDENTE', id: 'test-pending' }
    };
  }
}
```

---

## 🌍 **CONFIGURAÇÃO POR AMBIENTE**

### **Development (server/seeds/environments/development.ts):**
```typescript
import { configureFaker } from '../utils/faker-config';

configureFaker('development');

export const DEVELOPMENT_CONFIG = {
  clients: 10,      // Poucos clientes para dev rápido
  products: 3,      // Produtos básicos
  proposals: 20,    // Propostas mínimas
  commercialTables: 2,
  
  // Perfis específicos para desenvolvimento
  includeTestProfiles: true,
  generateSpecialCases: true
};
```

### **Staging (server/seeds/environments/staging.ts):**
```typescript
import { configureFaker } from '../utils/faker-config';

configureFaker('staging');

export const STAGING_CONFIG = {
  clients: 1000,    // Volume realista
  products: 15,     // Catálogo completo
  proposals: 5000,  // Volume de produção simulado
  commercialTables: 10,
  
  // Dados realistas para testes de performance
  includeHistoricalData: true,
  generateComplexScenarios: true,
  simulateProductionVolume: true
};
```

### **Test (server/seeds/environments/test.ts):**
```typescript
import { configureFaker } from '../utils/faker-config';

configureFaker('test');

export const TEST_CONFIG = {
  clients: 5,       // Mínimo para testes unitários
  products: 2,      // Cenários básicos
  proposals: 10,    // Testes rápidos
  commercialTables: 1,
  
  // Dados determinísticos para testes
  usePredictableData: true,
  includeEdgeCases: true,
  fastGeneration: true
};
```

---

## 🚀 **ORQUESTRADOR PRINCIPAL**

### **server/seeds/index.ts:**
```typescript
import { db } from '../lib/supabase';
import { ClientGenerator } from './generators/clients';
import { ProposalGenerator } from './generators/proposals';
import { DEVELOPMENT_CONFIG } from './environments/development';
import { STAGING_CONFIG } from './environments/staging';
import { TEST_CONFIG } from './environments/test';

async function seedDatabase() {
  const environment = process.env.NODE_ENV || 'development';
  
  if (environment === 'production') {
    throw new Error('🚫 FORBIDDEN: Data seeding não permitido em produção!');
  }

  const config = environment === 'staging' ? STAGING_CONFIG :
                 environment === 'test' ? TEST_CONFIG :
                 DEVELOPMENT_CONFIG;

  console.log(`🌱 Iniciando seeding para ambiente: ${environment}`);
  console.log(`📊 Configuração: ${JSON.stringify(config, null, 2)}`);

  try {
    // Limpar dados existentes
    console.log('🧹 Limpando dados existentes...');
    await db?.delete(propostas);
    await db?.delete(clientes);

    // Gerar clientes
    const clients = ClientGenerator.generate(config.clients);
    const insertedClients = await db?.insert(clientes).values(clients).returning();
    
    // Gerar propostas
    const clientIds = insertedClients?.map(c => c.id) || [];
    const proposals = ProposalGenerator.generate(clientIds, ['prod-1'], config.proposals);
    await db?.insert(propostas).values(proposals);

    console.log(`✅ Seeding completo:`);
    console.log(`   - ${clients.length} clientes gerados`);
    console.log(`   - ${proposals.length} propostas geradas`);
    console.log(`🎲 Dados 100% sintéticos - nenhum dado real utilizado`);

  } catch (error) {
    console.error('❌ Erro durante seeding:', error);
    throw error;
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  seedDatabase().catch(console.error);
}

export { seedDatabase };
```

---

## 🔒 **GARANTIAS DE COMPLIANCE**

### **LGPD - Proteção Total:**
- ✅ **Zero dados reais:** Apenas geração sintética
- ✅ **Sem PII:** Nomes, CPFs, emails todos sintéticos
- ✅ **Não reversível:** Impossível identificar pessoas reais
- ✅ **Auditável:** Logs claros de geração sintética

### **Validações de Segurança:**
```typescript
// Validação anti-produção
export function validateNonProduction() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('🚫 SECURITY: Data seeding proibido em produção');
  }
  
  // Verificar hostname do banco
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl?.includes('prod-simpix')) {
    throw new Error('🚫 SECURITY: Não é possível fazer seed em banco de produção');
  }
}
```

---

## 📋 **SCRIPTS NPM**

```json
{
  "scripts": {
    "seed:dev": "NODE_ENV=development tsx server/seeds/index.ts",
    "seed:staging": "NODE_ENV=staging tsx server/seeds/index.ts", 
    "seed:test": "NODE_ENV=test tsx server/seeds/index.ts",
    
    "seed:clean": "npm run seed:dev -- --clean-only",
    "seed:validate": "npm run seed:test && npm run test"
  }
}
```

---

## ✅ **VALIDAÇÃO DE IMPLEMENTAÇÃO**

### **Critérios de Sucesso:**
- [ ] Geração de dados 100% sintéticos
- [ ] Falha automática se executado em produção
- [ ] Dados determinísticos para testes (mesmo seed)
- [ ] Performance adequada (< 30s para seeding completo)
- [ ] Validação de integridade referencial
- [ ] Logs claros de processo de geração

### **Testes de Compliance:**
- [ ] Verificar que nenhum dado real está presente
- [ ] Confirmar geração determinística em test
- [ ] Validar falha em ambiente de produção
- [ ] Testar limpeza de dados existentes

---

**Status:** 📋 DOCUMENTADO - Pronto para implementação  
**Compliance:** ✅ LGPD - Zero dados de produção  
**Próxima Ação:** Implementar geradores e configurar scripts