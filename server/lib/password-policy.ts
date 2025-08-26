/**
 * Enhanced Password Policy - OWASP ASVS V2.1.7
 *
 * Extends zxcvbn with additional security requirements
 * following NIST 800-63B guidelines.
 */

import { SecurityEventType, securityLogger } from './security-logger';

export interface PasswordPolicyResult {
  isValid: boolean;
  score: number;
  message: string;
  requirements: {
    minLength: boolean;
    maxLength: boolean;
    noCommonPatterns: boolean;
    noPersonalInfo: boolean;
    noRepeatingChars: boolean;
    noSequentialChars: boolean;
    zxcvbnScore: boolean;
  };
  suggestions: string[];
}

// Common weak patterns to check
const COMMON_PATTERNS = [
  /^(password|senha|123456|qwerty|admin|letmein|welcome|monkey|dragon)/i,
  /^(1234567890|0987654321|abcdefg|qwertyuiop)/i,
  /^(.)\1{5,}/, // Repeated characters (aaaaaa)
  /^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)/i, // Sequential
];

// Keyboard patterns
const KEYBOARD_PATTERNS = [
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
  '1234567890',
  'qwerty',
  'asdfgh',
  'zxcvbn',
  '123456',
  'qazwsx',
  'qweasd',
];

/**
 * Enhanced password validation beyond zxcvbn
 */
export function validatePasswordPolicy(
  password: string,
  personalInfo: string[] = [],
  zxcvbnScore: number = 0
): PasswordPolicyResult {
  const requirements = {
    minLength: password.length >= 12, // NIST recommends minimum 8, we use 12
    maxLength: password.length <= 128, // NIST recommends max 64+, we use 128
    noCommonPatterns: true,
    noPersonalInfo: true,
    noRepeatingChars: true,
    noSequentialChars: true,
    zxcvbnScore: zxcvbnScore >= 3, // Already checked by existing system
  };

  const suggestions: string[] = [];

  // Check length
  if (!requirements.minLength) {
    suggestions.push('Use pelo menos 12 caracteres');
  }
  if (!requirements.maxLength) {
    suggestions.push('Use no máximo 128 caracteres');
  }

  // Check common patterns
  for (const pattern of COMMON_PATTERNS) {
    if (pattern.test(password)) {
      requirements.noCommonPatterns = false;
      suggestions.push('Evite padrões comuns como "password" ou "123456"');
      break;
    }
  }

  // Check keyboard patterns
  const lowerPassword = password.toLowerCase();
  for (const pattern of KEYBOARD_PATTERNS) {
    if (
      lowerPassword.includes(pattern) ||
      lowerPassword.includes(pattern.split('').reverse().join(''))
    ) {
      requirements.noCommonPatterns = false;
      if (!suggestions.includes('Evite sequências do teclado como "qwerty"')) {
        suggestions.push('Evite sequências do teclado como "qwerty"');
      }
      break;
    }
  }

  // Check personal information
  for (const info of personalInfo) {
    if (info && info.length > 2 && password.toLowerCase().includes(info.toLowerCase())) {
      requirements.noPersonalInfo = false;
      suggestions.push('Não use informações pessoais na senha');
      break;
    }
  }

  // Check repeating characters (more than 3 in a row)
  if (/(.)\1{3,}/.test(password)) {
    requirements.noRepeatingChars = false;
    suggestions.push('Evite repetir o mesmo caractere várias vezes');
  }

  // Check sequential characters
  const hasSequential = checkSequentialChars(password);
  if (hasSequential) {
    requirements.noSequentialChars = false;
    suggestions.push('Evite sequências como "abc" ou "123"');
  }

  // Calculate if valid
  const isValid = Object.values(requirements).every((req) => req);

  // Generate message
  let message = '';
  if (isValid) {
    message = 'Senha forte e segura';
  } else {
    message = 'A senha não atende aos requisitos de segurança';
  }

  return {
    isValid,
    score: zxcvbnScore,
    message,
    requirements,
    suggestions,
  };
}

/**
 * Check for sequential characters
 */
function checkSequentialChars(password: string): boolean {
  const chars = password.toLowerCase().split('');

  for (let i = 0; i < chars.length - 2; i++) {
    const char1 = chars[i].charCodeAt(0);
    const char2 = chars[i + 1].charCodeAt(0);
    const char3 = chars[i + 2].charCodeAt(0);

    // Check ascending or descending sequences
    if (
      (char2 === char1 + 1 && char3 === char2 + 1) ||
      (char2 === char1 - 1 && char3 === char2 - 1)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Log password policy violations for security monitoring
 */
export function logPasswordPolicyViolation(
  userId: string | undefined,
  email: string | undefined,
  violations: string[],
  ipAddress?: string
): void {
  securityLogger.logEvent({
    type: SecurityEventType.SUSPICIOUS_ACTIVITY,
    severity: 'LOW',
    userId,
    userEmail: email,
    ipAddress,
    endpoint: '/api/auth/register',
    success: false,
    details: {
      reason: 'Password policy violations',
      violations,
    },
  });
}

/**
 * Generate password strength feedback message
 */
export function getPasswordStrengthMessage(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'Senha muito fraca - facilmente adivinhável';
    case 2:
      return 'Senha fraca - precisa ser mais complexa';
    case 3:
      return 'Senha razoável - pode ser melhorada';
    case 4:
      return 'Senha forte - boa escolha!';
    default:
      return 'Força da senha desconhecida';
  }
}
