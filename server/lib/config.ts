/**
 * CONFIGURAÇÃO CENTRALIZADA DE SECRETS (Pilar 10)
 * 
 * Sistema de validação de variáveis de ambiente obrigatórias
 * para garantir que todas as configurações críticas estejam presentes
 * antes da inicialização do servidor.
 */

interface RequiredSecrets {
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  NODE_ENV: string;
}

interface OptionalSecrets {
  PORT?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  JWT_SECRET?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

type AppConfig = RequiredSecrets & OptionalSecrets;

/**
 * Lista de variáveis de ambiente obrigatórias para o funcionamento do sistema
 */
const REQUIRED_ENV_VARS: (keyof RequiredSecrets)[] = [
  'DATABASE_URL',
  'SUPABASE_URL', 
  'SUPABASE_ANON_KEY',
  'NODE_ENV'
];

/**
 * Lista de variáveis de ambiente opcionais com valores padrão
 */
const OPTIONAL_ENV_VARS: Record<keyof OptionalSecrets, string> = {
  PORT: '5000',
  SUPABASE_SERVICE_ROLE_KEY: '',
  JWT_SECRET: '',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: ''
};

/**
 * Classe de erro para configurações ausentes
 */
export class ConfigurationError extends Error {
  constructor(message: string, public missingVars: string[]) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Valida se todas as variáveis de ambiente obrigatórias estão presentes
 * @throws {ConfigurationError} Se alguma variável obrigatória estiver ausente
 */
export function validateEnvironmentVariables(): AppConfig {
  const missingVars: string[] = [];
  const config: Partial<AppConfig> = {};

  // Verificar variáveis obrigatórias
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    
    if (!value || value.trim() === '') {
      missingVars.push(varName);
    } else {
      (config as any)[varName] = value.trim();
    }
  }

  // Se houver variáveis ausentes, lançar erro
  if (missingVars.length > 0) {
    const errorMessage = `
🚨 ERRO DE CONFIGURAÇÃO - SECRETS AUSENTES

As seguintes variáveis de ambiente obrigatórias estão ausentes ou vazias:
${missingVars.map(varName => `  ❌ ${varName}`).join('\n')}

Para resolver este problema:

1. Configure as variáveis de ambiente ausentes
2. Para desenvolvimento local, crie um arquivo .env na raiz do projeto
3. Para produção, configure as variáveis no seu ambiente de deploy

Exemplo de configuração (.env):
${missingVars.map(varName => `${varName}=sua_configuracao_aqui`).join('\n')}

⚠️  O servidor não pode inicializar sem essas configurações críticas.
`;

    throw new ConfigurationError(errorMessage, missingVars);
  }

  // Adicionar variáveis opcionais com valores padrão
  for (const [varName, defaultValue] of Object.entries(OPTIONAL_ENV_VARS)) {
    const value = process.env[varName];
    (config as any)[varName] = value && value.trim() !== '' ? value.trim() : defaultValue;
  }

  return config as AppConfig;
}

/**
 * Valida configurações específicas de banco de dados
 */
export function validateDatabaseConfig(databaseUrl: string): void {
  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    throw new ConfigurationError(
      'DATABASE_URL deve ser uma URL válida do PostgreSQL (postgresql:// ou postgres://)',
      ['DATABASE_URL']
    );
  }
}

/**
 * Valida configurações do Supabase
 */
export function validateSupabaseConfig(url: string, anonKey: string): void {
  if (!url.startsWith('https://')) {
    throw new ConfigurationError(
      'SUPABASE_URL deve ser uma URL HTTPS válida',
      ['SUPABASE_URL']
    );
  }

  if (!url.includes('.supabase.co')) {
    throw new ConfigurationError(
      'SUPABASE_URL deve ser um domínio válido do Supabase (.supabase.co)',
      ['SUPABASE_URL']
    );
  }

  if (anonKey.length < 100) {
    throw new ConfigurationError(
      'SUPABASE_ANON_KEY parece ser inválida (muito curta)',
      ['SUPABASE_ANON_KEY']
    );
  }
}

/**
 * Executa validação completa de todas as configurações
 * @returns Configuração validada e pronta para uso
 */
export function initializeAndValidateConfig(): AppConfig {
  console.log('🔧 Iniciando validação de configurações...');

  try {
    // Validar variáveis de ambiente
    const config = validateEnvironmentVariables();
    
    // Validar configurações específicas
    validateDatabaseConfig(config.DATABASE_URL);
    validateSupabaseConfig(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    
    console.log('✅ Todas as configurações foram validadas com sucesso!');
    console.log(`📊 Ambiente: ${config.NODE_ENV}`);
    console.log(`🔌 Porta: ${config.PORT}`);
    console.log(`🗃️  Database: ${config.DATABASE_URL.substring(0, 30)}...`);
    console.log(`🔐 Supabase: ${config.SUPABASE_URL}`);
    
    return config;
    
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(error.message);
      process.exit(1);
    }
    
    console.error('🚨 Erro inesperado na validação de configurações:', error);
    process.exit(1);
  }
}

/**
 * Utilitário para obter configuração em runtime (após validação)
 */
let _appConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!_appConfig) {
    throw new Error('Configuração não foi inicializada. Chame initializeAndValidateConfig() primeiro.');
  }
  return _appConfig;
}

export function setConfig(config: AppConfig): void {
  _appConfig = config;
}

/**
 * Verifica se estamos em ambiente de desenvolvimento
 */
export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === 'development';
}

/**
 * Verifica se estamos em ambiente de produção
 */
export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production';
}

/**
 * Obter porta do servidor
 */
export function getPort(): number {
  return parseInt(getConfig().PORT || '5000', 10);
}