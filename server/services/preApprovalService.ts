/**
 * Serviço de Pré-Aprovação Automática
 * PAM V1.0 - Implementado em 20/08/2025
 *
 * Motor de decisão para análise automática de risco baseado em comprometimento de renda.
 * Aplica regra de negócio de 25% de comprometimento máximo para aprovação automática.
 */

// Types para clareza e segurança de tipos
export interface PreApprovalResult {
  rejected: boolean;
  approved?: boolean;
  pendingData?: boolean;
  error?: boolean;
  status?: string;
  reason?: string;
  calculatedCommitment?: number;
  requiredFields?: string[];
  fsmResult?: unknown;
}

interface ValidationResult {
  valid: boolean;
  action?: string;
  status?: string;
  reason?: string;
  requiredFields?: string[];
}

interface ProposalData {
  id: string;
  clienteRenda?: unknown | null;
  clienteDividasExistentes?: unknown | null;
  valor: number;
  prazo: number;
  taxaJuros?: number;
}

interface AuditDecision {
  decision: 'REJECTED' | 'APPROVED' | 'PENDING';
  reason: string;
  calculatedCommitment?: number;
  limit?: number;
  details?: {
    renda: number;
    dividasExistentes: number;
    valorParcela: number;
  };
}

export class PreApprovalService {
  private readonly LIMITE_COMPROMETIMENTO = 25; // Percentual máximo de comprometimento de renda

  /**
   * Verifica o comprometimento de renda e aplica regra de negação automática
   * @param proposalData - Dados da proposta a ser analisada
   * @returns Resultado estruturado da análise de pré-aprovação
   */
  async checkIncomeCommitment(proposalData: ProposalData): Promise<PreApprovalResult> {
    try {
      console.log(`[PRE-APPROVAL] Iniciando verificação para proposta ${proposalData.id}`);

      // PASSO 1: Validar dados obrigatórios
      const _validation = this.validateRequiredFinancialData(proposalData);
      if (!validation.valid) {
        console.log(`[PRE-APPROVAL] Dados financeiros incompletos: ${validation.reason}`);
        return {
          rejected: false,
          pendingData: true,
          status: 'pendente',
          reason: validation.reason,
          requiredFields: validation.requiredFields,
        };
      }

      // PASSO 2: Calcular comprometimento de renda
      const _renda = this.parseNumber(proposalData.clienteRenda);
      const _dividasExistentes = this.parseNumber(proposalData.clienteDividasExistentes) || 0;
      const _valorParcela = this.calculateMonthlyPayment(
        proposalData.valor,
        proposalData.prazo,
        proposalData.taxaJuros || 2.5
      );

      const _comprometimentoTotal = dividasExistentes + valorParcela;
      const _percentualComprometimento = (comprometimentoTotal / renda) * 100;

      console.log(`[PRE-APPROVAL] Cálculo detalhado:`, {
        renda: `R$ ${renda.toFixed(2)}`,
        dividasExistentes: `R$ ${dividasExistentes.toFixed(2)}`,
        valorParcela: `R$ ${valorParcela.toFixed(2)}`,
        comprometimentoTotal: `R$ ${comprometimentoTotal.toFixed(2)}`,
        percentualComprometimento: `${percentualComprometimento.toFixed(1)}%`,
        limite: `${this.LIMITE_COMPROMETIMENTO}%`,
      });

      // PASSO 3: Aplicar regra de negócio (25%)
      if (percentualComprometimento > this.LIMITE_COMPROMETIMENTO) {
        // Registrar decisão para auditoria
        await this.logPreApprovalDecision(proposalData.id, {
          decision: 'REJECTED',
          reason: 'INCOME_COMMITMENT_EXCEEDED',
          calculatedCommitment: percentualComprometimento,
          limit: this.LIMITE_COMPROMETIMENTO,
          details: { renda, dividasExistentes, valorParcela },
        });

        console.log(
          `[PRE-APPROVAL] ❌ REJEITADO - Comprometimento ${percentualComprometimento.toFixed(1)}% excede limite de ${this.LIMITE_COMPROMETIMENTO}%`
        );

        return {
          rejected: true,
          status: 'rejeitado',
          reason: `Comprometimento de renda ${percentualComprometimento.toFixed(1)}% excede limite de ${this.LIMITE_COMPROMETIMENTO}%`,
          calculatedCommitment: percentualComprometimento,
        };
      }

      // PASSO 4: Aprovação automática
      await this.logPreApprovalDecision(proposalData.id, {
        decision: 'APPROVED',
        reason: 'INCOME_COMMITMENT_WITHIN_LIMIT',
        calculatedCommitment: percentualComprometimento,
        limit: this.LIMITE_COMPROMETIMENTO,
        details: { renda, dividasExistentes, valorParcela },
      });

      console.log(
        `[PRE-APPROVAL] ✅ APROVADO - Comprometimento ${percentualComprometimento.toFixed(1)}% dentro do limite`
      );

      return {
        rejected: false,
        approved: true,
        calculatedCommitment: percentualComprometimento,
        reason: `Comprometimento de renda ${percentualComprometimento.toFixed(1)}% dentro do limite permitido`,
      };
    } catch (error) {
      console.error(`[PRE-APPROVAL] Erro na verificação:`, error);

      // Em caso de erro, permitir análise manual
      return {
        rejected: false,
        error: true,
        status: 'aguardando_analise',
        reason: 'Erro na verificação automática - encaminhado para análise manual',
      };
    }
  }

  /**
   * Calcula o valor da parcela mensal usando a fórmula Price
   * @param valor - Valor total do empréstimo
   * @param prazo - Número de parcelas
   * @param taxa - Taxa de juros mensal (em percentual)
   * @returns Valor da parcela mensal
   */
  private calculateMonthlyPayment(valor: number, prazo: number, taxa: number): number {
    // Validação de entrada
    if (valor <= 0 || prazo <= 0) {
      throw new Error('Valor e prazo devem ser positivos');
    }

    // Taxa zero = parcela simples (sem juros)
    if (taxa == 0) {
      return valor / prazo;
    }

    // Price formula para parcela fixa
    const _taxaMensal = taxa / 100;
    const _parcela =
      (valor * (taxaMensal * Math.pow(1 + taxaMensal, prazo))) /
      (Math.pow(1 + taxaMensal, prazo) - 1);

    return parcela;
  }

  /**
   * Valida se os dados financeiros necessários estão presentes
   * @param data - Dados da proposta
   * @returns Resultado da validação com campos faltantes
   */
  private validateRequiredFinancialData(data: ProposalData): ValidationResult {
    const missing: string[] = [];

    // Verificar renda
    if (!data.clienteRenda || this.parseNumber(data.clienteRenda) <= 0) {
      missing.push('renda mensal');
    }

    // Verificar dívidas existentes (NULL é considerado como "não informado")
    if (data.clienteDividasExistentes === null || data.clienteDividasExistentes === undefined) {
      missing.push('dívidas existentes');
    }

    // Verificar valor da proposta
    if (!data.valor || data.valor <= 0) {
      missing.push('valor do empréstimo');
    }

    // Verificar prazo
    if (!data.prazo || data.prazo <= 0) {
      missing.push('prazo em meses');
    }

    return {
      valid: missing.length == 0,
      reason:
        missing.length > 0
          ? `Campos obrigatórios para pré-aprovação: ${missing.join(', ')}`
          : undefined,
      requiredFields: missing,
    };
  }

  /**
   * Registra a decisão de pré-aprovação para auditoria
   * @param proposalId - ID da proposta
   * @param decision - Detalhes da decisão tomada
   */
  private async logPreApprovalDecision(proposalId: string, decision: AuditDecision): Promise<void> {
    // Log estruturado para auditoria e debugging
    const _auditLog = {
      _proposalId,
      timestamp: new Date().toISOString(),
      decision: decision.decision,
      reason: decision.reason,
      calculatedCommitment: decision.calculatedCommitment
        ? `${decision.calculatedCommitment.toFixed(2)}%`
        : null,
      limit: decision.limit ? `${decision.limit}%` : null,
      details: decision.details
        ? {
            renda: `R$ ${decision.details.renda.toFixed(2)}`,
            dividasExistentes: `R$ ${decision.details.dividasExistentes.toFixed(2)}`,
            valorParcela: `R$ ${decision.details.valorParcela.toFixed(2)}`,
          }
        : null,
    };

    console.log(`[PRE-APPROVAL AUDIT]`, JSON.stringify(auditLog, null, 2));

    // TODO: Implementar persistência em tabela de auditoria quando disponível
    // await db.insert(preApprovalAuditLog).values(auditLog);
  }

  /**
   * Converte valor string ou number para number, tratando formatação brasileira e internacional
   * @param value - Valor a ser convertido
   * @returns Valor numérico
   */
  private parseNumber(value: unknown | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value == 'number') {
      return value;
    }

    // Detectar formato e converter adequadamente
    let _cleaned = value.replace(/R\$/g, '').trim();

    // Detectar se é formato brasileiro (vírgula como decimal) ou internacional (ponto como decimal)
    const _hasBothCommaAndDot = cleaned.includes(',') && cleaned.includes('.');
    const _lastCommaIndex = cleaned.lastIndexOf(',');
    const _lastDotIndex = cleaned.lastIndexOf('.');

    if (hasBothCommaAndDot) {
      // Formato brasileiro: "10.000,50" ou "1.000.000,00"
      if (lastCommaIndex > lastDotIndex) {
        // Vírgula é decimal, pontos são separadores de milhar
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // Ponto é decimal, vírgulas são separadores de milhar (formato raro)
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',') && !cleaned.includes('.')) {
      // Apenas vírgula: assumir decimal brasileiro "1000,50"
      cleaned = cleaned.replace(',', '.');
    } else {
      // Apenas ponto ou sem separadores: formato internacional "1000.50" ou "1000"
      // Não remover pontos - manter como está
    }

    const _parsed = parseFloat(cleaned);

    if (_isNaN(parsed)) {
      throw new Error(`Valor inválido para conversão numérica: ${value}`);
    }

    return parsed;
  }
}

// Exportar instância singleton do serviço
export const _preApprovalService = new PreApprovalService();
