/**
 * Pilar 5 - Padrão Aberto
 * Interfaces de abstração para reduzir acoplamento com provedores de autenticação
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  createdAt?: Date;
}

export interface Session {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  session: Session | null;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignInResult {
  user: User;
  session: Session;
}

export interface AuthStateChangeCallback {
  (user: User | null): void;
}

export interface AuthSubscription {
  unsubscribe: () => void;
}

/**
 * Interface principal do provedor de autenticação
 * Abstrai completamente a implementação específica (Supabase, Firebase, Auth0, etc.)
 */
export interface AuthProvider {
  /**
   * Realiza login com email e senha
   */
  signIn(credentials: SignInCredentials): Promise<SignInResult>;

  /**
   * Realiza logout
   */
  signOut(): Promise<void>;

  /**
   * Obtém a sessão atual
   */
  getSession(): Promise<Session | null>;

  /**
   * Obtém o usuário atual
   */
  getCurrentUser(): Promise<User | null>;

  /**
   * Escuta mudanças no estado de autenticação
   */
  onAuthStateChange(callback: AuthStateChangeCallback): AuthSubscription;

  /**
   * Obtém o token de acesso atual
   */
  getAccessToken(): Promise<string | null>;
}

/**
 * Configuração do provedor de autenticação
 */
export interface AuthConfig {
  provider: "supabase" | "firebase" | "auth0" | "custom";
  options?: Record<string, any>;
}
