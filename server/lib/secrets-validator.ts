/**
 * DEMONSTRAÇÃO DE VALIDAÇÃO DE SECRETS
 * 
 * Este arquivo demonstra como o sistema reage à ausência de secrets críticos
 */

import { initializeAndValidateConfig } from './config';

/**
 * Simula a ausência de uma variável crítica para demonstrar a validação
 */
export function simulateMissingSecret() {
  // Backup da variável original
  const originalDatabaseUrl = process.env.DATABASE_URL;
  
  try {
    // Remover temporariamente a variável para demonstrar o erro
    delete process.env.DATABASE_URL;
    
    console.log('🧪 Simulando ausência de DATABASE_URL...');
    
    // Tentar validar - deve falhar
    initializeAndValidateConfig();
    
  } catch (error) {
    console.log('✅ Sistema detectou secret ausente corretamente!');
    console.log('Erro capturado:', error instanceof Error ? error.message : 'Unknown error');
    
  } finally {
    // Restaurar a variável
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
}

/**
 * Testa a validação completa do sistema
 */
export function testSecretsValidation(): boolean {
  try {
    console.log('🔍 Testando validação de secrets...');
    
    const config = initializeAndValidateConfig();
    
    const requiredSecrets = [
      'DATABASE_URL',
      'SUPABASE_URL', 
      'SUPABASE_ANON_KEY',
      'NODE_ENV'
    ];
    
    let allPresent = true;
    
    for (const secret of requiredSecrets) {
      if (!config[secret as keyof typeof config]) {
        console.log(`❌ ${secret} está ausente`);
        allPresent = false;
      } else {
        console.log(`✅ ${secret} está presente`);
      }
    }
    
    if (allPresent) {
      console.log('🎉 Todos os secrets obrigatórios estão configurados!');
    }
    
    return allPresent;
    
  } catch (error) {
    console.error('🚨 Erro na validação de secrets:', error);
    return false;
  }
}