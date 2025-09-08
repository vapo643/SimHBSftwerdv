/**
 * Value Objects - Unit Tests
 *
 * AUDITORIA FORENSE - PAM V1.2
 * Testa validação de domínio e business rules dos Value Objects
 */

import { describe, test, expect } from 'vitest';
import { CPF, CNPJ, Money, Email, PhoneNumber, CEP } from '../../shared/value-objects';

describe('Value Objects - Auditoria Forense', () => {
  describe('CPF Value Object', () => {
    test('PROVA VO #1: CPF válido deve ser aceito', () => {
      // CPFs válidos com dígitos verificadores corretos
      const validCPFs = ['11144477735', '111.444.777-35', '12345678909'];

      validCPFs.forEach((cpf) => {
        const cpfVO = CPF.create(cpf);
        expect(cpfVO).not.toBeNull();
        expect(cpfVO?.getValue()).toBe(cpf.replace(/\D/g, ''));
        console.log(`✅ CPF válido aceito: ${cpf} -> ${cpfVO?.getFormatted()}`);
      });
    });

    test('PROVA VO #2: CPF inválido deve ser rejeitado', () => {
      // CPFs inválidos
      const invalidCPFs = [
        '11111111111', // Todos os dígitos iguais
        '123456789', // Menos de 11 dígitos
        '12345678901', // Dígitos verificadores incorretos
        '000.000.000-00', // CPF inválido conhecido
        'abc.def.ghi-jk', // Não numérico
      ];

      invalidCPFs.forEach((cpf) => {
        const cpfVO = CPF.create(cpf);
        expect(cpfVO).toBeNull();
        console.log(`🔥 CPF inválido rejeitado: ${cpf}`);
      });
    });

    test('PROVA VO #3: Formatação do CPF', () => {
      const cpf = CPF.create('11144477735');
      expect(cpf?.getFormatted()).toBe('111.444.777-35');
      expect(cpf?.toString()).toBe('111.444.777-35');
    });
  });

  describe('CNPJ Value Object', () => {
    test('PROVA VO #4: CNPJ válido deve ser aceito', () => {
      // CNPJs válidos com dígitos verificadores corretos
      const validCNPJs = ['11222333000181', '11.222.333/0001-81'];

      validCNPJs.forEach((cnpj) => {
        const cnpjVO = CNPJ.create(cnpj);
        expect(cnpjVO).not.toBeNull();
        console.log(`✅ CNPJ válido aceito: ${cnpj} -> ${cnpjVO?.getFormatted()}`);
      });
    });

    test('PROVA VO #5: CNPJ inválido deve ser rejeitado', () => {
      const invalidCNPJs = [
        '11111111111111', // Todos os dígitos iguais
        '1122233300018', // Menos de 14 dígitos
        '11222333000182', // Dígito verificador incorreto
        '00.000.000/0000-00', // CNPJ conhecido como inválido
      ];

      invalidCNPJs.forEach((cnpj) => {
        const cnpjVO = CNPJ.create(cnpj);
        expect(cnpjVO).toBeNull();
        console.log(`🔥 CNPJ inválido rejeitado: ${cnpj}`);
      });
    });
  });

  describe('Money Value Object', () => {
    test('PROVA VO #6: Operações matemáticas precisas', () => {
      const valor1 = Money.fromReais(100.5);
      const valor2 = Money.fromReais(50.25);

      // Adição
      const soma = valor1.add(valor2);
      expect(soma.getReais()).toBe(150.75);

      // Subtração
      const subtracao = valor1.subtract(valor2);
      expect(subtracao.getReais()).toBe(50.25);

      // Multiplicação
      const multiplicacao = valor1.multiply(2);
      expect(multiplicacao.getReais()).toBe(201.0);

      // Divisão
      const divisao = valor1.divide(2);
      expect(divisao.getReais()).toBe(50.25);

      console.log('✅ Operações matemáticas precisas validadas');
    });

    test('PROVA VO #7: Formatação monetária brasileira', () => {
      const valor = Money.fromReais(1234.56);
      const formatted = valor.toFormattedString();

      // Deve estar no formato brasileiro
      expect(formatted).toContain('R$');
      expect(formatted).toContain('1.234,56');

      console.log(`✅ Formatação BR: ${formatted}`);
    });

    test('PROVA VO #8: Validação de valor negativo', () => {
      const valorNegativo = Money.fromString('-100');
      expect(valorNegativo).toBeNull();

      const valorZero = Money.zero();
      expect(valorZero.isZero()).toBe(true);
      expect(valorZero.getReais()).toBe(0);

      console.log('✅ Validação de valores negativos/zero');
    });

    test('PROVA VO #9: Parse de string no formato brasileiro', () => {
      const testCases = [
        { input: 'R$ 1.234,56', expected: 1234.56 },
        { input: '1.234,56', expected: 1234.56 },
        { input: '1234,56', expected: 1234.56 },
        { input: '1234.56', expected: 1234.56 }, // Formato americano também
      ];

      testCases.forEach(({ input, expected }) => {
        const money = Money.fromString(input);
        expect(money).not.toBeNull();
        expect(money?.getReais()).toBe(expected);
        console.log(`✅ Parse BR: "${input}" -> R$ ${expected}`);
      });
    });
  });

  describe('Email Value Object', () => {
    test('PROVA VO #10: Email válido e normalização', () => {
      const email = Email.create(' TEST@EXAMPLE.COM ');
      expect(email).not.toBeNull();
      expect(email?.getValue()).toBe('test@example.com');
      expect(email?.getDomain()).toBe('example.com');
      expect(email?.getLocalPart()).toBe('test');
    });

    test('PROVA VO #11: Email inválido rejeitado', () => {
      const invalidEmails = ['invalid-email', '@domain.com', 'user@', 'user..user@domain.com'];

      invalidEmails.forEach((email) => {
        const emailVO = Email.create(email);
        expect(emailVO).toBeNull();
      });
    });
  });

  describe('PhoneNumber Value Object', () => {
    test('PROVA VO #12: Telefone brasileiro válido', () => {
      const mobile = PhoneNumber.create('(11) 98765-4321');
      expect(mobile).not.toBeNull();
      expect(mobile?.isMobile()).toBe(true);
      expect(mobile?.getFormatted()).toBe('(11) 98765-4321');

      const landline = PhoneNumber.create('(11) 3456-7890');
      expect(landline).not.toBeNull();
      expect(landline?.isMobile()).toBe(false);
      expect(landline?.getFormatted()).toBe('(11) 3456-7890');
    });
  });

  describe('CEP Value Object', () => {
    test('PROVA VO #13: CEP brasileiro válido', () => {
      const cep = CEP.create('01310-100');
      expect(cep).not.toBeNull();
      expect(cep?.getValue()).toBe('01310100');
      expect(cep?.getFormatted()).toBe('01310-100');
    });

    test('PROVA VO #14: CEP inválido rejeitado', () => {
      const invalidCEPs = [
        '123', // Muito curto
        '123456789', // Muito longo
        'abcd-efgh', // Não numérico
      ];

      invalidCEPs.forEach((cep) => {
        const cepVO = CEP.create(cep);
        expect(cepVO).toBeNull();
      });
    });
  });
});
