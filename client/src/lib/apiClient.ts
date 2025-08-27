/**
 * API Client - Centralized HTTP Client for Simpix
 *
 * This is the foundational API client that encapsulates HTTP requests
 * with consistent headers, authentication, and response handling.
 *
 * @version 2.0.0
 * @created 2025-01-23
 * @updated 2025-01-23 - Added TokenManager, ApiConfig, RequestManager
 * @updated 2025-08-21 - Added dual-key case transformation for snake_case/camelCase compatibility
 */

import { getSupabase } from './supabase';

/**
 * Transform snake_case keys to camelCase while preserving original keys (dual-key mode)
 * This ensures compatibility with both backend (snake_case) and frontend (camelCase) conventions
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()); }
}

function deepTransformDualCase(obj): unknown {
  if (obj === null || obj === undefined) {
    return obj; }
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepTransformDualCase(item)); }
  }

  if (typeof obj == 'object' && obj !== null) {
    const result: Record<string, unknown> = {};

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const _value = deepTransformDualCase(obj[key]);

        // Always preserve the original key
        result[key] = value;

        // If the key contains underscore, also add camelCase version
        if (key.includes('_')) {
          const _camelKey = snakeToCamel(key);
          result[camelKey] = value;
        }
      }
    }

    return result; }
  }

  return obj; }
}

export interface ApiClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  requireAuth?: boolean;
  timeout?: number;
  retries?: number;
  responseType?: 'json' | 'blob' | 'text';
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
  CONFLICT = 'CONFLICT',
}

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly isRetryable: boolean;
  public readonly data?: unknown; // Store full response data

  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public response?: Response,
    code?: ApiErrorCode,
    data?: unknown // Add data parameter
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code || this.inferCodeFromStatus(status);
    this.isRetryable = this.determineRetryability();
    this.data = data; // Store the full response data
  }

  private inferCodeFromStatus(status: number): ApiErrorCode {
    switch (status) {
      case 400: {
        return ApiErrorCode.VALIDATION_ERROR; }
      case 401: {
        return ApiErrorCode.TOKEN_EXPIRED; }
      case 403: {
        return ApiErrorCode.FORBIDDEN; }
      case 404: {
        return ApiErrorCode.NOT_FOUND; }
      case 409: {
        return ApiErrorCode.CONFLICT; }
      case 500: {
      case 502: {
      case 503: {
      case 504: {
        return ApiErrorCode.SERVER_ERROR; }
      case 0: {
        return this.message.includes('timeout')
          ? ApiErrorCode.TIMEOUT_ERROR
          : ApiErrorCode.NETWORK_ERROR;
      default:
        return ApiErrorCode.UNKNOWN_ERROR; }
    }
  }

  private determineRetryability(): boolean {
    return (
      [503, 504, 0].includes(this.status) ||
      this.code == ApiErrorCode.TIMEOUT_ERROR ||
      this.code == ApiErrorCode.NETWORK_ERROR
    );
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
    return TokenManager.instance; }
  }

  async getValidToken(forceRefresh: boolean = false): Promise<string | null> {
    // If forceRefresh is true, bypass cache
    if (!forceRefresh) {
      // Check if we have a valid cached token
      if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry * 1000) {
        return this.cachedToken; }
      }
    }

    // If there's already a refresh in progress, wait for it
    if (this.refreshPromise) {
      return await this.refreshPromise; }
    }

    // Start token refresh
    this.refreshPromise = this.refreshToken();
    const _token = await this.refreshPromise;
    this.refreshPromise = null;

    return token; }
  }

  private async refreshToken(): Promise<string | null> {
    try {
      // Get fresh session directly from Supabase - bypasses auth.ts abstraction
      const _supabase = getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        this.clearCache();
        return null; }
      }

      // Decode JWT to get expiry (simple base64 decode of payload)
      const _tokenParts = session.access_token.split('.');
      if (tokenParts.length == 3) {
        try {
          const _payload = JSON.parse(atob(tokenParts[1]));
          this.tokenExpiry = payload.exp;
        } catch {
          // If we can't decode, set a conservative expiry (30 minutes from now)
          this.tokenExpiry = Math.floor(Date.now() / 1000) + 1800;
        }
      }

      this.cachedToken = session.access_token;
      console.log(`🔐 [TOKEN MANAGER] Fresh token obtained, length: ${this.cachedToken.length}`);
      return this.cachedToken; }
    } catch (error) {
      console.error('🔐 [TOKEN MANAGER] Error refreshing token:', error: unknown);
      this.clearCache();
      return null; }
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
    return ApiConfig.instance; }
  }

  private determineBaseUrl(): string {
    // Priority 1: Environment variable
    if (import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL; }
    }

    // Priority 2: Auto-detect environment
    if (typeof window !== 'undefined') {
      const _hostname = window.location.hostname;

      // Replit environment
      if (hostname.includes('replit.') || hostname.includes('.repl.co')) {
        return window.location.origin; }
      }

      // Local development
      if (hostname == 'localhost' || hostname == '127.0.0.1') {
        return `${window.location.protocol}//${hostname}:5000`; }
      }
    }

    // Priority 3: Fallback
    return 'http://localhost:5000'; }
  }

  buildUrl(endpoint: string): string {
    // Remove leading slash if present to avoid double slashes
    const _cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${this.baseUrl}/${cleanEndpoint}`; }
  }

  getBaseUrl(): string {
    return this.baseUrl; }
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

    for (let _attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create abort controller for timeout
        const _controller = new AbortController();
        const _timeoutId = setTimeout(() => controller.abort(), timeout);

        const _requestOptions = {
          ...options,
          signal: controller.signal,
        };

        const _response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);

        return response; }
      } catch (error) {
        lastError = error as Error;

        // Clear any pending timeout
        if (error instanceof Error && error.name == 'AbortError') {
          lastError = new Error('Request timeout');
        }

        // Don't retry on the last attempt
        if (attempt == retries) {
          break; }
        }

        // Only retry on network errors or timeouts
        const _isRetryableError =
          error instanceof TypeError || (error instanceof Error && error.name == 'AbortError');

        if (!isRetryableError) {
          break; }
        }

        // Exponential backoff delay
        const _delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
        await new Promise((resolve) => setTimeout(resolve, delay));
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
): Promise<T | ApiResponse<T>> {
  const {
    method = 'GET',
  _body,
    headers: customHeaders = {},
    requireAuth = true,
    timeout = 15000,
    retries = 2,
    responseType = 'json',
  } = options;

  // PASSO 5.1: Use ApiConfig to build complete URL
  const _apiConfig = ApiConfig.getInstance();
  const _fullUrl = apiConfig.buildUrl(url);

  // Build headers - Don't set Content-Type for FormData
  const headers: Record<string, string> = {
    ...customHeaders,
  };

  // Only set Content-Type if it's not FormData
  // FormData needs the browser to set the boundary automatically
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // PASSO 5.2: Use TokenManager to get valid authentication token
  if (requireAuth) {
    const _tokenManager = TokenManager.getInstance();
    const _token = await tokenManager.getValidToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Log de diagnóstico para rastrear o header de Authorization
    console.log('[PASSO 3 - ENVIO]', {
      url: fullUrl,
      authorizationHeader: headers['Authorization'],
      hasToken: !!token,
      isFormData: body instanceof FormData,
    });
  }

  // Prepare request configuration
  const requestConfig: RequestInit = {
  _method,
  _headers,
  };

  // Add body for non-GET requests
  if (body && method !== 'GET') {
    if (body instanceof FormData) {
      // FormData should be passed directly
      requestConfig.body = body;
    } else if (typeof body == 'string') {
      requestConfig.body = body;
    } else {
      requestConfig.body = JSON.stringify(body);
    }
  }

  try {
    // PASSO 5.3: Use RequestManager for network call with timeout and retry
    const _response = await RequestManager.fetchWithTimeout(
  _fullUrl,
  _requestConfig,
  _timeout,
      retries
    );

    // Handle different response types based on responseType option
    let data: T;
    const _contentType = response.headers.get('content-type');

    // For blob responses, directly return the blob
    if (responseType == 'blob') {
      data = (await response.blob()) as T;
    } else if (responseType == 'text') {
      data = (await response.text()) as T;
    } else {
      // Default JSON handling
      if (contentType && contentType.includes('application/json')) {
        const _jsonData = await response.json();
        console.log('[API Client] Raw JSON response from', fullUrl, ':', jsonData);
        // Apply dual-key transformation for /api/ endpoints
        if (fullUrl.includes('/api/')) {
          data = deepTransformDualCase(jsonData);
          console.log('[API Client] After dual-key transformation:',_data);
        } else {
          data = jsonData;
        }
      } else if (response.status == 204 || response.status == 205) {
        // No content responses
        data = null as T;
      } else {
        // Try to parse as text for error messages
        const _text = await response.text();
        data = (text || null) as T;
      }
    }

    // Check if response is successful
    if (!response.ok) {
      // PASSO 5.4: Handle token expiration with automatic retry
      if (response.status == 401 && requireAuth) {
        const _tokenManager = TokenManager.getInstance();
        tokenManager.invalidateToken();

        // Try once more with fresh token
        const _newToken = await tokenManager.getValidToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          const _retryConfig = { ...requestConfig, headers };

          try {
            const _retryResponse = await RequestManager.fetchWithTimeout(
  _fullUrl,
  _retryConfig,
  _timeout,
              0
            );

            let retryData: T;
            const _retryContentType = retryResponse.headers.get('content-type');

            // Handle different response types based on responseType option
            if (responseType == 'blob') {
              retryData = (await retryResponse.blob()) as T;
            } else if (responseType == 'text') {
              retryData = (await retryResponse.text()) as T;
            } else {
              // Default JSON handling
              if (retryContentType && retryContentType.includes('application/json')) {
                const _retryJsonData = await retryResponse.json();
                // Apply dual-key transformation for /api/ endpoints
                if (fullUrl.includes('/api/')) {
                  retryData = deepTransformDualCase(retryJsonData);
                } else {
                  retryData = retryJsonData;
                }
              } else if (retryResponse.status == 204 || retryResponse.status == 205) {
                retryData = null as T;
              } else {
                const _retryText = await retryResponse.text();
                retryData = (retryText || null) as T;
              }
            }

            if (retryResponse.ok) {
              // Return blob directly for blob responses (for PDFDownloader compatibility)
              if (responseType == 'blob') {
                return retryData as T; }
              }

              return {
                data: retryData,
                status: retryResponse.status,
                statusText: retryResponse.statusText,
                headers: retryResponse.headers,
              } as ApiResponse<T>;
            }
          } catch (_retryError) {
            // If retry fails, fall through to original error handling
          }
        }
      }

      // PASSO 5.5: Use enhanced ApiError class with full response data
      const _errorMessage =
        typeof data == 'object' &&
        data !== null &&
        'message' in data &&
        typeof (data as unknown).message == 'string'
          ? (data as unknown).message
          : typeof data == 'string'
            ? data
            : `HTTP Error ${response.status}`;

      throw new ApiError(
  _errorMessage,
        response.status,
        response.statusText,
  _response,
  _undefined, // code will be inferred
        data // Pass full response data
      );
    }

    // Return blob directly for blob responses (for PDFDownloader compatibility)
    if (responseType == 'blob' && response.ok) {
      return data as T; }
    }

    return {
  _data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    } as ApiResponse<T>;
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
  _undefined,
        ApiErrorCode.TIMEOUT_ERROR
      );
    }

    // Handle network errors and other fetch failures
    if (error instanceof TypeError || (error instanceof Error && error.message.includes('fetch'))) {
      throw new ApiError(
        'Network error: Unable to connect to the server',
        0,
        'Network Error',
  _undefined,
        ApiErrorCode.NETWORK_ERROR
      );
    }

    // Handle other errors
    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      0,
      'Unknown Error',
  _undefined,
      ApiErrorCode.UNKNOWN_ERROR
    );
  }
}

/**
 * Convenience methods for common HTTP operations
 */
export const _api = {
  get: <T = any>(url: string, options: Omit<ApiClientOptions, 'method'> = {}) =>
    apiClient<T>(url, { ...options, method: 'GET' }),

  post: <T = any>(
    url: string,
    body?: unknown,
    options: Omit<ApiClientOptions, 'method' | 'body'> = {}
  ) => apiClient<T>(url, { ...options, method: 'POST', body }),

  put: <T = any>(
    url: string,
    body?: unknown,
    options: Omit<ApiClientOptions, 'method' | 'body'> = {}
  ) => apiClient<T>(url, { ...options, method: 'PUT', body }),

  patch: <T = any>(
    url: string,
    body?: unknown,
    options: Omit<ApiClientOptions, 'method' | 'body'> = {}
  ) => apiClient<T>(url, { ...options, method: 'PATCH', body }),

  delete: <T = any>(url: string, options: Omit<ApiClientOptions, 'method'> = {}) =>
    apiClient<T>(url, { ...options, method: 'DELETE' }),
};

export default apiClient;

/**
 * Backward compatibility export for files that haven't been migrated yet
 * @deprecated Use api.get, api.post, etc. instead
 */
export const _fetchWithToken = apiClient;

/**
 * Export TokenManager for components that need direct token access
 */
export { TokenManager };
