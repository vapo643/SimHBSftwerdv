# Centralized Secrets Management (Pilar 10)

## 🔐 Overview

This document outlines the centralized secrets management system implemented for the Simpix Credit Management System. The system provides comprehensive environment variable validation, fail-fast server startup, and secure configuration management to ensure application stability and security.

## 🛠️ Architecture

### Core Components

1. **Configuration Validation** (`server/lib/config.ts`)
   - Zod-based schema validation for all environment variables
   - Type-safe configuration export
   - Fail-fast error handling with detailed feedback

2. **Server Integration** (`server/index.ts`)
   - Mandatory configuration validation before server startup
   - Graceful error handling with clear error messages
   - Environment-specific logging and configuration

## 📋 Required Environment Variables

### Core Application Settings
```env
# Application Environment
NODE_ENV=development|production|test
PORT=5000

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Security Configuration (Production Required)
```env
# Authentication Secrets
JWT_SECRET=your-jwt-secret-at-least-32-chars
SESSION_SECRET=your-session-secret-at-least-32-chars
```

### Optional Configuration (With Defaults)
```env
# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100      # Max requests per window
RATE_LIMIT_AUTH_MAX=5           # Max auth attempts per window

# Proxy Configuration
TRUST_PROXY=true                # For Replit environment

# CORS Configuration
ALLOWED_ORIGINS=*               # Comma-separated list of allowed origins

# File Upload
MAX_FILE_SIZE=10485760         # 10MB in bytes
UPLOAD_DIR=./uploads           # Upload directory
```

## 🔍 Validation Rules

### Database URL Validation
```typescript
DATABASE_URL: z.string().url('DATABASE_URL deve ser uma URL válida do PostgreSQL')
  .refine(url => url.includes('postgresql://') || url.includes('postgres://'), {
    message: 'DATABASE_URL deve ser uma conexão PostgreSQL válida'
  })
```

### Supabase Configuration Validation
```typescript
SUPABASE_URL: z.string().url('SUPABASE_URL deve ser uma URL válida')
  .refine(url => url.includes('.supabase.co'), {
    message: 'SUPABASE_URL deve ser uma URL válida do Supabase'
  }),

SUPABASE_ANON_KEY: z.string().min(100, 'SUPABASE_ANON_KEY deve ter pelo menos 100 caracteres')
  .refine(key => key.startsWith('eyJ'), {
    message: 'SUPABASE_ANON_KEY deve ser um JWT token válido'
  })
```

### Security Secrets Validation
```typescript
JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres')
SESSION_SECRET: z.string().min(32, 'SESSION_SECRET deve ter pelo menos 32 caracteres')
```

## 🚨 Fail-Fast Mechanism

### Validation Process
1. **Environment Loading**: All environment variables are loaded from `process.env`
2. **Schema Validation**: Zod schema validates each variable against defined rules
3. **Environment-Specific Rules**: Additional validation for production environments
4. **Error Reporting**: Detailed error messages with correction guidance
5. **Process Exit**: Server refuses to start if any validation fails

### Example Validation Output
```bash
🔍 Validando configurações de ambiente...
✅ Configurações validadas com sucesso
📍 Ambiente: development
🚀 Porta: 5000
🗄️  Database: postgresql://***:***@localhost:5432/simpix
🔐 Supabase: https://your-project.supabase.co
⚡ Rate Limit: 100 req/900000ms
```

### Error Handling Example
```bash
❌ ERRO CRÍTICO: Falha na validação das configurações
📋 Problemas encontrados:
  1. DATABASE_URL: DATABASE_URL deve ser uma URL válida do PostgreSQL
  2. SUPABASE_ANON_KEY: SUPABASE_ANON_KEY deve ser um JWT token válido

🚨 O servidor não pode iniciar com configurações inválidas
🔧 Corrija as configurações de ambiente e tente novamente

📝 Exemplo de configuração (.env):
# Configurações básicas
NODE_ENV=development
PORT=5000
...
```

## 🔧 Implementation Details

### Configuration Loading Function
```typescript
export function validateAndLoadConfig(): Config {
  console.log('🔍 Validando configurações de ambiente...');
  
  try {
    const rawEnv = { /* environment variables */ };
    config = envSchema.parse(rawEnv);
    validateEnvironmentSpecificRules(config);
    
    console.log('✅ Configurações validadas com sucesso');
    return config;
  } catch (error) {
    console.error('❌ ERRO CRÍTICO: Falha na validação das configurações');
    printConfigurationExample();
    process.exit(1); // Fail-fast
  }
}
```

### Server Integration
```typescript
// VALIDAÇÃO OBRIGATÓRIA DE CONFIGURAÇÕES - FAIL FAST
const config = validateAndLoadConfig();

const app = express();

// Configure trust proxy for Replit
if (config.TRUST_PROXY === 'true' || config.TRUST_PROXY === '1') {
  app.set('trust proxy', true);
}
```

## 🛡️ Security Features

### Production Environment Enforcement
- **Mandatory Secrets**: JWT_SECRET and SESSION_SECRET are required in production
- **CORS Validation**: Warns if ALLOWED_ORIGINS is set to "*" in production
- **Secret Masking**: Sensitive data is masked in logs for security

### Development Environment Support
- **Default Values**: Provides secure default values for development
- **Debugging Support**: Enhanced logging for development troubleshooting
- **Flexible Configuration**: Allows missing optional secrets in development

## 📊 Configuration Access

### Safe Configuration Retrieval
```typescript
// Get validated configuration
const config = getConfig();

// Check if specific configuration exists
const hasSecret = hasConfig('JWT_SECRET');

// Get safe configuration for logging (without secrets)
const safeConfig = getSafeConfigForLogging();
```

### Type Safety
```typescript
export type Config = z.infer<typeof envSchema>;
```
All configuration access is fully type-safe with TypeScript integration.

## 🔄 Environment-Specific Behavior

### Development Mode
- Uses default values for optional secrets
- Enhanced logging for debugging
- Flexible validation rules

### Production Mode
- Strict validation for all security secrets
- Masked logging for sensitive data
- Enhanced security warnings

### Test Mode
- Isolated configuration for testing
- Mock-friendly default values
- Predictable behavior for automated testing

## 🎯 Benefits

### Application Stability
- **Fail-Fast Startup**: Prevents application from starting with invalid configuration
- **Type Safety**: Compile-time validation of configuration usage
- **Clear Error Messages**: Detailed feedback for configuration issues

### Security Enhancement
- **Secret Validation**: Ensures strong secrets in production environments
- **Secure Logging**: Masks sensitive data in logs
- **Environment Isolation**: Clear separation between environments

### Developer Experience
- **Clear Documentation**: Comprehensive configuration examples
- **Helpful Error Messages**: Guided resolution for configuration problems
- **Type Safety**: IntelliSense support for all configuration properties

## 🚀 Usage Examples

### Basic Server Startup
```typescript
import { validateAndLoadConfig, getConfig } from './lib/config';

// Validate configuration (fail-fast if invalid)
const config = validateAndLoadConfig();

// Use validated configuration
const app = express();
app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});
```

### Configuration-Based Feature Flags
```typescript
if (config.NODE_ENV === 'development') {
  // Development-only features
}

if (hasConfig('JWT_SECRET')) {
  // JWT authentication enabled
}
```

### Secure Database Connection
```typescript
// Database URL is guaranteed to be valid PostgreSQL connection
const db = postgres(config.DATABASE_URL);
```

## 📈 Future Enhancements

### Planned Features
1. **Runtime Configuration Updates**: Hot-reload configuration changes
2. **External Secret Stores**: Integration with AWS Secrets Manager, Azure Key Vault
3. **Configuration Versioning**: Track configuration changes over time
4. **Advanced Validation**: Custom validation rules for business-specific requirements
5. **Configuration Templates**: Pre-defined configurations for different deployment scenarios

### Monitoring Integration
1. **Configuration Health Checks**: Periodic validation of configuration
2. **Secret Rotation**: Automated secret rotation capabilities
3. **Audit Logging**: Track configuration access and changes
4. **Alerting**: Notifications for configuration-related issues

This centralized secrets management system provides a robust foundation for secure, reliable application configuration management in the Simpix Credit Management System.