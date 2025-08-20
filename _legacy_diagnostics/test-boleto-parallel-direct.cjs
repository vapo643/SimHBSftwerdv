#!/usr/bin/env node

/**
 * Teste direto de performance do processamento paralelo de boletos
 * PAM V1.0 - Validação da otimização sem autenticação
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.development') });

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

async function testarPerformanceParalela() {
  console.log(`${colors.cyan}${colors.bright}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('     TESTE DIRETO - PROCESSAMENTO PARALELO DE BOLETOS          ');
  console.log('                         PAM V1.0                              ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`${colors.reset}`);

  try {
    // Importar o serviço diretamente
    const { boletoStorageService } = await import('./server/services/boletoStorageService.ts');
    const { createServerSupabaseAdminClient } = await import('./server/lib/supabase.ts');
    
    const supabase = createServerSupabaseAdminClient();
    
    // Buscar uma proposta com boletos
    console.log(`${colors.blue}📋 Buscando proposta com boletos para teste...${colors.reset}`);
    
    const { data: propostas, error } = await supabase
      .from('propostas')
      .select('*')
      .eq('status', 'CONTRATADO')
      .not('numero_contrato', 'is', null)
      .limit(1);
    
    if (error || !propostas || propostas.length === 0) {
      console.log(`${colors.yellow}⚠️ Nenhuma proposta com boletos encontrada.${colors.reset}`);
      console.log('   Execute primeiro a criação de boletos para uma proposta.');
      return;
    }
    
    const proposta = propostas[0];
    console.log(`${colors.green}✅ Proposta selecionada: ${proposta.id}${colors.reset}`);
    console.log(`   Cliente: ${proposta.cliente_nome}`);
    console.log(`   Contrato: ${proposta.numero_contrato}`);
    console.log('');
    
    // Verificar se existem collections para esta proposta
    const { data: collections } = await supabase
      .from('inter_collections')
      .select('*')
      .eq('proposta_id', proposta.id);
    
    if (!collections || collections.length === 0) {
      console.log(`${colors.yellow}⚠️ Nenhum boleto encontrado no banco de dados.${colors.reset}`);
      console.log('   A proposta precisa ter boletos criados primeiro.');
      return;
    }
    
    console.log(`${colors.green}📊 Encontrados ${collections.length} boletos no banco${colors.reset}`);
    console.log('');
    
    console.log(`${colors.cyan}${colors.bright}═══════════════════════════════════════════════════════════════`);
    console.log('              EXECUTANDO SINCRONIZAÇÃO PARALELA                 ');
    console.log(`═══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log('');
    
    // Executar sincronização e medir tempo
    console.log(`${colors.magenta}🚀 Iniciando processamento paralelo em lotes...${colors.reset}`);
    const startTime = Date.now();
    
    // Chamar o serviço diretamente
    const resultado = await boletoStorageService.sincronizarBoletosDaProposta(proposta.id);
    
    const endTime = Date.now();
    const tempoTotal = (endTime - startTime) / 1000; // Em segundos
    
    console.log('');
    console.log(`${colors.cyan}${colors.bright}═══════════════════════════════════════════════════════════════`);
    console.log('                      ANÁLISE DE RESULTADOS                     ');
    console.log(`═══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log('');
    
    if (resultado.success) {
      console.log(`${colors.green}${colors.bright}✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO!${colors.reset}`);
    } else {
      console.log(`${colors.yellow}${colors.bright}⚠️ SINCRONIZAÇÃO PARCIAL${colors.reset}`);
    }
    console.log('');
    
    console.log(`${colors.cyan}📊 ESTATÍSTICAS:${colors.reset}`);
    console.log(`   - Total de boletos: ${resultado.totalBoletos}`);
    console.log(`   - Processados com sucesso: ${resultado.boletosProcessados}`);
    console.log(`   - Com erro: ${resultado.boletosComErro}`);
    console.log(`   - Taxa de sucesso: ${((resultado.boletosProcessados / resultado.totalBoletos) * 100).toFixed(1)}%`);
    console.log('');
    
    console.log(`${colors.magenta}${colors.bright}⏱️ ANÁLISE DE PERFORMANCE:${colors.reset}`);
    console.log(`   - Tempo total: ${tempoTotal.toFixed(2)} segundos`);
    console.log(`   - Tempo médio por boleto: ${(tempoTotal / resultado.totalBoletos).toFixed(2)} segundos`);
    console.log(`   - Taxa de processamento: ${(resultado.totalBoletos / tempoTotal).toFixed(1)} boletos/segundo`);
    console.log('');
    
    // Comparação com arquitetura sequencial
    const tempoEstimadoSequencial = resultado.totalBoletos * 5.5; // ~5.5s por boleto (download + upload + delay)
    const reducaoPercentual = ((1 - (tempoTotal / tempoEstimadoSequencial)) * 100);
    
    console.log(`${colors.yellow}${colors.bright}📈 COMPARAÇÃO COM ARQUITETURA SEQUENCIAL:${colors.reset}`);
    console.log(`   - Tempo estimado (sequencial): ${tempoEstimadoSequencial.toFixed(2)} segundos`);
    console.log(`   - Tempo real (paralelo): ${tempoTotal.toFixed(2)} segundos`);
    console.log(`   - Economia de tempo: ${(tempoEstimadoSequencial - tempoTotal).toFixed(2)} segundos`);
    
    if (reducaoPercentual > 0) {
      console.log(`   - ${colors.green}${colors.bright}REDUÇÃO: ${reducaoPercentual.toFixed(1)}%${colors.reset}`);
    } else {
      console.log(`   - ${colors.red}Aumento: ${Math.abs(reducaoPercentual).toFixed(1)}%${colors.reset}`);
    }
    console.log('');
    
    // Validação do critério de sucesso PAM V1.0
    console.log(`${colors.cyan}${colors.bright}═══════════════════════════════════════════════════════════════`);
    console.log('                    CRITÉRIO DE SUCESSO PAM V1.0                ');
    console.log(`═══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log('');
    
    if (reducaoPercentual >= 70) {
      console.log(`${colors.green}${colors.bright}🎯 MISSÃO CUMPRIDA COM EXCELÊNCIA!${colors.reset}`);
      console.log(`   Meta: Redução de 70% no tempo de processamento`);
      console.log(`   Alcançado: ${reducaoPercentual.toFixed(1)}% de redução`);
      console.log(`   Status: ${colors.green}SUPERADO${colors.reset}`);
    } else if (reducaoPercentual >= 50) {
      console.log(`${colors.yellow}${colors.bright}⚡ BOA OTIMIZAÇÃO ALCANÇADA!${colors.reset}`);
      console.log(`   Meta: Redução de 70% no tempo de processamento`);
      console.log(`   Alcançado: ${reducaoPercentual.toFixed(1)}% de redução`);
      console.log(`   Status: ${colors.yellow}PARCIALMENTE ATINGIDO${colors.reset}`);
      console.log('');
      console.log(`${colors.blue}💡 Sugestões para melhorar:${colors.reset}`);
      console.log('   - Aumentar BATCH_SIZE para 8-10 boletos');
      console.log('   - Reduzir delay entre lotes para 500ms');
      console.log('   - Implementar cache de conexão com API');
    } else {
      console.log(`${colors.red}${colors.bright}⚠️ OTIMIZAÇÃO INSUFICIENTE${colors.reset}`);
      console.log(`   Meta: Redução de 70% no tempo de processamento`);
      console.log(`   Alcançado: ${reducaoPercentual.toFixed(1)}% de redução`);
      console.log(`   Status: ${colors.red}NÃO ATINGIDO${colors.reset}`);
      console.log('');
      console.log(`${colors.blue}🔧 Ações necessárias:${colors.reset}`);
      console.log('   - Verificar se Promise.all está funcionando corretamente');
      console.log('   - Confirmar que não há gargalo na API');
      console.log('   - Revisar logs para identificar delays não esperados');
    }
    
    if (resultado.erros && resultado.erros.length > 0) {
      console.log('');
      console.log(`${colors.yellow}⚠️ Erros encontrados durante o processamento:${colors.reset}`);
      resultado.erros.slice(0, 5).forEach((erro, index) => {
        console.log(`   ${index + 1}. Código ${erro.codigoSolicitacao}: ${erro.erro}`);
      });
      if (resultado.erros.length > 5) {
        console.log(`   ... e mais ${resultado.erros.length - 5} erros`);
      }
    }
    
  } catch (error) {
    console.error(`${colors.red}❌ Erro durante o teste:${colors.reset}`, error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('');
  console.log(`${colors.cyan}${colors.bright}═══════════════════════════════════════════════════════════════`);
  console.log('                    TESTE CONCLUÍDO - PAM V1.0                  ');
  console.log(`═══════════════════════════════════════════════════════════════${colors.reset}`);
  
  process.exit(0);
}

// Executar teste
testarPerformanceParalela();