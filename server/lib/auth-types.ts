/**
 * Pilar 5 - Padrão Aberto - Backend
 * Interfaces de abstração para autenticação no servidor
 */

export interface ServerUser {
  id: string;
  email: string;
  name?: string;
  createdAt?: Date;
}

export interface TokenValidationResult {
  user: ServerUser;
  valid: boolean;
}

/**
 * Interface para provedores de autenticação no servidor
 */
export interface ServerAuthProvider {
  /**
   * Valida token de acesso e retorna usuário
   */
  validateToken(token: string): Promise<TokenValidationResult>;

  /**
   * Obtém usuário por ID
   */
  getUser(userId: string): Promise<ServerUser | null>;
}

/**
 * Configuração do provedor de autenticação no servidor
 */
export interface ServerAuthConfig {
  provider: "supabase" | "firebase" | "auth0" | "custom";
  options?: Record<string, any>;
}
