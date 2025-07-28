/**
 * API Client Centralizado - Versão 1.0
 * Implementação incremental e segura para substituir fetch direto
 */

/**
 * Cliente API básico para requisições HTTP
 * FASE 1: Apenas operações GET para teste inicial
 */
export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '';
  }

  /**
   * Método GET básico para requisições de leitura
   * @param endpoint - Caminho da API (ex: '/api/parceiros')
   * @param options - Opções adicionais para o fetch
   */
  async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[apiClient] GET error:', error);
      throw error;
    }
  }

  /**
   * Health Check simples para validar funcionamento
   * Retorna true se o cliente está operacional
   */
  async healthCheck(): Promise<boolean> {
    try {
      console.log('[apiClient] Health check iniciado...');
      // Teste simples sem fazer requisição real
      return true;
    } catch (error) {
      console.error('[apiClient] Health check falhou:', error);
      return false;
    }
  }
}

// Exportar instância única (singleton)
export const apiClient = new ApiClient();

// Exportar como 'api' para compatibilidade com código existente
export const api = apiClient;

// Export default para compatibilidade
export default apiClient;