/**
 * Error Handler Middleware - PAM P2.4.1: Fundação da Resiliência
 * 
 * Middleware centralizado de tratamento de erros para substituir
 * blocos try/catch inconsistentes nos controllers.
 * 
 * Funcionalidades:
 * - Logging estruturado com Winston
 * - Resposta JSON padronizada e segura
 * - Não vaza detalhes sensíveis em produção
 * - Correlação de erros para auditoria
 */

import { Request, Response, NextFunction } from 'express';
import { logError } from '../lib/logger.js';

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  // Extrair correlation ID do request se disponível
  const correlationId = (req as any).correlationId || 'unknown';
  
  // Log estruturado do erro usando Winston logger central
  logError(`Erro não tratado na rota ${req.method} ${req.path}`, error, {
    correlationId,
    method: req.method,
    url: req.url,
    path: req.path,
    userAgent: req.get('user-agent'),
    ip: req.ip || req.connection?.remoteAddress,
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString(),
  });

  // Determinar ambiente para controlar exposição de detalhes
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Determinar status code do erro
  const statusCode = (error as any).status || (error as any).statusCode || 500;

  // Resposta JSON padronizada e segura
  const errorResponse = {
    success: false,
    error: {
      message: isDevelopment 
        ? error.message 
        : 'Ocorreu um erro interno no servidor.',
      code: statusCode,
      correlationId,
      // Stack trace apenas em desenvolvimento
      ...(isDevelopment && { stack: error.stack }),
    },
    // Timestamp para auditoria
    timestamp: new Date().toISOString(),
  };

  // Enviar resposta com status apropriado
  res.status(statusCode).json(errorResponse);
};