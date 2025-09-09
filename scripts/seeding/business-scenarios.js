/**
 * Business Scenario Seeder - Orquestrador de cenários de negócio
 * Operação Soberania dos Dados - Seeding System V1.0
 */
import { faker } from '@faker-js/faker';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Create database connection
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);
import { profiles, propostas } from '../../shared/schema.ts';
import { ProfileGenerator } from './generators/profiles.js';
import { ProposalGenerator } from './generators/proposals.js';
import { DatabaseCleaner } from './utils/database-cleaner.js';

export class BusinessScenarioSeeder {
  
  constructor(config) {
    this.config = config;
    this.profileGenerator = new ProfileGenerator();
    this.proposalGenerator = new ProposalGenerator();
    
    // Configure faker seed para determinismo em staging
    if (config.FAKER_SEED) {
      faker.seed(config.FAKER_SEED);
      console.log(`🎲 [SEEDER] Faker seed definido: ${config.FAKER_SEED}`);
    }
  }

  /**
   * Executa o cenário completo de negócio
   */
  async seedBusinessScenario() {
    console.log('🚀 [BUSINESS SCENARIO] Iniciando seeding de cenário de negócio...');
    
    try {
      // 1. Validar ambiente
      const environment = DatabaseCleaner.validateEnvironment();
      
      // 2. Limpeza segura (se configurado)
      if (this.config.CLEANUP.BEFORE_SEEDING) {
        await DatabaseCleaner.cleanSeedingTables();
      }
      
      // 3. Buscar loja existente
      const lojaId = await this.getFirstLojaId();
      
      // 4. Criar perfis de usuários
      const createdProfiles = await this.createProfiles(lojaId);
      
      // 5. Criar propostas com cenários variados
      await this.createProposals(createdProfiles);
      
      console.log('✅ [BUSINESS SCENARIO] Cenário de negócio criado com sucesso!');
      
      return {
        environment,
        profiles: createdProfiles.length,
        proposals: this.config.QUANTITIES.PROPOSALS,
      };
      
    } catch (error) {
      console.error('❌ [BUSINESS SCENARIO] Falha ao criar cenário:', error);
      throw error;
    }
  }

  /**
   * Busca a primeira loja disponível
   */
  async getFirstLojaId() {
    try {
      const lojas = await db.execute(`SELECT id FROM lojas WHERE is_active = true LIMIT 1`);
      
      if (lojas.rows.length === 0) {
        throw new Error('Nenhuma loja ativa encontrada. Execute o seeding de dados base primeiro.');
      }
      
      const lojaId = lojas.rows[0].id;
      console.log(`🏪 [SEEDER] Usando loja ID: ${lojaId}`);
      return lojaId;
      
    } catch (error) {
      console.error('❌ [SEEDER] Erro ao buscar loja:', error);
      throw error;
    }
  }

  /**
   * Cria perfis de usuários (atendentes)
   */
  async createProfiles(lojaId) {
    console.log('👥 [SEEDER] Criando perfis de usuários...');
    
    const profilesToCreate = [];
    
    // Criar atendentes
    for (let i = 0; i < this.config.QUANTITIES.ATTENDANTS; i++) {
      const attendant = this.profileGenerator.generateAttendant(lojaId);
      profilesToCreate.push(attendant);
    }
    
    // Inserir no banco
    const createdProfiles = [];
    for (const profile of profilesToCreate) {
      try {
        await db.insert(profiles).values(profile);
        createdProfiles.push(profile);
        
        if (this.config.VERBOSE_LOGGING) {
          console.log(`✅ [SEEDER] Perfil criado: ${profile.fullName} (${profile.role})`);
        }
        
      } catch (error) {
        console.error(`❌ [SEEDER] Erro ao criar perfil ${profile.fullName}:`, error);
        throw error;
      }
    }
    
    console.log(`🎯 [SEEDER] ${createdProfiles.length} perfis criados`);
    return createdProfiles;
  }

  /**
   * Cria propostas com cenários de negócio variados
   */
  async createProposals(createdProfiles) {
    console.log('📋 [SEEDER] Criando propostas com cenários variados...');
    
    const analystId = this.config.FIXED_IDS.ANALYST_ID;
    const statusDistribution = this.config.PROPOSAL_STATUS_DISTRIBUTION;
    
    for (let i = 0; i < this.config.QUANTITIES.PROPOSALS; i++) {
      const status = statusDistribution[i] || 'rascunho';
      const proposal = this.proposalGenerator.generateProposal(analystId, status);
      
      try {
        await db.insert(propostas).values(proposal);
        
        if (this.config.VERBOSE_LOGGING) {
          console.log(`✅ [SEEDER] Proposta criada: ${proposal.clienteNome} - Status: ${status} - Valor: R$ ${proposal.valor}`);
        }
        
      } catch (error) {
        console.error(`❌ [SEEDER] Erro ao criar proposta para ${proposal.clienteNome}:`, error);
        throw error;
      }
    }
    
    console.log(`🎯 [SEEDER] ${this.config.QUANTITIES.PROPOSALS} propostas criadas`);
  }

  /**
   * Gera relatório do cenário criado
   */
  async generateScenarioReport() {
    console.log('📊 [SEEDER] Gerando relatório do cenário...');
    
    try {
      const profilesCount = await db.execute('SELECT COUNT(*) as count FROM profiles WHERE role = \'atendente\'');
      const proposalsCount = await db.execute('SELECT status, COUNT(*) as count FROM propostas GROUP BY status ORDER BY status');
      
      console.log('📈 [CENÁRIO RELATÓRIO]');
      console.log(`   👥 Perfis (atendentes): ${profilesCount.rows[0]?.count || 0}`);
      console.log('   📋 Propostas por status:');
      
      for (const row of proposalsCount.rows) {
        console.log(`      - ${row.status}: ${row.count}`);
      }
      
    } catch (error) {
      console.warn('⚠️ [SEEDER] Erro ao gerar relatório:', error.message);
    }
  }
}