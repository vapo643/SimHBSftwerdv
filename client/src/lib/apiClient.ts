import { getSession } from "@/lib/auth";

/**
 * Centralized API Client for consistent HTTP requests
 * Handles authentication, headers, and error responses automatically
 */
export const apiClient = async (endpoint: string, method: string = 'GET', body?: any) => {
  try {
    // Get authentication token from session
    const session = await getSession();
    const token = session?.accessToken;

    // Prepare headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add authentication header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Make the API request
    const response = await fetch(`/api${endpoint}`, {
      method: method.toUpperCase(),
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    // Handle successful responses with no content
    if (response.status === 204) {
      return null;
    }

    // Handle error responses
    if (!response.ok) {
      let errorMessage = 'Ocorreu um erro na API';
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.details || errorMessage;
      } catch {
        // If response isn't JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    // Parse and return successful response
    return await response.json();
  } catch (error) {
    // Re-throw errors to be handled by the calling code
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Falha na comunicação com o servidor');
  }
};

/**
 * Convenience methods for common HTTP operations
 */
export const api = {
  get: (endpoint: string) => apiClient(endpoint, 'GET'),
  post: (endpoint: string, data?: any) => apiClient(endpoint, 'POST', data),
  put: (endpoint: string, data?: any) => apiClient(endpoint, 'PUT', data),
  patch: (endpoint: string, data?: any) => apiClient(endpoint, 'PATCH', data),
  delete: (endpoint: string) => apiClient(endpoint, 'DELETE'),
};

export default apiClient;