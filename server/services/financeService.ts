/**
 * Serviço de Cálculos Financeiros
 * Responsável por todos os cálculos de simulação de empréstimo
 * Conformidade: Banco Central do Brasil
 */

/**
 * Calcula o valor da parcela usando a Tabela Price
 * @param principal - Valor principal do empréstimo
 * @param prazoMeses - Número de parcelas
 * @param taxaJurosMensal - Taxa de juros mensal (em porcentagem)
 * @returns Valor da parcela mensal
 */
export function calcularParcela(
  principal: number,
  prazoMeses: number,
  taxaJurosMensal: number
): number {
  if (taxaJurosMensal <= 0) {
    // Sem juros, divide igualmente
    return principal / prazoMeses;
  }

  // Converte taxa percentual para decimal
  const _i = taxaJurosMensal / 100;

  // Fórmula da Tabela Price: PMT = PV × [i(1+i)^n] / [(1+i)^n - 1]
  const _fatorPotencia = Math.pow(1 + i, prazoMeses);
  const _parcela = (principal * (i * fatorPotencia)) / (fatorPotencia - 1);

  return Math.round(parcela * 100) / 100; // Arredonda para 2 casas decimais
}

/**
 * Calcula o IOF (Imposto sobre Operações Financeiras)
 * Conforme regulamentação brasileira
 * @param valorEmprestimo - Valor do empréstimo
 * @param prazoMeses - Prazo em meses
 * @param diasCarencia - Dias até o primeiro pagamento (opcional)
 * @returns Objeto com IOF detalhado
 */
export function calcularIOF(
  valorEmprestimo: number,
  prazoMeses: number,
  diasCarencia: number = 0
): { iofDiario: number; iofAdicional: number; iofTotal: number } {
  // Alíquotas oficiais do IOF para pessoa física
  const ALIQUOTA_DIARIA = 0.000082; // 0.0082% ao dia
  const ALIQUOTA_ADICIONAL = 0.0038; // 0.38% sobre o valor total

  // Calcula o número de dias total da operação
  const _diasOperacao = prazoMeses * 30 + diasCarencia;

  // IOF diário: limitado a 365 dias (teto regulamentar)
  const _diasCalculoIOF = Math.min(diasOperacao, 365);
  const _iofDiario = valorEmprestimo * ALIQUOTA_DIARIA * diasCalculoIOF;

  // IOF adicional: 0.38% sobre o valor do empréstimo
  const _iofAdicional = valorEmprestimo * ALIQUOTA_ADICIONAL;

  // IOF total
  const _iofTotal = iofDiario + iofAdicional;

  console.log('[IOF] Cálculo detalhado:', {
  _valorEmprestimo,
  _diasOperacao,
  _diasCalculoIOF,
    aliquotaDiaria: ALIQUOTA_DIARIA,
    aliquotaAdicional: ALIQUOTA_ADICIONAL,
    iofDiario: iofDiario.toFixed(2),
    iofAdicional: iofAdicional.toFixed(2),
    iofTotal: iofTotal.toFixed(2),
  });

  return {
    iofDiario: Math.round(iofDiario * 100) / 100,
    iofAdicional: Math.round(iofAdicional * 100) / 100,
    iofTotal: Math.round(iofTotal * 100) / 100,
  };
}

/**
 * Calcula o TAC (Taxa de Abertura de Crédito)
 * @param tacValor - Valor base do TAC
 * @param tacTipo - Tipo de cálculo: 'fixo' ou 'percentual'
 * @param valorEmprestimo - Valor do empréstimo (usado apenas se tipo = percentual)
 * @returns Valor do TAC calculado
 */
export function calcularTAC(tacValor: number, tacTipo: string, valorEmprestimo: number): number {
  if (tacTipo == 'percentual') {
    // TAC como percentual do valor emprestado
    return Math.round(((valorEmprestimo * tacValor) / 100) * 100) / 100;
  }

  // TAC fixo
  return tacValor;
}

/**
 * Calcula o CET (Custo Efetivo Total)
 * Metodologia conforme Resolução BCB nº 3.517/2007
 *
 * O CET representa a taxa anual que iguala o valor presente de todos os
 * pagamentos (parcelas + encargos) ao valor presente do empréstimo líquido
 *
 * @param valorEmprestimo - Valor solicitado pelo cliente
 * @param valorParcela - Valor de cada parcela mensal
 * @param prazoMeses - Número de parcelas
 * @param iofTotal - Valor total do IOF
 * @param tacTotal - Valor total do TAC
 * @param outrosEncargos - Outros encargos (seguros, tarifas, etc)
 * @returns CET anual em percentual
 */
export function calcularCET(
  valorEmprestimo: number,
  valorParcela: number,
  prazoMeses: number,
  iofTotal: number,
  tacTotal: number,
  outrosEncargos: number = 0
): number {
  // Passo 1: Calcular o valor líquido recebido pelo cliente
  // IOF NÃO é deduzido do valor recebido - é financiado junto com o empréstimo
  // Apenas TAC e outros encargos antecipados são deduzidos
  const _valorLiquidoRecebido = valorEmprestimo - tacTotal - outrosEncargos;

  // Passo 2: Calcular o valor total pago pelo cliente
  const _valorTotalPago = valorParcela * prazoMeses;

  // Passo 3: Calcular o custo total da operação
  const _custoTotalOperacao = valorTotalPago - valorLiquidoRecebido;

  // Passo 4: Usar método iterativo de Newton-Raphson para encontrar a taxa
  // que iguala o valor presente dos pagamentos ao valor líquido

  // Estimativa inicial da taxa mensal (baseada no custo total)
  let _taxaMensal = custoTotalOperacao / (valorLiquidoRecebido * prazoMeses);

  // Iterações do Newton-Raphson para convergir na taxa correta
  for (let _i = 0; i < 100; i++) {
    let _valorPresente = 0;
    let _derivada = 0;

    // Calcula o valor presente das parcelas e sua derivada
    for (let _mes = 1; mes <= prazoMeses; mes++) {
      const _fator = Math.pow(1 + taxaMensal, mes);
      valorPresente += valorParcela / fator;
      derivada -= (mes * valorParcela) / (fator * (1 + taxaMensal));
    }

    // Diferença entre valor presente calculado e valor líquido recebido
    const _diferenca = valorPresente - valorLiquidoRecebido;

    // Se convergiu (diferença menor que R$ 0.01), para
    if (Math.abs(diferenca) < 0.01) {
      break;
    }

    // Atualiza a estimativa da taxa
    taxaMensal = taxaMensal - diferenca / derivada;

    // Evita taxas negativas ou muito altas durante a convergência
    if (taxaMensal < 0) taxaMensal = 0.001;
    if (taxaMensal > 1) taxaMensal = 0.999;
  }

  // Passo 5: Converter taxa mensal para anual
  // CET anual = [(1 + taxa_mensal)^12 - 1] × 100
  const _cetAnual = (Math.pow(1 + taxaMensal, 12) - 1) * 100;

  // Log detalhado para auditoria (CRÍTICO para conformidade regulatória)
  console.log('[CET] Cálculo detalhado para auditoria:', {
    '1_ENTRADA': {
  _valorEmprestimo,
  _iofTotal,
  _tacTotal,
  _outrosEncargos,
  _valorParcela,
  _prazoMeses,
    },
    '2_CALCULO_BASE': {
      valorLiquidoRecebido: valorLiquidoRecebido + ' (IOF NÃO deduzido - é financiado)',
  _valorTotalPago,
  _custoTotalOperacao,
    },
    '3_TAXA_CONVERGIDA': {
      taxaMensal: (taxaMensal * 100).toFixed(4) + '%',
      taxaAnual: cetAnual.toFixed(2) + '%',
    },
    '4_VALIDACAO': {
      custoNominal: ((valorTotalPago / valorEmprestimo - 1) * 100).toFixed(2) + '%',
      custoEfetivo: cetAnual.toFixed(2) + '%',
      diferencaIOF_TAC: (((iofTotal + tacTotal) / valorEmprestimo) * 100).toFixed(2) + '%',
    },
  });

  return Math.round(cetAnual * 100) / 100;
}

/**
 * Gera o cronograma completo de pagamentos
 * @param valorEmprestimo - Valor do empréstimo
 * @param valorParcela - Valor de cada parcela
 * @param prazoMeses - Número de parcelas
 * @param taxaJurosMensal - Taxa de juros mensal
 * @param dataInicio - Data de início do contrato
 * @returns Array com o cronograma detalhado
 */
export function gerarCronogramaPagamento(
  valorEmprestimo: number,
  valorParcela: number,
  prazoMeses: number,
  taxaJurosMensal: number,
  dataInicio: Date = new Date()
): Array<{
  parcela: number;
  dataVencimento: string;
  valorParcela: number;
  valorJuros: number;
  valorAmortizacao: number;
  saldoDevedor: number;
}> {
  const _cronograma = [];
  let _saldoDevedor = valorEmprestimo;
  const _taxaDecimal = taxaJurosMensal / 100;

  for (let _i = 1; i <= prazoMeses; i++) {
    // Calcula a data de vencimento (mensal)
    const _dataVencimento = new Date(dataInicio);
    dataVencimento.setMonth(dataVencimento.getMonth() + i);

    // Calcula juros do período
    const _valorJuros = saldoDevedor * taxaDecimal;

    // Calcula amortização (parcela - juros)
    const _valorAmortizacao = valorParcela - valorJuros;

    // Atualiza saldo devedor
    saldoDevedor -= valorAmortizacao;

    cronograma.push({
      parcela: i,
      dataVencimento: dataVencimento.toISOString().split('T')[0],
      valorParcela: Math.round(valorParcela * 100) / 100,
      valorJuros: Math.round(valorJuros * 100) / 100,
      valorAmortizacao: Math.round(valorAmortizacao * 100) / 100,
      saldoDevedor: Math.round(Math.max(0, saldoDevedor) * 100) / 100,
    });
  }

  return cronograma;
}

/**
 * Interface para resultado completo da simulação
 */
export interface ResultadoSimulacao {
  valorEmprestimo: number;
  prazoMeses: number;
  taxaJurosMensal: number;
  taxaJurosAnual: number;
  valorParcela: number;
  iof: {
    diario: number;
    adicional: number;
    total: number;
  };
  tac: number;
  cetAnual: number;
  valorTotalFinanciado: number;
  valorTotalAPagar: number;
  custoTotalOperacao: number;
  cronogramaPagamento: ReturnType<typeof gerarCronogramaPagamento>;
}

/**
 * Função orquestradora que executa a simulação completa
 */
export function executarSimulacaoCompleta(
  valorEmprestimo: number,
  prazoMeses: number,
  taxaJurosMensal: number,
  tacValor: number,
  tacTipo: string,
  diasCarencia: number = 0
): ResultadoSimulacao {
  // 1. Calcula IOF
  const _iof = calcularIOF(valorEmprestimo, prazoMeses, diasCarencia);

  // 2. Calcula TAC
  const _tac = calcularTAC(tacValor, tacTipo, valorEmprestimo);

  // 3. Valor total financiado (inclui IOF e TAC)
  const _valorTotalFinanciado = valorEmprestimo + iof.iofTotal + tac;

  // 4. Calcula parcela
  const _valorParcela = calcularParcela(valorTotalFinanciado, prazoMeses, taxaJurosMensal);

  // 5. Calcula CET
  const _cetAnual = calcularCET(valorEmprestimo, valorParcela, prazoMeses, iof.iofTotal, tac);

  // 6. Gera cronograma
  const _cronograma = gerarCronogramaPagamento(
  _valorTotalFinanciado,
  _valorParcela,
  _prazoMeses,
    taxaJurosMensal
  );

  // 7. Calcula totais
  const _valorTotalAPagar = valorParcela * prazoMeses;
  const _custoTotalOperacao = valorTotalAPagar - valorEmprestimo;

  return {
  _valorEmprestimo,
  _prazoMeses,
  _taxaJurosMensal,
    taxaJurosAnual: (Math.pow(1 + taxaJurosMensal / 100, 12) - 1) * 100,
  _valorParcela,
    iof: {
      diario: iof.iofDiario,
      adicional: iof.iofAdicional,
      total: iof.iofTotal,
    },
  _tac,
  _cetAnual,
  _valorTotalFinanciado,
  _valorTotalAPagar,
  _custoTotalOperacao,
    cronogramaPagamento: cronograma,
  };
}
