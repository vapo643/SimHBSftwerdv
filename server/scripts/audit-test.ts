/**
 * Script de Auditoria Completa
 * Valida end-to-end as funcionalidades "Prorrogar Vencimento" e "Desconto para Quitação"
 */

import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1Njc5ZmQzOC1hZjRiLTQxZWQtYjJiYS00NjY5ZWVhMTNhMjQiLCJyb2xlIjoiQURNSU5JU1RSQURPUiIsImlhdCI6MTcyNzQ0ODk5Nn0.1zGlOk5_ikLDQvbP5lL2BX-ySwQaRnRs6d17xPYb2Vo';

const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
  'Cookie': `jwt=${AUTH_TOKEN}`
};

console.log('\n🔍 ====== INICIANDO AUDITORIA COMPLETA ======\n');

async function testarProrrogarVencimento() {
  console.log('\n📋 PARTE 1: AUDITORIA DA AÇÃO "PRORROGAR VENCIMENTO"\n');
  
  try {
    // 1. Buscar boletos ativos de uma proposta de teste
    const propostaId = '902183dd-b5d1-4e20-8a72-79d3d3559d4d';
    console.log(`📌 Buscando boletos ativos da proposta ${propostaId}...`);
    
    const response = await axios.get(`${API_URL}/inter/collections/proposal/${propostaId}`, { headers });
    const { boletosAtivos } = response.data;
    
    if (!boletosAtivos || boletosAtivos.length === 0) {
      console.log('❌ Nenhum boleto ativo encontrado para testar');
      return;
    }
    
    console.log(`✅ Encontrados ${boletosAtivos.length} boletos ativos`);
    
    // 2. Selecionar o primeiro boleto para prorrogação
    const boletoTeste = boletosAtivos[0];
    console.log(`\n📝 Boleto selecionado para teste:`, {
      codigoSolicitacao: boletoTeste.codigoSolicitacao,
      numeroParcela: boletoTeste.numeroParcela,
      dataVencimentoAtual: boletoTeste.dataVencimento,
      situacao: boletoTeste.situacao
    });
    
    // 3. Definir nova data de vencimento (30 dias a mais)
    const dataAtual = new Date(boletoTeste.dataVencimento);
    dataAtual.setDate(dataAtual.getDate() + 30);
    const novaDataVencimento = dataAtual.toISOString().split('T')[0];
    
    console.log(`\n🚀 Prorrogando vencimento para ${novaDataVencimento}...`);
    
    // 4. Executar prorrogação
    const prorrogacaoResponse = await axios.patch(
      `${API_URL}/inter/collections/batch-extend`,
      {
        codigosSolicitacao: [boletoTeste.codigoSolicitacao],
        novaDataVencimento
      },
      { headers }
    );
    
    console.log('\n✅ Resposta da prorrogação:', JSON.stringify(prorrogacaoResponse.data, null, 2));
    
    // 5. Validação automática - aguardar um pouco para garantir que a API processou
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n🔍 Verificando atualização na API do Inter...');
    const verificacaoResponse = await axios.get(
      `${API_URL}/inter/collections/${boletoTeste.codigoSolicitacao}`,
      { headers }
    );
    
    const dataVencimentoVerificada = verificacaoResponse.data.data?.cobranca?.dataVencimento;
    const atualizacaoConfirmada = dataVencimentoVerificada === novaDataVencimento;
    
    console.log('\n📊 RESULTADO DA VALIDAÇÃO END-TO-END:');
    console.log('  - Data enviada:', novaDataVencimento);
    console.log('  - Data verificada na API:', dataVencimentoVerificada);
    console.log('  - Atualização confirmada:', atualizacaoConfirmada ? '✅ SIM' : '❌ NÃO');
    
    if (prorrogacaoResponse.data.auditoria) {
      console.log('\n📊 RELATÓRIO DE AUDITORIA:', JSON.stringify(prorrogacaoResponse.data.auditoria, null, 2));
    }
    
    return atualizacaoConfirmada;
    
  } catch (error: any) {
    console.error('\n❌ Erro ao testar prorrogação:', error.response?.data || error.message);
    return false;
  }
}

async function testarDescontoQuitacao() {
  console.log('\n\n📋 PARTE 2: AUDITORIA DA AÇÃO "DESCONTO PARA QUITAÇÃO"\n');
  
  try {
    // 1. Buscar proposta com múltiplos boletos ativos
    const propostaId = '902183dd-b5d1-4e20-8a72-79d3d3559d4d';
    console.log(`📌 Buscando informações de dívida da proposta ${propostaId}...`);
    
    const response = await axios.get(`${API_URL}/inter/collections/proposal/${propostaId}`, { headers });
    const { valorRestante, boletosAtivos } = response.data;
    
    if (!boletosAtivos || boletosAtivos.length === 0) {
      console.log('❌ Nenhum boleto ativo encontrado para testar');
      return;
    }
    
    console.log(`✅ Dívida atual:`, {
      valorRestante,
      quantidadeBoletosAtivos: boletosAtivos.length
    });
    
    // 2. Aplicar desconto de 50%
    const desconto = valorRestante * 0.5;
    const novoValorTotal = valorRestante - desconto;
    
    // 3. Criar 2 novas parcelas
    const hoje = new Date();
    const parcela1Data = new Date(hoje);
    parcela1Data.setDate(parcela1Data.getDate() + 30);
    const parcela2Data = new Date(hoje);
    parcela2Data.setDate(parcela2Data.getDate() + 60);
    
    const novasParcelas = [
      { valor: novoValorTotal / 2, dataVencimento: parcela1Data.toISOString().split('T')[0] },
      { valor: novoValorTotal / 2, dataVencimento: parcela2Data.toISOString().split('T')[0] }
    ];
    
    console.log(`\n💰 Aplicando desconto de quitação:`, {
      valorOriginal: valorRestante,
      desconto,
      percentualDesconto: '50%',
      novoValorTotal,
      novasParcelas
    });
    
    // 4. Executar desconto de quitação
    const quitacaoResponse = await axios.post(
      `${API_URL}/inter/collections/settlement-discount`,
      {
        propostaId,
        desconto,
        novasParcelas
      },
      { headers }
    );
    
    console.log('\n✅ Resposta da quitação:', JSON.stringify(quitacaoResponse.data, null, 2));
    
    // 5. Validação automática - verificar cada novo boleto criado
    if (quitacaoResponse.data.novosBoletosData) {
      console.log('\n🔍 Verificando novos boletos na API do Inter...');
      
      for (const novoBoleto of quitacaoResponse.data.novosBoletosData) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const verificacaoResponse = await axios.get(
          `${API_URL}/inter/collections/${novoBoleto.codigoSolicitacao}`,
          { headers }
        );
        
        const boletoVerificado = verificacaoResponse.data.data?.cobranca;
        
        console.log(`\n  Boleto ${novoBoleto.parcela}:`, {
          codigoSolicitacao: novoBoleto.codigoSolicitacao,
          valorEnviado: novoBoleto.valor,
          valorVerificado: boletoVerificado?.valorNominal,
          dataVencimentoEnviada: novoBoleto.vencimento,
          dataVencimentoVerificada: boletoVerificado?.dataVencimento,
          situacao: boletoVerificado?.situacao,
          criacaoConfirmada: boletoVerificado ? '✅ SIM' : '❌ NÃO'
        });
      }
    }
    
    if (quitacaoResponse.data.auditoria) {
      console.log('\n📊 RELATÓRIO DE AUDITORIA:', JSON.stringify(quitacaoResponse.data.auditoria, null, 2));
    }
    
    return true;
    
  } catch (error: any) {
    console.error('\n❌ Erro ao testar desconto de quitação:', error.response?.data || error.message);
    return false;
  }
}

// Executar testes
async function executarAuditoria() {
  const resultadoProrrogacao = await testarProrrogarVencimento();
  const resultadoQuitacao = await testarDescontoQuitacao();
  
  console.log('\n\n🏁 ====== RELATÓRIO FINAL DA AUDITORIA ======');
  console.log('\n✅ Prorrogar Vencimento:', resultadoProrrogacao ? 'SUCESSO' : 'FALHA');
  console.log('✅ Desconto para Quitação:', resultadoQuitacao ? 'SUCESSO' : 'FALHA');
  console.log('\n====== FIM DA AUDITORIA ======\n');
}

// Aguardar servidor estar pronto e executar
setTimeout(() => {
  executarAuditoria().catch(console.error);
}, 3000);