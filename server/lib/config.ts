// ====================================
// GERENCIAMENTO DE SECRETS CENTRALIZADO (Pilar 10)
// ====================================

import { z } from 'zod';

/**
 * Schema de validação para variáveis de ambiente obrigatórias
 * Garante que todas as configurações necessárias estejam presentes e válidas
 */
const envSchema = z.object({
  // Configurações do Node.js
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('5000'),
  
  // Configurações do Banco de Dados
  DATABASE_URL: z.string().url('DATABASE_URL deve ser uma URL válida do PostgreSQL')
    .refine(url => url.includes('postgresql://') || url.includes('postgres://'), {
      message: 'DATABASE_URL deve ser uma conexão PostgreSQL válida'
    }),
  
  // Configurações do Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL deve ser uma URL válida')
    .refine(url => url.includes('.supabase.co'), {
      message: 'SUPABASE_URL deve ser uma URL válida do Supabase'
    }),
  SUPABASE_ANON_KEY: z.string().min(100, 'SUPABASE_ANON_KEY deve ter pelo menos 100 caracteres')
    .refine(key => key.startsWith('eyJ'), {
      message: 'SUPABASE_ANON_KEY deve ser um JWT token válido'
    }),
  
  // Configurações de Segurança (Opcionais com defaults seguros)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres')
    .optional()
    .default(() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET é obrigatório em produção');
      }
      return 'dev-secret-key-32-chars-minimum-length';
    }),
  
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET deve ter pelo menos 32 caracteres')
    .optional()
    .default(() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SESSION_SECRET é obrigatório em produção');
      }
      return 'dev-session-secret-32-chars-minimum';
    }),
  
  // Configurações de Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().positive()).default('900000'), // 15 min
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().positive()).default('100'),
  RATE_LIMIT_AUTH_MAX: z.string().transform(Number).pipe(z.number().positive()).default('5'),
  
  // Configurações de Proxy (para Replit)
  TRUST_PROXY: z.enum(['true', 'false', '1', '0']).default('true'),
  
  // Configurações de CORS
  ALLOWED_ORIGINS: z.string().optional().default('*'),
  
  // Configurações de Upload
  MAX_FILE_SIZE: z.string().transform(Number).pipe(z.number().positive()).default('10485760'), // 10MB
  UPLOAD_DIR: z.string().default('./uploads'),
});

/**
 * Tipo inferido das configurações validadas
 */
export type Config = z.infer<typeof envSchema>;

/**
 * Configurações da aplicação validadas
 */
let config: Config | undefined;

/**
 * Valida e carrega todas as variáveis de ambiente necessárias
 * Implementa o padrão "fail-fast" para garantir que o servidor não inicie com configurações inválidas
 */
export function validateAndLoadConfig(): Config {
  console.log('🔍 Validando configurações de ambiente...');
  
  try {
    // Parse e validação das variáveis de ambiente
    const rawEnv = {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL: process.env.DATABASE_URL,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      JWT_SECRET: process.env.JWT_SECRET,
      SESSION_SECRET: process.env.SESSION_SECRET,
      RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_AUTH_MAX: process.env.RATE_LIMIT_AUTH_MAX,
      TRUST_PROXY: process.env.TRUST_PROXY,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
      UPLOAD_DIR: process.env.UPLOAD_DIR,
    };

    // Validação rigorosa do schema
    config = envSchema.parse(rawEnv);
    
    // Validações adicionais específicas do ambiente
    validateEnvironmentSpecificRules(config);
    
    console.log('✅ Configurações validadas com sucesso');
    console.log(`📍 Ambiente: ${config.NODE_ENV}`);
    console.log(`🚀 Porta: ${config.PORT}`);
    console.log(`🗄️  Database: ${maskConnectionString(config.DATABASE_URL)}`);
    console.log(`🔐 Supabase: ${maskUrl(config.SUPABASE_URL)}`);
    console.log(`⚡ Rate Limit: ${config.RATE_LIMIT_MAX_REQUESTS} req/${config.RATE_LIMIT_WINDOW_MS}ms`);
    
    return config;
  } catch (error) {
    console.error('❌ ERRO CRÍTICO: Falha na validação das configurações');
    
    if (error instanceof z.ZodError) {
      console.error('📋 Problemas encontrados:');
      error.errors.forEach((err, index) => {
        console.error(`  ${index + 1}. ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error(`💥 Erro: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.error('\n🚨 O servidor não pode iniciar com configurações inválidas');
    console.error('🔧 Corrija as configurações de ambiente e tente novamente\n');
    
    // Exemplo de configuração para ajudar o desenvolvedor
    printConfigurationExample();
    
    // Falha rápida - não permite inicialização com configurações inválidas
    process.exit(1);
  }
}

/**
 * Validações específicas do ambiente
 */
function validateEnvironmentSpecificRules(config: Config): void {
  // Validações de produção
  if (config.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET é obrigatório em ambiente de produção');
    }
    
    if (!process.env.SESSION_SECRET) {
      throw new Error('SESSION_SECRET é obrigatório em ambiente de produção');
    }
    
    if (config.ALLOWED_ORIGINS === '*') {
      console.warn('⚠️  AVISO: ALLOWED_ORIGINS configurado como "*" em produção pode ser inseguro');
    }
  }
  
  // Validações de desenvolvimento
  if (config.NODE_ENV === 'development') {
    console.log('🛠️  Modo desenvolvimento: usando configurações padrão para secrets opcionais');
  }
  
  // Validações de teste
  if (config.NODE_ENV === 'test') {
    console.log('🧪 Modo teste: configurações de teste ativas');
  }
}

/**
 * Mascara strings de conexão para logs seguros
 */
function maskConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const masked = `${url.protocol}//${url.username ? '***:***@' : ''}${url.host}${url.pathname}`;
    return masked;
  } catch {
    return 'URL_INVÁLIDA';
  }
}

/**
 * Mascara URLs para logs seguros
 */
function maskUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.protocol}//${parsedUrl.host}`;
  } catch {
    return 'URL_INVÁLIDA';
  }
}

/**
 * Imprime exemplo de configuração para ajudar na resolução de problemas
 */
function printConfigurationExample(): void {
  console.log('📝 Exemplo de configuração (.env):');
  console.log('');
  console.log('# Configurações básicas');
  console.log('NODE_ENV=development');
  console.log('PORT=5000');
  console.log('');
  console.log('# Database');
  console.log('DATABASE_URL=postgresql://user:password@localhost:5432/simpix');
  console.log('');
  console.log('# Supabase');
  console.log('SUPABASE_URL=https://your-project.supabase.co');
  console.log('SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
  console.log('');
  console.log('# Secrets (obrigatórios em produção)');
  console.log('JWT_SECRET=your-jwt-secret-at-least-32-chars');
  console.log('SESSION_SECRET=your-session-secret-at-least-32-chars');
  console.log('');
}

/**
 * Retorna a configuração validada
 * Deve ser chamado apenas após validateAndLoadConfig()
 */
export function getConfig(): Config {
  if (!config) {
    throw new Error('Configuração não foi carregada. Chame validateAndLoadConfig() primeiro.');
  }
  return config;
}

/**
 * Verifica se uma configuração específica existe
 */
export function hasConfig(key: keyof Config): boolean {
  if (!config) return false;
  return config[key] !== undefined && config[key] !== null;
}

/**
 * Retorna configurações seguras para logging (sem secrets)
 */
export function getSafeConfigForLogging(): Partial<Config> {
  if (!config) return {};
  
  const safeConfig = { ...config };
  delete (safeConfig as any).JWT_SECRET;
  delete (safeConfig as any).SESSION_SECRET;
  delete (safeConfig as any).SUPABASE_ANON_KEY;
  
  return safeConfig;
}

/**
 * Inicializa e exporta as configurações validadas como default
 * Será undefined até validateAndLoadConfig() ser chamado
 */
export { config as default };