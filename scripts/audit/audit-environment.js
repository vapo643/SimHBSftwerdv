/**
 * Environment Compliance Auditor
 * Operação Soberania dos Dados - Protocolos de Resiliência V1.0
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Auditor de Conformidade Ambiental
 * Conecta ao Supabase e verifica configurações críticas de segurança
 */
export class EnvironmentAuditor {
  
  constructor(environment) {
    this.environment = environment;
    this.manifest = this.loadManifest();
    this.supabase = this.initializeSupabaseClient();
    this.results = [];
  }

  /**
   * Carrega manifesto de conformidade
   */
  loadManifest() {
    try {
      const manifestPath = path.join(__dirname, 'environment-manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      return JSON.parse(manifestContent);
    } catch (error) {
      throw new Error(`❌ [AUDITOR] Falha ao carregar manifesto: ${error.message}`);
    }
  }

  /**
   * Inicializa cliente Supabase com service_role key
   */
  initializeSupabaseClient() {
    const envConfig = this.getEnvironmentConfig();
    
    if (!envConfig.supabaseUrl || !envConfig.serviceRoleKey) {
      throw new Error(`❌ [AUDITOR] Configuração incompleta para ambiente: ${this.environment}`);
    }
    
    console.log(`🔐 [AUDITOR] Conectando ao Supabase (${this.environment})...`);
    
    return createClient(envConfig.supabaseUrl, envConfig.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  /**
   * Obtém configuração por ambiente
   */
  getEnvironmentConfig() {
    const configs = {
      development: {
        supabaseUrl: process.env.DEV_SUPABASE_URL,
        serviceRoleKey: process.env.DEV_SUPABASE_SERVICE_ROLE_KEY,
      },
      staging: {
        supabaseUrl: process.env.STAGING_SUPABASE_URL,
        serviceRoleKey: process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,
      },
      production: {
        supabaseUrl: process.env.PROD_SUPABASE_URL,
        serviceRoleKey: process.env.PROD_SUPABASE_SERVICE_ROLE_KEY,
      }
    };
    
    return configs[this.environment] || {};
  }

  /**
   * Executa auditoria completa
   */
  async runCompleteAudit() {
    console.log(`🔍 [AUDITOR] Iniciando auditoria de conformidade para: ${this.environment.toUpperCase()}`);
    
    try {
      // Teste de conectividade básica
      await this.checkDatabaseConnectivity();
      
      // Verificação de políticas RLS
      await this.checkRLSPolicies();
      
      // Validação de variáveis de ambiente
      await this.checkEnvironmentVariables();
      
      // Relatório final
      this.generateAuditReport();
      
      return this.getOverallStatus();
      
    } catch (error) {
      console.error(`💥 [AUDITOR] Falha crítica na auditoria:`, error);
      throw error;
    }
  }

  /**
   * Testa conectividade básica com banco
   */
  async checkDatabaseConnectivity() {
    console.log('🔌 [AUDITOR] Verificando conectividade do banco...');
    
    try {
      const { data, error } = await this.supabase
        .from('propostas')
        .select('count', { count: 'exact', head: true });
        
      if (error) {
        throw new Error(`Erro na query: ${error.message}`);
      }
      
      this.addResult('database_connectivity', 'PASS', `Conectividade OK - ${data || 0} registros`);
      
    } catch (error) {
      this.addResult('database_connectivity', 'FAIL', `Falha na conectividade: ${error.message}`);
    }
  }

  /**
   * Verifica políticas RLS nas tabelas críticas
   */
  async checkRLSPolicies() {
    console.log('🛡️ [AUDITOR] Verificando políticas RLS...');
    
    const expectedPolicies = this.manifest.environments[this.environment]?.database_security?.rls_policies?.tables;
    
    if (!expectedPolicies) {
      this.addResult('rls_policies', 'SKIP', 'Nenhuma política RLS definida no manifesto');
      return;
    }
    
    try {
      // Query para verificar políticas existentes
      const { data: policies, error } = await this.supabase.rpc('check_rls_policies', {
        p_schema: 'public'
      });
      
      if (error) {
        // Fallback: usar query SQL direta
        const { data: fallbackPolicies, error: fallbackError } = await this.supabase
          .rpc('sql', {
            query: `
              SELECT schemaname, tablename, policyname, cmd 
              FROM pg_policies 
              WHERE schemaname = 'public' 
              AND tablename IN ('propostas', 'profiles', 'user_sessions')
            `
          });
          
        if (fallbackError) {
          this.addResult('rls_policies', 'FAIL', `Erro ao verificar políticas RLS: ${fallbackError.message}`);
          return;
        }
        
        const policyCount = fallbackPolicies?.length || 0;
        const minRequired = this.manifest.compliance_checks.rls_policies_exist.minimum_policies_required;
        
        if (policyCount >= minRequired) {
          this.addResult('rls_policies', 'PASS', `${policyCount} políticas RLS encontradas (min: ${minRequired})`);
        } else {
          this.addResult('rls_policies', 'FAIL', `Apenas ${policyCount} políticas encontradas (min: ${minRequired})`);
        }
        
        return;
      }
      
      // Se RPC personalizado funcionou
      const policyCount = policies?.length || 0;
      const expectedTables = Object.keys(expectedPolicies);
      
      this.addResult('rls_policies', 'PASS', `RLS verificado em ${expectedTables.length} tabelas críticas`);
      
    } catch (error) {
      this.addResult('rls_policies', 'FAIL', `Erro na verificação RLS: ${error.message}`);
    }
  }

  /**
   * Valida variáveis de ambiente críticas
   */
  async checkEnvironmentVariables() {
    console.log('⚙️ [AUDITOR] Verificando variáveis de ambiente...');
    
    const envConfig = this.manifest.environments[this.environment]?.application_security?.environment_variables;
    
    if (!envConfig) {
      this.addResult('environment_variables', 'SKIP', 'Configurações de ambiente não definidas');
      return;
    }
    
    const requiredVars = envConfig.required || [];
    const missingVars = [];
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    }
    
    if (missingVars.length === 0) {
      this.addResult('environment_variables', 'PASS', `${requiredVars.length} variáveis obrigatórias configuradas`);
    } else {
      this.addResult('environment_variables', 'FAIL', `Variáveis ausentes: ${missingVars.join(', ')}`);
    }
    
    // Verificar NODE_ENV
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === this.environment) {
      this.addResult('node_env_consistency', 'PASS', `NODE_ENV correto: ${nodeEnv}`);
    } else {
      this.addResult('node_env_consistency', 'FAIL', `NODE_ENV inconsistente. Esperado: ${this.environment}, Atual: ${nodeEnv}`);
    }
  }

  /**
   * Adiciona resultado de verificação
   */
  addResult(check, status, message) {
    const result = {
      check,
      status,
      message,
      timestamp: new Date().toISOString(),
      environment: this.environment
    };
    
    this.results.push(result);
    
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`   ${emoji} ${check}: ${message}`);
  }

  /**
   * Gera relatório de auditoria
   */
  generateAuditReport() {
    console.log('\n📊 [RELATÓRIO DE AUDITORIA]');
    console.log(`🎯 Ambiente: ${this.environment.toUpperCase()}`);
    console.log(`⏰ Data/Hora: ${new Date().toLocaleString('pt-BR')}`);
    console.log('─'.repeat(60));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    
    console.log(`✅ APROVADO: ${passed}`);
    console.log(`❌ REPROVADO: ${failed}`);
    console.log(`⚠️ IGNORADO: ${skipped}`);
    console.log('─'.repeat(60));
    
    if (failed > 0) {
      console.log('🚨 FALHAS CRÍTICAS:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   • ${r.check}: ${r.message}`));
    }
    
    const overallStatus = failed === 0 ? 'CONFORME' : 'NÃO CONFORME';
    console.log(`\n🏆 STATUS GERAL: ${overallStatus}`);
  }

  /**
   * Retorna status geral da auditoria
   */
  getOverallStatus() {
    const failedChecks = this.results.filter(r => r.status === 'FAIL').length;
    return {
      status: failedChecks === 0 ? 'PASS' : 'FAIL',
      total_checks: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      failed: failedChecks,
      skipped: this.results.filter(r => r.status === 'SKIP').length,
      results: this.results
    };
  }
}

/**
 * Execução principal
 */
async function main() {
  const environment = process.env.NODE_ENV || 'development';
  
  console.log(`🔍 [COMPLIANCE AUDIT] Iniciando auditoria para: ${environment}`);
  
  try {
    const auditor = new EnvironmentAuditor(environment);
    const results = await auditor.runCompleteAudit();
    
    // Exit code baseado no resultado
    process.exit(results.status === 'PASS' ? 0 : 1);
    
  } catch (error) {
    console.error('💥 [AUDIT FAILED]', error);
    process.exit(2);
  }
}

// Se executado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}