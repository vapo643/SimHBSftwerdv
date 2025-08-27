/**
 * Script de teste para validar a API de simulação re-arquitetada
 * Executa cenários de teste conforme PROTOCOLO 5-CHECK
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

async function testarSimulacao() {
  console.log('====================================');
  console.log('TESTE DA API DE SIMULAÇÃO REFATORADA');
  console.log('====================================\n');

  // Cenário 1: Teste com valores padrão (R$ 10.000 em 12 meses)
  console.log('📊 CENÁRIO 1: Simulação R$ 10.000 em 12 meses');
  console.log('------------------------------------------------');

  try {
    const response1 = await axios.post(`${API_BASE_URL}/api/simular`, {
      valorEmprestimo: 10000,
      prazoMeses: 12,
      parceiroId: 1,
      produtoId: 1,
    });

    const resultado1 = response1.data;
    console.log('✅ Simulação concluída com sucesso!');
    console.log('\n📈 RESULTADOS:');
    console.log(`  • Valor Empréstimo: R$ ${resultado1.valorEmprestimo.toFixed(2)}`);
    console.log(`  • Prazo: ${resultado1.prazoMeses} meses`);
    console.log(`  • Taxa Juros Mensal: ${resultado1.taxaJurosMensal}%`);
    console.log(`  • Taxa Juros Anual: ${resultado1.taxaJurosAnual.toFixed(2)}%`);
    console.log(`  • IOF Total: R$ ${resultado1.iof.total.toFixed(2)}`);
    console.log(`    - IOF Diário: R$ ${resultado1.iof.diario.toFixed(2)}`);
    console.log(`    - IOF Adicional: R$ ${resultado1.iof.adicional.toFixed(2)}`);
    console.log(`  • TAC: R$ ${resultado1.tac.toFixed(2)}`);
    console.log(`  • Valor Total Financiado: R$ ${resultado1.valorTotalFinanciado.toFixed(2)}`);
    console.log(`  • Valor da Parcela: R$ ${resultado1.valorParcela.toFixed(2)}`);
    console.log(`  • Valor Total a Pagar: R$ ${resultado1.valorTotalAPagar.toFixed(2)}`);
    console.log(`  • Custo Total da Operação: R$ ${resultado1.custoTotalOperacao.toFixed(2)}`);
    console.log(`  • CET Anual: ${resultado1.cetAnual}%`);

    if (resultado1.comissao) {
      console.log(
        `  • Comissão: ${resultado1.comissao.percentual}% = R$ ${resultado1.comissao.valor.toFixed(2)}`
      );
    }

    // Mostra primeiras 3 parcelas do cronograma
    if (resultado1.cronogramaPagamento && resultado1.cronogramaPagamento.length > 0) {
      console.log('\n📅 CRONOGRAMA (primeiras 3 parcelas):');
      resultado1.cronogramaPagamento.slice(0, 3).forEach((parcela: any) => {
        console.log(
          `  Parcela ${parcela.parcela}: ${parcela.dataVencimento} - R$ ${parcela.valorParcela.toFixed(2)}`
        );
        console.log(
          `    Juros: R$ ${parcela.valorJuros.toFixed(2)} | Amortização: R$ ${parcela.valorAmortizacao.toFixed(2)}`
        );
      });
    }
  } catch (error: any) {
    console.error('❌ Erro no Cenário 1:', error.response?.data || error.message);
  }

  console.log('\n====================================\n');

  // Cenário 2: Teste com parceiro sem tabela específica
  console.log('📊 CENÁRIO 2: Simulação com fallback para produto');
  console.log('------------------------------------------------');

  try {
    const response2 = await axios.post(`${API_BASE_URL}/api/simular`, {
      valorEmprestimo: 5000,
      prazoMeses: 6,
      produtoId: 1, // Apenas produto, sem parceiro
    });

    const resultado2 = response2.data;
    console.log('✅ Simulação com fallback concluída!');
    console.log(`  • Valor da Parcela: R$ ${resultado2.valorParcela.toFixed(2)}`);
    console.log(`  • CET Anual: ${resultado2.cetAnual}%`);
    console.log(`  • Taxa utilizada: ${resultado2.taxaJurosMensal}% ao mês`);

    console.log('\n📝 Parâmetros utilizados (fallback):');
    console.log(`  • Produto ID: ${resultado2.parametrosUtilizados.produtoId}`);
    console.log(`  • Taxa de Juros: ${resultado2.parametrosUtilizados.taxaJurosMensal}%`);
    console.log(`  • TAC Tipo: ${resultado2.parametrosUtilizados.tacTipo}`);
    console.log(`  • TAC Valor: R$ ${resultado2.parametrosUtilizados.tacValor}`);
  } catch (error: any) {
    console.error('❌ Erro no Cenário 2:', error.response?.data || error.message);
  }

  console.log('\n====================================\n');

  // Cenário 3: Teste de validação (parâmetros inválidos)
  console.log('📊 CENÁRIO 3: Teste de validação de entrada');
  console.log('------------------------------------------------');

  try {
    const response3 = await axios.post(`${API_BASE_URL}/api/simular`, {
      valorEmprestimo: -1000, // Valor inválido
      prazoMeses: 12,
    });

    console.log('❌ Deveria ter retornado erro!');
  } catch (error: any) {
    if (error.response?.status === 400) {
      console.log('✅ Validação funcionando corretamente!');
      console.log(`  • Erro capturado: ${error.response.data.error}`);
    } else {
      console.error('❌ Erro inesperado:', error.message);
    }
  }

  console.log('\n====================================');
  console.log('TESTE FINALIZADO');
  console.log('====================================');
}

// Executar teste se chamado diretamente
console.log('Iniciando testes da API de simulação...\n');
console.log('⚠️  Certifique-se de que o servidor está rodando na porta 5000\n');

setTimeout(() => {
  testarSimulacao().catch(console.error);
}, 2000);

export { testarSimulacao };
