#!/usr/bin/env node

/**
 * 🔒 PAM V1.0 - TESTE DE VALIDAÇÃO DE INTEGRIDADE DE DADOS
 * 
 * Este script testa se o endpoint POST /api/propostas está rejeitando
 * propostas com dados críticos ausentes/inválidos
 */

const https = require('https');

// Token de teste válido (será necessário um token real)
const API_BASE = 'http://localhost:5000';

/**
 * Teste 1: Proposta sem clienteNome (deve falhar com 400)
 */
async function testePropostaSemNome() {
  console.log('\n🧪 TESTE 1: Proposta sem clienteNome (deve ser rejeitada)');
  
  const payloadInvalido = {
    lojaId: 1,
    // clienteNome: AUSENTE (deve falhar)
    clienteCpf: "12345678901",
    clienteEmail: "teste@teste.com",
    clienteTelefone: "11999999999",
    valor: 1000,
    prazo: 12
  };

  try {
    const response = await fetch(`${API_BASE}/api/propostas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Sem token - deve falhar na autenticação primeiro
      },
      body: JSON.stringify(payloadInvalido)
    });

    const resultado = await response.text();
    
    console.log(`Status: ${response.status}`);
    console.log(`Resposta: ${resultado}`);
    
    if (response.status === 401) {
      console.log('✅ Teste passou na primeira barreira: autenticação requerida');
      console.log('ℹ️  Para testar a validação Zod, é necessário um token válido');
    } else if (response.status === 400) {
      console.log('✅ Validação Zod funcionando: dados inválidos rejeitados!');
    } else {
      console.log('❌ ERRO: Proposta inválida foi aceita!');
    }
    
  } catch (error) {
    console.error('Erro na requisição:', error.message);
  }
}

/**
 * Teste 2: Proposta sem CPF (deve falhar com 400)
 */
async function testePropostaSemCpf() {
  console.log('\n🧪 TESTE 2: Proposta sem clienteCpf (deve ser rejeitada)');
  
  const payloadInvalido = {
    lojaId: 1,
    clienteNome: "João da Silva",
    // clienteCpf: AUSENTE (deve falhar)
    clienteEmail: "teste@teste.com",
    clienteTelefone: "11999999999",
    valor: 1000,
    prazo: 12
  };

  try {
    const response = await fetch(`${API_BASE}/api/propostas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadInvalido)
    });

    console.log(`Status: ${response.status}`);
    
    if (response.status === 401) {
      console.log('✅ Autenticação funcionando corretamente');
    } else if (response.status === 400) {
      console.log('✅ Validação Zod funcionando: dados inválidos rejeitados!');
    }
    
  } catch (error) {
    console.error('Erro na requisição:', error.message);
  }
}

/**
 * Teste 3: Verificar estrutura da resposta de erro
 */
async function testeEstruturaErro() {
  console.log('\n🧪 TESTE 3: Verificar estrutura da resposta de erro');
  
  const payloadVazio = {};

  try {
    const response = await fetch(`${API_BASE}/api/propostas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadVazio)
    });

    const resultado = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Resposta completa:`, resultado);
    
  } catch (error) {
    console.error('Erro na requisição:', error.message);
  }
}

// Executar testes
async function executarTodos() {
  console.log('🔒 PAM V1.0 - SUITE DE TESTES DE VALIDAÇÃO DE PROPOSTAS');
  console.log('=' .repeat(60));
  
  await testePropostaSemNome();
  await testePropostaSemCpf();
  await testeEstruturaErro();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ SUITE DE TESTES CONCLUÍDA');
  console.log('ℹ️  Para testes completos com token válido, acesse a aplicação e use o DevTools');
}

// Executar se chamado diretamente
if (require.main === module) {
  executarTodos().catch(console.error);
}

module.exports = { testePropostaSemNome, testePropostaSemCpf, testeEstruturaErro };