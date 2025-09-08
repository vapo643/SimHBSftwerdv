/**
 * Sanitized Logger - P0.2 GREEN CORRECTION
 * Remove PII (Personally Identifiable Information) dos logs
 *
 * Elimina violação de segurança identificada pelo advisor
 */

const PII_FIELDS = [
  'cpf',
  'cliente_cpf',
  'clienteCpf',
  'cpfCliente',
  'email',
  'cliente_email',
  'clienteEmail',
  'emailCliente',
  'telefone',
  'cliente_telefone',
  'clienteTelefone',
  'telefoneCliente',
  'nome',
  'cliente_nome',
  'clienteNome',
  'nomeCliente',
  'nomeCompleto',
  'rg',
  'cnpj',
  'endereco',
  'cep',
  'password',
  'token',
  'authorization',
];

/**
 * Remove dados sensíveis de um objeto para logging seguro
 */
export function sanitizeForLog(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLog);
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Verificar se é campo PII
    if (PII_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
      if (typeof value === 'string' && value.length > 3) {
        // Mascarar dados sensíveis - mostrar apenas primeiros e últimos caracteres
        sanitized[key] = `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Logger seguro que remove PII automaticamente
 */
export class SafeLogger {
  private static isDevelopment = process.env.NODE_ENV === 'development';

  static info(message: string, data?: any) {
    if (data) {
      console.log(`[SAFE] ${message}`, sanitizeForLog(data));
    } else {
      console.log(`[SAFE] ${message}`);
    }
  }

  static debug(message: string, data?: any) {
    if (SafeLogger.isDevelopment && data) {
      console.log(`[SAFE-DEBUG] ${message}`, sanitizeForLog(data));
    } else if (SafeLogger.isDevelopment) {
      console.log(`[SAFE-DEBUG] ${message}`);
    }
  }

  static warn(message: string, data?: any) {
    if (data) {
      console.warn(`[SAFE-WARN] ${message}`, sanitizeForLog(data));
    } else {
      console.warn(`[SAFE-WARN] ${message}`);
    }
  }

  static error(message: string, error?: any) {
    if (error) {
      console.error(`[SAFE-ERROR] ${message}`, sanitizeForLog(error));
    } else {
      console.error(`[SAFE-ERROR] ${message}`);
    }
  }
}
