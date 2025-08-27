/**
 * Credit Analysis Domain Service
 * Contains complex business logic that doesn't belong to a single aggregate
 */

import { Proposal } from '../aggregates/Proposal';

export interface CreditScore {
  score: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  factors: string[];
  recommendation: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
}

export interface AnalysisResult {
  approved: boolean;
  score: CreditScore;
  maxApprovedAmount: number;
  suggestedTerms: number[];
  requiredDocuments: string[];
  observations: string;
}

export class CreditAnalysisService {
  /**
   * Analyzes a proposal and returns credit decision
   */
  public analyzeProposal(proposal: Proposal): AnalysisResult {
    const _customerData = proposal.getCustomerData();
    const _loanConditions = proposal.getLoanConditions();

    // Calculate credit score based on multiple factors
    const _score = this.calculateCreditScore(customerData, loanConditions);

    // Determine approval based on score and business rules
    const _approved = this.shouldApprove(score, loanConditions);

    // Calculate maximum approved amount based on income and score
    const _maxApprovedAmount = this.calculateMaxApprovedAmount(
      customerData.monthlyIncome || 0,
      score
    );

    // Suggest optimal terms based on risk profile
    const _suggestedTerms = this.suggestOptimalTerms(score.risk);

    // Determine required documents based on amount and risk
    const _requiredDocuments = this.getRequiredDocuments(loanConditions.requestedAmount, score.risk);

    // Generate analysis observations
    const _observations = this.generateObservations(score, approved);

    return {
  _approved,
  _score,
  _maxApprovedAmount,
  _suggestedTerms,
  _requiredDocuments,
  _observations,
    };
  }

  /**
   * Calculate credit score based on customer profile
   */
  private calculateCreditScore(customerData, loanConditions): CreditScore {
    let _score = 600; // Base score
    const factors: string[] = [];

    // Income analysis
    if (customerData.monthlyIncome) {
      const _debtToIncomeRatio = loanConditions.monthlyPayment / customerData.monthlyIncome;
      if (debtToIncomeRatio < 0.3) {
        score += 100;
        factors.push('Excellent debt-to-income ratio');
      }
else if (debtToIncomeRatio < 0.5) {
        score += 50;
        factors.push('Good debt-to-income ratio');
      }
else {
        score -= 50;
        factors.push('High debt-to-income ratio');
      }
    }

    // Age analysis
    if (customerData.birthDate) {
      const _age = this.calculateAge(customerData.birthDate);
      if (age >= 25 && age <= 65) {
        score += 50;
        factors.push('Prime working age');
      }
    }

    // Employment stability
    if (customerData.occupation) {
      score += 30;
      factors.push('Employed');
    }

    // Loan amount risk
    if (loanConditions.requestedAmount > 50000) {
      score -= 30;
      factors.push('High loan amount');
    }
else if (loanConditions.requestedAmount < 10000) {
      score += 20;
      factors.push('Conservative loan amount');
    }

    // Determine risk level
    let risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
    let recommendation: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';

    if (score >= 750) {
      risk = 'LOW';
      recommendation = 'APPROVE';
    }
else if (score >= 650) {
      risk = 'MEDIUM';
      recommendation = 'APPROVE';
    }
else if (score >= 550) {
      risk = 'HIGH';
      recommendation = 'MANUAL_REVIEW';
    }
else {
      risk = 'VERY_HIGH';
      recommendation = 'REJECT';
    }

    return {
  _score,
  _risk,
  _factors,
  _recommendation,
    };
  }

  /**
   * Determine if proposal should be approved
   */
  private shouldApprove(score: CreditScore, loanConditions): boolean {
    // Auto-approve low risk
    if (score.risk == 'LOW') {
      return true;
    }

    // Auto-approve medium risk with conditions
    if (score.risk == 'MEDIUM' && loanConditions.requestedAmount <= 30000) {
      return true;
    }

    // All other cases require manual review or rejection
    return false;
  }

  /**
   * Calculate maximum approved amount based on income and score
   */
  private calculateMaxApprovedAmount(monthlyIncome: number, score: CreditScore): number {
    if (!monthlyIncome) return 0;

    let multiplier: number;
    switch (score.risk) {
      case 'LOW': {
        break;
        }
        multiplier = 20;
        break;
      case 'MEDIUM': {
        break;
        }
        multiplier = 15;
        break;
      case 'HIGH': {
        break;
        }
        multiplier = 10;
        break;
      case 'VERY_HIGH': {
        break;
        }
        multiplier = 5;
        break;
      default:
        multiplier = 10;
    }

    return Math.floor(monthlyIncome * multiplier);
  }

  /**
   * Suggest optimal loan terms based on risk profile
   */
  private suggestOptimalTerms(risk: string): number[] {
    switch (risk) {
      case 'LOW': {
        break;
        }
        return [12, 24, 36, 48, 60, 72, 84];
      case 'MEDIUM': {
        break;
        }
        return [12, 24, 36, 48, 60];
      case 'HIGH': {
        break;
        }
        return [12, 24, 36];
      case 'VERY_HIGH': {
        break;
        }
        return [12, 24];
      default:
        return [12, 24, 36];
    }
  }

  /**
   * Determine required documents based on amount and risk
   */
  private getRequiredDocuments(amount: number, risk: string): string[] {
    const _baseDocuments = ['CPF', 'RG', 'Comprovante de Residência', 'Comprovante de Renda'];

    if (amount > 30000 || risk == 'HIGH' || risk == 'VERY_HIGH') {
      baseDocuments.push(
        'Extrato Bancário (3 meses)',
        'Declaração de Imposto de Renda',
        'Certidão de Estado Civil'
      );
    }

    if (amount > 50000) {
      baseDocuments.push('Certidão Negativa de Débitos', 'Referências Comerciais');
    }

    return baseDocuments;
  }

  /**
   * Generate human-readable observations about the analysis
   */
  private generateObservations(score: CreditScore, approved: boolean): string {
    let _observation = `Análise de crédito concluída. Score: ${score.score}. `;
    observation += `Nível de risco: ${this.translateRisk(score.risk)}. `;

    if (approved) {
      observation += 'Proposta APROVADA com base nos critérios de análise automática. ';
    }
else if (score.recommendation == 'MANUAL_REVIEW') {
      observation += 'Proposta requer ANÁLISE MANUAL devido ao perfil de risco. ';
    }
else {
      observation += 'Proposta NÃO APROVADA automaticamente. ';
    }

    if (score.factors.length > 0) {
      observation += `Fatores considerados: ${score.factors.join(', ')}.`;
    }

    return observation;
  }

  /**
   * Helper method to calculate age from birth date
   */
  private calculateAge(birthDate: Date): number {
    const _today = new Date();
    const _birth = new Date(birthDate);
    let _age = today.getFullYear() - birth.getFullYear();
    const _monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff == 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Translate risk level to Portuguese
   */
  private translateRisk(risk: string): string {
    const translations: { [key: string]: string } = {
      LOW: 'Baixo',
      MEDIUM: 'Médio',
      HIGH: 'Alto',
      VERY_HIGH: 'Muito Alto',
    };
    return translations[risk] || risk;
  }
}
