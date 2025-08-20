/**
 * TESTE DE SEGURANÇA - VALIDAÇÃO DE PERMISSÕES POR ROLE
 * Verifica se as correções de segurança estão funcionando
 */

const axios = require('axios');
const BASE_URL = 'http://localhost:5000';

// Tokens de teste (você precisa criar esses usuários primeiro)
const TOKENS = {
  ATENDENTE: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',  // Substitua com token real
  ANALISTA: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',   // Substitua com token real
  ADMIN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'       // Substitua com token real
};

console.log('🔒 TESTE DE SEGURANÇA - VALIDAÇÃO DE PERMISSÕES');
console.log('===============================================\n');

async function testeSeguranca() {
  try {
    console.log('⚠️  NOTA: Este teste precisa de tokens JWT válidos');
    console.log('   Configure os tokens no código antes de executar\n');
    
    // TESTE 1: ATENDENTE tentando acessar fila de análise
    console.log('🧪 TESTE 1: ATENDENTE tentando acessar fila de análise');
    console.log('   Esperado: 403 Forbidden');
    
    try {
      const response = await axios.get(`${BASE_URL}/api/propostas?queue=analysis`, {
        headers: { Authorization: `Bearer ${TOKENS.ATENDENTE}` },
        validateStatus: () => true
      });
      
      if (response.status === 403) {
        console.log('   ✅ SUCESSO: Atendente bloqueado (403)');
        console.log(`   Mensagem: ${response.data.message}`);
      } else {
        console.log(`   ❌ FALHA: Status ${response.status} (deveria ser 403)`);
      }
    } catch (error) {
      console.log(`   ❌ ERRO: ${error.message}`);
    }
    
    // TESTE 2: ANALISTA tentando acessar dashboard
    console.log('\n🧪 TESTE 2: ANALISTA tentando acessar dashboard (sem queue=analysis)');
    console.log('   Esperado: 403 Forbidden');
    
    try {
      const response = await axios.get(`${BASE_URL}/api/propostas`, {
        headers: { Authorization: `Bearer ${TOKENS.ANALISTA}` },
        validateStatus: () => true
      });
      
      if (response.status === 403) {
        console.log('   ✅ SUCESSO: Analista bloqueado fora da fila (403)');
        console.log(`   Mensagem: ${response.data.message}`);
      } else {
        console.log(`   ❌ FALHA: Status ${response.status} (deveria ser 403)`);
      }
    } catch (error) {
      console.log(`   ❌ ERRO: ${error.message}`);
    }
    
    // TESTE 3: ATENDENTE vendo apenas suas propostas
    console.log('\n🧪 TESTE 3: ATENDENTE listando propostas');
    console.log('   Esperado: Ver apenas propostas próprias');
    
    try {
      const response = await axios.get(`${BASE_URL}/api/propostas`, {
        headers: { Authorization: `Bearer ${TOKENS.ATENDENTE}` },
        validateStatus: () => true
      });
      
      if (response.status === 200) {
        console.log(`   ✅ Status 200 OK`);
        console.log(`   📊 Total de propostas: ${response.data.length}`);
        
        // Verificar se todas as propostas são do próprio atendente
        const userIdAtendente = 'ID_DO_ATENDENTE'; // Substitua com ID real
        const todasProprias = response.data.every(p => p.userId === userIdAtendente);
        
        if (todasProprias) {
          console.log('   ✅ SEGURANÇA OK: Todas as propostas são do próprio atendente');
        } else {
          console.log('   ❌ FALHA DE SEGURANÇA: Atendente vendo propostas de outros!');
          const outrasLojas = response.data.filter(p => p.userId !== userIdAtendente);
          console.log(`   🚨 ${outrasLojas.length} propostas de outros usuários foram expostas!`);
        }
      } else {
        console.log(`   ⚠️ Status ${response.status}: ${response.data.message}`);
      }
    } catch (error) {
      console.log(`   ❌ ERRO: ${error.message}`);
    }
    
    // TESTE 4: Tentativa de acesso direto por URL
    console.log('\n🧪 TESTE 4: Acesso direto a rotas administrativas');
    
    const rotasProibidas = [
      '/api/users',
      '/api/parceiros', 
      '/api/lojas',
      '/api/tabelas-comerciais'
    ];
    
    for (const rota of rotasProibidas) {
      try {
        const response = await axios.get(`${BASE_URL}${rota}`, {
          headers: { Authorization: `Bearer ${TOKENS.ATENDENTE}` },
          validateStatus: () => true
        });
        
        if (response.status === 403) {
          console.log(`   ✅ ${rota}: Bloqueado (403)`);
        } else {
          console.log(`   ❌ ${rota}: Status ${response.status} - FALHA DE SEGURANÇA!`);
        }
      } catch (error) {
        console.log(`   ⚠️ ${rota}: Erro ${error.message}`);
      }
    }
    
    console.log('\n===============================================');
    console.log('🔒 RESUMO DO TESTE DE SEGURANÇA');
    console.log('✅ = Proteção funcionando');
    console.log('❌ = Vulnerabilidade detectada');
    console.log('⚠️  = Requer investigação');
    
  } catch (error) {
    console.error('❌ ERRO GERAL NO TESTE:', error.message);
  }
}

// Executar testes
console.log('⚠️  IMPORTANTE: Configure tokens JWT válidos antes de executar!');
console.log('   Comente esta linha e descomente a próxima quando estiver pronto:\n');

// testeSeguranca();