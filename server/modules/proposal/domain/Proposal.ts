/**
 * Aggregate Root: Proposal
 *
 * Este agregado encapsula toda a lógica de negócio relacionada a propostas de crédito.
 * Segue os princípios de Domain-Driven Design (DDD).
 */

import { v4 as uuidv4 } from 'uuid';
import { DomainException } from '../../shared/domain/DomainException';
import { CPF, Money, Email, PhoneNumber, CEP } from '@shared/value-objects';

// Value Objects
export interface ClienteData {
  nome: string;
  cpf: CPF;
  rg?: string;
  email?: Email;
  telefone?: PhoneNumber;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: CEP;
  data_nascimento?: string;
  renda_mensal?: Money;
  empregador?: string;
  tempo_emprego?: string;
  dividas_existentes?: Money;
}

export interface DadosPagamento {
  metodo: 'boleto' | 'pix' | 'transferencia';
  banco?: string;
  agencia?: string;
  conta?: string;
  tipo_conta?: string;
  pix_chave?: string;
  pix_tipo?: string;
}

// Domain Events
export interface ProposalDomainEvent {
  aggregateId: string;
  eventType: string;
  payload: any;
  occurredAt: Date;
}

export class ProposalCreatedEvent implements ProposalDomainEvent {
  constructor(
    public aggregateId: string,
    public eventType: string = 'ProposalCreated',
    public payload: any,
    public occurredAt: Date = new Date()
  ) {}
}

export class ProposalApprovedEvent implements ProposalDomainEvent {
  constructor(
    public aggregateId: string,
    public eventType: string = 'ProposalApproved',
    public payload: any,
    public occurredAt: Date = new Date()
  ) {}
}

export class ProposalRejectedEvent implements ProposalDomainEvent {
  constructor(
    public aggregateId: string,
    public eventType: string = 'ProposalRejected',
    public payload: any,
    public occurredAt: Date = new Date()
  ) {}
}

export class ProposalSubmittedEvent implements ProposalDomainEvent {
  constructor(
    public aggregateId: string,
    public eventType: string = 'ProposalSubmitted',
    public payload: any,
    public occurredAt: Date = new Date()
  ) {}
}

export class ProposalPendingEvent implements ProposalDomainEvent {
  constructor(
    public aggregateId: string,
    public eventType: string = 'ProposalPending',
    public payload: any,
    public occurredAt: Date = new Date()
  ) {}
}

export class ProposalUpdatedAfterPendingEvent implements ProposalDomainEvent {
  constructor(
    public aggregateId: string,
    public eventType: string = 'ProposalUpdatedAfterPending',
    public payload: any,
    public occurredAt: Date = new Date()
  ) {}
}

export class ProposalCcbGeneratedEvent implements ProposalDomainEvent {
  constructor(
    public aggregateId: string,
    public eventType: string = 'ProposalCcbGenerated',
    public payload: any,
    public occurredAt: Date = new Date()
  ) {}
}

export class ProposalSignatureCompletedEvent implements ProposalDomainEvent {
  constructor(
    public aggregateId: string,
    public eventType: string = 'ProposalSignatureCompleted',
    public payload: any,
    public occurredAt: Date = new Date()
  ) {}
}

// Status Enum (domínio)
export enum ProposalStatus {
  RASCUNHO = 'rascunho',
  EM_ANALISE = 'em_analise',
  APROVADO = 'aprovado',
  REJEITADO = 'rejeitado',
  PENDENCIADO = 'pendenciado', // Novo estado para proposta com pendências
  CCB_GERADA = 'CCB_GERADA',
  AGUARDANDO_ASSINATURA = 'AGUARDANDO_ASSINATURA',
  ASSINATURA_CONCLUIDA = 'ASSINATURA_CONCLUIDA',
  BOLETOS_EMITIDOS = 'BOLETOS_EMITIDOS',
  PAGAMENTO_AUTORIZADO = 'pagamento_autorizado',
  SUSPENSA = 'suspensa',
  CANCELADO = 'cancelado',
}

// Invariantes de Negócio
const LIMITE_COMPROMETIMENTO_RENDA = 25; // 25% da renda
const VALOR_MINIMO_EMPRESTIMO = 500;
const VALOR_MAXIMO_EMPRESTIMO = 50000;
const PRAZO_MINIMO_MESES = 3;
const PRAZO_MAXIMO_MESES = 48;
const TAXA_JUROS_MINIMA = 0.5;
const TAXA_JUROS_MAXIMA = 5.0;

/**
 * Aggregate Root: Proposal
 * Encapsula o estado e comportamento de uma proposta de crédito
 */
export class Proposal {
  private _events: ProposalDomainEvent[] = [];

  // Estado do agregado
  private _id: string;
  private _status: ProposalStatus;
  private _clienteData: ClienteData;
  private _valor: Money;
  private _prazo: number;
  private _taxaJuros: number;
  private _produtoId?: number;
  private _tabelaComercialId?: number;
  private _lojaId?: number;
  private _parceiroId?: number;
  private _atendenteId?: string;
  private _dadosPagamento?: DadosPagamento;
  private _motivoRejeicao?: string;
  private _observacoes?: string;
  private _ccbUrl?: string;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(
    id: string,
    clienteData: ClienteData,
    valor: Money,
    prazo: number,
    taxaJuros: number,
    produtoId?: number,
    lojaId?: number,
    atendenteId?: string
  ) {
    this._id = id;
    this._clienteData = clienteData;
    this._valor = valor;
    this._prazo = prazo;
    this._taxaJuros = taxaJuros;
    this._produtoId = produtoId;
    this._lojaId = lojaId;
    this._atendenteId = atendenteId;
    this._status = ProposalStatus.RASCUNHO;
    this._createdAt = new Date();
    this._updatedAt = new Date();

    // Validar invariantes na criação
    this.validateInvariants();
  }

  // Factory method para criar nova proposta
  static create(
    clienteData: ClienteData,
    valor: Money,
    prazo: number,
    taxaJuros: number,
    produtoId?: number,
    lojaId?: number,
    atendenteId?: string
  ): Proposal {
    const id = uuidv4();
    const proposal = new Proposal(
      id,
      clienteData,
      valor,
      prazo,
      taxaJuros,
      produtoId,
      lojaId,
      atendenteId
    );

    proposal.addEvent(
      new ProposalCreatedEvent(id, 'ProposalCreated', {
        clienteData,
        valor,
        prazo,
        taxaJuros,
      })
    );

    return proposal;
  }

  // Factory method para reconstituir do banco
  static fromDatabase(data: any): Proposal {
    // Reconstituir Value Objects dos dados persistidos
    const clienteData: ClienteData = {
      ...data.cliente_data,
      cpf: CPF.create(data.cliente_data.cpf)!,
      email: data.cliente_data.email ? Email.create(data.cliente_data.email) : undefined,
      telefone: data.cliente_data.telefone ? PhoneNumber.create(data.cliente_data.telefone) : undefined,
      cep: data.cliente_data.cep ? CEP.create(data.cliente_data.cep) : undefined,
      renda_mensal: data.cliente_data.renda_mensal ? Money.fromReais(data.cliente_data.renda_mensal) : undefined,
      dividas_existentes: data.cliente_data.dividas_existentes ? Money.fromReais(data.cliente_data.dividas_existentes) : undefined,
    };

    const proposal = new Proposal(
      data.id,
      clienteData,
      Money.fromReais(data.valor),
      data.prazo,
      data.taxa_juros,
      data.produto_id,
      data.loja_id,
      data.atendente_id
    );

    proposal._status = data.status;
    proposal._dadosPagamento = data.dados_pagamento;
    proposal._motivoRejeicao = data.motivo_rejeicao;
    proposal._observacoes = data.observacoes;
    proposal._ccbUrl = data.ccb_url;
    proposal._createdAt = data.created_at;
    proposal._updatedAt = data.updated_at;
    proposal._tabelaComercialId = data.tabela_comercial_id;
    proposal._parceiroId = data.parceiro_id;

    return proposal;
  }

  // ========== INVARIANTES DE NEGÓCIO ==========

  private validateInvariants(): void {
    // Invariante 1: Valor deve estar dentro dos limites
    const valorReais = this._valor.getReais();
    if (valorReais < VALOR_MINIMO_EMPRESTIMO || valorReais > VALOR_MAXIMO_EMPRESTIMO) {
      throw new DomainException(
        `Valor do empréstimo deve estar entre R$ ${VALOR_MINIMO_EMPRESTIMO} e R$ ${VALOR_MAXIMO_EMPRESTIMO}`
      );
    }

    // Invariante 2: Prazo deve estar dentro dos limites
    if (this._prazo < PRAZO_MINIMO_MESES || this._prazo > PRAZO_MAXIMO_MESES) {
      throw new DomainException(`Prazo deve estar entre ${PRAZO_MINIMO_MESES} e ${PRAZO_MAXIMO_MESES} meses`);
    }

    // Invariante 3: Taxa de juros deve estar dentro dos limites
    if (this._taxaJuros < TAXA_JUROS_MINIMA || this._taxaJuros > TAXA_JUROS_MAXIMA) {
      throw new DomainException(
        `Taxa de juros deve estar entre ${TAXA_JUROS_MINIMA}% e ${TAXA_JUROS_MAXIMA}%`
      );
    }

    // Invariante 4: CPF é sempre válido devido ao Value Object
    // O CPF é validado na criação do Value Object
  }


  // ========== COMANDOS (MÉTODOS DE NEGÓCIO) ==========

  /**
   * Submete a proposta para análise
   */
  submitForAnalysis(): void {
    if (this._status !== ProposalStatus.RASCUNHO) {
      throw new DomainException('Apenas propostas em rascunho podem ser submetidas para análise');
    }

    this._status = ProposalStatus.EM_ANALISE;
    this._updatedAt = new Date();

    this.addEvent(
      new ProposalSubmittedEvent(this._id, 'ProposalSubmitted', {
        submittedAt: this._updatedAt,
      })
    );
  }

  /**
   * Aprova a proposta
   */
  approve(analistaId: string, observacoes?: string): void {
    if (this._status !== ProposalStatus.EM_ANALISE && this._status !== ProposalStatus.PENDENCIADO) {
      throw new DomainException('Apenas propostas em análise ou pendenciadas podem ser aprovadas');
    }

    // Verificar comprometimento de renda antes de aprovar
    if (this._clienteData.renda_mensal && this._clienteData.dividas_existentes !== undefined) {
      const valorParcela = this.calculateMonthlyPayment();
      const comprometimentoTotal = this._clienteData.dividas_existentes.add(Money.fromReais(valorParcela));
      const percentualComprometimento =
        (comprometimentoTotal.getReais() / this._clienteData.renda_mensal.getReais()) * 100;

      if (percentualComprometimento > LIMITE_COMPROMETIMENTO_RENDA) {
        throw new DomainException(
          `Comprometimento de renda (${percentualComprometimento.toFixed(1)}%) excede o limite de ${LIMITE_COMPROMETIMENTO_RENDA}%`
        );
      }
    }

    this._status = ProposalStatus.APROVADO;
    this._observacoes = observacoes;
    this._updatedAt = new Date();

    this.addEvent(
      new ProposalApprovedEvent(this._id, 'ProposalApproved', {
        analistaId,
        observacoes,
      })
    );
  }

  /**
   * Rejeita a proposta
   */
  reject(analistaId: string, motivo: string): void {
    if (this._status !== ProposalStatus.EM_ANALISE && this._status !== ProposalStatus.PENDENCIADO) {
      throw new DomainException('Apenas propostas em análise ou pendenciadas podem ser rejeitadas');
    }

    if (!motivo || motivo.trim().length === 0) {
      throw new DomainException('Motivo da rejeição é obrigatório');
    }

    this._status = ProposalStatus.REJEITADO;
    this._motivoRejeicao = motivo;
    this._updatedAt = new Date();

    this.addEvent(
      new ProposalRejectedEvent(this._id, 'ProposalRejected', {
        analistaId,
        motivo,
      })
    );
  }

  /**
   * Pendencia a proposta
   */
  pend(analistaId: string, reason: string): void {
    if (this._status !== ProposalStatus.EM_ANALISE) {
      throw new DomainException('Apenas propostas em análise podem ser pendenciadas');
    }

    if (!reason || reason.trim().length === 0) {
      throw new DomainException('Motivo da pendência é obrigatório');
    }

    this._status = ProposalStatus.PENDENCIADO;
    this._observacoes = reason;
    this._updatedAt = new Date();

    this.addEvent(
      new ProposalPendingEvent(this._id, 'ProposalPending', {
        analistaId,
        reason,
      })
    );
  }

  /**
   * Atualiza dados após pendência
   */
  updateAfterPending(newData: Partial<{
    clienteData: ClienteData;
    valor: Money;
    prazo: number;
    taxaJuros: number;
    dadosPagamento: DadosPagamento;
    observacoes: string;
  }>): void {
    if (this._status !== ProposalStatus.PENDENCIADO) {
      throw new DomainException('Apenas propostas pendenciadas podem ter dados atualizados');
    }

    const previousData = {
      clienteData: this._clienteData,
      valor: this._valor,
      prazo: this._prazo,
      taxaJuros: this._taxaJuros,
      dadosPagamento: this._dadosPagamento,
      observacoes: this._observacoes
    };

    // Atualizar dados fornecidos
    if (newData.clienteData) {
      this._clienteData = { ...this._clienteData, ...newData.clienteData };
    }
    if (newData.valor !== undefined) {
      this._valor = newData.valor;
    }
    if (newData.prazo !== undefined) {
      this._prazo = newData.prazo;
    }
    if (newData.taxaJuros !== undefined) {
      this._taxaJuros = newData.taxaJuros;
    }
    if (newData.dadosPagamento) {
      this._dadosPagamento = newData.dadosPagamento;
    }
    if (newData.observacoes) {
      this._observacoes = newData.observacoes;
    }

    this._updatedAt = new Date();

    // Revalidar invariantes após atualização
    this.validateInvariants();

    // Retornar automaticamente para análise após atualização
    this._status = ProposalStatus.EM_ANALISE;

    this.addEvent(
      new ProposalUpdatedAfterPendingEvent(this._id, 'ProposalUpdatedAfterPending', {
        previousData,
        newData,
        updatedAt: this._updatedAt
      })
    );
  }

  /**
   * Gera a CCB (Cédula de Crédito Bancário)
   */
  generateCCB(ccbUrl: string): void {
    if (this._status !== ProposalStatus.APROVADO) {
      throw new DomainException('CCB só pode ser gerada para propostas aprovadas');
    }

    this._ccbUrl = ccbUrl;
    this._status = ProposalStatus.CCB_GERADA;
    this._updatedAt = new Date();

    this.addEvent(
      new ProposalCcbGeneratedEvent(this._id, 'ProposalCcbGenerated', {
        ccbUrl,
        generatedAt: this._updatedAt
      })
    );
  }

  /**
   * Marca como aguardando assinatura
   */
  markAwaitingSignature(): void {
    if (this._status !== ProposalStatus.CCB_GERADA) {
      throw new DomainException('Proposta deve ter CCB gerada antes de aguardar assinatura');
    }

    this._status = ProposalStatus.AGUARDANDO_ASSINATURA;
    this._updatedAt = new Date();
  }

  /**
   * Confirma assinatura do contrato
   */
  confirmSignature(): void {
    if (this._status !== ProposalStatus.AGUARDANDO_ASSINATURA) {
      throw new DomainException('Proposta deve estar aguardando assinatura');
    }

    this._status = ProposalStatus.ASSINATURA_CONCLUIDA;
    this._updatedAt = new Date();

    this.addEvent(
      new ProposalSignatureCompletedEvent(this._id, 'ProposalSignatureCompleted', {
        completedAt: this._updatedAt
      })
    );
  }

  /**
   * Atualiza dados de pagamento
   */
  updatePaymentData(dadosPagamento: DadosPagamento): void {
    if (this._status === ProposalStatus.REJEITADO || this._status === ProposalStatus.CANCELADO) {
      throw new DomainException(
        'Não é possível atualizar dados de pagamento em propostas rejeitadas ou canceladas'
      );
    }

    this._dadosPagamento = dadosPagamento;
    this._updatedAt = new Date();
  }

  /**
   * Cancela a proposta
   */
  cancel(motivo: string): void {
    if (
      this._status === ProposalStatus.REJEITADO ||
      this._status === ProposalStatus.CANCELADO ||
      this._status === ProposalStatus.PAGAMENTO_AUTORIZADO
    ) {
      throw new DomainException('Proposta não pode ser cancelada neste status');
    }

    this._status = ProposalStatus.CANCELADO;
    this._motivoRejeicao = motivo;
    this._updatedAt = new Date();
  }

  /**
   * Suspende a proposta
   */
  suspend(motivo: string): void {
    if (this._status === ProposalStatus.REJEITADO || this._status === ProposalStatus.CANCELADO) {
      throw new DomainException('Proposta não pode ser suspensa neste status');
    }

    this._status = ProposalStatus.SUSPENSA;
    this._observacoes = motivo;
    this._updatedAt = new Date();
  }

  /**
   * Reativa uma proposta suspensa
   */
  reactivate(): void {
    if (this._status !== ProposalStatus.SUSPENSA) {
      throw new DomainException('Apenas propostas suspensas podem ser reativadas');
    }

    // Volta ao status anterior (simplificado - idealmente manteria histórico)
    this._status = ProposalStatus.EM_ANALISE;
    this._updatedAt = new Date();
  }

  // ========== CÁLCULOS DE NEGÓCIO ==========

  /**
   * Calcula o valor da parcela mensal
   */
  calculateMonthlyPayment(): number {
    const principal = this._valor.getReais();
    const monthlyRate = this._taxaJuros / 100;
    const numberOfPayments = this._prazo;

    if (monthlyRate === 0) {
      return principal / numberOfPayments;
    }

    const payment =
      (principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments))) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

    return Math.round(payment * 100) / 100;
  }

  /**
   * Calcula o valor total a ser pago
   */
  calculateTotalAmount(): number {
    return this.calculateMonthlyPayment() * this._prazo;
  }

  /**
   * Calcula o CET (Custo Efetivo Total)
   */
  calculateCET(tac?: number): number {
    // Implementação simplificada do CET
    // Em produção, usar cálculo completo segundo regulação BACEN
    const valorTotal = this.calculateTotalAmount();
    const custoTotal = valorTotal + (tac || 0);
    const cet = (custoTotal / this._valor - 1) * 100;

    return Math.round(cet * 100) / 100;
  }

  // ========== GETTERS ==========

  get id(): string {
    return this._id;
  }
  get status(): ProposalStatus {
    return this._status;
  }
  get clienteData(): ClienteData {
    return this._clienteData;
  }
  get valor(): Money {
    return this._valor;
  }
  get prazo(): number {
    return this._prazo;
  }
  get taxaJuros(): number {
    return this._taxaJuros;
  }
  get produtoId(): number | undefined {
    return this._produtoId;
  }
  get tabelaComercialId(): number | undefined {
    return this._tabelaComercialId;
  }
  get lojaId(): number | undefined {
    return this._lojaId;
  }
  get parceiroId(): number | undefined {
    return this._parceiroId;
  }
  get atendenteId(): string | undefined {
    return this._atendenteId;
  }
  get dadosPagamento(): DadosPagamento | undefined {
    return this._dadosPagamento;
  }
  get motivoRejeicao(): string | undefined {
    return this._motivoRejeicao;
  }
  get observacoes(): string | undefined {
    return this._observacoes;
  }
  get ccbUrl(): string | undefined {
    return this._ccbUrl;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ========== DOMAIN EVENTS ==========

  private addEvent(event: ProposalDomainEvent): void {
    this._events.push(event);
  }

  getUncommittedEvents(): ProposalDomainEvent[] {
    return this._events;
  }

  markEventsAsCommitted(): void {
    this._events = [];
  }

  // ========== SERIALIZAÇÃO ==========

  /**
   * Converte o agregado para formato de persistência
   */
  toPersistence(): any {
    // Serializar Value Objects para formato primitivo para persistência
    const clienteDataPersistence = {
      ...this._clienteData,
      cpf: this._clienteData.cpf.getValue(),
      email: this._clienteData.email?.getValue(),
      telefone: this._clienteData.telefone?.getValue(),
      cep: this._clienteData.cep?.getValue(),
      renda_mensal: this._clienteData.renda_mensal?.getReais(),
      dividas_existentes: this._clienteData.dividas_existentes?.getReais(),
    };

    return {
      id: this._id,
      status: this._status,
      cliente_data: clienteDataPersistence,
      valor: this._valor.getReais(),
      prazo: this._prazo,
      taxa_juros: this._taxaJuros,
      produto_id: this._produtoId,
      tabela_comercial_id: this._tabelaComercialId,
      loja_id: this._lojaId,
      parceiro_id: this._parceiroId,
      atendente_id: this._atendenteId,
      dados_pagamento: this._dadosPagamento,
      motivo_rejeicao: this._motivoRejeicao,
      observacoes: this._observacoes,
      ccb_url: this._ccbUrl,
      user_id: this._atendenteId, // Campo adicionado para mapeamento correto no repositório
      created_at: this._createdAt,
      updated_at: this._updatedAt,
    };
  }
}
