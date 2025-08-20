#!/usr/bin/env node

/**
 * Script de teste para validar a otimização de performance
 * do processamento paralelo de boletos
 * 
 * PAM V1.0 - Refatoração do Worker de Sincronização
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000';

// Cores para output no console
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

async function testarSincronizacaoParalela() {
  console.log(`${colors.cyan}${colors.bright}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('       TESTE DE PERFORMANCE - SINCRONIZAÇÃO PARALELA           ');
  console.log('                        PAM V1.0                               ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`${colors.reset}`);

  try {
    // 1. Buscar uma proposta com boletos para testar
    console.log(`${colors.blue}📋 Buscando proposta com boletos para teste...${colors.reset}`);
    
    const { data: propostas } = await axios.get(`${API_URL}/api/propostas`, {
      params: { status: 'CONTRATADO' }
    });

    const propostaComBoletos = propostas.find(p => p.numero_contrato);
    
    if (!propostaComBoletos) {
      console.log(`${colors.yellow}⚠️ Nenhuma proposta com boletos encontrada.${colors.reset}`);
      console.log(`${colors.yellow}   Execute primeiro a criação de boletos para uma proposta.${colors.reset}`);
      return;
    }

    const propostaId = propostaComBoletos.id;
    console.log(`${colors.green}✅ Proposta selecionada: ${propostaId}${colors.reset}`);
    console.log(`   Cliente: ${propostaComBoletos.cliente_nome}`);
    console.log(`   Contrato: ${propostaComBoletos.numero_contrato}`);
    console.log('');

    // 2. Executar sincronização e medir tempo
    console.log(`${colors.cyan}${colors.bright}═══════════════════════════════════════════════════════════════`);
    console.log('                  INICIANDO TESTE DE PERFORMANCE                ');
    console.log(`═══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log('');

    console.log(`${colors.magenta}🚀 Iniciando sincronização paralela via Job Queue...${colors.reset}`);
    
    // Medir tempo total de execução
    const startTime = Date.now();
    
    // Chamar endpoint de sincronização
    const { data: jobResult } = await axios.post(`${API_URL}/api/boletos/sincronizar/${propostaId}`);
    
    console.log(`${colors.green}✅ Job enfileirado: ${jobResult.jobId}${colors.reset}`);
    console.log('');

    // Aguardar processamento (polling do status)
    console.log(`${colors.blue}⏳ Aguardando processamento do job...${colors.reset}`);
    
    let jobCompleted = false;
    let tentativas = 0;
    const maxTentativas = 60; // Máximo 3 minutos
    let jobStatus = null;

    while (!jobCompleted && tentativas < maxTentativas) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Aguardar 3 segundos
      
      try {
        const { data: status } = await axios.get(`${API_URL}/api/jobs/status/${jobResult.jobId}`);
        jobStatus = status;
        
        if (status.state === 'completed' || status.state === 'failed') {
          jobCompleted = true;
        } else {
          process.stdout.write(`\r${colors.blue}⏳ Status: ${status.state} - Progresso: ${status.progress || 0}%${colors.reset}`);
        }
      } catch (error) {
        // Job ainda não existe ou erro temporário
      }
      
      tentativas++;
    }

    const endTime = Date.now();
    const tempoTotal = (endTime - startTime) / 1000; // Em segundos

    console.log('\n');

    // 3. Análise dos resultados
    if (jobCompleted && jobStatus) {
      console.log(`${colors.cyan}${colors.bright}═══════════════════════════════════════════════════════════════`);
      console.log('                     RESULTADOS DO TESTE                        ');
      console.log(`═══════════════════════════════════════════════════════════════${colors.reset}`);
      console.log('');

      if (jobStatus.state === 'completed') {
        const resultado = jobStatus.result;
        
        console.log(`${colors.green}${colors.bright}✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO!${colors.reset}`);
        console.log('');
        
        console.log(`${colors.cyan}📊 ESTATÍSTICAS:${colors.reset}`);
        console.log(`   - Total de boletos: ${resultado.totalBoletos}`);
        console.log(`   - Processados com sucesso: ${resultado.boletosProcessados}`);
        console.log(`   - Com erro: ${resultado.boletosComErro}`);
        console.log(`   - Taxa de sucesso: ${((resultado.boletosProcessados / resultado.totalBoletos) * 100).toFixed(1)}%`);
        console.log('');

        console.log(`${colors.magenta}${colors.bright}⏱️ ANÁLISE DE PERFORMANCE:${colors.reset}`);
        console.log(`   - Tempo total: ${tempoTotal.toFixed(2)} segundos`);
        console.log(`   - Tempo por boleto: ${(tempoTotal / resultado.totalBoletos).toFixed(2)} segundos`);
        console.log('');

        // Comparação com arquitetura antiga
        const tempoEstimadoSequencial = resultado.totalBoletos * 5.5; // ~5.5s por boleto na arquitetura antiga
        const reducaoPercentual = ((1 - (tempoTotal / tempoEstimadoSequencial)) * 100).toFixed(1);

        console.log(`${colors.yellow}${colors.bright}📈 COMPARAÇÃO COM ARQUITETURA SEQUENCIAL:${colors.reset}`);
        console.log(`   - Tempo estimado (sequencial): ${tempoEstimadoSequencial.toFixed(2)} segundos`);
        console.log(`   - Tempo real (paralelo): ${tempoTotal.toFixed(2)} segundos`);
        console.log(`   - ${colors.green}${colors.bright}REDUÇÃO: ${reducaoPercentual}%${colors.reset}`);
        console.log('');

        // Validação do critério de sucesso
        if (parseFloat(reducaoPercentual) >= 70) {
          console.log(`${colors.green}${colors.bright}🎯 CRITÉRIO DE SUCESSO ATINGIDO!${colors.reset}`);
          console.log(`   Meta: Redução de 70% no tempo de processamento`);
          console.log(`   Alcançado: ${reducaoPercentual}% de redução`);
        } else if (parseFloat(reducaoPercentual) >= 50) {
          console.log(`${colors.yellow}${colors.bright}⚡ BOA OTIMIZAÇÃO!${colors.reset}`);
          console.log(`   Meta: Redução de 70% no tempo de processamento`);
          console.log(`   Alcançado: ${reducaoPercentual}% de redução`);
          console.log(`   Sugestão: Ajustar BATCH_SIZE para melhorar performance`);
        } else {
          console.log(`${colors.red}${colors.bright}⚠️ OTIMIZAÇÃO ABAIXO DO ESPERADO${colors.reset}`);
          console.log(`   Meta: Redução de 70% no tempo de processamento`);
          console.log(`   Alcançado: ${reducaoPercentual}% de redução`);
          console.log(`   Ação: Revisar implementação do processamento paralelo`);
        }

        if (resultado.erros && resultado.erros.length > 0) {
          console.log('');
          console.log(`${colors.yellow}⚠️ Erros encontrados durante o processamento:${colors.reset}`);
          resultado.erros.forEach((erro, index) => {
            console.log(`   ${index + 1}. Boleto ${erro.codigoSolicitacao}: ${erro.erro}`);
          });
        }

      } else {
        console.log(`${colors.red}❌ Job falhou: ${jobStatus.error || 'Erro desconhecido'}${colors.reset}`);
      }
    } else {
      console.log(`${colors.red}❌ Timeout: Job não completou em tempo hábil${colors.reset}`);
    }

  } catch (error) {
    console.error(`${colors.red}❌ Erro durante o teste:${colors.reset}`, error.message);
    if (error.response) {
      console.error('Detalhes:', error.response.data);
    }
  }

  console.log('');
  console.log(`${colors.cyan}${colors.bright}═══════════════════════════════════════════════════════════════`);
  console.log('                   TESTE CONCLUÍDO                              ');
  console.log(`═══════════════════════════════════════════════════════════════${colors.reset}`);
}

// Executar teste
testarSincronizacaoParalela();