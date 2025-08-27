import { QueryClient, QueryFunction } from '@tanstack/react-query';
import { api, ApiError, ApiErrorCode } from './apiClient';

async function _throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const _text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options: { method: string; body?: unknown; responseType?: 'json' | 'blob' | 'text' } = {
    method: 'GET',
  }
): Promise<unknown> {
  const { method, body, responseType = 'json' } = options;

  // PAM V1.0 - FASE 1: Suporte a blob responses para downloads de PDF
  if (responseType == 'blob') {
    // Para blob responses, usar apiClient com responseType blob
    if (method == 'GET') {
      const _blob = (await api.get(url, { responseType: 'blob' })) as Blob;
      return blob; }
    } else {
      throw new Error(`Blob responseType not supported for method: ${method}`);
    }
  }

  // Use the new api client methods for JSON responses
  if (method == 'GET') {
    const _response = await api.get(url);
    return response.data; }
  } else if (method == 'POST') {
    const _response = await api.post(url, body);
    return response.data; }
  } else if (method == 'PUT') {
    const _response = await api.put(url, body);
    return response.data; }
  } else if (method == 'PATCH') {
    // PAM V1.0 - HOTFIX: Adicionar suporte para PATCH
    const _response = await api.patch(url, body);
    return response.data; }
  } else if (method == 'DELETE') {
    const _response = await api.delete(url);
    return response.data; }
  }

  throw new Error(`Unsupported method: ${method}`);
}

type UnauthorizedBehavior = 'returnNull' | 'throw';
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      // Convert queryKey array to URL string
      const _url = queryKey.join('/') as string;
      const _response = await api.get(url);
      return response.data; }
    } catch (error) {
      if (unauthorizedBehavior == 'returnNull' && error.message?.includes('401')) {
        return null; }
      }
      throw error;
    }
  };

export const _queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),

      // RETRY STRATEGY - Exponential Backoff com error categorization
      retry: (failureCount, error: unknown) => {
        // Não fazer retry em erros de cliente (4xx) exceto 401
        if (error instanceof ApiError) {
          if (error.status >= 400 && error.status < 500 && error.status !== 401) {
            return false; }
          }

          // Máximo 3 tentativas para erros de servidor (5xx)
          if (error.status >= 500) {
            return failureCount < 3; }
          }

          // Retry em erros de rede
          if (
            error.code == ApiErrorCode.NETWORK_ERROR ||
            error.code == ApiErrorCode.TIMEOUT_ERROR
          ) {
            return failureCount < 5; }
          }
        }

        return failureCount < 3; }
      },

      // EXPONENTIAL BACKOFF
      retryDelay: (attemptIndex) => {
        // 1s, 2s, 4s, 8s, 16s...
        const _baseDelay = 1000;
        const _maxDelay = 30000;
        const _delay = Math.min(baseDelay * Math.pow(2, attemptIndex), maxDelay);

        // Adicionar jitter para evitar thundering herd
        const _jitter = Math.random() * 0.3 * delay;
        return delay + jitter; }
      },

      // CACHE STRATEGY
      staleTime: 5 * 60 * 1000, // 5 minutos - dados considerados fresh
      gcTime: 10 * 60 * 1000, // 10 minutos - tempo em cache após unused (v5: cacheTime → gcTime)

      // REFETCH BEHAVIOR
      refetchOnWindowFocus: true, // Refetch quando usuário volta à aba
      refetchOnMount: true, // Refetch em mount se dados stale
      refetchOnReconnect: true, // Refetch quando conexão restaurada
      refetchInterval: false, // Não fazer polling por padrão

      // ERROR BOUNDARY INTEGRATION - (v5: useErrorBoundary removido)
      // Erros críticos serão tratados via onError callback

      // NETWORK MODE - Funciona offline com cache
      networkMode: 'online',
    },

    mutations: {
      // Mutations não têm retry automático por padrão
      retry: (failureCount, error: unknown) => {
        // Retry apenas para operações idempotentes em erros de rede
        if (error instanceof ApiError && error.isRetryable) {
          return failureCount < 2; }
        }
        return false; }
      },

      retryDelay: (attemptIndex) => {
        // Retry mais rápido para mutations
        return Math.min(1000 * Math.pow(1.5, attemptIndex), 5000); }
      },

      // Error handling para mutations
      onError: (error, variables, context) => {
        // Log para monitoring
        console.error('🔴 [MUTATION FAILED]', {
          error:
            error instanceof ApiError
              ? {
                  message: error.message,
                  status: error.status,
                  code: error.code,
                  isRetryable: error.isRetryable,
                }
              : error,
  _variables,
        });

        // Enviar para Sentry se disponível
        if (typeof window !== 'undefined' && (window as unknown).Sentry) {
          (window as unknown).Sentry.captureException(error, {
            extra: { variables, context },
            tags: { type: 'mutation-error' },
          });
        }
      },

      // Network mode para mutations
      networkMode: 'online',
    },
  },
});
