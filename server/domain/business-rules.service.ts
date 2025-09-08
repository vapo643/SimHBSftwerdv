/**
 * Business Rules Domain Service - Sprint 2
 *
 * Centralizes all business logic validation and enforcement
 * Implements domain-specific rules and constraints
 *
 * Date: 2025-08-28
 * Author: GEM-07 AI Specialist System
 */

import { Money, CPF, CNPJ, PhoneNumber, Email } from '@shared/value-objects';
import type { Proposta, Produto, TabelaComercial } from '@shared/schema';

/**
 * Validation Result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Business Rules Domain Service
 * Implements complex validation logic and business constraints
 */
export class BusinessRulesService {
  /**
   * Validate complete proposal data against all business rules
   */
  validateProposal(
    proposalData: any,
    produto: Produto,
    tabelaComercial: TabelaComercial
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Client data validation
    const clientValidation = this.validateClientData(proposalData.cliente_data);
    errors.push(...clientValidation.errors);
    warnings.push(...clientValidation.warnings);

    // 2. Financial conditions validation
    const conditionsValidation = this.validateFinancialConditions(
      proposalData.condicoes_data,
      produto,
      tabelaComercial
    );
    errors.push(...conditionsValidation.errors);
    warnings.push(...conditionsValidation.warnings);

    // 3. Product-specific rules
    const productValidation = this.validateProductSpecificRules(proposalData, produto);
    errors.push(...productValidation.errors);
    warnings.push(...productValidation.warnings);

    // 4. Cross-field validations
    const crossValidation = this.validateCrossFieldRules(proposalData, produto);
    errors.push(...crossValidation.errors);
    warnings.push(...crossValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate client personal data
   */
  private validateClientData(clienteData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!clienteData) {
      errors.push('Dados do cliente são obrigatórios');
      return { valid: false, errors, warnings };
    }

    // Required fields validation
    if (!clienteData.nome || clienteData.nome.trim().length < 2) {
      errors.push('Nome completo é obrigatório (mínimo 2 caracteres)');
    }

    if (!clienteData.cpf) {
      errors.push('CPF é obrigatório');
    } else {
      const cpf = CPF.create(clienteData.cpf);
      if (!cpf) {
        errors.push('CPF inválido');
      }
    }

    if (!clienteData.email) {
      warnings.push('Email não informado - comunicação limitada');
    } else {
      const email = Email.create(clienteData.email);
      if (!email) {
        errors.push('Email inválido');
      }
    }

    if (!clienteData.telefone) {
      warnings.push('Telefone não informado - contato limitado');
    } else {
      const telefone = PhoneNumber.create(clienteData.telefone);
      if (!telefone) {
        errors.push('Número de telefone inválido');
      }
    }

    // Age validation (if birth date provided)
    if (clienteData.dataNascimento) {
      const idade = this.calculateAge(new Date(clienteData.dataNascimento));
      if (idade < 18) {
        errors.push('Cliente deve ser maior de idade (18 anos)');
      } else if (idade > 80) {
        warnings.push('Cliente com idade avançada - avaliar capacidade de pagamento');
      }
    }

    // Income validation
    if (clienteData.rendaMensal) {
      const renda = Money.fromReais(clienteData.rendaMensal);
      if (!renda || renda.lessThan(Money.fromReais(1320))) {
        // Current minimum wage
        warnings.push('Renda inferior ao salário mínimo - avaliar fonte de renda');
      }
    }

    // Address validation
    if (!clienteData.endereco || !clienteData.endereco.cep) {
      warnings.push('Endereço completo não informado');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate financial conditions
   */
  private validateFinancialConditions(
    condicoesData: any,
    produto: Produto,
    tabelaComercial: TabelaComercial
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!condicoesData) {
      errors.push('Condições financeiras são obrigatórias');
      return { valid: false, errors, warnings };
    }

    // Amount validation
    if (!condicoesData.valor || condicoesData.valor <= 0) {
      errors.push('Valor solicitado deve ser maior que zero');
    } else {
      const valor = Money.fromReais(condicoesData.valor);

      // Simplified product limits based on available schema
      const valorReais = valor.getReais();

      // Basic limits (configurable via environment or future schema enhancement)
      const VALOR_MINIMO = 1000;
      const VALOR_MAXIMO = 500000;

      if (valorReais < VALOR_MINIMO) {
        errors.push(`Valor mínimo: ${Money.fromReais(VALOR_MINIMO).toFormattedString()}`);
      }

      if (valorReais > VALOR_MAXIMO) {
        errors.push(`Valor máximo: ${Money.fromReais(VALOR_MAXIMO).toFormattedString()}`);
      }
    }

    // Term validation
    if (!condicoesData.prazo || condicoesData.prazo <= 0) {
      errors.push('Prazo deve ser maior que zero');
    } else {
      const prazo = condicoesData.prazo;

      // Simplified term limits based on available schema
      const PRAZO_MINIMO = 6;
      const PRAZO_MAXIMO = 84;

      if (prazo < PRAZO_MINIMO) {
        errors.push(`Prazo mínimo: ${PRAZO_MINIMO} meses`);
      }

      if (prazo > PRAZO_MAXIMO) {
        errors.push(`Prazo máximo: ${PRAZO_MAXIMO} meses`);
      }

      // Use existing prazos array from commercial table
      if (tabelaComercial.prazos && tabelaComercial.prazos.length > 0) {
        if (!tabelaComercial.prazos.includes(prazo)) {
          warnings.push(
            `Prazo ${prazo} não está disponível na tabela comercial. Prazos disponíveis: ${tabelaComercial.prazos.join(', ')}`
          );
        }
      }
    }

    // Interest rate validation
    if (condicoesData.taxaJuros !== undefined) {
      const taxa = condicoesData.taxaJuros;

      if (taxa < 0) {
        errors.push('Taxa de juros não pode ser negativa');
      }

      // Compare with commercial table base rate
      const taxaBaseComercial = parseFloat(tabelaComercial.taxaJuros);
      if (taxa < taxaBaseComercial * 0.5) {
        warnings.push(`Taxa muito baixa comparada à tabela comercial (${taxaBaseComercial}%)`);
      }

      if (taxa > taxaBaseComercial * 2.5) {
        warnings.push(`Taxa muito alta comparada à tabela comercial (${taxaBaseComercial}%)`);
      }

      // Warning for high rates
      if (taxa > 60) {
        warnings.push('Taxa de juros acima de 60% a.a. - verificar se está correta');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate product-specific business rules
   */
  private validateProductSpecificRules(proposalData: any, produto: Produto): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Simplified product-specific rules based on product name
    const nomeProduto = produto.nomeProduto.toLowerCase();

    if (nomeProduto.includes('pessoal')) {
      this.validateEmprestimoPessoalRules(proposalData, errors, warnings);
    } else if (nomeProduto.includes('rotativo') || nomeProduto.includes('cartao')) {
      this.validateCreditoRotativoRules(proposalData, errors, warnings);
    } else if (nomeProduto.includes('veiculo') || nomeProduto.includes('financiamento')) {
      this.validateFinanciamentoVeiculoRules(proposalData, errors, warnings);
    } else if (nomeProduto.includes('garantia') || nomeProduto.includes('garantido')) {
      this.validateEmprestimoGarantiaRules(proposalData, errors, warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate cross-field business rules
   */
  private validateCrossFieldRules(proposalData: any, produto: Produto): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const clienteData = proposalData.cliente_data;
    const condicoesData = proposalData.condicoes_data;

    if (!clienteData || !condicoesData) {
      return { valid: true, errors, warnings }; // Already validated above
    }

    // Income vs Amount ratio
    if (clienteData.rendaMensal && condicoesData.valor) {
      const renda = Money.fromReais(clienteData.rendaMensal);
      const valor = Money.fromReais(condicoesData.valor);
      const prazo = condicoesData.prazo || 12;

      // Estimate monthly payment (simplified)
      const prestacaoEstimada = valor.divide(prazo);
      const comprometimentoRenda = prestacaoEstimada.getReais() / renda.getReais();

      const comprometimentoPct = comprometimentoRenda;
      if (comprometimentoPct > 0.5) {
        // > 50% of income
        warnings.push('Comprometimento de renda acima de 50% - avaliar capacidade de pagamento');
      } else if (comprometimentoPct > 0.3) {
        // > 30% of income
        warnings.push('Comprometimento de renda acima de 30% - atenção especial na análise');
      }
    }

    // Age vs Term relationship
    if (clienteData.dataNascimento && condicoesData.prazo) {
      const idade = this.calculateAge(new Date(clienteData.dataNascimento));
      const idadeFinalContrato = idade + Math.ceil(condicoesData.prazo / 12);

      if (idadeFinalContrato > 75) {
        warnings.push(
          'Cliente terá mais de 75 anos ao final do contrato - avaliar capacidade futura'
        );
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Product-specific validation methods
   */
  private validateEmprestimoPessoalRules(
    proposalData: any,
    errors: string[],
    warnings: string[]
  ): void {
    const condicoesData = proposalData.condicoes_data;

    if (condicoesData?.prazo > 60) {
      warnings.push('Prazo longo para empréstimo pessoal - avaliar necessidade');
    }
  }

  private validateCreditoRotativoRules(
    proposalData: any,
    errors: string[],
    warnings: string[]
  ): void {
    const condicoesData = proposalData.condicoes_data;

    if (condicoesData?.prazo > 12) {
      errors.push('Crédito rotativo não pode ter prazo superior a 12 meses');
    }
  }

  private validateFinanciamentoVeiculoRules(
    proposalData: any,
    errors: string[],
    warnings: string[]
  ): void {
    const veiculoData = proposalData.veiculo_data;

    if (!veiculoData) {
      errors.push('Dados do veículo são obrigatórios para financiamento');
      return;
    }

    if (!veiculoData.chassi) {
      errors.push('Número do chassi é obrigatório');
    }

    if (veiculoData.anoFabricacao) {
      const anoAtual = new Date().getFullYear();
      const idadeVeiculo = anoAtual - veiculoData.anoFabricacao;

      if (idadeVeiculo > 10) {
        warnings.push('Veículo com mais de 10 anos - avaliar depreciação');
      }
    }
  }

  private validateEmprestimoGarantiaRules(
    proposalData: any,
    errors: string[],
    warnings: string[]
  ): void {
    const garantiaData = proposalData.garantia_data;

    if (!garantiaData) {
      errors.push('Dados da garantia são obrigatórios');
      return;
    }

    if (!garantiaData.tipo) {
      errors.push('Tipo de garantia deve ser especificado');
    }

    if (garantiaData.tipo === 'IMOVEL' && !garantiaData.matriculaImovel) {
      errors.push('Matrícula do imóvel é obrigatória para garantia imobiliária');
    }
  }

  /**
   * Utility methods
   */
  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Validate status transition according to business rules
   */
  validateStatusTransition(
    currentStatus: string,
    newStatus: string,
    userRole: string,
    proposalData?: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Define allowed transitions by current status
    const allowedTransitions: Record<string, string[]> = {
      RASCUNHO: ['EM_ANALISE', 'CANCELADA'],
      EM_ANALISE: ['APROVADA', 'NEGADA', 'PENDENTE_DOCUMENTOS', 'CANCELADA'],
      PENDENTE_DOCUMENTOS: ['EM_ANALISE', 'CANCELADA'],
      APROVADA: ['FORMALIZADA', 'CANCELADA'],
      NEGADA: ['EM_ANALISE'], // Only if new information
      FORMALIZADA: ['ATIVA', 'CANCELADA'],
      ATIVA: ['QUITADA', 'INADIMPLENTE'],
      INADIMPLENTE: ['ATIVA', 'QUITADA'],
      QUITADA: [], // Final status
      CANCELADA: [], // Final status
    };

    // Check if transition is allowed
    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      errors.push(`Transição de ${currentStatus} para ${newStatus} não é permitida`);
    }

    // Role-based restrictions
    const restrictedTransitions: Record<string, string[]> = {
      GERENTE: ['APROVADA', 'NEGADA'],
      DIRETOR: ['APROVADA', 'NEGADA', 'FORMALIZADA'],
      OPERADOR: ['EM_ANALISE', 'PENDENTE_DOCUMENTOS'],
    };

    if (restrictedTransitions[userRole] && !restrictedTransitions[userRole].includes(newStatus)) {
      errors.push(`Usuário ${userRole} não tem permissão para alterar status para ${newStatus}`);
    }

    // Business-specific transition rules
    if (newStatus === 'APROVADA' && proposalData) {
      // Additional validations for approval
      if (!proposalData.scoreCredito || proposalData.scoreCredito < 400) {
        warnings.push('Score de crédito baixo para aprovação - revisar análise');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}

// Export singleton instance
export const businessRulesService = new BusinessRulesService();
