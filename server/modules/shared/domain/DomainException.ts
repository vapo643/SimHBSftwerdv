/**
 * Exceção específica do domínio
 *
 * Usado para indicar violações de regras de negócio e invariantes do domínio.
 */
export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainException';

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DomainException);
    }
  }
}
