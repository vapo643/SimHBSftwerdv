# Doutrina de Lógica de Negócio e Fluxos de Trabalho - Sistema Simpix

**Versão:** 1.0  
**Data:** 25/08/2025  
**Autor:** Arquiteto de Domínio (Domain Architect)  
**Status:** Formalização Baseline  
**Criticidade:** P0 - Coração do Sistema

---

## 🎯 Sumário Executivo

Esta doutrina codifica as regras e padrões para implementação da lógica de negócio crítica do Sistema Simpix, garantindo consistência, robustez e gerenciamento explícito da complexidade através de Domain-Driven Design (DDD) e Máquinas de Estado Finitas (FSM). Nossa abordagem transforma regras de negócio de código implícito para arquitetura explícita e auditável.

**Princípio Central:** _"A lógica de negócio deve ser transparente, testável e resiliente à mudança."_

_Nota do Arquiteto: Esta doutrina foi refinada como resultado da remediação da Auditoria Red Team, incorporando especificações técnicas quantificáveis e alinhamento com framework de governança de riscos baseado em padrões da indústria financeira._

---

## 1. 📐 Identificação das Invariantes de Negócio

### **1.1 Definição e Classificação de Invariantes**

**Invariantes** são regras de negócio que devem ser **sempre verdadeiras**, independentemente das operações realizadas no sistema. São os pilares da consistência dos dados e da integridade do domínio.

#### **Taxonomia de Invariantes do Simpix:**

| **Tipo**                  | **Escopo**     | **Exemplo Simpix**                                    | **Enforcement**       |
| ------------------------- | -------------- | ----------------------------------------------------- | --------------------- |
| **Invariantes Hard**      | Agregado único | `proposta.valor > 0`                                  | Transacional imediato |
| **Invariantes Soft**      | Cross-agregado | `parceiro.limite_disponivel >= soma_propostas_ativas` | Consistência eventual |
| **Invariantes de Estado** | FSM            | `status=APROVADA → renda_validada=true`               | Transição de estado   |
| **Invariantes Temporais** | Lifecycle      | `data_vencimento > data_criacao`                      | Validação temporal    |

#### **Estratégia de Identificação:**

**Processo de 3 Camadas:**

1. **Análise de Stakeholders:** Entrevistas com especialistas de domínio
2. **Auditoria de Código:** Revisão de validações existentes e regras implícitas
3. **Análise de Falhas:** Estudo de bugs históricos relacionados a inconsistências

**Exemplo Prático - Proposta de Crédito:**

```typescript
// ❌ REGRA IMPLÍCITA (anti-pattern)
if (proposta.renda * 12 < proposta.valor * 0.3) {
  throw new Error('Renda insuficiente');
}

// ✅ INVARIANTE EXPLÍCITA (padrão Simpix)
class PropostaInvariants {
  static readonly RELACAO_RENDA_MAXIMA = 0.3;

  static validarCapacidadePagamento(proposta: Proposta): void {
    const rendaAnual = proposta.renda * 12;
    const comprometimentoMinimo = proposta.valor * this.RELACAO_RENDA_MAXIMA;

    if (rendaAnual < comprometimentoMinimo) {
      throw new InvariantViolationError(
        'CAPACIDADE_PAGAMENTO_INSUFICIENTE',
        `Renda anual R$ ${rendaAnual} inferior ao mínimo R$ ${comprometimentoMinimo}`
      );
    }
  }
}
```

### **1.2 Implementação de Invariantes**

#### **Padrão Guard Clause:**

```typescript
// Todas as invariantes são verificadas no início dos métodos críticos
class Proposta {
  aprovar(usuarioAprovador: User): void {
    // Guards para invariantes hard
    this.invariants.validarCapacidadePagamento();
    this.invariants.validarDocumentacaoCompleta();
    this.invariants.validarLimiteParceiro();

    // Lógica de negócio apenas após validação completa
    this.status = StatusProposta.APROVADA;
    this.dataAprovacao = new Date();
    this.aprovadoPor = usuarioAprovador.id;
  }
}
```

---

## 2. 🏗️ Design dos Agregados (DDD) e Modelagem de Consistência

### **2.1 Princípios de Design de Agregados (Vaughn Vernon)**

Nossa implementação segue as **4 Regras Fundamentais** de Vaughn Vernon:

#### **Regra 1: Modelar Invariantes Verdadeiras em Boundaries de Consistência**

- **Princípio:** Apenas invariantes que requerem consistência transacional devem estar no mesmo agregado
- **Implementação Simpix:** Proposta + Parcelas no mesmo agregado (valor total deve ser coerente)

#### **Regra 2: Design de Agregados Pequenos**

- **Princípio:** Preferir agregados de entidade única (70% dos casos)
- **Implementação Simpix:** `User`, `Parceiro`, `Produto` são agregados independentes

#### **Regra 3: Referenciar Outros Agregados Apenas por ID**

- **Princípio:** Evitar referências de objeto diretas entre agregados
- **Implementação Simpix:** `Proposta.parceiroId` em vez de `Proposta.parceiro`

#### **Regra 4: Consistência Eventual Entre Agregados**

- **Princípio:** Usar domain events para coordenação cross-agregado
- **Implementação Simpix:** `PropostaAprovadaEvent` → atualiza limite do parceiro

### **2.2 Agregado de Referência: Classe Proposta**

**Estrutura Canônica:**

```typescript
// Exemplo canônico de agregado bem projetado no Simpix
export class Proposta {
  // Identificação (Aggregate Root)
  readonly id: PropostaId;

  // Invariantes protegidas
  private _valor: Money;
  private _status: StatusProposta;
  private _parcelas: Parcela[];

  // Referências por ID (não por objeto)
  readonly parceiroId: ParceiroId;
  readonly usuarioId: UserId;
  readonly produtoId: ProdutoId;

  // Invariants enforcement
  private readonly invariants = new PropostaInvariants(this);

  // Operações de negócio que preservam invariantes
  aprovar(aprovador: User): DomainEvent[] {
    this.invariants.validarAntesAprovacao();

    this._status = StatusProposta.APROVADA;
    this.dataAprovacao = new Date();

    return [new PropostaAprovadaEvent(this.id, this.parceiroId, this._valor)];
  }

  // Acesso controlado aos dados internos
  get valor(): Money {
    return this._valor;
  }
  get status(): StatusProposta {
    return this._status;
  }
  get parcelas(): readonly Parcela[] {
    return Object.freeze([...this._parcelas]);
  }
}
```

### **2.3 Boundaries de Consistência**

**Mapeamento de Agregados do Simpix:**

| **Agregado** | **Entities**               | **Invariantes Protegidas**   | **Size** |
| ------------ | -------------------------- | ---------------------------- | -------- |
| `Proposta`   | Proposta + Parcelas        | Valor total, Status FSM      | Pequeno  |
| `User`       | User + Profile             | Dados pessoais, Autenticação | Pequeno  |
| `Parceiro`   | Parceiro + ConfigComercial | Limite crédito, Produtos     | Médio    |
| `Produto`    | Produto + TabelaComercial  | Taxas, Regras comerciais     | Médio    |

**Padrão Repository (Um por Agregado):**

```typescript
interface PropostaRepository {
  findById(id: PropostaId): Promise<Proposta | null>;
  save(proposta: Proposta): Promise<void>;
  findByStatus(status: StatusProposta): Promise<Proposta[]>;
}

// ❌ ANTI-PATTERN: Repository para entidades internas
interface ParcelaRepository {} // NUNCA implementar

// ✅ PADRÃO CORRETO: Acesso via Aggregate Root
const proposta = await repository.findById(propostaId);
const parcelas = proposta.parcelas; // Acesso controlado
```

---

## 3. ✅ Estratégia para Validação de Regras de Negócio

### **3.1 Arquitetura de Validação em Camadas**

Nossa estratégia implementa **validação multinível** para separar responsabilidades:

#### **Camada 1: Validação de Formato (API + Zod)**

```typescript
// Validação sintática na entrada da API
const createPropostaSchema = z.object({
  valor: z.number().positive().max(1000000),
  renda: z.number().positive(),
  parceiroId: z.string().uuid(),
  produtoId: z.string().uuid(),
});

// Middleware de validação
app.post('/api/propostas', validateRequest(createPropostaSchema), createProposta);
```

#### **Camada 2: Validação de Regras de Negócio (Agregados)**

```typescript
// Validação semântica dentro do domínio
class PropostaInvariants {
  validarCapacidadePagamento(): void {
    const comprometimentoAtual = this.calcularComprometimentoRenda();

    if (comprometimentoAtual > PropostaInvariants.COMPROMETIMENTO_MAXIMO) {
      throw new BusinessRuleViolationError(
        'COMPROMETIMENTO_RENDA_EXCEDIDO',
        `Comprometimento ${comprometimentoAtual}% excede limite de ${PropostaInvariants.COMPROMETIMENTO_MAXIMO}%`
      );
    }
  }
}
```

#### **Camada 3: Validação Cross-Agregado (Domain Services)**

```typescript
// Validação que envolve múltiplos agregados
class LimiteParceiroService {
  async validarLimiteDisponivel(parceiroId: ParceiroId, valorProposta: Money): Promise<void> {
    const parceiro = await this.parceiroRepo.findById(parceiroId);
    const propostas = await this.propostaRepo.findByParceiroAndStatus(
      parceiroId,
      StatusProposta.ATIVA
    );

    const limiteUtilizado = propostas.reduce((sum, p) => sum + p.valor, 0);
    const limiteDisponivel = parceiro.limiteTotal - limiteUtilizado;

    if (valorProposta > limiteDisponivel) {
      throw new BusinessRuleViolationError(
        'LIMITE_PARCEIRO_EXCEDIDO',
        `Valor R$ ${valorProposta} excede limite disponível R$ ${limiteDisponivel}`
      );
    }
  }
}
```

### **3.2 Padrão Specification para Regras Complexas**

```typescript
// Composição de regras usando Specification Pattern
interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
}

class IdadeMinima implements Specification<User> {
  constructor(private idadeMinima: number) {}

  isSatisfiedBy(user: User): boolean {
    return user.idade >= this.idadeMinima;
  }
}

class RendaMinima implements Specification<User> {
  constructor(private rendaMinima: number) {}

  isSatisfiedBy(user: User): boolean {
    return user.renda >= this.rendaMinima;
  }
}

// Uso composicional
const usuarioElegivelCredito = new IdadeMinima(18).and(new RendaMinima(2000)).and(new CPFValido());

if (!usuarioElegivelCredito.isSatisfiedBy(usuario)) {
  throw new BusinessRuleViolationError('USUARIO_NAO_ELEGIVEL');
}
```

---

## 4. 🔄 Definição de Máquinas de Estado (State Machines)

### **4.1 Filosofia FSM no Simpix**

**Princípio:** Todos os ciclos de vida complexos devem ser gerenciados por Máquinas de Estado Finitas para garantir transições válidas e auditabilidade completa.

### **4.2 Arquitetura FSM de Referência: StatusFsmService**

**Estrutura Base:**

```typescript
interface StateTransition {
  from: string;
  to: string;
  event: string;
  guards?: string[];
  actions?: string[];
}

interface FSMDefinition {
  initialState: string;
  states: string[];
  transitions: StateTransition[];
}

class StatusFsmService {
  private readonly definition: FSMDefinition;

  constructor() {
    this.definition = {
      initialState: 'RASCUNHO',
      states: [
        'RASCUNHO',
        'ANALISE',
        'APROVADA',
        'REJEITADA',
        'CONTRATADA',
        'CANCELADA',
        'FINALIZADA',
      ],
      transitions: [
        { from: 'RASCUNHO', to: 'ANALISE', event: 'ENVIAR_ANALISE' },
        { from: 'ANALISE', to: 'APROVADA', event: 'APROVAR', guards: ['validarDocumentacao'] },
        { from: 'ANALISE', to: 'REJEITADA', event: 'REJEITAR' },
        { from: 'APROVADA', to: 'CONTRATADA', event: 'CONTRATAR', guards: ['validarAssinatura'] },
        // ... outras transições
      ],
    };
  }

  canTransition(currentState: string, event: string): boolean {
    return this.definition.transitions.some((t) => t.from === currentState && t.event === event);
  }

  async transition(
    propostaId: PropostaId,
    event: string,
    context: TransitionContext
  ): Promise<string> {
    const proposta = await this.propostaRepo.findById(propostaId);
    const currentState = proposta.status;

    if (!this.canTransition(currentState, event)) {
      throw new InvalidTransitionError(
        `Transição '${event}' inválida a partir do estado '${currentState}'`
      );
    }

    const transition = this.findTransition(currentState, event);

    // Executar guards
    await this.executeGuards(transition.guards, proposta, context);

    // Executar transição
    const newState = transition.to;
    proposta.updateStatus(newState);

    // Executar actions
    await this.executeActions(transition.actions, proposta, context);

    // Audit log
    await this.auditService.logTransition(
      propostaId,
      currentState,
      newState,
      event,
      context.userId
    );

    return newState;
  }
}
```

### **4.3 Guards e Actions**

**Guards (Pré-condições):**

```typescript
class PropostaGuards {
  static async validarDocumentacao(proposta: Proposta): Promise<void> {
    const documentos = await this.documentoService.findByProposta(proposta.id);
    const documentosObrigatorios = ['CPF', 'COMPROVANTE_RENDA', 'COMPROVANTE_RESIDENCIA'];

    for (const tipo of documentosObrigatorios) {
      const documento = documentos.find((d) => d.tipo === tipo);
      if (!documento || !documento.validado) {
        throw new GuardViolationError(`Documento ${tipo} não validado`);
      }
    }
  }

  static async validarAssinatura(proposta: Proposta): Promise<void> {
    const assinatura = await this.clickSignService.getAssinatura(proposta.contratoId);
    if (!assinatura || !assinatura.assinadoTodasPartes) {
      throw new GuardViolationError('Contrato não assinado por todas as partes');
    }
  }
}
```

**Actions (Efeitos Colaterais):**

```typescript
class PropostaActions {
  static async enviarNotificacaoAprovacao(proposta: Proposta): Promise<void> {
    await this.emailService.send({
      to: proposta.usuario.email,
      template: 'PROPOSTA_APROVADA',
      data: { numeroProposta: proposta.numero, valor: proposta.valor },
    });
  }

  static async atualizarLimiteParceiro(proposta: Proposta): Promise<void> {
    await this.parceiroService.consumirLimite(proposta.parceiroId, proposta.valor);
  }
}
```

### **4.4 Auditoria e Rastreabilidade**

```typescript
interface StatusTransitionLog {
  propostaId: PropostaId;
  fromStatus: string;
  toStatus: string;
  event: string;
  userId: UserId;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

// Toda transição é auditada automaticamente
await this.auditRepo.save({
  propostaId: proposta.id,
  fromStatus: 'ANALISE',
  toStatus: 'APROVADA',
  event: 'APROVAR',
  userId: context.userId,
  timestamp: new Date(),
  metadata: { justificativa: context.justificativa },
});
```

---

## 5. 📊 Análise de Complexidade Ciclomática

### **5.1 Política de Complexidade Ciclomática**

**Thresholds Mandatórios:**

| **Complexidade** | **Ação**                   | **Prazo**      | **Responsável** |
| ---------------- | -------------------------- | -------------- | --------------- |
| **1-10**         | ✅ Aceitável               | -              | -               |
| **11-15**        | ⚠️ Revisão recomendada     | Próximo sprint | Desenvolvedor   |
| **16-20**        | 🚨 Refatoração obrigatória | 2 sprints      | Tech Lead       |
| **21+**          | ❌ Bloqueio de merge       | Imediato       | Arquiteto       |

### **5.2 Implementação no CI/CD**

**ESLint Configuration (.eslintrc.js):**

```javascript
module.exports = {
  rules: {
    complexity: ['error', { max: 15 }],
    'max-lines-per-function': ['error', { max: 50 }],
    'max-depth': ['error', { max: 4 }],
    'max-nested-callbacks': ['error', { max: 3 }],
  },
};
```

**GitHub Actions Integration:**

```yaml
- name: Complexity Analysis
  run: |
    npx eslint --ext .ts,.tsx src/ --format json --output-file complexity-report.json
    COMPLEX_FUNCTIONS=$(cat complexity-report.json | jq '[.[] | .messages[] | select(.ruleId == "complexity")] | length')

    if [ "$COMPLEX_FUNCTIONS" -gt 0 ]; then
      echo "❌ $COMPLEX_FUNCTIONS functions exceed complexity threshold"
      exit 1
    fi
```

### **5.3 Estratégias de Redução de Complexidade**

#### **Padrão Extract Method:**

```typescript
// ❌ ANTES: Alta complexidade (CC = 12)
function processarProposta(dados: PropostaData): PropostaResult {
  if (!dados.usuario) throw new Error("Usuário obrigatório");
  if (!dados.valor || dados.valor <= 0) throw new Error("Valor inválido");
  if (!dados.produto) throw new Error("Produto obrigatório");

  let taxa = 0.1;
  if (dados.produto.tipo === 'PREMIUM') {
    taxa = 0.08;
  } else if (dados.produto.tipo === 'GOLD') {
    taxa = 0.09;
  }

  const usuario = this.userService.findById(dados.usuario.id);
  if (usuario.score < 500) {
    taxa += 0.02;
  } else if (usuario.score > 800) {
    taxa -= 0.01;
  }

  const parcelas = [];
  for (let i = 1; i <= dados.numeroParcelas; i++) {
    const valor = this.calcularParcela(dados.valor, taxa, i);
    parcelas.push({ numero: i, valor, vencimento: this.calcularVencimento(i) });
  }

  return { proposta: dados, taxa, parcelas };
}

// ✅ DEPOIS: Baixa complexidade (CC = 3 por função)
function processarProposta(dados: PropostaData): PropostaResult {
  this.validarDadosObrigatorios(dados);

  const taxa = this.calcularTaxaFinal(dados);
  const parcelas = this.gerarParcelas(dados, taxa);

  return { proposta: dados, taxa, parcelas };
}

private validarDadosObrigatorios(dados: PropostaData): void {
  if (!dados.usuario) throw new Error("Usuário obrigatório");
  if (!dados.valor || dados.valor <= 0) throw new Error("Valor inválido");
  if (!dados.produto) throw new Error("Produto obrigatório");
}

private calcularTaxaFinal(dados: PropostaData): number {
  const taxaBase = this.obterTaxaPorTipoProduto(dados.produto.tipo);
  const ajusteScore = this.calcularAjustePorScore(dados.usuario.score);
  return taxaBase + ajusteScore;
}
```

#### **Padrão Strategy para Switch Statements:**

```typescript
// ❌ ANTES: Switch complexo
function calcularTaxa(tipoProduto: string, score: number): number {
  switch (tipoProduto) {
    case 'BASICO':
      if (score < 500) return 0.15;
      else if (score < 700) return 0.12;
      else return 0.1;
    case 'PREMIUM':
      if (score < 500) return 0.12;
      else if (score < 700) return 0.1;
      else return 0.08;
    // ... mais casos
  }
}

// ✅ DEPOIS: Strategy Pattern
interface TaxaStrategy {
  calcular(score: number): number;
}

class TaxaBasica implements TaxaStrategy {
  calcular(score: number): number {
    if (score < 500) return 0.15;
    if (score < 700) return 0.12;
    return 0.1;
  }
}

const strategies = new Map<string, TaxaStrategy>([
  ['BASICO', new TaxaBasica()],
  ['PREMIUM', new TaxaPremium()],
  ['GOLD', new TaxaGold()],
]);

function calcularTaxa(tipoProduto: string, score: number): number {
  const strategy = strategies.get(tipoProduto);
  if (!strategy) throw new Error(`Produto ${tipoProduto} não suportado`);
  return strategy.calcular(score);
}
```

### **5.4 Monitoramento Contínuo**

**SonarQube Quality Gate:**

```yaml
sonar.qualitygate.conditions:
  - metric: complexity
    op: GT
    error: 15
  - metric: function_complexity
    op: GT
    error: 10
  - metric: cognitive_complexity
    op: GT
    error: 15
```

**Dashboard de Métricas:**

- **Complexidade média por módulo**
- **Top 10 funções mais complexas**
- **Tendência de complexidade ao longo do tempo**
- **Debt ratio relacionado à complexidade**

---

## 📋 Implementação e Governance

### **Checklist de Conformidade**

- [ ] Invariantes identificadas e documentadas
- [ ] Agregados projetados conforme regras de Vernon
- [ ] Validação multicamada implementada
- [ ] FSM definidas para workflows críticos
- [ ] Complexidade ciclomática < 15 para todas as funções
- [ ] Auditoria de transições de estado ativa
- [ ] Testes de invariantes cobrindo cenários críticos

### **Processo de Revisão**

1. **Code Review obrigatório** para mudanças em agregados
2. **Validação de arquiteto** para novos FSMs
3. **Análise de complexidade** automatizada no CI/CD
4. **Revisão trimestral** das invariantes de negócio

---

## 🚨 Declaração de Incerteza

### **CONFIANÇA NA IMPLEMENTAÇÃO: 92%**

**Alta Confiança (95%):**

- Padrões DDD baseados em Vernon/Fowler (fontes P1 consultadas)
- FSM patterns validados em sistemas enterprise
- Complexidade ciclomática com thresholds industry-standard

**Incerteza Controlada (8%):**

- Adaptação específica para domínio financeiro brasileiro
- Integração com stack TypeScript + Drizzle
- Performance de FSM em alto volume

### **RISCOS IDENTIFICADOS: MÉDIO**

**Riscos Técnicos:**

- Overhead de validação pode impactar performance
- Complexidade de debugging em FSMs complexas
- Curva de aprendizado para padrões DDD

**Mitigações:**

- Profiling contínuo de performance
- Ferramentas de visualização de FSM
- Treinamento e documentação detalhada

### **DECISÕES TÉCNICAS ASSUMIDAS:**

1. **Aggregate design baseado em Vernon** é a melhor prática para sistemas financeiros
2. **FSM centralizadas** são preferíveis a lógica espalhada
3. **Validação multicamada** oferece melhor separação de responsabilidades
4. **Complexidade ciclomática < 15** é adequada para domínio financeiro crítico
5. **Auditoria completa** de transições é mandatória para compliance

### **VALIDAÇÃO PENDENTE:**

- [ ] Revisão e aprovação pelo Arquiteto Chefe
- [ ] Validação de performance com carga real
- [ ] Treinamento da equipe nos padrões estabelecidos
- [ ] Implementação piloto em módulo de Propostas

---

**Documento gerado seguindo PAM V1.0 - Formalização da Doutrina de Lógica de Negócio**  
**Status:** Última peça da Operação Planta Impecável  
**Próximo passo:** Ratificação arquitetural e conclusão da fase

---

**Arquiteto de Domínio**  
_25/08/2025 - Lógica de Negócio como Arquitetura Explícita_
