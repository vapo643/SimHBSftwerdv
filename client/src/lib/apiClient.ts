/**
 * API Client - Centralized HTTP Client for Simpix
 * 
 * This is the foundational API client that encapsulates HTTP requests
 * with consistent headers, authentication, and response handling.
 * 
 * @version 1.0.0
 * @created 2025-01-23
 */

import { getSession } from './auth';

export interface ApiClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  requireAuth?: boolean;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Central API client function that wraps fetch with consistent configuration
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
    requireAuth = true
  } = options;

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders
  };

  // Add authentication header if required
  if (requireAuth) {
    const session = await getSession();
    if (session?.accessToken) {
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    }
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
    // Make the HTTP request
    const response = await fetch(url, requestConfig);

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

    // Handle network errors and other fetch failures
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        'Network error: Unable to connect to the server',
        0,
        'Network Error'
      );
    }

    // Handle other errors
    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      0,
      'Unknown Error'
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