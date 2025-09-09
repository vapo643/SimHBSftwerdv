/**
 * Seeding Index - Ponto de entrada modular para seeding
 * Operação Soberania dos Dados - Seeding System V1.0
 */
import { BusinessScenarioSeeder } from './business-scenarios.js';

/**
 * Configurações por ambiente
 */
const ENVIRONMENT_CONFIGS = {
  development: () => import('./environments/staging-config.js').then(m => m.STAGING_CONFIG),
  staging: () => import('./environments/staging-config.js').then(m => m.STAGING_CONFIG),
};

/**
 * Executa seeding baseado no ambiente
 */
export async function runSeeding(environment = 'development') {
  console.log(`🌱 [SEEDING] Iniciando seeding para ambiente: ${environment}`);
  
  try {
    // Carregar configuração do ambiente
    const configLoader = ENVIRONMENT_CONFIGS[environment];
    if (!configLoader) {
      throw new Error(`Ambiente não suportado: ${environment}. Ambientes disponíveis: ${Object.keys(ENVIRONMENT_CONFIGS).join(', ')}`);
    }
    
    const config = await configLoader();
    console.log(`⚙️ [SEEDING] Configuração carregada para ${environment}`);
    
    // Inicializar seeder
    const seeder = new BusinessScenarioSeeder(config);
    
    // Executar seeding
    const result = await seeder.seedBusinessScenario();
    
    // Gerar relatório
    await seeder.generateScenarioReport();
    
    console.log(`🎉 [SEEDING] Concluído com sucesso para ${environment}:`, result);
    
    return result;
    
  } catch (error) {
    console.error(`💥 [SEEDING] Falha para ambiente ${environment}:`, error);
    throw error;
  }
}

// Se executado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const environment = process.env.NODE_ENV || 'development';
  
  runSeeding(environment)
    .then(result => {
      console.log('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}