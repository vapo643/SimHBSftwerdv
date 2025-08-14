#!/usr/bin/env node
/**
 * PAM V1.0 - Teste das Ações de Cobrança
 * Testa as funcionalidades de Prorrogar Vencimento e Aplicar Desconto
 */

const { execSync } = require('child_process');

// Cores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

console.log(`${colors.blue}🔍 PAM V1.0 - TESTE DE AÇÕES DE COBRANÇA${colors.reset}\n`);

// Função para fazer requisição HTTP
async function testEndpoint(name, method, url, data = null, token = null) {
  console.log(`${colors.yellow}📍 Testando: ${name}${colors.reset}`);
  
  try {
    let curlCmd = `curl -X ${method} http://localhost:5000${url} -H "Content-Type: application/json"`;
    
    if (token) {
      curlCmd += ` -H "Authorization: Bearer ${token}"`;
    }
    
    if (data) {
      curlCmd += ` -d '${JSON.stringify(data)}'`;
    }
    
    curlCmd += ' -s';
    
    const response = execSync(curlCmd, { encoding: 'utf8' });
    const result = JSON.parse(response);
    
    console.log(`${colors.green}✅ Sucesso:${colors.reset}`, result.message || 'Operação concluída');
    
    if (result.auditoria) {
      console.log(`${colors.blue}📊 Auditoria:${colors.reset}`);
      result.auditoria.forEach(audit => {
        console.log(`  - Boleto ${audit.codigoSolicitacao}: ${audit.sucesso ? '✅' : '❌'}`);
      });
    }
    
    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Erro: ${error.message}${colors.reset}`);
    return false;
  }
}

// Testes principais
async function runTests() {
  console.log(`${colors.blue}====== INICIANDO TESTES ======${colors.reset}\n`);
  
  // Teste 1: Prorrogar Vencimento (sem token - deve falhar)
  await testEndpoint(
    'Prorrogar Vencimento - Sem Autenticação',
    'PATCH',
    '/api/inter/collections/batch-extend',
    {
      codigosSolicitacao: ['test-123'],
      novaDataVencimento: '2025-09-14'
    }
  );
  
  console.log('\n---\n');
  
  // Teste 2: Endpoint de Modificação Individual
  await testEndpoint(
    'Modificar Boleto Individual - Prorrogar',
    'PATCH',
    '/api/cobrancas/boletos/test-123',
    {
      action: 'prorrogar',
      dataVencimento: '2025-09-14'
    }
  );
  
  console.log('\n---\n');
  
  // Teste 3: Aplicar Desconto (sem dados - deve falhar)
  await testEndpoint(
    'Aplicar Desconto - Dados Incompletos',
    'POST',
    '/api/inter/collections/settlement-discount',
    {
      propostaId: 'test-proposta'
    }
  );
  
  console.log(`\n${colors.blue}====== TESTES CONCLUÍDOS ======${colors.reset}`);
  console.log(`\n${colors.yellow}📌 Observações:${colors.reset}`);
  console.log('1. Os endpoints requerem autenticação JWT válida');
  console.log('2. Apenas usuários ADMIN ou FINANCEIRO podem executar as ações');
  console.log('3. Os boletos devem estar em status modificável (não PAGO/CANCELADO)');
  console.log('4. A integração com Banco Inter está ativa em produção');
}

// Executar testes
runTests().catch(console.error);