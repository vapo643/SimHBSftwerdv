import { Request, Response, NextFunction } from 'express';

/**
 * Interface canônica para requests autenticados
 * Extende Express Request com dados de usuário validados
 * Compatible com extensões globais existentes (sentry.ts, logger.ts)
 *
 * @interface AuthenticatedRequest
 * @extends Request
 */
export interface AuthenticatedRequest extends Request {
  /**
   * Dados completos do usuário autenticado
   * Preenchido pelo jwtAuthMiddleware após validação
   * Compatible com interface global do Express
   */
  user?: {
    /** ID único do usuário (UUID) */
    id: string;
    /** Username (compatibilidade com Sentry) */
    username?: string;
    /** Email do usuário */
    email?: string;
    /** Role/função do usuário no sistema */
    role?: string | null;
    /** Nome completo do usuário */
    full_name?: string | null;
    /** ID da loja associada (se aplicável) */
    loja_id?: number | null;
  };

  /**
   * ID da sessão Express (compatibilidade express-session)
   */
  sessionID?: string;

  /**
   * Dados de arquivo para upload (compatibilidade multer)
   * Presente apenas em routes de upload
   */
  file?: Express.Multer.File;

  /**
   * Múltiplos arquivos para upload (compatibilidade multer)
   */
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

/**
 * Type alias para middlewares que requerem autenticação
 */
export type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;
