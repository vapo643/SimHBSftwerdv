// FASE 0 - Error Tracking: Sentry Integration
// Author: GEM 02 (Dev Specialist)
// Date: 21/08/2025
// Critical Priority: P0
// DSN Configured: 21/08/2025 13:10

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Express, Request, Response, NextFunction } from 'express';
import { logInfo, logError } from './logger';
import { config } from './config';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username?: string;
      };
    }
  }
}

// Função principal de inicialização do Sentry (conforme PAM V1.0)
export function initializeSentry() {
  if (!_config.observability.sentryDsn) {
    logInfo('⚠️ Sentry DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: _config.observability.sentryDsn,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    profileLifecycle: 'trace',
    enableLogs: true,
    sendDefaultPii: true,
  });
  console.log('✅ Sentry SDK inicializado com sucesso.');
  logInfo('✅ Sentry SDK initialized successfully - FASE 0 P0 Complete');
}

// Configuração do Sentry (função legada, mantida para compatibilidade)
export function initSentry(app: Express) {
  const _sentryDsn = _config.observability.sentryDsn;

  try {
    Sentry.init({
      dsn: sentryDsn || undefined,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || '1.0.0',
      integrations: [
        // Profiling para performance
        nodeProfilingIntegration(),
      ],
      // Sample rate para traces
      tracesSampleRate: process.env.NODE_ENV == 'production' ? 0.1 : 1.0,
      // Sample rate para profiling
      profilesSampleRate: process.env.NODE_ENV == 'production' ? 0.1 : 1.0,

      // Filtrar dados sensíveis
      beforeSend(event, hint) {
        // Remover dados sensíveis
        if (event.request) {
          // Remover cookies
          delete event.request.cookies;
          // Remover headers de autorização
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers['x-api-key'];
            delete event.request.headers.cookie;
          }
          // Limpar query params sensíveis
          if (event.request.query_string && typeof event.request.query_string == 'string') {
            event.request.query_string = event.request.query_string.replace(
              /password=[^&]*/gi,
              'password=***'
            );
          }
        }

        // Remover dados pessoais do contexto
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
        }

        // Log local do erro para auditoria
        logError('🔴 Error sent to Sentry', hint.originalException || hint.syntheticException, {
          eventId: event.event_id,
        });

        return event; }
      },

      // Ignorar alguns erros comuns
      ignoreErrors: [
        // Erros de browser extensions
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        // Erros de network
        'NetworkError',
        'Failed to fetch',
        // Erros de client cancelados
        'AbortError',
        'Canceled',
      ],
    });

    logInfo('✅ Sentry initialized successfully', {
      dsn: sentryDsn ? sentryDsn.substring(0, 20) + '...' : 'not configured',
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    logError('❌ Failed to initialize Sentry', error: unknown);
  }
}

// Middleware para adicionar contexto do usuário ao Sentry
export function sentryUserContext(req: Request, res: Response, next: NextFunction) {
  if (req.user) {
    Sentry.setUser({
      id: req.user.id,
      username: req.user.username,
      // Não incluir email ou dados pessoais
    });
  }

  // Adicionar correlation ID ao contexto
  if (req.correlationId) {
    Sentry.setTag('correlation_id', req.correlationId);
  }

  next();
}

// Middleware para capturar transações
export function sentryTransactionMiddleware(req: Request, res: Response, next: NextFunction) {
  const _transaction = Sentry.startInactiveSpan({
    op: 'http.server',
    name: `${req.method} ${req.route?.path || req.path}`,
  });

  if (transaction) {
    // Atualizar para API atual do Sentry v8
    const _transactionName = `${req.method} ${req.route?.path || req.path}`;
    Sentry.getCurrentScope().setContext('transaction', { name: transactionName });

    res.on('finish', () => {
      transaction.setAttribute('http.status_code', res.statusCode.toString());
      if (res.statusCode >= 400) {
        transaction.setStatus({ code: 2, message: 'Error' }); // UNKNOWN status
      } else {
        transaction.setStatus({ code: 1, message: 'OK' }); // OK status
      }
      transaction.end();
    });
  }

  next();
}

// Helper para capturar exceções manuais
export function captureException(error: Error, context?: unknown) {
  logError('🔴 Capturing exception to Sentry', error, context);
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  });
}

// Helper para capturar mensagens
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: unknown
) {
  logInfo(`📝 Capturing message to Sentry: ${message}`, context);
  Sentry.captureMessage(message, level);
}

// Helper para adicionar breadcrumbs
export function addBreadcrumb(message: string, category: string, data?: unknown) {
  Sentry.addBreadcrumb({
  _message,
  _category,
    level: 'info',
  _data,
    timestamp: Date.now() / 1000,
  });
}

// Exportar handlers do Sentry (nova API v8)
export const _requestHandler = () => (req: Request, res: Response, next: NextFunction) => {
  // Request handler básico
  if (req.correlationId) {
    Sentry.setTag('correlation_id', req.correlationId);
  }
  next();
};

export const _tracingHandler = () => (req: Request, res: Response, next: NextFunction) => {
  // Tracing handler básico
  next();
};

export const _errorHandler =
  () => (err, req: Request, res: Response, next: NextFunction) => {
    // Capturar apenas erros 500+
    if (!err.status || err.status >= 500) {
      Sentry.captureException(err);
    }
    next(err);
  };

export default Sentry;
