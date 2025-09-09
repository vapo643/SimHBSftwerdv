#!/usr/bin/env tsx

/**
 * OPERAÇÃO TOQUE DE REALIDADE - Diagnóstico de Conectividade DEV
 * Validação ativa das conexões críticas do ambiente de desenvolvimento
 */

console.log('🔍 [DIAGNÓSTICO DE AMBIENTE DEV] Iniciando verificações...\n');

// ==========================================
// 1. VERIFICAÇÃO DO SUPABASE DEV
// ==========================================

console.log('1. Verificando Conexão com Supabase (Admin Client)...');

async function checkSupabaseDev() {
  try {
    // Carregar variáveis diretamente (verificando todas as opções)
    const supabaseUrl = process.env.DEV_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.DEV_SUPABASE_SERVICE_ROLE_KEY || 
                               process.env.DEV_SUPABASE_SERVICE_KEY ||
                               process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log(`   - DEV_SUPABASE_URL: ${supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NÃO CARREGADA'}`);
    console.log(`   - DEV_SUPABASE_SERVICE_KEY: ${supabaseServiceKey ? '******** (CARREGADA)' : 'NÃO CARREGADA'}`);
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('   - STATUS: ❌ FALHA - Variáveis de ambiente ausentes');
      return false;
    }

    // Tentar conexão direta com Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Teste simples de conectividade
    const { data, error, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`   - STATUS: ❌ FALHA - Erro na query: ${error.message}`);
      return false;
    }
    
    console.log('   - STATUS: ✅ SUCESSO - Conexão com Supabase Admin estabelecida');
    return true;
    
  } catch (error: any) {
    console.log(`   - STATUS: ❌ FALHA - Erro de conexão: ${error.message}`);
    return false;
  }
}

// ==========================================
// 2. VERIFICAÇÃO DO REDIS
// ==========================================

async function checkRedis() {
  console.log('\n-----\n');
  console.log('2. Verificando Conexão com Redis...');
  
  try {
    const redisUrl = process.env.REDIS_URL;
    console.log(`   - REDIS_URL: ${redisUrl ? '******** (CARREGADA)' : 'NÃO CARREGADA'}`);
    
    if (!redisUrl) {
      console.log('   - STATUS: ❌ FALHA - REDIS_URL não configurada');
      return false;
    }

    // Tentar conexão direta com Redis
    const Redis = await import('ioredis');
    const redis = new Redis.default(redisUrl);
    
    // Teste de conectividade
    const pong = await redis.ping();
    
    if (pong === 'PONG') {
      console.log('   - STATUS: ✅ SUCESSO - Conexão com Redis estabelecida');
      await redis.disconnect();
      return true;
    } else {
      console.log('   - STATUS: ❌ FALHA - Redis não respondeu ao PING');
      await redis.disconnect();
      return false;
    }
    
  } catch (error: any) {
    console.log(`   - STATUS: ❌ FALHA - Erro de conexão: ${error.message}`);
    return false;
  }
}

// ==========================================
// 3. VERIFICAÇÃO DO JWT-AUTH-MIDDLEWARE
// ==========================================

async function checkJWTMiddleware() {
  console.log('\n-----\n');
  console.log('3. Verificando JWT Auth Middleware...');
  
  try {
    // Verificar se o middleware pode importar dependências
    const { jwtAuthMiddleware } = await import('../../server/lib/jwt-auth-middleware');
    console.log('   - Importação do middleware: ✅ SUCESSO');
    
    // Verificar configuração do JWT Secret
    const jwtSecret = process.env.JWT_SECRET;
    console.log(`   - JWT_SECRET: ${jwtSecret ? '******** (CARREGADA)' : 'NÃO CARREGADA'}`);
    
    return true;
  } catch (error: any) {
    console.log(`   - STATUS: ❌ FALHA - Erro no middleware: ${error.message}`);
    return false;
  }
}

// ==========================================
// EXECUÇÃO PRINCIPAL
// ==========================================

async function main() {
  const results = {
    supabase: await checkSupabaseDev(),
    redis: await checkRedis(),
    middleware: await checkJWTMiddleware()
  };
  
  console.log('\n-----\n');
  console.log('## [VEREDITO FINAL]');
  
  const allPassed = Object.values(results).every(result => result === true);
  
  if (allPassed) {
    console.log('🎯 STATUS GERAL: ✅ TODOS OS SERVIÇOS OPERACIONAIS');
    console.log('📋 ANÁLISE: O problema pode estar na lógica de validação de token ou no fluxo de autenticação.');
  } else {
    console.log('🚨 STATUS GERAL: ❌ FALHAS CRÍTICAS DETECTADAS');
    console.log('📋 SERVIÇOS COM FALHA:');
    
    Object.entries(results).forEach(([service, status]) => {
      if (!status) {
        console.log(`   - ${service.toUpperCase()}: ❌ FALHOU`);
      }
    });
  }
  
  console.log('\n🔍 [DIAGNÓSTICO CONCLUÍDO]');
}

// Executar diagnóstico
main().catch(console.error);