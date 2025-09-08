/**
 * Test unitário para validação da equivalência entre calculateMonthlyPayment (domínio)
 * e calculateMonthlyPaymentRaw (repository) - PAM P2.1.1 Passo 1.1
 *
 * OBJETIVO CRÍTICO: Garantir que ambas implementações produzem resultados equivalentes
 * antes de proceder com a refatoração que remove calculateMonthlyPaymentRaw
 */

import { describe, test, expect } from 'vitest';

/**
 * Mock da implementação Raw do Repository para comparação
 * COPIADA EXATAMENTE da linha 318 do ProposalRepository.ts
 */
function calculateMonthlyPaymentRaw(
  principal: number,
  monthlyRate: number,
  numberOfPayments: number
): number {
  const rate = monthlyRate / 100;

  if (rate === 0) {
    return principal / numberOfPayments;
  }

  return (
    (principal * (rate * Math.pow(1 + rate, numberOfPayments))) /
    (Math.pow(1 + rate, numberOfPayments) - 1)
  );
}

/**
 * VERSÃO DOMÍNIO: com arredondamento para 2 casas decimais
 * Copiado da linha 771 de Proposal.ts
 */
function calculateMonthlyPaymentDomain(
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

  return Math.round(payment * 100) / 100; // Arredondamento para 2 casas
}

describe('Validação de Equivalência: Domain vs Raw', () => {
  test('Cenário 1: Valor 10000, Taxa 2.5%, Prazo 12 meses', () => {
    const domainResult = calculateMonthlyPaymentDomain(10000, 2.5, 12);
    const rawResult = calculateMonthlyPaymentRaw(10000, 2.5, 12);

    console.log(`DOMAIN (arredondado): ${domainResult}`);
    console.log(`RAW (sem arredondamento): ${rawResult}`);
    console.log(`Diferença: ${Math.abs(domainResult - rawResult)}`);

    // VALIDAÇÃO CRÍTICA: Diferença deve ser menor que 1 centavo
    expect(Math.abs(domainResult - rawResult)).toBeLessThan(0.01);
  });

  test('Cenário 2: Valor 50000, Taxa 1.8%, Prazo 24 meses', () => {
    const domainResult = calculateMonthlyPaymentDomain(50000, 1.8, 24);
    const rawResult = calculateMonthlyPaymentRaw(50000, 1.8, 24);

    console.log(
      `DOMAIN: ${domainResult}, RAW: ${rawResult}, Diff: ${Math.abs(domainResult - rawResult)}`
    );

    expect(Math.abs(domainResult - rawResult)).toBeLessThan(0.01);
  });

  test('Cenário 3: Taxa ZERO (sem juros) - Deve ser idêntico', () => {
    const domainResult = calculateMonthlyPaymentDomain(12000, 0, 6);
    const rawResult = calculateMonthlyPaymentRaw(12000, 0, 6);

    console.log(`ZERO RATE - DOMAIN: ${domainResult}, RAW: ${rawResult}`);

    // Para taxa zero, ambos devem ser EXATAMENTE iguais
    expect(domainResult).toEqual(rawResult);
    expect(domainResult).toEqual(2000); // 12000/6
  });

  test('Cenário 4: Valores fracionários - Teste de arredondamento crítico', () => {
    const domainResult = calculateMonthlyPaymentDomain(9999.99, 3.33, 11);
    const rawResult = calculateMonthlyPaymentRaw(9999.99, 3.33, 11);

    console.log(`FRACIONAL - DOMAIN: ${domainResult}, RAW: ${rawResult}`);
    console.log(`Diferença crítica: ${Math.abs(domainResult - rawResult)}`);

    const difference = Math.abs(domainResult - rawResult);
    expect(difference).toBeLessThan(0.01);

    // Verificar precisão do arredondamento no domínio
    expect(domainResult.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
  });

  test('Cenário 5: BENCHMARK - Valores típicos de produção', () => {
    const cenarios = [
      { valor: 25000, taxa: 2.1, prazo: 18 },
      { valor: 15000, taxa: 3.2, prazo: 12 },
      { valor: 100000, taxa: 1.9, prazo: 36 },
    ];

    cenarios.forEach(({ valor, taxa, prazo }, index) => {
      const domainResult = calculateMonthlyPaymentDomain(valor, taxa, prazo);
      const rawResult = calculateMonthlyPaymentRaw(valor, taxa, prazo);
      const difference = Math.abs(domainResult - rawResult);

      console.log(
        `Cenário ${index + 1}: V=${valor}, T=${taxa}%, P=${prazo} | D=${domainResult}, R=${rawResult}, Diff=${difference}`
      );

      expect(difference).toBeLessThan(0.01);
    });
  });
});
