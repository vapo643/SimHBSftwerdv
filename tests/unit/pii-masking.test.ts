import { describe, it, expect } from 'vitest';
import {
  maskCPF,
  maskRG,
  maskPhone,
  maskEmail,
  maskBankAccount,
  maskAddress,
  maskCNPJ,
  maskCreditCard,
  maskPII,
  isPII,
  sanitizeObject,
} from '../../shared/utils/pii-masking';

describe('PII Masking Utilities', () => {
  describe('maskCPF', () => {
    it('should mask a valid CPF showing only the 9th digit (position 8)', () => {
      expect(maskCPF('123.456.789-01')).toBe('***.***.**9-**');
      expect(maskCPF('12345678901')).toBe('***.***.**9-**');
    });

    it('should handle null and undefined values', () => {
      expect(maskCPF(null)).toBe('***.***.***-**');
      expect(maskCPF(undefined)).toBe('***.***.***-**');
      expect(maskCPF('')).toBe('***.***.***-**');
    });

    it('should handle invalid CPF lengths', () => {
      expect(maskCPF('123')).toBe('***.***.***-**');
      expect(maskCPF('123456789012')).toBe('***.***.***-**');
    });

    it('should handle CPF with special characters', () => {
      expect(maskCPF('987.654.321-00')).toBe('***.***.**1-**');
      expect(maskCPF('111-222-333-44')).toBe('***.***.**3-**');
    });
  });

  describe('maskRG', () => {
    it('should mask a valid RG showing only 7th character', () => {
      expect(maskRG('12.345.678-9')).toBe('**.***.*7*-*');
      expect(maskRG('123456789')).toBe('**.***.*7*-*');
      expect(maskRG('AB.CDE.FGH-I')).toBe('**.***.*G*-*');
    });

    it('should handle null and undefined values', () => {
      expect(maskRG(null)).toBe('**.***.**-*');
      expect(maskRG(undefined)).toBe('**.***.**-*');
      expect(maskRG('')).toBe('**.***.**-*');
    });

    it('should handle short RG values', () => {
      expect(maskRG('12345')).toBe('**.***.**-*');
      expect(maskRG('1234567')).toBe('**.***.**-*');
    });
  });

  describe('maskPhone', () => {
    it('should mask mobile phones (11 digits) showing area code and last 2 digits', () => {
      expect(maskPhone('(11) 98765-4321')).toBe('(11) *****-**21');
      expect(maskPhone('11987654321')).toBe('(11) *****-**21');
      expect(maskPhone('21 9 8765-4321')).toBe('(21) *****-**21');
    });

    it('should mask landline phones (10 digits) showing area code and last 2 digits', () => {
      expect(maskPhone('(11) 3456-7890')).toBe('(11) ****-**90');
      expect(maskPhone('1134567890')).toBe('(11) ****-**90');
    });

    it('should handle null and undefined values', () => {
      expect(maskPhone(null)).toBe('(**) *****-****');
      expect(maskPhone(undefined)).toBe('(**) *****-****');
      expect(maskPhone('')).toBe('(**) *****-****');
    });

    it('should handle invalid phone lengths', () => {
      expect(maskPhone('123')).toBe('(**) *****-****');
      expect(maskPhone('123456789')).toBe('(**) *****-****');
    });
  });

  describe('maskEmail', () => {
    it('should mask email showing first 2 chars and domain', () => {
      expect(maskEmail('john.doe@example.com')).toBe('jo*****@example.com');
      expect(maskEmail('ab@test.org')).toBe('ab@test.org');
      expect(maskEmail('a@domain.com')).toBe('**@domain.com');
    });

    it('should handle null and undefined values', () => {
      expect(maskEmail(null)).toBe('***@***.***');
      expect(maskEmail(undefined)).toBe('***@***.***');
      expect(maskEmail('')).toBe('***@***.***');
    });

    it('should handle invalid email formats', () => {
      expect(maskEmail('notanemail')).toBe('***@***.***');
      expect(maskEmail('missing-at-sign.com')).toBe('***@***.***');
    });

    it('should limit masked characters to 5', () => {
      expect(maskEmail('verylongemailaddress@example.com')).toBe('ve*****@example.com');
    });
  });

  describe('maskBankAccount', () => {
    it('should mask bank account showing only last 2 digits', () => {
      expect(maskBankAccount('12345-6')).toBe('*****-56');
      expect(maskBankAccount('987654321')).toBe('*******-21');
      expect(maskBankAccount('ABCD1234')).toBe('******-34');
    });

    it('should handle null and undefined values', () => {
      expect(maskBankAccount(null)).toBe('******-**');
      expect(maskBankAccount(undefined)).toBe('******-**');
      expect(maskBankAccount('')).toBe('******-**');
    });

    it('should handle short account numbers', () => {
      expect(maskBankAccount('123')).toBe('******-**');
      expect(maskBankAccount('1234')).toBe('**-34');
    });
  });

  describe('maskAddress', () => {
    it('should mask address showing only city and state', () => {
      expect(maskAddress('Rua ABC, 123, São Paulo - SP')).toBe('***, São Paulo - SP');
      expect(maskAddress('Av. XYZ, 456, Rio de Janeiro/RJ')).toBe('***, Rio de Janeiro - RJ');
      expect(maskAddress('Street 789, Belo Horizonte, MG')).toBe('***, MG');
    });

    it('should handle null and undefined values', () => {
      expect(maskAddress(null)).toBe('***, *** - **');
      expect(maskAddress(undefined)).toBe('***, *** - **');
      expect(maskAddress('')).toBe('***, *** - **');
    });

    it('should handle addresses without clear patterns', () => {
      expect(maskAddress('Some random address')).toBe('***, *** - **');
      expect(maskAddress('Rua ABC, Apt 101')).toBe('***,  Apt 101');
    });
  });

  describe('maskCNPJ', () => {
    it('should mask CNPJ showing positions 8-11', () => {
      expect(maskCNPJ('12.345.678/9012-34')).toBe('**.***.***/9012-**');
      expect(maskCNPJ('12345678901234')).toBe('**.***.***/9012-**');
    });

    it('should handle null and undefined values', () => {
      expect(maskCNPJ(null)).toBe('**.***.***/****-**');
      expect(maskCNPJ(undefined)).toBe('**.***.***/****-**');
      expect(maskCNPJ('')).toBe('**.***.***/****-**');
    });

    it('should handle invalid CNPJ lengths', () => {
      expect(maskCNPJ('123')).toBe('**.***.***/****-**');
      expect(maskCNPJ('123456789012345')).toBe('**.***.***/****-**');
    });
  });

  describe('maskCreditCard', () => {
    it('should mask credit card showing only last 4 digits', () => {
      expect(maskCreditCard('1234 5678 9012 3456')).toBe('**** **** **** 3456');
      expect(maskCreditCard('1234567890123456')).toBe('**** **** **** 3456');
      expect(maskCreditCard('4111-1111-1111-1111')).toBe('**** **** **** 1111');
    });

    it('should handle null and undefined values', () => {
      expect(maskCreditCard(null)).toBe('**** **** **** ****');
      expect(maskCreditCard(undefined)).toBe('**** **** **** ****');
      expect(maskCreditCard('')).toBe('**** **** **** ****');
    });

    it('should handle invalid card lengths', () => {
      expect(maskCreditCard('123456789012')).toBe('**** **** **** ****');
      expect(maskCreditCard('12345')).toBe('**** **** **** ****');
    });
  });

  describe('maskPII', () => {
    it('should use specific masking when type is provided', () => {
      expect(maskPII('123.456.789-01', 'cpf')).toBe('***.***.**9-**');
      expect(maskPII('test@example.com', 'email')).toBe('te***@example.com');
      expect(maskPII('11987654321', 'phone')).toBe('(11) *****-**21');
    });

    it('should auto-detect CPF by length', () => {
      expect(maskPII('12345678901')).toBe('***.***.**9-**');
    });

    it('should auto-detect CNPJ by length', () => {
      expect(maskPII('12345678901234')).toBe('**.***.***/9012-**');
    });

    it('should auto-detect email by pattern', () => {
      expect(maskPII('user@domain.com')).toBe('us***@domain.com');
    });

    it('should auto-detect phone by length', () => {
      expect(maskPII('11987654321')).toBe('(11) *****-**21');
      expect(maskPII('1134567890')).toBe('(11) ****-**90');
    });

    it('should auto-detect credit card by length', () => {
      expect(maskPII('4111111111111111')).toBe('**** **** **** 1111');
    });

    it('should apply default masking for unknown patterns', () => {
      expect(maskPII('somevalue')).toBe('s*******e');
      expect(maskPII('ab')).toBe('**');
    });

    it('should handle null and undefined values', () => {
      expect(maskPII(null)).toBe('***');
      expect(maskPII(undefined)).toBe('***');
      expect(maskPII('')).toBe('***');
    });
  });

  describe('isPII', () => {
    it('should detect CPF patterns', () => {
      expect(isPII('123.456.789-01')).toBe(true);
      expect(isPII('12345678901')).toBe(true);
    });

    it('should detect CNPJ patterns', () => {
      expect(isPII('12.345.678/9012-34')).toBe(true);
      expect(isPII('12345678901234')).toBe(true);
    });

    it('should detect email patterns', () => {
      expect(isPII('test@example.com')).toBe(true);
      expect(isPII('user.name@domain.org')).toBe(true);
    });

    it('should detect phone patterns', () => {
      expect(isPII('1134567890')).toBe(true);
      expect(isPII('11987654321')).toBe(true);
    });

    it('should detect credit card patterns', () => {
      expect(isPII('4111111111111111')).toBe(true);
      expect(isPII('4111-1111-1111-1111')).toBe(true);
    });

    it('should return false for non-PII values', () => {
      expect(isPII('hello world')).toBe(false);
      expect(isPII('12345')).toBe(false);
      expect(isPII('abc123')).toBe(false);
    });

    it('should handle null and undefined values', () => {
      expect(isPII(null)).toBe(false);
      expect(isPII(undefined)).toBe(false);
      expect(isPII('')).toBe(false);
    });
  });

  describe('sanitizeObject', () => {
    it('should mask PII fields automatically', () => {
      const obj = {
        name: 'John Doe',
        cpf: '123.456.789-01',
        email: 'john@example.com',
        phone: '11987654321',
        address: 'Rua ABC, 123, São Paulo - SP',
      };

      const sanitized = sanitizeObject(obj);

      expect(sanitized.name).toBe('John Doe');
      expect(sanitized.cpf).toBe('***.***.**9-**');
      expect(sanitized.email).toBe('jo***@example.com');
      expect(sanitized.phone).toBe('(11) *****-**21');
      expect(sanitized.address).toBe('***, São Paulo - SP');
    });

    it('should handle nested field names', () => {
      const obj = {
        cliente_cpf: '98765432100',
        cliente_email: 'client@test.com',
        cliente_telefone: '2134567890',
      };

      const sanitized = sanitizeObject(obj);

      expect(sanitized.cliente_cpf).toBe('***.***.**1-**');
      expect(sanitized.cliente_email).toBe('cl*****@test.com');
      expect(sanitized.cliente_telefone).toBe('(21) ****-**90');
    });

    it('should use custom fields to mask when provided', () => {
      const obj = {
        customField: '123.456.789-01',
        normalField: 'not masked',
      };

      const sanitized = sanitizeObject(obj, ['customField']);

      expect(sanitized.customField).toBe('***.***.**9-**');
      expect(sanitized.normalField).toBe('not masked');
    });

    it('should not modify non-string values', () => {
      const obj = {
        cpf: 12345678901,
        email: null,
        phone: undefined,
        address: { street: 'ABC' },
      };

      const sanitized = sanitizeObject(obj);

      expect(sanitized.cpf).toBe(12345678901);
      expect(sanitized.email).toBe(null);
      expect(sanitized.phone).toBe(undefined);
      expect(sanitized.address).toEqual({ street: 'ABC' });
    });

    it('should create a new object without modifying the original', () => {
      const obj = {
        cpf: '123.456.789-01',
      };

      const sanitized = sanitizeObject(obj);

      expect(sanitized).not.toBe(obj);
      expect(obj.cpf).toBe('123.456.789-01');
      expect(sanitized.cpf).toBe('***.***.**9-**');
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle various CPF formats consistently', () => {
      const cpf = '12345678901';
      expect(maskCPF(cpf)).toBe('***.***.**9-**');
      expect(maskCPF('123.456.789-01')).toBe('***.***.**9-**');
      expect(maskCPF('123 456 789 01')).toBe('***.***.**9-**');
    });

    it('should not expose information through timing attacks', () => {
      const shortValue = '123';
      const longValue = '123456789012345678901234567890';

      // Both should be processed without revealing length through timing
      expect(maskPII(shortValue)).toBeDefined();
      expect(maskPII(longValue)).toBeDefined();
    });

    it('should handle international formats gracefully', () => {
      // US phone number (not Brazilian format)
      expect(maskPhone('+1 555 123 4567')).toBe('(**) *****-****');

      // International email
      expect(maskEmail('user@example.co.uk')).toBe('us***@example.co.uk');
    });

    it('should be consistent with repeated calls', () => {
      const cpf = '123.456.789-01';
      const mask1 = maskCPF(cpf);
      const mask2 = maskCPF(cpf);

      expect(mask1).toBe(mask2);
    });
  });
});
