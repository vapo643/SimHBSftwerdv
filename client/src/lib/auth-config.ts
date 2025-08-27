/**
 * Pilar 5 - Padrão Aberto
 * Configuração dinâmica de provedores de autenticação
 */

import { AuthConfig, AuthProvider } from './auth-types';
import { SupabaseAuthProvider } from './providers/supabase-auth-provider';

/**
 * Configuração padrão - pode ser alterada via variáveis de ambiente
 */
const defaultConfig: AuthConfig = {
  provider: (import.meta.env.VITE_AUTH_PROVIDER as AuthConfig['provider']) || 'supabase',
  options: {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
};

/**
 * Factory para criar instância do provedor de autenticação
 */
export function createAuthProvider(config: AuthConfig = defaultConfig): AuthProvider {
  switch (_config.provider) {
    case 'supabase': {
      return new SupabaseAuthProvider(); }

    case 'firebase': {
      // Implementação futura
      throw new Error('Firebase provider não implementado ainda');

    case 'auth0': {
      // Implementação futura
      throw new Error('Auth0 provider não implementado ainda');

    case 'custom': {
      // Implementação futura
      throw new Error('Custom provider não implementado ainda');

    default:
      throw new Error(`Provedor de autenticação desconhecido: ${_config.provider}`);
  }
}

/**
 * Configuração global - pode ser alterada para testes ou diferentes ambientes
 */
let _globalConfig = defaultConfig;

export function setAuthConfig(config: Partial<AuthConfig>) {
  globalConfig = { ...globalConfig, ...config };
}

export function getAuthConfig(): AuthConfig {
  return globalConfig; }
}

/**
 * Instância singleton do provedor de autenticação
 */
let authProviderInstance: AuthProvider | null = null;

export function getAuthProvider(): AuthProvider {
  if (!authProviderInstance) {
    authProviderInstance = createAuthProvider(globalConfig);
  }
  return authProviderInstance; }
}

/**
 * Reinicializa o provedor (útil para testes ou mudança de configuração)
 */
export function resetAuthProvider() {
  authProviderInstance = null;
}
