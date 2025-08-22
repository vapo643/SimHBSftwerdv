/**
 * PII Masking Utilities
 * 
 * Centralizes all PII (Personally Identifiable Information) masking functions
 * to ensure compliance with LGPD and PCI-DSS standards.
 * 
 * @module pii-masking
 * @since 2025-08-22
 * @author GEM 07 - AI Specialist
 */

/**
 * Masks a Brazilian CPF number
 * @param cpf - CPF string with or without formatting
 * @returns Masked CPF showing only last 2 digits (e.g., ***.***.**9-**)
 */
export function maskCPF(cpf: string | null | undefined): string {
  if (!cpf) return '***.***.***-**';
  
  // Remove all non-digit characters
  const digits = cpf.replace(/\D/g, '');
  
  if (digits.length !== 11) {
    return '***.***.***-**';
  }
  
  // Show only the 9th digit
  return `***.***.**${digits[8]}-**`;
}

/**
 * Masks a Brazilian RG number
 * @param rg - RG string with or without formatting
 * @returns Masked RG showing only last digit (e.g., **.***.**8-*)
 */
export function maskRG(rg: string | null | undefined): string {
  if (!rg) return '**.***.**-*';
  
  // Remove all non-alphanumeric characters
  const clean = rg.replace(/[^0-9A-Za-z]/g, '');
  
  if (clean.length < 8) {
    return '**.***.**-*';
  }
  
  // Show only the 7th character
  return `**.***.*${clean[6]}*-*`;
}

/**
 * Masks a phone number (Brazilian format)
 * @param phone - Phone string with or without formatting
 * @returns Masked phone showing only area code and last 2 digits (e.g., (11) ****-**89)
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '(**) *****-****';
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If not a valid Brazilian phone, return default mask
  if (digits.length !== 10 && digits.length !== 11) {
    return '(**) *****-****';
  }
  
  const areaCode = digits.substring(0, 2);
  const lastTwo = digits.substring(digits.length - 2);
  
  if (digits.length === 11) {
    // Mobile with 9 digits
    return `(${areaCode}) *****-**${lastTwo}`;
  } else {
    // Landline with 8 digits
    return `(${areaCode}) ****-**${lastTwo}`;
  }
}

/**
 * Masks an email address
 * @param email - Email string
 * @returns Masked email showing only first 2 chars and domain (e.g., jo***@example.com)
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) {
    return '***@***.***';
  }
  
  const parts = email.split('@');
  const localPart = parts[0];
  const domain = parts[1];
  
  if (localPart.length === 2) {
    return `${localPart}@${domain}`;
  }
  
  if (localPart.length === 1) {
    return `**@${domain}`;
  }
  
  const visibleChars = localPart.substring(0, 2);
  const maskedPart = '*'.repeat(Math.min(localPart.length - 2, 5));
  
  return `${visibleChars}${maskedPart}@${domain}`;
}

/**
 * Masks a bank account number
 * @param account - Bank account string
 * @returns Masked account showing only last 2 digits (e.g., ****-89)
 */
export function maskBankAccount(account: string | null | undefined): string {
  if (!account) return '******-**';
  
  // Remove all non-alphanumeric characters
  const clean = account.replace(/[^0-9A-Za-z]/g, '');
  
  if (clean.length < 4) {
    return '******-**';
  }
  
  const lastTwo = clean.substring(clean.length - 2);
  const baseLength = clean.length - 3; // Account for dash
  const maskLength = Math.max(baseLength, 5); // Minimum 5 asterisks
  
  return `${'*'.repeat(maskLength)}-${lastTwo}`;
}

/**
 * Masks a street address
 * @param address - Full address string
 * @returns Masked address showing only city and state (e.g., ***, São Paulo - SP)
 */
export function maskAddress(address: string | null | undefined): string {
  if (!address) return '***, *** - **';
  
  // Try to extract city and state using common patterns
  const patterns = [
    /,\s*([^,\-]+)\s*-\s*([A-Z]{2})\s*$/i,  // Pattern: ..., City - ST
    /,\s*([^,\-]+)\s*\/\s*([A-Z]{2})\s*$/i,  // Pattern: ..., City / ST
    /,\s*([^,]+),\s*([A-Z]{2})\s*$/i,        // Pattern: ..., City, ST
    /,\s*([A-Z]{2})\s*$/i,                   // Pattern: ..., ST
  ];
  
  for (const pattern of patterns) {
    const match = address.match(pattern);
    if (match) {
      if (match.length === 2) {
        // Only state matched
        return `***, ${match[1].toUpperCase()}`;
      } else {
        // City and state matched
        return `***, ${match[1].trim()} - ${match[2].toUpperCase()}`;
      }
    }
  }
  
  // If no pattern matches, mask everything except last part
  const parts = address.split(',');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    return `***,${lastPart}`; // Keep spacing as is
  }
  
  return '***, *** - **';
}

/**
 * Masks a Brazilian CNPJ number
 * @param cnpj - CNPJ string with or without formatting
 * @returns Masked CNPJ showing only last 4 digits before suffix
 */
export function maskCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '**.***.***/****-**';
  
  // Remove all non-digit characters
  const digits = cnpj.replace(/\D/g, '');
  
  if (digits.length !== 14) {
    return '**.***.***/****-**';
  }
  
  // Show only positions 8-11 (the 4 digits before the suffix)
  const visiblePart = digits.substring(8, 12);
  
  return `**.***.***/5${visiblePart}-**`;
}

/**
 * Masks a credit card number
 * @param cardNumber - Credit card number
 * @returns Masked card showing only last 4 digits (e.g., **** **** **** 1234)
 */
export function maskCreditCard(cardNumber: string | null | undefined): string {
  if (!cardNumber) return '**** **** **** ****';
  
  // Remove all non-digit characters
  const digits = cardNumber.replace(/\D/g, '');
  
  if (digits.length < 13) {
    return '**** **** **** ****';
  }
  
  const lastFour = digits.substring(digits.length - 4);
  
  return `**** **** **** ${lastFour}`;
}

/**
 * Generic PII masking function that detects the type and applies appropriate masking
 * @param value - The value to mask
 * @param type - Optional type hint for better masking
 * @returns Appropriately masked value
 */
export function maskPII(value: string | null | undefined, type?: 'cpf' | 'rg' | 'phone' | 'email' | 'bank' | 'address' | 'cnpj' | 'card'): string {
  if (!value) return '***';
  
  // If type is provided, use specific function
  if (type) {
    switch (type) {
      case 'cpf': return maskCPF(value);
      case 'rg': return maskRG(value);
      case 'phone': return maskPhone(value);
      case 'email': return maskEmail(value);
      case 'bank': return maskBankAccount(value);
      case 'address': return maskAddress(value);
      case 'cnpj': return maskCNPJ(value);
      case 'card': return maskCreditCard(value);
    }
  }
  
  // Try to auto-detect type based on patterns
  const cleanValue = value.replace(/\D/g, '');
  
  // CPF pattern (11 digits)
  if (cleanValue.length === 11) {
    return maskCPF(value);
  }
  
  // CNPJ pattern (14 digits)
  if (cleanValue.length === 14) {
    return maskCNPJ(value);
  }
  
  // Email pattern
  if (value.includes('@') && value.includes('.')) {
    return maskEmail(value);
  }
  
  // Phone pattern (10 or 11 digits)
  if (cleanValue.length === 10 || cleanValue.length === 11) {
    return maskPhone(value);
  }
  
  // Credit card pattern (13-19 digits)
  if (cleanValue.length >= 13 && cleanValue.length <= 19) {
    return maskCreditCard(value);
  }
  
  // Default masking: show first and last character
  if (value.length <= 2) {
    return '**';
  }
  
  const firstChar = value[0];
  const lastChar = value[value.length - 1];
  const maskLength = Math.min(value.length - 2, 10);
  
  return `${firstChar}${'*'.repeat(maskLength)}${lastChar}`;
}

/**
 * Validates if a value appears to contain PII
 * @param value - The value to check
 * @returns true if the value likely contains PII
 */
export function isPII(value: string | null | undefined): boolean {
  if (!value) return false;
  
  const cleanValue = value.replace(/\D/g, '');
  
  // Check for CPF (11 digits)
  if (cleanValue.length === 11) return true;
  
  // Check for CNPJ (14 digits)
  if (cleanValue.length === 14) return true;
  
  // Check for phone (10-11 digits)
  if (cleanValue.length === 10 || cleanValue.length === 11) return true;
  
  // Check for email
  if (value.includes('@') && value.includes('.')) return true;
  
  // Check for credit card (13-19 digits)
  if (cleanValue.length >= 13 && cleanValue.length <= 19) return true;
  
  // Check for common PII patterns in text
  const piiPatterns = [
    /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,  // CPF formatted
    /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/,  // CNPJ formatted
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,  // Email
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,  // Credit card
  ];
  
  return piiPatterns.some(pattern => pattern.test(value));
}

/**
 * Sanitizes an object by masking all PII fields
 * @param obj - Object containing potential PII
 * @param fieldsToMask - Optional array of field names to mask
 * @returns New object with masked PII
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  fieldsToMask?: string[]
): Record<string, any> {
  const sanitized: Record<string, any> = { ...obj };
  
  // If custom fields provided, use those exclusively
  if (fieldsToMask && fieldsToMask.length > 0) {
    for (const key of Object.keys(sanitized)) {
      if (fieldsToMask.includes(key)) {
        const value = sanitized[key];
        if (typeof value === 'string') {
          sanitized[key] = maskPII(value);
        }
      }
    }
    return sanitized as T;
  }
  
  // Default PII fields
  const piiFields = [
    'cpf', 'rg', 'phone', 'telefone', 'celular',
    'email', 'conta', 'account', 'address', 'endereco',
    'cnpj', 'card', 'cartao', 'documento',
    'cliente_cpf', 'cliente_rg', 'cliente_telefone',
    'cliente_email', 'cliente_endereco'
  ];
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    
    // Check if field name suggests PII
    if (piiFields.some(field => lowerKey.includes(field))) {
      const value = sanitized[key];
      if (typeof value === 'string') {
        // Auto-detect type based on field name
        if (lowerKey.includes('cpf')) {
          sanitized[key] = maskCPF(value);
        } else if (lowerKey.includes('rg')) {
          sanitized[key] = maskRG(value);
        } else if (lowerKey.includes('phone') || lowerKey.includes('telefone') || lowerKey.includes('celular')) {
          sanitized[key] = maskPhone(value);
        } else if (lowerKey.includes('email')) {
          sanitized[key] = maskEmail(value);
        } else if (lowerKey.includes('conta') || lowerKey.includes('account')) {
          sanitized[key] = maskBankAccount(value);
        } else if (lowerKey.includes('address') || lowerKey.includes('endereco')) {
          sanitized[key] = maskAddress(value);
        } else if (lowerKey.includes('cnpj')) {
          sanitized[key] = maskCNPJ(value);
        } else if (lowerKey.includes('card') || lowerKey.includes('cartao')) {
          sanitized[key] = maskCreditCard(value);
        } else {
          sanitized[key] = maskPII(value);
        }
      }
    }
  }
  
  return sanitized as T;
}