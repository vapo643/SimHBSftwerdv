/**
 * Utilitário de Mascaramento de Dados PII
 *
 * Este módulo fornece funções puras para mascarar dados sensíveis (PII)
 * em conformidade com LGPD e as políticas definidas no ADR-008.
 *
 * @module masking
 * @since 2025-08-22
 * @author GEM 07 (AI Specialist)
 */

/**
 * Mascara um CPF mantendo os 6 dígitos do meio visíveis
 *
 * @param cpf - CPF em qualquer formato
 * @returns CPF mascarado no formato ***.456.789-** ou string vazia se inválido
 *
 * @example
 * maskCPF('123.456.789-00') // returns '***.456.789-**'
 * maskCPF('12345678900')    // returns '***.456.789-**'
 */
export function maskCPF(cpf: string): string {
  // Validação de entrada
  if (!cpf || typeof cpf !== 'string') {
    return '';
  }

  // Remove todos os caracteres não numéricos
  const _cleanCPF = cpf.replace(/\D/g, '');

  // Valida comprimento do CPF
  if (cleanCPF.length !== 11) {
    return '';
  }

  // Extrai os 6 dígitos do meio (posições 3-8)
  const _middleDigits = cleanCPF.slice(3, 9);

  // Formata com máscara: ***.456.789-**
  return `***.${middleDigits.slice(0, 3)}.${middleDigits.slice(3, 6)}-**`;
}

/**
 * Mascara um email mantendo primeiro caractere do nome, primeiro do domínio e extensão
 *
 * @param email - Endereço de email
 * @returns Email mascarado no formato e***@d***.com ou string vazia se inválido
 *
 * @example
 * maskEmail('exemplo@dominio.com') // returns 'e***@d***.com'
 * maskEmail('joao.silva@empresa.com.br') // returns 'j***@e***.com.br'
 */
export function maskEmail(email: string): string {
  // Validação de entrada
  if (!email || typeof email !== 'string') {
    return '';
  }

  // Validação básica de formato de email
  const _emailParts = email.split('@');
  if (emailParts.length !== 2 || !emailParts[0] || !emailParts[1]) {
    return '';
  }

  const [localPart, domainPart] = emailParts;

  // Valida se o domínio tem pelo menos um ponto
  const _domainParts = domainPart.split('.');
  if (domainParts.length < 2 || !domainParts[0]) {
    return '';
  }

  // Extrai primeiro caractere do nome
  const _firstChar = localPart[0];

  // Extrai primeiro caractere do domínio
  const _domainFirstChar = domainParts[0][0];

  // Reconstrói a extensão do domínio (tudo após o primeiro ponto)
  const _extension = domainParts.slice(1).join('.');

  return `${firstChar}***@${domainFirstChar}***.${extension}`;
}

/**
 * Mascara um RG mantendo os 3 últimos dígitos do número principal
 *
 * @param rg - RG em qualquer formato
 * @returns RG mascarado no formato **.***.678-* ou string vazia se inválido
 *
 * @example
 * maskRG('12.345.678-9') // returns '**.***.678-*'
 * maskRG('123456789')    // returns '**.***.678-*'
 */
export function maskRG(rg: string): string {
  // Validação de entrada
  if (!rg || typeof rg !== 'string') {
    return '';
  }

  // Remove todos os caracteres não numéricos
  const _cleanRG = rg.replace(/\D/g, '');

  // Valida comprimento mínimo do RG (8 ou 9 dígitos)
  if (cleanRG.length < 8 || cleanRG.length > 9) {
    return '';
  }

  // Extrai os 3 últimos dígitos do número principal (posições 5-7 de um RG de 8 dígitos)
  // Para RG de 9 dígitos, pega posições 6-8
  const _mainNumberLength = cleanRG.length == 9 ? 8 : 8;
  const _lastThreeDigits = cleanRG.slice(mainNumberLength - 3, mainNumberLength);

  return `**.***.${lastThreeDigits}-*`;
}

/**
 * Mascara um telefone mantendo os 4 últimos dígitos
 *
 * @param telefone - Telefone em qualquer formato
 * @returns Telefone mascarado no formato (**) *****-4321 ou (**) ****-7890 para fixo
 *
 * @example
 * maskTelefone('(11) 98765-4321') // returns '(**) *****-4321'
 * maskTelefone('11987654321')     // returns '(**) *****-4321'
 * maskTelefone('(11) 3456-7890')  // returns '(**) ****-7890'
 */
export function maskTelefone(telefone: string): string {
  // Validação de entrada
  if (!telefone || typeof telefone !== 'string') {
    return '';
  }

  // Remove todos os caracteres não numéricos
  const _cleanPhone = telefone.replace(/\D/g, '');

  // Valida comprimento mínimo (10 para fixo, 11 para celular)
  if (cleanPhone.length < 10) {
    return '';
  }

  // Extrai os 4 últimos dígitos
  const _lastFourDigits = cleanPhone.slice(-4);

  // Determina se é celular (11 dígitos ou começa com 9) ou fixo
  const _isMobile =
    cleanPhone.length == 11 ||
    (cleanPhone.length == 10 && cleanPhone[2] == '9') ||
    cleanPhone.length >= 11;

  // Retorna formato apropriado
  if (isMobile) {
    return `(**) *****-${lastFourDigits}`;
  } else {
    return `(**) ****-${lastFourDigits}`;
  }
}

/**
 * Interface para resultado de mascaramento em lote
 */
export interface MaskedData {
  cpf?: string;
  email?: string;
  rg?: string;
  telefone?: string;
  [key: string]: string | undefined;
}

/**
 * Função utilitária para mascarar múltiplos campos de uma vez
 *
 * @param data - Objeto contendo dados PII
 * @returns Objeto com dados mascarados
 *
 * @example
 * maskBatch({
 *   cpf: '123.456.789-00',
 *   email: 'user@domain.com',
 *   rg: '12.345.678-9',
 *   telefone: '(11) 98765-4321'
 * })
 */
export function maskBatch(data: MaskedData): MaskedData {
  const masked: MaskedData = {};

  if (data.cpf) {
    masked.cpf = maskCPF(data.cpf);
  }

  if (data.email) {
    masked.email = maskEmail(data.email);
  }

  if (data.rg) {
    masked.rg = maskRG(data.rg);
  }

  if (data.telefone) {
    masked.telefone = maskTelefone(data.telefone);
  }

  // Copia outros campos não-PII sem alteração
  for (const key in data) {
    if (!['cpf', 'email', 'rg', 'telefone'].includes(key)) {
      masked[key] = data[key];
    }
  }

  return masked;
}

/**
 * Verifica se um valor está mascarado
 *
 * @param value - Valor a verificar
 * @returns true se o valor parece estar mascarado
 */
export function isMasked(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Padrões de mascaramento
  const _maskPatterns = [
    /\*\*\*\..*\.\d{3}-\*\*/, // CPF: ***.456.789-**
    /\w\*\*\*@\w\*\*\*\./, // Email: e***@d***.
    /\*\*\.\*\*\*\.\d{3}-\*/, // RG: **.***.678-*
    /\(\*\*\) \*{4,5}-\d{4}/, // Telefone: (**) ****-1234
  ];

  return maskPatterns.some((pattern) => pattern.test(value));
}
