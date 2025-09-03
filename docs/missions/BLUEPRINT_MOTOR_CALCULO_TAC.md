# BLUEPRINT DE REFATORAÇÃO DO MOTOR DE CÁLCULO TAC

**Missão:** OPERAÇÃO ACELERAÇÃO DE ORIGINAÇÃO - TRACK 2 FASE 2  
**Data:** 2025-09-03  
**Arquiteto:** Replit Agent  
**Protocolo:** PAM V1.0 + PACN V1.0 + DECD V1.0  
**Status:** PLANO DE BATALHA PRONTO PARA EXECUÇÃO

---

## 🎯 **OBJETIVO ESTRATÉGICO**

Transformar o motor de cálculo TAC de um estado **frágil e incorreto** para um sistema **robusto, flexível e alinhado** com a nova regra de negócio: **"10% de TAC para clientes novos"**.

### **Estado Atual vs. Estado Desejado**

| Aspecto | 🔴 Estado Atual | ✅ Estado Desejado |
|---------|----------------|-------------------|
| **Lógica** | TAC 2% hardcoded para todos | TAC dinâmica: 10% novos, produto para existentes |
| **Arquitetura** | TacCalculationService ignorado | Strategy Pattern + Dependency Injection |
| **Cliente Novo** | Paga TAC via produto (inconsistente) | Paga 10% fixo sobre valor proposta |
| **Cliente Existente** | Paga 2% hardcoded (incorreto) | Paga TAC via configuração produto |
| **Flexibilidade** | Zero - valor hardcoded | Máxima - configurável por produto |
| **Testabilidade** | Impossível - lógica acoplada | Completa - estratégias injetáveis |

---

## 🛠️ **MISSÃO P0: RECALIBRAÇÃO DO TACALCULATIONSERVICE**

### **Arquivo Alvo**
`server/services/tacCalculationService.ts`

### **Referência Cruzada com Auditoria**
- **Mitiga:** RISCO ALTO - Regra de Negócio Invertida
- **Resolução:** RISCO MÉDIO - Configuração Ignorada
- **Endereça:** Sistema atual dá isenção para existentes vs nova regra quer 10% para novos

### **Plano de Ação Técnico**

#### **Passo 1: Redesign da Interface Strategy**
```typescript
// Nova interface para estratégias de cálculo TAC
interface ITacCalculationStrategy {
  calculateTac(valorEmprestimo: number, produtoConfig?: ProdutoTacConfig): Promise<number>;
  getStrategyName(): string;
}

interface ProdutoTacConfig {
  tacValor: number;
  tacTipo: 'fixo' | 'percentual';
}
```

#### **Passo 2: Implementação das Estratégias**
```typescript
// Estratégia para clientes NOVOS - 10% fixo
class NewClientTacStrategy implements ITacCalculationStrategy {
  async calculateTac(valorEmprestimo: number): Promise<number> {
    const tacCalculada = valorEmprestimo * 0.10; // 10% fixo
    console.log(`[TAC_NEW_CLIENT] TAC 10% aplicada: R$ ${tacCalculada.toFixed(2)}`);
    return Math.round(tacCalculada * 100) / 100; // Arredondar 2 casas
  }
  
  getStrategyName(): string {
    return 'NEW_CLIENT_10_PERCENT';
  }
}

// Estratégia para clientes EXISTENTES - via produto
class ExistingClientTacStrategy implements ITacCalculationStrategy {
  async calculateTac(valorEmprestimo: number, produtoConfig?: ProdutoTacConfig): Promise<number> {
    if (!produtoConfig) {
      console.warn('[TAC_EXISTING_CLIENT] Configuração produto ausente, aplicando 0');
      return 0;
    }
    
    const { tacValor, tacTipo } = produtoConfig;
    
    if (tacTipo === 'fixo') {
      return tacValor;
    } else if (tacTipo === 'percentual') {
      const tacCalculada = (valorEmprestimo * tacValor) / 100;
      return Math.round(tacCalculada * 100) / 100;
    }
    
    return 0;
  }
  
  getStrategyName(): string {
    return 'EXISTING_CLIENT_PRODUCT_BASED';
  }
}
```

#### **Passo 3: Refatoração do TacCalculationService**
```typescript
export class TacCalculationService {
  /**
   * NOVO MÉTODO PRINCIPAL - Strategy Pattern + Nova Regra
   */
  public static async calculateTacWithNewRules(
    produtoId: number,
    valorEmprestimo: number,
    clienteCpf: string
  ): Promise<{ valorTac: number; estrategiaUsada: string }> {
    try {
      // Passo 1: Verificar se cliente é novo ou existente
      const isClienteNovo = !(await this.isClienteCadastrado(clienteCpf));
      
      // Passo 2: Selecionar estratégia baseada no status do cliente
      let strategy: ITacCalculationStrategy;
      let produtoConfig: ProdutoTacConfig | undefined;
      
      if (isClienteNovo) {
        strategy = new NewClientTacStrategy();
        console.log(`[TAC_SERVICE] Cliente ${clienteCpf} é NOVO - aplicando estratégia 10%`);
      } else {
        strategy = new ExistingClientTacStrategy();
        produtoConfig = await this.getProdutoTacConfig(produtoId);
        console.log(`[TAC_SERVICE] Cliente ${clienteCpf} é EXISTENTE - aplicando estratégia por produto`);
      }
      
      // Passo 3: Executar cálculo via estratégia selecionada
      const valorTac = await strategy.calculateTac(valorEmprestimo, produtoConfig);
      
      return {
        valorTac,
        estrategiaUsada: strategy.getStrategyName()
      };
      
    } catch (error) {
      console.error(`[TAC_SERVICE] Erro ao calcular TAC com novas regras:`, error);
      return { valorTac: 0, estrategiaUsada: 'ERROR_FALLBACK' };
    }
  }
  
  /**
   * MÉTODO AUXILIAR - Buscar configuração TAC do produto
   */
  private static async getProdutoTacConfig(produtoId: number): Promise<ProdutoTacConfig | undefined> {
    try {
      const produto = await db
        .select({
          tacValor: produtos.tacValor,
          tacTipo: produtos.tacTipo,
        })
        .from(produtos)
        .where(and(eq(produtos.id, produtoId), isNull(produtos.deletedAt)))
        .limit(1);

      if (!produto || produto.length === 0) {
        console.error(`[TAC_SERVICE] Produto ${produtoId} não encontrado`);
        return undefined;
      }

      return {
        tacValor: parseFloat(produto[0].tacValor || '0'),
        tacTipo: produto[0].tacTipo as 'fixo' | 'percentual' || 'fixo'
      };
    } catch (error) {
      console.error(`[TAC_SERVICE] Erro ao buscar config produto ${produtoId}:`, error);
      return undefined;
    }
  }
  
  // MANTER MÉTODO EXISTENTE para compatibilidade (deprecated)
  public static async calculateTac(
    produtoId: number,
    valorEmprestimo: number,
    clienteCpf: string
  ): Promise<number> {
    console.warn('[TAC_SERVICE] DEPRECATED: Use calculateTacWithNewRules instead');
    const result = await this.calculateTacWithNewRules(produtoId, valorEmprestimo, clienteCpf);
    return result.valorTac;
  }
}
```

### **Critérios de Sucesso P0**
- ✅ Método `calculateTacWithNewRules` implementado e funcional
- ✅ Strategy Pattern aplicado com 2 estratégias distintas
- ✅ Cliente novo retorna exatamente 10% do valor empréstimo
- ✅ Cliente existente retorna valor baseado em configuração produto
- ✅ Logs detalhados para debugging e auditoria
- ✅ Backward compatibility mantida (método antigo deprecated)

---

## 🔗 **MISSÃO P1: INTEGRAÇÃO NO CREATEPROPOSALUSECASE**

### **Arquivo Alvo**
`server/modules/proposal/application/CreateProposalUseCase.ts`

### **Referência Cruzada com Auditoria**
- **Mitiga:** RISCO CRÍTICO - Lógica Descentralizada
- **Remove:** Linha 158 - cálculo hardcoded `(dto.valor * 0.02)`
- **Implementa:** Dependency Injection do TacCalculationService

### **Plano de Ação Técnico**

#### **Passo 1: Dependency Injection via Constructor**
```typescript
import { TacCalculationService } from '../../../services/tacCalculationService.js';

export class CreateProposalUseCase {
  constructor(
    private repository: IProposalRepository,
    private tacCalculationService: typeof TacCalculationService = TacCalculationService // Injeção via constructor
  ) {}
  
  // ... resto da implementação
}
```

#### **Passo 2: Refatoração do Método execute()**
```typescript
async execute(dto: CreateProposalDTO): Promise<{ id: string; numeroSequencial: number }> {
  // Validar e criar Value Objects (existente)
  const cpfObj = CPF.create(dto.clienteCpf);
  if (!cpfObj) {
    throw new Error('CPF inválido');
  }

  // NOVA LÓGICA: Calcular TAC via serviço com novas regras
  const tacResult = await this.tacCalculationService.calculateTacWithNewRules(
    dto.produtoId || 1, // Produto padrão se não especificado
    dto.valor,
    dto.clienteCpf
  );
  
  console.log(`[USE_CASE] TAC calculada: R$ ${tacResult.valorTac.toFixed(2)} via ${tacResult.estrategiaUsada}`);

  // REMOVER LINHA HARDCODED:
  // const valorTac = dto.valorTac || (dto.valor * 0.02); // ❌ REMOVER ESTA LINHA
  
  // NOVA LINHA:
  const valorTac = dto.valorTac || tacResult.valorTac; // ✅ Usar resultado do serviço
  
  // Resto do cálculo de valores financeiros (manter inalterado)
  const valorIof = dto.valorIof || (dto.valor * 0.006); // 0.6% do valor
  const valorTotalFinanciado = dto.valorTotalFinanciado || (dto.valor + valorTac + valorIof);
  
  // ... resto da implementação permanece igual
}
```

#### **Passo 3: Factory Method para Dependency Injection**
```typescript
// Novo arquivo: server/modules/proposal/factories/CreateProposalUseCaseFactory.ts
export class CreateProposalUseCaseFactory {
  static create(repository: IProposalRepository): CreateProposalUseCase {
    return new CreateProposalUseCase(repository, TacCalculationService);
  }
  
  // Para testes - permite injection de mock
  static createForTesting(
    repository: IProposalRepository, 
    tacService: typeof TacCalculationService
  ): CreateProposalUseCase {
    return new CreateProposalUseCase(repository, tacService);
  }
}
```

### **Critérios de Sucesso P1**
- ✅ Linha hardcoded `(dto.valor * 0.02)` completamente removida
- ✅ TacCalculationService injetado via constructor
- ✅ Método `calculateTacWithNewRules` sendo chamado corretamente
- ✅ Resultado do serviço usado para construir ProposalCreationProps
- ✅ Factory method implementado para facilitar DI
- ✅ Logs informativos sobre estratégia utilizada

---

## 🧪 **PROVAS DE SUCESSO - CENÁRIOS DE TESTE**

### **Teste 1: Cliente Novo - TAC 10%**
```typescript
describe('CreateProposalUseCase - Cliente Novo', () => {
  it('deve calcular TAC de 10% para CPF não existente', async () => {
    // Arrange
    const mockRepo = createMockRepository();
    const mockTacService = {
      calculateTacWithNewRules: jest.fn().mockResolvedValue({
        valorTac: 500.0, // 10% de R$ 5.000
        estrategiaUsada: 'NEW_CLIENT_10_PERCENT'
      })
    };
    
    const useCase = new CreateProposalUseCase(mockRepo, mockTacService);
    
    const dto: CreateProposalDTO = {
      clienteNome: 'João Silva',
      clienteCpf: '12345678901', // CPF novo
      valor: 5000,
      prazo: 12,
      produtoId: 1
    };
    
    // Act
    const result = await useCase.execute(dto);
    
    // Assert
    expect(mockTacService.calculateTacWithNewRules).toHaveBeenCalledWith(1, 5000, '12345678901');
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        valorTac: 500.0
      })
    );
  });
});
```

### **Teste 2: Cliente Existente - TAC via Produto**
```typescript
describe('CreateProposalUseCase - Cliente Existente', () => {
  it('deve calcular TAC baseada no produto para CPF existente', async () => {
    // Arrange
    const mockRepo = createMockRepository();
    const mockTacService = {
      calculateTacWithNewRules: jest.fn().mockResolvedValue({
        valorTac: 150.0, // 3% percentual do produto
        estrategiaUsada: 'EXISTING_CLIENT_PRODUCT_BASED'
      })
    };
    
    const useCase = new CreateProposalUseCase(mockRepo, mockTacService);
    
    const dto: CreateProposalDTO = {
      clienteNome: 'Maria Santos',
      clienteCpf: '98765432109', // CPF existente
      valor: 5000,
      prazo: 12,
      produtoId: 2 // Produto com TAC 3% percentual
    };
    
    // Act
    const result = await useCase.execute(dto);
    
    // Assert
    expect(mockTacService.calculateTacWithNewRules).toHaveBeenCalledWith(2, 5000, '98765432109');
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        valorTac: 150.0
      })
    );
  });
});
```

### **Teste 3: Integração E2E - Fluxo Completo**
```typescript
describe('TacCalculationService - Integração E2E', () => {
  beforeEach(async () => {
    // Limpar dados de teste
    await cleanTestDatabase();
  });
  
  it('deve aplicar 10% TAC para cliente completamente novo', async () => {
    // Arrange
    const cpfNovo = '11111111111';
    const valorProposta = 10000;
    const produtoId = 1;
    
    // Garantir que CPF não existe
    const clienteExists = await ClienteRepository.clientExists(cpfNovo);
    expect(clienteExists).toBe(false);
    
    // Act
    const result = await TacCalculationService.calculateTacWithNewRules(
      produtoId,
      valorProposta,
      cpfNovo
    );
    
    // Assert
    expect(result.valorTac).toBe(1000.0); // 10% de R$ 10.000
    expect(result.estrategiaUsada).toBe('NEW_CLIENT_10_PERCENT');
  });
  
  it('deve aplicar TAC por produto para cliente com histórico', async () => {
    // Arrange
    const cpfExistente = '22222222222';
    const valorProposta = 8000;
    const produtoId = 2; // Produto com 2.5% percentual
    
    // Criar histórico para o cliente
    await createClienteHistorico(cpfExistente, 'aprovado');
    
    // Act
    const result = await TacCalculationService.calculateTacWithNewRules(
      produtoId,
      valorProposta,
      cpfExistente
    );
    
    // Assert
    expect(result.valorTac).toBe(200.0); // 2.5% de R$ 8.000
    expect(result.estrategiaUsada).toBe('EXISTING_CLIENT_PRODUCT_BASED');
  });
});
```

---

## 📋 **ROADMAP DE IMPLEMENTAÇÃO PRIORIZADO**

### **Sprint 1: Fundação (P0 - TacCalculationService)**
**Duração:** 3 dias  
**Prioridade:** CRÍTICA

1. **Dia 1-2:** Implementar Strategy Pattern e novas estratégias
2. **Dia 3:** Criar método `calculateTacWithNewRules` e testes unitários
3. **Validação:** Executar suite de testes P0

### **Sprint 2: Integração (P1 - CreateProposalUseCase)**
**Duração:** 2 dias  
**Prioridade:** ALTA

1. **Dia 1:** Implementar Dependency Injection e remover hardcode
2. **Dia 2:** Criar factory methods e testes de integração
3. **Validação:** Executar suite de testes P1

### **Sprint 3: Validação E2E**
**Duração:** 1 dia  
**Prioridade:** MÉDIA

1. **Dia 1:** Testes E2E e validação comportamental
2. **Validação:** Todos cenários de teste passando

---

## 🎯 **MATRIZ DE MITIGAÇÃO DE RISCOS**

| Vetor de Falha (Auditoria) | Missão que Mitiga | Solução Implementada |
|----------------------------|-------------------|---------------------|
| **CRÍTICO - Lógica Descentralizada** | P1 - Integração DI | TacCalculationService injetado via constructor |
| **ALTO - Regra Invertida** | P0 - Recalibração | Strategy Pattern: 10% novos, produto existentes |
| **MÉDIO - Config Ignorada** | P0 - Recalibração | ExistingClientTacStrategy usa tacValor/tacTipo |

---

## ✅ **CRITÉRIOS DE ACEITAÇÃO FINAL**

### **Funcional**
- [ ] Cliente novo (CPF inexistente): TAC = 10% do valor proposta
- [ ] Cliente existente: TAC baseada na configuração do produto
- [ ] CreateProposalUseCase não possui cálculo hardcoded
- [ ] TacCalculationService é utilizado corretamente

### **Técnico**  
- [ ] Strategy Pattern implementado conforme melhores práticas
- [ ] Dependency Injection via constructor funcionando
- [ ] Cobertura de testes > 95% nos módulos alterados
- [ ] Zero LSP errors após implementação

### **Operacional**
- [ ] Logs detalhados para auditoria de cálculos
- [ ] Backward compatibility mantida (método deprecated)
- [ ] Performance igual ou superior ao sistema atual

---

## 🚨 **ALERTAS DE SEGURANÇA**

1. **Validação de Entrada:** Sempre validar CPF e valor antes do cálculo
2. **Fallback Behavior:** Em caso de erro, retornar TAC = 0 e logar incidente
3. **Auditoria:** Logar estratégia utilizada e valor calculado para compliance
4. **Testes de Regressão:** Validar que clientes existentes não são afetados negativamente

---

**🎭 MODO OPERACIONAL:** ARQUITETO → EXECUTOR  
**📋 STATUS:** BLUEPRINT APROVADO PARA IMPLEMENTAÇÃO  
**⏭️ PRÓXIMA FASE:** Execução Missão P0 - Recalibração do TacCalculationService

---

*Blueprint arquitetado conforme DECD V1.0 + Strategy Pattern + Dependency Injection Best Practices*