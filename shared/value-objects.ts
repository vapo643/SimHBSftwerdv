/**
 * Domain Value Objects - Sprint 2 Data Layer Enhancement
 *
 * Implements Domain-Driven Design value objects for business rules validation
 * Provides type-safe validation for critical business data
 *
 * Date: 2025-08-28
 * Author: GEM-07 AI Specialist System
 */

import { z } from 'zod';

/**
 * CPF Value Object with comprehensive validation
 * Implements Brazilian tax ID validation rules
 */
export class CPF {
  private constructor(private readonly value: string) {}

  static create(cpf: string): CPF | null {
    const cleaned = cpf.replace(/\D/g, '');

    if (!CPF.isValid(cleaned)) {
      return null;
    }

    return new CPF(cleaned);
  }

  static isValid(cpf: string): boolean {
    const cleaned = cpf.replace(/\D/g, '');

    // Basic length and format validation
    if (cleaned.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleaned)) return false; // All same digits

    // Calculate check digits
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    let checkDigit1 = remainder === 10 ? 0 : remainder;

    if (checkDigit1 !== parseInt(cleaned.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    let checkDigit2 = remainder === 10 ? 0 : remainder;

    return checkDigit2 === parseInt(cleaned.charAt(10));
  }

  getValue(): string {
    return this.value;
  }

  getFormatted(): string {
    const cpf = this.value;
    return `${cpf.substring(0, 3)}.${cpf.substring(3, 6)}.${cpf.substring(6, 9)}-${cpf.substring(9, 11)}`;
  }

  equals(other: CPF): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.getFormatted();
  }

  // Zod schema for form validation
  static readonly schema = z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine(CPF.isValid, { message: 'CPF inválido' });
}

/**
 * CNPJ Value Object with business validation
 * Implements Brazilian company ID validation rules
 */
export class CNPJ {
  private constructor(private readonly value: string) {}

  static create(cnpj: string): CNPJ | null {
    const cleaned = cnpj.replace(/\D/g, '');

    if (!CNPJ.isValid(cleaned)) {
      return null;
    }

    return new CNPJ(cleaned);
  }

  static isValid(cnpj: string): boolean {
    const cleaned = cnpj.replace(/\D/g, '');

    if (cleaned.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cleaned)) return false; // All same digits

    // Calculate first check digit
    let sum = 0;
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleaned.charAt(i)) * weights1[i];
    }
    let remainder = sum % 11;
    let checkDigit1 = remainder < 2 ? 0 : 11 - remainder;

    if (checkDigit1 !== parseInt(cleaned.charAt(12))) return false;

    // Calculate second check digit
    sum = 0;
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cleaned.charAt(i)) * weights2[i];
    }
    remainder = sum % 11;
    let checkDigit2 = remainder < 2 ? 0 : 11 - remainder;

    return checkDigit2 === parseInt(cleaned.charAt(13));
  }

  getValue(): string {
    return this.value;
  }

  getFormatted(): string {
    const cnpj = this.value;
    return `${cnpj.substring(0, 2)}.${cnpj.substring(2, 5)}.${cnpj.substring(5, 8)}/${cnpj.substring(8, 12)}-${cnpj.substring(12, 14)}`;
  }

  equals(other: CNPJ): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.getFormatted();
  }

  // Zod schema for form validation
  static readonly schema = z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine(CNPJ.isValid, { message: 'CNPJ inválido' });
}

/**
 * Money Value Object for financial calculations
 * Implements precision and business rules for currency
 */
export class Money {
  private readonly cents: number;

  private constructor(cents: number) {
    this.cents = Math.round(cents);
  }

  static fromReais(reais: number): Money {
    return new Money(reais * 100);
  }

  static fromCents(cents: number): Money {
    return new Money(cents);
  }

  static fromString(value: string): Money | null {
    // Handle Brazilian format: "1.234,56" or "R$ 1.234,56"
    const cleaned = value
      .replace(/[R$\s]/g, '') // Remove R$ and spaces
      .trim();

    let normalizedValue: string;

    // Check if it has both . and , (Brazilian format with thousands)
    if (cleaned.includes('.') && cleaned.includes(',')) {
      // Format: 1.234,56 -> remove dots, replace comma with dot
      normalizedValue = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      // Format: 1234,56 -> replace comma with dot
      normalizedValue = cleaned.replace(',', '.');
    } else {
      // Format: 1234.56 or 1234 -> use as is
      normalizedValue = cleaned;
    }

    const parsed = parseFloat(normalizedValue);
    if (isNaN(parsed) || parsed < 0) {
      return null;
    }

    return Money.fromReais(parsed);
  }

  static zero(): Money {
    return new Money(0);
  }

  getCents(): number {
    return this.cents;
  }

  getReais(): number {
    return this.cents / 100;
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  multiply(factor: number): Money {
    return new Money(this.cents * factor);
  }

  divide(divisor: number): Money {
    if (divisor === 0) throw new Error('Division by zero');
    return new Money(this.cents / divisor);
  }

  percentage(percent: number): Money {
    return new Money(this.cents * (percent / 100));
  }

  isPositive(): boolean {
    return this.cents > 0;
  }

  isNegative(): boolean {
    return this.cents < 0;
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  greaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }

  lessThan(other: Money): boolean {
    return this.cents < other.cents;
  }

  // Brazilian currency formatting
  toFormattedString(): string {
    const reais = this.getReais();
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(reais);
  }

  toString(): string {
    return this.toFormattedString();
  }

  // Zod schema for form validation
  static readonly schema = z.union([
    z.number().min(0, 'Valor deve ser positivo'),
    z.string().transform((val) => {
      const money = Money.fromString(val);
      if (!money) throw new Error('Formato de valor monetário inválido');
      return money.getReais();
    }),
  ]);
}

/**
 * Email Value Object with comprehensive validation
 */
export class Email {
  private constructor(private readonly value: string) {}

  static create(email: string): Email | null {
    const normalized = email.toLowerCase().trim();
    if (!Email.isValid(normalized)) {
      return null;
    }
    return new Email(normalized);
  }

  static isValid(email: string): boolean {
    // More comprehensive email validation
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!emailRegex.test(email) || email.length > 254) {
      return false;
    }

    // Additional checks for edge cases
    if (email.includes('..')) return false; // Consecutive dots
    if (email.startsWith('.') || email.endsWith('.')) return false; // Starts or ends with dot

    return true;
  }

  getValue(): string {
    return this.value;
  }

  getDomain(): string {
    return this.value.split('@')[1];
  }

  getLocalPart(): string {
    return this.value.split('@')[0];
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  // Zod schema for form validation
  static readonly schema = z
    .string()
    .email('Email inválido')
    .max(254, 'Email muito longo')
    .transform((val) => val.toLowerCase().trim());
}

/**
 * Phone Number Value Object for Brazilian phones
 */
export class PhoneNumber {
  private constructor(private readonly value: string) {}

  static create(phone: string): PhoneNumber | null {
    const cleaned = phone.replace(/\D/g, '');

    if (!PhoneNumber.isValid(cleaned)) {
      return null;
    }

    return new PhoneNumber(cleaned);
  }

  static isValid(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '');

    // Brazilian phone validation: (XX) 9XXXX-XXXX or (XX) XXXX-XXXX
    if (cleaned.length === 11) {
      // Mobile: starts with 9 after area code
      return /^[1-9]{2}9[0-9]{8}$/.test(cleaned);
    } else if (cleaned.length === 10) {
      // Landline
      return /^[1-9]{2}[2-9][0-9]{7}$/.test(cleaned);
    }

    return false;
  }

  getValue(): string {
    return this.value;
  }

  getFormatted(): string {
    const phone = this.value;
    if (phone.length === 11) {
      return `(${phone.substring(0, 2)}) ${phone.substring(2, 7)}-${phone.substring(7)}`;
    } else {
      return `(${phone.substring(0, 2)}) ${phone.substring(2, 6)}-${phone.substring(6)}`;
    }
  }

  isMobile(): boolean {
    return this.value.length === 11;
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.getFormatted();
  }

  // Zod schema for form validation
  static readonly schema = z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine(PhoneNumber.isValid, { message: 'Número de telefone inválido' });
}

/**
 * CEP (Brazilian postal code) Value Object
 */
export class CEP {
  private constructor(private readonly value: string) {}

  static create(cep: string): CEP | null {
    const cleaned = cep.replace(/\D/g, '');

    if (!CEP.isValid(cleaned)) {
      return null;
    }

    return new CEP(cleaned);
  }

  static isValid(cep: string): boolean {
    const cleaned = cep.replace(/\D/g, '');
    return /^[0-9]{8}$/.test(cleaned);
  }

  getValue(): string {
    return this.value;
  }

  getFormatted(): string {
    return `${this.value.substring(0, 5)}-${this.value.substring(5)}`;
  }

  equals(other: CEP): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.getFormatted();
  }

  // Zod schema for form validation
  static readonly schema = z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine(CEP.isValid, { message: 'CEP inválido' })
    .transform((val) => new CEP(val));
}

// Export all value objects and their schemas for use in forms and validation
export const ValueObjectSchemas = {
  cpf: CPF.schema,
  cnpj: CNPJ.schema,
  money: Money.schema,
  email: Email.schema,
  phone: PhoneNumber.schema,
  cep: CEP.schema,
} as const;
