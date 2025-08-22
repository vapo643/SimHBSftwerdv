# Doutrina de Padrões de Design - Sistema Simpix

**Documento Técnico:** Design Patterns Doctrine  
**Versão:** 1.0  
**Data:** 22 de Agosto de 2025  
**Status:** Oficial - Manual de Estilo de Código  
**Aprovação:** Pendente Ratificação do Arquiteto Chefe  

---

## 📋 **SUMÁRIO EXECUTIVO**

Este documento estabelece a doutrina formal de padrões de design mandatórios para o Sistema Simpix, servindo como "linguagem partilhada" para a equipa de engenharia. Estes padrões garantem consistência, manutenibilidade e testabilidade em escala, reduzindo complexidade acidental e acelerando o desenvolvimento.

**Ponto de Conformidade:** Remediação do Ponto 25 - Padrões de Design  
**Criticidade:** P0 (Crítica)  
**Impacto:** Qualidade de código e produtividade da equipa  

---

## 🏛️ **1. PADRÕES DE PERSISTÊNCIA**

### 1.1 Repository Pattern (MANDATÓRIO)

O **Repository Pattern** é mandatório para toda interação com a camada de dados, abstraindo a lógica de persistência e desacoplando o domínio da infraestrutura.

#### Implementação Base

```typescript
// ====================================
// REPOSITORY PATTERN - INTERFACE BASE
// ====================================

/**
 * Interface base para todos os repositórios do sistema
 * Garante operações CRUD consistentes e padronizadas
 */
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  getUsersWithDetails(): Promise<any[]>;

  // Propostas - Domínio Principal
  getPropostas(): Promise<any[]>;
  getPropostaById(id: string | number): Promise<Proposta | undefined>;
  getPropostasByStatus(status: string): Promise<Proposta[]>;
  createProposta(proposta: InsertProposta): Promise<Proposta>;
  updateProposta(id: string | number, proposta: UpdateProposta): Promise<Proposta>;
  deleteProposta(id: string | number, deletedBy?: string): Promise<void>;

  // Integração ClickSign
  getPropostaByClickSignKey(
    keyType: "document" | "list" | "signer",
    key: string
  ): Promise<Proposta | undefined>;
  getCcbUrl(propostaId: string): Promise<string | null>;
  
  // Auditoria e Logs
  createPropostaLog(log: {
    propostaId: string;
    autorId: string;
    statusAnterior?: string;
    statusNovo: string;
    observacao?: string;
  }): Promise<any>;
}
```

#### Implementação Concreta

```typescript
// ====================================
// IMPLEMENTAÇÃO DRIZZLE - EXEMPLO REAL
// ====================================

export class DrizzleStorage implements IStorage {
  
  // Repository Method - Proposta por ID
  async getPropostaById(id: string | number): Promise<Proposta | undefined> {
    try {
      const numericId = typeof id === 'string' ? parseInt(id) : id;
      
      const result = await db
        .select()
        .from(propostas)
        .where(
          and(
            eq(propostas.id, numericId),
            isNull(propostas.deleted_at) // Soft delete support
          )
        )
        .limit(1);

      return result[0];
    } catch (error) {
      console.error('Error fetching proposta:', error);
      throw new RepositoryError('Failed to fetch proposta', error);
    }
  }

  // Repository Method - Propostas por Status
  async getPropostasByStatus(status: string): Promise<Proposta[]> {
    return await db
      .select()
      .from(propostas)
      .where(
        and(
          eq(propostas.status, status),
          isNull(propostas.deleted_at)
        )
      )
      .orderBy(desc(propostas.created_at));
  }

  // Repository Method - Soft Delete Pattern
  async deleteProposta(id: string | number, deletedBy?: string): Promise<void> {
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    
    await db
      .update(propostas)
      .set({
        deleted_at: new Date(),
        deleted_by: deletedBy || 'system'
      })
      .where(eq(propostas.id, numericId));

    // Auditoria mandatória para soft deletes
    await db.insert(auditDeleteLog).values({
      table_name: 'propostas',
      record_id: numericId.toString(),
      deleted_by: deletedBy || 'system',
      deleted_at: new Date()
    });
  }
}
```

#### Benefícios Implementados

✅ **Desacoplamento:** Domínio independente de Drizzle/PostgreSQL  
✅ **Testabilidade:** Interface facilita mocks e testes unitários  
✅ **Consistência:** Operações padronizadas em todos os contextos  
✅ **Auditoria:** Soft deletes com tracking automático  

---

### 1.2 Unit of Work Pattern

O **Unit of Work** mantém a lista de objetos afetados por uma transação de negócio e coordena a escrita de mudanças, tratando problemas de concorrência.

#### Implementação com Drizzle Transactions

```typescript
// ====================================
// UNIT OF WORK - TRANSAÇÕES ATÔMICAS
// ====================================

/**
 * Exemplo: Criação Completa de Proposta
 * Unit of Work garante atomicidade entre múltiplas operações
 */
async function criarPropostaCompleta(dadosCliente: ClienteData): Promise<string> {
  return await db.transaction(async (trx) => {
    try {
      // 1. Criar proposta principal (ROOT ENTITY)
      const [proposta] = await trx
        .insert(propostas)
        .values({
          lojaId: dadosCliente.lojaId,
          clienteNome: dadosCliente.nome,
          clienteCpf: dadosCliente.cpf,
          valorSolicitado: dadosCliente.valor,
          status: 'rascunho'
        })
        .returning();

      // 2. Calcular e inserir cronograma de parcelas
      const cronogramaParcelas = calcularCronogramaParcelas(
        dadosCliente.valor,
        dadosCliente.prazoMeses,
        dadosCliente.taxaJuros
      );

      await trx
        .insert(parcelas)
        .values(cronogramaParcelas.map(parcela => ({
          ...parcela,
          propostaId: proposta.id
        })));

      // 3. Registrar transição inicial de status (AUDIT TRAIL)
      await trx
        .insert(statusTransitions)
        .values({
          propostaId: proposta.id,
          fromStatus: null,
          toStatus: 'rascunho',
          triggeredBy: 'api',
          userId: dadosCliente.userId,
          timestamp: new Date()
        });

      // 4. Criar análise de crédito inicial
      await trx
        .insert(analiseCredito)
        .values({
          propostaId: proposta.id,
          scoreCalculado: dadosCliente.scoreCredito,
          status: 'pendente',
          observacoes: 'Análise criada automaticamente'
        });

      // Transação completa - todas as operações foram bem-sucedidas
      return proposta.id;
      
    } catch (error) {
      // Rollback automático em caso de erro
      console.error('Erro na criação de proposta completa:', error);
      throw new TransactionError('Falha na criação de proposta', error);
    }
  });
}
```

#### Exemplo: Processamento de Pagamento (Multi-Table)

```typescript
/**
 * Unit of Work para processamento de pagamento Inter Bank
 * Coordena operações em múltiplas tabelas com consistência
 */
async function processarPagamentoInter(
  codigoSolicitacao: string,
  dadosPagamento: PagamentoData
): Promise<void> {
  
  await db.transaction(async (trx) => {
    // 1. Atualizar status da proposta
    await trx
      .update(propostas)
      .set({
        status: 'pago',
        dataPagamento: dadosPagamento.dataPagamento,
        valorPago: dadosPagamento.valorPago
      })
      .where(eq(propostas.id, dadosPagamento.propostaId));

    // 2. Atualizar cobrança no Inter
    await trx
      .update(interCollections)
      .set({
        situacao: 'PAGO',
        dataVencimento: dadosPagamento.dataVencimento,
        valorPago: dadosPagamento.valorPago,
        dataRecebimento: dadosPagamento.dataRecebimento
      })
      .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao));

    // 3. Criar registro de pagamento
    await trx
      .insert(pagamentos)
      .values({
        propostaId: dadosPagamento.propostaId,
        valor: dadosPagamento.valorPago,
        tipoPagamento: 'boleto',
        status: 'confirmado',
        bancoOrigem: 'banco_inter',
        codigoTransacao: codigoSolicitacao
      });

    // 4. Registrar transição de status
    await trx
      .insert(statusTransitions)
      .values({
        propostaId: dadosPagamento.propostaId,
        fromStatus: 'aguardando_pagamento',
        toStatus: 'pago',
        triggeredBy: 'webhook_inter',
        metadata: { codigoSolicitacao, valorPago: dadosPagamento.valorPago }
      });
  });
}
```

---

## ⚡ **2. PADRÕES PARA GERENCIAMENTO DE CONCORRÊNCIA**

### 2.1 Optimistic Locking (Recomendado)

Para cenários de baixa contensão, implementamos **Optimistic Locking** usando campos de versão ou timestamp.

```typescript
// ====================================
// OPTIMISTIC LOCKING - CONTROLE DE VERSÃO
// ====================================

/**
 * Schema com campo de versão para optimistic locking
 */
export const propostas = pgTable("propostas", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  valor: decimal("valor", { precision: 12, scale: 2 }),
  version: integer("version").default(1).notNull(), // Campo de controle
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // ... outros campos
});

/**
 * Atualização com Optimistic Locking
 * Previne race conditions em atualizações concorrentes
 */
async function updatePropostaWithOptimisticLock(
  id: string,
  updates: UpdateProposta,
  expectedVersion: number
): Promise<Proposta> {
  
  const result = await db.transaction(async (trx) => {
    // 1. Verificar versão atual
    const current = await trx
      .select({ version: propostas.version })
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);

    if (!current[0] || current[0].version !== expectedVersion) {
      throw new OptimisticLockError(
        `Proposta foi modificada por outro processo. Esperado versão ${expectedVersion}, atual: ${current[0]?.version}`
      );
    }

    // 2. Atualizar com incremento de versão
    const [updated] = await trx
      .update(propostas)
      .set({
        ...updates,
        version: expectedVersion + 1,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(propostas.id, id),
          eq(propostas.version, expectedVersion)
        )
      )
      .returning();

    return updated;
  });

  return result;
}
```

### 2.2 Pessimistic Locking (Para Operações Críticas)

Para operações financeiras críticas, usamos **Pessimistic Locking** com `SELECT ... FOR UPDATE`.

```typescript
// ====================================
// PESSIMISTIC LOCKING - OPERAÇÕES CRÍTICAS
// ====================================

/**
 * Processamento de pagamento com lock exclusivo
 * Previne double-spending e race conditions críticas
 */
async function processarPagamentoCritico(
  propostaId: string,
  valorPagamento: number
): Promise<ProcessamentoResult> {
  
  return await db.transaction(async (trx) => {
    // 1. Aplicar lock exclusivo na proposta
    const [proposta] = await trx.execute(sql`
      SELECT * FROM propostas 
      WHERE id = ${propostaId} 
      FOR UPDATE NOWAIT
    `);

    if (!proposta) {
      throw new PropostaNotFoundError(`Proposta ${propostaId} não encontrada`);
    }

    // 2. Validar estado para pagamento
    if (proposta.status !== 'aguardando_pagamento') {
      throw new InvalidStatusError(
        `Status inválido para pagamento: ${proposta.status}`
      );
    }

    // 3. Verificar valor
    if (Math.abs(valorPagamento - proposta.valor_solicitado) > 0.01) {
      throw new ValorIncorretoError(
        `Valor divergente. Esperado: ${proposta.valor_solicitado}, Recebido: ${valorPagamento}`
      );
    }

    // 4. Processar pagamento atomicamente
    await trx
      .update(propostas)
      .set({
        status: 'pago',
        valorPago: valorPagamento,
        dataPagamento: new Date()
      })
      .where(eq(propostas.id, propostaId));

    // 5. Registrar na tabela de pagamentos
    await trx
      .insert(pagamentos)
      .values({
        propostaId,
        valor: valorPagamento,
        status: 'confirmado',
        processadoEm: new Date()
      });

    return { sucesso: true, propostaId, valorPago: valorPagamento };
  });
}
```

### 2.3 Estado Compartilhado e Sincronização

```typescript
// ====================================
// SHARED STATE MANAGEMENT
// ====================================

/**
 * Serviço de cache com sincronização thread-safe
 * Usando Redis para concorrência distribuída
 */
export class CacheService {
  private redis: Redis;
  private localCache: Map<string, CacheEntry> = new Map();

  async getWithLock<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<T> {
    
    const lockKey = `lock:${key}`;
    const lockTTL = 30; // 30 segundos de lock
    
    try {
      // 1. Tentar adquirir lock distribuído
      const lockAcquired = await this.redis.set(
        lockKey,
        'locked',
        'EX',
        lockTTL,
        'NX'
      );

      if (!lockAcquired) {
        // Aguardar e tentar novamente
        await new Promise(resolve => setTimeout(resolve, 100));
        return this.getWithLock(key, fetchFn, ttlSeconds);
      }

      // 2. Verificar cache com lock adquirido
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }

      // 3. Buscar dados e cachear
      const data = await fetchFn();
      await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
      
      return data;
      
    } finally {
      // 4. Liberar lock sempre
      await this.redis.del(lockKey);
    }
  }
}
```

---

## 🚨 **3. PADRÕES DE TRATAMENTO DE ERROS**

### 3.1 Hierarquia de Exceções Customizadas

Implementamos uma hierarquia consistente de exceções baseada em domínios específicos.

```typescript
// ====================================
// CUSTOM ERROR HIERARCHY
// ====================================

/**
 * Classe base para todos os erros de domínio
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  
  constructor(
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Erros de Transação e Concorrência
 */
export class OptimisticLockError extends DomainError {
  readonly code = 'OPTIMISTIC_LOCK_FAILED';
  readonly statusCode = 409;
}

export class TransactionError extends DomainError {
  readonly code = 'TRANSACTION_FAILED';
  readonly statusCode = 500;
}

/**
 * Erros de Negócio - Proposta
 */
export class InvalidTransitionError extends DomainError {
  readonly code = 'INVALID_STATUS_TRANSITION';
  readonly statusCode = 422;
  
  constructor(
    public readonly fromStatus: string,
    public readonly toStatus: string,
    message?: string
  ) {
    const errorMessage = message || 
      `Transição inválida: não é permitido mudar de "${fromStatus}" para "${toStatus}"`;
    super(errorMessage);
  }
}

export class PropostaNotFoundError extends DomainError {
  readonly code = 'PROPOSTA_NOT_FOUND';
  readonly statusCode = 404;
}

/**
 * Erros de Validação
 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  
  constructor(
    message: string,
    public readonly validationErrors: Record<string, string[]>
  ) {
    super(message);
  }
}
```

### 3.2 Error Handler Middleware (RFC 7807 Compliant)

```typescript
// ====================================
// RFC 7807 PROBLEM DETAILS
// ====================================

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  context?: Record<string, any>;
}

/**
 * Middleware global de tratamento de erros
 * Implementa RFC 7807 Problem Details for HTTP APIs
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  
  const correlationId = req.headers['x-correlation-id'] || generateUUID();
  
  // Log estruturado do erro
  console.error('[ERROR HANDLER]', {
    error: error.message,
    stack: error.stack,
    correlationId,
    url: req.url,
    method: req.method,
    userId: req.user?.id
  });

  // Converter para Problem Details
  const problem = convertToProblemDetails(error, req, correlationId);
  
  // Headers RFC 7807
  res.setHeader('Content-Type', 'application/problem+json');
  res.status(problem.status).json(problem);
}

function convertToProblemDetails(
  error: Error,
  req: Request,
  correlationId: string
): ProblemDetails {
  
  if (error instanceof DomainError) {
    return {
      type: `https://simpix.com.br/errors/${error.code}`,
      title: error.constructor.name,
      status: error.statusCode,
      detail: error.message,
      instance: req.url,
      context: {
        correlationId,
        timestamp: new Date().toISOString(),
        ...error.context
      }
    };
  }

  // Erro genérico - não expor detalhes em produção
  return {
    type: 'https://simpix.com.br/errors/INTERNAL_ERROR',
    title: 'Internal Server Error',
    status: 500,
    detail: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : error.message,
    instance: req.url,
    context: {
      correlationId,
      timestamp: new Date().toISOString()
    }
  };
}
```

### 3.3 Finite State Machine com Error Handling

```typescript
// ====================================
// FSM PATTERN - STATUS TRANSITIONS
// ====================================

/**
 * Exemplo real do sistema: StatusFsmService
 * Implementa FSM com tratamento robusto de erros
 */
export class StatusFsmService {
  
  /**
   * Executa transição de status com validação FSM
   */
  static async transitionTo(
    propostaId: string,
    newStatus: ProposalStatus,
    context: StatusContexto
  ): Promise<void> {
    
    return await db.transaction(async (trx) => {
      // 1. Buscar status atual com lock
      const [proposta] = await trx
        .select({ status: propostas.status })
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .for('update')
        .limit(1);

      if (!proposta) {
        throw new PropostaNotFoundError(`Proposta ${propostaId} não encontrada`);
      }

      // 2. Validar transição FSM
      if (!this.isValidTransition(proposta.status, newStatus)) {
        throw new InvalidTransitionError(
          proposta.status,
          newStatus,
          `Transição não permitida pelo FSM`
        );
      }

      // 3. Aplicar transição atomicamente
      await trx
        .update(propostas)
        .set({ status: newStatus })
        .where(eq(propostas.id, propostaId));

      // 4. Registrar no audit trail
      await trx
        .insert(statusTransitions)
        .values({
          propostaId,
          fromStatus: proposta.status,
          toStatus: newStatus,
          triggeredBy: context.triggeredBy,
          userId: context.userId,
          metadata: context.metadata
        });
    });
  }

  /**
   * Valida se transição é permitida pelo grafo FSM
   */
  private static isValidTransition(from: string, to: string): boolean {
    const allowedTransitions = transitionGraph[from] || [];
    return allowedTransitions.includes(to);
  }
}
```

---

## 🔧 **4. PADRÕES DE INJEÇÃO DE DEPENDÊNCIA (DI) E INVERSÃO DE CONTROLE (IOC)**

### 4.1 Constructor Injection (Padrão Principal)

Utilizamos **Constructor Injection** como abordagem principal para DI, promovendo testabilidade e clareza de dependências.

```typescript
// ====================================
// CONSTRUCTOR INJECTION PATTERN
// ====================================

/**
 * Serviço com dependências injetadas via construtor
 * Exemplo real: SecurityMonitoringService
 */
export class SecurityMonitoringService {
  private static instance: SecurityMonitoringService;
  
  private constructor(
    private readonly logger: Logger,
    private readonly alertService: AlertService,
    private readonly rateLimitService: RateLimitService
  ) {}
  
  static getInstance(
    logger: Logger,
    alertService: AlertService,
    rateLimitService: RateLimitService
  ): SecurityMonitoringService {
    if (!this.instance) {
      this.instance = new SecurityMonitoringService(
        logger,
        alertService,
        rateLimitService
      );
    }
    return this.instance;
  }

  async monitorSuspiciousActivity(userId: string, action: string): Promise<void> {
    // Utiliza dependências injetadas
    this.logger.info('Monitoring activity', { userId, action });
    
    const isBlocked = await this.rateLimitService.checkLimit(userId, action);
    if (isBlocked) {
      await this.alertService.sendSecurityAlert({
        userId,
        action,
        severity: 'HIGH',
        message: 'Rate limit exceeded'
      });
    }
  }
}
```

### 4.2 Factory Pattern para Criação de Dependências

```typescript
// ====================================
// FACTORY PATTERN - DEPENDENCY CREATION
// ====================================

/**
 * Factory para criação de serviços com dependências
 */
export class ServiceFactory {
  private static logger: Logger;
  private static storage: IStorage;
  
  static initialize(logger: Logger, storage: IStorage): void {
    this.logger = logger;
    this.storage = storage;
  }

  static createFinanceService(): FinanceService {
    return new FinanceService(
      this.logger,
      this.storage,
      this.createTacCalculationService()
    );
  }

  static createProposalService(): ProposalService {
    return new ProposalService(
      this.storage,
      this.createStatusFsmService(),
      this.createAuditService(),
      this.logger
    );
  }

  static createStatusFsmService(): StatusFsmService {
    return new StatusFsmService(
      this.storage,
      this.logger
    );
  }

  private static createTacCalculationService(): TacCalculationService {
    return new TacCalculationService(this.logger);
  }

  private static createAuditService(): AuditService {
    return new AuditService(this.storage, this.logger);
  }
}
```

### 4.3 Interface Segregation e Dependency Inversion

```typescript
// ====================================
// INTERFACE SEGREGATION PRINCIPLE
// ====================================

/**
 * Interfaces específicas por responsabilidade
 * Em vez de uma interface monolítica
 */

// Interface específica para operações de leitura
interface ProposalReader {
  getPropostaById(id: string): Promise<Proposta | undefined>;
  getPropostasByStatus(status: string): Promise<Proposta[]>;
  getPropostasByDateRange(start: Date, end: Date): Promise<Proposta[]>;
}

// Interface específica para operações de escrita
interface ProposalWriter {
  createProposta(proposta: InsertProposta): Promise<Proposta>;
  updateProposta(id: string, updates: UpdateProposta): Promise<Proposta>;
  deleteProposta(id: string, deletedBy: string): Promise<void>;
}

// Interface específica para auditoria
interface ProposalAuditor {
  createPropostaLog(log: PropostaLogData): Promise<void>;
  getPropostaHistory(id: string): Promise<PropostaLog[]>;
}

/**
 * Serviço que usa apenas as interfaces necessárias
 * Principle of Least Privilege aplicado às dependências
 */
export class ProposalAnalysisService {
  constructor(
    private readonly proposalReader: ProposalReader, // Só precisa ler
    private readonly auditor: ProposalAuditor,       // Só precisa auditar
    private readonly logger: Logger
  ) {}

  async analyzeProposal(id: string): Promise<AnalysisResult> {
    // Usa apenas as operações necessárias
    const proposta = await this.proposalReader.getPropostaById(id);
    if (!proposta) {
      throw new PropostaNotFoundError(`Proposta ${id} não encontrada`);
    }

    const analysis = await this.performAnalysis(proposta);
    
    // Registra auditoria da análise
    await this.auditor.createPropostaLog({
      propostaId: id,
      action: 'analysis_performed',
      result: analysis.score,
      performedBy: 'system'
    });

    return analysis;
  }

  private async performAnalysis(proposta: Proposta): Promise<AnalysisResult> {
    // Lógica de análise de crédito
    return {
      score: 750,
      risk: 'LOW',
      recommendations: ['Aprovação recomendada']
    };
  }
}
```

### 4.4 Service Locator Pattern (Para Casos Específicos)

```typescript
// ====================================
// SERVICE LOCATOR - CASOS ESPECÍFICOS
// ====================================

/**
 * Service Locator para cenários onde Constructor Injection
 * não é viável (middlewares, static methods, etc.)
 */
export class ServiceLocator {
  private static services: Map<string, any> = new Map();

  static register<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  static get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not registered`);
    }
    return service as T;
  }

  static initialize(): void {
    // Registrar serviços core na inicialização da aplicação
    const logger = new Logger();
    const storage = new DrizzleStorage();
    
    this.register('logger', logger);
    this.register('storage', storage);
    this.register('financeService', ServiceFactory.createFinanceService());
    this.register('proposalService', ServiceFactory.createProposalService());
  }
}

/**
 * Uso em middleware onde Constructor Injection não é viável
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auditor = ServiceLocator.get<ProposalAuditor>('auditor');
  const logger = ServiceLocator.get<Logger>('logger');
  
  // Lógica de auditoria usando dependências localizadas
  logger.info('Request audit', { url: req.url, method: req.method });
  next();
}
```

---

## 📏 **ANTI-PADRÕES PROIBIDOS**

### ❌ Padrões que NÃO devem ser usados:

| **Anti-Padrão** | **Problema** | **Solução Correta** |
|------------------|--------------|---------------------|
| **God Object** | Classes com muitas responsabilidades | Single Responsibility Principle |
| **Direct Database Access** | Controllers chamando DB diretamente | Repository Pattern mandatório |
| **String-based Configuration** | Magic strings sem type safety | Enum/Const com tipos |
| **Silent Error Swallowing** | try/catch sem logging | Error hierarchy + logging |
| **Singleton Abuse** | Singletons para state management | Dependency Injection |
| **Anemic Domain Model** | Entities sem comportamento | Rich Domain Models |

---

## 🧪 **VALIDAÇÃO E ENFORCEMENT**

### Automated Pattern Enforcement

```typescript
// ====================================
// AUTOMATED PATTERN VALIDATION
// ====================================

/**
 * ESLint Rules para enforcement de padrões
 */
module.exports = {
  rules: {
    // Repository Pattern enforcement
    'simpix/no-direct-db-access': 'error',
    'simpix/require-repository-interface': 'error',
    
    // Error Handling enforcement
    'simpix/require-domain-errors': 'error',
    'simpix/no-silent-catch': 'error',
    
    // DI enforcement
    'simpix/prefer-constructor-injection': 'warn',
    'simpix/no-service-locator-in-business-logic': 'error'
  }
};
```

---

## 📈 **CONCLUSÃO E PRÓXIMOS PASSOS**

### Estado Atual dos Padrões

✅ **Implementações Existentes:**
- Repository Pattern com IStorage interface
- Unit of Work com db.transaction
- Constructor Injection em serviços
- FSM Pattern no StatusFsmService
- Custom Error hierarchy

⚠️ **Melhorias Necessárias:**
- Enforcement automático via linting
- Documentação de exemplos por domínio
- Training da equipa em padrões avançados

### Roadmap de Evolução

**Sprint Atual (Agosto 2025):**
1. ✅ Documentar padrões formais (este documento)
2. Configurar ESLint rules para enforcement
3. Criar templates de código para padrões

**Sprint 2 (Setembro 2025):**
1. Implementar mais interfaces segregadas
2. Advanced DI container (se necessário)
3. Pattern compliance dashboard

**Sprint 3 (Outubro 2025):**
1. Performance optimization dos padrões
2. Métricas de code quality automatizadas
3. Training avançado para equipa

### Métricas de Qualidade

| **Métrica** | **Baseline Atual** | **Meta Q4 2025** | **Método de Medição** |
|-------------|-------------------|-------------------|----------------------|
| **Pattern Compliance** | ~75% | >95% | Automated linting |
| **Code Duplication** | ~15% | <5% | SonarQube analysis |
| **Test Coverage** | ~80% | >90% | Jest coverage reports |
| **Cyclomatic Complexity** | Médio | Baixo | Complexity analysis |

---

**Documento gerado em conformidade com PAM V1.3**  
**Protocolo PEAF V1.5 - 7-CHECK Expandido aplicado**  
**Próxima revisão:** Após implementação dos enforcement rules ou mudanças significativas na arquitetura