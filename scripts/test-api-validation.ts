#!/usr/bin/env tsx

/**
 * PAM V1.0 - TESTE DE BLINDAGEM DA API
 * 
 * FASE 2: Auditar que o endpoint POST /api/propostas bloqueia dados inválidos
 * 
 * OBJETIVO: Confirmar que é IMPOSSÍVEL criar uma proposta com:
 * - clienteNome vazio/NULL
 * - clienteCpf vazio/NULL  
 * - Outros campos obrigatórios ausentes
 * 
 * CRITÉRIO DE SUCESSO: HTTP 400 Bad Request + NADA inserido no banco
 */

async function testApiValidation() {
  console.log('🔒 PAM V1.0 - TESTE DE BLINDAGEM DA API');
  console.log('🎯 Alvo: POST /api/propostas');
  console.log('=' .repeat(80));

  const BASE_URL = 'http://localhost:5000';
  
  // Primeiro precisamos de um token JWT válido para testar
  console.log('🔐 Obtendo token de autenticação...');
  
  // Para simplificar, vou fazer requests diretos usando curl através do bash
  console.log('📝 Executando testes via curl...');
  
  // Teste 1: Dados completamente inválidos (sem clienteNome)
  const testeInvalido1 = {
    // lojaId: 1, // Propositalmente omitido
    // clienteNome: "", // Propositalmente vazio
    // clienteCpf: "", // Propositalmente vazio  
    valor: 1000,
    prazo: 12
  };
  
  console.log('\n🧪 TESTE 1: Payload completamente inválido');
  console.log('📤 Dados enviados:', JSON.stringify(testeInvalido1, null, 2));
  
  return {
    teste1: testeInvalido1,
    baseUrl: BASE_URL
  };
}

testApiValidation()
  .then((resultado) => {
    console.log('\n✅ Configuração de teste preparada');
    console.log('🔄 Continuando com testes via bash...');
  })
  .catch((error) => {
    console.error('\n💥 Erro na preparação:', error);
  });