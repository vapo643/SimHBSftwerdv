/**
 * Credit Analysis Domain Service - Sprint 2
 *
 * Implements complex business rules for credit evaluation
 * Encapsulates domain logic for credit scoring and risk assessment
 *
 * Date: 2025-08-28
 * Author: GEM-07 AI Specialist System
 */

import { Money, CPF } from '@shared/value-objects';
import type { Proposta, TabelaComercial, Produto } from '@shared/schema';

/**
 * Credit Analysis Result with detailed scoring
 */
export interface CreditAnalysisResult {
  aprovado: boolean;
  score: number;
  riscoCategoria: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  observacoes: string[];
  restricoes: string[];
  limiteAprovado?: Money;
  taxaSugerida?: number;
  prazoMaximo?: number;
  garantiasNecessarias?: string[];
}

/**
 * Credit Analysis Input Data
 */
export interface CreditAnalysisInput {
  clienteCpf: string;
  valorSolicitado: number;
  prazoSolicitado: number;
  rendaMensal?: number;
  patrimonioLiquido?: number;
  scoreSerasa?: number;
  historicoPagamentos?: HistoricoPagamento[];
  dividas?: Divida[];
  produto: Produto;
  tabelaComercial: TabelaComercial;
}

export interface HistoricoPagamento {
  dataVencimento: Date;
  dataPagamento: Date | null;
  valor: number;
  statusPagamento: 'EM_DIA' | 'ATRASO' | 'INADIMPLENCIA';
  diasAtraso?: number;
}

export interface Divida {
  valor: number;
  tipo: 'CARTAO_CREDITO' | 'FINANCIAMENTO' | 'EMPRESTIMO' | 'OUTROS';
  situacao: 'ATIVA' | 'QUITADA' | 'REFINANCIADA';
}

/**
 * Domain Service for Credit Analysis
 * Implements business rules for credit evaluation and risk assessment
 */
export class CreditAnalysisService {
  /**
   * Perform comprehensive credit analysis
   * Implements multi-factor risk assessment algorithm
   */
  async analyzeCredit(input: CreditAnalysisInput): Promise<CreditAnalysisResult> {
    const valorSolicitado = Money.fromReais(input.valorSolicitado);
    const observacoes: string[] = [];
    const restricoes: string[] = [];

    // 1. Validate CPF
    const cpf = CPF.create(input.clienteCpf);
    if (!cpf) {
      return {
        aprovado: false,
        score: 0,
        riscoCategoria: 'CRITICO',
        observacoes: ['CPF inválido'],
        restricoes: ['Documento de identificação inválido'],
      };
    }

    // 2. Product-specific validations
    const productValidation = this.validateProductLimits(
      valorSolicitado,
      input.prazoSolicitado,
      input.produto
    );
    if (!productValidation.valid) {
      return {
        aprovado: false,
        score: 0,
        riscoCategoria: 'CRITICO',
        observacoes: productValidation.observacoes,
        restricoes: productValidation.restricoes,
      };
    }

    // 3. Calculate base score (0-1000)
    let score = 0;

    // Score por renda (0-300 points)
    score += this.calculateIncomeScore(input.rendaMensal, valorSolicitado);

    // Score por Serasa (0-250 points)
    score += this.calculateSerasaScore(input.scoreSerasa);

    // Score por histórico de pagamentos (0-250 points)
    score += this.calculatePaymentHistoryScore(input.historicoPagamentos);

    // Score por endividamento (0-200 points)
    score += this.calculateDebtScore(input.dividas, input.rendaMensal);

    // 4. Apply business rules modifiers
    const riskModifiers = this.applyRiskModifiers(input, score);
    score = Math.max(0, score + riskModifiers.scoreAdjustment);
    observacoes.push(...riskModifiers.observacoes);

    // 5. Determine risk category and approval
    const riscoCategoria = this.determineRiskCategory(score);
    const aprovado = this.determineApproval(score, input.produto, valorSolicitado);

    // 6. Calculate adjusted terms if approved
    let limiteAprovado: Money | undefined;
    let taxaSugerida: number | undefined;
    let prazoMaximo: number | undefined;
    let garantiasNecessarias: string[] | undefined;

    if (aprovado || score >= 400) {
      // Partial approval
      const adjustedTerms = this.calculateAdjustedTerms(
        input,
        score,
        riscoCategoria,
        valorSolicitado
      );

      limiteAprovado = adjustedTerms.limiteAprovado;
      taxaSugerida = adjustedTerms.taxaSugerida;
      prazoMaximo = adjustedTerms.prazoMaximo;
      garantiasNecessarias = adjustedTerms.garantiasNecessarias;
    }

    return {
      aprovado,
      score,
      riscoCategoria,
      observacoes,
      restricoes,
      limiteAprovado,
      taxaSugerida,
      prazoMaximo,
      garantiasNecessarias,
    };
  }

  /**
   * Validate product-specific limits and constraints
   * Note: Using simplified validation based on existing schema
   */
  private validateProductLimits(
    valorSolicitado: Money,
    prazoSolicitado: number,
    produto: Produto
  ): { valid: boolean; observacoes: string[]; restricoes: string[] } {
    const observacoes: string[] = [];
    const restricoes: string[] = [];

    // Basic product validation using existing fields
    if (!produto.isActive) {
      restricoes.push('Produto não está ativo');
    }

    // Simplified business rules based on available schema
    const valorReais = valorSolicitado.getReais();

    // Basic limits (can be configured via environment or database later)
    const VALOR_MINIMO = 1000; // R$ 1.000
    const VALOR_MAXIMO = 500000; // R$ 500.000
    const PRAZO_MINIMO = 6; // 6 meses
    const PRAZO_MAXIMO = 84; // 84 meses

    if (valorReais < VALOR_MINIMO) {
      restricoes.push(`Valor mínimo: ${Money.fromReais(VALOR_MINIMO).toFormattedString()}`);
    }

    if (valorReais > VALOR_MAXIMO) {
      restricoes.push(`Valor máximo: ${Money.fromReais(VALOR_MAXIMO).toFormattedString()}`);
    }

    if (prazoSolicitado < PRAZO_MINIMO) {
      restricoes.push(`Prazo mínimo: ${PRAZO_MINIMO} meses`);
    }

    if (prazoSolicitado > PRAZO_MAXIMO) {
      restricoes.push(`Prazo máximo: ${PRAZO_MAXIMO} meses`);
    }

    return {
      valid: restricoes.length === 0,
      observacoes,
      restricoes,
    };
  }

  /**
   * Calculate income-based score (0-300 points)
   */
  private calculateIncomeScore(rendaMensal: number | undefined, valorSolicitado: Money): number {
    if (!rendaMensal || rendaMensal <= 0) return 0;

    const renda = Money.fromReais(rendaMensal);
    const prestacaoMensal = valorSolicitado.divide(12); // Simplified: value / 12 months
    const compromissoRenda = prestacaoMensal.getReais() / renda.getReais(); // Monthly installment / income ratio

    if (compromissoRenda <= 0.15) return 300; // <= 15% of income
    if (compromissoRenda <= 0.25) return 250; // <= 25% of income
    if (compromissoRenda <= 0.35) return 200; // <= 35% of income
    if (compromissoRenda <= 0.5) return 150; // <= 50% of income

    return 50; // > 50% of income
  }

  /**
   * Calculate Serasa score contribution (0-250 points)
   */
  private calculateSerasaScore(scoreSerasa: number | undefined): number {
    if (!scoreSerasa) return 100; // Neutral score when unavailable

    if (scoreSerasa >= 800) return 250;
    if (scoreSerasa >= 700) return 200;
    if (scoreSerasa >= 600) return 150;
    if (scoreSerasa >= 500) return 100;
    if (scoreSerasa >= 400) return 50;

    return 0;
  }

  /**
   * Calculate payment history score (0-250 points)
   */
  private calculatePaymentHistoryScore(historico: HistoricoPagamento[] | undefined): number {
    if (!historico || historico.length === 0) return 125; // Neutral score

    const totalPagamentos = historico.length;
    const pagamentosEmDia = historico.filter((p) => p.statusPagamento === 'EM_DIA').length;
    const pagamentosAtraso = historico.filter((p) => p.statusPagamento === 'ATRASO').length;
    const inadimplencias = historico.filter((p) => p.statusPagamento === 'INADIMPLENCIA').length;

    let score = 0;

    // Base score from payment compliance
    const percentualEmDia = pagamentosEmDia / totalPagamentos;
    score += percentualEmDia * 200;

    // Penalty for delays
    const percentualAtraso = pagamentosAtraso / totalPagamentos;
    score -= percentualAtraso * 50;

    // Heavy penalty for defaults
    const percentualInadimplencia = inadimplencias / totalPagamentos;
    score -= percentualInadimplencia * 150;

    // Recent payment behavior (last 6 months weighted more)
    const recentes = historico.slice(-6);
    const recentesEmDia = recentes.filter((p) => p.statusPagamento === 'EM_DIA').length;
    if (recentes.length > 0) {
      const percentualRecenteEmDia = recentesEmDia / recentes.length;
      score += percentualRecenteEmDia * 50; // Bonus for recent good behavior
    }

    return Math.max(0, Math.min(250, score));
  }

  /**
   * Calculate debt burden score (0-200 points)
   */
  private calculateDebtScore(
    dividas: Divida[] | undefined,
    rendaMensal: number | undefined
  ): number {
    if (!dividas || dividas.length === 0) return 200; // No debt is good
    if (!rendaMensal || rendaMensal <= 0) return 50; // Cannot assess without income

    const renda = Money.fromReais(rendaMensal);
    const totalDividas = dividas
      .filter((d) => d.situacao === 'ATIVA')
      .reduce((total, divida) => total + divida.valor, 0);

    const comprometimentoRenda = totalDividas / renda.getReais();

    if (comprometimentoRenda <= 0.2) return 200; // <= 20% debt/income
    if (comprometimentoRenda <= 0.35) return 150; // <= 35% debt/income
    if (comprometimentoRenda <= 0.5) return 100; // <= 50% debt/income
    if (comprometimentoRenda <= 0.7) return 50; // <= 70% debt/income

    return 0; // > 70% debt/income
  }

  /**
   * Apply business-specific risk modifiers
   */
  private applyRiskModifiers(
    input: CreditAnalysisInput,
    baseScore: number
  ): {
    scoreAdjustment: number;
    observacoes: string[];
  } {
    let scoreAdjustment = 0;
    const observacoes: string[] = [];

    // Age-based adjustments (if we had age data)
    // Young clients (18-25): slightly riskier
    // Prime age (26-55): neutral
    // Senior (55+): slightly less risky

    // Product-specific adjustments based on product name (simplified)
    const nomeProduto = input.produto.nomeProduto.toLowerCase();
    if (nomeProduto.includes('rotativo') || nomeProduto.includes('cartao')) {
      scoreAdjustment -= 50; // More risky product
      observacoes.push('Produto de crédito rotativo - risco aumentado');
    }

    if (nomeProduto.includes('garantia') || nomeProduto.includes('garantido')) {
      scoreAdjustment += 100; // Less risky with guarantee
      observacoes.push('Empréstimo com garantia - risco reduzido');
    }

    // Economic conditions modifier
    // In real system, this would come from external data
    const economicRiskFactor = this.getEconomicRiskFactor();
    scoreAdjustment += economicRiskFactor;

    if (economicRiskFactor < 0) {
      observacoes.push('Condições econômicas adversas consideradas na análise');
    }

    return { scoreAdjustment, observacoes };
  }

  /**
   * Determine risk category based on score
   */
  private determineRiskCategory(score: number): 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO' {
    if (score >= 750) return 'BAIXO';
    if (score >= 600) return 'MEDIO';
    if (score >= 400) return 'ALTO';
    return 'CRITICO';
  }

  /**
   * Determine approval based on score and business rules
   */
  private determineApproval(score: number, produto: Produto, valorSolicitado: Money): boolean {
    // Simplified approval threshold based on product name
    const nomeProduto = produto.nomeProduto.toLowerCase();
    const baseThreshold = nomeProduto.includes('garantia') ? 400 : 600;

    // Higher threshold for larger amounts
    let threshold = baseThreshold;
    const valorReais = valorSolicitado.getReais();
    if (valorReais > 50000) {
      threshold += 100;
    } else if (valorReais > 100000) {
      threshold += 200;
    }

    return score >= threshold;
  }

  /**
   * Calculate adjusted terms for partial approvals
   */
  private calculateAdjustedTerms(
    input: CreditAnalysisInput,
    score: number,
    risco: string,
    valorOriginal: Money
  ): {
    limiteAprovado: Money;
    taxaSugerida: number;
    prazoMaximo: number;
    garantiasNecessarias?: string[];
  } {
    const taxaBase = parseFloat(input.tabelaComercial.taxaJurosAnual || '24'); // 24% default

    // Adjust limit based on risk
    let fatorLimite = 1.0;
    if (risco === 'ALTO') fatorLimite = 0.7;
    if (risco === 'CRITICO') fatorLimite = 0.4;

    const limiteAprovado = valorOriginal.multiply(fatorLimite);

    // Adjust interest rate based on risk
    let taxaSugerida = taxaBase;
    if (risco === 'MEDIO') taxaSugerida = taxaBase * 1.2;
    if (risco === 'ALTO') taxaSugerida = taxaBase * 1.5;
    if (risco === 'CRITICO') taxaSugerida = taxaBase * 2.0;

    // Adjust maximum term based on risk
    let prazoMaximo = input.prazoSolicitado;
    if (risco === 'ALTO') prazoMaximo = Math.min(prazoMaximo, 24);
    if (risco === 'CRITICO') prazoMaximo = Math.min(prazoMaximo, 12);

    // Determine if guarantees are needed
    let garantiasNecessarias: string[] | undefined;
    if (risco === 'ALTO' || valorOriginal.greaterThan(Money.fromReais(100000))) {
      garantiasNecessarias = ['Avalista', 'Comprovante de renda atualizado'];
    }
    if (risco === 'CRITICO') {
      garantiasNecessarias = ['Garantia real', 'Avalista solidário', 'Seguro de vida'];
    }

    return {
      limiteAprovado,
      taxaSugerida,
      prazoMaximo,
      garantiasNecessarias,
    };
  }

  /**
   * Get current economic risk factor
   * In production, this would integrate with economic indicators
   */
  private getEconomicRiskFactor(): number {
    // Simplified economic factor
    // In production: integrate with SELIC rate, inflation, unemployment, etc.
    return 0; // Neutral for now
  }

  /**
   * Generate credit analysis summary for logging
   */
  generateAnalysisSummary(input: CreditAnalysisInput, result: CreditAnalysisResult): string {
    const status = result.aprovado ? 'APROVADO' : 'NEGADO';
    const valor = Money.fromReais(input.valorSolicitado).toFormattedString();

    return (
      `Análise de Crédito - ${status} | CPF: ${input.clienteCpf} | ` +
      `Valor: ${valor} | Score: ${result.score} | Risco: ${result.riscoCategoria}`
    );
  }
}

// Export singleton instance
export const creditAnalysisService = new CreditAnalysisService();
