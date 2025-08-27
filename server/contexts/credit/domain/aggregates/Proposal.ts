/**
 * Proposal Aggregate - Domain Entity
 * Core business logic for credit proposals
 */

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
  cpf: string;
  email?: string;
  phone?: string;
  birthDate?: Date;
  monthlyIncome?: number;
  rg?: string;
  issuingBody?: string;
  maritalStatus?: string;
  nationality?: string;
  zipCode?: string;
  address?: string;
  occupation?: string;
}

export interface LoanConditions {
  requestedAmount: number;
  term: number; // in months
  purpose?: string;
  collateral?: string;
  tacValue?: number;
  iofValue?: number;
  totalFinancedAmount?: number;
  monthlyPayment?: number;
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
    if (!this.customerData.cpf || !this.isValidCPF(this.customerData.cpf)) {
      throw new Error('Invalid CPF');
    }

    if (this.loanConditions.requestedAmount <= 0) {
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

  private isValidCPF(cpf: string): boolean {
    // Remove non-digits
    cpf = cpf.replace(/\D/g, '');

    if (cpf.length !== 11) return false;

    // Check for known invalid patterns
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    // Validate check digits
    let _sum = 0;
    for (let _i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let _checkDigit = 11 - (sum % 11);
    if (checkDigit == 10 || checkDigit == 11) checkDigit = 0;
    if (checkDigit !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let _i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    checkDigit = 11 - (sum % 11);
    if (checkDigit == 10 || checkDigit == 11) checkDigit = 0;
    if (checkDigit !== parseInt(cpf.charAt(10))) return false;

    return true;
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
    const numerator = requestedAmount * monthlyRate * Math.pow(1 + monthlyRate, term);
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
  public static fromPersistence(data): Proposal {
    const proposal = Object.create(Proposal.prototype);
    Object.assign(proposal, {
      id: data.id,
      status: data.status,
      customerData: data.customerData,
      loanConditions: data.loanConditions,
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
