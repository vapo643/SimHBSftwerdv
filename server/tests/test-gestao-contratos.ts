/**
 * Testes para API de Gestão de Contratos
 * 
 * Este arquivo demonstra como testar o endpoint /api/contratos
 * com diferentes roles (ADMIN, DIRETOR, e roles não autorizados)
 */

import axios from 'axios';

// Configuração base
const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const API_ENDPOINT = `${BASE_URL}/api/contratos`;

/**
 * Simula tokens JWT para diferentes roles
 * Em produção, use tokens reais obtidos via login
 */
const MOCK_TOKENS = {
  ADMIN: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.admin_token_here',
  DIRETOR: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.diretor_token_here',
  GERENTE: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.gerente_token_here',
  ATENDENTE: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.atendente_token_here',
  ANALISTA: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.analista_token_here',
  NO_TOKEN: null
};

// Cores para output no console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

/**
 * Teste 1: Acesso AUTORIZADO com role ADMINISTRADOR
 */
async function testAdminAccess() {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}TESTE 1: Acesso com ADMINISTRADOR${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  
  try {
    const response = await axios.get(API_ENDPOINT, {
      headers: {
        'Authorization': MOCK_TOKENS.ADMIN,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`${colors.green}✅ Status: ${response.status} - Acesso PERMITIDO${colors.reset}`);
    console.log(`${colors.green}✅ Resposta contém:${colors.reset}`);
    console.log(`   - success: ${response.data.success}`);
    console.log(`   - contratos: ${response.data.contratos?.length || 0} registros`);
    console.log(`   - estatisticas:`, response.data.estatisticas);
    
    // Validar estrutura da resposta
    if (response.data.contratos && response.data.contratos.length > 0) {
      const primeiroContrato = response.data.contratos[0];
      console.log(`\n${colors.green}✅ Estrutura do contrato válida:${colors.reset}`);
      console.log(`   - ID: ${primeiroContrato.id}`);
      console.log(`   - Cliente: ${primeiroContrato.clienteNome}`);
      console.log(`   - CPF/CNPJ: ${primeiroContrato.clienteCpf || primeiroContrato.clienteCnpj}`);
      console.log(`   - CCB Assinado: ${primeiroContrato.assinaturaEletronicaConcluida}`);
      console.log(`   - URL CCB: ${primeiroContrato.urlCcbAssinado ? 'Presente' : 'Ausente'}`);
    }
    
    return true;
  } catch (error: any) {
    console.log(`${colors.red}❌ Erro: ${error.response?.status || error.message}${colors.reset}`);
    console.log(`${colors.red}❌ Mensagem: ${error.response?.data?.message || error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Teste 2: Acesso AUTORIZADO com role DIRETOR
 */
async function testDiretorAccess() {
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}TESTE 2: Acesso com DIRETOR${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  
  try {
    const response = await axios.get(API_ENDPOINT, {
      headers: {
        'Authorization': MOCK_TOKENS.DIRETOR,
        'Content-Type': 'application/json'
      },
      params: {
        limite: 10,
        status: 'contratos_assinados'
      }
    });
    
    console.log(`${colors.green}✅ Status: ${response.status} - Acesso PERMITIDO${colors.reset}`);
    console.log(`${colors.green}✅ Filtros aplicados:${colors.reset}`);
    console.log(`   - limite: 10`);
    console.log(`   - status: contratos_assinados`);
    console.log(`${colors.green}✅ Contratos retornados: ${response.data.contratos?.length || 0}${colors.reset}`);
    
    return true;
  } catch (error: any) {
    console.log(`${colors.red}❌ Erro: ${error.response?.status || error.message}${colors.reset}`);
    console.log(`${colors.red}❌ Mensagem: ${error.response?.data?.message || error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Teste 3: Acesso NEGADO com role GERENTE (não autorizado)
 */
async function testGerenteAccess() {
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}TESTE 3: Acesso com GERENTE (não autorizado)${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  
  try {
    const response = await axios.get(API_ENDPOINT, {
      headers: {
        'Authorization': MOCK_TOKENS.GERENTE,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`${colors.red}❌ FALHA: Status ${response.status} - Deveria retornar 403${colors.reset}`);
    return false;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.log(`${colors.green}✅ Status: 403 - Acesso NEGADO corretamente${colors.reset}`);
      console.log(`${colors.green}✅ Mensagem: ${error.response.data.message}${colors.reset}`);
      console.log(`${colors.green}✅ Roles requeridos: ${JSON.stringify(error.response.data.requiredRoles)}${colors.reset}`);
      console.log(`${colors.green}✅ Role do usuário: ${error.response.data.userRole}${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}❌ Erro inesperado: ${error.response?.status || error.message}${colors.reset}`);
      return false;
    }
  }
}

/**
 * Teste 4: Acesso NEGADO com role ATENDENTE (não autorizado)
 */
async function testAtendenteAccess() {
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}TESTE 4: Acesso com ATENDENTE (não autorizado)${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  
  try {
    const response = await axios.get(API_ENDPOINT, {
      headers: {
        'Authorization': MOCK_TOKENS.ATENDENTE,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`${colors.red}❌ FALHA: Status ${response.status} - Deveria retornar 403${colors.reset}`);
    return false;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.log(`${colors.green}✅ Status: 403 - Acesso NEGADO corretamente${colors.reset}`);
      console.log(`${colors.green}✅ Bloqueado para ATENDENTE como esperado${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}❌ Erro inesperado: ${error.response?.status || error.message}${colors.reset}`);
      return false;
    }
  }
}

/**
 * Teste 5: Acesso sem token (não autenticado)
 */
async function testNoTokenAccess() {
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}TESTE 5: Acesso sem token de autenticação${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  
  try {
    const response = await axios.get(API_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`${colors.red}❌ FALHA: Status ${response.status} - Deveria retornar 401${colors.reset}`);
    return false;
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log(`${colors.green}✅ Status: 401 - Não autenticado corretamente${colors.reset}`);
      console.log(`${colors.green}✅ Mensagem: ${error.response.data.message}${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}❌ Erro inesperado: ${error.response?.status || error.message}${colors.reset}`);
      return false;
    }
  }
}

/**
 * Teste 6: Buscar contrato específico (ADMIN)
 */
async function testGetSpecificContract(contractId: string) {
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}TESTE 6: Buscar contrato específico${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  
  try {
    const response = await axios.get(`${API_ENDPOINT}/${contractId}`, {
      headers: {
        'Authorization': MOCK_TOKENS.ADMIN,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`${colors.green}✅ Status: ${response.status} - Contrato encontrado${colors.reset}`);
    console.log(`${colors.green}✅ Dados do contrato:${colors.reset}`);
    console.log(`   - ID: ${response.data.contrato?.propostas?.id}`);
    console.log(`   - Histórico: ${response.data.contrato?.historico?.length || 0} registros`);
    console.log(`   - URLs de documentos presentes: ${response.data.contrato?.urlCcbAssinado ? 'Sim' : 'Não'}`);
    
    return true;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`${colors.yellow}⚠️ Contrato ${contractId} não encontrado (404)${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ Erro: ${error.response?.status || error.message}${colors.reset}`);
    }
    return false;
  }
}

/**
 * Teste 7: Filtros de busca
 */
async function testSearchFilters() {
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}TESTE 7: Testar filtros de busca${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  
  const filters = [
    { dataInicio: '2025-01-01', dataFim: '2025-01-31' },
    { lojaId: '1' },
    { status: 'pago' },
    { limite: '5' }
  ];
  
  for (const filter of filters) {
    try {
      console.log(`\n${colors.yellow}Testando filtro: ${JSON.stringify(filter)}${colors.reset}`);
      
      const response = await axios.get(API_ENDPOINT, {
        headers: {
          'Authorization': MOCK_TOKENS.DIRETOR,
          'Content-Type': 'application/json'
        },
        params: filter
      });
      
      console.log(`${colors.green}✅ Filtro aplicado com sucesso${colors.reset}`);
      console.log(`   - Contratos retornados: ${response.data.contratos?.length || 0}`);
      console.log(`   - Filtros aplicados:`, response.data.filtrosAplicados);
    } catch (error: any) {
      console.log(`${colors.red}❌ Erro ao aplicar filtro: ${error.message}${colors.reset}`);
    }
  }
  
  return true;
}

/**
 * Executar todos os testes
 */
async function runAllTests() {
  console.log(`\n${colors.yellow}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.yellow}║   TESTES DA API DE GESTÃO DE CONTRATOS  ║${colors.reset}`);
  console.log(`${colors.yellow}╚════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nEndpoint: ${API_ENDPOINT}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);
  
  const results = [];
  
  // Executar testes sequencialmente
  results.push(await testAdminAccess());
  results.push(await testDiretorAccess());
  results.push(await testGerenteAccess());
  results.push(await testAtendenteAccess());
  results.push(await testNoTokenAccess());
  
  // Teste com ID específico (usar um ID válido do banco)
  // results.push(await testGetSpecificContract('6492cfeb-8b66-4fa7-beb6-c7998be61b78'));
  
  results.push(await testSearchFilters());
  
  // Resumo dos resultados
  console.log(`\n${colors.yellow}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.yellow}║           RESUMO DOS TESTES              ║${colors.reset}`);
  console.log(`${colors.yellow}╚════════════════════════════════════════╝${colors.reset}`);
  
  const passed = results.filter(r => r === true).length;
  const failed = results.filter(r => r === false).length;
  
  console.log(`\nTestes aprovados: ${colors.green}${passed}${colors.reset}`);
  console.log(`Testes falhados: ${colors.red}${failed}${colors.reset}`);
  
  if (failed === 0) {
    console.log(`\n${colors.green}✅ TODOS OS TESTES PASSARAM!${colors.reset}\n`);
  } else {
    console.log(`\n${colors.red}❌ ALGUNS TESTES FALHARAM${colors.reset}\n`);
  }
}

/**
 * Instruções para executar os testes
 */
function printInstructions() {
  console.log(`\n${colors.yellow}INSTRUÇÕES DE USO:${colors.reset}`);
  console.log(`${colors.yellow}==================${colors.reset}\n`);
  console.log(`1. Configure tokens JWT reais:`);
  console.log(`   - Faça login com cada role no sistema`);
  console.log(`   - Capture o token JWT de cada sessão`);
  console.log(`   - Substitua os valores em MOCK_TOKENS\n`);
  
  console.log(`2. Execute os testes:`);
  console.log(`   ${colors.blue}npm run test:contratos${colors.reset}\n`);
  
  console.log(`3. Ou execute diretamente:`);
  console.log(`   ${colors.blue}npx tsx server/tests/test-gestao-contratos.ts${colors.reset}\n`);
  
  console.log(`4. Para testar em produção:`);
  console.log(`   - Mude BASE_URL para a URL de produção`);
  console.log(`   - Use tokens de produção válidos\n`);
  
  console.log(`${colors.yellow}ROLES PERMITIDOS:${colors.reset}`);
  console.log(`   ${colors.green}✅ ADMINISTRADOR${colors.reset}`);
  console.log(`   ${colors.green}✅ DIRETOR${colors.reset}`);
  
  console.log(`\n${colors.yellow}ROLES BLOQUEADOS:${colors.reset}`);
  console.log(`   ${colors.red}❌ GERENTE${colors.reset}`);
  console.log(`   ${colors.red}❌ ATENDENTE${colors.reset}`);
  console.log(`   ${colors.red}❌ ANALISTA${colors.reset}`);
  console.log(`   ${colors.red}❌ FINANCEIRO${colors.reset}\n`);
}

// Executar se chamado diretamente
if (require.main === module) {
  printInstructions();
  runAllTests().catch(console.error);
}

export { runAllTests, testAdminAccess, testDiretorAccess };