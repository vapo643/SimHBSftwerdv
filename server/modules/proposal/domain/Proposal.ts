/**
 * Aggregate Root: Proposal
 *
 * Este agregado encapsula toda a lógica de negócio relacionada a propostas de crédito.
 * Segue os princípios de Domain-Driven Design (DDD).
 */

import { v4 as uuidv4 } from 'uuid';
import { DomainException } from '../../shared/domain/DomainException';
import { CPF, Money, Email, PhoneNumber, CEP } from '@shared/value-objects';

// DTO para criação da Proposta - Todos os 14 campos críticos obrigatórios
export interface ProposalCreationProps {
  // Relacionamentos críticos
  produtoId: number;
  tabelaComercialId: number;
  lojaId: number;
  analistaId: string;

  // Dados do cliente (obrigatórios)
  clienteNome: string;
  clienteCpf: string;

  // Valores financeiros calculados
  valor: number;
  prazo: number;
  valorTac: number;
  valorIof: number;
  valorTotalFinanciado: number;
  taxaJuros: number;
  taxaJurosAnual: number;

  // Dados de pagamento e documentos
  dadosPagamentoBanco: string;
  ccbDocumentoUrl: string;
  clienteComprometimentoRenda: number;

  // Dados adicionais do cliente (opcionais)
  clienteData?: ClienteData;
  dadosPagamento?: DadosPagamento;
  atendenteId?: string;
  observacoes?: string;

  // CORREÇÃO MANDATÓRIA PAM V1.0: Adicionar finalidade e garantia
  finalidade?: string;
  garantia?: string;
}

// Value Objects - LACRE DE OURO: Interface expandida para todos os campos
export interface ClienteData {
  // Dados básicos
  nome: string;
  cpf: CPF;
  tipoPessoa?: string;
  razaoSocial?: string;
  cnpj?: string;

  // Documentação RG completa
  rg?: string;
  orgaoEmissor?: string;
  rgUf?: string;
  rgDataEmissao?: string;

  // Dados pessoais
  email?: Email;
  telefone?: PhoneNumber;
  dataNascimento?: string;
  localNascimento?: string;
  estadoCivil?: string;
  nacionalidade?: string;

  // Endereço detalhado
  cep?: CEP;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  endereco?: string; // Campo concatenado para compatibilidade

  // Dados profissionais
  ocupacao?: string;
  rendaMensal?: Money;
  telefoneEmpresa?: string;

  // Compatibilidade com campos antigos
  data_nascimento?: string; // Alias para dataNascimento
  estado?: string; // Alias para uf
  renda_mensal?: Money; // Alias para rendaMensal
  empregador?: string; // Campo empresaNome
  tempo_emprego?: string;
  dividas_existentes?: Money;
}

export interface DadosPagamento {
  metodo: 'boleto' | 'pix' | 'transferencia' | 'conta_bancaria';

  // Dados bancários
  banco?: string;
  agencia?: string;
  conta?: string;
  digito?: string;
  tipo_conta?: string;

  // Dados PIX
  pixChave?: string;
  pixTipo?: string;
  pixBanco?: string;
  pixNomeTitular?: string;
  pixCpfTitular?: string;

  // Compatibilidade com campos antigos
  pix_chave?: string; // Alias para pixChave
  pix_tipo?: string; // Alias para pixTipo
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

  // Campos críticos obrigatórios (blindados)
  private _produtoId: number;
  private _tabelaComercialId: number;
  private _lojaId: number;
  private _analistaId: string;
  private _valorTac: number;
  private _valorIof: number;
  private _valorTotalFinanciado: number;
  private _taxaJurosAnual: number;
  private _ccbUrl: string;
  private _dadosPagamentoBanco: string;
  private _clienteComprometimentoRenda: number;

  // Campos opcionais mantidos
  private _parceiroId?: number;
  private _atendenteId?: string;
  private _dadosPagamento?: DadosPagamento;
  private _motivoRejeicao?: string;
  private _observacoes?: string;
  private _finalidade?: string;
  private _garantia?: string;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: string,
    clienteData: ClienteData,
    valor: Money,
    prazo: number,
    taxaJuros: number,
    produtoId: number,
    tabelaComercialId: number,
    lojaId: number,
    analistaId: string,
    valorTac: number,
    valorIof: number,
    valorTotalFinanciado: number,
    taxaJurosAnual: number,
    ccbDocumentoUrl: string,
    dadosPagamentoBanco: string,
    clienteComprometimentoRenda: number,
    atendenteId?: string
  ) {
    this._id = id;
    this._clienteData = clienteData;
    this._valor = valor;
    this._prazo = prazo;
    this._taxaJuros = taxaJuros;
    this._produtoId = produtoId;
    this._tabelaComercialId = tabelaComercialId;
    this._lojaId = lojaId;
    this._atendenteId = atendenteId;
    this._status = ProposalStatus.RASCUNHO;
    this._createdAt = new Date();
    this._updatedAt = new Date();

    // Novos campos obrigatórios armazenados como propriedades privadas
    this._analistaId = analistaId;
    this._valorTac = valorTac;
    this._valorIof = valorIof;
    this._valorTotalFinanciado = valorTotalFinanciado;
    this._taxaJurosAnual = taxaJurosAnual;
    this._ccbUrl = ccbDocumentoUrl;
    this._dadosPagamentoBanco = dadosPagamentoBanco;
    this._clienteComprometimentoRenda = clienteComprometimentoRenda;

    // Validar invariantes na criação
    this.validateInvariants();
  }

  // Factory method para criar nova proposta - REFATORADO CONFORME PAM V1.0
  static create(props: ProposalCreationProps): Proposal {
    // VALIDAÇÃO CENTRALIZADA - Todos os 14 campos críticos obrigatórios
    this.validateCreationProps(props);

    const id = uuidv4();

    // Criando ClienteData básico baseado nos campos obrigatórios
    const clienteData: ClienteData = {
      nome: props.clienteNome,
      cpf: CPF.create(props.clienteCpf)!,
      ...(props.clienteData || {}),
    };

    const proposal = new Proposal(
      id,
      clienteData,
      Money.fromReais(props.valor),
      props.prazo,
      props.taxaJuros,
      props.produtoId,
      props.tabelaComercialId,
      props.lojaId,
      props.analistaId,
      props.valorTac,
      props.valorIof,
      props.valorTotalFinanciado,
      props.taxaJurosAnual,
      props.ccbDocumentoUrl,
      props.dadosPagamentoBanco,
      props.clienteComprometimentoRenda,
      props.atendenteId
    );

    // CORREÇÃO MANDATÓRIA PAM V1.0: Definir finalidade e garantia
    if (props.finalidade) {
      proposal._finalidade = props.finalidade;
    }
    if (props.garantia) {
      proposal._garantia = props.garantia;
    }

    proposal.addEvent(
      new ProposalCreatedEvent(id, 'ProposalCreated', {
        clienteData,
        valor: props.valor,
        prazo: props.prazo,
        taxaJuros: props.taxaJuros,
        produtoId: props.produtoId,
        tabelaComercialId: props.tabelaComercialId,
      })
    );

    return proposal;
  }

  // VALIDAÇÃO CENTRALIZADA - Implementação das regras de negócio críticas
  private static validateCreationProps(props: ProposalCreationProps): void {
    const errors: string[] = [];

    // Validação de campos obrigatórios (14 campos críticos)
    const requiredFields = [
      { field: 'produtoId', value: props.produtoId },
      { field: 'tabelaComercialId', value: props.tabelaComercialId },
      { field: 'lojaId', value: props.lojaId },
      { field: 'analistaId', value: props.analistaId },
      { field: 'clienteNome', value: props.clienteNome },
      { field: 'clienteCpf', value: props.clienteCpf },
      { field: 'valor', value: props.valor },
      { field: 'prazo', value: props.prazo },
      { field: 'valorTac', value: props.valorTac },
      { field: 'valorIof', value: props.valorIof },
      { field: 'valorTotalFinanciado', value: props.valorTotalFinanciado },
      { field: 'taxaJuros', value: props.taxaJuros },
      { field: 'taxaJurosAnual', value: props.taxaJurosAnual },
      { field: 'ccbDocumentoUrl', value: props.ccbDocumentoUrl },
      { field: 'dadosPagamentoBanco', value: props.dadosPagamentoBanco },
      { field: 'clienteComprometimentoRenda', value: props.clienteComprometimentoRenda },
    ];

    requiredFields.forEach(({ field, value }) => {
      if (value === undefined || value === null || value === '') {
        errors.push(`Campo crítico '${field}' é obrigatório`);
      }
    });

    // Validação de regras de negócio
    if (
      props.valor &&
      (props.valor < VALOR_MINIMO_EMPRESTIMO || props.valor > VALOR_MAXIMO_EMPRESTIMO)
    ) {
      errors.push(
        `Valor deve estar entre R$ ${VALOR_MINIMO_EMPRESTIMO} e R$ ${VALOR_MAXIMO_EMPRESTIMO}`
      );
    }

    if (props.prazo && (props.prazo < PRAZO_MINIMO_MESES || props.prazo > PRAZO_MAXIMO_MESES)) {
      errors.push(`Prazo deve estar entre ${PRAZO_MINIMO_MESES} e ${PRAZO_MAXIMO_MESES} meses`);
    }

    if (
      props.taxaJuros &&
      (props.taxaJuros < TAXA_JUROS_MINIMA || props.taxaJuros > TAXA_JUROS_MAXIMA)
    ) {
      errors.push(`Taxa de juros deve estar entre ${TAXA_JUROS_MINIMA}% e ${TAXA_JUROS_MAXIMA}%`);
    }

    if (props.clienteComprometimentoRenda && props.clienteComprometimentoRenda > 40) {
      errors.push('Comprometimento de renda não pode exceder 40%');
    }

    if (errors.length > 0) {
      throw new DomainException(`Falha na validação da proposta: ${errors.join('; ')}`);
    }
  }

  // Factory method para reconstituir do banco
  static fromDatabase(data: any): Proposal {
    // Reconstituir Value Objects dos dados persistidos
    const clienteData: ClienteData = {
      ...data.cliente_data,
      cpf: CPF.create(data.cliente_data.cpf)!,
      email: data.cliente_data.email ? Email.create(data.cliente_data.email) : undefined,
      telefone: data.cliente_data.telefone
        ? PhoneNumber.create(data.cliente_data.telefone)
        : undefined,
      cep: data.cliente_data.cep ? CEP.create(data.cliente_data.cep) : undefined,
      renda_mensal: data.cliente_data.renda_mensal
        ? Money.fromReais(data.cliente_data.renda_mensal)
        : undefined,
      dividas_existentes: data.cliente_data.dividas_existentes
        ? Money.fromReais(data.cliente_data.dividas_existentes)
        : undefined,
    };

    const proposal = new Proposal(
      data.id,
      clienteData,
      Money.fromReais(data.valor),
      data.prazo,
      data.taxa_juros,
      data.produto_id || 0, // Valores padrão para compatibilidade
      data.tabela_comercial_id || 0,
      data.loja_id || 0,
      data.analista_id || 'e647afc0-03fa-482d-8293-d824dcab0399', // UUID padrão do sistema
      data.valor_tac || 0,
      data.valor_iof || 0,
      data.valor_total_financiado || data.valor,
      data.taxa_juros_anual || 0,
      data.ccb_documento_url || '',
      data.dados_pagamento_banco || '001',
      data.cliente_comprometimento_renda || 30,
      data.atendente_id
    );

    proposal._status = data.status;
    proposal._dadosPagamento = data.dados_pagamento;
    proposal._motivoRejeicao = data.motivo_rejeicao;
    proposal._observacoes = data.observacoes;
    proposal._finalidade = data.finalidade;
    proposal._garantia = data.garantia;
    proposal._createdAt = data.created_at;
    proposal._updatedAt = data.updated_at;
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
      throw new DomainException(
        `Prazo deve estar entre ${PRAZO_MINIMO_MESES} e ${PRAZO_MAXIMO_MESES} meses`
      );
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
   * Reenvia proposta pendente para análise (após correções)
   */
  resubmitFromPending(): void {
    if (this._status !== ProposalStatus.PENDENCIADO) {
      throw new DomainException(
        'Apenas propostas com status PENDENCIADO podem ser reenviadas para análise'
      );
    }

    this._status = ProposalStatus.EM_ANALISE;
    this._updatedAt = new Date();

    this.addEvent(
      new ProposalSubmittedEvent(this._id, 'ProposalResubmitted', {
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
      const comprometimentoTotal = this._clienteData.dividas_existentes.add(
        Money.fromReais(valorParcela)
      );
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
  updateAfterPending(
    newData: Partial<{
      clienteData: ClienteData;
      valor: Money;
      prazo: number;
      taxaJuros: number;
      dadosPagamento: DadosPagamento;
      observacoes: string;
    }>
  ): void {
    if (this._status !== ProposalStatus.PENDENCIADO) {
      throw new DomainException(
        'Apenas propostas com status PENDENCIADO podem ter dados atualizados'
      );
    }

    const previousData = {
      clienteData: this._clienteData,
      valor: this._valor,
      prazo: this._prazo,
      taxaJuros: this._taxaJuros,
      dadosPagamento: this._dadosPagamento,
      observacoes: this._observacoes,
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
        updatedAt: this._updatedAt,
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
        generatedAt: this._updatedAt,
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
        completedAt: this._updatedAt,
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
    return Proposal.calculateMonthlyPaymentStatic(
      this._valor.getReais(),
      this._taxaJuros,
      this._prazo
    );
  }

  /**
   * MÉTODO ESTÁTICO: Cálculo de parcela mensal para uso em contextos de performance
   * PAM P2.1.1 - Centraliza lógica no domínio mas permite uso sem instanciação
   */
  static calculateMonthlyPaymentStatic(
    principal: number,
    monthlyRate: number,
    numberOfPayments: number
  ): number {
    const rate = monthlyRate / 100;

    if (rate === 0) {
      return principal / numberOfPayments;
    }

    const payment =
      (principal * (rate * Math.pow(1 + rate, numberOfPayments))) /
      (Math.pow(1 + rate, numberOfPayments) - 1);

    return Math.round(payment * 100) / 100;
  }

  /**
   * MÉTODO ESTÁTICO: Taxa de juros padrão do sistema
   * PAM P2.1.1 - Regra de negócio centralizada no domínio
   */
  static getDefaultInterestRate(): number {
    return 2.5; // Taxa padrão de 2.5% ao mês
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
    const cet = (custoTotal / this._valor.getReais() - 1) * 100;

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
  get produtoId(): number {
    return this._produtoId;
  }
  get tabelaComercialId(): number {
    return this._tabelaComercialId;
  }
  get lojaId(): number {
    return this._lojaId;
  }
  get analistaId(): string {
    return this._analistaId;
  }
  get valorTac(): number {
    return this._valorTac;
  }
  get valorIof(): number {
    return this._valorIof;
  }
  get valorTotalFinanciado(): number {
    return this._valorTotalFinanciado;
  }
  get taxaJurosAnual(): number {
    return this._taxaJurosAnual;
  }
  get dadosPagamentoBanco(): string {
    return this._dadosPagamentoBanco;
  }
  get clienteComprometimentoRenda(): number {
    return this._clienteComprometimentoRenda;
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

  get finalidade(): string | undefined {
    return this._finalidade;
  }

  get garantia(): string | undefined {
    return this._garantia;
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
    // Adicionar verificação defensiva para tipos mistos
    const clienteDataPersistence = {
      ...this._clienteData,
      cpf: this._clienteData.cpf?.getValue
        ? this._clienteData.cpf.getValue()
        : this._clienteData.cpf,
      email: this._clienteData.email?.getValue
        ? this._clienteData.email.getValue()
        : this._clienteData.email,
      telefone: this._clienteData.telefone?.getValue
        ? this._clienteData.telefone.getValue()
        : this._clienteData.telefone,
      cep: this._clienteData.cep?.getValue
        ? this._clienteData.cep.getValue()
        : this._clienteData.cep,
      renda_mensal: this._clienteData.renda_mensal?.getReais
        ? this._clienteData.renda_mensal.getReais()
        : this._clienteData.renda_mensal,
      dividas_existentes: this._clienteData.dividas_existentes?.getReais
        ? this._clienteData.dividas_existentes.getReais()
        : this._clienteData.dividas_existentes,
    };

    return {
      id: this._id,
      status: this._status,
      cliente_data: clienteDataPersistence,
      valor: this._valor.getReais(),
      prazo: this._prazo,
      taxa_juros: this._taxaJuros,

      // Campos críticos obrigatórios
      produto_id: this._produtoId,
      tabela_comercial_id: this._tabelaComercialId,
      loja_id: this._lojaId,
      analista_id: this._analistaId,
      valor_tac: this._valorTac,
      valor_iof: this._valorIof,
      valor_total_financiado: this._valorTotalFinanciado,
      taxa_juros_anual: this._taxaJurosAnual,
      ccb_documento_url: this._ccbUrl,
      dados_pagamento_banco: this._dadosPagamentoBanco,
      cliente_comprometimento_renda: this._clienteComprometimentoRenda,

      // Campos opcionais mantidos
      parceiro_id: this._parceiroId,
      atendente_id: this._atendenteId,
      dados_pagamento: this._dadosPagamento,
      motivo_rejeicao: this._motivoRejeicao,
      observacoes: this._observacoes,
      finalidade: this._finalidade,
      garantia: this._garantia,
      user_id: this._analistaId || 'e647afc0-03fa-482d-8293-d824dcab0399', // Usar analistaId como userId para mapeamento correto
      created_at: this._createdAt,
      updated_at: this._updatedAt,
    };
  }
}
