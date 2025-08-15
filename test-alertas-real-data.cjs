/**
 * Script para testar o sistema de alertas proativos com dados reais
 * Este script executa o serviço e verifica se gera notificações automaticamente
 */

const { execSync } = require('child_process');

console.log('🔍 Executando sistema de alertas proativos...');
console.log('📊 Processando dados reais das propostas...');

try {
  // Importar e executar o serviço diretamente
  const result = execSync('tsx -e "' +
    'import { alertasProativosService } from \"./server/services/alertasProativosService\"; ' +
    '(async () => { ' +
    '  try { ' +
    '    console.log(\"[TESTE] Executando verificação diária...\"); ' +
    '    await alertasProativosService.executarVerificacaoDiaria(); ' +
    '    console.log(\"[TESTE] ✅ Verificação concluída\"); ' +
    '  } catch (err) { ' +
    '    console.error(\"[TESTE] ❌ Erro:\", err); ' +
    '  } ' +
    '})();' +
    '"', { 
    encoding: 'utf8',
    cwd: process.cwd()
  });
  
  console.log('📝 Resultado:', result);
} catch (error) {
  console.error('❌ Erro ao executar:', error.message);
  console.log('📋 Tentando método alternativo...');
  
  // Método alternativo: executar via node
  try {
    const altResult = execSync('node -e "' +
      'const service = require(\"./server/services/alertasProativosService.ts\"); ' +
      'service.alertasProativosService.executarVerificacaoDiaria().then(() => console.log(\"Concluído\"));' +
      '"', { encoding: 'utf8' });
    console.log('📝 Resultado alternativo:', altResult);
  } catch (altError) {
    console.error('❌ Erro no método alternativo:', altError.message);
  }
}