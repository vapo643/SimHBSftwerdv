/**
 * Teste direto do sistema de alertas proativos
 * Executa o serviço para processar dados reais das propostas
 */

import { alertasProativosService } from './server/services/alertasProativosService';

async function testarAlertas() {
  try {
    console.log('🔍 [TESTE] Iniciando execução do sistema de alertas...');
    console.log('📊 [TESTE] Processando dados reais das propostas...');

    const resultado = await alertasProativosService.executarVerificacaoDiaria();

    console.log('✅ [TESTE] Execução concluída!');
    console.log('📋 [TESTE] Resultado:', resultado);

    // Aguardar um pouco para garantir que as operações assíncronas terminem
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('🎯 [TESTE] Sistema deve ter gerado notificações baseadas em dados reais');
  }
catch (error) {
    console.error('❌ [TESTE] Erro na execução:', error);
  }
finally {
    process.exit(0);
  }
}

testarAlertas();
