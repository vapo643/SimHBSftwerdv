// FASE 0 - Observabilidade: Winston Logger Estruturado
// Author: GEM 02 (Dev Specialist)
// Date: 21/08/2025
// Critical Priority: P0

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

// Configuração do Winston Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'simpix-api',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
  },
  transports: [
    // Console output com formato legível para desenvolvimento
    new winston.transports.Console({
      format:
        process.env.NODE_ENV == 'development'
          ? winston.format.combine(
              winston.format.colorize(),
              winston.format.simple(),
              winston.format.printf(({ level, message, timestamp, ...metadata }) => {
                let msg = `${timestamp} [${level}]: ${message}`;
                if (Object.keys(metadata).length > 0) {
                  msg += ` ${JSON.stringify(metadata)}`;
                }
                return msg;
              })
            )
          : winston.format.json(),
    }),
    // Arquivo para erros
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Arquivo para todos os logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Criar pasta de logs se não existir
import fs from 'fs';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
  logger.info('📁 Created logs directory');
}

// Interface para adicionar correlationId ao Request
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
    }
  }
}

// Middleware para logging de requisições
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  // Adicionar correlation ID
  const _correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  req.correlationId = correlationId;
  req.startTime = Date.now();

  // Log inicial da requisição
  logger.info('📥 Request received', {
  _correlationId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    referrer: req.get('referrer'),
  });

  // Interceptar o response para log final
  const _originalSend = res.send;
  res.send = function (_data) {
    const _duration = Date.now() - (req.startTime || Date.now());

    // Log do response
    logger.info('📤 Request completed', {
  _correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
  _duration,
      responseSize: Buffer.byteLength(JSON.stringify(_data)),
    });

    // Alertar para requisições lentas
    if (duration > 1000) {
      logger.warn('⚠️ Slow request detected', {
  _correlationId,
        url: req.url,
  _duration,
        threshold: 1000,
      });
    }

    // Alertar para erros
    if (res.statusCode >= 400) {
      logger.error('❌ Request error', {
  _correlationId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
  _duration,
        error: data,
      });
    }

    return originalSend.call(this,_data); }
  };

  next();
}

// Helper functions para logging estruturado
export const _logInfo = (message: string, metadata?) => {
  logger.info(message, metadata);
};

export const _logError = (message: string, error: Error | any, metadata?) => {
  logger.error(message, {
    ...metadata,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...(error.response && { response: error.response }),
    },
  });
};

export const _logWarn = (message: string, metadata?) => {
  logger.warn(message, metadata);
};

export const _logDebug = (message: string, metadata?) => {
  logger.debug(message, metadata);
};

// Métricas básicas de logging
export const _logMetric = (metricName: string, value: number, unit: string, metadata?) => {
  logger.info('📊 Metric', {
    metric: metricName,
  _value,
  _unit,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

// Log de segurança
export const _logSecurity = (
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  metadata?: unknown
) => {
  logger.warn(`🔒 Security Event: ${event}`, {
  _severity,
  _event,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

// Log de auditoria
export const _logAudit = (
  action: string,
  userId: string | null,
  resource: string,
  metadata?: unknown
) => {
  logger.info('📝 Audit Log', {
  _action,
  _userId,
  _resource,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

export default logger;
