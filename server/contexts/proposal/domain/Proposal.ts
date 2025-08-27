/**
 * Aggregate Root: Proposal
 *
 * Este agregado encapsula toda a lógica de negócio relacionada a propostas de crédito.
 * Segue os princípios de Domain-Driven Design (DDD).
 */

import { v4 as uuidv4 } from 'uuid';

// Value Objects
export interface ClienteData {
  nome: string;
  cpf: string;
  rg?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  data_nascimento?: string;
  renda_mensal?: number;
  empregador?: string;
  tempo_emprego?: string;
  dividas_existentes?: number;
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
  payload: unknown;
  occurredAt: Date;
}

export class ProposalCreatedEvent implements ProposalDomainEvent {
  constructor(
    public aggregateId: string,
    public eventType: string = 'ProposalCreated',
    public payload: unknown,
    public occurredAt: Date = new Date()
  ) {}
}

export class ProposalApprovedEvent implements ProposalDomainEvent {
  constructor(
    public aggregateId: string,
    public eventType: string = 'ProposalApproved',
    public payload: unknown,
    public occurredAt: Date = new Date()
  ) {}
}

export class ProposalRejectedEvent implements ProposalDomainEvent {
  constructor(
    public aggregateId: string,
    public eventType: string = 'ProposalRejected',
    public payload: unknown,
    public occurredAt: Date = new Date()
  ) {}
}

// Status Enum (domínio)
export enum ProposalStatus {
  RASCUNHO = 'rascunho',
  EM_ANALISE = 'em_analise',
  APROVADO = 'aprovado',
  REJEITADO = 'rejeitado',
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
  private _valor: number;
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
    valor: number,
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
    valor: number,
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
  static fromDatabase(data): Proposal {
    const proposal = new Proposal(
      data.id,
      data.clientedata,
      data.valor,
      data.prazo,
      data.taxajuros,
      data.produtoid,
      data.lojaid,
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

  // ======= INVARIANTES DE NEGÓCIO =======

  private validateInvariants(): void {
    // Invariante 1: Valor deve estar dentro dos limites
    if (this._valor < VALOR_MINIMO_EMPRESTIMO || this._valor > VALOR_MAXIMO_EMPRESTIMO) {
      throw new Error(
        `Valor do empréstimo deve estar entre R$ ${VALOR_MINIMO_EMPRESTIMO} e R$ ${VALOR_MAXIMO_EMPRESTIMO}`
      );
    }

    // Invariante 2: Prazo deve estar dentro dos limites
    if (this._prazo < PRAZO_MINIMO_MESES || this._prazo > PRAZO_MAXIMO_MESES) {
      throw new Error(`Prazo deve estar entre ${PRAZO_MINIMO_MESES} e ${PRAZO_MAXIMO_MESES} meses`);
    }

    // Invariante 3: Taxa de juros deve estar dentro dos limites
    if (this._taxaJuros < TAXA_JUROS_MINIMA || this._taxaJuros > TAXA_JUROS_MAXIMA) {
      throw new Error(
        `Taxa de juros deve estar entre ${TAXA_JUROS_MINIMA}% e ${TAXA_JUROS_MAXIMA}%`
      );
    }

    // Invariante 4: CPF deve ser válido
    if (!this.isValidCPF(this._clienteData.cpf)) {
      throw new Error('CPF inválido');
    }
  }

  private isValidCPF(cpf: string): boolean {
    // Remove caracteres não numéricos
    const cleanCPF = cpf.replace(/\D/g, '');

    // Verifica se tem 11 dígitos
    if (cleanCPF.length !== 11) return false;

    // Em desenvolvimento, permite CPFs de teste (sequências repetidas)
    if (process.env.NODE_ENV == 'development' && /^(\d)\1{10}$/.test(cleanCPF)) {
      return true; // Permite CPFs como 11111111111 em desenvolvimento
    }

    // Verifica se todos os dígitos são iguais (apenas em produção)
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

    // Validação dos dígitos verificadores
    let _sum = 0;
    for (let _i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let _digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleanCPF.charAt(9))) return false;

    sum = 0;
    for (let _i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
  }

  // ======= COMANDOS (MÉTODOS DE NEGÓCIO) =======

  /**
   * Submete a proposta para análise
   */
  submitForAnalysis(): void {
    if (this._status !== ProposalStatus.RASCUNHO) {
      throw new Error('Apenas propostas em rascunho podem ser submetidas para análise');
    }

    this._status = ProposalStatus.EM_ANALISE;
    this._updatedAt = new Date();
  }

  /**
   * Aprova a proposta
   */
  approve(analistaId: string, observacoes?: string): void {
    if (this._status !== ProposalStatus.EM_ANALISE) {
      throw new Error('Apenas propostas em análise podem ser aprovadas');
    }

    // Verificar comprometimento de renda antes de aprovar
    if (this._clienteData.renda_mensal && this._clienteData.dividas_existentes !== undefined) {
      const valorParcela = this.calculateMonthlyPayment();
      const comprometimentoTotal = (this._clienteData.dividas_existentes || 0) + valorParcela;
      const percentualComprometimento =
        (comprometimentoTotal / this._clienteData.renda_mensal) * 100;

      if (percentualComprometimento > LIMITE_COMPROMETIMENTO_RENDA) {
        throw new Error(
          `Comprometimento de renda (${percentualComprometimento.toFixed(1)}%) excede o limite de ${LIMITE_COMPROMETIMENTO_RENDA}%`
        );
      }
    }

    this._status = ProposalStatus.APROVADO;
    this._observacoes = observacoes;
    this._updatedAt = new Date();

    this.addEvent(
      new ProposalApprovedEvent(this.id, 'ProposalApproved', {
        analistaId,
        observacoes,
      })
    );
  }

  /**
   * Rejeita a proposta
   */
  reject(analistaId: string, motivo: string): void {
    if (this._status !== ProposalStatus.EM_ANALISE) {
      throw new Error('Apenas propostas em análise podem ser rejeitadas');
    }

    if (!motivo || motivo.trim().length == 0) {
      throw new Error('Motivo da rejeição é obrigatório');
    }

    this._status = ProposalStatus.REJEITADO;
    this._motivoRejeicao = motivo;
    this._updatedAt = new Date();

    this.addEvent(
      new ProposalRejectedEvent(this.id, 'ProposalRejected', {
        analistaId,
        motivo,
      })
    );
  }

  /**
   * Gera a CCB (Cédula de Crédito Bancário)
   */
  generateCCB(ccbUrl: string): void {
    if (this._status !== ProposalStatus.APROVADO) {
      throw new Error('CCB só pode ser gerada para propostas aprovadas');
    }

    this._ccbUrl = ccbUrl;
    this._status = ProposalStatus.CCB_GERADA;
    this._updatedAt = new Date();
  }

  /**
   * Marca como aguardando assinatura
   */
  markAwaitingSignature(): void {
    if (this._status !== ProposalStatus.CCB_GERADA) {
      throw new Error('Proposta deve ter CCB gerada antes de aguardar assinatura');
    }

    this._status = ProposalStatus.AGUARDANDO_ASSINATURA;
    this._updatedAt = new Date();
  }

  /**
   * Confirma assinatura do contrato
   */
  confirmSignature(): void {
    if (this._status !== ProposalStatus.AGUARDANDO_ASSINATURA) {
      throw new Error('Proposta deve estar aguardando assinatura');
    }

    this._status = ProposalStatus.ASSINATURA_CONCLUIDA;
    this._updatedAt = new Date();
  }

  /**
   * Atualiza dados de pagamento
   */
  updatePaymentData(dadosPagamento: DadosPagamento): void {
    if (this._status == ProposalStatus.REJEITADO || this._status == ProposalStatus.CANCELADO) {
      throw new Error(
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
      this._status == ProposalStatus.REJEITADO ||
      this._status == ProposalStatus.CANCELADO ||
      this._status == ProposalStatus.PAGAMENTO_AUTORIZADO
    ) {
      throw new Error('Proposta não pode ser cancelada neste status');
    }

    this._status = ProposalStatus.CANCELADO;
    this._motivoRejeicao = motivo;
    this._updatedAt = new Date();
  }

  /**
   * Suspende a proposta
   */
  suspend(motivo: string): void {
    if (this._status == ProposalStatus.REJEITADO || this._status == ProposalStatus.CANCELADO) {
      throw new Error('Proposta não pode ser suspensa neste status');
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
      throw new Error('Apenas propostas suspensas podem ser reativadas');
    }

    // Volta ao status anterior (simplificado - idealmente manteria histórico)
    this._status = ProposalStatus.EM_ANALISE;
    this._updatedAt = new Date();
  }

  // ======= CÁLCULOS DE NEGÓCIO =======

  /**
   * Calcula o valor da parcela mensal
   */
  calculateMonthlyPayment(): number {
    const principal = this._valor;
    const monthlyRate = this._taxaJuros / 100;
    const numberOfPayments = this._prazo;

    if (monthlyRate == 0) {
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

  // ======= GETTERS =======

  get id(): string {
    return this._id;
  }
  get status(): ProposalStatus {
    return this._status;
  }
  get clienteData(): ClienteData {
    return this._clienteData;
  }
  get valor(): number {
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

  // ======= DOMAIN EVENTS =======

  private addEvent(event: ProposalDomainEvent): void {
    this._events.push(event);
  }

  getUncommittedEvents(): ProposalDomainEvent[] {
    return this._events;
  }

  markEventsAsCommitted(): void {
    this._events = [];
  }

  // ======= SERIALIZAÇÃO =======

  /**
   * Converte o agregado para formato de persistência
   */
  toPersistence(): unknown {
    return {
      id: this.id,
      status: this.status,
      cliente_data: this.clienteData,
      valor: this.valor,
      prazo: this.prazo,
      taxa_juros: this.taxaJuros,
      produto_id: this.produtoId,
      tabela_comercial_id: this.tabelaComercialId,
      loja_id: this.lojaId,
      parceiro_id: this.parceiroId,
      atendente_id: this.atendenteId,
      dados_pagamento: this.dadosPagamento,
      motivo_rejeicao: this.motivoRejeicao,
      observacoes: this.observacoes,
      ccb_url: this.ccbUrl,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }
}
