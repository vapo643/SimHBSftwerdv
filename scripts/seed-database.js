/**
 * Seed Database - Ponto de entrada principal para seeding
 * Operação Soberania dos Dados - Sistema de Seeding V1.0
 */
import { runSeeding } from './seeding/index.js';

/**
 * Script principal de seeding
 * Uso: NODE_ENV=staging node scripts/seed-database.js
 */
async function main() {
  console.log('🌱 [SEED DATABASE] Iniciando sistema de seeding...');
  
  // Obter ambiente da variável NODE_ENV
  const environment = process.env.NODE_ENV || 'development';
  
  console.log(`🔧 [SEED DATABASE] Ambiente detectado: ${environment}`);
  
  try {
    // Executar seeding
    const result = await runSeeding(environment);
    
    console.log('🎯 [SEED DATABASE] Seeding concluído:', {
      environment: result.environment,
      profiles: result.profiles,
      proposals: result.proposals,
      timestamp: new Date().toISOString(),
    });
    
    console.log('✅ [SEED DATABASE] Sistema pronto para uso!');
    process.exit(0);
    
  } catch (error) {
    console.error('💥 [SEED DATABASE] Falha crítica:', error);
    
    // Log adicional para debugging
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}