/**
 * Staging Environment Configuration
 * Operação Soberania dos Dados - Seeding System V1.0
 */
export const STAGING_CONFIG = {
  // Configurações de determinismo para staging
  FAKER_SEED: 12345, // Seed fixo para resultados determinísticos
  
  // Quantidades de dados a serem gerados
  QUANTITIES: {
    ATTENDANTS: 1,      // 1 atendente
    CLIENTS: 2,         // 2 clientes (propostas)
    PROPOSALS: 3,       // 3 propostas total
  },
  
  // Distribuição de status das propostas
  PROPOSAL_STATUS_DISTRIBUTION: [
    'aprovado',    // Primeira proposta: aprovada
    'rejeitado',   // Segunda proposta: rejeitada
    'pendente',    // Terceira proposta: pendente de análise
  ],
  
  // IDs fixos para staging (facilita testes)
  FIXED_IDS: {
    ANALYST_ID: 'staging-analyst-001',
    LOJA_ID: 1, // Usar loja existente (primeira loja encontrada)
  },
  
  // Configurações de limpeza
  CLEANUP: {
    BEFORE_SEEDING: true,  // Limpar antes de popular
    SAFE_MODE: true,       // Modo seguro (só limpa tabelas específicas)
  },
  
  // Logs e debugging
  VERBOSE_LOGGING: true,
};