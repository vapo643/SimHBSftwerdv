import { describe, it, expect } from 'vitest';
import { maskCPF, maskEmail, maskRG, maskTelefone } from '../../server/utils/masking';

describe('Masking Utilities - PII Data Protection', () => {
  describe('maskCPF', () => {
    it('should mask CPF keeping middle 6 digits', () => {
      expect(maskCPF('123.456.789-00')).toBe('***.456.789-**');
      expect(maskCPF('987.654.321-99')).toBe('***.654.321-**');
      expect(maskCPF('111.222.333-44')).toBe('***.222.333-**');
    });

    it('should handle CPF without formatting', () => {
      expect(maskCPF('12345678900')).toBe('***.456.789-**');
      expect(maskCPF('98765432199')).toBe('***.654.321-**');
    });

    it('should handle CPF with different formatting', () => {
      expect(maskCPF('123456789-00')).toBe('***.456.789-**');
      expect(maskCPF('123.456.78900')).toBe('***.456.789-**');
    });

    it('should return empty string for invalid CPF', () => {
      expect(maskCPF('')).toBe('');
      expect(maskCPF('123')).toBe('');
      expect(maskCPF('invalid')).toBe('');
    });

    it('should handle null and undefined gracefully', () => {
      expect(maskCPF(null as any)).toBe('');
      expect(maskCPF(undefined as any)).toBe('');
    });
  });

  describe('maskEmail', () => {
    it('should mask email keeping first char, domain first char and extension', () => {
      expect(maskEmail('exemplo@dominio.com')).toBe('e***@d***.com');
      expect(maskEmail('joao.silva@empresa.com.br')).toBe('j***@e***.com.br');
      expect(maskEmail('maria@gmail.com')).toBe('m***@g***.com');
    });

    it('should handle short email addresses', () => {
      expect(maskEmail('a@b.c')).toBe('a***@b***.c');
      expect(maskEmail('ab@cd.ef')).toBe('a***@c***.ef');
    });

    it('should handle emails with special characters', () => {
      expect(maskEmail('user+tag@domain.org')).toBe('u***@d***.org');
      expect(maskEmail('first.last@sub.domain.com')).toBe('f***@s***.domain.com');
    });

    it('should return empty string for invalid email', () => {
      expect(maskEmail('')).toBe('');
      expect(maskEmail('not-an-email')).toBe('');
      expect(maskEmail('@domain.com')).toBe('');
      expect(maskEmail('user@')).toBe('');
    });

    it('should handle null and undefined gracefully', () => {
      expect(maskEmail(null as any)).toBe('');
      expect(maskEmail(undefined as any)).toBe('');
    });
  });

  describe('maskRG', () => {
    it('should mask RG keeping last 3 digits of main number', () => {
      expect(maskRG('12.345.678-9')).toBe('**.***.678-*');
      expect(maskRG('98.765.432-1')).toBe('**.***.432-*');
      expect(maskRG('11.222.333-4')).toBe('**.***.333-*');
    });

    it('should handle RG without formatting', () => {
      expect(maskRG('123456789')).toBe('**.***.678-*');
      expect(maskRG('987654321')).toBe('**.***.432-*');
    });

    it('should handle RG with different formatting', () => {
      expect(maskRG('12345678-9')).toBe('**.***.678-*');
      expect(maskRG('12.3456789')).toBe('**.***.678-*');
    });

    it('should return empty string for invalid RG', () => {
      expect(maskRG('')).toBe('');
      expect(maskRG('123')).toBe('');
      expect(maskRG('invalid')).toBe('');
    });

    it('should handle null and undefined gracefully', () => {
      expect(maskRG(null as any)).toBe('');
      expect(maskRG(undefined as any)).toBe('');
    });
  });

  describe('maskTelefone', () => {
    it('should mask phone keeping last 4 digits', () => {
      expect(maskTelefone('(11) 98765-4321')).toBe('(**) *****-4321');
      expect(maskTelefone('(21) 99999-8888')).toBe('(**) *****-8888');
      expect(maskTelefone('(85) 91234-5678')).toBe('(**) *****-5678');
    });

    it('should handle phone without formatting', () => {
      expect(maskTelefone('11987654321')).toBe('(**) *****-4321');
      expect(maskTelefone('21999998888')).toBe('(**) *****-8888');
      expect(maskTelefone('85912345678')).toBe('(**) *****-5678');
    });

    it('should handle landline numbers', () => {
      expect(maskTelefone('(11) 3456-7890')).toBe('(**) ****-7890');
      expect(maskTelefone('1134567890')).toBe('(**) ****-7890');
      expect(maskTelefone('11 3456-7890')).toBe('(**) ****-7890');
    });

    it('should handle different phone formats', () => {
      expect(maskTelefone('+55 11 98765-4321')).toBe('(**) *****-4321');
      expect(maskTelefone('011 98765-4321')).toBe('(**) *****-4321');
      expect(maskTelefone('11-98765-4321')).toBe('(**) *****-4321');
    });

    it('should return empty string for invalid phone', () => {
      expect(maskTelefone('')).toBe('');
      expect(maskTelefone('123')).toBe('');
      expect(maskTelefone('invalid')).toBe('');
    });

    it('should handle null and undefined gracefully', () => {
      expect(maskTelefone(null as any)).toBe('');
      expect(maskTelefone(undefined as any)).toBe('');
    });
  });

  describe('Integration Tests', () => {
    it('should mask complete user profile data', () => {
      const userProfile = {
        cpf: '123.456.789-00',
        email: 'joao.silva@empresa.com',
        rg: '12.345.678-9',
        telefone: '(11) 98765-4321',
      };

      const maskedProfile = {
        cpf: maskCPF(userProfile.cpf),
        email: maskEmail(userProfile.email),
        rg: maskRG(userProfile.rg),
        telefone: maskTelefone(userProfile.telefone),
      };

      expect(maskedProfile).toEqual({
        cpf: '***.456.789-**',
        email: 'j***@e***.com',
        rg: '**.***.678-*',
        telefone: '(**) *****-4321',
      });
    });

    it('should handle edge cases consistently', () => {
      const edgeCases = {
        cpf: '',
        email: 'invalid',
        rg: null as any,
        telefone: undefined as any,
      };

      const maskedEdgeCases = {
        cpf: maskCPF(edgeCases.cpf),
        email: maskEmail(edgeCases.email),
        rg: maskRG(edgeCases.rg),
        telefone: maskTelefone(edgeCases.telefone),
      };

      expect(maskedEdgeCases).toEqual({
        cpf: '',
        email: '',
        rg: '',
        telefone: '',
      });
    });
  });
});
