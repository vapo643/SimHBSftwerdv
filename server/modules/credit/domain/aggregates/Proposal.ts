/**
 * Proposal Aggregate - Domain Entity
 * Core business logic for credit proposals
 */

import { CPF, Money, Email, PhoneNumber } from '@shared/value-objects';

export enum ProposalStatus {
  DRAFT = 'rascunho',
  WAITING_ANALYSIS = 'aguardando_analise',
  IN_ANALYSIS = 'em_analise',
  APPROVED = 'aprovado',
  REJECTED = 'rejeitado',
  PENDING = 'pendenciado',
  PAID = 'pago',
  FORMALIZED = 'formalizado',
}

export interface CustomerData {
  name: string;
  cpf: CPF;
  email?: Email;
  phone?: PhoneNumber;
  birthDate?: Date;
  monthlyIncome?: Money;
  rg?: string;
  issuingBody?: string;
  maritalStatus?: string;
  nationality?: string;
  zipCode?: string;
  address?: string;
  occupation?: string;
}

export interface LoanConditions {
  requestedAmount: Money;
  term: number; // in months
  purpose?: string;
  collateral?: string;
  tacValue?: Money;
  iofValue?: Money;
  totalFinancedAmount?: Money;
  monthlyPayment?: Money;
  interestRate?: number;
}

export class Proposal {
  private readonly id: string;
  private status: ProposalStatus;
  private customerData: CustomerData;
  private loanConditions: LoanConditions;
  private partnerId?: string;
  private storeId?: string;
  private productId?: string;
  private createdAt: Date;
  private updatedAt: Date;
  private pendingReason?: string;
  private observations?: string;

  constructor(
    id: string,
    customerData: CustomerData,
    loanConditions: LoanConditions,
    partnerId?: string,
    storeId?: string,
    productId?: string
  ) {
    this.id = id;
    this.status = ProposalStatus.DRAFT;
    this.customerData = customerData;
    this.loanConditions = loanConditions;
    this.partnerId = partnerId;
    this.storeId = storeId;
    this.productId = productId;
    this.createdAt = new Date();
    this.updatedAt = new Date();

    this.validateInvariants();
  }

  // Domain Methods
  public submitForAnalysis(): void {
    if (this.status !== ProposalStatus.DRAFT) {
      throw new Error('Only draft proposals can be submitted for analysis');
    }

    this.validateForSubmission();
    this.status = ProposalStatus.WAITING_ANALYSIS;
    this.updatedAt = new Date();
  }

  public startAnalysis(): void {
    if (this.status !== ProposalStatus.WAITING_ANALYSIS) {
      throw new Error('Only waiting proposals can start analysis');
    }

    this.status = ProposalStatus.IN_ANALYSIS;
    this.updatedAt = new Date();
  }

  public approve(): void {
    if (this.status !== ProposalStatus.IN_ANALYSIS) {
      throw new Error('Only proposals in analysis can be approved');
    }

    this.status = ProposalStatus.APPROVED;
    this.updatedAt = new Date();
  }

  public reject(reason: string): void {
    if (this.status !== ProposalStatus.IN_ANALYSIS) {
      throw new Error('Only proposals in analysis can be rejected');
    }

    this.status = ProposalStatus.REJECTED;
    this.observations = reason;
    this.updatedAt = new Date();
  }

  public setPending(reason: string): void {
    if (this.status !== ProposalStatus.IN_ANALYSIS) {
      throw new Error('Only proposals in analysis can be set as pending');
    }

    this.status = ProposalStatus.PENDING;
    this.pendingReason = reason;
    this.updatedAt = new Date();
  }

  public formalize(): void {
    if (this.status !== ProposalStatus.APPROVED) {
      throw new Error('Only approved proposals can be formalized');
    }

    this.status = ProposalStatus.FORMALIZED;
    this.updatedAt = new Date();
  }

  public markAsPaid(): void {
    if (this.status !== ProposalStatus.FORMALIZED) {
      throw new Error('Only formalized proposals can be marked as paid');
    }

    this.status = ProposalStatus.PAID;
    this.updatedAt = new Date();
  }

  // Business Rules Validation
  private validateInvariants(): void {
    // CPF validation is handled by the Value Object
    
    if (!this.loanConditions.requestedAmount.isPositive()) {
      throw new Error('Requested amount must be positive');
    }

    if (this.loanConditions.term <= 0 || this.loanConditions.term > 84) {
      throw new Error('Term must be between 1 and 84 months');
    }
  }

  private validateForSubmission(): void {
    if (!this.customerData.name) {
      throw new Error('Customer name is required');
    }

    if (!this.customerData.phone && !this.customerData.email) {
      throw new Error('At least one contact method is required');
    }

    if (!this.loanConditions.purpose) {
      throw new Error('Loan purpose is required');
    }
  }


  // Financial Calculations
  public calculateMonthlyPayment(): number | null {
    const { requestedAmount, term, interestRate } = this.loanConditions;

    // Se não tiver taxa de juros definida, retorna null
    if (!interestRate || interestRate <= 0) {
      return null;
    }

    // Cálculo de parcela usando fórmula de juros compostos
    const monthlyRate = interestRate / 100 / 12;
    const requestedAmountValue = requestedAmount.getReais();
    const numerator = requestedAmountValue * monthlyRate * Math.pow(1 + monthlyRate, term);
    const denominator = Math.pow(1 + monthlyRate, term) - 1;

    return numerator / denominator;
  }

  public calculateTotalAmount(): number | null {
    const monthlyPayment = this.calculateMonthlyPayment();

    if (!monthlyPayment) {
      return null;
    }

    return monthlyPayment * this.loanConditions.term;
  }

  // Getters
  public getId(): string {
    return this.id;
  }
  public getStatus(): ProposalStatus {
    return this.status;
  }
  public getCustomerData(): CustomerData {
    return { ...this.customerData };
  }
  public getLoanConditions(): LoanConditions {
    return { ...this.loanConditions };
  }
  public getPartnerId(): string | undefined {
    return this.partnerId;
  }
  public getStoreId(): string | undefined {
    return this.storeId;
  }
  public getProductId(): string | undefined {
    return this.productId;
  }
  public getCreatedAt(): Date {
    return this.createdAt;
  }
  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
  public getPendingReason(): string | undefined {
    return this.pendingReason;
  }
  public getObservations(): string | undefined {
    return this.observations;
  }

  // Factory method to reconstruct from persistence
  public static fromPersistence(data: any): Proposal {
    // Reconstruct Value Objects from primitive data
    const customerData: CustomerData = {
      ...data.customerData,
      cpf: CPF.create(data.customerData.cpf)!,
      email: data.customerData.email ? Email.create(data.customerData.email) : undefined,
      phone: data.customerData.phone ? PhoneNumber.create(data.customerData.phone) : undefined,
      monthlyIncome: data.customerData.monthlyIncome ? Money.fromReais(data.customerData.monthlyIncome) : undefined,
    };

    const loanConditions: LoanConditions = {
      ...data.loanConditions,
      requestedAmount: Money.fromReais(data.loanConditions.requestedAmount),
      tacValue: data.loanConditions.tacValue ? Money.fromReais(data.loanConditions.tacValue) : undefined,
      iofValue: data.loanConditions.iofValue ? Money.fromReais(data.loanConditions.iofValue) : undefined,
      totalFinancedAmount: data.loanConditions.totalFinancedAmount ? Money.fromReais(data.loanConditions.totalFinancedAmount) : undefined,
      monthlyPayment: data.loanConditions.monthlyPayment ? Money.fromReais(data.loanConditions.monthlyPayment) : undefined,
    };

    const proposal = Object.create(Proposal.prototype);
    Object.assign(proposal, {
      id: data.id,
      status: data.status,
      customerData,
      loanConditions,
      partnerId: data.partnerId,
      storeId: data.storeId,
      productId: data.productId,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      pendingReason: data.pendingReason,
      observations: data.observations,
    });
    return proposal;
  }
}
