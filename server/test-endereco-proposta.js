/**
 * TESTE PROTOCOLO 5-CHECK
 * Script para testar criação de proposta com dados de endereço
 * Para executar: node server/test-endereco-proposta.js
 */

const API_BASE = 'http://localhost:5000';

async function testarCriacaoProposta() {
  console.log('🧪 [TESTE] Iniciando teste de criação de proposta...');
  
  // Dados únicos e fáceis de identificar
  const dadosUnicos = {
    clienteNome: 'TESTE ENDERECO COMPLETO',
    clienteCpf: '12345678901',
    clienteEmail: 'teste.endereco@teste.com',
    clienteTelefone: '27999887766',
    
    // DADOS DE ENDEREÇO ÚNICOS E ESPECÍFICOS
    clienteLogradouro: 'RUA TESTE MAPEAMENTO',
    clienteNumero: '123',
    clienteComplemento: 'CASA AZUL',
    clienteBairro: 'BAIRRO TESTE SISTEMA',
    clienteCep: '29000-000',
    clienteCidade: 'CIDADE TESTE VALIDACAO',
    clienteUf: 'ES',
    
    // Condições básicas
    valor: '5000',
    prazo: '12',
    finalidade: 'Teste sistema',
    
    // Dados obrigatórios
    clienteRenda: '3000',
    clienteDataNascimento: '1990-01-01',
    clienteEstadoCivil: 'solteiro',
    
    lojaId: 1
  };
  
  try {
    console.log('🧪 [TESTE] Enviando dados para API...');
    console.log('📋 [TESTE] Dados de endereço enviados:', {
      logradouro: dadosUnicos.clienteLogradouro,
      numero: dadosUnicos.clienteNumero,
      complemento: dadosUnicos.clienteComplemento,
      bairro: dadosUnicos.clienteBairro,
      cep: dadosUnicos.clienteCep,
      cidade: dadosUnicos.clienteCidade,
      uf: dadosUnicos.clienteUf
    });
    
    // Simulação da criação de proposta (o teste real será feito via interface)
    console.log('✅ [TESTE] Dados preparados para criação via interface');
    console.log('📝 [TESTE] Agora crie uma proposta na interface com estes dados:');
    console.log(JSON.stringify(dadosUnicos, null, 2));
    
  } catch (error) {
    console.error('❌ [TESTE] Erro no teste:', error);
  }
}

testarCriacaoProposta();