/**
 * Pilar 5 - Padrão Aberto
 * Camada de abstração principal para autenticação
 * Desacoplada de implementações específicas (Supabase, Firebase, etc.)
 */

import { getAuthProvider } from './auth-config';
import {
  User,
  Session,
  SignInCredentials,
  SignInResult,
  AuthStateChangeCallback,
  AuthSubscription,
  AuthProvider,
} from './auth-types';

/**
 * Serviço principal de autenticação
 * Utiliza o padrão Strategy para abstrair diferentes provedores
 */
export class AuthService {
  private provider: AuthProvider;

  constructor(provider?: AuthProvider) {
    this.provider = provider || getAuthProvider();
  }

  /**
   * Login com email e senha
   */
  async signIn(credentials: SignInCredentials): Promise<SignInResult> {
    return this.provider.signIn(credentials);
  }

  /**
   * Logout
   */
  async signOut(): Promise<void> {
    return this.provider.signOut();
  }

  /**
   * Obtém sessão atual
   */
  async getSession(): Promise<Session | null> {
    return this.provider.getSession();
  }

  /**
   * Obtém usuário atual
   */
  async getCurrentUser(): Promise<User | null> {
    return this.provider.getCurrentUser();
  }

  /**
   * Escuta mudanças no estado de autenticação
   */
  onAuthStateChange(callback: AuthStateChangeCallback): AuthSubscription {
    return this.provider.onAuthStateChange(callback);
  }

  /**
   * Obtém token de acesso
   */
  async getAccessToken(): Promise<string | null> {
    return this.provider.getAccessToken();
  }
}

// Instância singleton do serviço de autenticação
let authServiceInstance: AuthService | null = null;

/**
 * Obtém instância singleton do serviço de autenticação
 */
export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
}

/**
 * Reinicia o serviço de autenticação (útil para testes)
 */
export function resetAuthService(): void {
  authServiceInstance = null;
}

// Exports de compatibilidade com a API anterior
const _authService = getAuthService();

/**
 * @deprecated Use authService.signIn() em vez desta função
 */
export async function signIn(email: string, password: string) {
  const _result = await authService.signIn({ email, password });
  return {
    user: _result.user,
    session: _result.session,
  };
}

/**
 * @deprecated Use authService.signOut() em vez desta função
 */
export async function signOut() {
  return authService.signOut();
}

/**
 * @deprecated Use authService.getSession() em vez desta função
 */
export async function getSession() {
  return authService.getSession();
}

/**
 * @deprecated Use authService.onAuthStateChange() em vez desta função
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  return authService.onAuthStateChange(callback);
}

// Re-exports das interfaces para compatibilidade
export type { AuthState, User, Session } from './auth-types';
