/**
 * API Client - Centralized HTTP Client for Simpix
 * 
 * This is the foundational API client that encapsulates HTTP requests
 * with consistent headers, authentication, and response handling.
 * 
 * @version 2.0.0
 * @created 2025-01-23
 * @updated 2025-01-23 - Added TokenManager, ApiConfig, RequestManager
 */

import { getSession } from './auth';

export interface ApiClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  requireAuth?: boolean;
  timeout?: number;
  retries?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

// Error codes enum for standardized error handling
export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT'
}

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public response?: Response,
    code?: ApiErrorCode
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code || this.inferCodeFromStatus(status);
    this.isRetryable = this.determineRetryability();
  }

  private inferCodeFromStatus(status: number): ApiErrorCode {
    switch (status) {
      case 400:
        return ApiErrorCode.VALIDATION_ERROR;
      case 401:
        return ApiErrorCode.TOKEN_EXPIRED;
      case 403:
        return ApiErrorCode.FORBIDDEN;
      case 404:
        return ApiErrorCode.NOT_FOUND;
      case 409:
        return ApiErrorCode.CONFLICT;
      case 500:
      case 502:
      case 503:
      case 504:
        return ApiErrorCode.SERVER_ERROR;
      case 0:
        return this.message.includes('timeout') ? ApiErrorCode.TIMEOUT_ERROR : ApiErrorCode.NETWORK_ERROR;
      default:
        return ApiErrorCode.UNKNOWN_ERROR;
    }
  }

  private determineRetryability(): boolean {
    return [503, 504, 0].includes(this.status) || 
           this.code === ApiErrorCode.TIMEOUT_ERROR ||
           this.code === ApiErrorCode.NETWORK_ERROR;
  }
}

/**
 * PASSO 1: TokenManager - Singleton para gestão de tokens JWT
 */
class TokenManager {
  private static instance: TokenManager;
  private cachedToken: string | null = null;
  private tokenExpiry: number | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  async getValidToken(): Promise<string | null> {
    // Check if we have a valid cached token
    if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry * 1000) {
      return this.cachedToken;
    }

    // If there's already a refresh in progress, wait for it
    if (this.refreshPromise) {
      return await this.refreshPromise;
    }

    // Start token refresh
    this.refreshPromise = this.refreshToken();
    const token = await this.refreshPromise;
    this.refreshPromise = null;
    
    return token;
  }

  private async refreshToken(): Promise<string | null> {
    try {
      const session = await getSession();
      if (!session?.accessToken) {
        this.clearCache();
        return null;
      }

      // Decode JWT to get expiry (simple base64 decode of payload)
      const tokenParts = session.accessToken.split('.');
      if (tokenParts.length === 3) {
        try {
          const payload = JSON.parse(atob(tokenParts[1]));
          this.tokenExpiry = payload.exp;
        } catch {
          // If we can't decode, set a conservative expiry (5 minutes from now)
          this.tokenExpiry = Math.floor(Date.now() / 1000) + 300;
        }
      }

      this.cachedToken = session.accessToken;
      return this.cachedToken;
    } catch (error) {
      this.clearCache();
      return null;
    }
  }

  private clearCache(): void {
    this.cachedToken = null;
    this.tokenExpiry = null;
  }

  // Method to invalidate token (useful when we get 401 errors)
  invalidateToken(): void {
    this.clearCache();
  }
}

/**
 * PASSO 2: ApiConfig - Singleton para configurações de ambiente
 */
class ApiConfig {
  private static instance: ApiConfig;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = this.determineBaseUrl();
  }

  static getInstance(): ApiConfig {
    if (!ApiConfig.instance) {
      ApiConfig.instance = new ApiConfig();
    }
    return ApiConfig.instance;
  }

  private determineBaseUrl(): string {
    // Priority 1: Environment variable
    if (import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL;
    }

    // Priority 2: Auto-detect environment
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      // Replit environment
      if (hostname.includes('replit.') || hostname.includes('.repl.co')) {
        return window.location.origin;
      }
      
      // Local development
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${window.location.protocol}//${hostname}:5000`;
      }
    }

    // Priority 3: Fallback
    return 'http://localhost:5000';
  }

  buildUrl(endpoint: string): string {
    // Remove leading slash if present to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${this.baseUrl}/${cleanEndpoint}`;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

/**
 * PASSO 3: RequestManager - Classe para gestão de requests com timeout e retry
 */
class RequestManager {
  static async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number = 15000,
    retries: number = 2
  ): Promise<Response> {
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const requestOptions = {
          ...options,
          signal: controller.signal
        };

        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);
        
        return response;
      } catch (error) {
        lastError = error as Error;
        
        // Clear any pending timeout
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new Error('Request timeout');
        }

        // Don't retry on the last attempt
        if (attempt === retries) {
          break;
        }

        // Only retry on network errors or timeouts
        const isRetryableError = error instanceof TypeError || 
                                error instanceof Error && error.name === 'AbortError';
        
        if (!isRetryableError) {
          break;
        }

        // Exponential backoff delay
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

/**
 * PASSO 5: Central API client function - Orquestra todas as classes especializadas
 * 
 * @param url - The API endpoint URL
 * @param options - Request configuration options
 * @returns Promise<ApiResponse<T>> - Standardized response wrapper
 */
export async function apiClient<T = any>(
  url: string,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const {
    method = 'GET',
    body,
    headers: customHeaders = {},
    requireAuth = true,
    timeout = 15000,
    retries = 2
  } = options;

  // PASSO 5.1: Use ApiConfig to build complete URL
  const apiConfig = ApiConfig.getInstance();
  const fullUrl = apiConfig.buildUrl(url);

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders
  };

  // PASSO 5.2: Use TokenManager to get valid authentication token
  if (requireAuth) {
    const tokenManager = TokenManager.getInstance();
    const token = await tokenManager.getValidToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Log de diagnóstico para rastrear o header de Authorization
    console.log('[PASSO 3 - ENVIO]', { 
      url: fullUrl,
      authorizationHeader: headers['Authorization'],
      hasToken: !!token
    });
  }

  // Prepare request configuration
  const requestConfig: RequestInit = {
    method,
    headers,
  };

  // Add body for non-GET requests
  if (body && method !== 'GET') {
    if (typeof body === 'string') {
      requestConfig.body = body;
    } else {
      requestConfig.body = JSON.stringify(body);
    }
  }

  try {
    // PASSO 5.3: Use RequestManager for network call with timeout and retry
    const response = await RequestManager.fetchWithTimeout(fullUrl, requestConfig, timeout, retries);

    // Handle non-JSON responses or empty responses
    let data: T;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else if (response.status === 204 || response.status === 205) {
      // No content responses
      data = null as T;
    } else {
      // Try to parse as text for error messages
      const text = await response.text();
      data = (text || null) as T;
    }

    // Check if response is successful
    if (!response.ok) {
      // PASSO 5.4: Handle token expiration with automatic retry
      if (response.status === 401 && requireAuth) {
        const tokenManager = TokenManager.getInstance();
        tokenManager.invalidateToken();
        
        // Try once more with fresh token
        const newToken = await tokenManager.getValidToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          const retryConfig = { ...requestConfig, headers };
          
          try {
            const retryResponse = await RequestManager.fetchWithTimeout(fullUrl, retryConfig, timeout, 0);
            
            let retryData: T;
            const retryContentType = retryResponse.headers.get('content-type');
            
            if (retryContentType && retryContentType.includes('application/json')) {
              retryData = await retryResponse.json();
            } else if (retryResponse.status === 204 || retryResponse.status === 205) {
              retryData = null as T;
            } else {
              const retryText = await retryResponse.text();
              retryData = (retryText || null) as T;
            }

            if (retryResponse.ok) {
              return {
                data: retryData,
                status: retryResponse.status,
                statusText: retryResponse.statusText,
                headers: retryResponse.headers
              };
            }
          } catch (retryError) {
            // If retry fails, fall through to original error handling
          }
        }
      }

      // PASSO 5.5: Use enhanced ApiError class
      throw new ApiError(
        (data as any)?.message || (data as string) || `HTTP Error ${response.status}`,
        response.status,
        response.statusText,
        response
      );
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    };

  } catch (error) {
    // Re-throw ApiError instances
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle timeout errors
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new ApiError(
        'Request timeout: The server took too long to respond',
        0,
        'Timeout Error',
        undefined,
        ApiErrorCode.TIMEOUT_ERROR
      );
    }

    // Handle network errors and other fetch failures
    if (error instanceof TypeError || (error instanceof Error && error.message.includes('fetch'))) {
      throw new ApiError(
        'Network error: Unable to connect to the server',
        0,
        'Network Error',
        undefined,
        ApiErrorCode.NETWORK_ERROR
      );
    }

    // Handle other errors
    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      0,
      'Unknown Error',
      undefined,
      ApiErrorCode.UNKNOWN_ERROR
    );
  }
}

/**
 * Convenience methods for common HTTP operations
 */
export const api = {
  get: <T = any>(url: string, options: Omit<ApiClientOptions, 'method'> = {}) =>
    apiClient<T>(url, { ...options, method: 'GET' }),

  post: <T = any>(url: string, body?: any, options: Omit<ApiClientOptions, 'method' | 'body'> = {}) =>
    apiClient<T>(url, { ...options, method: 'POST', body }),

  put: <T = any>(url: string, body?: any, options: Omit<ApiClientOptions, 'method' | 'body'> = {}) =>
    apiClient<T>(url, { ...options, method: 'PUT', body }),

  patch: <T = any>(url: string, body?: any, options: Omit<ApiClientOptions, 'method' | 'body'> = {}) =>
    apiClient<T>(url, { ...options, method: 'PATCH', body }),

  delete: <T = any>(url: string, options: Omit<ApiClientOptions, 'method'> = {}) =>
    apiClient<T>(url, { ...options, method: 'DELETE' }),
};

export default apiClient;

/**
 * Backward compatibility export for files that haven't been migrated yet
 * @deprecated Use api.get, api.post, etc. instead
 */
export const fetchWithToken = apiClient;