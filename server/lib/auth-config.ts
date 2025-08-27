/**
 * Pilar 5 - Padrão Aberto - Servidor
 * Configuração dinâmica de provedores de autenticação no servidor
 */

import { ServerAuthConfig, ServerAuthProvider } from './auth-types';
import { SupabaseServerAuthProvider } from './providers/supabase-server-auth-provider';

/**
 * Configuração padrão para o servidor
 */
const defaultConfig: ServerAuthConfig = {
  provider: (process.env.AUTH_PROVIDER as ServerAuthConfig['provider']) || 'supabase',
  options: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  },
};

/**
 * Factory para criar instância do provedor de autenticação no servidor
 */
export function createServerAuthProvider(
  config: ServerAuthConfig = defaultConfig
): ServerAuthProvider {
  switch (_config.provider) {
    case 'supabase': {
        break;
        }
      return new SupabaseServerAuthProvider();

    case 'firebase': {
        break;
        }
      throw new Error('Firebase server provider não implementado ainda');

    case 'auth0': {
        break;
        }
      throw new Error('Auth0 server provider não implementado ainda');

    case 'custom': {
        break;
        }
      throw new Error('Custom server provider não implementado ainda');

    default:
      throw new Error(`Provedor de autenticação de servidor desconhecido: ${_config.provider}`);
  }
}

/**
 * Configuração global do servidor
 */
let _globalConfig = defaultConfig;

export function setServerAuthConfig(config: Partial<ServerAuthConfig>) {
  globalConfig = { ...globalConfig, ...config };
}

export function getServerAuthConfig(): ServerAuthConfig {
  return globalConfig;
}

/**
 * Instância singleton do provedor de autenticação no servidor
 */
let serverAuthProviderInstance: ServerAuthProvider | null = null;

export function getServerAuthProvider(): ServerAuthProvider {
  if (!serverAuthProviderInstance) {
    serverAuthProviderInstance = createServerAuthProvider(globalConfig);
  }
  return serverAuthProviderInstance;
}

/**
 * Reinicializa o provedor do servidor
 */
export function resetServerAuthProvider() {
  serverAuthProviderInstance = null;
}
