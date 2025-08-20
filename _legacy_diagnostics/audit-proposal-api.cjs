/**
 * Auditoria completa via API
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

console.log('🔍 AUDITORIA COMPLETA DO FLUXO DE PROPOSTAS VIA API');
console.log('==================================================\n');

async function auditProposalFlow() {
  try {
    // 1. Verificar propostas existentes
    console.log('📊 1. VERIFICANDO PROPOSTAS NO SISTEMA:');
    try {
      const proposalsResponse = await axios.get(`${API_URL}/propostas`);
      const proposals = proposalsResponse.data;
      
      if (!proposals || proposals.length === 0) {
        console.log('   ❌ Nenhuma proposta encontrada no sistema!');
        console.log('   💡 Crie uma proposta primeiro para testar o fluxo');
        return;
      }
      
      // Contar por status
      const statusCount = {};
      proposals.forEach(p => {
        statusCount[p.status] = (statusCount[p.status] || 0) + 1;
      });
      
      console.log(`   Total de propostas: ${proposals.length}`);
      Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`   - ${status}: ${count} propostas`);
      });
      
      // 2. Verificar fila de análise
      console.log('\n📋 2. FILA DE ANÁLISE:');
      const aguardandoAnalise = proposals.filter(p => p.status === 'aguardando_analise' || p.status === 'em_analise');
      console.log(`   Propostas aguardando análise: ${aguardandoAnalise.length}`);
      
      // 3. Verificar propostas aprovadas
      console.log('\n✅ 3. PROPOSTAS APROVADAS:');
      const aprovadas = proposals.filter(p => p.status === 'aprovado');
      console.log(`   Total aprovadas: ${aprovadas.length}`);
      
      let aprovadasSemCCB = 0;
      let aprovadasComCCB = 0;
      aprovadas.forEach(p => {
        if (p.ccbGerado) {
          aprovadasComCCB++;
        } else {
          aprovadasSemCCB++;
        }
      });
      
      console.log(`   - Com CCB gerado: ${aprovadasComCCB}`);
      console.log(`   - Sem CCB: ${aprovadasSemCCB}`);
      
      // 4. Verificar ClickSign
      console.log('\n✍️  4. INTEGRAÇÃO CLICKSIGN:');
      const comClickSign = proposals.filter(p => p.clicksignDocumentKey);
      const assinadas = proposals.filter(p => p.assinaturaEletronicaConcluida);
      console.log(`   Enviadas para ClickSign: ${comClickSign.length}`);
      console.log(`   Assinadas: ${assinadas.length}`);
      
      // 5. Verificar pagamentos
      console.log('\n💰 5. FLUXO DE PAGAMENTO:');
      const prontosPagamento = proposals.filter(p => p.status === 'pronto_pagamento');
      const pagas = proposals.filter(p => p.status === 'pago');
      console.log(`   Prontas para pagamento: ${prontosPagamento.length}`);
      console.log(`   Pagas: ${pagas.length}`);
      
      // 6. Análise detalhada de uma proposta
      if (proposals.length > 0) {
        console.log('\n🔎 6. ANÁLISE DETALHADA (Primeira Proposta):');
        const proposta = proposals[0];
        console.log(`   ID: ${proposta.id}`);
        console.log(`   Status: ${proposta.status}`);
        console.log(`   Cliente: ${proposta.clienteData?.nome || 'N/A'}`);
        console.log(`   CCB Gerado: ${proposta.ccbGerado ? '✅' : '❌'}`);
        console.log(`   ClickSign: ${proposta.clicksignStatus || 'N/A'}`);
        console.log(`   Assinatura: ${proposta.assinaturaEletronicaConcluida ? '✅' : '❌'}`);
        
        // Verificar se tem documentos
        if (proposta.id) {
          try {
            const docsResponse = await axios.get(`${API_URL}/propostas/${proposta.id}/documentos`);
            console.log(`   Documentos: ${docsResponse.data.length} arquivos`);
          } catch (e) {
            console.log(`   Documentos: Erro ao verificar`);
          }
        }
      }
      
      // RESUMO E PROBLEMAS
      console.log('\n============================================');
      console.log('📊 RESUMO DA AUDITORIA');
      console.log('============================================');
      
      const problems = [];
      if (aprovadasSemCCB > 0) {
        problems.push(`${aprovadasSemCCB} propostas aprovadas sem CCB gerado`);
      }
      
      const ccbSemClickSign = proposals.filter(p => p.ccbGerado && !p.clicksignDocumentKey);
      if (ccbSemClickSign.length > 0) {
        problems.push(`${ccbSemClickSign.length} CCBs não enviados para ClickSign`);
      }
      
      const assinadasNaoPagas = proposals.filter(p => p.assinaturaEletronicaConcluida && p.status !== 'pago');
      if (assinadasNaoPagas.length > 0) {
        problems.push(`${assinadasNaoPagas.length} contratos assinados não pagos`);
      }
      
      if (problems.length === 0) {
        console.log('\n✅ FLUXO FUNCIONANDO CORRETAMENTE!');
      } else {
        console.log('\n⚠️  PROBLEMAS ENCONTRADOS:');
        problems.forEach(p => console.log(`   - ${p}`));
      }
      
    } catch (error) {
      console.log(`   ❌ Erro ao acessar API: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Dados: ${JSON.stringify(error.response.data)}`);
      }
    }
    
    // 7. Testar funcionalidades do analista
    console.log('\n\n👨‍💼 7. TESTANDO FUNCIONALIDADES DO ANALISTA:');
    console.log('   ℹ️  Para testar as ações do analista, é necessário:');
    console.log('   1. Ter uma proposta em "aguardando_analise"');
    console.log('   2. Fazer login como ANALISTA');
    console.log('   3. Acessar a tela de análise');
    console.log('   4. Testar os botões: Aprovar, Pendenciar, Negar');
    
    // 8. Verificar Banco Inter
    console.log('\n🏦 8. INTEGRAÇÃO BANCO INTER:');
    try {
      // Tentar verificar se há collections
      console.log('   ℹ️  Para verificar boletos:');
      console.log('   1. Uma proposta precisa ser assinada no ClickSign');
      console.log('   2. O webhook do ClickSign dispara geração do boleto');
      console.log('   3. Verificar em /api/inter/collections');
    } catch (error) {
      console.log('   ❌ Erro ao verificar Banco Inter');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar auditoria
auditProposalFlow();