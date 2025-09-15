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
        process.env.NODE_ENV === 'development'
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
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  req.correlationId = correlationId;
  req.startTime = Date.now();

  // Filtrar logs desnecessários em desenvolvimento (arquivos estáticos)
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isStaticFile = req.url.match(/\.(js|jsx|ts|tsx|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/);
  const isViteHMR = req.url.includes('/@vite/') || req.url.includes('/@fs/');
  const isSourceMap = req.url.includes('.map');
  const isComponentFile = req.url.includes('/src/components/') || req.url.includes('/src/pages/') || req.url.includes('/src/lib/') || req.url.includes('/src/hooks/') || req.url.includes('/src/utils/');
  
  const shouldSkipLogging = isDevelopment && (isStaticFile || isViteHMR || isSourceMap || isComponentFile);

  // Log inicial da requisição (apenas para requests importantes)
  if (!shouldSkipLogging) {
    logger.info('📥 Request received', {
      correlationId,
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      referrer: req.get('referrer'),
    });
  }

  // Interceptar o response para log final
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - (req.startTime || Date.now());

    // Log do response (apenas para requests importantes)
    if (!shouldSkipLogging) {
      logger.info('📤 Request completed', {
        correlationId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        responseSize: Buffer.byteLength(JSON.stringify(data)),
      });
    }

    // Alertar para requisições lentas (sempre monitorar, independente do filtro)
    if (duration > 1000 && !shouldSkipLogging) {
      logger.warn('⚠️ Slow request detected', {
        correlationId,
        url: req.url,
        duration,
        threshold: 1000,
      });
    }

    // Alertar para erros (sempre monitorar erros, independente do filtro)
    if (res.statusCode >= 400 && !shouldSkipLogging) {
      logger.error('❌ Request error', {
        correlationId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        error: data,
      });
    }

    return originalSend.call(this, data);
  };

  next();
}

// Helper functions para logging estruturado
export const logInfo = (message: string, metadata?: any) => {
  logger.info(message, metadata);
};

export const logError = (message: string, error: Error | any, metadata?: any) => {
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

export const logWarn = (message: string, metadata?: any) => {
  logger.warn(message, metadata);
};

export const logDebug = (message: string, metadata?: any) => {
  logger.debug(message, metadata);
};

// Métricas básicas de logging
export const logMetric = (metricName: string, value: number, unit: string, metadata?: any) => {
  logger.info('📊 Metric', {
    metric: metricName,
    value,
    unit,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

// Log de segurança
export const logSecurity = (
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  metadata?: any
) => {
  logger.warn(`🔒 Security Event: ${event}`, {
    severity,
    event,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

// Log de auditoria
export const logAudit = (
  action: string,
  userId: string | null,
  resource: string,
  metadata?: any
) => {
  logger.info('📝 Audit Log', {
    action,
    userId,
    resource,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

export default logger;
